import { expect, test, type Page } from '@playwright/test';
import { encoderPng } from '../src/go/photo/pngNode';
import { synthetiser } from '../src/go/photo/synthese';

// #655 : « Compter une photo ». Une photo synthétique (goban en bois, perspective, éclairage inégal) est déposée dans le
// champ fichier ; le parcours va jusqu'au score expliqué, en règle japonaise puis chinoise.
// CAPTURES=dossier : captures 390 × 844 de chaque étape, en sombre.
const CAPTURES = process.env.CAPTURES;

// Mur noir en colonne D, mur blanc en colonne E, un point neutre (dame) en E1. Score connu :
// japonais, komi 6,5 : Noir 27, Blanc 35 + 6,5 = 41,5 (Blanc + 14,5) ; chinois, komi 7,5 : Noir 27 + 9 = 36,
// Blanc 35 + 9 + 7,5 = 51,5 (Blanc + 15,5).
const POSITION = [
  '...XO....', '...XO....', '...XO....', '...XO....', '...XO....', '...XO....', '...XO....', '...XO....', '...X.O...',
];

function photo(): Buffer {
  const plateau = Int8Array.from(POSITION.join(''), c => (c === 'X' ? 1 : c === 'O' ? 2 : 0));
  const s = synthetiser({ graine: 655, taille: 9, plateau, largeur: 800, hauteur: 600, inclinaison: 0.6, eclairage: 0.7, debord: 0.1, teinte: 0.4 });
  return encoderPng(s.image);
}

async function capture(page: Page, nom: string) {
  if (CAPTURES) await page.screenshot({ path: `${CAPTURES}/photo-score-${nom}.png` });
}

test('Compter une photo : de la photo au score expliqué, en japonais puis en chinois', async ({ page }) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Profil' }).click();
  // #655 : une ligne du sommaire du Profil, dans « Tes parties et tes amis », juste après « Mes parties ».
  const entree = page.getByTestId('rubrique-social').getByRole('button', { name: 'Compter une photo' });
  await expect(page.getByTestId('rubrique-social').locator('.sommaire-entree').nth(1)).toHaveAttribute('data-entree', 'photo');
  await entree.click();

  // Étape 1 : la permission est expliquée avant le bouton qui la demande.
  await expect(page.getByRole('heading', { name: 'Compter une photo' })).toBeVisible();
  await expect(page.getByText(/La photo reste sur ton téléphone/)).toBeVisible();
  await expect(page.getByTestId('photo-camera')).toHaveAttribute('capture', 'environment');
  await capture(page, '1-photo');
  await page.getByTestId('photo-galerie').setInputFiles({ name: 'goban.png', mimeType: 'image/png', buffer: photo() });

  // Étape 2 : coins posés (proposés), taille 19 par défaut ; on choisit 9 × 9. Un coin bouge au clavier.
  const lire = page.getByRole('button', { name: 'Lire les pierres' });
  await expect(lire).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: '19 × 19' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '9 × 9' }).click();
  const coin = page.getByRole('button', { name: 'Coin en haut à gauche' });
  const avant = await coin.getAttribute('style');
  await coin.focus();
  await page.keyboard.press('ArrowRight');
  await expect(coin).not.toHaveAttribute('style', avant ?? '');
  await page.keyboard.press('ArrowLeft');
  const cible = await coin.boundingBox();
  expect(cible!.width).toBeGreaterThanOrEqual(44);
  await capture(page, '2-coins');
  await lire.click();

  // Étape 3 : pierres lues, à corriger d'un toucher.
  const justes = page.getByRole('button', { name: 'Les pierres sont justes' });
  await expect(justes).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('ps-incertaines')).toBeVisible();
  await capture(page, '3-pierres');
  await justes.click();

  // Étape 4 : pierres mortes proposées par Mochi (ici, aucune), jamais présentées comme sûres.
  await expect(page.getByTestId('ps-mortes')).not.toContainText('cherche', { timeout: 15_000 });
  await capture(page, '4-mortes');
  await page.getByRole('button', { name: 'Choisir la règle' }).click();

  // Étape 5 : règle japonaise et komi 6,5 par défaut ; prisonniers à saisir.
  await expect(page.getByRole('button', { name: 'Japonaise' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText(/Le komi, ce sont des points donnés à Blanc/)).toBeVisible();
  await expect(page.locator('output.ps-valeur')).toHaveText('6,5');
  await capture(page, '5-regle');
  await page.getByRole('button', { name: 'Voir le score' }).click();

  // Étape 6 : score expliqué terme par terme.
  await expect(page.getByTestId('ps-resultat')).toHaveText(/Blanc gagne de 14,5\s?points/);
  const detail = page.getByRole('table', { name: 'Détail du score' });
  await expect(detail.getByRole('row', { name: /Territoire/ })).toContainText('27');
  await expect(detail.getByRole('row', { name: /Territoire/ })).toContainText('35');
  await expect(detail.getByRole('row', { name: /Komi/ })).toContainText('6,5');
  await expect(page.getByText(/1 point neutre \(dame\)/)).toBeVisible();
  await capture(page, '6-score-japonais');

  // Règle chinoise : komi 7,5 par défaut, pierres au lieu des prisonniers.
  await page.getByRole('button', { name: 'Changer la règle' }).click();
  await page.getByRole('button', { name: 'Chinoise' }).click();
  await expect(page.locator('output.ps-valeur')).toHaveText('7,5');
  await expect(page.getByText('Prisonniers', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Voir le score' }).click();
  await expect(page.getByTestId('ps-resultat')).toHaveText(/Blanc gagne de 15,5\s?points/);
  await expect(detail.getByRole('row', { name: /Pierres/ })).toContainText('9');
  await capture(page, '7-score-chinois');

  // « ‹ » remonte d'une étape à la fois, puis ramène au Profil.
  for (let i = 0; i < 6; i++) await page.locator('.retour').first().click();
  await expect(page.getByRole('heading', { name: 'Profil', exact: true })).toBeVisible();
  await expect(entree).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('Compter une photo : japonais, les prisonniers saisis comptent', async ({ page }) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Profil' }).click();
  await page.getByRole('button', { name: 'Compter une photo' }).click();
  await page.getByTestId('photo-galerie').setInputFiles({ name: 'goban.png', mimeType: 'image/png', buffer: photo() });
  await page.getByRole('button', { name: '9 × 9' }).click();
  await page.getByRole('button', { name: 'Lire les pierres' }).click();
  await page.getByRole('button', { name: 'Les pierres sont justes' }).click({ timeout: 20_000 });
  await expect(page.getByTestId('ps-mortes')).not.toContainText('cherche', { timeout: 15_000 });
  await page.getByRole('button', { name: 'Choisir la règle' }).click();
  // 20 prisonniers pris par Noir : Noir 27 + 20 = 47, Blanc 41,5 : Noir gagne de 5,5 points.
  await page.getByRole('spinbutton', { name: 'Pris par Noir' }).fill('20');
  await page.getByRole('button', { name: 'Voir le score' }).click();
  await expect(page.getByTestId('ps-resultat')).toHaveText(/Noir gagne de 5,5\s?points/);
});
