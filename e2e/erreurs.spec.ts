import { expect, test, type Page } from '@playwright/test';
import { attendrePierre, jouer } from './plateau';

// Issue #77, #653 : « Rejouer tes erreurs ». Le localStorage est prérempli avec une erreur de partie (position avant
// le coup, Noir au trait, meilleur coup de KataGo E3 = index 6 * 9 + 4). On la rejoue dans la séance : réussie, le
// nombre disparaît de l'entrée du sommaire.

const ROWS = ['.........', '.........', '..O...X..', '.........', '....X....', '.........', '..X...O..', '.........', '.........'];
const ERREUR = {
  id: 'erreur-test', creeLe: '2026-01-01T10:00:00.000Z', prochain: '2026-01-01', rates: 0,
  size: 9, rows: ROWS, toPlay: 1, reponses: [6 * 9 + 4], joue: 0, coup: 14, adversaire: 'Pomme',
};

async function preremplir(page: Page) {
  await page.addInitScript(e => {
    if (!sessionStorage.getItem('erreurs-pretes')) { localStorage.setItem('go.erreurs.v1', JSON.stringify([e])); sessionStorage.setItem('erreurs-pretes', '1'); }
  }, ERREUR);
}

async function ouvrirProblemes(page: Page) {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Problèmes' }).click();
}

test('erreur à rejouer : l’entrée dit 1, la séance la rejoue, le nombre disparaît', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await preremplir(page);
  await ouvrirProblemes(page);

  // #653 : « Rejouer tes erreurs », entrée du sommaire ; le nombre d'erreurs dues aujourd'hui, en pastille.
  const entree = page.getByTestId('entree-erreurs');
  await expect(entree).toHaveAccessibleName('Rejouer tes erreurs, 1 à rejouer');
  await expect(entree.locator('.sommaire-etat')).toHaveText('1');
  await entree.click();
  await expect(page.getByRole('heading', { name: 'Ta partie contre Pomme, coup 14' })).toBeVisible();
  await expect(page.getByText(/seul le coup de KataGo est accepté/)).toBeVisible();

  await jouer(page, 'E3');
  await expect(page.getByText('Bravo, c’est le coup de KataGo !')).toBeVisible();
  await attendrePierre(page, 'E3', 'noir');
  await page.getByRole('button', { name: 'Voir mon bilan' }).click();
  await page.getByRole('button', { name: 'Terminer' }).click();

  await expect(page.getByTestId('problemes-sommaire')).toBeVisible();
  await expect(page.getByTestId('entree-erreurs')).toHaveAccessibleName('Rejouer tes erreurs');
  await expect(page.getByTestId('entree-erreurs').locator('.sommaire-etat')).toHaveCount(0);

  // Après rechargement, elle ne revient pas.
  await page.reload();
  await page.getByRole('navigation').getByRole('button', { name: 'Problèmes' }).click();
  await expect(page.getByTestId('entree-erreurs')).toHaveAccessibleName('Rejouer tes erreurs');
});

test('erreur ratée : elle revient le lendemain', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await preremplir(page);
  await ouvrirProblemes(page);
  await page.getByTestId('entree-erreurs').click();
  await jouer(page, 'A1');
  await expect(page.getByText('Pas celui-là. Cherche encore.')).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId('problemes-sommaire')).toBeVisible();
  const gardees = await page.evaluate(() => JSON.parse(localStorage.getItem('go.erreurs.v1') ?? '[]'));
  expect(gardees).toHaveLength(1);
  const demain = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 1); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-'); });
  expect(gardees[0].prochain).toBe(demain);
});
