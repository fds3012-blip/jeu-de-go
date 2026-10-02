import { expect, test, type Page } from '@playwright/test';
import { barreActions, jouer, ouvrirPlus, passerJusquAuScore, plateau } from './plateau';

// Écran de partie v3 (branche partie-ecran-v3) : barre d'actions à trois aides, « Passer » et menu « Plus » ;
// Mochi sous ton bandeau ; récit du score lisible en 320 × 568. Captures contre Pomme, conseil de Mochi affiché,
// menu ouvert et récit : `CAPTURE_DIR=docs/design/captures/partie-ecran-v3 npx playwright test partie-v3`.
// #381 : captures en JPEG qualité 80 et densité 2 (moins de 3 Mo pour toute la série), seulement celles qui servent.

const DOSSIER = process.env.CAPTURE_DIR ?? '';
const TAILLES = [[390, 844], [320, 568]] as const;
const THEMES = ['dark', 'light'] as const;
test.use({ deviceScaleFactor: 2 });

/** Capture JPEG qualité 80 dans CAPTURE_DIR (rien sans CAPTURE_DIR). */
async function capturer(page: Page, nom: string) {
  if (DOSSIER) await page.screenshot({ path: `${DOSSIER}/${nom}.jpg`, type: 'jpeg', quality: 80 });
}

for (const [w, h] of TAILLES) {
  test(`partie contre Pomme jusqu'au score en ${w} × ${h} : barre, menu « Plus », résultat visible`, async ({ page }) => {
    test.setTimeout(120_000);
    const erreurs: string[] = [];
    page.on('pageerror', e => erreurs.push(e.message));
    await page.setViewportSize({ width: w, height: h });
    await preparer(page, 'dark');
    await page.goto('/?komi=-100');
    await page.locator('.cta').click();
    await expect(plateau(page)).toBeVisible();

    // La barre : Indice, Conseil, Qui mène ?, Passer, Plus. Chaque bouton tient dans l'écran, 44 px, libellé sur une ligne.
    const barre = barreActions(page);
    const boutons = barre.getByRole('button');
    await expect(boutons.locator(':scope > span:last-child')).toHaveText(['Indice', 'Conseil', 'Qui mène ?', 'Passer', 'Plus']);
    for (const b of await boutons.all()) {
      const box = (await b.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(w);
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(await b.locator('span').last().evaluate(e => e.getBoundingClientRect().height)).toBeLessThan(24);
    }
    // Le compteur d'indices : « 3 » lisible, et le nombre dit par la description.
    await expect(barre.getByRole('button', { name: 'Indice' }).locator('.compteur-badge')).toHaveText('3');
    await expect(barre.getByRole('button', { name: 'Indice' })).toHaveAttribute('aria-description', '3 indices restants');

    // Mochi est posé juste sous ton bandeau : pas de trou.
    const toi = (await page.locator('.joueur[data-joueur="Toi"]').boundingBox())!;
    const mochi = (await page.locator('.partie-mochi .coach').boundingBox())!;
    expect(mochi.y - (toi.y + toi.height)).toBeLessThanOrEqual(12);

    // Le menu « Plus » : Annuler (désactivé avant le premier coup), Abandonner, et deux réglages. Échap le ferme.
    const plus = barre.getByRole('button', { name: 'Plus' });
    await expect(plus).toHaveAttribute('aria-expanded', 'false');
    let feuille = await ouvrirPlus(page);
    await expect(plus).toHaveAttribute('aria-expanded', 'true');
    await expect(feuille.getByRole('button', { name: 'Annuler' })).toBeDisabled();
    await expect(feuille.getByRole('button', { name: 'Abandonner' })).toBeEnabled();
    const confirmer = feuille.getByRole('switch', { name: 'Confirmer au doigt' });
    await expect(confirmer).toHaveAttribute('aria-checked', 'true');
    await expect(feuille.getByRole('switch', { name: 'Sons' })).toBeVisible();
    const fb = (await feuille.boundingBox())!;
    expect(fb.x).toBeGreaterThanOrEqual(0);
    expect(fb.x + fb.width).toBeLessThanOrEqual(w);
    expect(fb.y + fb.height).toBeLessThanOrEqual((await barre.boundingBox())!.y);
    await capturer(page, `menu-plus-sombre-${w}`);
    await page.keyboard.press('Escape');
    await expect(feuille).toHaveCount(0);
    await expect(plus).toBeFocused();

    // Un coup, puis Annuler depuis le menu : le coup et la réponse de Pomme sont repris, le menu se ferme.
    await jouer(page, 'E5');
    await expect(page.getByText(/Pomme (joue|capture|passe)/)).toBeVisible({ timeout: 10_000 });
    feuille = await ouvrirPlus(page);
    await feuille.getByRole('button', { name: 'Annuler' }).click();
    await expect(feuille).toHaveCount(0);
    await expect(page.locator('ol.coups > li:not(.vide)')).toHaveCount(0);

    // Le réglage « Confirmer au doigt » se coupe depuis la partie, et le menu se ferme en touchant ailleurs.
    feuille = await ouvrirPlus(page);
    await feuille.getByRole('switch', { name: 'Confirmer au doigt' }).click();
    await expect(feuille.getByRole('switch', { name: 'Confirmer au doigt' })).toHaveAttribute('aria-checked', 'false');
    await page.locator('.partie-mochi').click({ position: { x: 10, y: 10 } });
    await expect(feuille).toHaveCount(0);
    expect(JSON.parse(await page.evaluate(() => localStorage.getItem('go.settings.v1')!)).confirmTouch).toBe(false);

    // Jusqu'au score : le résultat et « Voir le résultat » sont dans l'écran (R3 de la recette du 30/09).
    await jouer(page, 'E5');
    await expect(page.getByText(/Pomme (joue|capture|passe)/)).toBeVisible({ timeout: 10_000 });
    await passerJusquAuScore(page);
    await expect(page.locator('.recit-resultat.vu')).toHaveText(/^Tu gagnes de \d+(,5)? points\s?!$/, { timeout: 5000 });
    const voir = page.getByRole('button', { name: 'Voir le résultat' });
    await expect.poll(async () => {
      const b = await voir.boundingBox();
      return b ? b.y + b.height <= h && b.y >= 0 : false;
    }, { timeout: 3000 }).toBe(true);
    const resultat = (await page.locator('.recit-resultat').boundingBox())!;
    expect(resultat.y).toBeGreaterThanOrEqual(0);
    expect(resultat.y + resultat.height).toBeLessThanOrEqual(h);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(w);
    await voir.click({ timeout: 1000 }).catch(() => {});
    await expect(page.getByRole('heading', { level: 2, name: 'Victoire' })).toBeVisible();
    expect(erreurs).toEqual([]);
  });
}

test('mouvements réduits : aucune animation sur les bandeaux ni le menu', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await preparer(page, 'light');
  await page.goto('/');
  await page.locator('.cta').click();
  await expect(plateau(page)).toBeVisible();
  expect(await page.locator('.joueur').first().evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0);
  const feuille = await ouvrirPlus(page);
  expect(await feuille.evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0);
});

