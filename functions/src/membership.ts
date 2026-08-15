import { FieldPath, FieldValue, Timestamp, Transaction } from "firebase-admin/firestore"
import { getAuth } from 'firebase-admin/auth'
import { HttpsError } from "firebase-functions/v2/https"
import { db, houseIds, requireBatchId, requireCoordinator, requireDocumentId, requireIdempotencyKey, requireRecentAuthentication, requireText, requireUid } from "./shared.js"
import { limitCallable, secureCall } from './security.js'
import { requireSuperAdmin, retentionUntil } from './admin.js'

function memberCode(batchId: string, rollNumber: unknown) {
  if (typeof rollNumber !== 'string' || !/^[A-Za-z0-9-]{1,32}$/.test(rollNumber)) {
    throw new HttpsError('invalid-argument', 'A valid school roll number is required.')
  }
  return `${batchId}-${rollNumber.toLowerCase()}`
}

type ApprovalInput = { batchId: string; requestId: string; actorUid: string; role: 'batchmate' | 'coordinator'; auditAction: string; reason?: string; retentionUntil?: ReturnType<typeof retentionUntil> }

async function requireNonSuperAdminTarget(uid: string) {
  if ((await getAuth().getUser(uid)).customClaims?.superAdmin === true) throw new HttpsError('failed-precondition', 'A Super Admin cannot receive batch membership.')
}

