import { expect, test, type Page } from '@playwright/test';
import { SCENARIO } from '../src/content/decouverte';
import { attendrePierre, jouer, ouvrirAvecMochi, pierres, plateau } from './plateau';
import { avancerJusqua, faireMoment, ouvrirDepuisApprendre, surMoment } from './decouverte';

// #524 : partie guidée de découverte. Parcours complet depuis Apprendre, avec de bons et de mauvais coups (Mochi
// explique, le joueur rejoue, rien ne bloque), reprise après un rechargement, et fin qui ramène à « Jouer avec Mochi ».
// CAPTURES_DIR=… : enregistre les captures des moments clés (revue de design), hors CI.

const bulle = (page: Page) => page.locator('.decouverte .mochi-bulle');
const notions = (page: Page) => page.getByTestId('decouverte-notions');

async function capture(page: Page, nom: string) {
  const dir = process.env.CAPTURES_DIR;
  if (!dir) return;
  const { width } = page.viewportSize()!;
  await page.screenshot({ path: `${dir}/${nom}-${width}.png` });
}

for (const largeur of [390, 320] as const) {
  test(`parcours complet de la découverte, bons et mauvais coups, jusqu’au comptage (${largeur} px)`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: largeur, height: largeur === 320 ? 568 : 844 });
    await page.goto('/');
    await ouvrirDepuisApprendre(page);

    // 1. Poser : un seul repère, aucune action à part le plateau, la progression visible.
    await surMoment(page, 'poser');
    await expect(page.getByRole('heading', { level: 2, name: 'Poser une pierre' })).toBeVisible();
    await expect(notions(page)).toHaveText('1 / 15 notions');
    await expect(page.locator('.decouverte .cta')).toHaveCount(0);
    await expect(page.locator('.halos')).toHaveAttribute('data-repere', 'E5');
    await capture(page, '01-poser');
    // Un coup ailleurs : Mochi explique, le plateau reste jouable, aucune pierre n'est posée.
    await jouer(page, 'A1');
    await expect(bulle(page)).toContainText('pose ta pierre au point marqué');
    await attendrePierre(page, 'A1', null);
    await faireMoment(page, 0);

    // 2. Libertés : 3 points verts ; une autre liberté est « bien vue », puis le repère.
    await expect(notions(page)).toHaveText('2 / 15 notions');
    await expect(bulle(page)).toContainText('elle en a 3.');
    await capture(page, '02-libertes');
    await jouer(page, 'C5');
    await expect(bulle(page)).toContainText('Bien vu, c’est aussi une de ses libertés.');
    await capture(page, '02-libertes-erreur');
    await faireMoment(page, 1);

    // 3. Atari, 4. capture : le premier prisonnier.
    await faireMoment(page, 2);
    await surMoment(page, 'capture');
    await jouer(page, 'C5');
    await expect(bulle(page)).toContainText('c’est ton prisonnier');
    await attendrePierre(page, 'D5', null);
    await capture(page, '04-capture');
    await page.locator('.decouverte .cta').click();

    // 5. Se sauver : un coup ailleurs laisserait la pierre en atari.
    await faireMoment(page, SCENARIO.findIndex(m => m.id === 'sauver'));
    await surMoment(page, 'sauver2');
    await expect(bulle(page)).toContainText('Atari sur ta pierre');
    await jouer(page, 'A9');
    await expect(bulle(page)).toContainText('toujours en atari');
    await jouer(page, 'G6');
    await expect(bulle(page)).toContainText('3 libertés');
    await page.locator('.decouverte .cta').click();

    // 6. Couper, 7. échelle : l'atari du mauvais côté laisse Mochi s'échapper ; du bon côté, 3 pierres tombent.
    await faireMoment(page, SCENARIO.findIndex(m => m.id === 'couper'));
    await surMoment(page, 'echelle');
    await expect(notions(page)).toHaveText('7 / 15 notions');
    await jouer(page, 'E6');
    await expect(bulle(page)).toContainText('je m’échappe');
    await capture(page, '07-echelle-erreur');
    await faireMoment(page, SCENARIO.findIndex(m => m.id === 'echelle'));
    await jouer(page, 'E7');
    await expect(bulle(page)).toContainText('Tu as maintenant 4 prisonniers.');
    for (const p of ['F5', 'F6', 'E6']) await attendrePierre(page, p, null);
    await page.locator('.decouverte .cta').click();

    // 8 à 10 : relier, territoire, puis le ko : la reprise immédiate est refusée par la règle.
    await avancerJusqua(page, 'ko2');
    await expect(page.getByRole('heading', { level: 2, name: 'Le ko' })).toBeVisible();
    await capture(page, '10-ko');
    await jouer(page, 'G2');
    await surMoment(page, 'ko3');
    await expect(bulle(page)).toContainText('c’est le ko, sinon');
    // Encore trop tôt : refusé de nouveau, avec la règle.
    await jouer(page, 'G2');
    await expect(bulle(page)).toContainText('Pas encore');
    await attendrePierre(page, 'G2', null);
    await avancerJusqua(page, 'yeux');

    // 11. Deux yeux : jouer dans un œil est interdit ; 12. frontière ouverte, points rouges.
    await expect(page.locator('.halos')).toHaveAttribute('data-repere', 'H8 J9');
    await capture(page, '11-yeux');
    await jouer(page, 'J9');
    await surMoment(page, 'yeux2');
    await expect(bulle(page)).toContainText('il est vivant');
    await attendrePierre(page, 'J9', null);
    await page.locator('.decouverte .cta').click();
    await surMoment(page, 'frontiere');
    await expect(plateau(page).locator('[data-frontieres] *').first()).toBeAttached();
    await capture(page, '12-frontiere');
    await faireMoment(page, SCENARIO.findIndex(m => m.id === 'frontiere'));

    // 13. Groupe mort : on n'y répond pas. Un coup contre elle, dans son territoire, coûte 1 point : Mochi le dit.
    await surMoment(page, 'mort');
    await expect(bulle(page)).toContainText('elle est morte');
    await expect(bulle(page)).toContainText('Pas besoin de répondre');
    await expect(page.locator('.decouverte .cta')).toHaveText('Passer');
    await capture(page, '13-mort');
    await jouer(page, 'D3');
    await expect(bulle(page)).toContainText('te coûte même 1 point');
    await attendrePierre(page, 'D3', null);
    await expect(pierres(page, 'noir')).toHaveCount(18);
    await capture(page, '13-mort-erreur');
    // 14. Passer : Mochi passe aussi, la partie s'arrête.
    await page.getByRole('button', { name: 'Passer', exact: true }).click();
    await surMoment(page, 'passer');
    await expect(bulle(page)).toContainText('Je passe aussi');
    await capture(page, '14-passer');
    await page.locator('.decouverte .cta').click();

    // 15. Comptage pas à pas : pierre morte, territoire, prisonniers, Blanc, komi, résultat.
    await surMoment(page, 'compte');
    await expect(notions(page)).toHaveText('15 / 15 notions');
    await page.locator('.decouverte .cta').click();
    await surMoment(page, 'compte2');
    await expect(bulle(page)).toContainText('Tu en as 39.');
    await capture(page, '15-territoire');
    for (const id of ['compte3', 'compte4', 'compte5']) { await page.locator('.decouverte .cta').click(); await surMoment(page, id); }
    await expect(page.locator('.decouverte .cta')).toHaveText('Voir le résultat');
    await capture(page, '15-komi');
    await page.locator('.decouverte .cta').click();
    await surMoment(page, 'compte6');
    await expect(bulle(page)).toContainText('tu gagnes de 26,5 points');
    await capture(page, '15-resultat');
    await page.locator('.decouverte .cta').click();

    // Fin : victoire, XP d'une leçon, une seule action ; la suite ramène à « Jouer avec Mochi ».
    await expect(page.getByRole('heading', { name: 'Victoire !'.replace(' !', ' !') })).toBeVisible();
    await expect(page.getByTestId('fin-decouverte').locator('.xp-en-ligne')).toContainText('XP');
    await expect(page.locator('.cta')).toHaveCount(1);
    await capture(page, '16-fin');
    await page.getByRole('button', { name: 'Continuer' }).click();
    await expect(page.getByTestId('carte-decouverte')).toHaveAttribute('data-etat', 'finie');
    await expect(page.getByTestId('carte-decouverte')).toContainText('Rejouer');
    expect(JSON.parse((await page.evaluate(() => localStorage.getItem('go.decouverte.v1')))!)).toEqual({ etape: 0, fini: true });
  });
}

