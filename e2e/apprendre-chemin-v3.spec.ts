import { expect, test, type Page } from '@playwright/test';
import { brancher, fauxServeur } from './fauxSupabase';

// Chemin Apprendre v3 (#40, mission du 1er octobre) : vignettes par leçon, chapitres illustrés, carte de la prochaine
// leçon présentée par Mochi, courbe à l'encre dorée sur le parcours, pierres cochées, leçons suivantes verrouillées,
// fête de fin de chapitre. Trois états : premier lancement, après deux leçons, chapitre « Les bases » fini.

const DEUX = { l1: 6, l2: 6 };
const BASES = { l1: 6, l2: 6, l3: 8, l4: 5, l5: 5, l6: 6, l7: 6 };
const DOSSIER = 'docs/design/captures/apprendre-chemin-v3';

async function ouvrir(page: Page, progres: Record<string, number>) {
  await page.addInitScript(p => localStorage.setItem('go.lecons.v1', JSON.stringify(p)), progres);
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
  await expect(page.getByTestId('prochaine-lecon')).toBeVisible();
}

async function sansDebord(page: Page) {
  const debord = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(debord).toBeLessThanOrEqual(0);
}

test('premier lancement : Mochi présente la leçon 1, une seule action, les autres leçons verrouillées', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ouvrir(page, {});
  const carte = page.getByTestId('prochaine-lecon');
  await expect(carte.getByText('On commence ici. Deux minutes, et tu sais déjà capturer.')).toBeVisible();
  await expect(carte.getByRole('button', { name: 'Leçon 1 : Libertés et capture, prochaine étape' })).toBeVisible();
  await expect(carte.getByText('Environ 2 min')).toBeVisible();
  await expect(page.locator('.cta')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Commencer' })).toBeVisible();
  // La carte est en haut : rien à faire défiler.
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  // Chapitre illustré : emblème, « 7 leçons », une mini-pierre par leçon.
  const bases = page.locator('[data-chapitre="c1"]');
  await expect(bases.getByRole('heading', { name: 'Les bases' })).toBeVisible();
  await expect(bases.getByText('7 leçons')).toBeVisible();
  await expect(bases.locator('.chapitre-pierres i')).toHaveCount(7);
  await expect(bases.locator('.chapitre-embleme .vignette')).toHaveCount(1);
  // Une vignette distincte par leçon sur le chemin (16 leçons), plus celle de la carte et les emblèmes.
  const ids = await page.locator('.gue .pas-texte .vignette').evaluateAll(els => els.map(e => e.getAttribute('data-vignette')));
  expect(new Set(ids).size).toBe(16);
  // Leçons suivantes : pierre grise, toujours touchables ; sans service de comptes, aucun verrou « compte ».
  const l2 = page.getByRole('button', { name: 'Leçon 2 : Atari : attaquer et se sauver' });
  await expect(l2).toHaveAttribute('data-etat', 'avenir');
  await expect(l2).toBeEnabled();
  await expect(page.locator('.pierre-compte')).toHaveCount(0);
  await expect(page.locator('.pierre-coche')).toHaveCount(0);
  // La courbe existe, rien n'est encore doré.
  await expect(page.locator('[data-chapitre="c1"] .gue-route')).toHaveAttribute('d', /^M.*C/);
  await expect(page.locator('[data-chapitre="c1"] .gue-parcouru')).toHaveCount(0);
  await sansDebord(page);
  // Le bouton ouvre bien la leçon 1.
  await page.getByRole('button', { name: 'Commencer' }).click();
  await expect(page.getByRole('heading', { name: 'Libertés et capture' })).toBeVisible();
});

test('après deux leçons : pierres cochées, parcours doré, la carte s’ouvre sur la leçon 3', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ouvrir(page, DEUX);
  await expect(page.getByRole('button', { name: 'Leçon 1 : Libertés et capture, terminée' })).toHaveAttribute('data-etat', 'faite');
  await expect(page.locator('.pierre-coche')).toHaveCount(2);
  await expect(page.locator('[data-chapitre="c1"]').getByText('2 sur 7')).toBeVisible();
  await expect(page.locator('[data-chapitre="c1"] .gue-parcouru')).toHaveAttribute('d', /^M.*C/);
  const carte = page.getByTestId('prochaine-lecon');
  await expect(carte.getByText('Bien joué ! Voici la suite.')).toBeVisible();
  await expect(carte.getByRole('button', { name: 'Commencer la leçon : Techniques de capture' })).toHaveText('Commencer');
  // Une leçon faite se rouvre d'un toucher sur sa pierre.
  await page.getByRole('button', { name: 'Leçon 1 : Libertés et capture, terminée' }).click();
  await expect(page.getByRole('heading', { name: 'Libertés et capture' })).toBeVisible();
});

test('leçon entamée : Mochi propose de la finir, le bouton dit « Reprendre »', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ouvrir(page, { l1: 6, l2: 2 });
  const carte = page.getByTestId('prochaine-lecon');
  await expect(carte.getByText('Tu l’avais commencée. On la finit ensemble ?')).toBeVisible();
  await expect(carte.getByRole('button', { name: 'Reprendre la leçon : Atari' })).toHaveText('Reprendre');
});

