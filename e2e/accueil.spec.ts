import { expect, test } from '@playwright/test';

test("l'accueil s'affiche", async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));

  await page.goto('/');

  await expect(page).toHaveTitle(/Go/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('navigation')).toBeVisible();
  expect(erreurs).toEqual([]);
});

test('la PWA expose un manifeste valide', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();

  const res = await request.get(href!);
  expect(res.ok()).toBe(true);
  const manifest = await res.json();
  expect(manifest.display).toBe('standalone');
  const tailles = manifest.icons.map((i: { sizes: string }) => i.sizes);
  expect(tailles).toContain('192x192');
  expect(tailles).toContain('512x512');
});

test('le service worker prend le contrôle en production', async ({ page }) => {
  await page.goto('/');
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(scope).toMatch(/\/$/);
});
