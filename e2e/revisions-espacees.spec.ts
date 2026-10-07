import { expect, test, type Page } from '@playwright/test';
import { jouer } from './plateau';

// Issue #469 : révision espacée. Un joueur qui revient a une erreur de partie (« Tes erreurs à rejouer », réponse E3)
// et un problème raté au premier essai (b1, réponse E5), tous deux dus. Sur l'accueil, la carte « Révisions du jour (2) »
// est secondaire, dans « Aujourd'hui » ; la séance les enchaîne ; réussi, l'élément passe à J+3 ; raté, il revient demain.

const ROWS = ['.........', '.........', '..O...X..', '.........', '....X....', '.........', '..X...O..', '.........', '.........'];
const ERREUR = {
  id: 'erreur-test', creeLe: '2026-01-01T10:00:00.000Z', prochain: '2026-01-01', rates: 1, reussites: 0, maj: 1,
  size: 9, rows: ROWS, toPlay: 1, reponses: [6 * 9 + 4], joue: 0, coup: 14, adversaire: 'Pomme',
};
const REVISIONS = { problemes: { b1: { etape: 0, prochain: '2026-01-01', echecs: 1, maj: 1 } }, acquises: {} };

async function preremplir(page: Page) {
  await page.addInitScript(([e, r]) => {
    if (sessionStorage.getItem('revisions-pretes')) return;
    localStorage.setItem('go.parties.v1', JSON.stringify({ n: 1, dernier: 'pomme', ordi: 1 }));
    localStorage.setItem('go.bilan.v1', JSON.stringify({ pomme: { v: 0, d: 1 } }));
    localStorage.setItem('go.erreurs.v1', JSON.stringify([e]));
    localStorage.setItem('go.revisions.v1', JSON.stringify(r));
    // Le bonus « premier problème » est déjà pris : la séance rapporte ses 20 XP, rien de plus.
    localStorage.setItem('go.xp.premieres.v1', JSON.stringify(['probleme', 'partie']));
    sessionStorage.setItem('revisions-pretes', '1');
  }, [ERREUR, REVISIONS] as const);
}

const dansJours = (page: Page, n: number) => page.evaluate(k => {
  const d = new Date(); d.setDate(d.getDate() + k);
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
}, n);