test('chapitre fini : tampon d’or, confettis une seule fois, la suite s’ouvre sur le chapitre 2', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await ouvrir(page, BASES);
  const bases = page.locator('[data-chapitre="c1"]');
  await expect(bases.getByRole('img', { name: 'Chapitre terminé : Les bases' })).toBeVisible();
  await expect(bases).toHaveAttribute('data-fete', 'true');
  await expect(page.getByTestId('confettis')).toBeAttached();
  await expect(bases.locator('.pierre-coche')).toHaveCount(7);
  await expect(bases.getByText('Chapitre terminé. Tu connais les règles du go !')).toBeVisible();
  // La fête se joue sur l'en-tête du chapitre, à l'écran.
  const r = (await bases.locator('.chapitre-fete').boundingBox())!;
  expect(r.y).toBeGreaterThanOrEqual(0);
  expect(r.y + r.height).toBeLessThanOrEqual(844);
  // La carte de la leçon 8 est bien là, plus bas.
  await expect(page.getByTestId('prochaine-lecon').getByRole('button', { name: 'Commencer la leçon : Les premiers coups' })).toBeAttached();
  // Une seule fois : au prochain passage, plus de confettis, le tampon reste.
  await page.waitForTimeout(1700);
  await page.reload();
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
  await expect(bases.getByRole('img', { name: 'Chapitre terminé : Les bases' })).toBeVisible();
  await expect(bases).not.toHaveAttribute('data-fete', 'true');
  await page.waitForTimeout(400);
  await expect(page.getByTestId('confettis')).toHaveCount(0);
});

// #343 : sans compte, les leçons 1 à 3 sont libres. La leçon 4 et les suivantes restent touchables et portent
// le verrou « compte » (silhouette + « Avec un compte ») ; les toucher ouvre la création de compte.
test('sans compte : leçons 1 à 3 libres, la leçon 4 porte le verrou « compte » et ouvre la création de compte', async ({ browser, baseURL }) => {
  const ctx = await browser.newContext({ viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', baseURL,
    colorScheme: 'light', reducedMotion: 'reduce', storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }] }] } });
  const page = await brancher(ctx, fauxServeur(), { 'go.lecons.v1': JSON.stringify(DEUX) });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
  // La leçon 3 (prochaine) est libre : pas de mention de compte sur sa carte.
  const carte = page.getByTestId('prochaine-lecon');
  await expect(carte.getByRole('button', { name: 'Leçon 3 : Techniques de capture, prochaine étape' })).toBeVisible();
  await expect(carte.locator('.pas-compte')).toHaveCount(0);
  // Leçons 4 à 16 : verrou « compte », jamais désactivées.
  const l4 = page.getByRole('button', { name: 'Leçon 4 : Le ko, avec un compte' });
  await expect(l4).toBeEnabled();
  await expect(l4).toHaveAttribute('data-compte', 'true');
  await expect(page.locator('.pierre-compte')).toHaveCount(13);
  await expect(l4.getByText('Avec un compte')).toBeVisible();
  await sansDebord(page);
  await l4.scrollIntoViewIfNeeded();
  if (process.env.CAPTURES) await page.screenshot({ path: `${DOSSIER}/compte-320-clair.jpg`, type: 'jpeg', quality: 70 });
  await l4.click();
  await expect(page.getByTestId('creer-compte')).toHaveAttribute('data-raison', 'lecons');
  await ctx.close();
});

test('chapitre fini, mouvements réduits : le tampon sans confettis', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ouvrir(page, BASES);
  await expect(page.locator('[data-chapitre="c1"]').getByRole('img', { name: 'Chapitre terminé : Les bases' })).toBeVisible();
  await page.waitForTimeout(400);
  await expect(page.getByTestId('confettis')).toHaveCount(0);
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
    const cta = page.locator('.cta-chemin');
    const r = (await cta.boundingBox())!;
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.x + r.width).toBeLessThanOrEqual(320);
  }
});

test('en anglais : chapitres, carte et verrous traduits', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(p => localStorage.setItem('go.lecons.v1', JSON.stringify(p)), DEUX);
  await page.goto('/?lang=en');
  await page.getByRole('navigation').getByRole('button', { name: 'Learn' }).click();
  const carte = page.getByTestId('prochaine-lecon');
  await expect(carte.getByText('Nice work! Here comes the next one.')).toBeVisible();
  await expect(carte.getByText('About 2 min')).toBeVisible();
  await expect(page.locator('[data-chapitre="c1"]').getByText('2 of 7')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Lesson 4: / })).toBeEnabled();
});

// Captures APRÈS, en JPEG (dossier léger) : les trois états en 390 et en 320, sombre et clair répartis.
const VUES = [
  ['premier', {}, 390, 'sombre'], ['premier', {}, 320, 'clair'],
  ['deux-lecons', DEUX, 390, 'clair'], ['deux-lecons', DEUX, 320, 'sombre'],
  ['chapitre-fini', BASES, 390, 'sombre'], ['chapitre-fini', BASES, 320, 'clair'],
] as const;

test('captures du chemin v3', async ({ page }) => {
  test.skip(!process.env.CAPTURES, 'captures à la demande');
  // Le tampon d'or du chapitre fini se capture à chaque passage : la fête n'est jamais mémorisée ici.
  await page.addInitScript(() => localStorage.removeItem('go.fetes-chapitres.v1'));
  for (const [nom, progres, largeur, theme] of VUES) {
    await page.emulateMedia({ colorScheme: theme === 'sombre' ? 'dark' : 'light', reducedMotion: 'reduce' });
    await page.setViewportSize({ width: largeur, height: largeur === 390 ? 844 : 568 });
    await ouvrir(page, progres);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${DOSSIER}/${nom}-${largeur}-${theme}.jpg`, type: 'jpeg', quality: 70 });
  }
});
