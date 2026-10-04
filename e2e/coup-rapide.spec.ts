import { expect, test, type Browser, type Page } from '@playwright/test';
import { brancher, fauxServeur, JETON, PARTIE, type FauxServeur } from './fauxSupabase';
import { attendrePierre, choisirMode, jouer, plateau } from './plateau';

// Issue #425 : « le partage du coup est un peu lent ». Deux téléphones (deux contextes) sur le Supabase simulé
// (e2e/fauxSupabase.ts). Les relectures (partie, pendule) sont retardées de 8 s : un coup qui s'affiche en moins
// d'une seconde chez l'adversaire est donc arrivé par l'événement temps réel, sans interrogation régulière.
// Captures : CAPTURES_425=/tmp/captures-425 npx playwright test e2e/coup-rapide.spec.ts

const CAPTURES = process.env.CAPTURES_425;
const FLORIAN = '00000000-0000-4000-8000-0000000000f1';
const LEA = '00000000-0000-4000-8000-0000000000f2';
const LENTEUR = 8_000;
/** Délai visé : moins de 500 ms en vrai ; ici une marge pour la machine de test (rendu, deux navigateurs). */
const DELAI_MAX = 1_500;

async function telephone(browser: Browser, baseURL: string | undefined, serveur: FauxServeur, qui: { email: string; pseudo: string; id: string }): Promise<Page> {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'fr-FR', baseURL, reducedMotion: 'reduce',
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }] }] },
  });
  const page = await brancher(ctx, serveur, {
    'sb-supabase-auth-token': JSON.stringify(serveur.sessionCompte(qui.email, qui.pseudo, qui.id)), 'go.parties.v1': JSON.stringify({ n: 3 }),
  });
  await page.goto('/');
  return page;
}

/** Défi entre amis en cours : Léa (Noir) a joué E5 et G7, Florian (Blanc) C3. C'est à Florian. */
function semerDefi(serveur: FauxServeur) {
  serveur.games.push({ id: PARTIE, white_id: FLORIAN, black_id: LEA, created_by: FLORIAN, size: 9, komi: 6.5, rules: 'japanese', handicap: 0,
    moves: 'eecggc', status: 'active', counting: false, dead_stones: null, dead_proposed_by: null, result: null, resumed_at: 0, prive: true, rated: false });
  serveur.defis.push({ partie_id: PARTIE, jeton: JETON, createur_id: FLORIAN, invite_id: LEA, delai_coup: '3 days',
    date_limite: new Date(Date.now() + 50 * 3_600_000).toISOString(), lien_expire_le: new Date(Date.now() + 7 * 864e5).toISOString(), cree_le: new Date().toISOString() });
}

async function ouvrirDefi(page: Page, ami: string) {
  await page.getByRole('navigation').getByRole('button', { name: /^Jouer/ }).click();
  await page.getByTestId('mode-ami').click();
  await page.getByRole('button', { name: new RegExp(ami) }).first().click();
  await expect(plateau(page)).toBeVisible();
}

