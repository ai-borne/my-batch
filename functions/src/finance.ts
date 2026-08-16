import { FieldValue } from "firebase-admin/firestore"
import { HttpsError } from "firebase-functions/v2/https"
import { db, requireActiveMember, requireBatchId, requireCoordinator, requireIdempotencyKey, requirePaise, requireText, requireUid } from "./shared.js"
import { notify } from './notifications.js'
import { limitCallable, secureCall } from './security.js'

const expenseCategories = new Set(['venue', 'accommodation', 'food', 'transport', 'programme', 'administration', 'contingency', 'other'])
const financialRetentionUntil = new Date('2034-01-08T00:00:00.000Z')

type FundChange = { collection: 'paymentClaims' | 'expenses'; id: string; status: string }
async function writeFundSummary(transaction: FirebaseFirestore.Transaction, batchId: string, change?: FundChange) {
  const claims = await transaction.get(db.collection(`batches/${batchId}/paymentClaims`).where('status', '==', 'verified'))
  const expenses = await transaction.get(db.collection(`batches/${batchId}/expenses`).where('status', '==', 'approved'))
  const verifiedClaims = claims.docs.filter((claim) => !(change?.collection === 'paymentClaims' && change.id === claim.id && change.status !== 'verified'))
  const approvedExpenses = expenses.docs.filter((expense) => !(change?.collection === 'expenses' && change.id === expense.id && change.status !== 'approved'))
  const changedClaim = change?.collection === 'paymentClaims' && change.status === 'verified' && !claims.docs.some((claim) => claim.id === change.id) ? await transaction.get(db.doc(`batches/${batchId}/paymentClaims/${change!.id}`)) : undefined
  const changedExpense = change?.collection === 'expenses' && change.status === 'approved' && !expenses.docs.some((expense) => expense.id === change.id) ? await transaction.get(db.doc(`batches/${batchId}/expenses/${change!.id}`)) : undefined
  const finalClaims = changedClaim?.exists ? [...verifiedClaims, changedClaim] : verifiedClaims
  const finalExpenses = changedExpense?.exists ? [...approvedExpenses, changedExpense] : approvedExpenses
  const collectedPaise = finalClaims.reduce((total, claim) => total + Number(claim.data()?.amountPaise ?? 0), 0)
  const expensePaise = finalExpenses.reduce((total, expense) => total + Number(expense.data()?.amountPaise ?? 0), 0)
  const verifiedMembers = new Set(finalClaims.map((claim) => String(claim.data()?.memberUid)))
  const config = await transaction.get(db.doc(`batches/${batchId}/paymentConfig/current`))
  transaction.set(db.doc(`batches/${batchId}/fundSummary/public`), {
    targetPaise: Number(config.data()?.targetPaise ?? 0), collectedPaise, expensePaise,
    balancePaise: collectedPaise - expensePaise, verifiedFamilyCount: verifiedMembers.size,
    verifiedPaymentCount: finalClaims.length, updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true })
}
export const submitPaymentClaim = secureCall(async (request) => {
  const { batchId, amountPaise, utr, paymentDate, contributionHead = 'reunion', requestId, screenshotStoragePath } = request.data as Record<string, unknown>
  requireBatchId(batchId)
  const uid = requireUid(request.auth)
  await requireActiveMember(batchId, uid)
  await limitCallable(batchId, uid, 'submitPaymentClaim')
  const amount = requirePaise(amountPaise, 'amountPaise')
  const transactionId = requireText(utr, 'utr', 100)
  const head = requireText(contributionHead, 'contributionHead', 80)
  if (typeof paymentDate !== 'string' || Number.isNaN(Date.parse(paymentDate))) throw new HttpsError('invalid-argument', 'paymentDate is invalid.')
  const config = await db.doc(`batches/${batchId}/paymentConfig/current`).get()
  const allowedHeads = config.data()?.contributionHeads
  if (!Array.isArray(allowedHeads) || !allowedHeads.includes(head)) throw new HttpsError('invalid-argument', 'Select a configured contribution head.')
  const claimRef = db.collection(`batches/${batchId}/paymentClaims`).doc(requireIdempotencyKey(requestId))
  const expectedEvidencePath = `batches/${batchId}/payments/${claimRef.id}/evidence/`
  if (screenshotStoragePath !== undefined && (typeof screenshotStoragePath !== 'string' || !screenshotStoragePath.startsWith(expectedEvidencePath))) {
    throw new HttpsError('invalid-argument', 'The payment evidence path is invalid.')
  }
  const created = await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(claimRef)
    if (existing.exists) {
      if (existing.data()?.memberUid !== uid) throw new HttpsError('already-exists', 'A request with this key already exists.')
      return false
    }
    transaction.create(claimRef, { batchId, memberUid: uid, amountPaise: amount, contributionHead: head, utr: transactionId, paymentDate: new Date(paymentDate), paymentMethod: 'upi', status: 'submitted', ...(screenshotStoragePath ? { screenshotStoragePath } : {}), retentionUntil: financialRetentionUntil, submittedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
    transaction.create(db.collection(`batches/${batchId}/auditEvents`).doc(), { actorUid: uid, action: 'payment.submitted', targetUid: uid, targetId: claimRef.id, createdAt: FieldValue.serverTimestamp(), outcome: 'success' })
    return true
  })
  return { submitted: true, duplicate: !created, claimId: claimRef.id }
})

