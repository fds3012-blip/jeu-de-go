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
  await expect(page.getByText(/gagne|Tu gagnes/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rejouer' })).toBeVisible();
  expect(erreurs).toEqual([]);
});