export async function approvePendingMembership(transaction: Transaction, input: ApprovalInput) {
  const requestRef = db.doc(`batches/${input.batchId}/accessRequests/${input.requestId}`)
  const accessRequest = await transaction.get(requestRef)
  if (!accessRequest.exists) throw new HttpsError('not-found', 'The access request was not found.')
  if (accessRequest.data()?.status !== 'pending') throw new HttpsError('failed-precondition', 'The access request is not pending.')
  const { uid, displayName, houseId, passingYear, rollNumber } = accessRequest.data() as Record<string, unknown>
  if (typeof uid !== 'string' || typeof displayName !== 'string' || typeof passingYear !== 'number') throw new HttpsError('invalid-argument', 'The access request has invalid identity fields.')
  const resolvedMemberCode = memberCode(input.batchId, rollNumber)
  const memberCodeRef = db.doc(`batches/${input.batchId}/memberCodes/${resolvedMemberCode}`)
  const memberCodeRecord = await transaction.get(memberCodeRef)
  if (memberCodeRecord.exists && memberCodeRecord.data()?.uid !== uid) throw new HttpsError('already-exists', 'That school roll number is already assigned to a batch member.')
  const membershipRef = db.doc(`batches/${input.batchId}/memberships/${uid}`)
  const profileRef = db.doc(`batches/${input.batchId}/profiles/${uid}`)
  transaction.set(membershipRef, { uid, batchId: input.batchId, memberCode: resolvedMemberCode, role: input.role, status: 'active', houseId: typeof houseId === 'string' ? houseId : null, approvedBy: input.actorUid, approvedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true })
  transaction.set(profileRef, { uid, displayName, memberCode: resolvedMemberCode, houseId: typeof houseId === 'string' ? houseId : null, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
  transaction.set(memberCodeRef, { uid, memberCode: resolvedMemberCode, rollNumber, createdAt: FieldValue.serverTimestamp() }, { merge: true })
  transaction.update(requestRef, { status: 'approved', approvedBy: input.actorUid, approvedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
  transaction.create(db.collection(`batches/${input.batchId}/auditEvents`).doc(), { actorUid: input.actorUid, action: input.auditAction, targetUid: uid, batchId: input.batchId, outcome: 'success', roleBefore: 'pending', roleAfter: input.role, ...(input.reason ? { reason: input.reason } : {}), ...(input.retentionUntil ? { retentionUntil: input.retentionUntil } : {}), createdAt: FieldValue.serverTimestamp() })
  return { uid }
}

export const approveMembership = secureCall(async (request) => {
  const { batchId, requestId } = request.data as { batchId?: string; requestId?: string }
  if (!batchId || !requestId) throw new HttpsError('invalid-argument', 'batchId and requestId are required.')

  const coordinatorUid = requireUid(request.auth)
  requireRecentAuthentication(request.auth)
  await requireCoordinator(batchId, request.auth)
  const target = await db.doc(`batches/${batchId}/accessRequests/${requestId}`).get()
  await requireNonSuperAdminTarget(String(target.data()?.uid ?? ''))
  await limitCallable(batchId, coordinatorUid, 'approveMembership')
  await db.runTransaction(async (transaction) => {
    const currentRequest = await transaction.get(db.doc(`batches/${batchId}/accessRequests/${requestId}`))
    if (currentRequest.data()?.status === 'approved') return
    await approvePendingMembership(transaction, { batchId, requestId, actorUid: coordinatorUid, role: 'batchmate', auditAction: 'membership.approved' })
  })

  return { approved: true }
})

export const bootstrapCoordinator = secureCall(async (request) => {
  const { batchId, requestId, reason, operationId } = request.data as { batchId?: unknown; requestId?: unknown; reason?: unknown; operationId?: unknown }
  requireBatchId(batchId); requireDocumentId(requestId, 'requestId'); const validatedReason = requireText(reason, 'reason', 500); requireDocumentId(operationId, 'operationId')
  const actorUid = requireUid(request.auth); requireRecentAuthentication(request.auth); requireSuperAdmin(request.auth)
  const requestRef = db.doc(`batches/${batchId}/accessRequests/${requestId}`)
  const target = await requestRef.get()
  if (target.data()?.uid === actorUid) throw new HttpsError('failed-precondition', 'A Super Admin cannot appoint themselves as Coordinator.')
  await requireNonSuperAdminTarget(String(target.data()?.uid ?? ''))
  await limitCallable(batchId, actorUid, 'bootstrapCoordinator')
  return db.runTransaction(async (transaction) => {
    const operationRef = db.doc(`batches/${batchId}/bootstrapOperations/${actorUid}_${operationId}`)
    const operation = await transaction.get(operationRef)
    if (operation.exists) return operation.data()?.result
    const activeCoordinators = await transaction.get(db.collection(`batches/${batchId}/memberships`).where('status', '==', 'active').where('role', '==', 'coordinator').limit(1))
    if (!activeCoordinators.empty) throw new HttpsError('failed-precondition', 'Coordinator bootstrap is only available when no active Coordinator exists.')
    const approved = await approvePendingMembership(transaction, { batchId, requestId, actorUid, role: 'coordinator', auditAction: 'membership.bootstrapCoordinatorApproved', reason: validatedReason, retentionUntil: retentionUntil() })
    const result = { approved: true, membershipUid: approved.uid }
    transaction.create(operationRef, { actorUid, batchId, operationId, requestId, result, createdAt: FieldValue.serverTimestamp() })
    return result
  })
})

export const listBootstrapCandidates = secureCall(async (request) => {
  const { batchId, pageToken, pageSize } = request.data as { batchId?: unknown; pageToken?: unknown; pageSize?: unknown }
  requireBatchId(batchId); const actorUid = requireUid(request.auth); requireSuperAdmin(request.auth); await limitCallable(batchId, actorUid, 'listBootstrapCandidates')
  if (pageSize !== undefined && (!Number.isInteger(pageSize) || Number(pageSize) < 1 || Number(pageSize) > 50)) throw new HttpsError('invalid-argument', 'pageSize is invalid.')
  let cursor: { createdAt: number; requestId: string } | undefined
  if (pageToken !== undefined) {
    if (typeof pageToken !== 'string' || pageToken.length > 500) throw new HttpsError('invalid-argument', 'pageToken is invalid.')
    try {
      const parsed = JSON.parse(Buffer.from(pageToken, 'base64url').toString('utf8'))
      if (!parsed || typeof parsed.createdAt !== 'number' || !Number.isSafeInteger(parsed.createdAt) || typeof parsed.requestId !== 'string') throw new Error('invalid')
      cursor = parsed
    } catch { throw new HttpsError('invalid-argument', 'pageToken is invalid.') }
  }
  const activeCoordinators = await db.collection(`batches/${batchId}/memberships`).where('status', '==', 'active').where('role', '==', 'coordinator').limit(1).get()
  if (!activeCoordinators.empty) throw new HttpsError('failed-precondition', 'Coordinator bootstrap is only available when no active Coordinator exists.')
  let candidates: FirebaseFirestore.Query = db.collection(`batches/${batchId}/accessRequests`).where('status', '==', 'pending').orderBy('createdAt').orderBy(FieldPath.documentId())
  if (cursor) candidates = candidates.startAfter(Timestamp.fromMillis(cursor.createdAt), cursor.requestId)
  const limit = pageSize === undefined ? 25 : Number(pageSize)
  const page = await candidates.limit(limit + 1).get()
  const visibleCandidates = page.docs.slice(0, limit)
  const last = visibleCandidates.at(-1); const createdAt = last?.data().createdAt
  return {
    candidates: visibleCandidates.map((candidate) => ({ requestId: candidate.id, displayName: candidate.data().displayName, rollNumber: candidate.data().rollNumber, houseId: typeof candidate.data().houseId === 'string' ? candidate.data().houseId : null })),
    nextPageToken: page.size > limit && last && createdAt instanceof Timestamp ? Buffer.from(JSON.stringify({ createdAt: createdAt.toMillis(), requestId: last.id })).toString('base64url') : null,
  }
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
