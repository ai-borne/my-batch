import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { HttpsError } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import sharp from 'sharp'
import { db, requireActiveMember, requireBatchId, requireCoordinator, requireIdempotencyKey, requireUid } from './shared.js'
import { notify } from './notifications.js'
import { limitCallable, secureCall } from './security.js'

const mediaTypes = new Set(['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'video/mp4', 'video/quicktime'])
const archiveRetentionUntil = new Date('2034-01-08T00:00:00.000Z')
const maxMediaPerItem = 20
const reportCategories = new Set(['harassment', 'sexualContent', 'privacy', 'financialInformation', 'fraud', 'spam', 'rights', 'other'])
const archiveCategories = new Set(['school', 'sports', 'nda', 'mess', 'teachers', 'trips', 'pranks', 'houses', 'passingOut', 'other'])
function text(value: unknown, field: string, max: number, required = true) {
  if (value === undefined && !required) return undefined
  if (typeof value !== 'string' || (required && !value.trim()) || value.trim().length > max) throw new HttpsError('invalid-argument', `${field} is invalid.`)
  return value.trim()
}
async function audit(batchId: string, actorUid: string, action: string, targetId?: string) {
  await db.collection(`batches/${batchId}/auditEvents`).add({ actorUid, action, ...(targetId ? { targetId } : {}), createdAt: FieldValue.serverTimestamp(), outcome: 'success' })
}
async function authorIdentity(batchId: string, uid: string) {
  const profile = await db.doc(`batches/${batchId}/profiles/${uid}`).get()
  const displayName = profile.data()?.displayName
  return typeof displayName === 'string' && displayName.trim() ? { authorDisplayName: displayName.trim() } : {}
}
function mediaPath(batchId: string, type: 'posts' | 'albums', id: string, path: unknown) {
  if (typeof path !== 'string' || !path.startsWith(`batches/${batchId}/${type}/${id}/media/`)) throw new HttpsError('invalid-argument', 'The media path is invalid.')
  return path
}
function derivativePaths(path: string) { return { thumbnailPath: `${path}.thumb.webp`, posterPath: `${path}.poster.webp` } }
async function createImageThumbnail(path: string, thumbnailPath: string) {
  const bucket = getStorage().bucket(); const [source] = await bucket.file(path).download()
  const sourceMetadata = await sharp(source, { limitInputPixels: 40_000_000 }).metadata()
  if (!sourceMetadata.width || !sourceMetadata.height || sourceMetadata.width > 8_000 || sourceMetadata.height > 8_000) throw new HttpsError('invalid-argument', 'Image dimensions exceed the permitted limit.')
  const thumbnail = await sharp(source, { limitInputPixels: 40_000_000 }).rotate().resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).toBuffer()
  await bucket.file(thumbnailPath).save(thumbnail, { contentType: 'image/webp', resumable: false, metadata: { cacheControl: 'private, max-age=3600' } })
}
async function createVideoPoster(path: string, posterPath: string) {
  const label = path.split('/').at(-1)?.replace(/[<>&]/g, '') ?? 'Video'
  const svg = `<svg width="640" height="360" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%"/><circle cx="320" cy="180" r="52"/><path d="M300 145v70l58-35z"/><text x="320" y="300" text-anchor="middle" font-family="sans-serif" font-size="20">${label}</text></svg>`
  const poster = await sharp(Buffer.from(svg)).webp({ quality: 78 }).toBuffer()
  await getStorage().bucket().file(posterPath).save(poster, { contentType: 'image/webp', resumable: false, metadata: { cacheControl: 'private, max-age=3600' } })
}
async function verifyMediaBytes(path: string, mimeType: string) {
  const [bytes] = await getStorage().bucket().file(path).download({ start: 0, end: 31 })
  const textBytes = bytes.toString('ascii')
  const jpeg = bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])); const png = bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])); const riff = textBytes.startsWith('RIFF'); const ftyp = textBytes.includes('ftyp')
  const valid = mimeType === 'image/jpeg' ? jpeg : mimeType === 'image/png' ? png : mimeType === 'image/webp' ? riff && textBytes.includes('WEBP') : mimeType === 'image/heic' || mimeType.startsWith('video/') ? ftyp : false
  if (!valid) throw new HttpsError('failed-precondition', 'Uploaded bytes do not match the declared media type.')
}
function tags(value: unknown) {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.length > 20 || value.some((tag) => typeof tag !== 'string' || !tag.trim() || tag.trim().length > 100)) throw new HttpsError('invalid-argument', 'People tags are invalid.')
  return [...new Set(value.map((tag) => tag.trim()))]
}
function year(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined
  if (!Number.isInteger(value) || Number(value) < 1900 || Number(value) > new Date().getFullYear()) throw new HttpsError('invalid-argument', 'Year is invalid.')
  return Number(value)
}
function category(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string' || !archiveCategories.has(value)) throw new HttpsError('invalid-argument', 'Category is invalid.')
  return value
}
function metadata(data: Record<string, unknown>) {
  const peopleTags = tags(data.peopleTags); const memoryYear = year(data.year); const memoryCategory = category(data.category)
  return { ...(peopleTags ? { peopleTags } : {}), ...(memoryYear ? { year: memoryYear } : {}), ...(memoryCategory ? { category: memoryCategory } : {}) }
}