test('reprise après un rechargement : même moment, même position, Mochi le dit ; « Quitter » ramène à Jouer avec Mochi', async ({ page }) => {
  await page.goto('/');
  await ouvrirDepuisApprendre(page);
  for (let i = 0; i < 3; i++) await faireMoment(page, i);
  await surMoment(page, 'capture');
  await page.reload();
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
  await ouvrirAvecMochi(page);
  await expect(page.getByTestId('carte-decouverte')).toHaveAttribute('data-etat', 'encours');
  await expect(page.getByTestId('carte-decouverte')).toContainText('Reprendre');
  await page.getByTestId('carte-decouverte').click();
  await surMoment(page, 'capture');
  await expect(bulle(page)).toContainText('On reprend là où tu t’étais arrêté.');
  await expect(notions(page)).toHaveText('4 / 15 notions');
  for (const [p, c] of [['E5', 'noir'], ['D6', 'noir'], ['D4', 'noir'], ['D5', 'blanc'], ['G4', 'blanc'], ['H7', 'blanc']] as const) await attendrePierre(page, p, c);
  await page.getByRole('button', { name: 'Quitter la partie de découverte' }).click();
  await expect(page.getByTestId('carte-decouverte')).toBeVisible();
});

test('au doigt : la seconde touche confirme, comme dans une partie', async ({ page }) => {
  await page.goto('/');
  await ouvrirDepuisApprendre(page);
  const { point } = await import('./plateau');
  const { x, y } = await point(page, 'E5');
  await page.touchscreen.tap(x, y);
  await expect(plateau(page).locator('g[data-fantome]')).toHaveCount(1);
  await page.touchscreen.tap(x, y);
  await expect(bulle(page)).toContainText('Bien posée');
});
