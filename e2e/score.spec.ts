import { expect, test, type Page } from '@playwright/test';
import { jouer, partieADeux, passerJusquAuScore } from './plateau';

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
  // Horloge maîtrisée : sur une machine chargée, le récit ne doit pas céder la place pendant qu'on le lit.
  await page.clock.install();
  const valider = await partieJouee(page);
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
  await valider.click();
  const recit = page.locator('.recit');
  await expect(recit).toBeVisible();
  // À deux, les camps restent Noir et Blanc (#118) ; « Voir le résultat » est le bouton principal.
  await expect(recit.locator('.camp-nom')).toHaveText(['Noir', 'Blanc']);
  await expect(page.getByRole('button', { name: 'Voir le résultat' })).toHaveClass(/\bcta\b/);
  // Les carrés de territoire se posent un à un.
  await expect(page.locator('.territoire-recit')).toHaveCount(36 + 27);
  // Le résultat arrive, avec les totaux du comptage.
  await page.clock.runFor(2600);
  await expect(page.locator('.recit-resultat.vu')).toHaveText('Noir gagne de 3,5 points');
  await expect(page.getByTestId('recit-noir')).toHaveText('37');
  await expect(page.getByTestId('recit-blanc')).toHaveText('33,5');
  await expect(recit).toContainText('+ 1 prisonnier pour Noir');
  await expect(recit).toContainText('+ 6,5 komi pour Blanc');
  // Première fois : le komi est expliqué.
  await expect(recit).toContainText("Le komi compense l'avantage de Noir, qui joue en premier.");
  // Puis l'écran de fin, tel qu'avant, sans toucher.
  await page.clock.runFor(1200);
  await expect(page.getByRole('heading', { level: 2, name: 'Noir gagne' })).toBeVisible();
  await page.clock.resume();
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