export const createPost = secureCall(async (request) => {
  const { batchId, caption, albumId, consentConfirmed, requestId } = request.data as Record<string, unknown>
  requireBatchId(batchId); const uid = requireUid(request.auth); await requireActiveMember(batchId, uid)
  await limitCallable(batchId, uid, 'createPost')
  if (consentConfirmed !== true) throw new HttpsError('failed-precondition', 'Content consent must be confirmed.')
  const postCaption = text(caption, 'caption', 2_000, false)
  const identity = await authorIdentity(batchId, uid)
  const selectedAlbumId = albumId === undefined || albumId === null || albumId === '' ? undefined : albumId
  if (selectedAlbumId !== undefined) {
    if (typeof selectedAlbumId !== 'string' || !(await db.doc(`batches/${batchId}/albums/${selectedAlbumId}`).get()).exists) throw new HttpsError('not-found', 'Album was not found.')
  }
  const ref = db.collection(`batches/${batchId}/posts`).doc(requireIdempotencyKey(requestId))
  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(ref)
    if (existing.exists) {
      if (existing.data()?.authorUid !== uid) throw new HttpsError('already-exists', 'A request with this key already exists.')
      return
    }
    transaction.create(ref, { batchId, authorUid: uid, ...identity, ...(postCaption ? { caption: postCaption } : {}), ...(typeof selectedAlbumId === 'string' ? { albumId: selectedAlbumId } : {}), ...metadata(request.data as Record<string, unknown>), status: 'visible', media: [], retentionUntil: archiveRetentionUntil, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
  })
  return { postId: ref.id }
})

export const createAlbum = secureCall(async (request) => {
  const { batchId, title, description, consentConfirmed, requestId } = request.data as Record<string, unknown>
  requireBatchId(batchId); const uid = requireUid(request.auth); await requireActiveMember(batchId, uid)
  await limitCallable(batchId, uid, 'createAlbum')
  if (consentConfirmed !== true) throw new HttpsError('failed-precondition', 'Content consent must be confirmed.')
  const albumDescription = text(description, 'description', 1_000, false)
  const identity = await authorIdentity(batchId, uid)
  const ref = db.collection(`batches/${batchId}/albums`).doc(requireIdempotencyKey(requestId))
  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(ref)
    if (existing.exists) {
      if (existing.data()?.authorUid !== uid) throw new HttpsError('already-exists', 'A request with this key already exists.')
      return
    }
    transaction.create(ref, { batchId, authorUid: uid, ...identity, title: text(title, 'title', 120), ...(albumDescription ? { description: albumDescription } : {}), status: 'visible', media: [], retentionUntil: archiveRetentionUntil, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
  })
  return { albumId: ref.id }
})

