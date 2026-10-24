import { expect, test, type Browser, type Page } from '@playwright/test';
import { brancher, fauxServeur, PARTIE, type FauxServeur } from './fauxSupabase';
import { plateau } from './plateau';

// Issue #699 : toucher la notification « à toi de jouer » (public/sw.js ouvre `/?tour=<partie>`) ouvre la bonne partie
// lente, puis l'adresse est nettoyée. Le clic lui-même sur la notification du système n'est pas pilotable par Playwright :
// on charge l'adresse qu'il ouvre. L'envoi (nuit, une par partie et par heure, réglage coupé) est testé en SQL
// (supabase/tests/a_toi_de_jouer.test.sql) et en Vitest (src/data/envoyerRappels.test.ts).
// Supabase simulé (e2e/fauxSupabase.ts).

const MOI = '00000000-0000-4000-8000-0000000000a1';
const LEA = '00000000-0000-4000-8000-0000000000b2';
const AUTRE_PARTIE = '00000000-0000-4000-8000-0000000000c3';
const H = 3_600_000;

/** Partie lente classée : Léa (Noir) a joué E5 et G7, j'ai joué C3 (Blanc). C'est à moi. */
function semerPartie(serveur: FauxServeur, id: string) {
  serveur.games.push({ id, white_id: MOI, black_id: LEA, created_by: LEA, size: 9, komi: 6.5, rules: 'japanese', handicap: 0,
    moves: 'eecggc', status: 'active', counting: false, dead_stones: null, dead_proposed_by: null, result: null, resumed_at: 0, prive: true, rated: true });
  serveur.defis.push({ partie_id: id, jeton: `lente-${id.slice(-4)}`.padEnd(32, 'L'), createur_id: LEA, invite_id: MOI, delai_coup: '1 day',
    date_limite: new Date(Date.now() + 20 * H).toISOString(), lien_expire_le: new Date(Date.now() + 7 * 864e5).toISOString(), cree_le: new Date().toISOString() });
}

async function ouvrir(browser: Browser, baseURL: string | undefined, serveur: FauxServeur, adresse: string, compte = true): Promise<Page> {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'fr-FR', baseURL, reducedMotion: 'reduce',
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }, { name: 'go.connait-go.v1', value: '"sait"' }] }] },
  });
  const stockage: Record<string, string> = { 'go.parties.v1': JSON.stringify({ n: 3 }) };
  if (compte) stockage['sb-supabase-auth-token'] = JSON.stringify(serveur.sessionCompte('moi@exemple.test', 'Florian', MOI));
  const page = await brancher(ctx, serveur, stockage);
  await page.goto(adresse);
  return page;
}

test('la notification touchée ouvre la bonne partie, et l’adresse est nettoyée', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  semerPartie(serveur, PARTIE);
  semerPartie(serveur, AUTRE_PARTIE); // une seconde partie lente : seule celle de la notification s'ouvre
  serveur.profiles.push({ id: LEA, username: 'Lea_du_go', rating: 1500, streak_days: 0, streak_last: null, streak_freezes: 0 });
  const page = await ouvrir(browser, baseURL, serveur, `/?tour=${AUTRE_PARTIE}`);
  const erreurs: string[] = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await expect(plateau(page)).toBeVisible();
  await expect(page.getByText(/À toi de jouer\. Il te reste/)).toBeVisible();
  await expect(page.locator('.joueur').first()).toContainText('Lea_du_go');
  await expect.poll(() => new URL(page.url()).search).toBe('');
  // La partie ouverte est celle de la notification.
  await expect.poll(() => serveur.appels.some(a => a.includes(AUTRE_PARTIE))).toBe(true);
  expect(erreurs).toEqual([]);
});

test('sans compte : l’accueil, sans erreur, et l’adresse est nettoyée', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  semerPartie(serveur, PARTIE);
  const page = await ouvrir(browser, baseURL, serveur, `/?tour=${PARTIE}`, false);
  const erreurs: string[] = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await expect(page.getByRole('navigation').getByRole('button', { name: 'Profil' })).toBeVisible();
  await expect(plateau(page)).toHaveCount(0);
  await expect.poll(() => new URL(page.url()).search).toBe('');
  expect(erreurs).toEqual([]);
});

test('identifiant illisible : ignoré, l’accueil s’ouvre', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  semerPartie(serveur, PARTIE);
  const page = await ouvrir(browser, baseURL, serveur, '/?tour=%2F%2Fevil.test');
  await expect(page.getByRole('navigation').getByRole('button', { name: 'Profil' })).toBeVisible();
  await expect(plateau(page)).toHaveCount(0);
});