/** Mise en arrière-plan puis retour (iOS : l'app quittée pour Messages, puis rouverte). */
async function arrierePlan(page: Page, ms: number) {
  const visibilite = (etat: 'hidden' | 'visible') => page.evaluate(e => {
    Object.defineProperty(document, 'visibilityState', { value: e, configurable: true });
    Object.defineProperty(document, 'hidden', { value: e === 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }, etat);
  await visibilite('hidden');
  await page.waitForTimeout(ms);
  await visibilite('visible');
}

/** Temps entre le coup posé chez l'un et la pierre affichée chez l'autre. */
async function delaiAffichage(joueur: Page, adversaire: Page, coup: string, couleur: 'noir' | 'blanc'): Promise<number> {
  const debut = Date.now();
  await jouer(joueur, coup);
  await attendrePierre(adversaire, coup, couleur);
  return Date.now() - debut;
}

test('défi entre amis : le coup arrive chez l’ami par le temps réel, sans attendre une relecture', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  semerDefi(serveur);
  const florian = await telephone(browser, baseURL, serveur, { email: 'florian@exemple.test', pseudo: 'Florian', id: FLORIAN });
  const lea = await telephone(browser, baseURL, serveur, { email: 'lea@exemple.test', pseudo: 'Lea', id: LEA });
  const erreurs: string[] = [];
  for (const p of [florian, lea]) p.on('pageerror', e => erreurs.push(e.message));
  await ouvrirDefi(florian, 'Lea');
  await ouvrirDefi(lea, 'Florian');
  await expect(florian.getByText(/À toi de jouer\./)).toBeVisible();
  await expect.poll(() => serveur.canauxActifs('defi-')).toBe(2);

  serveur.ralentirLectures(LENTEUR);
  // Florian joue D4 : sa pierre est là tout de suite (affichage avant la réponse du serveur), et chez Léa par l'événement.
  const delai = await delaiAffichage(florian, lea, 'D4', 'blanc');
  expect(delai, `coup affiché chez Léa en ${delai} ms`).toBeLessThan(DELAI_MAX);
  await expect(lea.getByText(/À toi de jouer\./)).toBeVisible({ timeout: DELAI_MAX });
  expect(serveur.pousses.some(p => p.table === 'games' && p.id === PARTIE)).toBe(true);
  if (CAPTURES) await lea.screenshot({ path: `${CAPTURES}/defi-coup-recu.jpg`, type: 'jpeg', quality: 60 });

  // Léa répond F3 : même chose dans l'autre sens.
  const retour = await delaiAffichage(lea, florian, 'F3', 'noir');
  expect(retour, `coup affiché chez Florian en ${retour} ms`).toBeLessThan(DELAI_MAX);
  expect(serveur.games.find(g => g.id === PARTIE)?.moves).toBe('eecggcdffg');
  expect(erreurs).toEqual([]);
});

test('défi : connexion figée pendant la veille (iPhone), au retour l’abonnement est refait et les coups arrivent', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  semerDefi(serveur);
  const florian = await telephone(browser, baseURL, serveur, { email: 'florian@exemple.test', pseudo: 'Florian', id: FLORIAN });
  const lea = await telephone(browser, baseURL, serveur, { email: 'lea@exemple.test', pseudo: 'Lea', id: LEA });
  await ouvrirDefi(florian, 'Lea');
  await ouvrirDefi(lea, 'Florian');
  await expect.poll(() => serveur.canauxActifs('defi-')).toBe(2);

  // Léa passe dans une autre app : sa connexion temps réel meurt sans se fermer (celle de Florian aussi).
  serveur.figerTempsReel();
  expect(serveur.canauxActifs('defi-')).toBe(0);
  // Pendant ce temps, Florian joue D4.
  await jouer(florian, 'D4');
  await expect.poll(() => serveur.games.find(g => g.id === PARTIE)?.moves).toBe('eecggcdf');
  // Retour de Léa : le coup est relu tout de suite, sans attendre le battement de la bibliothèque (25 s).
  const debut = Date.now();
  await arrierePlan(lea, 1_200);
  await attendrePierre(lea, 'D4', 'blanc');
  expect(Date.now() - debut).toBeLessThan(1_200 + DELAI_MAX);
  // Puis l'abonnement est refait sur une nouvelle connexion (chien de garde de 3 s) : le coup suivant arrive par
  // l'événement, alors que les relectures sont lentes.
  await expect.poll(() => serveur.canauxActifs('defi-'), { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
  await arrierePlan(florian, 1_200);
  await expect.poll(() => serveur.canauxActifs('defi-'), { timeout: 10_000 }).toBe(2);
  serveur.ralentirLectures(LENTEUR);
  const delai = await delaiAffichage(lea, florian, 'F3', 'noir');
  expect(delai, `coup affiché chez Florian en ${delai} ms`).toBeLessThan(DELAI_MAX);
});

const ANA = '00000000-0000-4000-8000-0000000000c1';
const BOB = '00000000-0000-4000-8000-0000000000c2';

test('partie en direct : coup affiché par l’événement, pendule à jour, pas de boucle de relectures', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const id = '33333333-3333-4333-8333-000000000425';
  serveur.games.push({ id, black_id: ANA, white_id: BOB, created_by: BOB, bot_id: null, size: 9, komi: 6.5, rules: 'japanese', handicap: 0, moves: '',
    status: 'active', counting: false, dead_stones: null, dead_proposed_by: null, result: null, resumed_at: 0, prive: false, rated: true, updated_at: new Date().toISOString() });
  serveur.pendules.push({ partie_id: id, cadence: 'normale', main_ms: 600000, periodes: 3, periode_ms: 30000, noir_ms: 600000, blanc_ms: 600000,
    noir_periodes: 3, blanc_periodes: 3, trait_depuis: new Date().toISOString(), comptage_depuis: null, noir_vu_le: null, blanc_vu_le: null });
  const ana = await telephone(browser, baseURL, serveur, { email: 'ana@exemple.test', pseudo: 'Ana', id: ANA });
  const bob = await telephone(browser, baseURL, serveur, { email: 'bob@exemple.test', pseudo: 'Bob', id: BOB });
  const erreurs: string[] = [];
  for (const p of [ana, bob]) {
    p.on('pageerror', e => erreurs.push(e.message));
    await choisirMode(p, 'en_ligne');
    await expect(p.getByTestId('direct-partie')).toBeVisible();
  }
  await expect.poll(() => serveur.canauxActifs('direct-')).toBe(2);

  // Pas de boucle : chaque relecture de la pendule écrit la présence (un événement chez les deux joueurs), et cet
  // événement ne relance plus de relecture. En 4 s, seulement les battements (3 s et 10 s), pas des dizaines d'appels.
  const avant = serveur.appels.filter(a => a.includes('pendule_direct')).length;
  await ana.waitForTimeout(4_000);
  const pendant = serveur.appels.filter(a => a.includes('pendule_direct')).length - avant;
  expect(pendant, `${pendant} lectures de la pendule en 4 s`).toBeLessThanOrEqual(6);

  serveur.ralentirLectures(LENTEUR);
  const delai = await delaiAffichage(ana, bob, 'E5', 'noir');
  expect(delai, `coup affiché chez Bob en ${delai} ms`).toBeLessThan(DELAI_MAX);
  // La pendule de Bob tourne aussitôt, celle d'Ana est arrêtée : sans attendre la relecture (retardée de 8 s).
  await expect(bob.locator('.direct-pendule.tourne')).toHaveCount(1, { timeout: DELAI_MAX });
  await expect(bob.getByRole('timer', { name: /^Ton temps : (10:00|9:5\d)\.$/ })).toHaveClass(/tourne/, { timeout: DELAI_MAX });
  await expect(ana.getByRole('timer', { name: /^Ton temps/ })).not.toHaveClass(/tourne/);
  if (CAPTURES) await bob.screenshot({ path: `${CAPTURES}/direct-coup-recu.jpg`, type: 'jpeg', quality: 60 });

  const retour = await delaiAffichage(bob, ana, 'C3', 'blanc');
  expect(retour, `coup affiché chez Ana en ${retour} ms`).toBeLessThan(DELAI_MAX);
  expect(erreurs).toEqual([]);
});
