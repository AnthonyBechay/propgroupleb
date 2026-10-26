/*
 * The Inbox app's service worker: notifications for new chats.
 *
 * Registered by the Inbox page with scope /admin/, so it never touches the
 * public website. It caches nothing on purpose — the inbox must always show
 * what is true now, not a stored copy.
 */

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'New message', body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'New message'
  const options = {
    body: data.body || '',
    tag: data.tag || 'chat',
    // A new message on the same conversation should buzz again, not update silently.
    renotify: true,
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    data: { url: data.url || '/admin/inbox' },
  }
  event.waitUntil(
    (async () => {
      // An open Inbox refreshes at once instead of waiting for its next poll.
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const w of windows) w.postMessage({ type: 'inbox-update', url: options.data.url })
      // iOS requires every push to show a notification, or it stops delivering them.
      await self.registration.showNotification(title, options)
    })()
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL((event.notification.data && event.notification.data.url) || '/admin/inbox', self.location.origin).href
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      // Reuse the open app, on the conversation tapped.
      for (const w of windows) {
        if (w.url.includes('/admin/')) {
          await w.focus()
          if ('navigate' in w) return w.navigate(url)
          return
        }
      }
      return self.clients.openWindow(url)
    })()
  )
})
