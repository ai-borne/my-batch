import { FieldValue } from "firebase-admin/firestore"
import { HttpsError, onCall } from "firebase-functions/v2/https"
import { db, houseIds, limitSensitiveOperation, requireBatchId, requireCoordinator, requireRecentAuthentication, requireText, requireUid } from "./shared.js"

const enforceAppCheck = process.env.FUNCTIONS_EMULATOR !== 'true'

export const approveMembership = onCall({ enforceAppCheck }, async (request) => {
  const { batchId, requestId } = request.data as { batchId?: string; requestId?: string }
  if (!batchId || !requestId) throw new HttpsError('invalid-argument', 'batchId and requestId are required.')

  const coordinatorUid = requireUid(request.auth)
  requireRecentAuthentication(request.auth)
  await requireCoordinator(batchId, request.auth)
  await limitSensitiveOperation(coordinatorUid, 'approveMembership')
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
      actorUid: coordinatorUid, action: 'membership.approved', targetUid: uid, batchId, createdAt: FieldValue.serverTimestamp(), outcome: 'success',
    })
  })

  return { approved: true }
})

export const rejectMembership = onCall({ enforceAppCheck }, async (request) => {
  const { batchId, requestId, reason } = request.data as { batchId?: unknown; requestId?: unknown; reason?: unknown }
  requireBatchId(batchId)
  if (typeof requestId !== 'string') throw new HttpsError('invalid-argument', 'requestId is required.')
  const actorUid = requireUid(request.auth)
  requireRecentAuthentication(request.auth)
  await requireCoordinator(batchId, request.auth)
  await limitSensitiveOperation(actorUid, 'rejectMembership')
  const requestRef = db.doc(`batches/${batchId}/accessRequests/${requestId}`)
  await db.runTransaction(async (transaction) => {
    const accessRequest = await transaction.get(requestRef)
    if (!accessRequest.exists || accessRequest.data()?.status !== 'pending') throw new HttpsError('failed-precondition', 'The access request is not pending.')
    transaction.update(requestRef, { status: 'rejected', rejectionReason: requireText(reason, 'reason', 300), rejectedBy: actorUid, rejectedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
    transaction.create(db.collection(`batches/${batchId}/auditEvents`).doc(), { actorUid, action: 'membership.rejected', targetUid: accessRequest.data()?.uid, batchId, outcome: 'success', createdAt: FieldValue.serverTimestamp() })
  })
  return { rejected: true }
})

export const manageMembership = onCall({ enforceAppCheck }, async (request) => {
  const { batchId, memberUid, action, houseId } = request.data as { batchId?: unknown; memberUid?: unknown; action?: unknown; houseId?: unknown }
  requireBatchId(batchId)
  if (typeof memberUid !== 'string' || !['suspend', 'remove', 'reinstate', 'assignHouse'].includes(String(action))) {
    throw new HttpsError('invalid-argument', 'A member and supported action are required.')
  }
  if (action === 'assignHouse' && (typeof houseId !== 'string' || !houseIds.has(houseId))) throw new HttpsError('invalid-argument', 'A valid houseId is required.')
  const actorUid = requireUid(request.auth)
  requireRecentAuthentication(request.auth)
  await requireCoordinator(batchId, request.auth)
  await limitSensitiveOperation(actorUid, 'manageMembership')
  const membershipRef = db.doc(`batches/${batchId}/memberships/${memberUid}`)
  const profileRef = db.doc(`batches/${batchId}/profiles/${memberUid}`)
  await db.runTransaction(async (transaction) => {
    const membership = await transaction.get(membershipRef)
    if (!membership.exists) throw new HttpsError('not-found', 'Membership was not found.')
    const updates = action === 'assignHouse' ? { houseId } : { status: action === 'reinstate' ? 'active' : action === 'suspend' ? 'suspended' : 'removed' }
    transaction.update(membershipRef, { ...updates, updatedAt: FieldValue.serverTimestamp() })
    if (action === 'assignHouse') transaction.set(profileRef, { uid: memberUid, houseId, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    transaction.create(db.collection(`batches/${batchId}/auditEvents`).doc(), {
      actorUid, action: `membership.${action}`, targetUid: memberUid, batchId, createdAt: FieldValue.serverTimestamp(), outcome: 'success',
    })
  })
  return { updated: true }
})

export const requestProfileDataChange = onCall({ enforceAppCheck }, async (request) => {
  const { batchId, action } = request.data as { batchId?: unknown; action?: unknown }
  requireBatchId(batchId)
  if (action !== 'correction' && action !== 'deletion') throw new HttpsError('invalid-argument', 'A supported request action is required.')
  const uid = requireUid(request.auth)
  const membership = await db.doc(`batches/${batchId}/memberships/${uid}`).get()
  if (membership.data()?.status !== 'active') throw new HttpsError('permission-denied', 'Active membership is required.')
  await db.collection(`batches/${batchId}/profileDataRequests`).add({ uid, action, status: 'open', createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
  return { requested: true }
})
