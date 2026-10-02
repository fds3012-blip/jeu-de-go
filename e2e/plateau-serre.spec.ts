import { expect, test, type Page } from '@playwright/test';
import { attendrePierre, fantome, plateau, point } from './plateau';

// Issue #400 : plateaux 13 × 13 à 320 px. Le lot X (#398) a apporté les premiers problèmes 13 × 13 (x04 à x08), qui
// passent aussi au Go du jour. À 320 × 568 les lignes n'étaient qu'à 19 px l'une de l'autre et une touche ratée comptait
// comme un essai faux. Désormais, en 13 × 13 et plus :
// - la première touche pose une pierre fantôme, même si « Confirmer au doigt » est coupé dans le Profil ; la seconde
//   touche, au même point, joue (comme l'écran de partie avec le réglage par défaut) ;
// - la visée trace la ligne et la colonne du point et allume « D » et « 10 » au bord : on lit le point sous le doigt ;
// - le plateau prend toute la largeur de la colonne (288 px au lieu de 268 px).
// Le 9 × 9 garde son comportement : un seul toucher quand le réglage est coupé, et pas de visée.
// Captures (JPEG) : docs/design/captures/noms-et-13x13.

const CAPTURES = 'docs/design/captures/noms-et-13x13';
// Horloge figée : le Go du jour n° 1 est le 27 septembre 2026 (e2e/go-du-jour.spec.ts) ; x04 est le n° 227.
const JOUR_1 = Date.parse('2026-09-27T12:00:00+02:00');
const jourDu = (numero: number) => new Date(JOUR_1 + (numero - 1) * 864e5);

async function ouvrirGoDuJour(page: Page, numero: number, largeur: number, hauteur: number, theme: 'light' | 'dark', confirmer: boolean) {
  await page.addInitScript(c => localStorage.setItem('go.settings.v1', JSON.stringify({ confirmTouch: c })), confirmer);
  await page.setViewportSize({ width: largeur, height: hauteur });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme });
  await page.clock.setFixedTime(jourDu(numero));
  await page.goto(`/?go-du-jour=${numero}`);
  await expect(page.getByText(new RegExp(`^Go du jour n°\\s${numero}$`))).toBeVisible();
}

/** Touche un point au doigt, décalé de (dx, dy) px : un doigt ne tombe jamais pile sur l'intersection. */
async function toucherA(page: Page, label: string, dx = 0, dy = 0) {
  const { x, y } = await point(page, label, 13);
  await page.touchscreen.tap(x + dx, y + dy);
}

const verdict = (page: Page) => page.locator('.verdict');

