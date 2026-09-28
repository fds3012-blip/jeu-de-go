import { expect, test, type Page } from '@playwright/test';
import { jouer, plateau } from './plateau';

// Audit web du 28/09, points 3 et 4 : annonces de la partie lues par le lecteur d'écran.
// Les zones existent dès l'ouverture et seul leur texte change.

async function partieContreOrdi(page: Page) {
  await page.goto('/');
  await page.locator('.cta').click();
  await expect(plateau(page)).toBeVisible();
}

const actions = (page: Page) => page.getByRole('toolbar', { name: 'Actions de la partie' });

test('« Abandonner » : le passage à « Confirmer ? » est annoncé, sans désarmement minuté', async ({ page }) => {
  await partieContreOrdi(page);
  const annonce = page.locator('[data-annonce="abandon"]');
  await expect(annonce).toHaveAttribute('aria-live', 'polite');
  await expect(annonce).toHaveText('');

  await actions(page).getByRole('button', { name: 'Abandonner' }).click();
  await expect(annonce).toHaveText(/^Abandonner : Confirmer\s\?$/);
  const confirmer = actions(page).getByRole('button', { name: /^Confirmer/ });
  await expect(confirmer).toBeVisible();

  // Plus de minuterie : 4 s plus tard, la confirmation est toujours là.
  await page.waitForTimeout(4_000);
  await expect(confirmer).toBeVisible();
  await expect(annonce).toHaveText(/^Abandonner : Confirmer\s\?$/);

  // Jouer un coup désarme, et l'annonce se vide.
  await jouer(page, 'E5');
  await expect(actions(page).getByRole('button', { name: 'Abandonner' })).toBeVisible();
  await expect(annonce).toHaveText('');
});

test('« Qui mène ? » : la phrase passe par une zone status permanente', async ({ page }) => {
  await partieContreOrdi(page);
  const statut = page.getByRole('status').and(page.locator('[data-annonce="qui-mene"]'));
  await expect(statut).toHaveCount(1);
  await expect(statut).toHaveText('');

  await jouer(page, 'E5');
  await expect(page.getByText(/Pomme (joue|capture|passe)/)).toBeVisible({ timeout: 10_000 });
  await actions(page).getByRole('button', { name: /Qui mène/ }).click();
  await expect(statut).toHaveText(/^(Noir|Blanc) mène d.environ \d+ points\.|C.est serré\.$/, { timeout: 10_000 });
  // La pastille visible reste, mais n'est plus une seconde annonce.
  await expect(page.locator('.qui-mene-phrase')).toHaveAttribute('aria-hidden', 'true');

  // Elle s'efface au bout de 3 s ; la zone reste en place, vide.
  await expect(page.locator('.qui-mene-phrase')).toHaveCount(0, { timeout: 5_000 });
  await expect(statut).toHaveCount(1);
  await expect(statut).toHaveText('');
});
