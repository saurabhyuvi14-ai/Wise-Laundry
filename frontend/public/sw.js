// Wise Laundry service worker: shows push notifications and opens the order on tap.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = {} }
  const title = data.title || 'Wise Laundry'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icons/pwa-192.png',
      badge: '/icons/pwa-192.png',
      tag: data.tag,
      renotify: Boolean(data.tag),
      data: { url: data.url || '/customer' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/customer'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ('focus' in c) { c.navigate(url); return c.focus() }
      }
      return self.clients.openWindow(url)
    }),
  )
})
