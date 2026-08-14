import { describe, expect, it } from 'vitest'
import { MAX_ARCHIVE_MEDIA_PER_ITEM, archiveMediaLimit, validateArchiveMedia } from '../src/lib/archive'
import { PAGE_SIZE, pageState } from '../src/lib/pagination'
import { sanitizeTelemetry } from '../src/lib/telemetry'

describe('GS-2 bounded scale contracts', () => {
  it('uses a small fixed page size and only exposes a next cursor when a page is full', () => {
    expect(PAGE_SIZE).toBe(25)
    expect(pageState([{ id: 'a' }], 'a')).toEqual({ hasMore: false })
    expect(pageState(Array.from({ length: PAGE_SIZE }, (_, index) => ({ id: String(index) })), 'next')).toEqual({ hasMore: true, cursor: 'next' })
  })

  it('enforces media count, byte, duration, and image-dimension limits before upload', () => {
    expect(archiveMediaLimit('image/jpeg')).toBe(20 * 1024 * 1024)
    expect(MAX_ARCHIVE_MEDIA_PER_ITEM).toBe(20)
    expect(() => validateArchiveMedia({ type: 'image/jpeg', size: 1 }, undefined, { width: 8_001, height: 1 })).toThrow('dimensions')
    expect(() => validateArchiveMedia({ type: 'video/mp4', size: 1 }, 300)).not.toThrow()
  })

  it('keeps telemetry correlation-only and rejects message, UTR, path, or personal fields', () => {
    expect(sanitizeTelemetry({ eventCode: 'upload_failed', correlationId: '12345678', surface: 'archive' })).toEqual({ eventCode: 'upload_failed', correlationId: '12345678', surface: 'archive' })
    expect(() => sanitizeTelemetry({ eventCode: 'upload_failed', correlationId: '12345678', message: 'UTR 123' })).toThrow('Telemetry')
  })
})
