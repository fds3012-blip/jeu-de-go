import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { jouer, plateau } from './plateau';

// Issue #562 : étude avancée. Jouer un autre coup depuis une position passée crée une variante (la suite d'avant reste),
// on y navigue (flèches, puces, clavier), komi et règle se règlent, et le fichier SGF garde les variantes.

const nav = (page: Page, nom: string) => page.getByRole('navigation').getByRole('button', { name: nom }).click();
const consigne = (page: Page) => page.getByTestId('etude-consigne');

async function ouvrirEtude(page: Page) {
  await page.goto('/');
  await nav(page, 'Profil');
  await page.getByRole('button', { name: /^Mes parties/ }).click();
  await page.getByTestId('lien-etude').click();
  await expect(page.getByRole('heading', { name: 'Étudier une position' })).toBeVisible();
}

test('créer une variante, y naviguer, régler komi et règle, exporter le SGF avec ses variantes', async ({ page }) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ouvrirEtude(page);
  const goban = plateau(page);
  await jouer(page, 'C3');
  await page.getByRole('group', { name: 'Outil' }).getByRole('button', { name: 'Jouer' }).click();
  for (const l of ['D5', 'F4', 'E6']) await jouer(page, l);
  await expect(consigne(page)).toHaveText('Coup 3 sur 3.');

  // Flèches autour d'« Analyser », qui reste la seule action principale.
  await expect(page.locator('.cta')).toHaveCount(1);
  const prec = page.getByRole('button', { name: 'Coup précédent' });
  const suiv = page.getByRole('button', { name: 'Coup suivant' });
  for (const b of [prec, suiv]) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(suiv).toBeDisabled();
  await prec.click();
  await prec.click();
  await expect(consigne(page)).toHaveText('Coup 1 sur 3.');
  await expect(goban.locator('[data-pierre]')).toHaveCount(2);

  // Un autre coup au coup 2 : une variante, la suite F4 E6 reste.
  await jouer(page, 'G5');
  await expect(consigne(page)).toHaveText('Variante créée : une autre suite essayée depuis ce coup. La ligne principale est gardée.');
  const puces = page.getByRole('group', { name: 'Variantes au coup 2' });
  await expect(puces.getByRole('button')).toHaveText(['F4 · principale', 'G5']);
  await expect(puces.getByRole('button', { name: 'G5' })).toHaveAttribute('aria-pressed', 'true');
  for (const b of await puces.getByRole('button').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);

  // Retour sur la ligne principale par sa puce, puis la suite d'origine est toujours là.
  await puces.getByRole('button', { name: 'F4 · principale' }).click();
  await expect(consigne(page)).toHaveText('Coup 2 sur 3.');
  await suiv.click();
  await expect(consigne(page)).toHaveText('Coup 3 sur 3.');
  await expect(goban.locator('[data-point="E6"][data-pierre="noir"]')).toHaveCount(1);

  // Au clavier (hors du goban) : ← et →.
  await prec.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(consigne(page)).toHaveText('Coup 2 sur 3.');
  await puces.getByRole('button', { name: 'G5' }).click();
  await expect(consigne(page)).toHaveText('Variante, coup 2 sur 2.');
  await page.keyboard.press('ArrowLeft');
  await expect(consigne(page)).toHaveText('Coup 1 sur 2.');
  await page.keyboard.press('ArrowRight');
  await expect(consigne(page)).toHaveText('Variante, coup 2 sur 2.');
  await expect(goban.locator('[data-point="G5"][data-pierre="blanc"]')).toHaveCount(1);

  // Komi et règle : repliés, en secondaire.
  const reglages = page.getByTestId('etude-reglages');
  await reglages.getByText('Komi 6,5 · règle japonaise').click();
  await reglages.getByRole('button', { name: '7,5' }).click();
  await reglages.getByRole('button', { name: 'Chinoise' }).click();
  await expect(reglages.locator('summary')).toHaveText('Komi 7,5 · règle chinoise');
  await reglages.getByRole('button', { name: 'Komi : un demi-point de plus' }).click();
  await expect(reglages.locator('summary')).toHaveText('Komi 8 · règle chinoise');
  await reglages.getByRole('button', { name: 'Komi : un demi-point de moins' }).click();

  // Export : l'étude entière, variantes en parenthèses imbriquées, komi et règle.
  const [telechargement] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exporter en SGF' }).click()]);
  const sgf = readFileSync(await telechargement.path(), 'utf8');
  expect(sgf).toMatch(/^\(;GM\[1\]FF\[4\]CA\[UTF-8\]SZ\[9\]KM\[7\.5\]RU\[Chinese\]AB\[cg\]PL\[B\];B\[de\]\(;W\[ff\];B\[ed\]\)\(;W\[ge\]\)\)$/);
  await expect(page.getByText('Fichier SGF prêt, avec ses variantes.')).toBeVisible();

  // Promouvoir la variante, puis supprimer l'ancienne ligne devenue variante.
  await page.getByRole('button', { name: 'En faire la ligne principale' }).click();
  await expect(consigne(page)).toHaveText('C’est maintenant la ligne principale.');
  await expect(puces.getByRole('button')).toHaveText(['G5 · principale', 'F4']);
  await puces.getByRole('button', { name: 'F4' }).click();
  await page.getByRole('button', { name: 'Supprimer la variante' }).click();
  await expect(consigne(page)).toHaveText('Variante supprimée.');
  await expect(page.getByTestId('etude-variantes')).toHaveCount(0);

  // Gardée sur l'appareil, au même coup.
  await page.reload();
  await ouvrirEtude(page);
  await expect(consigne(page)).toHaveText('Coup 1 sur 2.');
  await page.getByRole('button', { name: 'Coup suivant' }).click();
  await expect(goban.locator('[data-point="G5"][data-pierre="blanc"]')).toHaveCount(1);
  const debord = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(debord).toBeLessThanOrEqual(0);
});
