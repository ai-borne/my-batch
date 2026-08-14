import { FieldValue } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { db, limitSensitiveOperation, requireBatchId, requireRecentAuthentication, requireUid } from './shared.js'

export const assignCoordinator = onCall({ enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true' }, async (request) => {
  const { batchId, memberUid, action } = request.data as { batchId?: unknown; memberUid?: unknown; action?: unknown }
  requireBatchId(batchId)
  if (typeof memberUid !== 'string' || !['assign', 'revoke'].includes(String(action))) throw new HttpsError('invalid-argument', 'A member and assign or revoke action are required.')
  const actorUid = requireUid(request.auth)
  requireRecentAuthentication(request.auth)
  if (request.auth?.token.superAdmin !== true) throw new HttpsError('permission-denied', 'Super Admin access is required.')
  if (actorUid === memberUid) throw new HttpsError('failed-precondition', 'A Super Admin cannot assign themselves as Coordinator.')
  await limitSensitiveOperation(actorUid, 'assignCoordinator')
  const memberRef = db.doc(`batches/${batchId}/memberships/${memberUid}`)
  await db.runTransaction(async (transaction) => {
    const member = await transaction.get(memberRef)
    if (!member.exists) throw new HttpsError('not-found', 'Membership was not found.')
    if (action === 'assign') {
      if (member.data()?.status !== 'active') throw new HttpsError('failed-precondition', 'Only active members can become Coordinators.')
      transaction.update(memberRef, { role: 'coordinator', coordinatorAssignedBy: actorUid, coordinatorAssignedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
    } else transaction.update(memberRef, { role: 'batchmate', coordinatorRevokedBy: actorUid, coordinatorRevokedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
    transaction.create(db.collection(`batches/${batchId}/auditEvents`).doc(), { actorUid, action: `coordinator.${action}ed`, targetUid: memberUid, batchId, outcome: 'success', createdAt: FieldValue.serverTimestamp() })
  })
  return { updated: true }
})
