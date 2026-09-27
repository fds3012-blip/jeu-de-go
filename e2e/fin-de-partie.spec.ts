import { expect, test } from '@playwright/test';
import { passerJusquAuScore } from './plateau';

// Issue #21 puis #117 : fin de partie contre Pomme. Après deux passes, les pierres mortes sont marquées
// automatiquement et on voit directement le récit du score, puis le résultat, sans rien toucher.
test('fin de partie contre Pomme : deux passes, récit du score direct, puis le résultat', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.goto('/');
  await page.locator('.cta').click();
  await expect(page.getByRole('img', { name: /Plateau de go 9 × 9/ })).toBeVisible();

  // Plateau vide : Noir passe, Pomme (qui mène grâce au komi) passe aussi. Rien d'incertain : pas de phase manuelle.
  await page.getByRole('button', { name: 'Passer' }).click();
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

test('« Corriger les pierres mortes » ouvre la phase manuelle, puis « Valider le score »', async ({ page }) => {
  await page.goto('/');
  await page.locator('.cta').click();
  await page.getByRole('button', { name: 'Passer' }).click();
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
