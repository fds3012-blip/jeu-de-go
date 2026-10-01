import { expect, test, type Page } from '@playwright/test';

// #325 : les textes anglais (interface, leçons, problèmes) sont un morceau JS à part, chargé seulement quand
// l'interface est en anglais. Un joueur en français ne le télécharge pas pour voir l'accueil.

/** Fichiers JS chargés par la page (hors service worker, qui met toute l'app en cache ensuite). */
const scripts = (page: Page) => page.evaluate(() => performance.getEntriesByType('resource').map(e => e.name).filter(n => n.endsWith('.js')));

test('en français : l’accueil s’affiche sans télécharger les textes anglais', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main.app-home .cta')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  expect((await scripts(page)).filter(n => n.includes('anglaisContenu'))).toEqual([]);
});

test('en anglais : les textes anglais arrivent avant le premier écran', async ({ page }) => {
  await page.goto('/?lang=en');
  await expect(page.getByRole('button', { name: 'Play your first game against Pomme' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  expect((await scripts(page)).some(n => n.includes('anglaisContenu'))).toBe(true);
});

test('textes anglais introuvables : l’app s’ouvre en français plutôt que sur un écran vide', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await page.route(/anglaisContenu-[^/]*\.js$/, r => r.abort());
  await page.goto('/?lang=en');
  await expect(page.getByRole('button', { name: 'Joue ta première partie contre Pomme' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  expect(erreurs).toEqual([]);
});
