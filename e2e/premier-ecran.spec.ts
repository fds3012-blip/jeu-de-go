import { expect, test, type Page } from '@playwright/test';
import { boutonPasser, choisirMode, coupsJoues, jouer, passer, plateau, toucher } from './plateau';
import { GO_DU_JOUR } from '../src/content/goDuJour.gen';

// #487 (rapport docs/ux/premieres-minutes-2026-10.md, P9, P10, P12).
// P9 : au tout premier lancement, aucune pierre jamais posée sur l'appareil : ni tuiles de modes (dont la partie
// classée) ni cartes secondaires. Une seule action, « Joue ta première partie », et « Je sais déjà jouer » discret.
// Dès la première pierre posée, n'importe où (partie, leçon…), l'accueil redevient complet.
// P10 : « Passer » sans fond plein tant que la partie n'est pas mûre ; plein dès que l'adversaire a passé.
// P12 : le titre du Go du jour n'est plus coupé (une colonne quand la tuile n'est pas mise en avant).

const CAPTURES = process.env.CAPTURES_487;
const TAILLES = [{ width: 390, height: 844 }, { width: 320, height: 568 }] as const;
const THEMES = ['dark', 'light'] as const;
const nomTheme = (t: (typeof THEMES)[number]) => (t === 'dark' ? 'sombre' : 'clair');

async function capturer(page: Page, nom: string) {
  if (CAPTURES) await page.screenshot({ path: `${CAPTURES}/${nom}.png` });
}

/** Accueil épuré : le bouton, « Je sais déjà jouer », rien d'autre à choisir. */
async function accueilEpure(page: Page) {
  await expect(page.locator('.accueil[data-epure]')).toBeVisible();
  await expect(page.locator('.cta')).toHaveText('Joue ta première partie');
  await expect(page.getByTestId('modes')).toHaveCount(0);
  await expect(page.locator('.tuile')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Go du jour/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Leçon 1 sur/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Je sais déjà jouer' })).toBeVisible();
}

/** Accueil complet : la rangée des modes et les tuiles du jour. */
async function accueilComplet(page: Page) {
  await expect(page.locator('.accueil')).toBeVisible();
  await expect(page.locator('.accueil[data-epure]')).toHaveCount(0);
  await expect(page.getByTestId('modes')).toBeVisible();
  await expect(page.getByTestId('mode-deux')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Go du jour n°/ })).toBeVisible();
}

for (const taille of TAILLES) {
  for (const theme of THEMES) {
    test(`premier lancement : une seule action, aucune tuile (${taille.width} px, ${nomTheme(theme)})`, async ({ page }) => {
      await page.setViewportSize(taille);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.goto('/');
      await accueilEpure(page);
      // Le bouton et le lien tiennent au-dessus de la barre du bas, sans défilement horizontal.
      const [cta, lien, nav] = await Promise.all([page.locator('.cta').boundingBox(), page.getByRole('button', { name: 'Je sais déjà jouer' }).boundingBox(),
        page.getByRole('navigation').boundingBox()]);
      expect(cta!.height).toBeGreaterThanOrEqual(44);
      expect(lien!.height).toBeGreaterThanOrEqual(44);
      expect(lien!.y + lien!.height).toBeLessThanOrEqual(nav!.y + 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(taille.width);
      await capturer(page, `accueil-premier-${taille.width}-${nomTheme(theme)}`);
    });
  }
}

test('première pierre en partie, retour à l’accueil : il est complet', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await accueilEpure(page);
  await page.locator('.cta').tap();
  await expect(plateau(page)).toBeVisible();
  await expect(boutonPasser(page)).toBeEnabled({ timeout: 30_000 });
  // Au doigt : une première touche (pierre fantôme), puis la seconde pose la pierre.
  await toucher(page, 'E5');
  await toucher(page, 'E5');
  await expect(plateau(page).locator('g[data-pierre="noir"]')).toHaveCount(1);
  expect(await page.evaluate(() => localStorage.getItem('go.premiere-pierre.v1'))).toBe('true');
  await page.getByRole('button', { name: 'Retour à l\'accueil' }).click();
  const quitter = page.getByRole('group', { name: /Quitter/ });
  if (await quitter.count()) await quitter.getByRole('button').first().click();
  await accueilComplet(page);
  // Et au rechargement aussi.
  await page.reload();
  await accueilComplet(page);
});

test('la pierre fantôme seule ne compte pas ; une pierre posée en leçon complète l’accueil', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await accueilEpure(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
  await page.getByRole('button', { name: 'Commencer' }).click();
  await expect(page.locator('.lecteur-plateau')).toHaveAttribute('data-demo', 'geste');
  // Un toucher, sans confirmer : rien n'est posé, l'accueil reste épuré.
  await toucher(page, 'E5');
  expect(await page.evaluate(() => localStorage.getItem('go.premiere-pierre.v1'))).toBeNull();
  await jouer(page, 'E5');
  await expect(page.locator('.lecteur-plateau')).toHaveAttribute('data-demo', 'finie');
  await page.getByRole('navigation').getByRole('button', { name: 'Jouer' }).click();
  await accueilComplet(page);
  // Le tout premier lancement reste « première partie » contre Pomme (pas de partie jouée, #432 inchangé).
  await expect(page.locator('.cta')).toHaveAttribute('data-mode', 'ordi');
});

