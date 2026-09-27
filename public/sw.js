/* Service worker fait main.
 * - App shell mis en cache à l'installation.
 * - Navigation : réseau d'abord, repli sur le shell en cache (hors ligne).
 * - Fichiers statiques de même origine (/assets/* hachés, icônes) : cache d'abord.
 * - Jamais mis en cache ici : autres origines (Supabase, polices, PostHog, Sentry),
 *   requêtes non GET, et le réseau KataGo (*.bin.gz), géré à part par le moteur.
 * Changer VERSION invalide les anciens caches.
 */
const VERSION = 'v1';
const CACHE = `go-shell-${VERSION}`;
const SHELL = ['/', '/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith('go-shell-') && k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

function isStatic(url) {
  return (
    url.pathname.startsWith('/assets/') || SHELL.includes(url.pathname) || /\.(png|svg|webp|woff2?)$/.test(url.pathname)
  );
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('.bin.gz') || req.headers.has('range')) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put('/', copy));
          }
          return res;
        })
        .catch(() => caches.match('/').then((r) => r || Response.error())),
    );
    return;
  }

  if (isStatic(url)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});
