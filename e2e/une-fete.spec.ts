import { expect, test, type Page } from '@playwright/test';
import { jouer } from './plateau';

// Issue #236 (N2), suite de #250 : à la fin de la série d'entraînement, « Niveau 2 ! », « +20 XP » et la feuille
// « Bravo » arrivaient encore ensemble, la carte de niveau posée sur le titre du problème. Une fête à la fois :
// la feuille « Bravo » (avec son XP) d'abord, puis le niveau sur son propre écran, après l'exercice.

/** Leçon 1 finie, puis les trois problèmes de la série ; le dernier fait passer au niveau 2 (95 + 20 XP). */
async function finirSerie(page: Page, xpAvant3 = 95) {
  await page.addInitScript(() => { if (localStorage.getItem('go.lecons.v1') === null) localStorage.setItem('go.lecons.v1', JSON.stringify({ l1: 5 })); });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
  await page.getByRole('button', { name: 'Reprendre la leçon : Libertés et capture' }).click();
  await jouer(page, 'E4');
  await page.getByRole('button', { name: 'Terminer la leçon' }).click();
  await page.getByRole('button', { name: /^Entraîne-toi/ }).click();
  for (const [rang, coup] of [[1, 'E2'], [2, 'F1'], [3, 'A2']] as const) {
    await expect(page.getByText(`Entraînement, ${rang} sur 3`)).toBeVisible();
    if (rang === 3) await page.evaluate(x => localStorage.setItem('go.xp.v1', String(x)), xpAvant3);
    await jouer(page, coup);
    await expect(page.locator('.verdict-juste')).toBeVisible();
    if (rang < 3) await page.getByRole('button', { name: 'Problème suivant' }).click();
  }
}

for (const theme of ['clair', 'sombre'] as const) {
  test(`N2 : fin de série, « Bravo » puis « Niveau 2 ! », jamais ensemble (${theme})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme === 'sombre' ? 'dark' : 'light' });
    await finirSerie(page);
    const carte = page.getByTestId('fete-niveau');
    const ecranNiveau = page.getByTestId('niveau-atteint');
    // Sur la feuille « Bravo » : l'XP se lit dans la feuille, aucune autre fête par-dessus la consigne.
    await expect(page.locator('.verdict .xp-en-ligne')).toBeVisible();
    await page.waitForTimeout(1200);
    await expect(carte).toHaveCount(0);
    await expect(page.locator('.annonce-xp [data-testid="pastille-xp"]')).toHaveCount(0);
    // Après la feuille : le niveau a son écran à lui, seul (plus de feuille, plus de problème, plus de pastille).
    await page.locator('.verdict').getByRole('button', { name: 'Retour au chemin' }).click();
    await expect(ecranNiveau.getByRole('heading', { name: /Niveau\s2/ })).toBeVisible();
    await expect(page.locator('.verdict')).toHaveCount(0);
    await expect(page.getByText('Entraînement, 3 sur 3')).toHaveCount(0);
    await page.waitForTimeout(800);
    await expect(carte).toHaveCount(0);
    await expect(page.getByTestId('pastille-xp')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    const bouton = ecranNiveau.getByRole('button', { name: 'Retour au chemin' });
    expect((await bouton.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: `docs/design/v2/captures/une-chose-a-la-fois/niveau-fin-de-serie-${theme}.png` });
    // Puis le chemin, sans carte de niveau répétée.
    await bouton.click();
    await expect(page.getByRole('heading', { level: 2, name: 'Les bases' })).toBeVisible();
    await page.waitForTimeout(800);
    await expect(carte).toHaveCount(0);
  });
}

test('N2 : sans niveau franchi, la série finie ramène droit au chemin', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await finirSerie(page, 0);
  await page.locator('.verdict').getByRole('button', { name: 'Retour au chemin' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Les bases' })).toBeVisible();
  await expect(page.getByTestId('niveau-atteint')).toHaveCount(0);
});
