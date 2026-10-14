import { expect, test } from '@playwright/test';
import { jouerSuite, partieADeux, passer } from './plateau';

// Issue #544 : le niveau gagné grâce à l'XP d'une partie finie est fêté sur l'écran de fin, tout de suite, une fois.
// Avant, la carte attendait les 2,4 s de la pastille flottante (que l'écran de fin n'affiche pas, l'XP y est à sa
// place) : « Rejouer » touché entre-temps la renvoyait à la fin de la partie suivante.
test('fin de partie : le niveau gagné est fêté tout de suite, une seule fois (#544)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // 90 XP au départ : une première partie finie (15 + 20 de bonus première fois) fait passer le niveau 2 (100 XP).
  await page.addInitScript(() => { if (localStorage.getItem('go.xp.v1') === null) localStorage.setItem('go.xp.v1', '90'); });
  await partieADeux(page);
  await jouerSuite(page, ['C3', 'G7', 'C4', 'G6', 'C5', 'G5', 'C6', 'G4', 'C7', 'G3', 'D3', 'F7']);
  await passer(page);
  await passer(page);
  await page.getByRole('button', { name: 'Valider le score' }).click();
  await expect(page.locator('.fin-titre')).toBeVisible({ timeout: 15_000 });
  // L'XP se lit à sa place sous le résultat, et la fête arrive aussitôt (bien avant les 2,4 s d'avant).
  await expect(page.locator('.fin-xp').getByTestId('pastille-xp')).toContainText(/\+35\sXP/);
  const fete = page.getByTestId('fete-niveau');
  await expect(fete).toContainText(/Niveau\s2/, { timeout: 1500 });
  await expect(fete).toHaveCount(1);
  await expect(page.locator('.annonce-xp [data-testid="pastille-xp"]')).toHaveCount(0);
  // L'XP reste à sa place pendant la fête, et la fête se referme seule sans revenir.
  await expect(page.locator('.fin-xp').getByTestId('pastille-xp')).toBeVisible();
  await expect(fete).toHaveCount(0, { timeout: 6000 });
  await page.waitForTimeout(1500);
  await expect(fete).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('go.xp.v1'))).toBe('125');

  // Partie suivante : pas de « Niveau 2 ! » resservi à sa fin.
  await page.getByRole('button', { name: /^Rejouer/ }).first().click();
  await jouerSuite(page, ['C3', 'G7', 'C4', 'G6', 'C5', 'G5', 'C6', 'G4', 'C7', 'G3', 'D3', 'F7']);
  await passer(page);
  await passer(page);
  await page.getByRole('button', { name: 'Valider le score' }).click();
  await expect(page.locator('.fin-xp').getByTestId('pastille-xp')).toContainText(/\+15\sXP/, { timeout: 15_000 });
  await page.waitForTimeout(1500);
  await expect(fete).toHaveCount(0);
});
