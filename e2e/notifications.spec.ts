import { expect, test, type Browser, type Page } from '@playwright/test';
import { brancher, fauxServeur, JETON, PARTIE, type FauxServeur } from './fauxSupabase';
import { jouer, plateau } from './plateau';

// Issue #367 : notifications dans l'app. Le joueur voit d'un coup d'œil ce qui l'attend, sans être harcelé :
// une pastille jade sur l'onglet quand un ami attend son coup, une liste « À faire » dans le Profil, un toucher
// ouvre le bon écran. Supabase simulé (e2e/fauxSupabase.ts), sous la RLS simulée (parties de ses seuls joueurs).

const MOI = '00000000-0000-4000-8000-0000000000a1';
const LEA = '00000000-0000-4000-8000-0000000000b2';
const CAPTURES = process.env.CAPTURES_367; // ex. docs/design/captures/notifications-367
const H = 3_600_000;

/** Numéro du Go du jour d'aujourd'hui (src/app/goDuJour.ts : jours en heure de Paris depuis le 27/09/2026, à partir de 1). */
function numeroDuJour(): number {
  const paris = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return Math.round((Date.parse(`${paris}T00:00:00Z`) - Date.parse('2026-09-27T00:00:00Z')) / 864e5) + 1;
}

/** Partie entre amis : Léa (Noir) a joué E5 ; c'est à moi (Blanc) si `aMoi`, sinon Léa attend encore. */
function semerPartie(serveur: FauxServeur, aMoi = true) {
  serveur.games.push({ id: PARTIE, white_id: MOI, black_id: LEA, created_by: MOI, size: 9, komi: 6.5, rules: 'japanese', handicap: 0,
    moves: aMoi ? 'ee' : '', status: 'active', counting: false, dead_stones: null, dead_proposed_by: null, result: null, resumed_at: 0, prive: true, rated: false });
  serveur.defis.push({ partie_id: PARTIE, jeton: JETON, createur_id: MOI, invite_id: LEA, delai_coup: '3 days',
    date_limite: new Date(Date.now() + 50 * H).toISOString(), lien_expire_le: new Date(Date.now() + 7 * 864e5).toISOString(), cree_le: new Date().toISOString() });
}

async function ouvrir(browser: Browser, baseURL: string | undefined, serveur: FauxServeur, o: { largeur?: number; hauteur?: number; sombre?: boolean; stockage?: Record<string, unknown> } = {}): Promise<Page> {
  const session = serveur.sessionCompte('moi@exemple.test', 'Florian', MOI);
  const ctx = await browser.newContext({
    viewport: { width: o.largeur ?? 390, height: o.hauteur ?? 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', baseURL,
    colorScheme: o.sombre ? 'dark' : 'light', reducedMotion: 'reduce',
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }] }] },
  });
  const stockage = Object.fromEntries(Object.entries({ 'go.parties.v1': { n: 3 }, ...o.stockage }).map(([k, v]) => [k, JSON.stringify(v)]));
  const page = await brancher(ctx, serveur, { 'sb-supabase-auth-token': JSON.stringify(session), ...stockage });
  await page.goto('/');
  return page;
}

const nav = (page: Page) => page.getByRole('navigation');
const capture = async (page: Page, nom: string) => {
  if (CAPTURES) await page.screenshot({ path: `${CAPTURES}/${nom}.jpg`, type: 'jpeg', quality: 80 });
};

test('défi où c’est ton tour : pastille sur Jouer, un toucher sur la tuile ouvre la partie, la pastille s’efface après ton coup', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  semerPartie(serveur);
  const page = await ouvrir(browser, baseURL, serveur);
  const erreurs: string[] = [];
  page.on('pageerror', e => erreurs.push(e.message));

  // La pastille jade, sur l'onglet Jouer seulement ; le lecteur d'écran l'entend avec le libellé.
  await expect(page.getByTestId('pastille-jouer')).toBeVisible();
  await expect(nav(page).getByRole('button', { name: 'Jouer, quelque chose t’attend' })).toBeVisible();
  for (const o of ['apprendre', 'problemes', 'profil']) await expect(page.getByTestId(`pastille-${o}`)).toHaveCount(0);
  // Une seule action principale : le bouton de l'accueil.
  await expect(page.locator('.cta')).toHaveCount(1);
  await capture(page, 'accueil-pastille-390-clair');

  // Un seul défi en attente : la tuile ouvre directement la partie, en un toucher.
  await page.getByTestId('tuile-defi').click();
  await expect(plateau(page)).toBeVisible();
  await expect(page.getByText(/À toi de jouer\. Il te reste/)).toBeVisible();

  // Après ton coup, rien ne t'attend plus : la pastille s'efface au retour.
  await jouer(page, 'C3');
  await expect(page.getByText(/Au tour de ton ami/)).toBeVisible();
  await page.getByRole('button', { name: 'Retour', exact: true }).click();
  await expect(page.locator('.cta')).toBeVisible();
  await expect(page.getByTestId('pastille-jouer')).toHaveCount(0);
  expect(erreurs).toEqual([]);
});

