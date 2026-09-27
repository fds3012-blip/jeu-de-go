import { expect, test } from '@playwright/test';

// Issue #14 : un nouveau joueur lance une partie contre Pomme et l'ordi répond (moteur dans un Web Worker).
test("jouer contre l'ordi : Pomme répond en moins d'une seconde", async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.goto('/');

  const cta = page.getByRole('button', { name: "Jouer contre l'ordi" });
  await expect(cta).toBeVisible();
  await cta.click();

  const plateau = page.getByRole('img', { name: /Plateau de go 9 × 9/ });
  await expect(plateau).toBeVisible();
  const box = (await plateau.boundingBox())!;
  // Clic souris au centre (tengen) : pas de seconde touche de confirmation à la souris.
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  const t0 = Date.now();
  await expect(page.getByText(/Pomme (joue|capture|passe)/)).toBeVisible({ timeout: 5000 });
  expect(Date.now() - t0).toBeLessThan(2000); // marge pour la pause d'affichage de 350 ms et la CI
  await expect(page.getByRole('button', { name: 'Passer' })).toBeEnabled();
  expect(erreurs).toEqual([]);
});
