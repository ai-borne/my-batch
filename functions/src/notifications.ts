import { FieldValue } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import { db, requireActiveMember, requireBatchId, requireCoordinator, requireIdempotencyKey, requireText, requireUid } from './shared.js'
import { limitCallable, secureCall } from './security.js'

type NotificationKind = 'announcement' | 'rsvp' | 'payment' | 'moderation'
export async function notify(batchId: string, uid: string, kind: NotificationKind, title: string, body: string, notificationId?: string) {
  const collection = db.collection(`batches/${batchId}/notifications/${uid}/items`)
  const ref = notificationId ? collection.doc(notificationId) : collection.doc()
  await ref.set({ kind, title, body, createdAt: FieldValue.serverTimestamp() }, { merge: true })
}

export const publishAnnouncement = secureCall(async (request) => {
  const { batchId, title, body, requestId } = request.data as Record<string, unknown>
  requireBatchId(batchId); const actorUid = requireUid(request.auth); await requireCoordinator(batchId, request.auth)
  await limitCallable(batchId, actorUid, 'publishAnnouncement')
  const headline = requireText(title, 'title', 120); const message = requireText(body, 'body', 1_000)
  const announcementId = requireIdempotencyKey(requestId)
  const announcementRef = db.doc(`batches/${batchId}/announcements/${announcementId}`)
  const created = await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(announcementRef)
    if (existing.exists) {
      if (existing.data()?.actorUid !== actorUid) throw new HttpsError('already-exists', 'A request with this key already exists.')
      return false
    }
    transaction.create(announcementRef, { actorUid, title: headline, createdAt: FieldValue.serverTimestamp() })
    transaction.create(db.collection(`batches/${batchId}/auditEvents`).doc(), { actorUid, action: 'announcement.published', createdAt: FieldValue.serverTimestamp(), outcome: 'success' })
    return true
  })
  const members = await db.collection(`batches/${batchId}/memberships`).where('status', '==', 'active').get()
  await Promise.all(members.docs.map((member) => notify(batchId, member.id, 'announcement', headline, message, `announcement-${announcementId}`)))
  return { delivered: members.size, duplicate: !created }
})

export const markNotificationsRead = secureCall(async (request) => {
  const { batchId, notificationIds } = request.data as Record<string, unknown>
  requireBatchId(batchId); const uid = requireUid(request.auth); await requireActiveMember(batchId, uid)
  await limitCallable(batchId, uid, 'markNotificationsRead')
  if (!Array.isArray(notificationIds) || notificationIds.length > 50 || notificationIds.some((id) => typeof id !== 'string' || !id)) throw new HttpsError('invalid-argument', 'notificationIds are invalid.')
  const batch = db.batch()
  notificationIds.forEach((id) => batch.update(db.doc(`batches/${batchId}/notifications/${uid}/items/${id}`), { readAt: FieldValue.serverTimestamp() }))
  await batch.commit()
  return { marked: notificationIds.length }
})
