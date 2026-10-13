import { readFileSync } from 'node:fs';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { brancher, fauxServeur, type FauxServeur } from './fauxSupabase';

// Issue #530 (reprend #371) : « Mes données » (droit d'accès et portabilité), profils fermés aux visiteurs (D4),
// mentions légales. Supabase simulé (e2e/fauxSupabase.ts) : `exporter_mes_donnees` (plafond de 3), `mon_profil`, et
// la table `profiles` refusée à un visiteur sans session, comme la RLS de 20261013210100_profils_connectes.sql.

const MOI = '00000000-0000-4000-8000-0000000000a1';

async function telephone(browser: Browser, baseURL: string | undefined, serveur: FauxServeur, o: { compte?: boolean; sombre?: boolean; largeur?: number } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: o.largeur ?? 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'fr-FR', baseURL,
    colorScheme: o.sombre ? 'dark' : 'light', reducedMotion: 'reduce', acceptDownloads: true,
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }, { name: 'go.connait-go.v1', value: '"sait"' }] }] },
  });
  const stockage: Record<string, string> = { 'go.parties.v1': JSON.stringify({ n: 3 }), 'go.xp.v1': JSON.stringify({ total: 42 }) };
  if (o.compte) stockage['sb-supabase-auth-token'] = JSON.stringify(serveur.sessionCompte('moi@exemple.test', 'Florian', MOI));
  const page = await brancher(ctx, serveur, stockage);
  await page.goto('/');
  return { ctx, page };
}

async function ouvrirMesDonnees(page: Page) {
  await page.getByRole('navigation').getByRole('button', { name: 'Profil' }).click();
  await page.getByRole('button', { name: 'Conditions et confidentialité' }).click();
  await page.getByRole('button', { name: /^Mes données/ }).click();
  await expect(page.getByRole('heading', { name: 'Mes données' })).toBeVisible();
}

/** Clique « Télécharger mes données » et rend le fichier téléchargé, lu en JSON. */
async function telecharger(page: Page) {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Télécharger mes données' }).click()]);
  expect(dl.suggestedFilename()).toMatch(/^mochi-go-mes-donnees-\d{4}-\d{2}-\d{2}\.json$/);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return JSON.parse(readFileSync((await dl.path())!, 'utf8')) as Record<string, any>;
}

test('avec un compte : Profil › Conditions › Mes données, un fichier JSON du serveur et de l’appareil, plafond clair', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const { ctx, page } = await telephone(browser, baseURL, serveur, { compte: true });
  const erreurs: string[] = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await ouvrirMesDonnees(page);
  await expect(page.getByText(/Avec ton compte : ton profil, tes parties \(au format SGF\)/)).toBeVisible();
  // Une seule action en relief, de 44 px au moins.
  const action = page.getByRole('button', { name: 'Télécharger mes données' });
  await expect(page.locator('.sous-vue .btn.primary, .sous-vue .cta')).toHaveCount(1);
  expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44);

  const f = await telecharger(page);
  await expect(page.getByRole('status')).toContainText(/C’est fait : mochi-go-mes-donnees-.*\.json est dans tes téléchargements\./);
  expect(f.app).toBe('Mochi Go');
  expect(f.a_lire).toMatch(/serveur.*appareil/);
  expect(f.serveur.format).toBe('mochi-go.mes-donnees');
  expect(f.serveur.compte.email).toBe('moi@exemple.test');
  expect(f.serveur.profil.username).toBe('Florian');
  expect(f.appareil.stockage_local['go.xp.v1']).toEqual({ total: 42 });
  // Jamais la session de connexion ni l'adresse du serveur de test.
  const texte = JSON.stringify(f);
  expect(texte).not.toContain('access_token');
  expect(texte).not.toContain('sb-supabase-auth-token');
  expect(texte).not.toContain('e2e.supabase');
  // Le profil privé du joueur est relu par mon_profil (D4), jamais par un select * sur la table.
  expect(serveur.appels.some(a => a.startsWith('POST /rest/v1/rpc/exporter_mes_donnees'))).toBe(true);

  // Plafond du serveur : 3 par heure. Le 4e : message clair, pas de fichier.
  await telecharger(page);
  await telecharger(page);
  await page.getByRole('button', { name: 'Télécharger mes données' }).click();
  await expect(page.getByRole('status')).toHaveText('Tu as déjà téléchargé tes données 3 fois en une heure. Réessaie dans 42 min.');

  expect(erreurs).toEqual([]);
  await ctx.close();
});

