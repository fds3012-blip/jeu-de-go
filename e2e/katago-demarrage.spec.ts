import { readFileSync } from 'node:fs';
import { expect, test, type Page, type Route } from '@playwright/test';
import { SGF_424 } from '../src/app/partie424.fixture';
import { ouvrirRevue } from './revueFactice';
import { abandonner, partieADeux } from './plateau';

// Issue #475 : réseau KataGo servi par l'app (/reseaux/…, empreinte dans le nom), repli sur la copie du dépôt KataGo,
// préchargement discret après la fin d'une partie (règles : src/engine/katago/prechargement.ts), progression affichée.
// KataGo n'est jamais démarré ici (préchargement = fichier en cache seulement) : pas de calcul du vrai réseau.
// Mesure avant/après du démarrage réel (facultative, MESURE_KATAGO=1) : e2e/katago-mesure.spec.ts.

const FICHIER = 'public/reseaux/g170-b6c96-s175395328-d26788732.f5d32604.bin.gz';
const NOTRE = '**/reseaux/g170-b6c96-s175395328-d26788732.f5d32604.bin.gz';
const ANCIENNE = 'https://raw.githubusercontent.com/lightvector/KataGo/master/cpp/tests/models/g170-b6c96-s175395328-d26788732.bin.gz';

type Moteur = {
  prechargerApresPartie(n: number, delai?: number): Promise<{ ok: boolean; raison?: string }>;
  kataGoInfo(): { state: string; prechargement?: string };
  reseauEnCache(): Promise<boolean>;
};

/** Parties déjà lancées sur l'appareil ; téléchargement du réseau permis dans ce build de test. */
async function appareil(page: Page, parties: number, connexion?: Record<string, unknown>) {
  await page.addInitScript(({ parties, connexion }) => {
    localStorage.setItem('go.parties.v1', JSON.stringify({ n: parties }));
    (window as unknown as { __kataGoTelechargement: boolean }).__kataGoTelechargement = true;
    if (connexion) Object.defineProperty(navigator, 'connection', { configurable: true, get: () => connexion });
  }, { parties, connexion });
}

/** Compte les demandes du réseau à notre adresse et les sert depuis le fichier versionné. */
async function compter(page: Page, motif: string, reponse?: (r: Route) => Promise<void>) {
  const n = { v: 0 };
  await page.route(motif, async route => {
    n.v++;
    if (reponse) return reponse(route);
    return route.fulfill({ status: 200, body: readFileSync(FICHIER), headers: { 'content-type': 'application/octet-stream', 'access-control-allow-origin': '*' } });
  });
  return n;
}

const moteur = (page: Page) => page.evaluate(async () => {
  const [e] = await (window as unknown as { __moteurE2E: () => Promise<[unknown]> }).__moteurE2E();
  (window as unknown as { __m: unknown }).__m = e;
});

test('fin de la 2e partie : le réseau se précharge depuis /reseaux/, sans démarrer KataGo', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await appareil(page, 2);
  const n = await compter(page, NOTRE);
  await partieADeux(page);
  await abandonner(page);
  await expect.poll(() => n.v, { timeout: 20_000 }).toBe(1);
  await moteur(page);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __m: Moteur }).__m.kataGoInfo().prechargement), { timeout: 30_000 }).toBe('fait');
  expect(await page.evaluate(() => (window as unknown as { __m: Moteur }).__m.kataGoInfo().state)).toBe('inactif');
  expect(await page.evaluate(() => (window as unknown as { __m: Moteur }).__m.reseauEnCache())).toBe(true);
  expect(erreurs).toEqual([]);
});

test('première partie sur l’appareil : rien n’est téléchargé', async ({ page }) => {
  await appareil(page, 0);
  const n = await compter(page, NOTRE);
  await partieADeux(page);
  await abandonner(page);
  await page.waitForTimeout(5000);
  expect(n.v).toBe(0);
});

test('données mobiles ou économie de données signalées : rien n’est téléchargé', async ({ page }) => {
  await appareil(page, 5, { type: 'cellular', effectiveType: '4g', saveData: false });
  const n = await compter(page, NOTRE);
  await page.goto('/');
  await moteur(page);
  expect(await page.evaluate(() => (window as unknown as { __m: Moteur }).__m.prechargerApresPartie(5, 0))).toEqual({ ok: false, raison: 'reseau-mobile' });
  await page.waitForTimeout(1000);
  expect(n.v).toBe(0);
});

test('notre copie en panne : repli sur la copie du dépôt KataGo, rangée sous notre adresse', async ({ page }) => {
  await appareil(page, 5);
  const notre = await compter(page, NOTRE, r => r.abort('connectionrefused'));
  const ancienne = await compter(page, ANCIENNE);
  await page.goto('/');
  await moteur(page);
  expect(await page.evaluate(() => (window as unknown as { __m: Moteur }).__m.prechargerApresPartie(5, 0))).toEqual({ ok: true });
  await expect.poll(() => page.evaluate(() => (window as unknown as { __m: Moteur }).__m.kataGoInfo().prechargement), { timeout: 30_000 }).toBe('fait');
  expect([notre.v, ancienne.v]).toEqual([1, 1]);
  const cle = await page.evaluate(async () => (await (await caches.open('katago-reseaux-v1')).keys()).map(r => new URL(r.url).pathname));
  expect(cle).toEqual(['/reseaux/g170-b6c96-s175395328-d26788732.f5d32604.bin.gz']);
});

test('revue, connexion lente : « x / 3,8 Mo » s’affiche pendant le téléchargement', async ({ page }) => {
  await page.addInitScript(sgf => {
    localStorage.setItem('go.historique.v1', JSON.stringify([{
      id: 'ami-475', date: new Date(Date.now() - 3_600_000).toISOString(), sgf, mode: 'defi', taille: 9, joueur: 1, adversaire: 'Ami', resultat: 'B+17.5',
    }]));
    (window as unknown as { __kataGoTelechargement: boolean }).__kataGoTelechargement = true;
  }, SGF_424);
  // Réseau lent simulé (Chromium) : ≈ 1 Mbit/s. Le fichier vient du serveur de test, en flux.
  const cdp = await page.context().newCDPSession(page);
  await page.goto('/');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 125_000, uploadThroughput: 60_000 });
  await ouvrirRevue(page);
  await expect(page.getByText('Mochi prépare KataGo, une seule fois (4 Mo).')).toBeVisible();
  const p = page.getByTestId('katago-progression');
  // 3,8 Mo sur Vercel ; `vite preview` sert le .gz avec `Content-Encoding: gzip` : le navigateur le décompresse en
  // route et la progression compte alors les 4,1 Mo décompressés.
  await expect(p).toHaveText(/^\d,\d \/ (3,8|4,1) Mo$/, { timeout: 30_000 });
  const lu = async () => Number((await p.textContent())!.split(' ')[0].replace(',', '.'));
  const a = await lu();
  await expect.poll(lu, { timeout: 20_000 }).toBeGreaterThan(a);
  // Valeur qui change vite : pas lue à voix haute.
  await expect(p).toHaveAttribute('aria-hidden', 'true');
});
