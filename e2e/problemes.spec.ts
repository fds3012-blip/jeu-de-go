import { expect, test } from '@playwright/test';
import { attendrePierre, jouer, plateau } from './plateau';

// Issue #11 : problèmes sans connexion (copie locale des problèmes de base).

test('problèmes sans compte : erreur, bonne réponse, suite et problème suivant', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Problèmes' }).click();

  await expect(page.getByRole('heading', { name: /^Go du jour n°\s\d+$/ })).toBeVisible();
  // Le Go du jour mis en scène, puis la grille des 6 problèmes de base.
  await expect(page.getByRole('button', { name: /^Problème \d : / })).toHaveCount(6);
  await expect(page.getByRole('button', { name: 'Résoudre le Go du jour' })).toBeVisible();
  const debord = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(debord).toBeLessThanOrEqual(0);

  // Problème 1 des bases : la pierre blanche D5 n'a plus qu'une liberté, en E5.
  await page.getByRole('button', { name: /^Problème 1 : Capture la pierre/ }).click();
  await expect(plateau(page)).toBeVisible();

  await jouer(page, 'A1');
  await expect(page.getByText('Pas tout à fait. Essaie encore.')).toBeVisible();
  await attendrePierre(page, 'A1', null);

  await jouer(page, 'E5');
  await expect(page.getByText('Bravo, c’est le bon coup !')).toBeVisible();
  await attendrePierre(page, 'E5', 'noir');
  await attendrePierre(page, 'D5', null);

  await page.getByRole('button', { name: 'Voir la suite' }).click();
  await expect(page.getByText(/Voilà la suite/)).toBeVisible();
  await attendrePierre(page, 'E5', 'noir');

  await page.getByRole('button', { name: 'Problème suivant' }).click();
  await expect(page.getByRole('heading', { name: 'Vers le bord' })).toBeVisible();

  // Le problème réussi reste coché après rechargement.
  await page.reload();
  await page.getByRole('navigation').getByRole('button', { name: 'Problèmes' }).click();
  await expect(page.getByRole('button', { name: 'Problème 1 : Capture la pierre, réussi' })).toBeVisible();
});
