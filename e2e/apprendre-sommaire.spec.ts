import { expect, test, type Page } from '@playwright/test';
import { brancher, fauxServeur } from './fauxSupabase';
import { leconDuTheme, ongletApprendre } from './apprendre';
import { lancerGuidee } from './plateau';

// Apprendre en sommaire (#652, règle A13 de DESIGN.md ; remplace le chemin v3 en zigzag). Au premier regard : la carte de
// la prochaine leçon (seul relief), deux entrées (Jouer avec Mochi, Revoir les règles ; Ouvertures vient avec le chapitre de l'ouverture, #U9), puis la grille de tous
// les thèmes, sans pli ni « Bientôt ». Une leçon qui n'est pas la prochaine s'ouvre depuis la page de son thème, avec le
// même accès qu'avant (#343 : compte après la leçon 3). La fête de fin de chapitre se joue en tête du sommaire.

const DEUX = { l1: 6, l2: 6 };
const BASES = { l1: 6, l2: 6, l3: 8, l4: 5, l5: 5, l6: 6, l7: 6 };

async function ouvrir(page: Page, progres: Record<string, number>) {
  await page.addInitScript(p => localStorage.setItem('go.lecons.v1', JSON.stringify(p)), progres);
  await page.goto('/');
  await ongletApprendre(page);
  await expect(page.getByTestId('prochaine-lecon')).toBeVisible();
}

async function sansDebord(page: Page) {
  const debord = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(debord).toBeLessThanOrEqual(0);
}

test('premier lancement : la leçon 1 en carte, deux entrées, tous les thèmes, ni chemin ni « Bientôt »', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ouvrir(page, {});
  const carte = page.getByTestId('prochaine-lecon');
  await expect(carte.getByText('On commence ici.', { exact: true })).toBeVisible();
  await expect(carte.getByRole('button', { name: 'Leçon 1 : Libertés et capture, prochaine étape' })).toBeVisible();
  await expect(carte.getByText('Environ 2 min')).toBeVisible();
  await expect(page.locator('.cta')).toHaveCount(1);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  // Le sommaire : deux entrées au même format, chacune avec son visuel, dans un groupe nommé. #U9 : pas d'Ouvertures avant l'ouverture.
  const entrees = page.getByRole('region', { name: 'Pour apprendre autrement' });
  await expect(entrees.getByRole('button')).toHaveText(['Jouer avec Mochi', 'Revoir les règles']);
  await expect(entrees.locator('.sommaire-visuel > *')).toHaveCount(2);
  await expect(page.getByTestId('entree-ouvertures')).toHaveCount(0);
  // #U9 : à plat, sans ligne de description ni barre à zéro (elle paraît dès qu'une leçon est faite).
  await expect(page.locator('.theme-desc')).toHaveCount(0);
  await expect(page.locator('.par-theme .theme-maitrise')).toHaveCount(0);
  // Tous les thèmes, sans pli.
  await expect(page.getByTestId('par-theme').getByRole('button')).toHaveCount(15);
  await expect(page.getByRole('button', { name: 'Tous les thèmes' })).toHaveCount(0);
  // Plus de chemin, d'en-tête de chapitre ni de « Bientôt ».
  await expect(page.locator('.gue, .chapitre-chemin, .a-venir')).toHaveCount(0);
  await expect(page.getByText('Bientôt')).toHaveCount(0);
  await sansDebord(page);
  await page.getByRole('button', { name: 'Commencer' }).click();
  await expect(page.getByRole('heading', { name: 'Libertés et capture' })).toBeVisible();
});

test('#U9 : les bases faites, « Ouvertures » vient après la découverte et les règles', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ouvrir(page, BASES);
  const entrees = page.getByRole('region', { name: 'Pour apprendre autrement' });
  await expect(entrees.getByRole('button')).toHaveText(['Jouer avec Mochi', 'Revoir les règles', 'Ouvertures']);
});

test('une leçon faite se rouvre depuis son thème ; « ‹ » ramène au thème, puis au sommaire, à sa place', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ouvrir(page, DEUX);
  const carte = page.getByTestId('prochaine-lecon');
  await expect(carte.locator('.bubble')).toHaveCount(0);
  await expect(carte.getByRole('button', { name: 'Commencer la leçon : Techniques de capture' })).toHaveText('Commencer');
  const l1 = await leconDuTheme(page, 'Capture', 'Leçon 1 : Libertés et capture, terminée');
  await expect(l1).toHaveAttribute('data-etat', 'faite');
  await l1.click();
  await expect(page.getByRole('heading', { name: 'Libertés et capture' })).toBeVisible();
  await page.getByRole('button', { name: 'Retour à Apprendre' }).first().click();
  await expect(page.locator('.theme-lecons')).toBeVisible();
  await page.getByRole('button', { name: 'Retour à Apprendre' }).click();
  await expect(page.getByTestId('prochaine-lecon')).toBeVisible();
  // Le focus revient sur la carte du thème touchée (A6).
  await expect(page.getByTestId('par-theme').getByRole('button', { name: /^Capture,/ })).toBeFocused();
});

