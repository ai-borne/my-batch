export const ARCHIVE_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'video/mp4', 'video/quicktime'] as const
export const ARCHIVE_CATEGORIES = ['school', 'sports', 'nda', 'mess', 'teachers', 'trips', 'pranks', 'houses', 'passingOut', 'other'] as const
export const MAX_ARCHIVE_MEDIA_PER_ITEM = 20
export const MAX_IMAGE_DIMENSION = 8_000

export type ArchiveView = 'all' | 'photos' | 'videos' | 'albums'
export type ArchiveMedia = { path: string; mimeType: string }
export type ArchivePost = { media?: ArchiveMedia[] }
export type ArchiveAuthor = { authorUid?: string; authorDisplayName?: string }

export function archiveMediaLimit(type: string) { return type.startsWith('image/') ? 20 * 1024 * 1024 : 250 * 1024 * 1024 }

export function validateArchiveMedia(file: Pick<File, 'type' | 'size'>, duration?: number, dimensions?: { width: number; height: number }) {
  if (!ARCHIVE_MEDIA_TYPES.includes(file.type as typeof ARCHIVE_MEDIA_TYPES[number])) throw new Error('Use JPG, PNG, HEIC, WebP, MP4, or MOV media.')
  const limit = archiveMediaLimit(file.type)
  if (!Number.isInteger(file.size) || file.size < 1 || file.size > limit) throw new Error('This file exceeds the archive size limit.')
  if (file.type.startsWith('image/') && dimensions && (!Number.isFinite(dimensions.width) || !Number.isFinite(dimensions.height) || dimensions.width > MAX_IMAGE_DIMENSION || dimensions.height > MAX_IMAGE_DIMENSION)) throw new Error('Image dimensions exceed the archive limit.')
  if (file.type.startsWith('video/') && (!Number.isFinite(duration) || Number(duration) > 300)) throw new Error('Videos must be five minutes or shorter.')
}

export async function compressArchiveImage(file: File) {
  if (!file.type.startsWith('image/') || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return file
  try { const source = await createImageBitmap(file); const scale = Math.min(1, 2_000 / Math.max(source.width, source.height)); const canvas = document.createElement('canvas'); canvas.width = Math.round(source.width * scale); canvas.height = Math.round(source.height * scale); canvas.getContext('2d')?.drawImage(source, 0, 0, canvas.width, canvas.height); source.close(); const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82)); return blob ? new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'memory'}.webp`, { type: 'image/webp' }) : file } catch { return file }
}

export function matchesArchiveView(post: ArchivePost, view: Exclude<ArchiveView, 'albums'>) {
  if (view === 'all') return true
  const prefix = view === 'photos' ? 'image/' : 'video/'
  return post.media?.some((media) => media.mimeType.startsWith(prefix)) ?? false
}

export function archiveAuthorName(author: ArchiveAuthor) {
  return author.authorDisplayName?.trim() || 'Batchmate'
}

export function mediaAlternative(media: Pick<ArchiveMedia, 'mimeType'>, authorName: string) {
  return `${media.mimeType.startsWith('video/') ? 'Video memory' : 'Memory'} shared by ${authorName}`
}
