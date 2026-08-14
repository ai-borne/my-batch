const CACHE_PURGE_MESSAGE = 'ajinkyans:purge-caches'

export async function clearPrivateAppCache() {
  if (!('serviceWorker' in navigator)) return
  const registration = await navigator.serviceWorker.getRegistration()
  registration?.active?.postMessage(CACHE_PURGE_MESSAGE)
}
