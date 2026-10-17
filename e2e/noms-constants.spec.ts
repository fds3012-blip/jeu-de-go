import { expect, test } from '@playwright/test';
import { brancher, fauxServeur } from './fauxSupabase';

// #604 (lot N7, règle A9) : un même libellé mène toujours au même écran. « Créer mon compte » de Problèmes ouvre
// l'écran « Crée ton compte » (il ouvrait le menu du Profil), et « ‹ » ramène à Problèmes.
test('Problèmes › « Créer mon compte » ouvre l’écran de compte, puis « ‹ » ramène à Problèmes', async ({ browser, baseURL }) => {
  const ctx = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, locale: 'fr-FR', isMobile: true, hasTouch: true });
  const page = await brancher(ctx, fauxServeur(), { 'go.consentement.v1': 'refuse', 'go.connait-go.v1': '"sait"' });
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  await nav.getByRole('button', { name: 'Problèmes' }).click();
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  const ecran = page.getByTestId('creer-compte');
  await expect(ecran).toBeVisible();
  await expect(ecran).toHaveAttribute('data-raison', 'serie');
  await expect(ecran).toContainText('garder ta série');
  await expect(page).toHaveTitle('Ton compte · Mochi Go');
  await page.getByRole('button', { name: 'Retour', exact: true }).click();
  await expect(ecran).toHaveCount(0);
  await expect(nav.getByRole('button', { name: 'Problèmes' })).toHaveAttribute('aria-current', 'page');
  await ctx.close();
});
