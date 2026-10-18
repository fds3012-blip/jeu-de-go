import { expect, test } from '@playwright/test';
import { attendreReponse, coupsJoues, deplierAvecMochi, jouer, lancerGuidee, passerJusquAuScore, plateau } from './plateau';

// Issue #79 : partie guidée contre Mochi, hors de l'échelle des adversaires. Mochi règle sa force tous les 10 coups
// (logique testée dans src/engine/guidee.test.ts). Ici : on lance la partie, on dépasse le 10e coup (premier réglage),
// on la termine, et le bilan des adversaires ne bouge pas.

test('partie guidée : lancée depuis Apprendre (#589), jouée au-delà du 10e coup, terminée sans toucher au bilan', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await page.goto('/');
  await lancerGuidee(page);
  await expect(plateau(page)).toBeVisible();
  await expect(page.getByText('Partie guidée : Mochi règle sa force pour que la partie reste serrée. Tu as Noir.')).toBeVisible();

  // Six coups de Noir, chacun suivi de la réponse de Mochi : 12 coups, le premier réglage de force a eu lieu.
  for (const p of ['E5', 'C3', 'G7', 'C7', 'G3', 'D4', 'F6', 'D6', 'F4', 'B5']) {
    if ((await coupsJoues(page).count()) >= 12) break;
    if (await plateau(page).locator(`g[data-pierre][data-point="${p}"]`).count()) continue;
    const avant = await coupsJoues(page).count();
    await jouer(page, p);
    expect(await attendreReponse(page, avant)).toBe(false);
  }
  expect(await coupsJoues(page).count()).toBeGreaterThanOrEqual(12);
  // Le premier réglage suit l'estimation (Worker) d'une position d'au moins 10 coups. Sous charge, elle arrivait
  // parfois après les passes, et le réglage n'avait jamais lieu (#467) : on attend qu'il soit fait avant de finir.
  await expect.poll(() => page.evaluate(() => localStorage.getItem('go.guidee.v1')), { timeout: 15_000 }).toMatch(/^\d+$/);

  await passerJusquAuScore(page);
  await expect(page.locator('.fin-bilan')).toContainText('Partie guidée : elle ne compte pas dans ton bilan.');
  // #640 : Apprendre reste monté, caché, sous la partie (sa sortie le retrouve) : seul le bouton visible compte.
  await expect(page.locator('.cta:visible')).toHaveText('Rejouer contre Mochi');
  // Sans effet sur le bilan des adversaires ; le cran de Mochi est gardé pour la partie guidée suivante.
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('go.bilan.v1') || '{}'))).toEqual({});
  expect(await page.evaluate(() => localStorage.getItem('go.guidee.v1'))).toMatch(/^\d+$/);
  // #589 : lancée depuis Apprendre, elle y ramène.
  await page.locator('.fin').getByRole('button', { name: 'Apprendre', exact: true }).click();
  await expect(page.getByTestId('carte-guidee')).toBeVisible();
  expect(erreurs).toEqual([]);
});

// Recette du soir du 28/09 (S1) : Mochi emprunte la force d'un adversaire de l'échelle (ici Pomme), pas son visage.
// Avant le correctif, le bandeau montrait Pomme sous le nom « Mochi », et l'écran de fin « BATTUE » sur Pomme.
test('partie guidée : le portrait est celui de Mochi, sans tampon « battue » à la fin', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?komi=-100');
  await lancerGuidee(page);
  await expect(plateau(page)).toBeVisible();
  await expect(page.locator('[data-portrait="pomme"]')).toHaveCount(0);
  await expect(page.locator('[data-portrait="mochi"]:not(.coach-portrait)').first()).toBeVisible();

  await jouer(page, 'E5');
  await expect(page.getByRole('toolbar').getByRole('button', { name: 'Passer', exact: true })).toBeEnabled({ timeout: 10_000 });
  await passerJusquAuScore(page);
  await expect(page.getByRole('heading', { level: 2, name: 'Victoire' })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-portrait="pomme"]')).toHaveCount(0);
  await expect(page.locator('[data-portrait="mochi"]:not(.coach-portrait)').first()).toBeVisible();
  await expect(page.getByText(/^BATTUE?$/)).toHaveCount(0);
});

// #589 : la partie guidée a quitté l'accueil Jouer pour Apprendre, sous la partie de découverte, dans le même style.
// #602 : toutes deux sous « Jouer avec Mochi », à la fin du chapitre « Les bases ».
test('partie guidée : dans Apprendre sous la partie de découverte, plus sur l’accueil ; « ‹ » ramène à Apprendre', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.evaluate(() => { localStorage.setItem('go.premiere-pierre.v1', 'true'); window.dispatchEvent(new Event('go:premiere-pierre')); });
  await page.getByTestId('modes').waitFor();
  await expect(page.getByRole('button', { name: /guidée/i })).toHaveCount(0);
  if (await page.getByTestId('mode-plus').count()) {
    await page.getByTestId('mode-plus').click();
    await expect(page.getByRole('dialog', { name: 'Autres façons de jouer' }).getByRole('button', { name: /guidée/i })).toHaveCount(0);
    await page.keyboard.press('Escape');
  }
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
  // #602 : les deux parties avec Mochi sont rangées sous « Jouer avec Mochi », à la fin du chapitre « Les bases ».
  await deplierAvecMochi(page);
  const decouverte = page.getByTestId('carte-decouverte'), guidee = page.getByTestId('carte-guidee');
  await expect(guidee).toHaveAccessibleName(/^Partie guidée contre Mochi : il règle sa force/);
  const [d, g] = [(await decouverte.boundingBox())!, (await guidee.boundingBox())!];
  expect(g.y, 'juste sous la découverte').toBeGreaterThan(d.y + d.height - 1);
  expect(g.y - (d.y + d.height)).toBeLessThan(24);
  expect(g.height).toBeGreaterThanOrEqual(44);
  expect(Math.round(g.width)).toBe(Math.round(d.width));
  // Une seule action en relief : « Reprendre » ou « Commencer » de la carte de leçon.
  await expect(page.locator('.apprendre .cta')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await guidee.click();
  await expect(plateau(page)).toBeVisible();
  await page.getByRole('button', { name: 'Retour à Apprendre' }).click();
  await expect(guidee).toBeVisible();
});