for (const [largeur, hauteur, theme] of [[320, 568, 'dark'], [320, 568, 'light'], [390, 844, 'light']] as const) {
  test(`Go du jour x04 en 13 × 13 au doigt, à ${largeur} × ${hauteur} (${theme === 'light' ? 'clair' : 'sombre'}) : visée, confirmation, aucune touche ratée`, async ({ page }) => {
    const erreurs: string[] = [];
    page.on('pageerror', e => erreurs.push(e.message));
    // « Confirmer au doigt » coupé dans le Profil : en 13 × 13, le problème demande quand même la seconde touche.
    await ouvrirGoDuJour(page, 227, largeur, hauteur, theme, false);
    await expect(page.getByRole('heading', { name: 'Le coin libre' })).toBeVisible();
    const svg = plateau(page, 13);
    await expect(svg).toBeVisible();

    // Mesures : écart entre deux lignes (cible d'un point), largeur du plateau, rien sous la barre ni de côté.
    const d10 = await point(page, 'D10', 13), d9 = await point(page, 'D9', 13), e10 = await point(page, 'E10', 13);
    const pas = Math.min(d9.y - d10.y, e10.x - d10.x);
    const box = (await svg.boundingBox())!;
    const colonne = (await page.locator('.lecteur').boundingBox())!;
    console.log(`[mesure] ${largeur}×${hauteur} : plateau ${box.width.toFixed(1)} px, ${pas.toFixed(1)} px entre deux lignes`);
    expect(box.width).toBeGreaterThanOrEqual(colonne.width - 1);
    expect(pas).toBeGreaterThanOrEqual(largeur === 320 ? 20 : 25);
    const debord = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(debord).toBeLessThanOrEqual(0);
    // La consigne de Mochi reste au-dessus de la barre de navigation.
    const bulle = (await page.locator('.lecteur-mochi .bubble').boundingBox())!;
    const nav = (await page.getByRole('navigation').boundingBox())!;
    expect(bulle.y + bulle.height).toBeLessThanOrEqual(nav.y);

    // 1re touche, à 6 px de D10 (doigt imprécis, moins d'une demi-case) : pierre fantôme et visée, rien n'est joué.
    await toucherA(page, 'D10', 6, -6);
    await expect(fantome(page, 13)).toHaveCount(1);
    const visee = svg.locator('[data-visee]');
    await expect(visee).toHaveAttribute('data-visee', 'D10');
    await attendrePierre(page, 'D10', null, 13);
    await expect(verdict(page)).toHaveCount(0);
    // Les étiquettes du bord : lisibles (au moins 9 px de texte, pastille d'au moins 14 px de haut).
    const lettre = (await visee.locator('text').first().boundingBox())!;
    const pastille = (await visee.locator('rect').first().boundingBox())!;
    console.log(`[mesure] étiquette de la visée : texte ${lettre.height.toFixed(1)} px, pastille ${pastille.width.toFixed(1)} × ${pastille.height.toFixed(1)} px`);
    expect(pastille.height).toBeGreaterThanOrEqual(14);
    if (largeur === 320) await page.screenshot({ path: `${CAPTURES}/x04-${largeur}-${theme}-visee.jpg`, type: 'jpeg', quality: 80 });

    // Le doigt glisse sur le point voisin (E9) : la pierre fantôme et la visée suivent, aucun essai n'est compté.
    await toucherA(page, 'E9', -5, 5);
    await expect(visee).toHaveAttribute('data-visee', 'E9');
    await attendrePierre(page, 'E9', null, 13);
    await expect(verdict(page)).toHaveCount(0);

    // Retour sur D10, puis seconde touche au même point : la pierre est jouée, et c'est la bonne réponse.
    await toucherA(page, 'D10', -4, 4);
    await expect(visee).toHaveAttribute('data-visee', 'D10');
    await toucherA(page, 'D10', 3, 5);
    await attendrePierre(page, 'D10', 'noir', 13);
    await expect(verdict(page).first()).toContainText('Bravo');
    await expect(page.getByText(/Pas tout à fait/)).toHaveCount(0);
    await expect(svg.locator('[data-visee]')).toHaveCount(0);
    await expect(fantome(page, 13)).toHaveCount(0);
    if (largeur === 320) await page.screenshot({ path: `${CAPTURES}/x04-${largeur}-${theme}-reussi.jpg`, type: 'jpeg', quality: 80 });
    expect(erreurs).toEqual([]);
  });
}

test('9 × 9 inchangé : réglage coupé, un seul toucher joue, sans visée', async ({ page }) => {
  // Go du jour n° 1 : b1, réponse E5 (e2e/go-du-jour.spec.ts).
  await ouvrirGoDuJour(page, 1, 320, 568, 'dark', false);
  const svg = plateau(page, 9);
  await expect(svg).toBeVisible();
  const { x, y } = await point(page, 'E5', 9);
  await page.touchscreen.tap(x, y);
  await attendrePierre(page, 'E5', 'noir', 9);
  await expect(svg.locator('[data-visee]')).toHaveCount(0);
});

test('9 × 9 avec le réglage par défaut : pierre fantôme puis seconde touche, toujours sans visée', async ({ page }) => {
  await ouvrirGoDuJour(page, 1, 320, 568, 'light', true);
  const svg = plateau(page, 9);
  const { x, y } = await point(page, 'E5', 9);
  await page.touchscreen.tap(x, y);
  await expect(fantome(page, 9)).toHaveCount(1);
  await expect(svg.locator('[data-visee]')).toHaveCount(0);
  await page.touchscreen.tap(x, y);
  await attendrePierre(page, 'E5', 'noir', 9);
});
