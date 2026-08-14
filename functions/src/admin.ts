import { FieldValue } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import { db, requireBatchId, requireDocumentId, requireRecentAuthentication, requireUid } from './shared.js'
import { limitCallable, secureCall } from './security.js'

export const assignCoordinator = secureCall(async (request) => {
  const { batchId, memberUid, action } = request.data as { batchId?: unknown; memberUid?: unknown; action?: unknown }
  requireBatchId(batchId)
  requireDocumentId(memberUid, 'memberUid')
  if (!['assign', 'revoke'].includes(String(action))) throw new HttpsError('invalid-argument', 'A member and assign or revoke action are required.')
  const actorUid = requireUid(request.auth)
  requireRecentAuthentication(request.auth)
  if (request.auth?.token.superAdmin !== true) throw new HttpsError('permission-denied', 'Super Admin access is required.')
  if (actorUid === memberUid) throw new HttpsError('failed-precondition', 'A Super Admin cannot assign themselves as Coordinator.')
  await limitCallable(batchId, actorUid, 'assignCoordinator')
  const memberRef = db.doc(`batches/${batchId}/memberships/${memberUid}`)
  await db.runTransaction(async (transaction) => {
    const member = await transaction.get(memberRef)
    if (!member.exists) throw new HttpsError('not-found', 'Membership was not found.')
    if (action === 'assign') {
      if (member.data()?.status !== 'active') throw new HttpsError('failed-precondition', 'Only active members can become Coordinators.')
      if (member.data()?.role === 'coordinator') return
      transaction.update(memberRef, { role: 'coordinator', coordinatorAssignedBy: actorUid, coordinatorAssignedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
    } else {
      if (member.data()?.role !== 'coordinator') return
      transaction.update(memberRef, { role: 'batchmate', coordinatorRevokedBy: actorUid, coordinatorRevokedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
    }
    transaction.create(db.collection(`batches/${batchId}/auditEvents`).doc(), { actorUid, action: action === 'assign' ? 'coordinator.assigned' : 'coordinator.revoked', targetUid: memberUid, batchId, outcome: 'success', createdAt: FieldValue.serverTimestamp() })
  })
  return { updated: true }
})
