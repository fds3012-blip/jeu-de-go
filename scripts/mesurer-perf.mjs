// Mesure de l'ouverture de l'app sur un téléphone moyen (issue #29 du soir, docs/qa/perf-2026-09-29.md).
//
//   npm run build && node scripts/mesurer-perf.mjs [--port 5182] [--runs 3]
//
// - Sert `dist/` avec un petit serveur local qui compresse en gzip et répond comme Vercel par défaut
//   (Cache-Control: public, max-age=0, must-revalidate + ETag), sauf si `--immuable` : /assets/* en cache d'un an.
// - Chromium en émulation mobile (390 x 844), CPU 4x plus lent, réseau « 4G lente » de DevTools
//   (latence 562,5 ms, 1,44 Mbit/s descendant, 675 kbit/s montant).
// - Trois parcours : première visite (aucun cache), retour (cache HTTP + service worker), hors ligne après une visite.
// - « Premier écran utile » : instant où le bouton principal de l'accueil (`main.app-home .cta`) est affiché.
//
// Pas une dépendance du build : outil de mesure lancé à la main.
import { createServer } from 'node:http';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { gzipSync } from 'node:zlib';
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const opt = (nom, def) => {
  const i = args.indexOf(`--${nom}`);
  return i >= 0 ? args[i + 1] : def;
};
const PORT = Number(opt('port', process.env.PW_PORT ?? 5182));
const RUNS = Number(opt('runs', 3));
const IMMUABLE = args.includes('--immuable');
const DISTS = opt('dist', new URL('../dist/', import.meta.url).pathname).split(',').map(d => d.replace(/\/?$/, '/'));
const CTA = 'main.app-home .cta';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2',
  '.gz': 'application/octet-stream', '.bin': 'application/octet-stream',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.webmanifest', '.svg']);

function serveur(DIST) {
  const cache = new Map();
  return createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    let chemin = normalize(join(DIST, decodeURIComponent(url.pathname)));
    if (!chemin.startsWith(DIST)) { res.writeHead(403).end(); return; }
    if (!existsSync(chemin) || statSync(chemin).isDirectory()) chemin = join(DIST, 'index.html');
    const ext = extname(chemin);
    const st = statSync(chemin);
    const etag = `"${st.size}-${st.mtimeMs}"`;
    const cc = IMMUABLE && url.pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate';
    const entetes = { 'Content-Type': TYPES[ext] ?? 'application/octet-stream', 'Cache-Control': cc, ETag: etag };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, entetes).end(); return; }
    if (COMPRESSIBLE.has(ext) && /gzip/.test(req.headers['accept-encoding'] ?? '')) {
      if (!cache.has(chemin)) cache.set(chemin, gzipSync(readFileSync(chemin), { level: 9 }));
      const corps = cache.get(chemin);
      res.writeHead(200, { ...entetes, 'Content-Encoding': 'gzip', 'Content-Length': corps.length, Vary: 'Accept-Encoding' }).end(corps);
      return;
    }
    res.writeHead(200, { ...entetes, 'Content-Length': st.size });
    createReadStream(chemin).pipe(res);
  });
}

const RESEAU = { offline: false, latency: 562.5, downloadThroughput: (1.44 * 1024 * 1024) / 8, uploadThroughput: (675 * 1024) / 8 };

