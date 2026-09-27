import { expect, test } from '@playwright/test';

// Issue #7 : première ouverture et navigation entre les onglets (viewport iPhone 390 × 844).

test("première ouverture : l'accueil s'affiche en moins de 3 secondes", async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));

  const t0 = Date.now();
  await page.goto('/');
  // L'action principale de l'accueil est visible et utilisable.
  const cta = page.getByRole('button', { name: "Jouer contre l'ordi" });
  await expect(cta).toBeVisible({ timeout: 3000 });
  await expect(cta).toBeInViewport();
  expect(Date.now() - t0).toBeLessThan(3000);

  await expect(page.getByRole('heading', { level: 1, name: 'Go' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Jouer à deux sur ce téléphone' })).toBeVisible();
  // Pas de défilement horizontal sur un écran de téléphone.
  const debord = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(debord).toBeLessThanOrEqual(0);
  expect(erreurs).toEqual([]);
});

test('navigation entre les onglets Jouer, Apprendre et Profil', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  const onglet = (nom: string) => nav.getByRole('button', { name: nom });

  await expect(nav.getByRole('button')).toHaveCount(3);
  await expect(onglet('Jouer')).toHaveAttribute('aria-current', 'page');

  await onglet('Apprendre').click();
  await expect(onglet('Apprendre')).toHaveAttribute('aria-current', 'page');
  await expect(onglet('Jouer')).not.toHaveAttribute('aria-current', 'page');
  await expect(page.getByText('Le chemin des leçons')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Leçon 1 :/ })).toBeVisible();

  await onglet('Profil').click();
  await expect(onglet('Profil')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { name: 'Réglages' })).toBeVisible();

  await onglet('Jouer').click();
  await expect(onglet('Jouer')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('button', { name: "Jouer contre l'ordi" })).toBeVisible();
});

test("l'onglet Jouer ramène à l'accueil depuis une partie en cours", async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Jouer à deux sur ce téléphone' }).click();
  await expect(page.getByRole('img', { name: /Plateau de go/ })).toBeVisible();

  await page.getByRole('navigation').getByRole('button', { name: 'Jouer' }).click();
  await expect(page.getByRole('img', { name: /Plateau de go/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: "Jouer contre l'ordi" })).toBeVisible();
});

test('les onglets sont des cibles tactiles de 44 px minimum', async ({ page }) => {
  await page.goto('/');
  for (const b of await page.getByRole('navigation').getByRole('button').all()) {
    const box = (await b.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
});
