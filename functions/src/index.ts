import { initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'

initializeApp()

const db = getFirestore()
const houseIds = new Set(['shivaji', 'nehru', 'karve', 'rana-pratap', 'shastri', 'tilak'])

function requireUid(auth: { uid: string } | undefined) {
  if (!auth) throw new HttpsError('unauthenticated', 'Sign in is required.')
  return auth.uid
}

async function requireCoordinator(batchId: string, uid: string) {
  const membership = await db.doc(`batches/${batchId}/memberships/${uid}`).get()
  if (membership.data()?.status !== 'active' || membership.data()?.role !== 'coordinator') {
    throw new HttpsError('permission-denied', 'Coordinator access is required.')
  }
}

async function requireActiveMember(batchId: string, uid: string) {
  const membership = await db.doc(`batches/${batchId}/memberships/${uid}`).get()
  if (membership.data()?.status !== 'active') {
    throw new HttpsError('permission-denied', 'An active membership is required.')
  }
}

function requireBatchId(batchId: unknown): asserts batchId is string {
  if (typeof batchId !== 'string' || !batchId) throw new HttpsError('invalid-argument', 'batchId is required.')
}

function requirePaise(value: unknown, field: string) {
  if (!Number.isInteger(value) || Number(value) <= 0 || Number(value) > 10_000_000_00) {
    throw new HttpsError('invalid-argument', `${field} must be a positive INR amount in paise.`)
  }
  return Number(value)
}

function requireText(value: unknown, field: string, maximum: number) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum) {
    throw new HttpsError('invalid-argument', `${field} is required and too long.`)
  }
  return value.trim()
}

async function writeFundSummary(transaction: FirebaseFirestore.Transaction, batchId: string) {
  const claims = await transaction.get(db.collection(`batches/${batchId}/paymentClaims`).where('status', '==', 'verified'))
  const expenses = await transaction.get(db.collection(`batches/${batchId}/expenses`).where('status', '==', 'approved'))
  const collectedPaise = claims.docs.reduce((total, claim) => total + Number(claim.data().amountPaise ?? 0), 0)
  const expensePaise = expenses.docs.reduce((total, expense) => total + Number(expense.data().amountPaise ?? 0), 0)
  const verifiedMembers = new Set(claims.docs.map((claim) => String(claim.data().memberUid)))
  const config = await transaction.get(db.doc(`batches/${batchId}/paymentConfig/current`))
  transaction.set(db.doc(`batches/${batchId}/fundSummary/public`), {
    targetPaise: Number(config.data()?.targetPaise ?? 0), collectedPaise, expensePaise,
    balancePaise: collectedPaise - expensePaise, verifiedFamilyCount: verifiedMembers.size,
    verifiedPaymentCount: claims.size, updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true })
}