export const attachPaymentEvidence = secureCall(async (request) => {
  const { batchId, claimId, screenshotStoragePath } = request.data as Record<string, unknown>
  requireBatchId(batchId)
  if (typeof claimId !== 'string' || typeof screenshotStoragePath !== 'string' || !screenshotStoragePath.startsWith(`batches/${batchId}/payments/${claimId}/evidence/`)) throw new HttpsError('invalid-argument', 'Payment evidence details are invalid.')
  const uid = requireUid(request.auth); await requireActiveMember(batchId, uid)
  await limitCallable(batchId, uid, 'attachPaymentEvidence')
  const ref = db.doc(`batches/${batchId}/paymentClaims/${claimId}`); const claim = await ref.get()
  if (!claim.exists || claim.data()?.memberUid !== uid || !['submitted', 'underReview', 'clarificationRequired', 'rejected', 'resubmitted'].includes(String(claim.data()?.status))) throw new HttpsError('permission-denied', 'You cannot attach evidence to this claim.')
  await ref.update({ screenshotStoragePath, updatedAt: FieldValue.serverTimestamp() })
  return { attached: true }
})

export const resubmitPaymentClaim = secureCall(async (request) => {
  const { batchId, claimId, amountPaise, utr, paymentDate, contributionHead, screenshotStoragePath } = request.data as Record<string, unknown>
  requireBatchId(batchId); const uid = requireUid(request.auth); await requireActiveMember(batchId, uid)
  await limitCallable(batchId, uid, 'resubmitPaymentClaim')
  if (typeof claimId !== 'string' || !claimId) throw new HttpsError('invalid-argument', 'A claim is required.')
  const amount = requirePaise(amountPaise, 'amountPaise'); const transactionId = requireText(utr, 'utr', 100); const head = requireText(contributionHead, 'contributionHead', 80)
  if (typeof paymentDate !== 'string' || Number.isNaN(Date.parse(paymentDate))) throw new HttpsError('invalid-argument', 'paymentDate is invalid.')
  const config = await db.doc(`batches/${batchId}/paymentConfig/current`).get()
  if (!Array.isArray(config.data()?.contributionHeads) || !config.data()?.contributionHeads.includes(head)) throw new HttpsError('invalid-argument', 'Select a configured contribution head.')
  if (screenshotStoragePath !== undefined && (typeof screenshotStoragePath !== 'string' || !screenshotStoragePath.startsWith(`batches/${batchId}/payments/${claimId}/evidence/`))) throw new HttpsError('invalid-argument', 'The payment evidence path is invalid.')
  await db.runTransaction(async (transaction) => {
    const ref = db.doc(`batches/${batchId}/paymentClaims/${claimId}`); const claim = await transaction.get(ref)
    if (!claim.exists || claim.data()?.memberUid !== uid) throw new HttpsError('permission-denied', 'You cannot resubmit this claim.')
    if (!['clarificationRequired', 'rejected'].includes(String(claim.data()?.status))) throw new HttpsError('failed-precondition', 'This payment claim cannot be resubmitted.')
    transaction.update(ref, { amountPaise: amount, utr: transactionId, paymentDate: new Date(paymentDate), contributionHead: head, status: 'resubmitted', ...(screenshotStoragePath ? { screenshotStoragePath } : {}), resubmittedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
    transaction.create(db.collection(`batches/${batchId}/auditEvents`).doc(), { actorUid: uid, action: 'payment.resubmitted', targetUid: uid, targetId: claimId, createdAt: FieldValue.serverTimestamp(), outcome: 'success' })
  })
  return { resubmitted: true, claimId }
})

export const reviewPaymentClaim = secureCall(async (request) => {
  const { batchId, claimId, status, note } = request.data as Record<string, unknown>
  requireBatchId(batchId)
  if (typeof claimId !== 'string' || !claimId || !['underReview', 'clarificationRequired', 'verified', 'rejected'].includes(String(status))) throw new HttpsError('invalid-argument', 'A claim and valid review status are required.')
  if (note !== undefined && (typeof note !== 'string' || note.length > 1000)) throw new HttpsError('invalid-argument', 'Review note is invalid.')
  const actorUid = requireUid(request.auth)
  await requireCoordinator(batchId, request.auth)
  await limitCallable(batchId, actorUid, 'reviewPaymentClaim')
  const claim = await db.doc(`batches/${batchId}/paymentClaims/${claimId}`).get()
  const changed = await db.runTransaction(async (transaction) => {
    const claimRef = db.doc(`batches/${batchId}/paymentClaims/${claimId}`)
    const claim = await transaction.get(claimRef)
    if (!claim.exists) throw new HttpsError('not-found', 'Payment claim was not found.')
    const nextStatus = String(status)
    const currentStatus = String(claim.data()?.status)
    if (currentStatus === nextStatus) return false
    if (!((currentStatus === 'submitted' && ['underReview', 'clarificationRequired', 'verified', 'rejected'].includes(nextStatus)) || (currentStatus === 'underReview' && ['clarificationRequired', 'verified', 'rejected'].includes(nextStatus)) || (currentStatus === 'resubmitted' && ['underReview', 'clarificationRequired', 'verified', 'rejected'].includes(nextStatus)))) {
      throw new HttpsError('failed-precondition', 'This payment transition is not allowed.')
    }
    if (nextStatus === 'verified' || claim.data()?.status === 'verified') await writeFundSummary(transaction, batchId, { collection: 'paymentClaims', id: claimId, status: nextStatus })
    transaction.update(claimRef, { status, reviewedBy: actorUid, reviewedAt: FieldValue.serverTimestamp(), ...(status === 'rejected' ? { rejectionReason: note ?? 'Unable to verify this payment.' } : {}), ...(status === 'clarificationRequired' ? { clarificationNote: note ?? 'Please correct the payment details and resubmit.' } : {}), updatedAt: FieldValue.serverTimestamp() })
    transaction.create(db.collection(`batches/${batchId}/auditEvents`).doc(), { actorUid, action: `payment.${status}`, targetUid: claim.data()?.memberUid, targetId: claimId, createdAt: FieldValue.serverTimestamp(), outcome: 'success' })
    return true
  })
  const memberUid = claim.data()?.memberUid
  if (changed && typeof memberUid === 'string') await notify(batchId, memberUid, 'payment', `Payment ${status}`, status === 'verified' ? 'Your payment has been verified.' : status === 'underReview' ? 'A Coordinator is reviewing your payment.' : 'Your payment needs correction. Please review and resubmit it.')
  return { reviewed: true }
})

export const saveExpense = secureCall(async (request) => {
  const { batchId, category, amountPaise, vendor, expenseDate, notes, receiptStoragePath, requestId } = request.data as Record<string, unknown>
  requireBatchId(batchId); const actorUid = requireUid(request.auth); await requireCoordinator(batchId, request.auth)
  await limitCallable(batchId, actorUid, 'saveExpense')
  const amount = requirePaise(amountPaise, 'amountPaise'); const expenseCategory = requireText(category, 'category', 80); const expenseVendor = requireText(vendor, 'vendor', 160)
  if (!expenseCategories.has(expenseCategory)) throw new HttpsError('invalid-argument', 'Select a supported expense category.')
  if (typeof expenseDate !== 'string' || Number.isNaN(Date.parse(expenseDate))) throw new HttpsError('invalid-argument', 'expenseDate is invalid.')
  if (notes !== undefined && (typeof notes !== 'string' || notes.length > 1000)) throw new HttpsError('invalid-argument', 'notes are invalid.')
  const expenseRef = db.collection(`batches/${batchId}/expenses`).doc(requireIdempotencyKey(requestId))
  if (receiptStoragePath !== undefined && (typeof receiptStoragePath !== 'string' || !receiptStoragePath.startsWith(`batches/${batchId}/expenses/${expenseRef.id}/receipts/`))) throw new HttpsError('invalid-argument', 'The receipt path is invalid.')
  const created = await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(expenseRef)
    if (existing.exists) {
      if (existing.data()?.createdBy !== actorUid) throw new HttpsError('already-exists', 'A request with this key already exists.')
      return false
    }
    transaction.create(expenseRef, { category: expenseCategory, amountPaise: amount, vendor: expenseVendor, expenseDate: new Date(expenseDate), ...(notes ? { notes } : {}), ...(receiptStoragePath ? { receiptStoragePath } : {}), retentionUntil: financialRetentionUntil, status: 'draft', createdBy: actorUid, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
    transaction.create(db.collection(`batches/${batchId}/auditEvents`).doc(), { actorUid, action: 'expense.created', targetId: expenseRef.id, createdAt: FieldValue.serverTimestamp(), outcome: 'success' })
    return true
  })
  return { saved: true, duplicate: !created, expenseId: expenseRef.id }
})

export const attachExpenseReceipt = secureCall(async (request) => {
  const { batchId, expenseId, receiptStoragePath } = request.data as Record<string, unknown>
  requireBatchId(batchId)
  if (typeof expenseId !== 'string' || typeof receiptStoragePath !== 'string' || !receiptStoragePath.startsWith(`batches/${batchId}/expenses/${expenseId}/receipts/`)) throw new HttpsError('invalid-argument', 'Receipt details are invalid.')
  const actorUid = requireUid(request.auth); await requireCoordinator(batchId, request.auth)
  await limitCallable(batchId, actorUid, 'attachExpenseReceipt')
  const ref = db.doc(`batches/${batchId}/expenses/${expenseId}`)
  if (!(await ref.get()).exists) throw new HttpsError('not-found', 'Expense was not found.')
  await ref.update({ receiptStoragePath, updatedAt: FieldValue.serverTimestamp() })
  return { attached: true }
})

export const reviewExpense = secureCall(async (request) => {
  const { batchId, expenseId, status } = request.data as Record<string, unknown>
  requireBatchId(batchId)
  if (typeof expenseId !== 'string' || !expenseId || !['approved', 'rejected'].includes(String(status))) throw new HttpsError('invalid-argument', 'An expense and valid review status are required.')
  const actorUid = requireUid(request.auth); await requireCoordinator(batchId, request.auth)
  await limitCallable(batchId, actorUid, 'reviewExpense')
  await db.runTransaction(async (transaction) => {
    const ref = db.doc(`batches/${batchId}/expenses/${expenseId}`); const expense = await transaction.get(ref)
    if (!expense.exists) throw new HttpsError('not-found', 'Expense was not found.')
    const nextStatus = String(status)
    if (expense.data()?.status === nextStatus) return
    if (expense.data()?.status !== 'draft') throw new HttpsError('failed-precondition', 'This expense transition is not allowed.')
    if (nextStatus === 'approved' || expense.data()?.status === 'approved') await writeFundSummary(transaction, batchId, { collection: 'expenses', id: expenseId, status: nextStatus })
    transaction.update(ref, { status, approvedBy: actorUid, approvedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
    transaction.create(db.collection(`batches/${batchId}/auditEvents`).doc(), { actorUid, action: `expense.${status}`, targetId: expenseId, createdAt: FieldValue.serverTimestamp(), outcome: 'success' })
  })
  return { reviewed: true }
})

export const rebuildFundSummary = secureCall(async (request) => {
  const { batchId } = request.data as { batchId?: unknown }; requireBatchId(batchId)
  const actorUid = requireUid(request.auth); await requireCoordinator(batchId, request.auth)
  await limitCallable(batchId, actorUid, 'rebuildFundSummary')
  await db.runTransaction(async (transaction) => { await writeFundSummary(transaction, batchId); transaction.create(db.collection(`batches/${batchId}/auditEvents`).doc(), { actorUid, action: 'fundSummary.rebuilt', createdAt: FieldValue.serverTimestamp(), outcome: 'success' }) })
  return { rebuilt: true }
})