/** Note, dans la page, les instants clés (FCP, LCP, bouton principal affiché). */
function sonde(cta) {
  window.__perf = { fcp: null, lcp: null, cta: null, polices: null };
  new PerformanceObserver(l => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') window.__perf.fcp = e.startTime; })
    .observe({ type: 'paint', buffered: true });
  new PerformanceObserver(l => { const e = l.getEntries().at(-1); if (e) window.__perf.lcp = e.startTime; })
    .observe({ type: 'largest-contentful-paint', buffered: true });
  const guetter = () => {
    const el = document.querySelector(cta);
    if (el && el.getBoundingClientRect().height > 0 && window.__perf.cta === null) window.__perf.cta = performance.now();
    // Polices du texte affichées (fin du texte de repli) : titre et texte courant.
    if (window.__perf.cta !== null && document.fonts.check('700 16px "Bricolage Grotesque"') && document.fonts.check('400 16px "Zen Kaku Gothic New"')) {
      window.__perf.polices = performance.now();
      return;
    }
    requestAnimationFrame(guetter);
  };
  requestAnimationFrame(guetter);
}

async function nouvellePage(context) {
  const page = await context.newPage();
  await page.addInitScript(sonde, CTA);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', RESEAU);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const octets = new Map(); // requestId -> { url, type, taille, sw }
  cdp.on('Network.responseReceived', e => octets.set(e.requestId, { url: e.response.url, type: e.type, taille: 0, sw: e.response.fromServiceWorker, cache: e.response.fromDiskCache }));
  cdp.on('Network.loadingFinished', e => { const o = octets.get(e.requestId); if (o) o.taille = e.encodedDataLength; });
  return { page, cdp, octets };
}

async function mesurer(page, octets, { hors = false } = {}) {
  octets.clear();
  const t0 = Date.now();
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'commit' });
  await page.waitForFunction(() => window.__perf?.cta !== null, null, { timeout: hors ? 15_000 : 60_000 });
  await page.waitForFunction(() => window.__perf.polices !== null, null, { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(hors ? 300 : 1500); // LCP final, requêtes de fin de chargement
  const perf = await page.evaluate(() => window.__perf);
  const parType = {};
  let js = 0;
  for (const o of octets.values()) {
    if (o.sw || o.url.startsWith('data:')) continue;
    parType[o.type] = (parType[o.type] ?? 0) + o.taille;
    if (o.type === 'Script') js += o.taille;
  }
  const total = Object.values(parType).reduce((a, b) => a + b, 0);
  return { ...perf, mur: Date.now() - t0, total, js, parType };
}

const mediane = xs => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const ms = x => (x == null ? '-' : `${Math.round(x)} ms`);
const ko = x => `${(x / 1024).toFixed(1)} Ko`;

const PREINSTALLE = '/opt/pw-browsers/chromium';
const exe = process.env.PW_CHROMIUM_PATH ?? (!existsSync(chromium.executablePath()) && existsSync(PREINSTALLE) ? PREINSTALLE : undefined);

const contexte = (browser) => browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'fr-FR',
  storageState: { cookies: [], origins: [{ origin: `http://localhost:${PORT}`, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }] }] },
});

/** Un passage complet : première visite, réouverture hors ligne, retour en ligne. */
async function passage(browser, dist, res) {
  const srv = serveur(dist);
  await new Promise(r => srv.listen(PORT, r));
  const ctx = await contexte(browser);
  try {
    const { page, octets } = await nouvellePage(ctx);
    res.froid.push(await mesurer(page, octets));
    // Le service worker est installé : le joueur ferme l'app, puis la rouvre sans réseau (métro, avion).
    await page.evaluate(() => navigator.serviceWorker?.ready);
    await page.waitForTimeout(3000);
    await ctx.setOffline(true);
    try { res.horsLigne.push({ ok: true, ...(await mesurer(page, octets, { hors: true })) }); }
    catch (e) { res.horsLigne.push({ ok: false, erreur: String(e).split('\n')[0] }); }
    // Puis il revient avec du réseau, comme le lendemain.
    await ctx.setOffline(false);
    res.chaud.push(await mesurer(page, octets));
  } finally {
    await ctx.close();
    await new Promise(r => srv.close(r));
  }
}

// Plusieurs builds (`--dist a,b`) : passages alternés, pour que la charge de la machine pèse autant sur chacun.
const builds = DISTS.map(d => ({ dist: d, froid: [], chaud: [], horsLigne: [] }));
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
try {
  for (let i = 0; i < RUNS; i++) for (const b of builds) await passage(browser, b.dist, b);
} finally {
  await browser.close();
}

function resume(nom, rs) {
  console.log(`\n### ${nom} (médiane de ${rs.length})`);
  console.log(`FCP ${ms(mediane(rs.map(r => r.fcp)))} · LCP ${ms(mediane(rs.map(r => r.lcp)))} · bouton principal ${ms(mediane(rs.map(r => r.cta)))} · polices ${ms(mediane(rs.map(r => r.polices)))}`);
  console.log(`  passages, bouton principal : ${rs.map(r => ms(r.cta)).join(', ')}`);
  console.log(`Transféré par la page ${ko(mediane(rs.map(r => r.total)))} dont JS ${ko(mediane(rs.map(r => r.js)))}`);
  const types = [...new Set(rs.flatMap(r => Object.keys(r.parType)))];
  if (types.length) console.log('Par type : ' + types.map(t => `${t} ${ko(mediane(rs.map(r => r.parType[t] ?? 0)))}`).join(' · '));
}
for (const b of builds) {
  console.log(`\n## ${b.dist}`);
  resume('Première visite', b.froid);
  resume('Retour (cache + service worker)', b.chaud);
  const ok = b.horsLigne.filter(r => r.ok);
  console.log(`\n### Hors ligne après une visite : ${ok.length}/${b.horsLigne.length} ouvertures réussies`);
  if (ok.length) console.log(`bouton principal ${ms(mediane(ok.map(r => r.cta)))}`);
  for (const r of b.horsLigne.filter(r => !r.ok)) console.log(`échec : ${r.erreur}`);
}
