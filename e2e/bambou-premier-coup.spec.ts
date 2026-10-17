import { readFileSync } from 'node:fs';
import { expect, test, type Page, type Route } from '@playwright/test';
import { jouer, message, pierres, plateau } from './plateau';

// #584 : premier coup contre Bambou (KataGo) sans le réseau en cache. Avant : 15 s d'attente muette, puis un coup du
// moteur simple, sans le dire. Maintenant : « L'IA se prépare… » pendant le téléchargement, puis le coup de KataGo ;
// si KataGo ne peut pas démarrer, Mochi dit que Bambou joue sans l'IA (moteur simple). Préchargement quand Bambou est
// choisi dans « Changer », jamais en économie de données.
// Captures (design-critique, 390 × 844, clair et sombre) : CAPTURES_584=docs/design/captures/vitesse-584

const FICHIER = 'public/reseaux/g170-b6c96-s175395328-d26788732.f5d32604.bin.gz';
const RESEAU = '**/reseaux/g170-b6c96-s175395328-d26788732.f5d32604.bin.gz';
const ANCIENNE = 'https://raw.githubusercontent.com/lightvector/KataGo/**';
const CAPTURES = process.env.CAPTURES_584;

/** Joueur qui a battu Pomme et Caillou ; téléchargement du réseau permis dans ce build de test. */
async function appareil(page: Page, adversaire: string, connexion?: Record<string, unknown>) {
  await page.addInitScript(({ adversaire, connexion }) => {
    (window as unknown as { __kataGoTelechargement: boolean }).__kataGoTelechargement = true;
    if (connexion) Object.defineProperty(navigator, 'connection', { configurable: true, get: () => connexion });
    if (sessionStorage.getItem('e2e.stocke')) return;
    sessionStorage.setItem('e2e.stocke', '1');
    for (const [k, v] of Object.entries({
      'go.bilan.v1': JSON.stringify({ pomme: { v: 1, d: 0 }, caillou: { v: 1, d: 0 } }), 'go.adversaire.v1': JSON.stringify(adversaire),
      'go.parties.v1': JSON.stringify({ n: 5 }), 'go.intro-but.v1': 'true', 'go.premiere-pierre.v1': 'true',
    })) localStorage.setItem(k, v);
  }, { adversaire, connexion });
}

/** Sert le réseau (après `lacher()` s'il est retenu) et compte les demandes ; la copie de secours ne répond pas. */
async function servir(page: Page, o: { retenir?: boolean; refuser?: boolean } = {}) {
  const n = { v: 0 };
  let lacher = () => {};
  const retenu = new Promise<void>(r => { lacher = r; });
  const repondre = async (route: Route) => {
    n.v++;
    if (o.refuser) return route.abort('connectionrefused');
    if (o.retenir) await retenu;
    return route.fulfill({ status: 200, body: readFileSync(FICHIER), headers: { 'content-type': 'application/octet-stream' } });
  };
  await page.route(RESEAU, repondre);
  await page.route(ANCIENNE, route => (o.refuser ? route.abort('connectionrefused') : repondre(route)));
  return { n, lacher: () => lacher() };
}

async function capture(page: Page, nom: string) {
  if (!CAPTURES) return;
  for (const schema of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: schema });
    await page.screenshot({ path: `${CAPTURES}/${nom}-390-${schema === 'light' ? 'clair' : 'sombre'}.png` });
  }
  await page.emulateMedia({ colorScheme: 'light' });
}

test('réseau pas en cache : « L’IA se prépare… », puis le coup de KataGo (pas du moteur simple)', async ({ page }) => {
  test.setTimeout(120_000);
  const repli: string[] = [];
  page.on('console', m => { if (/KataGo indisponible/.test(m.text())) repli.push(m.text()); });
  const erreurs: string[] = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await appareil(page, 'bambou');
  const reseau = await servir(page, { retenir: true });
  await page.goto('/');
  await expect(page.locator('.cta')).toHaveAccessibleName(/contre Bambou$/);
  await page.locator('.cta').click();
  await expect(plateau(page)).toBeVisible();
  // Le téléchargement commence dès l'ouverture de la partie.
  await expect.poll(() => reseau.n.v).toBe(1);
  await jouer(page, 'E5');
  await expect(message(page)).toHaveText(/^L’IA se prépare…/, { timeout: 10_000 });
  await expect(pierres(page, 'blanc')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await capture(page, 'ia-se-prepare');
  reseau.lacher();
  await expect(pierres(page, 'blanc')).toHaveCount(1, { timeout: 90_000 });
  await expect(message(page)).toHaveText(/^Bambou joue [A-J]\d/);
  expect(repli).toEqual([]);
  expect(reseau.n.v).toBe(1);
  expect(erreurs).toEqual([]);
});

test('KataGo ne peut pas démarrer (réseau introuvable) : Mochi dit que Bambou joue sans l’IA', async ({ page }) => {
  await appareil(page, 'bambou');
  await servir(page, { refuser: true });
  await page.goto('/');
  await page.locator('.cta').click();
  await expect(plateau(page)).toBeVisible();
  await jouer(page, 'E5');
  await expect(pierres(page, 'blanc')).toHaveCount(1, { timeout: 30_000 });
  await expect(message(page)).toHaveText(/^Sans l’IA \(pas chargée\), Bambou joue [A-J]\d\.$/);
  await capture(page, 'ia-pas-chargee');
});

test('Bambou choisi dans « Changer » : le réseau se précharge ; jamais en économie de données', async ({ browser, baseURL }) => {
  for (const [connexion, attendu] of [[undefined, 1], [{ saveData: true }, 0], [{ type: 'cellular', effectiveType: '2g' }, 0]] as const) {
    const ctx = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, locale: 'fr-FR',
      storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }, { name: 'go.connait-go.v1', value: '"sait"' }] }] } });
    const page = await ctx.newPage();
    await appareil(page, 'caillou', connexion);
    const reseau = await servir(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Changer' }).click();
    await page.getByRole('list', { name: /Adversaires/ }).getByRole('button', { name: /^Bambou,/ }).click();
    if (attendu) await expect.poll(() => reseau.n.v, { timeout: 15_000 }).toBe(1);
    else { await page.waitForTimeout(3000); expect(reseau.n.v).toBe(0); }
    await ctx.close();
  }
});