export const addArchiveMedia = secureCall(async (request) => {
  const { batchId, contentType, contentId, storagePath, mimeType, size, durationSeconds } = request.data as Record<string, unknown>
  requireBatchId(batchId); const uid = requireUid(request.auth); await requireActiveMember(batchId, uid)
  await limitCallable(batchId, uid, 'addArchiveMedia')
  if (contentType !== 'post' && contentType !== 'album') throw new HttpsError('invalid-argument', 'contentType is invalid.')
  if (typeof contentId !== 'string' || !mediaTypes.has(String(mimeType)) || !Number.isInteger(size) || Number(size) < 1) throw new HttpsError('invalid-argument', 'Media metadata is invalid.')
  const image = String(mimeType).startsWith('image/'); const limit = image ? 20 * 1024 * 1024 : 250 * 1024 * 1024
  if (Number(size) > limit || (!image && (!Number.isFinite(durationSeconds) || Number(durationSeconds) > 300))) throw new HttpsError('invalid-argument', 'Media exceeds the permitted limit.')
  const collection = contentType === 'post' ? 'posts' : 'albums'; const ref = db.doc(`batches/${batchId}/${collection}/${contentId}`); const content = await ref.get()
  if (!content.exists || content.data()?.authorUid !== uid || content.data()?.status !== 'visible') throw new HttpsError('permission-denied', 'You cannot add media to this content.')
  const path = mediaPath(batchId, collection, contentId, storagePath)
  if ((content.data()?.media ?? []).some((media: { path?: string }) => media.path === path)) return { added: true, duplicate: true }
  const [objectMetadata] = await getStorage().bucket().file(path).getMetadata().catch(() => { throw new HttpsError('failed-precondition', 'Upload was not found.') })
  if (objectMetadata.contentType !== mimeType || Number(objectMetadata.size) !== Number(size)) throw new HttpsError('failed-precondition', 'Uploaded media does not match the submitted metadata.')
  await verifyMediaBytes(path, String(mimeType))
  const derivatives = derivativePaths(path)
  if (image) await createImageThumbnail(path, derivatives.thumbnailPath); else await createVideoPoster(path, derivatives.posterPath)
  const media = { path, mimeType, size, uploadState: 'verified', ...(image ? { thumbnailPath: derivatives.thumbnailPath } : { durationSeconds: Number(durationSeconds), posterPath: derivatives.posterPath, previewPath: path }) }
  try { await db.runTransaction(async (transaction) => {
    const latest = await transaction.get(ref); const existingMedia = latest.data()?.media ?? []
    if (existingMedia.some((existing: { path?: string }) => existing.path === path)) return
    if (!latest.exists || latest.data()?.authorUid !== uid || latest.data()?.status !== 'visible') throw new HttpsError('permission-denied', 'You cannot add media to this content.')
    if (existingMedia.length >= maxMediaPerItem) throw new HttpsError('failed-precondition', 'This post or album already has the maximum number of media items.')
    transaction.update(ref, { media: FieldValue.arrayUnion(media), updatedAt: FieldValue.serverTimestamp() })
  }) } catch (error) { await getStorage().bucket().deleteFiles({ prefix: path }); throw error }
  await audit(batchId, uid, 'archive.media.verified', contentId)
  return { added: true }
})

export const updateOwnPost = secureCall(async (request) => {
  const { batchId, postId, caption, albumId } = request.data as Record<string, unknown>
  requireBatchId(batchId); const uid = requireUid(request.auth); await requireActiveMember(batchId, uid)
  await limitCallable(batchId, uid, 'updateOwnPost')
  if (typeof postId !== 'string') throw new HttpsError('invalid-argument', 'postId is required.')
  const ref = db.doc(`batches/${batchId}/posts/${postId}`); const post = await ref.get()
  if (!post.exists || post.data()?.authorUid !== uid || post.data()?.status !== 'visible') throw new HttpsError('permission-denied', 'You can edit only your visible posts.')
  const nextCaption = text(caption, 'caption', 2_000, false)
  const selectedAlbumId = albumId === undefined || albumId === null || albumId === '' ? undefined : albumId
  if (selectedAlbumId !== undefined && (typeof selectedAlbumId !== 'string' || !(await db.doc(`batches/${batchId}/albums/${selectedAlbumId}`).get()).exists)) throw new HttpsError('not-found', 'Album was not found.')
  await ref.update({ ...(nextCaption ? { caption: nextCaption } : { caption: FieldValue.delete() }), ...(typeof selectedAlbumId === 'string' ? { albumId: selectedAlbumId } : { albumId: FieldValue.delete() }), ...metadata(request.data as Record<string, unknown>), updatedAt: FieldValue.serverTimestamp() })
  await audit(batchId, uid, 'archive.post.updated', postId)
  return { updated: true }
})