// Issue #118 : contre l'ordi, le récit dit « Toi » et « Pomme », et « Voir le résultat » est le bouton principal.
test("contre Pomme : « Toi » et « Pomme », « Tu gagnes… ! » et un vrai bouton « Voir le résultat »", async ({ page }) => {
  await page.goto('/?komi=-100');
  await page.locator('.cta').click();
  await passerJusquAuScore(page);
  const recit = page.locator('.recit');
  await expect(recit).toBeVisible();
  await expect(recit.locator('.camp-nom')).toHaveText(['Toi', 'Pomme']);
  await expect(recit.locator('.camp-nom .recit-pierre.b')).toHaveCount(1);
  await expect(page.locator('.recit-resultat.vu')).toHaveText(/^Tu gagnes de \d+(,5)? points\s?!$/, { timeout: 3000 });
  const continuer = page.getByRole('button', { name: 'Voir le résultat' });
  await expect(continuer).toHaveClass(/\bcta\b/);
  expect((await continuer.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  // Le récit peut déjà avoir cédé la place tout seul (1,2 s de lecture) quand la machine est chargée.
  await continuer.click({ timeout: 1000 }).catch(() => {});
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
    for (const [nom, ms] of [['1-territoires', 700], ['2-prisonniers', 1700], ['3-komi', 2200], ['4-resultat', 2500]] as const) {
      await page.clock.runFor(ms - t); t = ms;
      await page.waitForTimeout(250);
      await page.screenshot({ scale: 'css', path: `${dossier}/score-${nom}-${theme}.png` });
    }
  });
}

// Suite de #78 : les trois temps écrivent chacun leur total ; prisonniers et komi rejoignent leur camp (jetons).
// Fin de partie → récit → résultat, avec et sans mouvements réduits, à 390 et 320 px, en sombre et en clair.
for (const largeur of [390, 320] as const) {
  for (const theme of ['dark', 'light'] as const) {
    test.describe(`${largeur} px, ${theme === 'dark' ? 'sombre' : 'clair'}`, () => {
      test.use({ viewport: { width: largeur, height: largeur === 390 ? 844 : 568 } });
      // Une partie entière est jouée avant le récit : plus lent quand les suites tournent en parallèle.
      test.describe.configure({ timeout: 90_000 });
      test.beforeEach(async ({ page }) => {
        await page.addInitScript(t => localStorage.setItem('go.settings.v1', JSON.stringify({ theme: t })), theme);
      });
      const sansDefilement = async (page: Page) =>
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(largeur);

      test('animé : trois temps, chacun son total, puis le résultat sans toucher', async ({ page }) => {
        await page.clock.install();
        const valider = await partieJouee(page);
        await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
        await valider.click();
        const recit = page.locator('.recit');
        await expect(recit).toBeVisible();
        const noir = page.getByTestId('recit-noir'), blanc = page.getByTestId('recit-blanc');
        const etape = (n: number) => recit.locator('.recit-etape').nth(n);
        const jetons = recit.locator('.recit-jeton');

        // 1. Territoires colorés, avec leur total.
        await page.clock.runFor(1300);
        await expect(etape(0)).toHaveClass(/\bvu\b/);
        await expect(etape(0)).toContainText('36 points de territoire pour Noir, 27 pour Blanc');
        await expect(etape(0)).toContainText('Territoires : les points vides que chaque camp entoure');
        await expect(noir).toHaveText('36');
        await expect(blanc).toHaveText('27');
        await expect(etape(1)).not.toHaveClass(/\bvu\b/);
        await sansDefilement(page);

        // 2. Le prisonnier rejoint le camp de Noir : un jeton « + 1 » monte dans le chiffre.
        await page.clock.runFor(150);
        await expect(etape(1)).toHaveClass(/\bvu\b/);
        await expect(jetons).toHaveCount(1);
        await expect(jetons).toHaveText('+ 1');
        await expect(recit.locator('.camp').first().locator('.recit-jeton')).toHaveCount(1);
        // Revue visuelle : le jeton figé à mi-course (animations CSS en pause), puis on les laisse finir.
        await page.evaluate(() => document.getAnimations().forEach(a => { a.pause(); a.currentTime = 150; }));
        await page.screenshot({ path: test.info().outputPath(`recit-jeton-${largeur}-${theme}.png`) });
        await page.evaluate(() => document.getAnimations().forEach(a => { try { a.finish(); } catch { a.play(); } }));
        await page.clock.runFor(300);
        await expect(noir).toHaveText('37');
        await expect(blanc).toHaveText('27');

        // 3. Le komi s'ajoute à Blanc, expliqué la première fois.
        await page.clock.runFor(200);
        await expect(etape(2)).toHaveClass(/\bvu\b/);
        await expect(etape(2)).toContainText('+ 6,5 komi pour Blanc');
        await expect(etape(2)).toContainText("Le komi compense l'avantage de Noir");
        await expect(recit.locator('.camp').last().locator('.recit-jeton')).toHaveText('+ 6,5');
        await page.clock.runFor(300);
        await expect(blanc).toHaveText('33,5');

        // Résultat, puis l'écran de fin sans toucher, avant 4 s au total.
        await page.clock.runFor(300);
        await expect(recit.locator('.recit-resultat.vu')).toHaveText('Noir gagne de 3,5 points');
        await expect(jetons).toHaveCount(0);
        await sansDefilement(page);
        const bouton = page.getByRole('button', { name: 'Voir le résultat' });
        expect((await bouton.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        await page.screenshot({ path: test.info().outputPath(`recit-${largeur}-${theme}.png`) });
        await page.clock.runFor(4000 - 2550);
        await expect(page.getByRole('heading', { level: 2, name: 'Noir gagne' })).toBeVisible();
        await sansDefilement(page);
      });

      test('mouvements réduits : les trois totaux tout de suite, puis le résultat', async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const valider = await partieJouee(page);
        await valider.click();
        const recit = page.locator('.recit.immediat');
        await expect(recit).toBeVisible();
        await expect(recit.locator('.recit-etape:not(.vu)')).toHaveCount(0);
        await expect(recit.locator('.recit-etape').nth(0)).toContainText('36 points de territoire pour Noir, 27 pour Blanc');
        await expect(recit.locator('.recit-etape').nth(1)).toContainText('+ 1 prisonnier pour Noir');
        await expect(recit.locator('.recit-etape').nth(2)).toContainText('+ 6,5 komi pour Blanc');
        await expect(page.getByTestId('recit-noir')).toHaveText('37');
        await expect(page.getByTestId('recit-blanc')).toHaveText('33,5');
        await expect(recit.locator('.recit-jeton, .territoire-recit')).toHaveCount(0);
        await sansDefilement(page);
        await page.screenshot({ path: test.info().outputPath(`recit-reduit-${largeur}-${theme}.png`) });
        await expect(page.getByRole('heading', { level: 2, name: 'Noir gagne' })).toBeVisible({ timeout: 5000 });
        await sansDefilement(page);
      });
    });
  }
}
