import { expect, test, type Page } from '@playwright/test';
import { jouer, partieADeux } from './plateau';

// Issue #78 : le score est raconté en trois temps sur le goban final (territoires, prisonniers, komi), puis le résultat,
// avant l'écran de fin. Partie à deux déterministe : Noir tient les colonnes A à E, Blanc F à J,
// et une pierre blanche perdue en B5 devient prisonnière. Noir : 36 + 1 = 37 ; Blanc : 27 + 6,5 = 33,5.

async function partieJouee(page: Page) {
  await partieADeux(page);
  for (let r = 1; r <= 9; r++) { await jouer(page, `E${r}`); await jouer(page, `F${r}`); }
  const passer = page.getByRole('button', { name: 'Passer' });
  await passer.click();
  await jouer(page, 'B5');
  await passer.click();
  await passer.click();
  const valider = page.getByRole('button', { name: 'Valider le score' });
  await expect(valider).toBeEnabled({ timeout: 10_000 });
  // La pierre de B5 est morte : si le moteur ne l'a pas proposée, on la touche.
  const b5 = page.locator('[data-point="B5"]');
  if ((await b5.getAttribute('data-morte')) === null) await jouer(page, 'B5');
  await expect(b5).toHaveAttribute('data-morte', '');
  return valider;
}

test('fin de partie : le récit du score, puis le résultat, sans toucher', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  const valider = await partieJouee(page);
  await valider.click();
  const recit = page.locator('.recit');
  await expect(recit).toBeVisible();
  // À deux, les camps restent Noir et Blanc (#118) ; « Continuer » est le bouton principal.
  await expect(recit.locator('.camp-nom')).toHaveText(['Noir', 'Blanc']);
  await expect(page.getByRole('button', { name: 'Continuer' })).toHaveClass(/\bcta\b/);
  // Les carrés de territoire se posent un à un.
  await expect(page.locator('.territoire-recit')).toHaveCount(36 + 27);
  // Le résultat arrive, avec les totaux du comptage.
  await expect(page.locator('.recit-resultat.vu')).toHaveText('Noir gagne de 3,5 points', { timeout: 3000 });
  await expect(page.getByTestId('recit-noir')).toHaveText('37');
  await expect(page.getByTestId('recit-blanc')).toHaveText('33,5');
  await expect(recit).toContainText('+ 1 prisonnier pour Noir');
  await expect(recit).toContainText('+ 6,5 komi pour Blanc');
  // Première fois : le komi est expliqué.
  await expect(recit).toContainText("Le komi compense l'avantage de Noir, qui joue en premier.");
  // Puis l'écran de fin, tel qu'avant, sans toucher.
  await expect(page.getByRole('heading', { level: 2, name: 'Noir gagne' })).toBeVisible({ timeout: 3000 });
  await expect(page.locator('.fin-marge')).toContainText(/de 3,5 points sur 9 × 9/);
  await expect(page.locator('.cta')).toHaveText('Rejouer');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  // Partie suivante : le komi n'est plus expliqué.
  await page.locator('.cta').click();
  await page.getByRole('button', { name: 'Passer' }).click();
  await page.getByRole('button', { name: 'Passer' }).click();
  await page.getByRole('button', { name: 'Valider le score' }).click({ timeout: 10_000 });
  await expect(page.locator('.recit')).toBeVisible();
  await expect(page.locator('.recit')).not.toContainText('Le komi compense');
  expect(erreurs).toEqual([]);
});

// Issue #118 : contre l'ordi, le récit dit « Toi » et « Pomme », et « Continuer » est le bouton principal.
test("contre Pomme : « Toi » et « Pomme », « Tu gagnes… ! » et un vrai bouton Continuer", async ({ page }) => {
  await page.goto('/?komi=-100');
  await page.locator('.cta').click();
  const passer = page.getByRole('button', { name: 'Passer' });
  const valider = page.getByRole('button', { name: 'Valider le score' });
  for (let i = 0; i < 6 && !(await valider.isVisible()); i++) {
    await expect(passer).toBeEnabled({ timeout: 10_000 });
    await passer.click();
    await expect(valider.or(page.getByText(/Pomme (joue|capture)/))).toBeVisible({ timeout: 10_000 });
  }
  await valider.click({ timeout: 10_000 });
  const recit = page.locator('.recit');
  await expect(recit).toBeVisible();
  await expect(recit.locator('.camp-nom')).toHaveText(['Toi', 'Pomme']);
  await expect(recit.locator('.recit-pierre.b')).toHaveCount(1);
  await expect(page.locator('.recit-resultat.vu')).toHaveText(/^Tu gagnes de \d+(,5)? points\s?!$/, { timeout: 3000 });
  const continuer = page.getByRole('button', { name: 'Continuer' });
  await expect(continuer).toHaveClass(/\bcta\b/);
  expect((await continuer.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await continuer.click();
  await expect(page.getByRole('heading', { level: 2, name: 'Victoire' })).toBeVisible();
});

test('un toucher saute directement au résultat', async ({ page }) => {
  const valider = await partieJouee(page);
  await valider.click();
  await expect(page.locator('.recit')).toBeVisible();
  await page.locator('.recit').click({ position: { x: 195, y: 200 } });
  await expect(page.getByRole('heading', { level: 2, name: 'Noir gagne' })).toBeVisible({ timeout: 500 });
});

test.describe('mouvements réduits', () => {
  test.use({ reducedMotion: 'reduce' });
  test('les totaux et le résultat sont là d’emblée', async ({ page }) => {
    const valider = await partieJouee(page);
    await valider.click();
    await expect(page.locator('.recit.immediat')).toBeVisible();
    await expect(page.locator('.recit-etape:not(.vu)')).toHaveCount(0);
    await expect(page.getByTestId('recit-noir')).toHaveText('37');
    await expect(page.locator('.territoire-recit')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 2, name: 'Noir gagne' })).toBeVisible({ timeout: 5000 });
  });
});

// Captures 390 × 844 de chaque étape, en sombre et en clair : CAPTURES=1 PW_PORT=4406 npx playwright test score
for (const theme of ['sombre', 'clair'] as const) {
  test(`captures du récit (${theme})`, async ({ page }) => {
    test.skip(!process.env.CAPTURES, 'captures seulement sur demande');
    await page.addInitScript(t => localStorage.setItem('go.settings.v1', JSON.stringify({ theme: t })), theme === 'sombre' ? 'dark' : 'light');
    await page.clock.install();
    const valider = await partieJouee(page);
    const t0 = await page.evaluate(() => Date.now());
    await page.clock.pauseAt(t0 + 1000);
    await valider.click();
    await expect(page.locator('.recit')).toBeVisible();
    const dossier = 'docs/design/v2/captures';
    let t = 0;
    for (const [nom, ms] of [['1-territoires', 700], ['2-prisonniers', 1550], ['3-komi', 2050], ['4-resultat', 2500]] as const) {
      await page.clock.runFor(ms - t); t = ms;
      await page.waitForTimeout(250);
      await page.screenshot({ scale: 'css', path: `${dossier}/score-${nom}-${theme}.png` });
    }
  });
}
