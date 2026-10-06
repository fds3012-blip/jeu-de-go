import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';
import { brancher, fauxServeur, type FauxServeur } from './fauxSupabase';
import { choisirMode, plateau } from './plateau';

// Issue #442 : abandons répétés. Sur le Supabase simulé (e2e/fauxSupabase.ts, mêmes seuils que la migration) :
// deux parties quittées → l'écran du direct prévient, sans bloquer ; une troisième → la recherche est refusée par le
// serveur, l'attente s'affiche (pourquoi, quand rejouer, une seule action : l'ordi) ; 5 minutes plus tard (horloges du
// serveur et du téléphone avancées), on rejoue. Puis l'attente de 30 min dite dès l'ouverture, en anglais, et « Jouer
// contre l'ordi en attendant » ; enfin le plafond réduit des parties lentes. Les règles du serveur (ce qui compte,
// fenêtre de 7 jours, 10 dernières parties, refus) sont testées par supabase/tests/abandons_repetes.test.sql.

const ANA = '00000000-0000-4000-8000-0000000004c1';
const BEN = '00000000-0000-4000-8000-0000000004c2';
const CLEA = '00000000-0000-4000-8000-0000000004c3';
const CAPTURES = process.env.CAPTURES_442; // ex. /tmp/captures-442

async function telephone(browser: Browser, baseURL: string | undefined, serveur: FauxServeur, qui: { email: string; pseudo: string; id: string },
  o: { sombre?: boolean; langue?: 'fr' | 'en'; horloge?: boolean } = {}): Promise<Page> {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: o.langue === 'en' ? 'en-US' : 'fr-FR', baseURL,
    colorScheme: o.sombre ? 'dark' : 'light', reducedMotion: 'reduce',
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }] }] },
  });
  const stockage: Record<string, string> = { 'go.parties.v1': JSON.stringify({ n: 3 }) };
  if (o.langue) stockage['go.langue.v1'] = JSON.stringify(o.langue);
  stockage['sb-supabase-auth-token'] = JSON.stringify(serveur.sessionCompte(qui.email, qui.pseudo, qui.id));
  const page = await brancher(ctx, serveur, stockage);
  if (o.horloge) await page.clock.install();
  await page.goto('/');
  return page;
}

async function sansDebord(page: Page, ecran: string) {
  const m = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(m.scroll, `${ecran} : défilement horizontal`).toBeLessThanOrEqual(m.client);
}
async function cible44(l: Locator, nom: string) {
  const b = (await l.boundingBox())!;
  expect(b.height, `${nom} : 44 px de haut`).toBeGreaterThanOrEqual(43.5);
}

