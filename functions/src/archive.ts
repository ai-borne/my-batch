import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { HttpsError, onCall } from 'firebase-functions/v2/https'

const mediaTypes = new Set(['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'video/mp4', 'video/quicktime'])
const reportCategories = new Set(['harassment', 'sexualContent', 'privacy', 'financialInformation', 'fraud', 'spam', 'rights', 'other'])
const db = () => getFirestore()

function requireUid(auth: { uid: string } | undefined) {
  if (!auth) throw new HttpsError('unauthenticated', 'Sign in is required.')
  return auth.uid
}
function requireBatchId(batchId: unknown): asserts batchId is string {
  if (typeof batchId !== 'string' || !batchId) throw new HttpsError('invalid-argument', 'batchId is required.')
}
function text(value: unknown, field: string, max: number, required = true) {
  if (value === undefined && !required) return undefined
  if (typeof value !== 'string' || (required && !value.trim()) || value.trim().length > max) throw new HttpsError('invalid-argument', `${field} is invalid.`)
  return value.trim()
}
async function active(batchId: string, uid: string) {
  if ((await db().doc(`batches/${batchId}/memberships/${uid}`).get()).data()?.status !== 'active') throw new HttpsError('permission-denied', 'An active membership is required.')
}
async function coordinator(batchId: string, uid: string) {
  const member = (await db().doc(`batches/${batchId}/memberships/${uid}`).get()).data()
  if (member?.status !== 'active' || member.role !== 'coordinator') throw new HttpsError('permission-denied', 'Coordinator access is required.')
}
async function audit(batchId: string, actorUid: string, action: string, targetId?: string) {
  await db().collection(`batches/${batchId}/auditEvents`).add({ actorUid, action, ...(targetId ? { targetId } : {}), createdAt: FieldValue.serverTimestamp(), outcome: 'success' })
}
function mediaPath(batchId: string, type: 'posts' | 'albums', id: string, path: unknown) {
  if (typeof path !== 'string' || !path.startsWith(`batches/${batchId}/${type}/${id}/media/`)) throw new HttpsError('invalid-argument', 'The media path is invalid.')
  return path
}

export const createPost = onCall(async (request) => {
  const { batchId, caption, albumId, consentConfirmed } = request.data as Record<string, unknown>
  requireBatchId(batchId); const uid = requireUid(request.auth); await active(batchId, uid)
  if (consentConfirmed !== true) throw new HttpsError('failed-precondition', 'Content consent must be confirmed.')
  const postCaption = text(caption, 'caption', 2_000, false)
  if (albumId !== undefined) {
    if (typeof albumId !== 'string' || !(await db().doc(`batches/${batchId}/albums/${albumId}`).get()).exists) throw new HttpsError('not-found', 'Album was not found.')
  }
  const ref = db().collection(`batches/${batchId}/posts`).doc()
  await ref.create({ batchId, authorUid: uid, ...(postCaption ? { caption: postCaption } : {}), ...(typeof albumId === 'string' ? { albumId } : {}), status: 'visible', media: [], createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
  return { postId: ref.id }
})

export const createAlbum = onCall(async (request) => {
  const { batchId, title, description, consentConfirmed } = request.data as Record<string, unknown>
  requireBatchId(batchId); const uid = requireUid(request.auth); await active(batchId, uid)
  if (consentConfirmed !== true) throw new HttpsError('failed-precondition', 'Content consent must be confirmed.')
  const albumDescription = text(description, 'description', 1_000, false)
  const ref = db().collection(`batches/${batchId}/albums`).doc()
  await ref.create({ batchId, authorUid: uid, title: text(title, 'title', 120), ...(albumDescription ? { description: albumDescription } : {}), status: 'visible', media: [], createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
  return { albumId: ref.id }
})

export const addArchiveMedia = onCall(async (request) => {
  const { batchId, contentType, contentId, storagePath, mimeType, size, durationSeconds } = request.data as Record<string, unknown>
  requireBatchId(batchId); const uid = requireUid(request.auth); await active(batchId, uid)
  if (contentType !== 'post' && contentType !== 'album') throw new HttpsError('invalid-argument', 'contentType is invalid.')
  if (typeof contentId !== 'string' || !mediaTypes.has(String(mimeType)) || !Number.isInteger(size) || Number(size) < 1) throw new HttpsError('invalid-argument', 'Media metadata is invalid.')
  const image = String(mimeType).startsWith('image/'); const limit = image ? 20 * 1024 * 1024 : 250 * 1024 * 1024
  if (Number(size) > limit || (!image && (!Number.isFinite(durationSeconds) || Number(durationSeconds) > 300))) throw new HttpsError('invalid-argument', 'Media exceeds the permitted limit.')
  const collection = contentType === 'post' ? 'posts' : 'albums'; const ref = db().doc(`batches/${batchId}/${collection}/${contentId}`); const content = await ref.get()
  if (!content.exists || content.data()?.authorUid !== uid || content.data()?.status !== 'visible') throw new HttpsError('permission-denied', 'You cannot add media to this content.')
  const path = mediaPath(batchId, collection, contentId, storagePath)
  await ref.update({ media: FieldValue.arrayUnion({ path, mimeType, size, ...(image ? {} : { durationSeconds: Number(durationSeconds) }) }), updatedAt: FieldValue.serverTimestamp() })
  return { added: true }
})

export const saveArchiveComment = onCall(async (request) => {
  const { batchId, postId, body } = request.data as Record<string, unknown>
  requireBatchId(batchId); const uid = requireUid(request.auth); await active(batchId, uid)
  if (typeof postId !== 'string') throw new HttpsError('invalid-argument', 'postId is required.')
  const post = await db().doc(`batches/${batchId}/posts/${postId}`).get()
  if (!post.exists || post.data()?.status !== 'visible') throw new HttpsError('not-found', 'Post was not found.')
  const ref = db().collection(`batches/${batchId}/posts/${postId}/comments`).doc()
  await ref.create({ authorUid: uid, body: text(body, 'body', 1_000), status: 'visible', createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
  return { commentId: ref.id }
})

export const setArchiveLike = onCall(async (request) => {
  const { batchId, postId, liked } = request.data as Record<string, unknown>
  requireBatchId(batchId); const uid = requireUid(request.auth); await active(batchId, uid)
  if (typeof postId !== 'string' || typeof liked !== 'boolean') throw new HttpsError('invalid-argument', 'Like details are invalid.')
  const post = await db().doc(`batches/${batchId}/posts/${postId}`).get()
  if (!post.exists || post.data()?.status !== 'visible') throw new HttpsError('not-found', 'Post was not found.')
  const ref = db().doc(`batches/${batchId}/posts/${postId}/likes/${uid}`)
  if (liked) await ref.set({ uid, createdAt: FieldValue.serverTimestamp() }); else await ref.delete()
  return { liked }
})

export const reportArchiveContent = onCall(async (request) => {
  const { batchId, targetType, targetId, category, explanation } = request.data as Record<string, unknown>
  requireBatchId(batchId); const uid = requireUid(request.auth); await active(batchId, uid)
  if (!['post', 'comment', 'profile', 'user'].includes(String(targetType)) || typeof targetId !== 'string' || !reportCategories.has(String(category))) throw new HttpsError('invalid-argument', 'Report details are invalid.')
  const ref = db().collection(`batches/${batchId}/reports`).doc()
  await ref.create({ reporterUid: uid, targetType, targetId, category, ...(text(explanation, 'explanation', 1_000, false) ? { explanation: text(explanation, 'explanation', 1_000, false) } : {}), status: 'open', createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
  return { reportId: ref.id }
})

export const deleteOwnPost = onCall(async (request) => {
  const { batchId, postId } = request.data as Record<string, unknown>
  requireBatchId(batchId); const uid = requireUid(request.auth); await active(batchId, uid)
  if (typeof postId !== 'string') throw new HttpsError('invalid-argument', 'postId is required.')
  const ref = db().doc(`batches/${batchId}/posts/${postId}`); const post = await ref.get()
  if (!post.exists || post.data()?.authorUid !== uid) throw new HttpsError('permission-denied', 'You can delete only your own post.')
  await ref.update({ status: 'removed', removedBy: uid, removedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
  await getStorage().bucket().deleteFiles({ prefix: `batches/${batchId}/posts/${postId}/media/` })
  await audit(batchId, uid, 'archive.post.deleted', postId)
  return { deleted: true }
})

export const moderateArchiveContent = onCall(async (request) => {
  const { batchId, reportId, action, reason } = request.data as Record<string, unknown>
  requireBatchId(batchId); const uid = requireUid(request.auth); await coordinator(batchId, uid)
  if (typeof reportId !== 'string' || !['dismiss', 'warn', 'hide', 'remove'].includes(String(action))) throw new HttpsError('invalid-argument', 'Moderation details are invalid.')
  const reportRef = db().doc(`batches/${batchId}/reports/${reportId}`); const report = await reportRef.get()
  if (!report.exists) throw new HttpsError('not-found', 'Report was not found.')
  const note = text(reason, 'reason', 1_000, false)
  const targetType = String(report.data()?.targetType); const targetId = String(report.data()?.targetId)
  if (action === 'hide' || action === 'remove') {
    const targetRef = targetType === 'post' ? db().doc(`batches/${batchId}/posts/${targetId}`) : targetType === 'comment' ? db().doc(`batches/${batchId}/posts/${targetId.split('/')[0]}/comments/${targetId.split('/')[1]}`) : undefined
    if (!targetRef) throw new HttpsError('failed-precondition', 'This report target requires manual handling.')
    await targetRef.update({ status: action === 'hide' ? 'hidden' : 'removed', moderatedBy: uid, moderatedAt: FieldValue.serverTimestamp(), moderationReason: note ?? 'Content removed by a Coordinator.' })
    if (action === 'remove' && targetType === 'post') await getStorage().bucket().deleteFiles({ prefix: `batches/${batchId}/posts/${targetId}/media/` })
  }
  await reportRef.update({ status: action === 'dismiss' ? 'dismissed' : 'resolved', resolution: action, resolvedBy: uid, resolvedAt: FieldValue.serverTimestamp(), ...(note ? { resolutionReason: note } : {}), updatedAt: FieldValue.serverTimestamp() })
  await audit(batchId, uid, `moderation.${action}`, targetId)
  return { moderated: true }
})
