import { expect, test, type Browser, type Page } from '@playwright/test';
import { brancher, fauxServeur, type FauxServeur } from './fauxSupabase';

// Issue #448 : réglages synchronisés entre les appareils d'un même compte. Deux téléphones (deux contextes de
// navigateur), le même compte : un réglage changé sur A se retrouve sur B, et inversement. Supabase simulé par
// interception réseau (fauxSupabase.ts, `enregistrer_reglages`).

const ID = '00000000-0000-4000-8000-0000000004a8';

async function telephone(browser: Browser, baseURL: string | undefined, serveur: FauxServeur, session: unknown, stockage: Record<string, unknown> = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', baseURL, colorScheme: 'light',
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }] }] },
  });
  const brut = Object.fromEntries(Object.entries({ 'go.parties.v1': { n: 3 }, ...stockage }).map(([k, v]) => [k, JSON.stringify(v)]));
  const page = await brancher(ctx, serveur, { 'sb-supabase-auth-token': JSON.stringify(session), ...brut });
  await page.goto('/');
  return { ctx, page };
}

async function ouvrirReglages(page: Page) {
  await page.getByRole('navigation').getByRole('button', { name: 'Profil' }).click();
  await page.getByRole('button', { name: /^Réglages/ }).click();
  await expect(page.getByRole('heading', { name: 'Réglages' })).toBeVisible();
}

test('un réglage changé sur le téléphone A se retrouve sur le téléphone B (même compte), et inversement', async ({ browser, baseURL }) => {
  test.setTimeout(90_000);
  const serveur = fauxServeur();
  const session = serveur.sessionCompte('alice@exemple.test', 'Alice', ID);
  const erreurs: string[] = [];

  // Téléphone A : le joueur passe en thème sombre et retire les coordonnées.
  const a = await telephone(browser, baseURL, serveur, session);
  a.page.on('pageerror', e => erreurs.push(e.message));
  await ouvrirReglages(a.page);
  await a.page.getByRole('group', { name: 'Thème' }).getByRole('button', { name: 'Sombre' }).click();
  await expect(a.page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await a.page.getByRole('switch', { name: /^Coordonnées/ }).click();
  await expect(a.page.getByRole('switch', { name: /^Coordonnées/ })).toHaveAttribute('aria-checked', 'false');
  // Les deux changements partent ensemble, sans bloquer l'écran.
  await expect.poll(() => serveur.reglages.get(ID), { timeout: 10_000 }).toMatchObject({ theme: { v: 'dark' }, coordonnees: { v: false } });

  // Téléphone B : thème clair choisi avant la synchronisation (sans date). Le choix daté de A gagne.
  const b = await telephone(browser, baseURL, serveur, session, { 'go.settings.v1': { theme: 'light' } });
  b.page.on('pageerror', e => erreurs.push(e.message));
  await expect(b.page.locator('html')).toHaveAttribute('data-theme', 'dark', { timeout: 10_000 });
  await ouvrirReglages(b.page);
  await expect(b.page.getByRole('group', { name: 'Thème' }).getByRole('button', { name: 'Sombre' })).toHaveAttribute('aria-pressed', 'true');
  await expect(b.page.getByRole('switch', { name: /^Coordonnées/ })).toHaveAttribute('aria-checked', 'false');

  // Retour sur B : le joueur remet les coordonnées. A les retrouve à sa prochaine ouverture.
  await b.page.getByRole('switch', { name: /^Coordonnées/ }).click();
  await expect.poll(() => serveur.reglages.get(ID)?.coordonnees?.v, { timeout: 10_000 }).toBe(true);
  await a.page.reload();
  await ouvrirReglages(a.page);
  await expect(a.page.getByRole('switch', { name: /^Coordonnées/ })).toHaveAttribute('aria-checked', 'true', { timeout: 10_000 });
  await expect(a.page.locator('html')).toHaveAttribute('data-theme', 'dark');
  // Aucune donnée personnelle : seules des clés de la liste blanche sont parties.
  expect(Object.keys(serveur.reglages.get(ID) ?? {}).sort()).toEqual(['coordonnees', 'theme']);
  expect(erreurs).toEqual([]);
  await a.ctx.close();
  await b.ctx.close();
});

test('sans compte, rien ne part au serveur', async ({ page }) => {
  const serveur = fauxServeur();
  await brancher(page.context(), serveur, { 'go.parties.v1': JSON.stringify({ n: 3 }) });
  await page.goto('/');
  await ouvrirReglages(page);
  await page.getByRole('group', { name: 'Thème' }).getByRole('button', { name: 'Sombre' }).click();
  await page.waitForTimeout(2500);
  expect(serveur.appels.filter(x => x.includes('/rpc/enregistrer_reglages'))).toEqual([]);
});
