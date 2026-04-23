// Tombstone service worker.
//
// The pre-tanstack-start site shipped vite-plugin-pwa with defaults, which
// registered a SW at /sw.js with registerType:'autoUpdate'. When that plugin
// was removed, /sw.js stopped being served — but every browser that had it
// registered kept running the old one, serving month-old HTML/JS from its
// precache. This file replaces the stuck SW: on the next update check the
// browser downloads this, sees the bytes differ, installs it, and the handlers
// below clear every cache, unregister, and reload open tabs.
//
// Do not delete until you're confident no real user still has the legacy
// registration — safe to keep around indefinitely, it's a few bytes.

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch {}

      try { await self.clients.claim(); } catch {}
      try { await self.registration.unregister(); } catch {}

      try {
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const c of clients) {
          if ('navigate' in c) c.navigate(c.url);
        }
      } catch {}
    })(),
  );
});

// No fetch handler on purpose — with none, the browser bypasses this SW for
// all network requests, so even before activation completes we're not
// intercepting anything.
