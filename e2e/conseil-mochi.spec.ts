import { expect, test } from '@playwright/test';
import { jouer, plateau } from './plateau';

// Conseil de Mochi (#80) : partie → conseil → phrase dans la bulle (annoncée) et zone entourée sur le plateau.

test('partie contre Pomme : le conseil de Mochi montre une phrase et entoure la zone', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.goto('/');
  await page.locator('.cta').click();
  await expect(plateau(page)).toBeVisible();
  await jouer(page, 'E5');
  await expect(page.getByText(/Pomme (joue|capture|passe)/)).toBeVisible({ timeout: 10_000 });

  const bouton = page.getByRole('toolbar', { name: 'Actions de la partie' }).getByRole('button', { name: 'Conseil', exact: true });
  await expect(bouton).toBeEnabled();
  const boite = await bouton.boundingBox();
  expect(boite!.height).toBeGreaterThanOrEqual(44);
  expect(boite!.width).toBeGreaterThanOrEqual(44);
  // L'indice reste là : le conseil ne le remplace pas.
  await expect(page.getByRole('toolbar', { name: 'Actions de la partie' }).getByRole('button', { name: /^Indice/ })).toBeVisible();

  await bouton.click();
  // Deux pierres sur le 9 × 9 : il reste forcément un coin vide.
  const bulle = page.locator('.partie-mochi .coach p[aria-live="polite"]');
  await expect(bulle).toHaveText(/Un coin est encore libre\s*: les coins d.abord\./);
  const zone = plateau(page).locator('[data-conseil]');
  await expect(zone).toHaveCount(1);
  const points = (await zone.getAttribute('data-conseil'))!.split(' ');
  expect(points).toHaveLength(4);

  // Jouer dans la zone (vide, c'est un coin libre) efface le cadre.
  await jouer(page, points[0]);
  await expect(zone).toHaveCount(0);
  expect(erreurs).toEqual([]);
});
