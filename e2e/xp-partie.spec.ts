import { expect, test } from '@playwright/test';
import { jouerSuite, partieADeux, passer } from './plateau';

// Issue #233, P4 : l'XP d'une partie est acquise dès que le résultat est connu.
// Quitter pendant le récit du score (ici : recharger l'app) ne la fait plus perdre.
test("quitter pendant le récit du score : l'XP de la partie est acquise", async ({ page }) => {
  await partieADeux(page);
  await jouerSuite(page, ['C3', 'G7', 'C4', 'G6', 'C5', 'G5', 'C6', 'G4', 'C7', 'G3', 'D3', 'F7']);
  await passer(page);
  await passer(page);
  await page.getByRole('button', { name: 'Valider le score' }).click();
  await expect(page.locator('.recit')).toBeVisible();
  // Pendant le récit, rien n'est encore affiché : « +15 XP » ne dévoile pas le résultat.
  await expect(page.getByTestId('pastille-xp')).toHaveCount(0);
  expect(await page.evaluate(() => Number(localStorage.getItem('go.xp.v1') ?? 0))).toBe(0);

  await page.reload();
  expect(await page.evaluate(() => Number(localStorage.getItem('go.xp.v1') ?? 0))).toBeGreaterThanOrEqual(15);
});
