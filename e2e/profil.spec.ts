import { expect, test } from '@playwright/test';

// Issue #50 : Profil court, qui tient dans l'écran d'un iPhone sans défiler.
for (const theme of ['dark', 'light'] as const) {
  test(`Profil tient sans défiler en 390 × 844 (${theme === 'dark' ? 'sombre' : 'clair'})`, async ({ page }) => {
    await page.addInitScript(t => localStorage.setItem('go.settings.v1', JSON.stringify({ theme: t })), theme);
    await page.goto('/');
    await page.getByRole('navigation').getByRole('button', { name: 'Profil' }).click();
    await expect(page.getByRole('heading', { name: 'Réglages' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Mon compte/ })).toBeVisible();

    const { scroll, hauteur, largeur, fenetre } = await page.evaluate(() => ({
      scroll: document.documentElement.scrollHeight, hauteur: innerHeight, largeur: document.documentElement.scrollWidth, fenetre: innerWidth,
    }));
    expect(hauteur).toBe(844);
    expect(scroll).toBeLessThanOrEqual(hauteur);
    expect(largeur).toBeLessThanOrEqual(fenetre);

    // Dernier lien au-dessus de la barre de navigation.
    const lien = (await page.getByRole('button', { name: 'Conditions et confidentialité' }).boundingBox())!;
    const nav = (await page.getByRole('navigation').boundingBox())!;
    expect(lien.y + lien.height).toBeLessThanOrEqual(nav.y);
  });
}

test('réglages en lignes : thème segmenté, interrupteurs, cibles de 44 px', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Profil' }).click();
  const theme = page.getByRole('group', { name: 'Thème' });
  await theme.getByRole('button', { name: 'Clair' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await theme.getByRole('button', { name: 'Auto' }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme');

  for (const nom of [/^Confirmer au doigt/, /^Sons$/, /^Célébrations/]) {
    const s = page.getByRole('switch', { name: nom });
    await expect(s).toHaveAttribute('aria-checked', 'true');
    expect((await s.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  for (const b of await theme.getByRole('button').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);

  // « Mon compte » ouvre une sous-vue, Retour ramène au Profil.
  await page.getByRole('button', { name: /^Mon compte/ }).click();
  await expect(page.getByRole('heading', { name: 'Mon compte' })).toBeVisible();
  await page.getByRole('button', { name: 'Retour' }).click();
  await expect(page.getByRole('heading', { name: 'Réglages' })).toBeVisible();
});
