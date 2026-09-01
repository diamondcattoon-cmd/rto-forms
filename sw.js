/* ════════ Minimal service worker — installability only, no caching ════════
   Chrome's PWA installability check (the thing that makes `beforeinstallprompt`
   fire at all — see pwa-install.js) requires a service worker registered at
   a scope covering the manifest's start_url, with a `fetch` handler. This
   is deliberately that and nothing more.

   No caching, no offline support: this site deploys straight to Cloudflare
   Pages on every push, with no build step and no asset versioning/hashing.
   A caching SW here would risk serving an installed user a stale HTML/JS/CSS
   mix after a deploy — a plain network passthrough can't go stale, since it
   never stores anything. If real offline support is ever wanted, that's a
   deliberate follow-up (needs a cache-busting strategy first), not something
   to grow here by accident. */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