test('trois parties quittées : prévenu à la deuxième, attente de 5 min à la troisième, puis on rejoue', async ({ browser, baseURL }) => {
  test.setTimeout(90_000);
  const serveur = fauxServeur();
  // Deux parties quittées hier soir : rien n'est bloqué, mais l'écran prévient.
  serveur.noterAbandon(ANA, 'direct', 20 * 3600_000);
  serveur.noterAbandon(ANA, 'direct', 19 * 3600_000);
  const ana = await telephone(browser, baseURL, serveur, { email: 'ana.abandons@exemple.test', pseudo: 'Ana', id: ANA }, { horloge: true });
  const erreurs: string[] = [];
  ana.on('pageerror', e => erreurs.push(e.message));

  await choisirMode(ana, 'en_ligne');
  const choix = ana.getByTestId('direct-choix');
  await expect(ana.getByTestId('direct-prevenir')).toHaveText(
    'Encore une partie quittée, et tu attendras 5 min avant de rejouer en direct. Si tu dois partir, abandonne : ça ne compte pas.');
  await expect(choix.locator('.btn.primary')).toHaveCount(1);
  await expect(choix.getByRole('button', { name: 'Trouver un adversaire' })).toBeEnabled();

  // Une troisième partie quittée (constatée par le serveur), puis Ana cherche : la recherche est refusée, l'attente dite.
  serveur.noterAbandon(ANA);
  await choix.getByRole('button', { name: 'Trouver un adversaire' }).click();
  const delai = ana.getByTestId('direct-delai');
  await expect(delai).toBeVisible();
  await expect(delai.getByRole('status')).toHaveText('Tu as quitté plusieurs parties.');
  await expect(delai).toContainText('Tu peux rejouer en direct dans 5 min.');
  await expect(delai).toContainText('Quand une partie est quittée, l’adversaire attend pour rien. Ta cote, elle, ne bouge pas.');
  await expect(delai).toContainText('Trois parties quittées en 7 jours : 5 min d’attente. Puis 30 min, puis 24 h.');
  // Une seule action principale : l'ordi en attendant. Plus de « Trouver un adversaire ».
  await expect(choix.locator('.btn.primary')).toHaveCount(1);
  await expect(choix.getByRole('button', { name: 'Jouer contre l’ordi en attendant' })).toBeVisible();
  await expect(choix.getByRole('button', { name: 'Trouver un adversaire' })).toHaveCount(0);
  await cible44(choix.getByRole('button', { name: 'Jouer contre l’ordi en attendant' }), 'Jouer contre l’ordi en attendant');
  await sansDebord(ana, 'attente 390 px');
  expect(serveur.file).toHaveLength(0);
  if (CAPTURES) await ana.screenshot({ path: `${CAPTURES}/direct-delai.jpg`, type: 'jpeg', quality: 60 });

  // Le compte à rebours descend avec l'heure du serveur.
  await ana.clock.fastForward('02:00');
  await expect(delai).toContainText('Tu peux rejouer en direct dans 3 min.');

  // 5 minutes ont passé (serveur et téléphone) : l'écran relit l'état, la recherche est de nouveau possible.
  serveur.avancerHorloge(5 * 60_000 + 1000);
  await ana.clock.fastForward('03:01');
  await expect(delai).toHaveCount(0);
  await choix.getByRole('button', { name: 'Trouver un adversaire' }).click();
  await expect(ana.getByTestId('direct-attente')).toBeVisible();
  await expect.poll(() => serveur.file.length).toBe(1);
  expect(erreurs).toEqual([]);
});

test('attente de 30 min dite dès l’ouverture, en anglais et en sombre ; « Play the computer meanwhile » lance la partie', async ({ browser, baseURL }) => {
  test.setTimeout(60_000);
  const serveur = fauxServeur();
  for (const h of [30, 20, 10, 0]) serveur.noterAbandon(BEN, 'direct', h * 60_000);
  const ben = await telephone(browser, baseURL, serveur, { email: 'ben.abandons@exemple.test', pseudo: 'Ben', id: BEN }, { langue: 'en', sombre: true });
  await choisirMode(ben, 'en_ligne');
  const delai = ben.getByTestId('direct-delai');
  await expect(delai.getByRole('status')).toHaveText('You left several games.');
  await expect(delai).toContainText('You can play live again in 30 min.');
  await expect(ben.getByTestId('direct-choix').locator('.btn.primary')).toHaveCount(1);
  await sansDebord(ben, 'attente en anglais');
  if (CAPTURES) await ben.screenshot({ path: `${CAPTURES}/direct-delai-en-sombre.jpg`, type: 'jpeg', quality: 60 });
  await delai.getByRole('button', { name: 'Play the computer meanwhile' }).click();
  await expect(plateau(ben)).toBeVisible();
  // Partie contre l'IA seulement : personne n'est entré dans la file du direct.
  expect(serveur.file).toHaveLength(0);
});

test('parties lentes laissées expirer : plafond réduit dit avant de chercher', async ({ browser, baseURL }) => {
  test.setTimeout(60_000);
  const serveur = fauxServeur();
  for (let i = 0; i < 3; i++) serveur.noterAbandon(CLEA, 'lente', (i + 1) * 864e5);
  const clea = await telephone(browser, baseURL, serveur, { email: 'clea.abandons@exemple.test', pseudo: 'Clea', id: CLEA });
  await choisirMode(clea, 'en_ligne');
  const bascule = clea.getByTestId('bascule-en-ligne');
  await bascule.getByRole('button', { name: 'Partie lente' }).click();
  const ecran = clea.getByTestId('lentes');
  await expect(ecran.getByTestId('lente-plafond')).toHaveText(
    'Tu as laissé expirer plusieurs parties. Pendant 30 jours, tu peux en mener 2 à la fois.');
  await expect(ecran.getByRole('button', { name: 'Trouver un adversaire' })).toBeEnabled();
  await sansDebord(clea, 'plafond réduit');
  if (CAPTURES) await clea.screenshot({ path: `${CAPTURES}/lentes-plafond.jpg`, type: 'jpeg', quality: 60 });
});
