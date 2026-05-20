/* TaskFlow wrapper — Service Worker for GitHub Pages.
   GAS V8 runtime may also evaluate this file (orphan from a pre-.claspignore push).
   The `typeof self` guard makes the body a no-op there so it doesn't throw. */
(function () {
  if (typeof self === 'undefined' || typeof self.addEventListener !== 'function') return;

  var CACHE = 'taskflow-wrapper-v1';
  var SHELL = ['./', './index.html'];

  self.addEventListener('install', function (e) {
    e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }));
    self.skipWaiting();
  });

  self.addEventListener('activate', function (e) {
    e.waitUntil(caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }));
    self.clients.claim();
  });

  self.addEventListener('fetch', function (e) {
    var url = new URL(e.request.url);
    if (url.origin !== self.location.origin) return; // GAS iframe — passthrough
    e.respondWith(
      caches.match(e.request).then(function (hit) {
        return hit || fetch(e.request).then(function (res) {
          if (e.request.method === 'GET' && res.ok) {
            var clone = res.clone();
            caches.open(CACHE).then(function (c) { c.put(e.request, clone); });
          }
          return res;
        }).catch(function () { return caches.match('./index.html'); });
      })
    );
  });
})();
