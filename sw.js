// Service worker: shows push alerts and opens the right task when tapped.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Team Work Portal', {
    body: d.body || '', tag: d.id || undefined, renotify: !!d.id,
    icon: 'icon-192.png', badge: 'icon-192.png', data: { task_id: d.task_id || null },
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const taskId = e.notification.data && e.notification.data.task_id;
  const url = new URL('./', self.registration.scope);
  if (taskId) url.hash = 'task-' + taskId;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of wins) {
      if (c.url.startsWith(self.registration.scope)) {
        await c.focus();
        c.postMessage({ type: 'open-task', task_id: taskId });
        return;
      }
    }
    await self.clients.openWindow(url.href);
  })());
});