export const manageAlbum = secureCall(async (request) => {
  const { batchId, albumId, action, title, description } = request.data as Record<string, unknown>
  requireBatchId(batchId); const uid = requireUid(request.auth); await requireActiveMember(batchId, uid)
  await limitCallable(batchId, uid, 'manageAlbum')
  if (typeof albumId !== 'string' || !['update', 'remove'].includes(String(action))) throw new HttpsError('invalid-argument', 'Album details are invalid.')
  const ref = db.doc(`batches/${batchId}/albums/${albumId}`); const album = await ref.get(); const membership = await db.doc(`batches/${batchId}/memberships/${uid}`).get()
  if (!album.exists || (album.data()?.authorUid !== uid && membership.data()?.role !== 'coordinator')) throw new HttpsError('permission-denied', 'Only the album owner or a Coordinator can manage this album.')
  if (action === 'remove') { await ref.update({ status: 'removed', removedBy: uid, removedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }); await getStorage().bucket().deleteFiles({ prefix: `batches/${batchId}/albums/${albumId}/media/` }) }
  else await ref.update({ title: text(title, 'title', 120), ...(text(description, 'description', 1_000, false) ? { description: text(description, 'description', 1_000, false) } : { description: FieldValue.delete() }), updatedAt: FieldValue.serverTimestamp() })
  await audit(batchId, uid, `archive.album.${action}`, albumId)
  return { managed: true }
})

export const saveArchiveComment = secureCall(async (request) => {
  const { batchId, postId, body, requestId } = request.data as Record<string, unknown>
  requireBatchId(batchId); const uid = requireUid(request.auth); await requireActiveMember(batchId, uid)
  await limitCallable(batchId, uid, 'saveArchiveComment')
  if (typeof postId !== 'string') throw new HttpsError('invalid-argument', 'postId is required.')
  const post = await db.doc(`batches/${batchId}/posts/${postId}`).get()
  if (!post.exists || post.data()?.status !== 'visible') throw new HttpsError('not-found', 'Post was not found.')
  const ref = db.collection(`batches/${batchId}/posts/${postId}/comments`).doc(requireIdempotencyKey(requestId))
  const identity = await authorIdentity(batchId, uid)
  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(ref)
    if (existing.exists) {
      if (existing.data()?.authorUid !== uid) throw new HttpsError('already-exists', 'A request with this key already exists.')
      return
    }
    transaction.create(ref, { authorUid: uid, ...identity, body: text(body, 'body', 1_000), status: 'visible', createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
  })
  return { commentId: ref.id }
})

export const setArchiveLike = secureCall(async (request) => {
  const { batchId, postId, liked } = request.data as Record<string, unknown>
  requireBatchId(batchId); const uid = requireUid(request.auth); await requireActiveMember(batchId, uid)
  await limitCallable(batchId, uid, 'setArchiveLike')
  if (typeof postId !== 'string' || typeof liked !== 'boolean') throw new HttpsError('invalid-argument', 'Like details are invalid.')
  const post = await db.doc(`batches/${batchId}/posts/${postId}`).get()
  if (!post.exists || post.data()?.status !== 'visible') throw new HttpsError('not-found', 'Post was not found.')
  const ref = db.doc(`batches/${batchId}/posts/${postId}/likes/${uid}`)
  if (liked) await ref.set({ uid, createdAt: FieldValue.serverTimestamp() }); else await ref.delete()
  return { liked }
})

