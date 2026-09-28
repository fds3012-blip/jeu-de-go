import { expect, test, type Page } from '@playwright/test';
import { fromLabel } from '../src/go/coords';
import { attendrePierre } from './plateau';

// Issue #116 (suite) : un problème et la leçon 1 se jouent entièrement au clavier.

const grille = (page: Page) => page.getByRole('grid', { name: 'Plateau de go 9 × 9' });
const annonce = (page: Page) => page.locator('[data-annonce-plateau]');

/** Tabule jusqu'au plateau (un seul arrêt de tabulation). */
async function tabulerVersPlateau(page: Page): Promise<void> {
  for (let i = 0; i < 30 && !(await grille(page).evaluate(el => el === document.activeElement)); i++) await page.keyboard.press('Tab');
  await expect(grille(page)).toBeFocused();
}

/** Amène le curseur sur `label` aux flèches, puis pose la pierre (deux appuis : « Confirmer au doigt » est actif par défaut). */
async function poser(page: Page, label: string, verbe = 'poser'): Promise<void> {
  const curseur = grille(page).locator('[data-curseur]');
  const depart = fromLabel((await curseur.getAttribute('data-curseur'))!, 9), cible = fromLabel(label, 9);
  const dx = (cible % 9) - (depart % 9), dy = Math.floor(cible / 9) - Math.floor(depart / 9);
  for (let i = 0; i < Math.abs(dx); i++) await page.keyboard.press(dx > 0 ? 'ArrowRight' : 'ArrowLeft');
  for (let i = 0; i < Math.abs(dy); i++) await page.keyboard.press(dy > 0 ? 'ArrowDown' : 'ArrowUp');
  await expect(curseur).toHaveAttribute('data-curseur', label);
  await page.keyboard.press('Enter');
  await expect(annonce(page)).toHaveText(`${label} : appuie encore pour ${verbe}`);
  await page.keyboard.press('Enter');
}

/** Active un bouton au clavier : focus puis Entrée. */
async function appuyer(page: Page, nom: string | RegExp): Promise<void> {
  const b = page.getByRole('button', { name: nom, exact: typeof nom === 'string' });
  await b.focus();
  await page.keyboard.press('Enter');
}

test('problème « Capture la pierre » résolu au clavier', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Problèmes' }).focus();
  await page.keyboard.press('Enter');
  await appuyer(page, 'Tous les problèmes');
  await appuyer(page, /^Problème \d+ : Capture la pierre/);

  await tabulerVersPlateau(page);
  await poser(page, 'A1');
  await expect(page.getByText('Pas tout à fait. Essaie encore.')).toBeVisible();
  await attendrePierre(page, 'A1', null);

  await tabulerVersPlateau(page);
  await poser(page, 'E5');
  await expect(page.getByText('Bravo, c’est le bon coup !')).toBeVisible();
  await attendrePierre(page, 'D5', null);
  await expect(annonce(page)).toHaveText('Noir joue E5 et prend 1 pierre');
});

test('leçon du ko : la question « touche le point » se répond au clavier', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('go.lecons.v1', JSON.stringify({ l1: 6, l2: 6, l3: 8, l4: 4 })));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).focus();
  await page.keyboard.press('Enter');
  await appuyer(page, 'Continuer : Le ko');
  await expect(page.getByText('Touche le point où Blanc ne peut pas reprendre.')).toBeVisible();

  await tabulerVersPlateau(page);
  await poser(page, 'D4', 'choisir ce point');
  await expect(page.getByText(/Essaie encore\./)).toBeVisible();
  await appuyer(page, 'Réessayer');
  await tabulerVersPlateau(page);
  await poser(page, 'E5', 'choisir ce point');
  await expect(page.getByText(/^Oui, E5/)).toBeVisible();
});

test('leçon 1 jouée au clavier, jusqu’à « Leçon terminée »', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).focus();
  await page.keyboard.press('Enter');
  await appuyer(page, 'Commencer');

  const progression = page.getByRole('progressbar', { name: 'Progression de la leçon' });
  for (let i = 1; i <= 3; i++) {
    await appuyer(page, 'Continuer');
    await expect(progression).toHaveAttribute('aria-valuenow', String(i));
  }

  // Étape « Joue sur la dernière liberté » : E5, au clavier.
  await tabulerVersPlateau(page);
  await poser(page, 'E5');
  await expect(page.getByText(/^Capturée/)).toBeVisible();
  await expect(annonce(page)).toHaveText('Noir joue E5 et prend 1 pierre');
  await appuyer(page, 'Continuer');
  await appuyer(page, 'Continuer');

  // Groupe de deux pierres : E4.
  await tabulerVersPlateau(page);
  await poser(page, 'E4');
  await expect(annonce(page)).toHaveText('Noir joue E4 et prend 2 pierres');
  await appuyer(page, 'Terminer la leçon');
  await expect(page.getByRole('heading', { name: 'Leçon terminée' })).toBeVisible();
});
