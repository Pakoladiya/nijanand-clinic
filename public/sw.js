// Nijanand Clinic — Push Notification Service Worker

self.addEventListener('push', event => {
  const data = event.data?.json() ?? {}
  const title = data.title || '🏥 Queue Update'
  const body  = data.body  || 'A patient was added to the queue'

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:      '/logo.png',
      badge:     '/logo.png',
      tag:       'queue-update',   // replaces previous unread notification
      renotify:  true,             // still vibrate even if same tag
      vibrate:   [200, 100, 200],
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // Focus existing tab if open
      for (const client of list) {
        if ('focus' in client) return client.focus()
      }
      // Otherwise open a new tab
      if (clients.openWindow) return clients.openWindow('/')
    })
  )
})