export const approveMembership = onCall(async (request) => {
  const { batchId, requestId } = request.data as { batchId?: string; requestId?: string }
  if (!batchId || !requestId) throw new HttpsError('invalid-argument', 'batchId and requestId are required.')

  const coordinatorUid = requireUid(request.auth)
  await requireCoordinator(batchId, coordinatorUid)
  const requestRef = db.doc(`batches/${batchId}/accessRequests/${requestId}`)

  await db.runTransaction(async (transaction) => {
    const accessRequest = await transaction.get(requestRef)
    if (!accessRequest.exists || accessRequest.data()?.status !== 'pending') {
      throw new HttpsError('failed-precondition', 'The access request is not pending.')
    }
    const { uid, displayName, houseId, passingYear } = accessRequest.data() as Record<string, unknown>
    if (typeof uid !== 'string' || typeof displayName !== 'string' || typeof passingYear !== 'number') {
      throw new HttpsError('invalid-argument', 'The access request has invalid identity fields.')
    }

    const membershipRef = db.doc(`batches/${batchId}/memberships/${uid}`)
    const profileRef = db.doc(`batches/${batchId}/profiles/${uid}`)
    transaction.set(membershipRef, {
      uid, batchId, role: 'batchmate', status: 'active', houseId: typeof houseId === 'string' ? houseId : null,
      approvedBy: coordinatorUid, approvedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })
    transaction.set(profileRef, { uid, displayName, houseId: typeof houseId === 'string' ? houseId : null, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    transaction.update(requestRef, { status: 'approved', approvedBy: coordinatorUid, approvedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
    transaction.create(db.collection(`batches/${batchId}/auditEvents`).doc(), {
      actorUid: coordinatorUid, action: 'membership.approved', targetUid: uid, createdAt: FieldValue.serverTimestamp(), outcome: 'success',
    })
  })

  return { approved: true }
})

export const manageMembership = onCall(async (request) => {
  const { batchId, memberUid, action, houseId } = request.data as { batchId?: unknown; memberUid?: unknown; action?: unknown; houseId?: unknown }
  requireBatchId(batchId)
  if (typeof memberUid !== 'string' || !['suspend', 'remove', 'reinstate', 'assignHouse'].includes(String(action))) {
    throw new HttpsError('invalid-argument', 'A member and supported action are required.')
  }
  if (action === 'assignHouse' && (typeof houseId !== 'string' || !houseIds.has(houseId))) throw new HttpsError('invalid-argument', 'A valid houseId is required.')
  const actorUid = requireUid(request.auth)
  await requireCoordinator(batchId, actorUid)
  const membershipRef = db.doc(`batches/${batchId}/memberships/${memberUid}`)
  const profileRef = db.doc(`batches/${batchId}/profiles/${memberUid}`)
  await db.runTransaction(async (transaction) => {
    const membership = await transaction.get(membershipRef)
    if (!membership.exists) throw new HttpsError('not-found', 'Membership was not found.')
    const updates = action === 'assignHouse' ? { houseId } : { status: action === 'reinstate' ? 'active' : action === 'suspend' ? 'suspended' : 'removed' }
    transaction.update(membershipRef, { ...updates, updatedAt: FieldValue.serverTimestamp() })
    if (action === 'assignHouse') transaction.set(profileRef, { uid: memberUid, houseId, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    transaction.create(db.collection(`batches/${batchId}/auditEvents`).doc(), {
      actorUid, action: `membership.${action}`, targetUid: memberUid, createdAt: FieldValue.serverTimestamp(), outcome: 'success',
    })
  })
  return { updated: true }
})

export const submitRsvp = onCall(async (request) => {
  const { batchId, attendance, accompanyingAdults, accompanyingChildren, foodPreference, hotelRequired, miscellaneousDetails } = request.data as Record<string, unknown>
  requireBatchId(batchId)
  const adultCount = typeof accompanyingAdults === 'number' ? accompanyingAdults : Number.NaN
  const childCount = typeof accompanyingChildren === 'number' ? accompanyingChildren : Number.NaN
  if (!['yes', 'no', 'maybe'].includes(String(attendance)) || !['vegetarian', 'nonVegetarian', 'notSpecified'].includes(String(foodPreference)) || typeof hotelRequired !== 'boolean' || !Number.isInteger(adultCount) || !Number.isInteger(childCount) || adultCount < 0 || childCount < 0) {
    throw new HttpsError('invalid-argument', 'RSVP details are invalid.')
  }
  if (miscellaneousDetails !== undefined && (typeof miscellaneousDetails !== 'string' || miscellaneousDetails.length > 1000)) throw new HttpsError('invalid-argument', 'Miscellaneous details are invalid.')
  const uid = requireUid(request.auth)
  await requireActiveMember(batchId, uid)
  const configRef = db.doc(`batches/${batchId}/reunion/config`)
  const rsvpRef = db.doc(`batches/${batchId}/rsvps/${uid}`)
  await db.runTransaction(async (transaction) => {
    const [config, existing] = await Promise.all([transaction.get(configRef), transaction.get(rsvpRef)])
    const cutoff = config.data()?.rsvpCutoffAt?.toDate?.() as Date | undefined
    const reopened = existing.data()?.reopenedAt
    if (cutoff && cutoff <= new Date() && !reopened) throw new HttpsError('failed-precondition', 'The RSVP editing period has closed.')
    transaction.set(rsvpRef, { uid, batchId, attendance, accompanyingAdults: adultCount, accompanyingChildren: childCount, foodPreference, hotelRequired, ...(miscellaneousDetails ? { miscellaneousDetails } : {}), reopenedAt: FieldValue.delete(), reopenedBy: FieldValue.delete(), submittedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), updatedBy: uid }, { merge: true })
  })
  return { saved: true }
})

export const reopenRsvp = onCall(async (request) => {
  const { batchId, memberUid } = request.data as { batchId?: unknown; memberUid?: unknown }
  requireBatchId(batchId)
  if (typeof memberUid !== 'string' || !memberUid) throw new HttpsError('invalid-argument', 'memberUid is required.')
  const actorUid = requireUid(request.auth)
  await requireCoordinator(batchId, actorUid)
  await db.runTransaction(async (transaction) => {
    const rsvpRef = db.doc(`batches/${batchId}/rsvps/${memberUid}`)
    transaction.set(rsvpRef, { uid: memberUid, batchId, reopenedBy: actorUid, reopenedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    transaction.create(db.collection(`batches/${batchId}/auditEvents`).doc(), { actorUid, action: 'rsvp.reopened', targetUid: memberUid, createdAt: FieldValue.serverTimestamp(), outcome: 'success' })
  })
  return { reopened: true }
})

export const submitPaymentClaim = onCall(async (request) => {
  const { batchId, amountPaise, utr, paymentDate, contributionHead = 'reunion', screenshotStoragePath } = request.data as Record<string, unknown>
  requireBatchId(batchId)
  const uid = requireUid(request.auth)
  await requireActiveMember(batchId, uid)
  const amount = requirePaise(amountPaise, 'amountPaise')
  const transactionId = requireText(utr, 'utr', 100)
  const head = requireText(contributionHead, 'contributionHead', 80)
  if (typeof paymentDate !== 'string' || Number.isNaN(Date.parse(paymentDate))) throw new HttpsError('invalid-argument', 'paymentDate is invalid.')
  const claimRef = db.collection(`batches/${batchId}/paymentClaims`).doc()
  const expectedEvidencePath = `batches/${batchId}/payments/${claimRef.id}/evidence/`
  if (screenshotStoragePath !== undefined && (typeof screenshotStoragePath !== 'string' || !screenshotStoragePath.startsWith(expectedEvidencePath))) {
    throw new HttpsError('invalid-argument', 'The payment evidence path is invalid.')
  }
  await claimRef.create({ batchId, memberUid: uid, amountPaise: amount, contributionHead: head, utr: transactionId, paymentDate: new Date(paymentDate), paymentMethod: 'upi', status: 'submitted', ...(screenshotStoragePath ? { screenshotStoragePath } : {}), submittedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
  await db.collection(`batches/${batchId}/auditEvents`).add({ actorUid: uid, action: 'payment.submitted', targetUid: uid, targetId: claimRef.id, createdAt: FieldValue.serverTimestamp(), outcome: 'success' })
  return { submitted: true, claimId: claimRef.id }
})

export const attachPaymentEvidence = onCall(async (request) => {
  const { batchId, claimId, screenshotStoragePath } = request.data as Record<string, unknown>
  requireBatchId(batchId)
  if (typeof claimId !== 'string' || typeof screenshotStoragePath !== 'string' || !screenshotStoragePath.startsWith(`batches/${batchId}/payments/${claimId}/evidence/`)) throw new HttpsError('invalid-argument', 'Payment evidence details are invalid.')
  const uid = requireUid(request.auth); await requireActiveMember(batchId, uid)
  const ref = db.doc(`batches/${batchId}/paymentClaims/${claimId}`); const claim = await ref.get()
  if (!claim.exists || claim.data()?.memberUid !== uid || !['submitted', 'underReview'].includes(String(claim.data()?.status))) throw new HttpsError('permission-denied', 'You cannot attach evidence to this claim.')
  await ref.update({ screenshotStoragePath, updatedAt: FieldValue.serverTimestamp() })
  return { attached: true }
})

export const reviewPaymentClaim = onCall(async (request) => {
  const { batchId, claimId, status, note } = request.data as Record<string, unknown>
  requireBatchId(batchId)
  if (typeof claimId !== 'string' || !claimId || !['underReview', 'verified', 'rejected'].includes(String(status))) throw new HttpsError('invalid-argument', 'A claim and valid review status are required.')
  if (note !== undefined && (typeof note !== 'string' || note.length > 1000)) throw new HttpsError('invalid-argument', 'Review note is invalid.')
  const actorUid = requireUid(request.auth)
  await requireCoordinator(batchId, actorUid)
  await db.runTransaction(async (transaction) => {
    const claimRef = db.doc(`batches/${batchId}/paymentClaims/${claimId}`)
    const claim = await transaction.get(claimRef)
    if (!claim.exists) throw new HttpsError('not-found', 'Payment claim was not found.')
    transaction.update(claimRef, { status, reviewedBy: actorUid, reviewedAt: FieldValue.serverTimestamp(), ...(status === 'rejected' ? { rejectionReason: note ?? 'Unable to verify this payment.' } : {}), ...(status === 'underReview' ? { clarificationNote: note ?? 'Coordinator is reviewing this payment.' } : {}), updatedAt: FieldValue.serverTimestamp() })
    if (status === 'verified' || claim.data()?.status === 'verified') await writeFundSummary(transaction, batchId)
    transaction.create(db.collection(`batches/${batchId}/auditEvents`).doc(), { actorUid, action: `payment.${status}`, targetUid: claim.data()?.memberUid, targetId: claimId, createdAt: FieldValue.serverTimestamp(), outcome: 'success' })
  })
  return { reviewed: true }
})

export const saveExpense = onCall(async (request) => {
  const { batchId, category, amountPaise, vendor, expenseDate, notes, receiptStoragePath } = request.data as Record<string, unknown>
  requireBatchId(batchId); const actorUid = requireUid(request.auth); await requireCoordinator(batchId, actorUid)
  const amount = requirePaise(amountPaise, 'amountPaise'); const expenseCategory = requireText(category, 'category', 80); const expenseVendor = requireText(vendor, 'vendor', 160)
  if (typeof expenseDate !== 'string' || Number.isNaN(Date.parse(expenseDate))) throw new HttpsError('invalid-argument', 'expenseDate is invalid.')
  if (notes !== undefined && (typeof notes !== 'string' || notes.length > 1000)) throw new HttpsError('invalid-argument', 'notes are invalid.')
  const expenseRef = db.collection(`batches/${batchId}/expenses`).doc()
  if (receiptStoragePath !== undefined && (typeof receiptStoragePath !== 'string' || !receiptStoragePath.startsWith(`batches/${batchId}/expenses/${expenseRef.id}/receipts/`))) throw new HttpsError('invalid-argument', 'The receipt path is invalid.')
  await expenseRef.create({ category: expenseCategory, amountPaise: amount, vendor: expenseVendor, expenseDate: new Date(expenseDate), ...(notes ? { notes } : {}), ...(receiptStoragePath ? { receiptStoragePath } : {}), status: 'draft', createdBy: actorUid, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
  await db.collection(`batches/${batchId}/auditEvents`).add({ actorUid, action: 'expense.created', targetId: expenseRef.id, createdAt: FieldValue.serverTimestamp(), outcome: 'success' })
  return { saved: true, expenseId: expenseRef.id }
})

export const attachExpenseReceipt = onCall(async (request) => {
  const { batchId, expenseId, receiptStoragePath } = request.data as Record<string, unknown>
  requireBatchId(batchId)
  if (typeof expenseId !== 'string' || typeof receiptStoragePath !== 'string' || !receiptStoragePath.startsWith(`batches/${batchId}/expenses/${expenseId}/receipts/`)) throw new HttpsError('invalid-argument', 'Receipt details are invalid.')
  const actorUid = requireUid(request.auth); await requireCoordinator(batchId, actorUid)
  const ref = db.doc(`batches/${batchId}/expenses/${expenseId}`)
  if (!(await ref.get()).exists) throw new HttpsError('not-found', 'Expense was not found.')
  await ref.update({ receiptStoragePath, updatedAt: FieldValue.serverTimestamp() })
  return { attached: true }
})

export const reviewExpense = onCall(async (request) => {
  const { batchId, expenseId, status } = request.data as Record<string, unknown>
  requireBatchId(batchId)
  if (typeof expenseId !== 'string' || !expenseId || !['approved', 'rejected'].includes(String(status))) throw new HttpsError('invalid-argument', 'An expense and valid review status are required.')
  const actorUid = requireUid(request.auth); await requireCoordinator(batchId, actorUid)
  await db.runTransaction(async (transaction) => {
    const ref = db.doc(`batches/${batchId}/expenses/${expenseId}`); const expense = await transaction.get(ref)
    if (!expense.exists) throw new HttpsError('not-found', 'Expense was not found.')
    transaction.update(ref, { status, approvedBy: actorUid, approvedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
    if (status === 'approved' || expense.data()?.status === 'approved') await writeFundSummary(transaction, batchId)
    transaction.create(db.collection(`batches/${batchId}/auditEvents`).doc(), { actorUid, action: `expense.${status}`, targetId: expenseId, createdAt: FieldValue.serverTimestamp(), outcome: 'success' })
  })
  return { reviewed: true }
})

export const rebuildFundSummary = onCall(async (request) => {
  const { batchId } = request.data as { batchId?: unknown }; requireBatchId(batchId)
  const actorUid = requireUid(request.auth); await requireCoordinator(batchId, actorUid)
  await db.runTransaction(async (transaction) => { await writeFundSummary(transaction, batchId); transaction.create(db.collection(`batches/${batchId}/auditEvents`).doc(), { actorUid, action: 'fundSummary.rebuilt', createdAt: FieldValue.serverTimestamp(), outcome: 'success' }) })
  return { rebuilt: true }
})
