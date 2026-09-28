import { expect, test } from '@playwright/test';
import { attendreReponse, coupsJoues, jouer, passerJusquAuScore, plateau } from './plateau';

// Issue #79 : partie guidée contre Mochi, hors de l'échelle des adversaires. Mochi règle sa force tous les 10 coups
// (logique testée dans src/engine/guidee.test.ts). Ici : on lance la partie, on dépasse le 10e coup (premier réglage),
// on la termine, et le bilan des adversaires ne bouge pas.

test('partie guidée : lancée depuis « Changer », jouée au-delà du 10e coup, terminée sans toucher au bilan', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Changer' }).click();
  await page.getByRole('dialog', { name: 'Ton adversaire' }).getByRole('button', { name: 'Partie guidée contre Mochi' }).click();
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
