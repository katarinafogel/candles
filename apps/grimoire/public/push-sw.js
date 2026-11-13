// Push notifications of the grimoire, loaded into its service worker by workbox (vite.config.ts).
// The server sends { title, body, url }: url is a page of the grimoire ('/', '/rituals'); the old
// '#/g/…' form (sent before the move to /grimoire/) is understood too. A tap opens it or focuses the app.
const page = (u) => {
  let p = u || '/'
  if (p.startsWith('#/g')) p = p.slice(3) || '/'
  if (!p.startsWith('/')) p = `/${p}`
  return new URL(`.${p}`, self.registration.scope).href
}

self.addEventListener('push', (event) => {
  let m = {}
  try {
    m = event.data ? event.data.json() : {}
  } catch {
    m = { body: event.data && event.data.text() }
  }
  event.waitUntil(
    self.registration.showNotification(m.title || 'Гримуар', {
      body: m.body || '',
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      data: { url: m.url || '/' },
      tag: m.title || 'grimoire',
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = page(event.notification.data && event.notification.data.url)
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
