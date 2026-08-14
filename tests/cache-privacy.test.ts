import { afterEach, describe, expect, test, vi } from 'vitest'
import { clearPrivateAppCache } from '../src/lib/cachePrivacy'

afterEach(() => {
  delete (navigator as Navigator & { serviceWorker?: ServiceWorkerContainer }).serviceWorker
  delete (window as Window & { caches?: CacheStorage }).caches
})

describe('sign-out cache privacy', () => {
  test('purges page caches and asks every service-worker lifecycle state to purge cached data', async () => {
    const active = { postMessage: vi.fn() }
    const waiting = { postMessage: vi.fn() }
    const deleting = vi.fn()
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { getRegistrations: vi.fn().mockResolvedValue([{ active, waiting, installing: undefined }]) } })
    Object.defineProperty(window, 'caches', { configurable: true, value: { keys: vi.fn().mockResolvedValue(['shell', 'private-response']), delete: deleting } })

    await clearPrivateAppCache()

    expect(active.postMessage).toHaveBeenCalledWith('ajinkyans:purge-caches')
    expect(waiting.postMessage).toHaveBeenCalledWith('ajinkyans:purge-caches')
    expect(deleting).toHaveBeenCalledWith('shell')
    expect(deleting).toHaveBeenCalledWith('private-response')
  })
})
