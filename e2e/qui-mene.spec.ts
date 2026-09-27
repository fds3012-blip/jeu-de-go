import { expect, test, type Page } from '@playwright/test';
import { jouer, jouerSuite, partieADeux, plateau } from './plateau';

// « Qui mène ? » (#94) : un toucher montre la carte des territoires et une phrase pendant 3 s.

async function partieContreOrdi(page: Page) {
  await page.goto('/');
  await page.locator('.cta').click();
  await expect(plateau(page)).toBeVisible();
  await jouer(page, 'E5');
  await expect(page.getByText(/Pomme (joue|capture|passe)/)).toBeVisible({ timeout: 10_000 });
}

const bouton = (page: Page) => page.getByRole('toolbar', { name: 'Actions de la partie' }).getByRole('button', { name: /Qui mène/ });
const carte = (page: Page) => plateau(page).locator('[data-qui-mene]');
const phrase = (page: Page) => page.locator('.qui-mene-phrase');

test("contre l'ordi : la carte des territoires et la phrase, puis elles s'effacent", async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await partieContreOrdi(page);

  const b = bouton(page);
  await expect(b).toHaveAttribute('aria-description', 'Encore 3 fois dans cette partie');
  await b.click();
  await expect(carte(page)).toHaveCount(1, { timeout: 10_000 });
  // En tout début de partie, l'estimation peut ne rien attribuer : la carte existe, ses carrés sont facultatifs.
  await expect(carte(page)).toBeAttached();
  await expect(phrase(page)).toHaveText(/^(Noir|Blanc) mène d.environ \d+ points\.|C.est serré\.$/);
  await expect(b).toHaveAttribute('aria-description', 'Encore 2 fois dans cette partie');

  // Au bout de 3 s, tout s'efface.
  await expect(carte(page)).toHaveCount(0, { timeout: 5_000 });
  await expect(phrase(page)).toHaveCount(0);

  // Un nouveau toucher ailleurs la masque aussi, sans attendre.
  await b.click();
  await expect(carte(page)).toHaveCount(1, { timeout: 10_000 });
  await page.locator('.coach').click();
  await expect(carte(page)).toHaveCount(0);
  await expect(b).toHaveAttribute('aria-description', 'Encore 1 fois dans cette partie');
  expect(erreurs).toEqual([]);
});

test("l'action disparaît quand l'aide de Mochi est coupée", async ({ page }) => {
  await page.addInitScript(() => {
    const k = 'go.settings.v1';
    try { const s = JSON.parse(localStorage.getItem(k) ?? '{}'); localStorage.setItem(k, JSON.stringify({ ...s, aide: 'non' })); } catch { /* rien */ }
  });
  await page.goto('/');
  await page.locator('.cta').click();
  await expect(plateau(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Indice' })).toBeVisible();
  await expect(bouton(page)).toHaveCount(0);
});

// Captures (docs/design/v2/captures/qui-mene-*.png) : `CAPTURES=1 npx playwright test e2e/qui-mene.spec.ts`.
test('captures « Qui mène ? », sombre et clair', async ({ page }) => {
  test.skip(!process.env.CAPTURES, 'captures à la demande');
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  // Partie à deux (illimité), avec assez de pierres pour que la carte dise quelque chose.
  await partieADeux(page);
  await jouerSuite(page, ['C3', 'G7', 'C7', 'G3', 'D5', 'F5', 'C5', 'G5', 'E3', 'E7']);
  for (const [w, h, suffixe] of [[390, 844, ''], [375, 667, '-se']] as const) {
    await page.setViewportSize({ width: w, height: h });
    for (const theme of ['dark', 'light'] as const) {
      await page.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme);
      await bouton(page).click();
      await expect(carte(page)).toHaveCount(1, { timeout: 10_000 });
      await page.waitForTimeout(300);
      await page.screenshot({ path: `docs/design/v2/captures/qui-mene-${theme === 'dark' ? 'sombre' : 'clair'}${suffixe}.png` });
      await expect(carte(page)).toHaveCount(0, { timeout: 5_000 });
    }
  }
});
