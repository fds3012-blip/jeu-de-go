import { expect, test } from '@playwright/test';

// Issue #21 : fin de partie contre Pomme. On passe jusqu'au comptage, l'ordi propose les pierres mortes,
// et on n'appuie que sur « Valider le score » pour voir le résultat.
test('fin de partie contre Pomme : valider le score affiche le résultat', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.goto('/');
  await page.locator('.cta').click();
  await expect(page.getByRole('img', { name: /Plateau de go 9 × 9/ })).toBeVisible();

  const passer = page.getByRole('button', { name: 'Passer' });
  const valider = page.getByRole('button', { name: 'Valider le score' });
  // Passe dès le début ; si Pomme joue au lieu de passer, on repasse.
  for (let i = 0; i < 4 && !(await valider.isVisible()); i++) {
    await expect(passer).toBeEnabled({ timeout: 10_000 });
    await passer.click();
    await expect(valider.or(page.getByText(/Pomme (joue|capture)/))).toBeVisible({ timeout: 10_000 });
  }
  await expect(valider).toBeVisible();
  await expect(page.getByText(/Aucune pierre prisonnière|Les pierres pâles sont prisonnières/)).toBeVisible({ timeout: 5000 });

  await valider.click();
  // Issue #40, phase 5 : titre, écart en points, plateau final avec ses territoires en fond.
  await expect(page.getByRole('heading', { level: 2, name: /^(Victoire|Défaite)$/ })).toBeVisible();
  await expect(page.locator('.fin-marge')).toContainText(/points? sur 9 × 9/);
  await expect(page.locator('.fin-fond').getByRole('img', { name: /Plateau de go 9 × 9/ })).toBeVisible();
  // Issue #22 : l'action principale dépend du résultat (défaite : rejouer ; victoire : adversaire suivant).
  await expect(page.locator('.cta')).toHaveText(/^(Rejouer contre Pomme|Défier Caillou)$/);
  expect(erreurs).toEqual([]);
});

test('victoire forcée (?komi=-100) : sceau de Pomme tamponné « BATTUE », « Défier Caillou » avec son sceau', async ({ page }) => {
  await page.goto('/?komi=-100');
  await page.locator('.cta').click();
  const passer = page.getByRole('button', { name: 'Passer' });
  const valider = page.getByRole('button', { name: 'Valider le score' });
  for (let i = 0; i < 6 && !(await valider.isVisible()); i++) {
    await expect(passer).toBeEnabled({ timeout: 10_000 });
    await passer.click();
    await expect(valider.or(page.getByText(/Pomme (joue|capture)/))).toBeVisible({ timeout: 10_000 });
  }
  await expect(valider).toBeEnabled({ timeout: 10_000 });
  await valider.click();
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