test('sans compte : le fichier contient seulement l’appareil, sans appel au serveur (320 px, sombre)', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const { ctx, page } = await telephone(browser, baseURL, serveur, { sombre: true, largeur: 320 });
  await ouvrirMesDonnees(page);
  await expect(page.getByText('Sans compte, tout est sur ton appareil : le fichier contient ce qu’il garde.')).toBeVisible();
  const f = await telecharger(page);
  expect(f.serveur).toBeNull();
  expect(f.appareil.stockage_local['go.parties.v1']).toEqual({ n: 3 });
  expect(serveur.appels.filter(a => a.includes('exporter_mes_donnees'))).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await ctx.close();
});

test('mentions légales : dans l’app depuis Conditions, champs à compléter marqués, retour à la confidentialité', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const { ctx, page } = await telephone(browser, baseURL, serveur);
  await page.getByRole('navigation').getByRole('button', { name: 'Profil' }).click();
  await page.getByRole('button', { name: 'Conditions et confidentialité' }).click();
  const lien = page.getByRole('button', { name: 'Mentions légales' });
  expect((await lien.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await lien.click();
  await expect(page.getByRole('heading', { name: 'Mentions légales' })).toBeVisible();
  for (const titre of ['Éditeur', 'Directeur de la publication', 'Hébergeurs', 'Tes données']) await expect(page.getByRole('heading', { name: titre })).toBeVisible();
  await expect(page.getByText(/Supabase Inc\..*Paris/)).toBeVisible();
  // Rien d'inventé : chaque information de l'éditeur est un champ « À compléter », visible.
  const champs = page.locator('mark.a-completer');
  expect(await champs.count()).toBeGreaterThan(5);
  await expect(champs.first()).toContainText('À compléter');
  await page.getByRole('button', { name: 'Conditions et confidentialité' }).last().click();
  await expect(page.getByRole('switch', { name: /^Comptage anonyme des parties/ })).toBeVisible();
  await ctx.close();
});

test('mentions légales statiques : FR et EN, liées depuis le pied des pages de référencement', async ({ page }) => {
  await page.goto('/apprendre-le-go');
  await page.getByRole('contentinfo').getByRole('link', { name: 'Mentions légales' }).click();
  await expect(page).toHaveURL(/\/mentions-legales\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Mentions légales' })).toBeVisible();
  await expect(page.locator('mark.a-completer').first()).toContainText('À compléter');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  await expect(page.getByRole('link', { name: 'Conditions et confidentialité' })).toHaveAttribute('href', '/confidentialite');
  await page.getByRole('link', { name: 'English' }).click();
  await expect(page).toHaveURL(/\/en\/legal-notice\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Legal notice' })).toBeVisible();
  await expect(page.locator('mark.a-completer').first()).toContainText('To be completed');
});

test('D4 : sans compte, une partie partagée se lit toujours par son lien (pseudo compris), sans lire la table des profils', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  serveur.profiles.push({ id: MOI, username: 'Ana', rating: 800, streak_days: 12, streak_last: null, streak_freezes: 0 });
  const jeton = 'P001'.padEnd(32, 'x');
  serveur.partagees.push({ jeton, user_id: MOI, sgf: '(;GM[1]FF[4]CA[UTF-8]SZ[9]KM[6.5]RU[Japanese]RE[B+1.5];B[ee];W[cc];B[gc])', taille: 9, joueur: 1, adversaire: 'Pomme', coup: 2 });
  const { ctx, page } = await telephone(browser, baseURL, serveur);
  await page.goto(`/partie#${jeton}`);
  await expect(page.locator('.partagee-camps')).toHaveText(/Ana.*Pomme/);
  // Aucune lecture de la table des profils sans session : la fonction dédiée suffit (et la table est fermée à anon).
  expect(serveur.appels.filter(a => a.includes('/rest/v1/profiles'))).toEqual([]);
  await ctx.close();
});
