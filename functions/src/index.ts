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
