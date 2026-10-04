import { expect, test } from '@playwright/test';
import { attendreReponse, choisirMode, coupsJoues, jouer, passerJusquAuScore, plateau } from './plateau';

// Issue #79 : partie guidée contre Mochi, hors de l'échelle des adversaires. Mochi règle sa force tous les 10 coups
// (logique testée dans src/engine/guidee.test.ts). Ici : on lance la partie, on dépasse le 10e coup (premier réglage),
// on la termine, et le bilan des adversaires ne bouge pas.

test('partie guidée : lancée depuis l’accueil (#429), jouée au-delà du 10e coup, terminée sans toucher au bilan', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await page.goto('/');
  await choisirMode(page, 'guidee');
  await expect(plateau(page)).toBeVisible();
  await expect(page.getByText('Partie guidée : Mochi règle sa force pour que la partie reste serrée. Tu as Noir.')).toBeVisible();

  // Six coups de Noir, chacun suivi de la réponse de Mochi : 12 coups, le premier réglage de force a eu lieu.
  for (const p of ['E5', 'C3', 'G7', 'C7', 'G3', 'D4', 'F6', 'D6', 'F4', 'B5']) {
    if ((await coupsJoues(page).count()) >= 12) break;
    if (await plateau(page).locator(`g[data-pierre][data-point="${p}"]`).count()) continue;
    const avant = await coupsJoues(page).count();
    await jouer(page, p);
    expect(await attendreReponse(page, avant)).toBe(false);
  }
  expect(await coupsJoues(page).count()).toBeGreaterThanOrEqual(12);

  await passerJusquAuScore(page);
  await expect(page.locator('.fin-bilan')).toContainText('Partie guidée : elle ne compte pas dans ton bilan.');
  await expect(page.locator('.cta')).toHaveText('Rejouer contre Mochi');
  // Sans effet sur le bilan des adversaires ; le cran de Mochi est gardé pour la partie guidée suivante.
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('go.bilan.v1') || '{}'))).toEqual({});
  expect(await page.evaluate(() => localStorage.getItem('go.guidee.v1'))).toMatch(/^\d+$/);
  expect(erreurs).toEqual([]);
});

// Recette du soir du 28/09 (S1) : Mochi emprunte la force d'un adversaire de l'échelle (ici Pomme), pas son visage.
// Avant le correctif, le bandeau montrait Pomme sous le nom « Mochi », et l'écran de fin « BATTUE » sur Pomme.
test('partie guidée : le portrait est celui de Mochi, sans tampon « battue » à la fin', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?komi=-100');
  await choisirMode(page, 'guidee');
  await expect(plateau(page)).toBeVisible();
  await expect(page.locator('[data-portrait="pomme"]')).toHaveCount(0);
  await expect(page.locator('[data-portrait="mochi"]:not(.coach-portrait)').first()).toBeVisible();

  await jouer(page, 'E5');
  await expect(page.getByRole('toolbar').getByRole('button', { name: 'Passer', exact: true })).toBeEnabled({ timeout: 10_000 });
  await passerJusquAuScore(page);
  await expect(page.getByRole('heading', { level: 2, name: 'Victoire' })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-portrait="pomme"]')).toHaveCount(0);
  await expect(page.locator('[data-portrait="mochi"]:not(.coach-portrait)').first()).toBeVisible();
  await expect(page.getByText(/^BATTUE?$/)).toHaveCount(0);
});
