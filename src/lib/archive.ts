export const ARCHIVE_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'video/mp4', 'video/quicktime'] as const
export const ARCHIVE_CATEGORIES = ['school', 'sports', 'nda', 'mess', 'teachers', 'trips', 'pranks', 'houses', 'passingOut', 'other'] as const

export type ArchiveView = 'all' | 'photos' | 'videos' | 'albums'
export type ArchiveMedia = { path: string; mimeType: string }
export type ArchivePost = { media?: ArchiveMedia[] }

export function validateArchiveMedia(file: Pick<File, 'type' | 'size'>, duration?: number) {
  if (!ARCHIVE_MEDIA_TYPES.includes(file.type as typeof ARCHIVE_MEDIA_TYPES[number])) throw new Error('Use JPG, PNG, HEIC, WebP, MP4, or MOV media.')
  const limit = file.type.startsWith('image/') ? 20 * 1024 * 1024 : 250 * 1024 * 1024
  if (!Number.isInteger(file.size) || file.size < 1 || file.size > limit) throw new Error('This file exceeds the archive size limit.')
  if (file.type.startsWith('video/') && (!Number.isFinite(duration) || Number(duration) > 300)) throw new Error('Videos must be five minutes or shorter.')
}

export function matchesArchiveView(post: ArchivePost, view: Exclude<ArchiveView, 'albums'>) {
  if (view === 'all') return true
  const prefix = view === 'photos' ? 'image/' : 'video/'
  return post.media?.some((media) => media.mimeType.startsWith(prefix)) ?? false
}
