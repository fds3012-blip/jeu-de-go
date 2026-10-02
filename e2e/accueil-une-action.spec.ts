import { expect, test } from '@playwright/test';

// Issue #119 : accueil à une seule action principale (compris en 3 secondes, modèle chess.com).
// Le bouton est la seule action ; le goban est une illustration entière (9 lignes visibles), sans bulle par-dessus.
for (const theme of ['dark', 'light'] as const) {
  test(`une seule action principale, plateau entier visible (${theme})`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.goto('/');

    await expect(page.locator('.cta')).toHaveCount(1);
    await expect(page.locator('.cta')).toBeVisible();
    // Plus de pierre qui pulse ni de texte « touche le plateau » : rien ne pousse vers une seconde action.
    await expect(page.locator('.fantome')).toHaveCount(0);
    await expect(page.getByText(/touche (le centre|le plateau)/i)).toHaveCount(0);

    await page.screenshot({ path: `docs/design/v2/captures/accueil-une-action-${theme}.png` });

    // Le plateau n'est ni masqué ni recouvert : il est entier dans sa zone.
    const g = await page.evaluate(() => {
      const zone = document.querySelector('.scene-plateau')!.getBoundingClientRect();
      const svg = document.querySelector('.scene-plateau svg')!.getBoundingClientRect();
      const bulle = document.querySelector('.scene-bulle')!.getBoundingClientRect();
      const cta = document.querySelector('.cta')!.getBoundingClientRect();
      const nav = document.querySelector('nav')!.getBoundingClientRect();
      return { zoneHaut: zone.top, zoneBas: zone.bottom, svgHaut: svg.top, svgBas: svg.bottom, bulleHaut: bulle.top, bulleBas: bulle.bottom, ctaBas: cta.bottom, navHaut: nav.top, ctaH: cta.height,
        large: document.documentElement.scrollWidth, vue: window.innerWidth };
    });
    // Recadrage toléré : la marge du bois et la bande des coordonnées (moins d'une demi-case de chaque côté).
    // Les 9 lignes, elles, restent entières.
    const demiCase = (g.svgBas - g.svgHaut) / 20;
    expect(g.svgHaut).toBeGreaterThanOrEqual(g.zoneHaut - demiCase);
    expect(g.svgBas).toBeLessThanOrEqual(g.zoneBas + demiCase);
    // Accueil v3 : au premier lancement, la promesse de Mochi est au-dessus du goban ; elle ne le recouvre jamais.
    expect(g.bulleBas <= g.zoneHaut || g.bulleHaut >= g.zoneBas).toBe(true);
    // Le bouton principal est au-dessus de la barre de navigation, sans défiler, et fait au moins 44 px.
    expect(g.ctaBas).toBeLessThanOrEqual(g.navHaut);
    expect(g.ctaH).toBeGreaterThanOrEqual(44);
    expect(g.large).toBeLessThanOrEqual(g.vue);

  });
}

test('le goban reste touchable : il lance la même partie que le bouton', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('plateau-accueil').tap();
  await expect(page.getByText(/Le but\s: entourer plus de territoire que Pomme/)).toBeVisible();
});
