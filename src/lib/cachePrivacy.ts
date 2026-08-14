const CACHE_PURGE_MESSAGE = 'ajinkyans:purge-caches'

export async function clearPrivateAppCache() {
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations()
      for (const registration of registrations) for (const worker of [registration.active, registration.waiting, registration.installing]) worker?.postMessage(CACHE_PURGE_MESSAGE)
    } catch { /* Sign-out must still revoke Firebase credentials if cache APIs are unavailable. */ }
  }
  if ('caches' in window) try { await Promise.all((await caches.keys()).map((name) => caches.delete(name))) } catch { /* The service worker retry is sufficient when page cache deletion fails. */ }
}
