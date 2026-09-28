import { expect, test } from '@playwright/test';
import { lancerADeux } from './plateau';

// Issue #7 : première ouverture et navigation entre les onglets (viewport iPhone 390 × 844).

test("première ouverture : l'accueil s'affiche en moins de 3 secondes", async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));

  const t0 = Date.now();
  await page.goto('/');
  // L'action principale de l'accueil est visible et utilisable.
  const cta = page.locator('.cta');
  await expect(cta).toBeVisible({ timeout: 3000 });
  await expect(cta).toBeInViewport();
  expect(Date.now() - t0).toBeLessThan(3000);

  await expect(page.getByRole('heading', { level: 1, name: 'Go' })).toBeVisible();
  // Les deux tuiles : problème du jour et leçon suivante.
  await expect(page.getByRole('button', { name: /^Go du jour n°\s\d+/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Leçon 1 sur 8/ })).toBeVisible();
  // Pas de défilement horizontal sur un écran de téléphone.
  const debord = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(debord).toBeLessThanOrEqual(0);
  expect(erreurs).toEqual([]);
});

test('navigation entre les onglets Jouer, Apprendre, Problèmes et Profil', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  const onglet = (nom: string) => nav.getByRole('button', { name: nom });

  await expect(nav.getByRole('button')).toHaveCount(4);
  await expect(onglet('Jouer')).toHaveAttribute('aria-current', 'page');

  await onglet('Apprendre').click();
  await expect(onglet('Apprendre')).toHaveAttribute('aria-current', 'page');
  await expect(onglet('Jouer')).not.toHaveAttribute('aria-current', 'page');
  await expect(page.getByText('Le chemin des leçons')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Leçon 1 :/ })).toBeVisible();

  await onglet('Problèmes').click();
  await expect(onglet('Problèmes')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { name: /^Go du jour n°\s\d+$/ })).toBeVisible();

  await onglet('Profil').click();
  await expect(onglet('Profil')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { name: 'Réglages' })).toBeVisible();

  await onglet('Jouer').click();
  await expect(onglet('Jouer')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.cta')).toBeVisible();
});

test("« ‹ » ramène à l'accueil depuis une partie en cours (la navigation est masquée en partie)", async ({ page }) => {
  await page.goto('/');
  await lancerADeux(page);
  await expect(page.getByRole('grid', { name: /Plateau de go/ })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toHaveCount(0);

  await page.getByRole('button', { name: "Retour à l'accueil" }).click();
  await expect(page.getByRole('grid', { name: /Plateau de go/ })).toHaveCount(0);
  await expect(page.locator('.cta')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button', { name: 'Jouer' })).toHaveAttribute('aria-current', 'page');
});

test('identité « deux pierres » (#51) : un seul onglet actif, icône de 28 px, pierre qui tombe', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  for (const nom of ['Jouer', 'Apprendre', 'Problèmes', 'Profil']) {
    await nav.getByRole('button', { name: nom }).click();
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(nav.getByRole('button', { name: nom })).toHaveAttribute('aria-current', 'page');
    const icone = nav.getByRole('button', { name: nom }).locator('svg.icone-nav');
    await expect(icone).toHaveClass(/active/);
    const box = (await icone.boundingBox())!;
    expect(Math.round(box.width)).toBe(28);
    // À l'activation, la pierre « tombe » (animation nav-pose), comme sur le goban.
    expect(await icone.locator('.pose').evaluate(e => getComputedStyle(e).animationName)).toBe('nav-pose');
  }
});

test('mouvements réduits : la pierre ne tombe pas dans l\'onglet activé', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  await nav.getByRole('button', { name: 'Apprendre' }).click();
  const pose = nav.getByRole('button', { name: 'Apprendre' }).locator('.pose');
  expect(await pose.evaluate(e => getComputedStyle(e).animationName)).toBe('none');
});

test('les onglets sont des cibles tactiles de 44 px minimum', async ({ page }) => {
  await page.goto('/');
  for (const b of await page.getByRole('navigation').getByRole('button').all()) {
    const box = (await b.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
});

// Régression de #145 : `contain: inline-size` réduisait les libellés des onglets à 0 px (icônes seules).
test('les quatre onglets affichent leur libellé en entier', async ({ page }) => {
  await page.goto('/');
  const libelles = page.locator('.onglet-libelle');
  await expect(libelles).toHaveCount(4);
  for (const l of await libelles.all()) {
    await expect(l).toBeVisible();
    const tronque = await l.evaluate(e => e.scrollWidth > e.clientWidth || e.clientWidth === 0);
    expect(tronque).toBe(false);
  }
});
