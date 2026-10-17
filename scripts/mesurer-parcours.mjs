// Mesure des parcours clés sur un téléphone moyen (#577, docs/architecture/audit-ponytail-2026-10.md).
//
//   npm run build && node scripts/mesurer-parcours.mjs [--port 4777] [--runs 3] [--dist dist] [--sans-katago] [--h2] [--attente-accueil ms]
//
// - Sert le build avec `vite preview` (en-têtes de vercel.json, gzip, HTTP/1.1 : 6 connexions au plus), sur `--port`.
//   `--h2` : petit serveur HTTP/2 (TLS, certificat jetable, gzip, cache de vercel.json), comme Vercel en production ;
//   en HTTP/1.1, les dizaines de petits morceaux d'un écran font la queue, en HTTP/2 ils partent ensemble.
// - Chromium en émulation mobile (390 x 844), CPU 4x plus lent, réseau « Fast 3G » de DevTools (562,5 ms, 1,44 Mbit/s
//   descendant, 675 kbit/s montant) : les mêmes réglages que scripts/mesurer-perf.mjs.
// - Parcours, chacun dans un contexte neuf (aucun cache) sauf mention :
//   accueil (premier affichage, bouton principal, polices), toucher du bouton principal jusqu'au plateau de la partie,
//   premier coup contre Pomme jusqu'à sa réponse ; problème ouvert par lien (`/?go-du-jour=1`) et par l'onglet
//   Problèmes ; premier coup contre Bambou (KataGo : téléchargement du réseau), puis dans le même contexte une nouvelle
//   partie (réseau en cache) ; revue d'une partie gardée, réseau en cache.
// - Longues tâches (> 50 ms) et plus longue interaction (Event Timing) relevées dans la page pour chaque parcours.
//
// Outil de mesure lancé à la main, pas une étape du build.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, statSync } from 'node:fs';
import { createSecureServer } from 'node:http2';
import { tmpdir } from 'node:os';
import { extname, join, normalize, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const opt = (nom, def) => { const i = args.indexOf(`--${nom}`); return i >= 0 ? args[i + 1] : def; };
const PORT = Number(opt('port', 4777));
const RUNS = Number(opt('runs', 3));
const DIST = opt('dist', 'dist');
const KATAGO = !args.includes('--sans-katago');
const H2 = args.includes('--h2');
// #584 : temps passé sur l'accueil (Bambou proposé) avant de toucher « Jouer » au premier passage sans cache.
const ATTENTE_ACCUEIL = Number(opt('attente-accueil', 0));
const URL0 = `${H2 ? 'https' : 'http'}://localhost:${PORT}`;
const RESEAU = { offline: false, latency: 562.5, downloadThroughput: (1.44 * 1024 * 1024) / 8, uploadThroughput: (675 * 1024) / 8 };
const PLATEAU = 'svg[aria-label^="Plateau de go"]';
const CTA = 'main.app-home .cta';
// Partie de la revue (e2e/revueFactice.ts) : 9 x 9, 14 coups puis deux passes.
const SGF = '(;GM[1]FF[4]CA[UTF-8]SZ[9]KM[6.5]RU[Japanese]PB[Toi]PW[Pomme]RE[B+1.5]'
  + ';B[cg];W[gc];B[gg];W[cc];B[ee];W[ec];B[dd];W[eg];B[fc];W[fe];B[df];W[cf];B[bd];W[eb];B[tt];W[tt])';

/** Sonde installée avant le code de la page : peintures, longues tâches, interactions, bouton principal affiché. */
function sonde(cta) {
  const p = (window.__perf = { fcp: null, lcp: null, cta: null, polices: null, longues: [], interactions: [] });
  const obs = (type, f, extra = {}) => { try { new PerformanceObserver(l => l.getEntries().forEach(f)).observe({ type, buffered: true, ...extra }); } catch { /* type absent */ } };
  obs('paint', e => { if (e.name === 'first-contentful-paint') p.fcp = e.startTime; });
  obs('largest-contentful-paint', e => { p.lcp = e.startTime; });
  obs('longtask', e => p.longues.push({ debut: e.startTime, duree: e.duration }));
  obs('event', e => { if (e.interactionId) p.interactions.push({ nom: e.name, duree: e.duration, debut: e.startTime }); }, { durationThreshold: 16 });
  const guetter = () => {
    const el = document.querySelector(cta);
    if (p.cta === null && el && el.getBoundingClientRect().height > 0) p.cta = performance.now();
    if (p.cta !== null && document.fonts.check('700 16px "Bricolage Grotesque"') && document.fonts.check('400 16px "Zen Kaku Gothic New"')) { p.polices = performance.now(); return; }
    requestAnimationFrame(guetter);
  };
  requestAnimationFrame(guetter);
}

const stockage = extra => ({ cookies: [], origins: [{ origin: URL0, localStorage: Object.entries({
  'go.consentement.v1': 'refuse', 'go.connait-go.v1': '"sait"', ...extra }).map(([name, value]) => ({ name, value })) }] });

async function contexte(browser, extra = {}) {
  return browser.newContext({ ignoreHTTPSErrors: H2, viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'fr-FR', storageState: stockage(extra) });
}

async function page(ctx) {
  const pg = await ctx.newPage();
  await pg.addInitScript(sonde, CTA);
  const cdp = await ctx.newCDPSession(pg);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', RESEAU);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  // Requêtes de la page et de ses Workers (le réseau de KataGo est lu par le Worker), et repli signalé en console.
  const urls = [], repli = [];
  pg.on('requestfinished', async r => { const t = r.timing(); urls.push({ url: r.url(), s: (t.responseEnd - Math.max(0, t.requestStart)) / 1000, octets: (await r.sizes().catch(() => ({}))).responseBodySize }); });
  pg.on('console', m => { if (/KataGo indisponible/.test(m.text())) repli.push(m.text()); });
  return { pg, urls, repli };
}

/** Longues tâches et plus longue interaction depuis `depuis` (horloge de la page). */
async function bilan(pg, depuis = 0) {
  return pg.evaluate(d => {
    const l = window.__perf.longues.filter(x => x.debut >= d);
    const i = window.__perf.interactions.filter(x => x.debut >= d);
    return { longues: l.length, longuesMs: Math.round(l.reduce((a, x) => a + x.duree, 0)), longueMax: Math.round(Math.max(0, ...l.map(x => x.duree))),
      interactionMax: Math.round(Math.max(0, ...i.map(x => x.duree))) };
  }, depuis);
}
const maintenant = pg => pg.evaluate(() => performance.now());

/** Pose une pierre (souris : pas de seconde touche de confirmation) au point (x, y) d'un plateau 9 x 9, A9 = (0, 0). */
async function poser(pg, x, y) {
  const svg = pg.locator(PLATEAU).first();
  const box = await svg.boundingBox();
  const [x0, y0, w] = (await svg.getAttribute('viewBox')).split(' ').map(Number);
  await pg.mouse.click(box.x + ((34 + x * 40 - x0) * box.width) / w, box.y + ((34 + y * 40 - y0) * box.height) / w);
}

async function attendreBlanc(pg, n, timeout) {
  await pg.waitForFunction(([s, n]) => document.querySelectorAll(`${s} g[data-pierre="blanc"]`).length >= n, [PLATEAU, n], { timeout, polling: 50 });
}

async function accueilEtPartie(browser) {
  const ctx = await contexte(browser);
  try {
    const { pg } = await page(ctx);
    await pg.goto(URL0, { waitUntil: 'commit' });
    await pg.waitForFunction(() => window.__perf.cta !== null, null, { timeout: 60_000 });
    await pg.waitForFunction(() => window.__perf.polices !== null, null, { timeout: 30_000 }).catch(() => {});
    await pg.waitForTimeout(2000);
    const perf = await pg.evaluate(() => ({ fcp: window.__perf.fcp, lcp: window.__perf.lcp, cta: window.__perf.cta, polices: window.__perf.polices }));
    const charge = await bilan(pg);
    let t = await maintenant(pg);
    await pg.locator(CTA).click();
    await pg.locator(PLATEAU).first().waitFor({ state: 'visible', timeout: 60_000 });
    const ouverture = (await maintenant(pg)) - t;
    await pg.waitForTimeout(1500);
    const ouvertureB = await bilan(pg, t);
    t = await maintenant(pg);
    await poser(pg, 4, 4);
    await attendreBlanc(pg, 1, 60_000);
    const coup = (await maintenant(pg)) - t;
    await pg.waitForTimeout(1000);
    return { ...perf, charge, ouverture, ouvertureB, coup, coupB: await bilan(pg, t) };
  } finally { await ctx.close(); }
}

async function probleme(browser) {
  const ctx = await contexte(browser);
  try {
    const { pg } = await page(ctx);
    await pg.goto(`${URL0}/?go-du-jour=1`, { waitUntil: 'commit' });
    await pg.locator(PLATEAU).first().waitFor({ state: 'visible', timeout: 60_000 });
    const lien = await maintenant(pg);
    await pg.waitForTimeout(1500);
    const lienB = await bilan(pg);
    // Par l'onglet : accueil chargé, puis « Problèmes » dans la barre de navigation.
    const { pg: p2 } = await page(ctx);
    await p2.goto(URL0, { waitUntil: 'commit' });
    await p2.waitForFunction(() => window.__perf.cta !== null, null, { timeout: 60_000 });
    await p2.waitForTimeout(3000);
    const t = await maintenant(p2);
    await p2.getByRole('navigation').getByRole('button', { name: /^Problèmes/ }).click();
    await p2.locator(PLATEAU).first().waitFor({ state: 'visible', timeout: 60_000 });
    const onglet = (await maintenant(p2)) - t;
    await p2.waitForTimeout(1500);
    return { lien, lienB, onglet, ongletB: await bilan(p2, t) };
  } finally { await ctx.close(); }
}

async function katago(browser) {
  const ctx = await contexte(browser, { 'go.bilan.v1': JSON.stringify({ pomme: { v: 1, d: 0 }, caillou: { v: 1, d: 0 } }), 'go.adversaire.v1': '"bambou"',
    'go.parties.v1': JSON.stringify({ n: 5 }), 'go.historique.v1': JSON.stringify([{ id: 'mesure', date: new Date(Date.now() - 3_600_000).toISOString(), sgf: SGF, mode: 'ordi', taille: 9, joueur: 1, adversaire: 'Pomme', resultat: 'B+1.5' }]) });
  try {
    const coupBambou = async (attente = 0) => {
      const { pg, urls, repli } = await page(ctx);
      await pg.goto(URL0, { waitUntil: 'commit' });
      await pg.waitForFunction(() => window.__perf.cta !== null, null, { timeout: 60_000 });
      if (attente) await pg.waitForTimeout(attente);
      await pg.locator(CTA).click();
      await pg.locator(PLATEAU).first().waitFor({ state: 'visible', timeout: 60_000 });
      await pg.waitForTimeout(1000);
      const t = await maintenant(pg);
      // #584 : premier affichage de « L'IA se prépare » dans la bulle de Mochi.
      await pg.evaluate(() => { const id = setInterval(() => { if (/se prépare/.test(document.querySelector('.partie-mochi')?.textContent ?? '')) { window.__perf.prepare = performance.now(); clearInterval(id); } }, 100); });
      await poser(pg, 4, 4);
      await attendreBlanc(pg, 1, 180_000);
      const ms = (await maintenant(pg)) - t;
      const r = urls.find(u => /reseaux\/.*\.bin\.gz/.test(u.url));
      const prepare = await pg.evaluate(() => window.__perf.prepare ?? null);
      const res = { ms, b: await bilan(pg, t), reseau: r ?? null, katago: repli.length === 0, prepare: prepare === null ? null : prepare - t };
      await pg.close();
      return res;
    };
    const froid = await coupBambou(ATTENTE_ACCUEIL);
    const cache = await coupBambou();
    // Revue de la partie gardée, réseau en cache : Profil, Mes parties, la partie ; puis KataGo prêt.
    const { pg } = await page(ctx);
    await pg.goto(URL0, { waitUntil: 'commit' });
    await pg.waitForFunction(() => window.__perf.cta !== null, null, { timeout: 60_000 });
    await pg.waitForTimeout(2000);
    await pg.getByRole('navigation').getByRole('button', { name: /^Profil$/ }).click();
    await pg.getByRole('button', { name: /^Mes parties/ }).click();
    const t = await maintenant(pg);
    await pg.locator('.mp-parties > li > button').first().click();
    await pg.getByRole('heading', { level: 2 }).first().waitFor({ timeout: 60_000 });
    const revue = (await maintenant(pg)) - t;
    await pg.waitForFunction(() => !document.querySelector('.bilan-katago'), null, { timeout: 180_000, polling: 100 });
    const revuePrete = (await maintenant(pg)) - t;
    return { froid, cache, revue, revuePrete, revueB: await bilan(pg, t) };
  } finally { await ctx.close(); }
}

const mediane = xs => { const s = xs.filter(x => x != null).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
const ms = x => (x == null ? '-' : `${Math.round(x)} ms`);
const tout = (rs, f) => `${ms(mediane(rs.map(f)))} (${rs.map(r => ms(f(r))).join(', ')})`;
const lt = (rs, f) => { const b = rs.map(f); return `longues tâches ${mediane(b.map(x => x.longues))} (${mediane(b.map(x => x.longuesMs))} ms, max ${mediane(b.map(x => x.longueMax))} ms), interaction max ${mediane(b.map(x => x.interactionMax))} ms`; };

/** Serveur HTTP/2 du dossier `dist` : fichiers tels quels, gzip, `index.html` pour les adresses inconnues. */
function serveurH2(dist) {
  const dir = mkdtempSync(join(tmpdir(), 'mesure-h2-'));
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=localhost', '-keyout', join(dir, 'k.pem'), '-out', join(dir, 'c.pem')], { stdio: 'ignore' });
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.gz': 'application/gzip' };
  const gz = new Map();
  const srv = createSecureServer({ key: readFileSync(join(dir, 'k.pem')), cert: readFileSync(join(dir, 'c.pem')), allowHTTP1: true }, (req, res) => {
    const url = new URL(req.url, URL0);
    let f = normalize(join(dist, decodeURIComponent(url.pathname)));
    if (!f.startsWith(dist) || !existsSync(f) || statSync(f).isDirectory()) f = join(dist, 'index.html');
    const ext = extname(f), entetes = { 'content-type': types[ext] ?? 'application/octet-stream',
      'cache-control': /^\/(assets|reseaux)\//.test(url.pathname) ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate' };
    if (ext !== '.gz' && ext !== '.png' && ext !== '.woff2' && /gzip/.test(req.headers['accept-encoding'] ?? '')) {
      if (!gz.has(f)) gz.set(f, gzipSync(readFileSync(f)));
      res.writeHead(200, { ...entetes, 'content-encoding': 'gzip' }).end(gz.get(f));
    } else res.writeHead(200, entetes).end(readFileSync(f));
  });
  srv.listen(PORT);
  return { arreter: () => srv.close() };
}

const serveur = H2 ? serveurH2(resolve(DIST)) : (() => {
  const p = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort', '--outDir', DIST], { stdio: 'ignore', detached: true });
  return { arreter: () => { try { process.kill(-p.pid); } catch { /* déjà arrêté */ } } };
})();
const PREINSTALLE = '/opt/pw-browsers/chromium';
const exe = process.env.PW_CHROMIUM_PATH ?? (!existsSync(chromium.executablePath()) && existsSync(PREINSTALLE) ? PREINSTALLE : undefined);
let browser;
try {
  for (let i = 0; ; i++) { try { if (!H2) await fetch(URL0); break; } catch { if (i > 60) throw new Error('vite preview ne répond pas'); await new Promise(r => setTimeout(r, 500)); } }
  browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: H2 ? ['--ignore-certificate-errors'] : [] });
  const A = [], P = [], K = [];
  for (let i = 0; i < RUNS; i++) {
    A.push(await accueilEtPartie(browser));
    P.push(await probleme(browser));
    if (KATAGO) K.push(await katago(browser));
    process.stderr.write(`passage ${i + 1}/${RUNS}\n`);
  }
  console.log(`## ${DIST}, ${H2 ? 'HTTP/2' : 'vite preview (HTTP/1.1)'} (médiane de ${RUNS}, passages entre parenthèses)\n`);
  console.log(`Accueil : FCP ${tout(A, r => r.fcp)} · LCP ${tout(A, r => r.lcp)} · bouton principal ${tout(A, r => r.cta)} · polices ${tout(A, r => r.polices)}`);
  console.log(`  chargement : ${lt(A, r => r.charge)}`);
  console.log(`Partie contre Pomme, toucher du bouton → plateau : ${tout(A, r => r.ouverture)} ; ${lt(A, r => r.ouvertureB)}`);
  console.log(`Premier coup → réponse de Pomme : ${tout(A, r => r.coup)} ; ${lt(A, r => r.coupB)}`);
  console.log(`Problème par lien, plateau affiché : ${tout(P, r => r.lien)} ; ${lt(P, r => r.lienB)}`);
  console.log(`Onglet Problèmes → plateau : ${tout(P, r => r.onglet)} ; ${lt(P, r => r.ongletB)}`);
  if (KATAGO) {
    console.log(`Premier coup → réponse de Bambou (KataGo), rien en cache${ATTENTE_ACCUEIL ? `, ${ATTENTE_ACCUEIL} ms sur l'accueil avant « Jouer »` : ''} : ${tout(K, r => r.froid.ms)} ; ${K.filter(r => r.froid.katago).length}/${K.length} coups de KataGo ; « L'IA se prépare » affiché après ${tout(K, r => r.froid.prepare)} ; réseau ${K.map(r => r.froid.reseau ? `${(r.froid.reseau.octets / 1e6).toFixed(2)} Mo en ${r.froid.reseau.s?.toFixed(1)} s` : 'non demandé').join(', ')} ; ${lt(K, r => r.froid.b)}`);
    console.log(`Même chose, réseau en cache : ${tout(K, r => r.cache.ms)} ; ${K.filter(r => r.cache.katago).length}/${K.length} coups de KataGo ; réseau ${K.map(r => (r.cache.reseau ? `${r.cache.reseau.octets} o` : 'non demandé')).join(', ')} ; ${lt(K, r => r.cache.b)}`);
    console.log(`Revue (réseau en cache) : écran ${tout(K, r => r.revue)} · KataGo prêt ${tout(K, r => r.revuePrete)} ; ${lt(K, r => r.revueB)}`);
  }
} finally {
  await browser?.close();
  serveur.arreter();
}