async function sansDebord(page: Page, ecran: string) {
  const m = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(m.scroll, `${ecran} : défilement horizontal`).toBeLessThanOrEqual(m.client);
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('séance des révisions du jour : la carte, deux éléments, le bilan, le calendrier', async ({ page }) => {
  await preremplir(page);
  await page.goto('/');

  // Une seule action principale : la carte est une tuile secondaire du groupe « Aujourd'hui ».
  const carte = page.getByTestId('tuile-revisions');
  await expect(carte).toBeVisible();
  await expect(carte).toHaveAccessibleName(/Révisions du jour \(2\)/);
  await expect(page.locator('.tuiles').getByTestId('tuile-revisions')).toHaveCount(1);
  await expect(page.locator('.cta')).toHaveCount(1);
  await expect(carte).not.toHaveClass(/tuile-avant/);
  expect((await carte.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await sansDebord(page, 'accueil');

  await carte.click();
  // 1. L'erreur de partie (à retard égal, elle passe avant le problème). Trouvée du premier coup.
  await expect(page.getByText('Révision 1 sur 2')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ta partie contre Pomme, coup 14' })).toBeVisible();
  await expect(page).toHaveTitle(/Révisions du jour/);
  await jouer(page, 'E3');
  await expect(page.getByText('Bravo, c’est le coup de KataGo !')).toBeVisible();
  await page.getByRole('button', { name: 'Révision suivante' }).click();

  // 2. Le problème raté : encore raté au premier essai, puis trouvé.
  await expect(page.getByText('Révision 2 sur 2')).toBeVisible();
  await jouer(page, 'A1');
  await expect(page.locator('.lecteur').getByText(/Rejoue directement sur le plateau/)).toBeVisible();
  await jouer(page, 'E5');
  await page.getByRole('button', { name: 'Voir mon bilan' }).click();

  // Bilan : le score, l'XP (une fois par jour), l'échelle des intervalles expliquée.
  await expect(page.getByRole('heading', { name: '1 sur 2 du premier coup' })).toBeVisible();
  await expect(page.getByText('+20 XP')).toBeVisible();
  await expect(page.getByText(/chaque position revient après 1, 3, 7, 14 puis 30 jours/)).toBeVisible();
  await sansDebord(page, 'bilan');
  expect(await page.evaluate(() => localStorage.getItem('go.xp.v1'))).toBe('20');

  // Calendrier : l'erreur réussie monte à J+3 ; le problème raté revient demain, au pied de l'échelle.
  const erreurs = await page.evaluate(() => JSON.parse(localStorage.getItem('go.erreurs.v1') ?? '[]'));
  expect(erreurs[0]).toMatchObject({ id: 'erreur-test', reussites: 1, prochain: await dansJours(page, 3) });
  const etat = await page.evaluate(() => JSON.parse(localStorage.getItem('go.revisions.v1') ?? 'null'));
  expect(etat.problemes.b1).toMatchObject({ etape: 0, echecs: 2, prochain: await dansJours(page, 1) });

  // Retour à l'accueil : plus rien à revoir aujourd'hui, la carte disparaît.
  await page.getByRole('button', { name: 'Retour à l’accueil' }).last().click();
  await expect(page.locator('.cta')).toBeVisible();
  await expect(page.getByTestId('tuile-revisions')).toHaveCount(0);

  // Une deuxième séance le même jour ne rapporterait plus d'XP : l'XP du jour est notée.
  expect(etat.xpLe).toBe(await dansJours(page, 0));
});

test('un problème raté au premier essai dans l’onglet Problèmes entre dans la file (J+1)', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Problèmes' }).click();
  await page.getByRole('button', { name: /Tous les problèmes/ }).click();
  await page.locator('button[data-probleme="b1"]').click();
  await jouer(page, 'A1');
  const etat = await page.evaluate(() => JSON.parse(localStorage.getItem('go.revisions.v1') ?? 'null'));
  expect(etat.problemes.b1).toMatchObject({ etape: 0, echecs: 1, prochain: await dansJours(page, 1) });
});

test('premier lancement : pas de carte de révisions', async ({ page }) => {
  await page.addInitScript(e => localStorage.setItem('go.erreurs.v1', JSON.stringify([e])), ERREUR);
  await page.goto('/');
  await expect(page.locator('.cta')).toBeVisible();
  await expect(page.getByTestId('tuile-revisions')).toHaveCount(0);
});

// Zoom 200 % (195 px) et 320 px, polices web bloquées (police de repli, plus large) : rien ne déborde.
for (const cas of [{ l: 195, h: 422 }, { l: 320, h: 640 }]) {
  test(`à ${cas.l} px, polices bloquées : carte et séance sans défilement horizontal`, async ({ page }) => {
    await page.route(/\.(woff2?|ttf|otf)(\?|$)/, r => r.abort());
    await page.setViewportSize({ width: cas.l, height: cas.h });
    await preremplir(page);
    await page.goto('/');
    const carte = page.getByTestId('tuile-revisions');
    await carte.scrollIntoViewIfNeeded();
    await expect(carte).toBeVisible();
    await sansDebord(page, `accueil ${cas.l} px`);
    await carte.click();
    await expect(page.getByText('Révision 1 sur 2')).toBeVisible();
    // Le titre garde la largeur d'un mot : il n'est plus écrasé entre le retour et l'aide.
    expect((await page.locator('.lecteur-nom').boundingBox())!.width).toBeGreaterThan(cas.l / 2);
    await sansDebord(page, `séance ${cas.l} px`);
  });
}

// Captures (docs/design/v2/captures/revisions-*.png) : `CAPTURES=1 npx playwright test e2e/revisions-espacees.spec.ts`.
for (const theme of ['dark', 'light'] as const) {
  test(`captures de la carte, de la séance et du bilan (${theme})`, async ({ page }) => {
    test.skip(!process.env.CAPTURES, 'captures à la demande');
    const nom = theme === 'dark' ? 'sombre' : 'clair';
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await preremplir(page);
    await page.goto('/');
    const carte = page.getByTestId('tuile-revisions');
    await carte.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `docs/design/v2/captures/revisions-accueil-${nom}.png` });
    await carte.click();
    await expect(page.getByText('Révision 1 sur 2')).toBeVisible();
    await page.screenshot({ path: `docs/design/v2/captures/revisions-seance-${nom}.png` });
    await jouer(page, 'E3');
    await page.getByRole('button', { name: 'Révision suivante' }).click();
    await jouer(page, 'E5');
    await page.getByRole('button', { name: 'Voir mon bilan' }).click();
    await expect(page.getByRole('heading', { name: /du premier coup/ })).toBeVisible();
    await page.screenshot({ path: `docs/design/v2/captures/revisions-bilan-${nom}.png` });
  });
}
