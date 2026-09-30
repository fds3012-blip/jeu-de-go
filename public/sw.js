/* Service worker fait main.
 * - Installation : met en cache tout ce qu'il faut pour rouvrir l'app hors ligne (liste `BUILD.precache`,
 *   injectée au build par outils/pwa.ts : page, JS initial, écrans, CSS, polices, moteur simple).
 *   Les fichiers /assets/* ont une empreinte dans leur nom : ceux déjà présents dans un ancien cache
 *   sont recopiés au lieu d'être retéléchargés (une mise à jour ne recharge que ce qui a changé).
 * - Activation : les caches des versions précédentes sont effacés.
 * - Navigation : réseau d'abord (toujours la dernière version en ligne), repli sur la page en cache (hors ligne).
 * - Fichiers statiques de même origine : cache d'abord. Ceux hors de la liste (KataGo et TensorFlow.js,
 *   PostHog, Sentry) vont dans un cache d'exécution borné, gardé d'une version à l'autre.
 * - Jamais mis en cache ici : autres origines (Supabase, PostHog, Sentry), requêtes non GET,
 *   et le réseau KataGo (*.bin.gz), géré à part par le moteur.
 */
// Remplacée au build (outils/pwa.ts). En dev, le service worker n'est pas enregistré (src/registerSW.ts).
const BUILD = { version: 'dev', precache: ['/', '/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png'] };
const CACHE = `go-shell-${BUILD.version}`;
const RUNTIME = 'go-runtime-v1';
const RUNTIME_MAX = 40;
const PRECACHE = new Set(BUILD.precache);

/** Fichier à empreinte : identique d'une version à l'autre s'il a le même nom. */
const immuable = (url) => url.startsWith('/assets/');

async function installer() {
  const cache = await caches.open(CACHE);
  await Promise.all(
    BUILD.precache.map(async (url) => {
      const deja = immuable(url) ? await caches.match(url, { ignoreVary: true }) : undefined;
      if (deja) return cache.put(url, deja);
      // `reload` : ne pas reprendre une copie périmée du cache HTTP pour la page et les icônes.
      const res = await fetch(new Request(url, { cache: immuable(url) ? 'default' : 'reload' }));
      if (!res.ok) throw new Error(`${url} : ${res.status}`);
      return cache.put(url, res);
    }),
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(installer().then(() => self.skipWaiting()));
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
  return immuable(url.pathname) || PRECACHE.has(url.pathname) || /\.(png|svg|webp|woff2?)$/.test(url.pathname);
}

/** Cache d'exécution borné : les plus anciennes entrées partent d'abord. */
async function garder(req, res) {
  const cache = await caches.open(RUNTIME);
  await cache.put(req, res);
  const cles = await cache.keys();
  await Promise.all(cles.slice(0, Math.max(0, cles.length - RUNTIME_MAX)).map((k) => cache.delete(k)));
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
        .catch(() => caches.match('/', { cacheName: CACHE }).then((r) => r || caches.match('/')).then((r) => r || Response.error())),
    );
    return;
  }

  if (isStatic(url)) {
    event.respondWith(
      // ignoreVary : la copie mise en cache à l'installation a été demandée sans en-tête Origin, alors que
      // les scripts `crossorigin` l'envoient ; avec `Vary: Origin`, elle ne serait jamais retrouvée hors ligne.
      // Sans risque ici : ces fichiers ne dépendent pas des en-têtes de la requête.
      caches.match(req, { ignoreVary: true }).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              if (PRECACHE.has(url.pathname)) caches.open(CACHE).then((c) => c.put(req, copy));
              else event.waitUntil(garder(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});
