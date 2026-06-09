/* Service worker BetUs — notifications push uniquement (pas de cache offline). */

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'BetUs ⚽️', {
      body: data.body || '',
      icon: '/BetUs/icons/icon-192.png',
      badge: '/BetUs/icons/icon-192.png',
      data: { url: data.url || '/BetUs/' },
      tag: data.tag || undefined,
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/BetUs/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((tabs) => {
      const existing = tabs.find((t) => t.url.includes('/BetUs/'))
      if (existing) {
        existing.focus()
        return existing.navigate(url)
      }
      return self.clients.openWindow(url)
    }),
  )
})
