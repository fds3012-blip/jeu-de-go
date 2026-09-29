import { expect, test } from '@playwright/test';
import { lancerADeux } from './plateau';

// Perf et fiabilité de la PWA (29/09) : après une seule visite, l'app se rouvre sans réseau,
// avec ses écrans chargés à la demande (docs/qa/perf-2026-09-29.md).

test('après une visite, l\'app se rouvre hors ligne et tous ses écrans s\'ouvrent', async ({ page, context }) => {
  const erreurs: string[] = [];
  page.on('pageerror', e => erreurs.push(e.message));

  await page.goto('/');
  await expect(page.locator('.cta')).toBeVisible();
  // Service worker installé (sa liste de fichiers est en cache), activé et aux commandes de la page.
  // Il s'enregistre après l'accueil et ses polices (src/main.tsx) : on l'attend.
  await page.waitForFunction(async () => {
    const r = await navigator.serviceWorker.ready;
    return r.active?.state === 'activated' && !!navigator.serviceWorker.controller;
  }, null, { timeout: 20_000 });

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.cta')).toBeVisible();

  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  await nav.getByRole('button', { name: 'Apprendre' }).click();
  await expect(page.getByRole('button', { name: /^Leçon 1 :/ })).toBeVisible();
  await nav.getByRole('button', { name: 'Problèmes' }).click();
  await expect(page.getByRole('heading', { name: /^Go du jour n°\s\d+$/ })).toBeVisible();
  await nav.getByRole('button', { name: 'Profil' }).click();
  await expect(page.getByRole('heading', { name: 'Ton parcours' })).toBeVisible();
  await nav.getByRole('button', { name: 'Jouer' }).click();
  await lancerADeux(page);
  await expect(page.getByRole('grid', { name: /Plateau de go/ })).toBeVisible();

  expect(erreurs).toEqual([]);
});
