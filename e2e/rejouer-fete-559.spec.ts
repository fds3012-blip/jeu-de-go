import { expect, test } from '@playwright/test';
import { jouerSuite, partieADeux, passer, plateau } from './plateau';

// #559 : à deux sur le même téléphone, « Rejouer » (écran de fin) relance une partie sur le même écran. Avant, App.tsx
// gardait `partieFinie` à vrai : la partie suivante n'était plus un exercice, et la fête de niveau restait (ou arrivait)
// par-dessus le plateau. Maintenant, la nouvelle partie redevient un exercice dès « Rejouer » : la fête s'efface.

const COUPS = ['C3', 'G7', 'C4', 'G6', 'C5', 'G5', 'C6', 'G4', 'C7', 'G3', 'D3', 'F7'];

test('« Rejouer » après la fête de niveau : aucune fête ne reste sur le plateau de la partie suivante', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // 90 XP au départ : la première partie finie (+35 XP) fait passer le niveau 2, fêté sur l'écran de fin.
  await page.addInitScript(() => { if (localStorage.getItem('go.xp.v1') === null) localStorage.setItem('go.xp.v1', '90'); });
  await partieADeux(page);
  await jouerSuite(page, COUPS);
  await passer(page);
  await passer(page);
  await page.getByRole('button', { name: 'Valider le score' }).click();
  await expect(page.locator('.fin-titre')).toBeVisible({ timeout: 15_000 });
  const fete = page.getByTestId('fete-niveau');
  await expect(fete).toContainText(/Niveau\s2/, { timeout: 1500 });

  // « Rejouer » pendant la fête : le plateau revient, la fête part tout de suite et ne revient pas.
  await page.getByRole('button', { name: /^Rejouer/ }).first().click();
  await expect(plateau(page)).toBeVisible();
  await expect(fete).toHaveCount(0, { timeout: 500 });
  await page.waitForTimeout(1200);
  await expect(fete).toHaveCount(0);
  // Rien ne couvre le plateau : son centre reçoit bien le toucher.
  const libre = await plateau(page).evaluate(el => { const b = el.getBoundingClientRect(); const d = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return !!d && el.contains(d); });
  expect(libre).toBe(true);
});