test('un joueur d’avant ce changement (parties gardées, sans repère) garde l’accueil complet', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('go.parties.v1', JSON.stringify({ n: 2, dernier: 'pomme', ordi: 2 }));
    localStorage.setItem('go.bilan.v1', JSON.stringify({ pomme: { v: 0, d: 2 } }));
  });
  await page.goto('/');
  await accueilComplet(page);
});

/** Le fond de « Passer » : transparent (discret) ou plein. */
const fond = (page: Page) => boutonPasser(page).evaluate(b => getComputedStyle(b).backgroundColor);
const transparent = /^rgba\(0, 0, 0, 0\)$|^transparent$/;

for (const theme of THEMES) {
  test(`« Passer » discret au début, plein quand l’adversaire a passé (${nomTheme(theme)})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.goto('/');
    await choisirMode(page, 'deux');
    await expect(plateau(page)).toBeVisible();
    const bouton = boutonPasser(page);
    await expect(bouton).toBeEnabled();
    // Coup 0 : sans fond plein, mais un contour, 44 px, texte lisible, même place que plus tard.
    await expect(bouton).toHaveClass(/\bdiscret\b/);
    expect(await fond(page)).toMatch(transparent);
    const avant = await bouton.boundingBox();
    expect(avant!.height).toBeGreaterThanOrEqual(44);
    expect(avant!.width).toBeGreaterThanOrEqual(44);
    const styles = await bouton.evaluate(b => { const s = getComputedStyle(b); return { contour: s.boxShadow, couleur: s.color }; });
    expect(styles.contour).toContain('inset');
    await capturer(page, `passer-discret-${nomTheme(theme)}`);
    // Quelques coups : toujours discret.
    await jouer(page, 'C3'); await jouer(page, 'G7');
    await expect(coupsJoues(page)).toHaveCount(2);
    await expect(bouton).toHaveClass(/\bdiscret\b/);
    // Noir passe : à Blanc, passer finit la partie : « Passer » reprend son fond plein, à la même place.
    await passer(page);
    await expect(bouton).not.toHaveClass(/\bdiscret\b/);
    expect(await fond(page)).not.toMatch(transparent);
    const apres = await bouton.boundingBox();
    expect(Math.abs(apres!.x - avant!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(apres!.width - avant!.width)).toBeLessThanOrEqual(1);
    await capturer(page, `passer-plein-${nomTheme(theme)}`);
    // Blanc joue : la partie continue, « Passer » redevient discret.
    await jouer(page, 'C7');
    await expect(bouton).toHaveClass(/\bdiscret\b/);
  });
}

test('« Passer » discret en 320 px : la barre tient, cible de 44 px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('.cta').tap();
  await expect(plateau(page)).toBeVisible();
  await expect(boutonPasser(page)).toBeEnabled({ timeout: 30_000 });
  await expect(boutonPasser(page)).toHaveClass(/\bdiscret\b/);
  const b = await boutonPasser(page).boundingBox();
  expect(b!.height).toBeGreaterThanOrEqual(44);
  expect(b!.x + b!.width).toBeLessThanOrEqual(320);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

for (const largeur of [390, 320] as const) {
  test(`Go du jour : titre entier, en deux lignes au plus, dans sa tuile (${largeur} px)`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: largeur === 320 ? 568 : 844 });
    // Première pierre posée (leçon commencée), aucune partie : la tuile du Go du jour n'est pas mise en avant.
    await page.addInitScript(() => localStorage.setItem('go.premiere-pierre.v1', 'true'));
    await page.goto('/');
    const titre = page.locator('.tuile-probleme b');
    await expect(titre).toBeVisible();
    for (const [, t] of GO_DU_JOUR) {
      const m = await titre.evaluate((b, x) => {
        b.textContent = x;
        const r = b.getBoundingClientRect(), tuile = b.closest('.tuile')!.getBoundingClientRect();
        return { lignes: Math.round(r.height / parseFloat(getComputedStyle(b).lineHeight)), dedans: r.right <= tuile.right + 0.5 && r.bottom <= tuile.bottom + 0.5 };
      }, t);
      expect(m.lignes, `« ${t} »`).toBeLessThanOrEqual(2);
      expect(m.dedans, `« ${t} »`).toBe(true);
    }
  });
}

// Bandeau de consentement (#485) au tout premier écran : sans tuiles, le goban ne doit plus pousser l'action principale
// dessous. « Joue ta première partie » reste entière au-dessus du bandeau, avec 8 px d'air au moins.
test.describe('au-dessus du bandeau de consentement', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  for (const [largeur, hauteur] of [[320, 568], [360, 640], [375, 667], [390, 844], [412, 915]] as const) {
    test(`${largeur} × ${hauteur} : « jouer » entier au-dessus du bandeau, sombre et clair, fr et en`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: hauteur });
      for (const theme of THEMES) {
        await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
        for (const adresse of ['/', '/?lang=en']) {
          await page.goto(adresse);
          const accord = page.locator('.accord[open]');
          await expect(accord).toBeVisible();
          await expect(page.locator('.accueil[data-epure]')).toBeVisible();
          await accord.evaluate(el => Promise.all(el.getAnimations({ subtree: true }).map(a => a.finished)));
          const m = await page.evaluate(() => ({
            cta: document.querySelector('.cta')!.getBoundingClientRect().bottom,
            bandeau: document.querySelector('.accord')!.getBoundingClientRect().top,
          }));
          expect(m.bandeau - m.cta, `${nomTheme(theme)} ${adresse} ${JSON.stringify(m)}`).toBeGreaterThanOrEqual(8);
        }
      }
    });
  }
});
