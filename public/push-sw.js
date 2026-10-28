// Push notifications of the grimoire, loaded into the service worker by workbox (vite.config.ts).
// The server sends { title, body, url }; a tap opens the app at that address or focuses it.
self.addEventListener('push', (event) => {
  let m = {}
  try {
    m = event.data ? event.data.json() : {}
  } catch {
    m = { body: event.data && event.data.text() }
  }
  event.waitUntil(
    self.registration.showNotification(m.title || 'Гримуар дел', {
      body: m.body || '',
      icon: 'icon-grimoire-192.png',
      badge: 'icon-grimoire-192.png',
      data: { url: m.url || '#/g' },
      tag: m.title || 'grimoire',
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(`./?app=grimoire${event.notification.data && event.notification.data.url ? event.notification.data.url : '#/g'}`, self.registration.scope).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) {
          c.navigate(target).catch(() => {})
          return c.focus()
        }
      }
      return self.clients.openWindow(target)
    }),
  )
})
