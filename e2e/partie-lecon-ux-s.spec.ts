import { expect, test } from '@playwright/test';
import { boutonPasser, choisirMode, toucherCta } from './plateau';

// #U7 : avant la première pierre, une phrase (le geste), « Passer » comme les autres aides, pas de rang sous l'adversaire.
// #U11 : dans une leçon, la bulle de Mochi se pose en bas, au-dessus de l'action.

test('première partie : une phrase, « Passer » sans contour, pas de « 20 kyu » (#U7)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await toucherCta(page);
  const bulle = page.locator('.coach-intro');
  await expect(bulle).toHaveText('Touche un croisement pour poser ta pierre.');
  await expect(bulle).not.toContainText(/komi/i);
  await expect(page.locator('.annonce-komi')).toHaveCount(0);
  // « Passer » : pas de contour (comme Indice, Conseil, Qui mène ?), mais toujours 44 px et son libellé.
  const passer = boutonPasser(page);
  expect(await passer.evaluate(b => getComputedStyle(b).boxShadow)).toBe('none');
  expect((await passer.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(page.locator('.joueur[data-joueur="Pomme"]')).not.toContainText('kyu');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('après une première victoire, le rang revient sous l’adversaire (#U7)', async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('go.test.seme')) return;
    localStorage.setItem('go.test.seme', '1');
    localStorage.setItem('go.bilan.v1', JSON.stringify({ pomme: { v: 1, d: 0 } }));
    localStorage.setItem('go.adversaire.v1', JSON.stringify('pomme'));
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await choisirMode(page, 'ordi');
  await expect(page.locator('.joueur[data-joueur="Pomme"]')).toContainText('20 kyu');
});

test('leçon 1 : la bulle de Mochi est en bas, plateau en haut, sans défilement (#U11)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
  await page.getByRole('button', { name: 'Commencer' }).click();
  const zone = page.locator('.mochi-zone');
  await expect(zone).toBeVisible();
  const plateau = (await page.locator('.lecteur-plateau').boundingBox())!, m = (await zone.boundingBox())!;
  // Plateau en haut, bulle sous lui, dans le bas de l'écran (au-delà de 60 % de la hauteur), au-dessus de la zone de l'action.
  expect(m.y).toBeGreaterThanOrEqual(plateau.y + plateau.height);
  expect(m.y + m.height).toBeGreaterThan(844 * 0.6);
  expect(m.y + m.height).toBeLessThanOrEqual(844);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(844);
});
