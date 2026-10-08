/* Service worker fait main.
 * - Installation : met en cache tout ce qu'il faut pour rouvrir l'app hors ligne (liste `BUILD.precache`,
 *   injectée au build par outils/pwa.ts : page, JS initial, écrans, CSS, polices, moteur simple).
 *   Les fichiers /assets/* ont une empreinte dans leur nom : ceux déjà présents dans un ancien cache
 *   sont recopiés au lieu d'être retéléchargés (une mise à jour ne recharge que ce qui a changé).
 * - Activation : les caches des versions précédentes sont effacés.
 * - Navigation : réseau d'abord (toujours la dernière version en ligne), repli sur la page en cache (hors ligne).
 * - Fichiers statiques de même origine : cache d'abord. Ceux hors de la liste (KataGo et TensorFlow.js,
 *   PostHog, Sentry) vont dans un cache d'exécution borné, gardé d'une version à l'autre.
 *   #475 : ce cache est tenu du plus ancien usage au plus récent (une entrée relue repasse en tête) : le code
 *   de TensorFlow.js, qui sert à chaque démarrage de KataGo, n'en sort plus au fil des déploiements.
 * - Jamais mis en cache ici : autres origines (Supabase, PostHog, Sentry), requêtes non GET,
 *   et le réseau KataGo (*.bin.gz, servi depuis /reseaux/), géré à part par le moteur dans le cache
 *   `katago-reseaux-v1` (src/engine/katago/loader.ts), qu'aucune activation n'efface.
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

/** Cache d'exécution borné : les entrées les moins récemment utilisées partent d'abord. */
async function garder(req, res, dejaLa = false) {
  const cache = await caches.open(RUNTIME);
  // Relue : retirée puis remise, elle passe en fin de liste (les clés suivent l'ordre d'insertion).
  if (dejaLa) await cache.delete(req, { ignoreVary: true });
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
      caches.match(req, { ignoreVary: true }).then((hit) => {
        if (hit && !PRECACHE.has(url.pathname)) event.waitUntil(garder(req, hit.clone(), true).catch(() => {}));
        return (
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              if (PRECACHE.has(url.pathname)) caches.open(CACHE).then((c) => c.put(req, copy));
              else event.waitUntil(garder(req, copy));
            }
            return res;
          })
        );
      }),
    );
  }
});

/* Rappel quotidien du Go du jour (issue #36).
 * - `push` : la fonction serveur `envoyer-rappels` envoie { titre, texte, url, tag } (chiffré, clés VAPID).
 *   Même étiquette chaque jour : le rappel d'aujourd'hui remplace celui d'hier au lieu de s'empiler.
 *   Ni son ni vibration imposés, sans insistance (`requireInteraction` absent).
 * - `notificationclick` : ouvre le Go du jour (`/?rappel=1` ; l'app envoie alors `rappel_ouvert`). Si l'app est déjà
 *   ouverte, elle revient au premier plan sur cette adresse ; sinon une fenêtre s'ouvre.
 */
const RAPPEL_DEFAUT = { titre: 'Le Go du jour est prêt', texte: 'Un petit problème de go t’attend.', url: '/?rappel=1', tag: 'rappel-du-jour' };

/** Contenu du rappel, borné à notre origine (jamais une adresse extérieure). */
function lireRappel(event) {
  let d;
  try {
    d = (event.data && event.data.json()) || {};
  } catch {
    d = {};
  }
  const r = { ...RAPPEL_DEFAUT };
  if (typeof d.titre === 'string' && d.titre) r.titre = d.titre.slice(0, 80);
  if (typeof d.texte === 'string' && d.texte) r.texte = d.texte.slice(0, 160);
  if (typeof d.tag === 'string' && d.tag) r.tag = d.tag.slice(0, 32);
  if (typeof d.url === 'string' && d.url.startsWith('/') && !d.url.startsWith('//')) r.url = d.url;
  return r;
}

self.addEventListener('push', (event) => {
  const r = lireRappel(event);
  event.waitUntil(
    self.registration.showNotification(r.titre, {
      body: r.texte,
      tag: r.tag,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: r.url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const chemin = (event.notification.data && event.notification.data.url) || RAPPEL_DEFAUT.url;
  const cible = new URL(chemin, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenetres) => {
      const ouverte = fenetres.find((c) => new URL(c.url).origin === self.location.origin);
      if (!ouverte) return self.clients.openWindow(cible);
      return ouverte
        .focus()
        .then((c) => (c && 'navigate' in c ? c.navigate(cible) : c))
        .catch(() => self.clients.openWindow(cible));
    }),
  );
});
