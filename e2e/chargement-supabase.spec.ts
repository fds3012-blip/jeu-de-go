import { expect, test, type Page } from '@playwright/test';
import { brancher, fauxServeur, JETON } from './fauxSupabase';

// #401 : supabase-js (`lib-donnees`, ≈ 57 Ko gzip) hors du JS initial. Premier lancement : il arrive après l'accueil.
// Lien de défi ou session sur l'appareil : il part tout de suite, le premier écran en dépend.
// Budget vérifié sur le build par scripts/budget-bundle.mjs ; imports gardés par src/data/client.test.ts.

/** Début du téléchargement de supabase-js et fin du chargement de la page, dans l'horloge de la page (ms). */
async function instants(page: Page): Promise<{ supabase: number; load: number }> {
  await expect.poll(() => page.evaluate(() => performance.getEntriesByType('resource').some(r => /\/assets\/lib-donnees-/.test(r.name))),
    { timeout: 15_000 }).toBe(true);
  return page.evaluate(() => ({
    supabase: performance.getEntriesByType('resource').find(r => /\/assets\/lib-donnees-/.test(r.name))!.startTime,
    load: (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming).loadEventEnd,
  }));
}

test('premier lancement : l’accueil s’affiche sans supabase-js, qui arrive après', async ({ browser, baseURL }) => {
  const ctx = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, locale: 'fr-FR' });
  // #487 : première pierre déjà posée (leçon commencée), sinon l'accueil n'a pas encore de tuiles.
  const page = await brancher(ctx, fauxServeur(), { 'go.consentement.v1': 'refuse', 'go.premiere-pierre.v1': 'true' });
  await page.goto('/');
  await expect(page.locator('main.app-home .cta').first()).toBeVisible();
  // « Défier un ami » ne l'attend pas : on sait sans lui que les comptes existent.
  await expect(page.getByTestId('mode-ami')).toBeVisible();
  const t = await instants(page);
  expect(t.load).toBeGreaterThan(0);
  expect(t.supabase).toBeGreaterThanOrEqual(t.load);
  await ctx.close();
});

test('lien de défi au premier chargement (#327, #338) : supabase-js part tout de suite, l’arrivée s’affiche', async ({ browser, baseURL }) => {
  const ctx = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, locale: 'fr-FR' });
  const page = await brancher(ctx, fauxServeur(), { 'go.consentement.v1': 'refuse' });
  await page.goto(`/#defi=${JETON}&de=Florian`);
  await expect(page.getByRole('heading', { name: 'Florian te défie !' })).toBeVisible();
  const t = await instants(page);
  expect(t.supabase).toBeLessThan(t.load);
  await ctx.close();
});

test('session enregistrée sur l’appareil : supabase-js part tout de suite', async ({ browser, baseURL }) => {
  const ctx = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, locale: 'fr-FR' });
  const serveur = fauxServeur();
  const page = await brancher(ctx, serveur, { 'go.consentement.v1': 'refuse', 'sb-supabase-auth-token': JSON.stringify(serveur.sessionAnonyme()) });
  await page.goto('/');
  await expect(page.locator('main.app-home .cta').first()).toBeVisible();
  const t = await instants(page);
  expect(t.supabase).toBeLessThan(t.load);
  await ctx.close();
});
