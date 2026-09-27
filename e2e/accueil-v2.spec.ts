import { expect, test, type Page } from '@playwright/test';

// Issue #40, phase 4 : accueil v2 (goban d'accueil qui se touche) et carrousel des adversaires.

async function avecBilan(page: Page, bilan: object) {
  await page.addInitScript(b => { if (!sessionStorage.getItem('init')) { localStorage.setItem('go.bilan.v1', JSON.stringify(b)); sessionStorage.setItem('init', '1'); } }, bilan);
}

test("toucher le goban d'accueil lance la partie contre l'adversaire choisi", async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.goto('/');
  // Le goban d'accueil n'est pas un plateau de jeu pour les lecteurs d'écran (le bouton principal suffit).
  await expect(page.getByRole('img', { name: /Plateau de go/ })).toHaveCount(0);

  await page.getByTestId('plateau-accueil').tap();
  await expect(page.getByRole('img', { name: 'Plateau de go 9 × 9' })).toBeVisible();
  await expect(page.getByText(/Pomme a Blanc/)).toBeVisible();
  await expect(page.getByText(/Le but\s: entourer plus de territoire que Pomme/)).toBeVisible();
  expect(erreurs).toEqual([]);
});

test('le carrousel ne laisse pas choisir un adversaire verrouillé', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Changer' }).click();
  const feuille = page.getByRole('dialog', { name: 'Ton adversaire' });
  const carrousel = feuille.getByRole('list', { name: /Adversaires/ });
  await expect(carrousel.getByRole('button')).toHaveCount(9);

  // Nouveau joueur : Pomme et Caillou ouverts, les 7 autres visibles mais verrouillés.
  await expect(carrousel.getByRole('button', { name: /, verrouillé$/ })).toHaveCount(7);
  const bambou = carrousel.getByRole('button', { name: 'Bambou, 13 kyu, verrouillé' });
  await expect(bambou).toHaveAttribute('aria-disabled', 'true');
  await bambou.click({ force: true });
  await expect(feuille.getByText(/Bats d'abord Caillou/)).toBeVisible();
  await expect(bambou).toHaveAttribute('aria-pressed', 'false');
  await expect(carrousel.getByRole('button', { name: 'Pomme, 20 kyu' })).toHaveAttribute('aria-pressed', 'true');

  // Au clavier : flèche droite puis Entrée choisit Caillou.
  await carrousel.getByRole('button', { name: 'Pomme, 20 kyu' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(carrousel.getByRole('button', { name: 'Caillou, 16 kyu' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(carrousel.getByRole('button', { name: 'Caillou, 16 kyu' })).toHaveAttribute('aria-pressed', 'true');

  // Échap ferme la feuille ; l'accueil propose Caillou.
  await page.keyboard.press('Escape');
  await expect(feuille).toBeHidden();
  await expect(page.locator('.cta')).toHaveText('Joue ta première partie contre Caillou');
});

test('battre Caillou ouvre Bambou, et un choix verrouillé retombe sur l’adversaire à battre', async ({ page }) => {
  await avecBilan(page, { pomme: { v: 1, d: 0 }, caillou: { v: 1, d: 2 } });
  await page.addInitScript(() => localStorage.setItem('go.adversaire.v1', JSON.stringify('tigre')));
  await page.goto('/');
  // Tigre est verrouillé : l'accueil propose Bambou, le premier adversaire ouvert pas encore battu.
  await expect(page.getByRole('heading', { level: 2, name: 'Bambou' })).toBeVisible();
  await page.getByRole('button', { name: 'Changer' }).click();
  const carrousel = page.getByRole('list', { name: /Adversaires/ });
  await expect(carrousel.getByRole('button', { name: 'Caillou, 16 kyu, battu', exact: true })).toBeVisible();
  await expect(carrousel.getByRole('button', { name: 'Bambou, 13 kyu', exact: true })).toBeVisible();
  await carrousel.getByRole('button', { name: 'Renard, 10 kyu, verrouillé' }).click({ force: true });
  await expect(page.getByText(/Bats d'abord Bambou/)).toBeVisible();
});

test('pas de défilement horizontal à 390 px, carrousel ouvert compris', async ({ page }) => {
  await page.goto('/');
  const debord = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(await debord()).toBeLessThanOrEqual(0);
  await page.getByRole('button', { name: 'Changer' }).click();
  const carrousel = page.getByRole('list', { name: /Adversaires/ });
  await expect(carrousel).toBeVisible();
  expect(await debord()).toBeLessThanOrEqual(0);
  // Le carrousel, lui, défile horizontalement.
  const { scroll, largeur } = await carrousel.evaluate(el => ({ scroll: el.scrollWidth, largeur: el.clientWidth }));
  expect(scroll).toBeGreaterThan(largeur);
  expect(largeur).toBeLessThanOrEqual(390);
});

test('les tuiles mènent au problème du jour et à la leçon suivante', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Problème du jour/ }).click();
  await expect(page.getByRole('navigation').getByRole('button', { name: 'Problèmes' })).toHaveAttribute('aria-current', 'page');

  await page.getByRole('navigation').getByRole('button', { name: 'Jouer' }).click();
  await page.getByRole('button', { name: /^Leçon 1 sur 6/ }).click();
  await expect(page.getByRole('navigation').getByRole('button', { name: 'Apprendre' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('button', { name: '‹ Chemin des leçons' })).toBeVisible();
});
