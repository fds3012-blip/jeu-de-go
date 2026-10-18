import { expect, test, type Page } from '@playwright/test';

// #647 (décision F-P5) : sur téléphone, « Tous les problèmes » montre 3 vignettes par ligne (110 px à 390 px), lisibles,
// chacune une cible de 44 px au moins, sans défilement horizontal. Plus étroit (320 px, zoom 200 %) : moins de colonnes.

async function ouvrirTous(page: Page, largeur: number, hauteur = 844) {
  await page.setViewportSize({ width: largeur, height: hauteur });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Problèmes' }).click();
  await page.getByRole('button', { name: 'Tous les problèmes' }).click();
  await expect(page.getByRole('heading', { name: 'Tous les problèmes' })).toBeVisible();
}

/** Colonnes de la première grille (nombre de vignettes sur la première ligne) et leurs boîtes. */
async function mesurer(page: Page) {
  return page.locator('.grille-pb').first().evaluate(ul => {
    const boites = [...ul.querySelectorAll('button')].map(b => b.getBoundingClientRect());
    const haut = boites[0].top;
    return {
      colonnes: boites.filter(b => Math.abs(b.top - haut) < 2).length,
      largeur: boites[0].width,
      hauteurMin: Math.min(...boites.map(b => b.height)),
      titre: parseFloat(getComputedStyle(ul.querySelector('b')!).fontSize),
      debord: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
}

for (const sombre of [false, true]) {
  test(`390 px (${sombre ? 'sombre' : 'clair'}) : 3 vignettes par ligne, 44 px au moins, sans défilement horizontal`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: sombre ? 'dark' : 'light' });
    await ouvrirTous(page, 390);
    const m = await mesurer(page);
    expect(m.colonnes).toBe(3);
    expect(m.largeur).toBeGreaterThanOrEqual(100);
    expect(m.hauteurMin).toBeGreaterThanOrEqual(44);
    expect(m.titre).toBeGreaterThanOrEqual(14);
    expect(m.debord).toBeLessThanOrEqual(0);
  });
}

test('320 px : la grille repasse à 2 colonnes, vignettes lisibles', async ({ page }) => {
  await ouvrirTous(page, 320, 640);
  const m = await mesurer(page);
  expect(m.colonnes).toBe(2);
  expect(m.largeur).toBeGreaterThanOrEqual(100);
  expect(m.debord).toBeLessThanOrEqual(0);
});

test('zoom 200 % (195 px de large) : une colonne, rien ne déborde', async ({ page }) => {
  await ouvrirTous(page, 195, 422);
  const m = await mesurer(page);
  expect(m.colonnes).toBe(1);
  expect(m.hauteurMin).toBeGreaterThanOrEqual(44);
  expect(m.debord).toBeLessThanOrEqual(0);
});

test('dès 600 px, la grille large de #630 ne change pas (7rem)', async ({ page }) => {
  await ouvrirTous(page, 768, 1024);
  const m = await mesurer(page);
  expect(m.colonnes).toBeGreaterThanOrEqual(5);
});
