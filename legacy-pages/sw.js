// Replaces the old app's service worker at this address: clears its caches, removes itself and reloads
// the open pages, so they get the forwarding page instead of the old app kept on the device.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const k of await caches.keys()) await caches.delete(k)
      await self.registration.unregister()
      for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(c.url).catch(() => {})
    })(),
  )
})