test('Jouer avec Mochi : un détail avec la partie de découverte et la partie guidée ; le retour du système y ramène', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ouvrir(page, DEUX);
  await page.getByTestId('jouer-avec-mochi').click();
  await expect(page.getByRole('heading', { name: 'Jouer avec Mochi' })).toBeVisible();
  await expect(page.getByTestId('carte-decouverte')).toBeVisible();
  await expect(page.getByTestId('carte-guidee')).toBeVisible();
  // #669 (A9) : le titre du document nomme le détail, plus l'onglet (« Apprendre »).
  await expect(page).toHaveTitle('Jouer avec Mochi · Mochi Go');
  await page.goBack();
  await expect(page.getByTestId('prochaine-lecon')).toBeVisible();
  await expect(page.getByTestId('jouer-avec-mochi')).toBeFocused();
  await expect(page).toHaveTitle('Apprendre · Mochi Go');
});

test('#669 : chaque partie de « Jouer avec Mochi » porte son nom dans le titre du document', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ouvrir(page, DEUX);
  await page.getByTestId('jouer-avec-mochi').click();
  await page.getByTestId('carte-decouverte').click();
  await expect(page).toHaveTitle('Partie de découverte · Mochi Go');
  await page.goto('/');
  await lancerGuidee(page);
  await expect(page.locator('.partie')).toBeVisible();
  await expect(page).toHaveTitle('Partie guidée · Mochi Go');
});

test('chapitre fini : tampon d’or et confettis en tête du sommaire, une seule fois', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await ouvrir(page, BASES);
  const fete = page.locator('[data-chapitre="c1"]');
  await expect(fete.getByRole('img', { name: 'Chapitre terminé : Les bases' })).toBeVisible();
  await expect(fete).toHaveAttribute('data-fete', 'true');
  await expect(page.getByTestId('confettis')).toBeAttached();
  const r = (await fete.boundingBox())!;
  expect(r.y + r.height).toBeLessThanOrEqual(844);
  await expect(page.getByTestId('prochaine-lecon').getByRole('button', { name: 'Commencer la leçon : Les premiers coups' })).toBeVisible();
  await page.waitForTimeout(1700);
  await page.reload();
  await ongletApprendre(page);
  await expect(page.getByTestId('prochaine-lecon')).toBeVisible();
  await expect(page.locator('[data-fete]')).toHaveCount(0);
  await expect(page.getByTestId('confettis')).toHaveCount(0);
});

test('chapitre fini, mouvements réduits : le tampon sans confettis', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ouvrir(page, BASES);
  await expect(page.locator('[data-chapitre="c1"]').getByRole('img', { name: 'Chapitre terminé : Les bases' })).toBeVisible();
  await page.waitForTimeout(400);
  await expect(page.getByTestId('confettis')).toHaveCount(0);
});

// #343 : sans compte, les leçons 1 à 3 sont libres ; la 4 et les suivantes restent touchables, portent « Avec un compte »
// dans la page de leur thème, et ouvrent la création de compte.
test('sans compte : dans la page du thème, la leçon 4 porte « Avec un compte » et ouvre la création de compte', async ({ browser, baseURL }) => {
  const ctx = await browser.newContext({ viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', baseURL,
    colorScheme: 'light', reducedMotion: 'reduce', storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }, { name: 'go.connait-go.v1', value: '"sait"' }] }] } });
  const page = await brancher(ctx, fauxServeur(), { 'go.lecons.v1': JSON.stringify(DEUX) });
  await page.goto('/');
  await ongletApprendre(page);
  const carte = page.getByTestId('prochaine-lecon');
  await expect(carte.getByRole('button', { name: 'Leçon 3 : Techniques de capture, prochaine étape' })).toBeVisible();
  await expect(carte.locator('.pas-compte')).toHaveCount(0);
  const l4 = await leconDuTheme(page, 'Ko', 'Leçon 4 : Le ko, avec un compte');
  await expect(l4).toBeEnabled();
  await expect(l4).toHaveAttribute('data-compte', 'true');
  await expect(l4.getByText('Avec un compte')).toBeVisible();
  await sansDebord(page);
  await l4.click();
  await expect(page.getByTestId('creer-compte')).toHaveAttribute('data-raison', 'lecons');
  await ctx.close();
});

test('320 px : tout tient, 44 px partout', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const progres of [{}, DEUX, BASES]) {
    await ouvrir(page, progres);
    await sansDebord(page);
    for (const b of await page.locator('.apprendre button:enabled').all()) {
      const r = await b.boundingBox();
      expect(r!.height, (await b.getAttribute('aria-label')) ?? 'bouton').toBeGreaterThanOrEqual(44);
    }
    const r = (await page.locator('.cta-chemin').boundingBox())!;
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.x + r.width).toBeLessThanOrEqual(320);
  }
});

test('en anglais : carte, entrées et thèmes traduits', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(p => localStorage.setItem('go.lecons.v1', JSON.stringify(p)), DEUX);
  await page.goto('/?lang=en');
  await ongletApprendre(page);
  await expect(page.getByTestId('prochaine-lecon').getByText('About 2 min')).toBeVisible();
  await expect(page.getByTestId('jouer-avec-mochi')).toHaveText('Play with Mochi');
  await expect(page.getByTestId('revoir-regles')).toHaveText('Review the rules');
  await expect(page.getByRole('region', { name: 'Other ways to learn' })).toBeVisible();
});