test('liste « À faire » du Profil : « C’est ton tour contre Léa », un toucher ouvre la partie', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  semerPartie(serveur);
  serveur.profiles.push({ id: LEA, username: 'Léa', rating: 1500, streak_days: 0, streak_last: null, streak_freezes: 0 });
  const n = numeroDuJour();
  const page = await ouvrir(browser, baseURL, serveur, { stockage: {
    'go.go-du-jour.v1': { dernier: n - 1, jours: 4 }, // série de 4 jours, Go du jour d'aujourd'hui à faire
    'go.lecons.v1': { l1: 99, l2: 2 }, // leçon 2 commencée
  } });

  await expect(page.getByTestId('pastille-jouer')).toBeVisible();
  await expect(page.getByTestId('pastille-problemes')).toBeVisible(); // série en jeu aujourd'hui
  await expect(page.getByTestId('pastille-apprendre')).toHaveCount(0); // une leçon en cours n'est pas une urgence

  await nav(page).getByRole('button', { name: /^Profil/ }).click();
  const ligne = page.getByRole('button', { name: /^À faire/ });
  await expect(ligne).toContainText('3 choses');
  await expect(page.getByTestId('a-faire-point')).toBeVisible();
  await capture(page, 'profil-ligne-390-clair');
  await ligne.click();

  const liste = page.getByTestId('a-faire');
  const lignes = liste.getByRole('button');
  await expect(lignes).toHaveCount(3);
  await expect(lignes.nth(0)).toContainText('C’est ton tour contre Léa');
  await expect(lignes.nth(1)).toContainText('Garde ta série de 4 jours');
  await expect(lignes.nth(2)).toContainText('Reprends ta leçon');
  for (const b of await lignes.all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await capture(page, 'a-faire-390-clair');

  await lignes.nth(0).click();
  await expect(plateau(page)).toBeVisible();
  await expect(page.getByText(/À toi de jouer\. Il te reste/)).toBeVisible();
});

test('la pastille arrive sans recharger quand l’ami joue', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  semerPartie(serveur, false); // Léa n'a pas encore joué
  const page = await ouvrir(browser, baseURL, serveur);
  await expect(page.locator('.cta')).toBeVisible();
  await expect(page.getByTestId('pastille-jouer')).toHaveCount(0);

  // Léa joue sur son téléphone ; ici, l'app revient au premier plan.
  serveur.games[0].moves = 'ee';
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByTestId('pastille-jouer')).toBeVisible({ timeout: 5000 });
});

test('état vide : aucune pastille, une phrase calme', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const n = numeroDuJour();
  const page = await ouvrir(browser, baseURL, serveur, { stockage: { 'go.go-du-jour.v1': { dernier: n, jours: 2 } } });
  await expect(page.locator('.cta')).toBeVisible();
  await expect(page.locator('.onglet-pastille')).toHaveCount(0);

  await nav(page).getByRole('button', { name: 'Profil' }).click();
  const ligne = page.getByRole('button', { name: /^À faire/ });
  await expect(ligne).toContainText('Rien pour l’instant');
  await expect(page.getByTestId('a-faire-point')).toHaveCount(0);
  await ligne.click();
  const vide = page.getByTestId('a-faire-vide');
  await expect(vide).toHaveText('Rien ne t’attend. Joue quand tu veux.');
  await expect(page.getByTestId('a-faire')).toHaveCount(0);
  await capture(page, 'a-faire-vide-390-clair');
});

test.describe('captures', () => {
  test.skip(!CAPTURES, 'captures seulement avec CAPTURES_367');
  for (const [largeur, hauteur, sombre] of [[390, 844, true], [320, 568, false], [320, 568, true]] as const) {
    const suffixe = `${largeur}-${sombre ? 'sombre' : 'clair'}`;
    test(`accueil et « À faire » en ${suffixe}`, async ({ browser, baseURL }) => {
      const serveur = fauxServeur();
      semerPartie(serveur);
      serveur.profiles.push({ id: LEA, username: 'Léa', rating: 1500, streak_days: 0, streak_last: null, streak_freezes: 0 });
      const page = await ouvrir(browser, baseURL, serveur, { largeur, hauteur, sombre, stockage: {
        'go.go-du-jour.v1': { dernier: numeroDuJour() - 1, jours: 4 }, 'go.lecons.v1': { l1: 99, l2: 2 },
      } });
      await expect(page.getByTestId('pastille-jouer')).toBeVisible();
      await capture(page, `accueil-pastille-${suffixe}`);
      await nav(page).getByRole('button', { name: /^Profil/ }).click();
      await page.getByRole('button', { name: /^À faire/ }).click();
      await expect(page.getByTestId('a-faire').getByRole('button')).toHaveCount(3);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(largeur);
      await capture(page, `a-faire-${suffixe}`);
    });
  }
});
