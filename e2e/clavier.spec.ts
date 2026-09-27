import { expect, test, type Page } from '@playwright/test';
import { fromLabel, toLabel } from '../src/go/coords';
import { attendrePierre, pierres } from './plateau';

// Issue #116 : une partie contre Pomme jouée uniquement au clavier, annonces du lecteur d'écran comprises.

const grille = (page: Page) => page.getByRole('grid', { name: 'Plateau de go 9 × 9' });
const annonce = (page: Page) => page.locator('[data-annonce-plateau]');

/** Amène le curseur sur `label` aux flèches, en partant de sa position affichée (data-curseur). */
async function allerA(page: Page, label: string): Promise<void> {
  const curseur = grille(page).locator('[data-curseur]');
  const depart = fromLabel((await curseur.getAttribute('data-curseur'))!, 9), cible = fromLabel(label, 9);
  const dx = (cible % 9) - (depart % 9), dy = Math.floor(cible / 9) - Math.floor(depart / 9);
  for (let i = 0; i < Math.abs(dx); i++) await page.keyboard.press(dx > 0 ? 'ArrowRight' : 'ArrowLeft');
  for (let i = 0; i < Math.abs(dy); i++) await page.keyboard.press(dy > 0 ? 'ArrowDown' : 'ArrowUp');
  await expect(curseur).toHaveAttribute('data-curseur', label);
}

/** Choisit une intersection vide parmi des candidates. */
async function libre(page: Page, candidats: string[]): Promise<string> {
  for (const l of candidats) {
    if ((await grille(page).locator(`g[data-point="${l}"][data-pierre]`).count()) === 0) return l;
  }
  throw new Error('Aucune intersection libre');
}

test('partie contre Pomme jouée entièrement au clavier', async ({ page }) => {
  await page.goto('/');
  const cta = page.locator('.cta');
  await expect(cta).toHaveAccessibleName(/contre Pomme$/);
  await cta.focus();
  await page.keyboard.press('Enter');

  // Un seul arrêt de tabulation mène au plateau.
  await expect(grille(page)).toBeVisible();
  for (let i = 0; i < 20 && !(await grille(page).evaluate(el => el === document.activeElement)); i++) await page.keyboard.press('Tab');
  await expect(grille(page)).toBeFocused();

  // Le curseur jade part du centre, et la cellule active porte un nom lu.
  await expect(grille(page).locator('[data-curseur]')).toHaveAttribute('data-curseur', 'E5');
  const actif = await grille(page).getAttribute('aria-activedescendant');
  await expect(page.locator(`[id="${actif}"]`)).toHaveAttribute('aria-label', 'E5, vide');

  // Home, End, PageUp, PageDown vont aux bords.
  await page.keyboard.press('Home');
  await expect(grille(page).locator('[data-curseur]')).toHaveAttribute('data-curseur', 'A5');
  await page.keyboard.press('PageUp');
  await expect(grille(page).locator('[data-curseur]')).toHaveAttribute('data-curseur', 'A9');
  await page.keyboard.press('End');
  await page.keyboard.press('PageDown');
  await expect(grille(page).locator('[data-curseur]')).toHaveAttribute('data-curseur', 'J1');

  const coups = [['C3', 'C4', 'D3'], ['G7', 'G6', 'F7'], ['C7', 'D7', 'C6'], ['G3', 'F3', 'G4']];
  for (let n = 0; n < coups.length; n++) {
    const l = await libre(page, coups[n]);
    await allerA(page, l);
    // « Confirmer au doigt » est actif par défaut : le premier Entrée montre la pierre fantôme, le second la pose.
    await page.keyboard.press('Enter');
    await expect(grille(page).locator('g[data-fantome]')).toHaveCount(1);
    await expect(annonce(page)).toHaveText(`${l} : appuie encore pour poser`);
    await page.keyboard.press(n % 2 ? ' ' : 'Enter');
    await attendrePierre(page, l, 'noir');
    await expect(pierres(page, 'noir')).toHaveCount(n + 1);
    // Pomme répond, et la région polie annonce son coup.
    await expect(pierres(page, 'blanc')).toHaveCount(n + 1, { timeout: 10_000 });
    await expect(annonce(page)).toHaveText(/^Pomme joue [A-J][1-9]/);
    const reponse = (await annonce(page).textContent())!.match(/joue ([A-J][1-9])/)![1];
    expect(toLabel(fromLabel(reponse, 9), 9)).toBe(reponse);
    await expect(grille(page)).toBeFocused();
  }
});
