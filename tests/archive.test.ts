import { describe, expect, it } from 'vitest'
import { archiveAuthorName, matchesArchiveView, mediaAlternative, validateArchiveMedia } from '../src/lib/archive'

describe('Phase 5 archive contracts', () => {
  it('accepts only bounded supported media and bounded videos', () => {
    expect(() => validateArchiveMedia({ type: 'image/jpeg', size: 20 * 1024 * 1024 })).not.toThrow()
    expect(() => validateArchiveMedia({ type: 'application/pdf', size: 1 })).toThrow('Use JPG')
    expect(() => validateArchiveMedia({ type: 'video/mp4', size: 1 }, 301)).toThrow('five minutes')
  })

  it('keeps photo and video archive filters mutually meaningful', () => {
    const photo = { media: [{ path: 'photo', mimeType: 'image/jpeg' }] }
    const video = { media: [{ path: 'video', mimeType: 'video/mp4' }] }
    expect(matchesArchiveView(photo, 'photos')).toBe(true)
    expect(matchesArchiveView(photo, 'videos')).toBe(false)
    expect(matchesArchiveView(video, 'videos')).toBe(true)
  })

  it('renders privacy-safe display identities and contextual media alternatives', () => {
    expect(archiveAuthorName({ authorDisplayName: 'Asha Rao', authorUid: 'private-id' })).toBe('Asha Rao')
    expect(archiveAuthorName({ authorUid: 'private-id' })).toBe('Batchmate')
    expect(mediaAlternative({ mimeType: 'image/jpeg' }, 'Asha Rao')).toBe('Memory shared by Asha Rao')
    expect(mediaAlternative({ mimeType: 'video/mp4' }, 'Asha Rao')).toBe('Video memory shared by Asha Rao')
  })
})
