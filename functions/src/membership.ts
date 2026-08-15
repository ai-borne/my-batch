import { FieldValue } from "firebase-admin/firestore"
import { HttpsError } from "firebase-functions/v2/https"
import { db, houseIds, requireBatchId, requireCoordinator, requireIdempotencyKey, requireRecentAuthentication, requireText, requireUid } from "./shared.js"
import { limitCallable, secureCall } from './security.js'

function memberCode(batchId: string, rollNumber: unknown) {
  if (typeof rollNumber !== 'string' || !/^[A-Za-z0-9-]{1,32}$/.test(rollNumber)) {
    throw new HttpsError('invalid-argument', 'A valid school roll number is required.')
  }
  return `${batchId}-${rollNumber.toLowerCase()}`
}

export const approveMembership = secureCall(async (request) => {
  const { batchId, requestId } = request.data as { batchId?: string; requestId?: string }
  if (!batchId || !requestId) throw new HttpsError('invalid-argument', 'batchId and requestId are required.')

  const coordinatorUid = requireUid(request.auth)
  requireRecentAuthentication(request.auth)
  await requireCoordinator(batchId, request.auth)
  await limitCallable(batchId, coordinatorUid, 'approveMembership')
  const requestRef = db.doc(`batches/${batchId}/accessRequests/${requestId}`)

  await db.runTransaction(async (transaction) => {
    const accessRequest = await transaction.get(requestRef)
    if (!accessRequest.exists) {
      throw new HttpsError('not-found', 'The access request was not found.')
    }
    if (accessRequest.data()?.status === 'approved') return
    if (accessRequest.data()?.status !== 'pending') {
      throw new HttpsError('failed-precondition', 'The access request is not pending.')
    }
    const { uid, displayName, houseId, passingYear, rollNumber } = accessRequest.data() as Record<string, unknown>
    if (typeof uid !== 'string' || typeof displayName !== 'string' || typeof passingYear !== 'number') {
      throw new HttpsError('invalid-argument', 'The access request has invalid identity fields.')
    }

    const resolvedMemberCode = memberCode(batchId, rollNumber)
    const memberCodeRef = db.doc(`batches/${batchId}/memberCodes/${resolvedMemberCode}`)
    const memberCodeRecord = await transaction.get(memberCodeRef)
    if (memberCodeRecord.exists && memberCodeRecord.data()?.uid !== uid) {
      throw new HttpsError('already-exists', 'That school roll number is already assigned to a batch member.')
    }
    const membershipRef = db.doc(`batches/${batchId}/memberships/${uid}`)
    const profileRef = db.doc(`batches/${batchId}/profiles/${uid}`)
    transaction.set(membershipRef, {
      uid, batchId, memberCode: resolvedMemberCode, role: 'batchmate', status: 'active', houseId: typeof houseId === 'string' ? houseId : null,
      approvedBy: coordinatorUid, approvedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })
    transaction.set(profileRef, { uid, displayName, memberCode: resolvedMemberCode, houseId: typeof houseId === 'string' ? houseId : null, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    transaction.set(memberCodeRef, { uid, memberCode: resolvedMemberCode, rollNumber, createdAt: FieldValue.serverTimestamp() }, { merge: true })
    transaction.update(requestRef, { status: 'approved', approvedBy: coordinatorUid, approvedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
    transaction.create(db.collection(`batches/${batchId}/auditEvents`).doc(), {
      actorUid: coordinatorUid, action: 'membership.approved', targetUid: uid, batchId, createdAt: FieldValue.serverTimestamp(), outcome: 'success',
    })
  })

  return { approved: true }
})

export const rejectMembership = secureCall(async (request) => {
  const { batchId, requestId, reason } = request.data as { batchId?: unknown; requestId?: unknown; reason?: unknown }
  requireBatchId(batchId)
  if (typeof requestId !== 'string') throw new HttpsError('invalid-argument', 'requestId is required.')
  const actorUid = requireUid(request.auth)
  requireRecentAuthentication(request.auth)
  await requireCoordinator(batchId, request.auth)
  await limitCallable(batchId, actorUid, 'rejectMembership')
  const requestRef = db.doc(`batches/${batchId}/accessRequests/${requestId}`)
  await db.runTransaction(async (transaction) => {
    const accessRequest = await transaction.get(requestRef)
    if (!accessRequest.exists) throw new HttpsError('not-found', 'The access request was not found.')
    if (accessRequest.data()?.status === 'rejected') return
    if (accessRequest.data()?.status !== 'pending') throw new HttpsError('failed-precondition', 'The access request is not pending.')
    transaction.update(requestRef, { status: 'rejected', rejectionReason: requireText(reason, 'reason', 300), rejectedBy: actorUid, rejectedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
    transaction.create(db.collection(`batches/${batchId}/auditEvents`).doc(), { actorUid, action: 'membership.rejected', targetUid: accessRequest.data()?.uid, batchId, outcome: 'success', createdAt: FieldValue.serverTimestamp() })
  })
  return { rejected: true }
})

export const manageMembership = secureCall(async (request) => {
  const { batchId, memberUid, action, houseId } = request.data as { batchId?: unknown; memberUid?: unknown; action?: unknown; houseId?: unknown }
  requireBatchId(batchId)
  if (typeof memberUid !== 'string' || !['suspend', 'remove', 'reinstate', 'assignHouse'].includes(String(action))) {
    throw new HttpsError('invalid-argument', 'A member and supported action are required.')
  }
  if (action === 'assignHouse' && (typeof houseId !== 'string' || !houseIds.has(houseId))) throw new HttpsError('invalid-argument', 'A valid houseId is required.')
  const actorUid = requireUid(request.auth)
  requireRecentAuthentication(request.auth)
  await requireCoordinator(batchId, request.auth)
  await limitCallable(batchId, actorUid, 'manageMembership')
  const membershipRef = db.doc(`batches/${batchId}/memberships/${memberUid}`)
  const profileRef = db.doc(`batches/${batchId}/profiles/${memberUid}`)
  await db.runTransaction(async (transaction) => {
    const membership = await transaction.get(membershipRef)
    if (!membership.exists) throw new HttpsError('not-found', 'Membership was not found.')
    const currentStatus = String(membership.data()?.status)
    const updates = action === 'assignHouse' ? { houseId } : { status: action === 'reinstate' ? 'active' : action === 'suspend' ? 'suspended' : 'removed' }
    const nextStatus = 'status' in updates ? updates.status : undefined
    if (action === 'assignHouse' && currentStatus !== 'active') throw new HttpsError('failed-precondition', 'Only active members can be assigned to a house.')
    if (nextStatus && currentStatus === nextStatus) return
    if ((action === 'suspend' && currentStatus !== 'active') || (action === 'remove' && !['active', 'suspended'].includes(currentStatus)) || (action === 'reinstate' && currentStatus !== 'suspended')) {
      throw new HttpsError('failed-precondition', 'This membership transition is not allowed.')
    }
    transaction.update(membershipRef, { ...updates, updatedAt: FieldValue.serverTimestamp() })
    if (action === 'assignHouse') transaction.set(profileRef, { uid: memberUid, houseId, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    transaction.create(db.collection(`batches/${batchId}/auditEvents`).doc(), {
      actorUid, action: `membership.${action}`, targetUid: memberUid, batchId, createdAt: FieldValue.serverTimestamp(), outcome: 'success',
    })
  })
  return { updated: true }
})

export const requestProfileDataChange = secureCall(async (request) => {
  const { batchId, action, requestId } = request.data as { batchId?: unknown; action?: unknown; requestId?: unknown }
  requireBatchId(batchId)
  if (action !== 'correction' && action !== 'deletion') throw new HttpsError('invalid-argument', 'A supported request action is required.')
  const uid = requireUid(request.auth)
  const membership = await db.doc(`batches/${batchId}/memberships/${uid}`).get()
  if (membership.data()?.status !== 'active') throw new HttpsError('permission-denied', 'Active membership is required.')
  await limitCallable(batchId, uid, 'requestProfileDataChange')
  const ref = db.collection(`batches/${batchId}/profileDataRequests`).doc(requireIdempotencyKey(requestId))
  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(ref)
    if (existing.exists) {
      if (existing.data()?.uid !== uid) throw new HttpsError('already-exists', 'A request with this key already exists.')
      return
    }
    transaction.create(ref, { uid, action, status: 'open', createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
  })
  return { requested: true }
})
