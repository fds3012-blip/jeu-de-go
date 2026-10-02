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
  // Le serveur (déclencheur `notifier_partie`, #367) a prévenu le joueur au trait.
  serveur.notifier(aMoi ? MOI : LEA, 'tour', PARTIE);
}

async function ouvrir(browser: Browser, baseURL: string | undefined, serveur: FauxServeur, o: { largeur?: number; hauteur?: number; sombre?: boolean; stockage?: Record<string, unknown>; compte?: { email: string; pseudo: string; id: string } } = {}): Promise<Page> {
  const c = o.compte ?? { email: 'moi@exemple.test', pseudo: 'Florian', id: MOI };
  const session = serveur.sessionCompte(c.email, c.pseudo, c.id);
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
  await expect(nav(page).getByRole('button', { name: 'Jouer, C’est ton tour' })).toBeVisible();
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

test('« Aujourd’hui » sous l’action principale est la liste « À faire » : l’ami nommé, la série, la leçon ; un toucher ouvre la partie', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  semerPartie(serveur);
  serveur.profiles.push({ id: LEA, username: 'Léa', rating: 1500, streak_days: 0, streak_last: null, streak_freezes: 0 });
  const n = numeroDuJour();
  const page = await ouvrir(browser, baseURL, serveur, { stockage: {
    'go.go-du-jour.v1': { dernier: n - 1, jours: 4 }, // série de 4 jours, Go du jour d'aujourd'hui à faire
    'go.lecons.v1': { l1: 99, l2: 2 }, // leçon 2 commencée
  } });

  // Pastilles : un ami attend (Jouer), une série en jeu aujourd'hui (Problèmes) ; une leçon en cours n'est pas une urgence.
  await expect(nav(page).getByRole('button', { name: 'Jouer, C’est ton tour contre Léa' })).toBeVisible();
  await expect(nav(page).getByRole('button', { name: 'Problèmes, Garde ta série de 4 jours' })).toBeVisible();
  await expect(page.getByTestId('pastille-apprendre')).toHaveCount(0);
  await expect(page.getByTestId('pastille-profil')).toHaveCount(0);

  // Sous le bouton principal (toujours seul) : l'ami qui attend, nommé, en premier ; puis le Go du jour et la leçon.
  await expect(page.locator('.cta')).toHaveCount(1);
  const tuiles = page.locator('.tuiles .tuile');
  await expect(tuiles.first()).toContainText('Contre Léa');
  await expect(page.getByRole('button', { name: 'Défi d’un ami, Contre Léa, À toi de jouer.' })).toBeVisible();
  await expect(page.getByTestId('etat-du-jour')).toHaveText('À faire');
  for (const b of await tuiles.all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);

  // Le Profil n'a pas de ligne de plus : il tient toujours sans défiler.
  await nav(page).getByRole('button', { name: /^Profil/ }).click();
  await expect(page.getByRole('heading', { name: 'Ton parcours' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^À faire/ })).toHaveCount(0);

  // Retour à l'accueil par l'onglet à pastille, puis un toucher : la partie.
  await nav(page).getByRole('button', { name: /^Jouer/ }).click();
  await page.getByTestId('tuile-defi').click();
  await expect(plateau(page)).toBeVisible();
  await expect(page.getByText(/À toi de jouer\. Il te reste/)).toBeVisible();
  // #393 : dans la partie aussi, l'ami est nommé par son pseudo.
  await expect(page.locator('.joueur').first()).toContainText('Léa');
});

test('la pastille arrive sans recharger quand l’ami joue', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  semerPartie(serveur, false); // Léa n'a pas encore joué
  const page = await ouvrir(browser, baseURL, serveur);
  await expect(page.locator('.cta')).toBeVisible();
  await expect(page.getByTestId('pastille-jouer')).toHaveCount(0);

  // Léa joue sur son téléphone ; ici, l'app revient au premier plan.
  serveur.games[0].moves = 'ee';
  serveur.notifier(MOI, 'tour', PARTIE);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByTestId('pastille-jouer')).toBeVisible({ timeout: 5000 });
});

