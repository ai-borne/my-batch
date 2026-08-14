import { FieldValue } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { db, requireActiveMember, requireBatchId, requireCoordinator, requireText, requireUid } from './shared.js'

type NotificationKind = 'announcement' | 'rsvp' | 'payment' | 'moderation'
export async function notify(batchId: string, uid: string, kind: NotificationKind, title: string, body: string) {
  await db.collection(`batches/${batchId}/notifications/${uid}/items`).add({ kind, title, body, createdAt: FieldValue.serverTimestamp() })
}

export const publishAnnouncement = onCall(async (request) => {
  const { batchId, title, body } = request.data as Record<string, unknown>
  requireBatchId(batchId); const actorUid = requireUid(request.auth); await requireCoordinator(batchId, request.auth)
  const headline = requireText(title, 'title', 120); const message = requireText(body, 'body', 1_000)
  const members = await db.collection(`batches/${batchId}/memberships`).where('status', '==', 'active').get()
  await Promise.all(members.docs.map((member) => notify(batchId, member.id, 'announcement', headline, message)))
  await db.collection(`batches/${batchId}/auditEvents`).add({ actorUid, action: 'announcement.published', createdAt: FieldValue.serverTimestamp(), outcome: 'success' })
  return { delivered: members.size }
})

export const markNotificationsRead = onCall(async (request) => {
  const { batchId, notificationIds } = request.data as Record<string, unknown>
  requireBatchId(batchId); const uid = requireUid(request.auth); await requireActiveMember(batchId, uid)
  if (!Array.isArray(notificationIds) || notificationIds.length > 50 || notificationIds.some((id) => typeof id !== 'string' || !id)) throw new HttpsError('invalid-argument', 'notificationIds are invalid.')
  const batch = db.batch()
  notificationIds.forEach((id) => batch.update(db.doc(`batches/${batchId}/notifications/${uid}/items/${id}`), { readAt: FieldValue.serverTimestamp() }))
  await batch.commit()
  return { marked: notificationIds.length }
})