export const reportArchiveContent = secureCall(async (request) => {
  const { batchId, targetType, targetId, category, explanation, requestId } = request.data as Record<string, unknown>
  requireBatchId(batchId); const uid = requireUid(request.auth); await requireActiveMember(batchId, uid)
  await limitCallable(batchId, uid, 'reportArchiveContent')
  if (!['post', 'comment', 'profile', 'user'].includes(String(targetType)) || typeof targetId !== 'string' || !reportCategories.has(String(category))) throw new HttpsError('invalid-argument', 'Report details are invalid.')
  const ref = db.collection(`batches/${batchId}/reports`).doc(requireIdempotencyKey(requestId))
  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(ref)
    if (existing.exists) {
      if (existing.data()?.reporterUid !== uid) throw new HttpsError('already-exists', 'A request with this key already exists.')
      return
    }
    transaction.create(ref, { reporterUid: uid, targetType, targetId, category, ...(text(explanation, 'explanation', 1_000, false) ? { explanation: text(explanation, 'explanation', 1_000, false) } : {}), status: 'open', createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
  })
  return { reportId: ref.id }
})
export const deleteOwnPost = secureCall(async (request) => {
  const { batchId, postId } = request.data as Record<string, unknown>
  requireBatchId(batchId); const uid = requireUid(request.auth); await requireActiveMember(batchId, uid)
  await limitCallable(batchId, uid, 'deleteOwnPost')
  if (typeof postId !== 'string') throw new HttpsError('invalid-argument', 'postId is required.')
  const ref = db.doc(`batches/${batchId}/posts/${postId}`); const post = await ref.get()
  if (!post.exists || post.data()?.authorUid !== uid) throw new HttpsError('permission-denied', 'You can delete only your own post.')
  await ref.update({ status: 'removed', removedBy: uid, removedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
  await getStorage().bucket().deleteFiles({ prefix: `batches/${batchId}/posts/${postId}/media/` })
  await audit(batchId, uid, 'archive.post.deleted', postId)
  return { deleted: true }
})
export const deleteOwnComment = secureCall(async (request) => {
  const { batchId, postId, commentId } = request.data as Record<string, unknown>
  requireBatchId(batchId); const uid = requireUid(request.auth); await requireActiveMember(batchId, uid)
  await limitCallable(batchId, uid, 'deleteOwnComment')
  if (typeof postId !== 'string' || typeof commentId !== 'string') throw new HttpsError('invalid-argument', 'Comment details are invalid.')
  const ref = db.doc(`batches/${batchId}/posts/${postId}/comments/${commentId}`); const comment = await ref.get()
  if (!comment.exists || comment.data()?.authorUid !== uid) throw new HttpsError('permission-denied', 'You can delete only your own comment.')
  await ref.update({ status: 'removed', removedBy: uid, removedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
  await audit(batchId, uid, 'archive.comment.deleted', commentId)
  return { deleted: true }
})
export const cleanupArchiveOrphans = secureCall(async (request) => {
  const { batchId } = request.data as Record<string, unknown>
  requireBatchId(batchId); const uid = requireUid(request.auth); await requireCoordinator(batchId, request.auth)
  await limitCallable(batchId, uid, 'cleanupArchiveOrphans')
  const [files] = await getStorage().bucket().getFiles({ prefix: `batches/${batchId}/`, maxResults: 100 })
  const contentCache = new Map<string, Array<{ path?: string }>>()
  const now = Date.now(); let deleted = 0
  for (const file of files) {
    const match = file.name.match(new RegExp(`^batches/${batchId}/(posts|albums)/([^/]+)/media/`))
    if (!match) continue
    const contentPath = `batches/${batchId}/${match[1]}/${match[2]}`
    let media = contentCache.get(contentPath)
    if (!media) { const content = await db.doc(contentPath).get(); media = (content.data()?.status === 'visible' ? content.data()?.media ?? [] : []) as Array<{ path?: string }>; contentCache.set(contentPath, media) }
    if (media.some((item) => typeof item.path === 'string' && (file.name === item.path || file.name.startsWith(`${item.path}.`)))) continue
    const [metadata] = await file.getMetadata(); const created = Date.parse(String(metadata.timeCreated ?? ''))
    if (Number.isFinite(created) && now - created >= 24 * 60 * 60 * 1000) { await file.delete(); deleted += 1 }
  }
  await audit(batchId, uid, 'archive.orphans.cleaned')
  return { deleted }
})
async function expireArchiveCollection(collectionName: 'posts' | 'albums') {
  const expired = await db.collectionGroup(collectionName).where('retentionUntil', '<=', Timestamp.now()).limit(25).get()
  await Promise.all(expired.docs.map(async (item) => {
    await getStorage().bucket().deleteFiles({ prefix: `${item.ref.path}/media/` })
    await item.ref.update({ status: 'removed', removedAt: FieldValue.serverTimestamp(), removalReason: 'retention-expired', updatedAt: FieldValue.serverTimestamp() })
  }))
  return expired.size
}
export const executeArchiveRetention = onSchedule('every day 03:00', async () => {
  const [posts, albums] = await Promise.all([expireArchiveCollection('posts'), expireArchiveCollection('albums')])
  console.info('Archive retention complete', { posts, albums })
})
export const moderateArchiveContent = secureCall(async (request) => {
  const { batchId, reportId, action, reason } = request.data as Record<string, unknown>
  requireBatchId(batchId); const uid = requireUid(request.auth); await requireCoordinator(batchId, request.auth)
  await limitCallable(batchId, uid, 'moderateArchiveContent')
  if (typeof reportId !== 'string' || !['dismiss', 'warn', 'hide', 'remove'].includes(String(action))) throw new HttpsError('invalid-argument', 'Moderation details are invalid.')
  const reportRef = db.doc(`batches/${batchId}/reports/${reportId}`); const report = await reportRef.get()
  if (!report.exists) throw new HttpsError('not-found', 'Report was not found.')
  if (report.data()?.status !== 'open') {
    if (report.data()?.resolution === action) return { moderated: true, duplicate: true }
    throw new HttpsError('failed-precondition', 'This report has already been resolved.')
  }
  const note = text(reason, 'reason', 1_000, false)
  const targetType = String(report.data()?.targetType); const targetId = String(report.data()?.targetId)
  const targetRef = targetType === 'post' ? db.doc(`batches/${batchId}/posts/${targetId}`) : targetType === 'comment' ? db.doc(`batches/${batchId}/posts/${targetId.split('/')[0]}/comments/${targetId.split('/')[1]}`) : undefined
  if (action === 'hide' || action === 'remove') {
    if (!targetRef) throw new HttpsError('failed-precondition', 'This report target requires manual handling.')
    await targetRef.update({ status: action === 'hide' ? 'hidden' : 'removed', moderatedBy: uid, moderatedAt: FieldValue.serverTimestamp(), moderationReason: note ?? 'Content removed by a Coordinator.' })
    if (action === 'remove' && targetType === 'post') await getStorage().bucket().deleteFiles({ prefix: `batches/${batchId}/posts/${targetId}/media/` })
  }
  await reportRef.update({ status: action === 'dismiss' ? 'dismissed' : 'resolved', resolution: action, resolvedBy: uid, resolvedAt: FieldValue.serverTimestamp(), ...(note ? { resolutionReason: note } : {}), updatedAt: FieldValue.serverTimestamp() })
  const target = targetRef && await targetRef.get()
  const authorUid = target?.data()?.authorUid
  if (typeof authorUid === 'string') await notify(batchId, authorUid, 'moderation', 'Moderation outcome', action === 'dismiss' ? 'A report about your content was dismissed.' : `A Coordinator reviewed your content: ${action}. To appeal a removal, use the WhatsApp support route in Account.`)
  await audit(batchId, uid, `moderation.${action}`, targetId)
  return { moderated: true }
})
