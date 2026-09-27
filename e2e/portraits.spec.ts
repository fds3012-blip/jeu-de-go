import { test, expect } from '@playwright/test';

// Issue #102 : captures 390 × 844 de l'accueil et du choix de l'adversaire, en sombre et en clair.
for (const theme of ['dark', 'light'] as const) {
  test(`choix de l'adversaire illustré (${theme})`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    // Pomme battue : Bambou s'ouvre, les suivants restent verrouillés.
    await page.addInitScript(() => localStorage.setItem('go.bilan.v1', JSON.stringify({ pomme: { v: 1, d: 0 }, caillou: { v: 1, d: 1 } })));
    await page.goto('/');
    await expect(page.locator('.adversaire [data-portrait]')).toBeVisible();
    await page.screenshot({ path: `docs/design/v2/captures/accueil-portrait-${theme}.png` });
    await page.getByRole('button', { name: 'Changer' }).click();
    await expect(page.locator('.choix-vedette [data-portrait]')).toBeVisible();
    await page.screenshot({ path: `docs/design/v2/captures/adversaires-${theme}.png` });
  });

  test(`en-tête de partie : portrait de l'adversaire et Mochi (${theme})`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    // Bulle « but du jeu » déjà vue : la barre du coach est affichée tout de suite.
    await page.addInitScript(() => localStorage.setItem('go.intro-but.v1', 'true'));
    await page.goto('/');
    await page.getByRole('button', { name: /contre Pomme$/ }).first().click();
    const portrait = page.locator('.joueur [data-portrait="pomme"]');
    await expect(portrait).toHaveAttribute('data-humeur', 'neutre');
    await expect(page.locator('.coach [data-portrait="mochi"]')).toBeVisible();
    await page.screenshot({ path: `docs/design/v2/captures/partie-portrait-${theme}.png` });
  });
}
