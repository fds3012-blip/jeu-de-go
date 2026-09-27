import { expect, test, type Page } from '@playwright/test';
import { attendrePierre, jouer, plateau } from './plateau';

// Issue #77 : « Tes erreurs à rejouer ». Le localStorage est prérempli avec une erreur de partie (position avant
// le coup, Noir au trait, meilleur coup de KataGo E3 = index 6 * 9 + 4). On la rejoue : réussie, la section disparaît.

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

test('erreur à rejouer : la section apparaît, on résout, elle disparaît', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await preremplir(page);
  await ouvrirProblemes(page);

  const section = page.getByRole('heading', { name: /Tes erreurs à rejouer/ });
  await expect(section).toBeVisible();
  await expect(page.getByLabel('1 à rejouer')).toBeVisible();

  await page.getByRole('button', { name: 'Rejouer : Ta partie contre Pomme, coup 14' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText(/seul le coup de KataGo est accepté/)).toBeVisible();

  await jouer(page, 'E3');
  await expect(page.getByText('Bravo, c’est le coup de KataGo !')).toBeVisible();
  await attendrePierre(page, 'E3', 'noir');

  await page.getByRole('button', { name: 'Retour aux problèmes' }).first().click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(section).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Problèmes', level: 2 })).toBeVisible();

  // Après rechargement, elle ne revient pas.
  await page.reload();
  await page.getByRole('navigation').getByRole('button', { name: 'Problèmes' }).click();
  await expect(page.getByRole('heading', { name: 'Problèmes', level: 2 })).toBeVisible();
  await expect(section).toHaveCount(0);
});

test('erreur ratée : elle revient le lendemain', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await preremplir(page);
  await ouvrirProblemes(page);
  await page.getByRole('button', { name: 'Rejouer : Ta partie contre Pomme, coup 14' }).click();
  await jouer(page, 'A1');
  await expect(page.getByText('Pas celui-là. Cherche encore.')).toBeVisible();
  await page.getByRole('button', { name: 'Retour aux problèmes' }).first().click();
  await expect(page.getByRole('heading', { name: /Tes erreurs à rejouer/ })).toHaveCount(0);
  const gardees = await page.evaluate(() => JSON.parse(localStorage.getItem('go.erreurs.v1') ?? '[]'));
  expect(gardees).toHaveLength(1);
  expect(gardees[0].rates).toBe(1);
  const demain = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 1); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-'); });
  expect(gardees[0].prochain).toBe(demain);
});

// Captures (docs/design/v2/captures/erreurs-*.png) : `CAPTURES=1 npx playwright test e2e/erreurs.spec.ts`.
test('captures des erreurs à rejouer, sombre et clair', async ({ page }) => {
  test.skip(!process.env.CAPTURES, 'captures à la demande');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(e => localStorage.setItem('go.erreurs.v1', JSON.stringify([e, { ...e, id: 'erreur-2', coup: 22, adversaire: 'Bambou' }])), ERREUR);
  for (const theme of ['dark', 'light'] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    const nom = theme === 'dark' ? 'sombre' : 'clair';
    await ouvrirProblemes(page);
    const titre = page.getByRole('heading', { name: /Tes erreurs à rejouer/ });
    await titre.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -16));
    await page.screenshot({ path: `docs/design/v2/captures/erreurs-section-${nom}.png` });
    await page.getByRole('button', { name: 'Rejouer : Ta partie contre Pomme, coup 14' }).click();
    await expect(plateau(page)).toBeVisible();
    await page.screenshot({ path: `docs/design/v2/captures/erreurs-probleme-${nom}.png` });
  }
});
