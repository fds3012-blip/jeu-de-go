import { expect, test, type Page } from '@playwright/test';

// Issue #167 : `?lang=en` traduit la barre du bas et le Profil, sans débordement à 390 et 320 px.

async function sansDebordement(page: Page) {
  const { largeur, fenetre, coupes } = await page.evaluate(() => ({
    largeur: document.documentElement.scrollWidth,
    fenetre: innerWidth,
    // Textes coupés : un libellé plus large que sa boîte (ellipse ou débordement masqué).
    coupes: [...document.querySelectorAll<HTMLElement>('.onglet-libelle, .ligne-libelle, .ligne-aide, .ligne-valeur, .seg button, .profil > h2')]
      .filter(e => e.offsetParent !== null && e.scrollWidth > e.clientWidth + 1)
      .map(e => e.textContent),
  }));
  expect(largeur).toBeLessThanOrEqual(fenetre);
  expect(coupes).toEqual([]);
}

for (const largeur of [390, 320]) {
  test(`?lang=en : barre du bas et Profil en anglais, sans débordement à ${largeur} px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 844 });
    await page.goto('/?lang=en');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    for (const nom of ['Play', 'Learn', 'Puzzles', 'Profile']) await expect(nav.getByRole('button', { name: nom })).toBeVisible();
    for (const b of await nav.getByRole('button').all()) {
      const boite = (await b.boundingBox())!;
      expect(boite.height).toBeGreaterThanOrEqual(44);
      expect(boite.x + boite.width).toBeLessThanOrEqual(largeur);
    }
    await sansDebordement(page);

    await nav.getByRole('button', { name: 'Profile' }).click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    const theme = page.getByRole('group', { name: 'Theme' });
    for (const nom of ['Dark', 'Light', 'Auto']) await expect(theme.getByRole('button', { name: nom })).toBeVisible();
    for (const nom of [/^Confirm moves/, /^Sounds$/, /^Celebrations/]) await expect(page.getByRole('switch', { name: nom })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Mochi’s help' }).getByRole('button', { name: 'Beginners' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^My account/ })).toContainText('Sign in');
    await expect(page.getByRole('button', { name: 'Terms and privacy' })).toBeVisible();
    await expect(page.getByText('Guest', { exact: true })).toBeVisible();
    await expect(page.getByText('Réglages')).toHaveCount(0);
    await expect(page.locator('header').getByText('Profile', { exact: true })).toBeVisible();
    await sansDebordement(page);
    await page.screenshot({ path: `docs/localisation/captures/profil-en-${largeur}.png` });
  });
}

test('sans paramètre, une interface française reste en français', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  await nav.getByRole('button', { name: 'Profil' }).click();
  await expect(page.getByRole('heading', { name: 'Réglages' })).toBeVisible();
  await expect(page.getByRole('switch', { name: /^Confirmer au doigt/ })).toBeVisible();
});

test.describe('appareil réglé en anglais', () => {
  test.use({ locale: 'en-US' });
  test('la langue de l\'appareil choisit l\'anglais', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Profile' })).toBeVisible();
  });
});