async function preparer(page: Page, theme: 'dark' | 'light') {
  await page.addInitScript(t => {
    localStorage.setItem('go.settings.v1', JSON.stringify({ theme: t }));
    localStorage.setItem('go.parties.v1', JSON.stringify({ n: 3, ordi: 3, dernier: 'pomme' }));
    localStorage.setItem('go.intro-but.v1', 'true');
  }, theme);
}

for (const [w, h] of TAILLES) {
  for (const theme of THEMES) {
    const nom = `${theme === 'dark' ? 'sombre' : 'clair'}-${w}`;
    test(`captures : partie contre Pomme, conseil, ${nom}`, async ({ page }) => {
      test.skip(!DOSSIER, 'captures à la demande');
      test.setTimeout(120_000);
      await page.setViewportSize({ width: w, height: h });
      await preparer(page, theme);
      await page.goto('/');
      await page.locator('.cta').click();
      await expect(plateau(page)).toBeVisible();
      await jouer(page, 'E5');
      await expect(page.getByText(/Pomme (joue|capture|passe)/)).toBeVisible({ timeout: 10_000 });
      await page.getByRole('toolbar', { name: 'Actions de la partie' }).getByRole('button', { name: 'Conseil', exact: true }).click();
      await expect(page.locator('.partie-plateau .calque-conseil')).toHaveCount(1, { timeout: 10_000 });
      await page.waitForTimeout(400);
      await capturer(page, `conseil-${nom}`);
    });

    test(`captures : récit du score, ${nom}`, async ({ page }) => {
      // Le récit pose problème en 320 × 568 (R3) : les deux thèmes ; en 390, le sombre suffit.
      test.skip(!DOSSIER || (w === 390 && theme === 'light'), 'captures à la demande');
      test.setTimeout(120_000);
      await page.setViewportSize({ width: w, height: h });
      await preparer(page, theme);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('/?komi=-100');
      await page.locator('.cta').click();
      await expect(plateau(page)).toBeVisible();
      await jouer(page, 'E5');
      await expect(page.getByText(/Pomme (joue|capture|passe)/)).toBeVisible({ timeout: 10_000 });
      await passerJusquAuScore(page);
      await expect(page.locator('.recit-resultat.vu')).toBeVisible({ timeout: 10_000 });
      await page.waitForTimeout(300);
      await capturer(page, `recit-${nom}`);
    });
  }
}
