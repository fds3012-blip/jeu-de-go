import { expect, test } from '@playwright/test';
import { passer, passerJusquAuScore } from './plateau';

// Issue #21 puis #117 : fin de partie contre Pomme. Après deux passes, les pierres mortes sont marquées
// automatiquement et on voit directement le récit du score, puis le résultat, sans rien toucher.
test('fin de partie contre Pomme : deux passes, récit du score direct, puis le résultat', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.goto('/');
  await page.locator('.cta').click();
  await expect(page.locator('svg.board[aria-label="Plateau de go 9 × 9"]')).toBeVisible();

  // Plateau vide : Noir passe, Pomme (qui mène grâce au komi) passe aussi. Rien d'incertain : pas de phase manuelle.
  await passer(page);
  await expect(page.locator('.recit')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Valider le score' })).toHaveCount(0);
  const corriger = page.getByRole('button', { name: 'Corriger les pierres mortes' });
  await expect(corriger).toBeVisible();
  const box = (await corriger.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);

  // Issue #40, phase 5 : titre, écart en points, plateau final avec ses territoires en fond.
  await expect(page.getByRole('heading', { level: 2, name: /^(Victoire|Défaite)$/ })).toBeVisible({ timeout: 6000 });
  await expect(page.locator('.fin-marge')).toContainText(/points? sur 9 × 9/);
  await expect(page.locator('.fin-fond').getByRole('img', { name: /Plateau de go 9 × 9/ })).toBeVisible();
  // Issue #22 : l'action principale dépend du résultat (défaite : rejouer ; victoire : adversaire suivant).
  await expect(page.locator('.cta')).toHaveText(/^(Rejouer contre Pomme|Défier Caillou)$/);
  expect(erreurs).toEqual([]);
});

// Issue #251 (recette du 28/09, M4) : passer sur un plateau presque vide, c'est perdre au komi.
// Mochi l'explique et invite à jouer plus longtemps, au lieu de « Perdu de peu ».
test('passes sur un plateau vide : Mochi explique le komi, pas « perdu de peu »', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); // écart affiché tout de suite, sans décompte
  await page.goto('/');
  await page.locator('.cta').click();
  await expect(page.locator('svg.board[aria-label="Plateau de go 9 × 9"]')).toBeVisible();
  await passer(page);
  await expect(page.getByRole('heading', { level: 2, name: 'Défaite' })).toBeVisible({ timeout: 15_000 });
  const mochi = page.getByText(/Le plateau était presque vide\s:\sBlanc gagne grâce au komi, les points donnés à Blanc parce que Noir joue en premier\. Joue plus longtemps pour entourer du territoire\./);
  await expect(mochi).toBeVisible();
  await expect(page.locator('.fin-marge')).toContainText(/0,5\spoint sur 9 × 9/);
  await expect(page.getByText(/Perdu de peu/)).toHaveCount(0);
  // Une seule action principale : rejouer. La leçon sur le territoire reste un lien discret.
  await expect(page.locator('.cta')).toHaveText('Rejouer contre Pomme');
  await expect(page.getByRole('button', { name: 'Ouvrir la leçon' })).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
  await page.screenshot({ path: 'docs/qa/captures/recette-matin/m4-apres-komi-explique-clair-390.png' });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  await page.screenshot({ path: 'docs/qa/captures/recette-matin/m4-apres-komi-explique-sombre-390.png' });
});

test('« Corriger les pierres mortes » ouvre la phase manuelle, puis « Valider le score »', async ({ page }) => {
  await page.goto('/');
  await page.locator('.cta').click();
  await passer(page);
  await page.getByRole('button', { name: 'Corriger les pierres mortes' }).click({ timeout: 10_000 });
  await expect(page.locator('.recit')).toHaveCount(0);
  await expect(page.getByText(/Les pierres grisées sont mortes/)).toBeVisible();
  await page.getByRole('button', { name: 'Valider le score' }).click();
  await expect(page.getByRole('heading', { level: 2, name: /^(Victoire|Défaite)$/ })).toBeVisible({ timeout: 6000 });
});

test('victoire forcée (?komi=-100) : sceau de Pomme tamponné « BATTUE », « Défier Caillou » avec son sceau', async ({ page }) => {
  await page.goto('/?komi=-100');
  await page.locator('.cta').click();
  await passerJusquAuScore(page);
  await expect(page.getByRole('heading', { level: 2, name: 'Victoire' })).toBeVisible();
  await expect(page.locator('.fin-sceau .fin-tampon')).toHaveText('BATTUE');
  // Issue #102 : le portrait de Pomme, surprise d'avoir perdu.
  await expect(page.locator('.fin-sceau [data-portrait="pomme"]')).toHaveAttribute('data-humeur', 'surpris');
  const cta = page.getByRole('button', { name: 'Défier Caillou' });
  await expect(cta).toBeVisible();
  await expect(cta.locator('.sceau')).toHaveCount(1);
  // Le bouton est dans l'écran, sans défilement.
  const box = (await cta.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(844);
});