test('deux téléphones : Léa joue, la pastille arrive chez moi sans recharger ; ouvrir la partie l’éteint', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  semerPartie(serveur, false); // Léa (Noir) commence
  serveur.profiles.push({ id: LEA, username: 'Léa', rating: 1500, streak_days: 0, streak_last: null, streak_freezes: 0 });
  const moi = await ouvrir(browser, baseURL, serveur);
  const lea = await ouvrir(browser, baseURL, serveur, { compte: { email: 'lea@exemple.test', pseudo: 'Léa', id: LEA } });
  const erreurs: string[] = [];
  for (const p of [moi, lea]) p.on('pageerror', e => erreurs.push(e.message));
  await expect(moi.locator('.cta')).toBeVisible();
  await expect(moi.getByTestId('pastille-jouer')).toHaveCount(0);
  // Rien ne relit les défis chez moi pendant la suite (pas d'événement, la minuterie est d'une minute) : seul le
  // temps réel peut allumer la pastille.
  const lecturesAvant = serveur.appels.filter(a => a.startsWith('GET /rest/v1/defis')).length;

  // Léa ouvre la partie depuis son accueil et joue C3.
  await lea.getByTestId('tuile-defi').click();
  await expect(plateau(lea)).toBeVisible();
  await jouer(lea, 'C3');
  await expect(lea.getByText(/Au tour de ton ami/)).toBeVisible();

  // Chez moi, sans rechargement ni retour au premier plan : la pastille et la ligne nommée en moins de 5 s.
  await expect(moi.getByTestId('pastille-jouer')).toBeVisible({ timeout: 5000 });
  await expect(nav(moi).getByRole('button', { name: 'Jouer, C’est ton tour contre Léa' })).toBeVisible();
  await expect(moi.getByTestId('tuile-defi')).toContainText('Contre Léa');
  expect(serveur.appels.filter(a => a.startsWith('GET /rest/v1/defis')).length).toBeGreaterThan(lecturesAvant);
  // Le temps réel ne m'a envoyé que ma notification : celle de Léa (lue à l'ouverture) ne m'arrive pas.
  expect(serveur.notifications.filter(n => n.destinataire_id === MOI && n.lue_le === null)).toHaveLength(1);
  await capture(moi, 'deux-telephones-pastille-390-clair');

  // J'ouvre la partie : la notification est lue, la pastille s'éteint, même si c'est toujours à moi de jouer.
  await moi.getByTestId('tuile-defi').click();
  await expect(plateau(moi)).toBeVisible();
  await expect(moi.getByText(/À toi de jouer\. Il te reste/)).toBeVisible();
  await moi.getByRole('button', { name: 'Retour', exact: true }).click();
  await expect(moi.locator('.cta')).toBeVisible();
  await expect(moi.getByTestId('tuile-defi')).toContainText('Contre Léa');
  await expect(moi.getByTestId('pastille-jouer')).toHaveCount(0);
  expect(serveur.notifications.filter(n => n.lue_le === null)).toHaveLength(0);
  expect(erreurs).toEqual([]);
});

test('état vide : aucune pastille, rien d’inquiétant', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const page = await ouvrir(browser, baseURL, serveur, { stockage: { 'go.go-du-jour.v1': { dernier: numeroDuJour(), jours: 2 } } });
  await expect(page.locator('.cta')).toBeVisible();
  await expect(page.locator('.onglet-pastille')).toHaveCount(0);
  for (const nom of ['Jouer', 'Apprendre', 'Problèmes', 'Profil']) await expect(nav(page).getByRole('button', { name: nom, exact: true })).toBeVisible();
  await expect(page.getByTestId('tuile-defi')).toHaveCount(0);
  await expect(page.getByTestId('etat-du-jour')).toHaveText('Fait');
  await expect(page.locator('main')).not.toContainText(/perd|vite|dernière chance/i);
  await capture(page, 'accueil-vide-390-clair');
});

test.describe('captures', () => {
  test.skip(!CAPTURES, 'captures seulement avec CAPTURES_367');
  for (const [largeur, hauteur, sombre] of [[390, 844, true], [320, 568, false], [320, 568, true]] as const) {
    const suffixe = `${largeur}-${sombre ? 'sombre' : 'clair'}`;
    test(`accueil avec un ami qui attend en ${suffixe}`, async ({ browser, baseURL }) => {
      const serveur = fauxServeur();
      semerPartie(serveur);
      serveur.profiles.push({ id: LEA, username: 'Léa', rating: 1500, streak_days: 0, streak_last: null, streak_freezes: 0 });
      const page = await ouvrir(browser, baseURL, serveur, { largeur, hauteur, sombre, stockage: {
        'go.go-du-jour.v1': { dernier: numeroDuJour() - 1, jours: 4 }, 'go.lecons.v1': { l1: 99, l2: 2 },
      } });
      await expect(page.getByTestId('pastille-jouer')).toBeVisible();
      await expect(page.getByTestId('tuile-defi')).toContainText('Contre Léa');
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(largeur);
      await capture(page, `accueil-pastille-${suffixe}`);
    });
  }
});
