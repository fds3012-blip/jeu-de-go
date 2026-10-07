import { expect, test, type Page } from '@playwright/test';
import { fantome, jouer, plateau, point, toucher } from './plateau';

// #454 : lecteur de leçons sur 13 × 13 (entier et cadré) et 19 × 19 cadré sur un coin, avec les leçons d'essai
// internes (content/lessons.essai.js, `?lecon-essai=13|19`, build de test seulement). 390 et 320 px, clair et sombre,
// confirmation au doigt, coordonnées et hoshi du vrai plateau, zoom 200 % sans débord, polices web bloquées.

async function sansDebord(page: Page, ecran: string) {
  const m = await page.evaluate(() => ({ large: document.documentElement.scrollWidth, fenetre: document.documentElement.clientWidth }));
  expect(m.large, `défilement horizontal : ${ecran}`).toBeLessThanOrEqual(m.fenetre);
}

/** Lettres et chiffres écrits autour du plateau. */
async function coordonnees(page: Page, taille: number) {
  const t = await plateau(page, taille).locator('.coord text').allTextContents();
  return { lettres: t.filter(x => /^[A-T]$/.test(x)), chiffres: t.filter(x => /^\d+$/.test(x)).map(Number) };
}

/** Écart entre deux intersections voisines, en pixels CSS. */
async function pas(page: Page, taille: number, a: string, b: string) {
  const [p, q] = [await point(page, a, taille), await point(page, b, taille)];
  return Math.hypot(q.x - p.x, q.y - p.y);
}

const continuer = (page: Page) => page.getByRole('button', { name: 'Continuer' }).click();

for (const [largeur, hauteur, theme] of [[390, 844, 'light'], [320, 568, 'dark']] as const) {
  test(`essai 13 × 13 : plateau entier puis coin cadré, ${largeur} px, ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: hauteur });
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme });
    // Réglage « Confirmer au doigt » coupé : sur 13 × 13 entier, la seconde touche reste demandée.
    await page.addInitScript(() => localStorage.setItem('go.settings.v1', JSON.stringify({ confirmTouch: false })));
    await page.goto('/?lecon-essai=13');
    const board = plateau(page, 13);
    await expect(board).toBeVisible();
    await expect(board).not.toHaveAttribute('data-fenetre');
    expect((await coordonnees(page, 13)).lettres).toEqual([...'ABCDEFGHJKLMN']);
    await sansDebord(page, 'étape 1');

    // Geste au doigt : première touche = pierre fantôme, seconde = pose.
    await toucher(page, 'D4', 13);
    await expect(fantome(page, 13)).toHaveCount(1);
    await expect(board.locator('[data-pierre="noir"]')).toHaveCount(0);
    await toucher(page, 'D4', 13);
    await expect(board.locator('[data-point="D4"][data-pierre="noir"]')).toHaveCount(1);
    await continuer(page);

    // Coup libre, à la souris (pas de seconde touche) : un autre coin.
    await jouer(page, 'D10', 13);
    await expect(page.locator('.verdict-juste')).toBeVisible();
    await continuer(page);

    // Coin cadré du 13 × 13 : A à H, lignes 1 à 8.
    await expect(board).toHaveAttribute('data-fenetre', 'A8:H1');
    const c = await coordonnees(page, 13);
    expect(c.lettres).toEqual([...'ABCDEFGH']);
    expect(c.chiffres).toEqual([8, 7, 6, 5, 4, 3, 2, 1]);
    // Intersections assez grandes au doigt dans la zone cadrée.
    expect(await pas(page, 13, 'D4', 'E4')).toBeGreaterThanOrEqual(largeur >= 390 ? 36 : 29);
    await toucher(page, 'D4', 13);
    await expect(page.locator('.verdict-juste')).toBeVisible();
    await sansDebord(page, 'étape 3');
    await page.getByRole('button', { name: 'Terminer' }).click();
    await expect(page.locator('.fin-lecon')).toBeVisible();
  });

  test(`essai 19 × 19 cadré sur un coin, ${largeur} px, ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: hauteur });
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme });
    await page.goto('/?lecon-essai=19');
    const board = plateau(page, 19);
    await expect(board).toHaveAttribute('data-fenetre', 'A10:K1');
    const c = await coordonnees(page, 19);
    expect(c.lettres).toEqual([...'ABCDEFGHJK']);
    expect(c.chiffres).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    // Les pierres blanches des autres coins existent mais restent hors de la zone montrée.
    await expect(board.locator('[data-pierre="blanc"]')).toHaveCount(3);
    expect(await pas(page, 19, 'D4', 'E4')).toBeGreaterThanOrEqual(largeur >= 390 ? 31 : 23);
    await sansDebord(page, '19 cadré, étape 1');

    // Geste au doigt avec confirmation (réglage par défaut).
    await toucher(page, 'D4', 19);
    await expect(fantome(page, 19)).toHaveCount(1);
    await toucher(page, 'D4', 19);
    await expect(board.locator('[data-point="D4"][data-pierre="noir"]')).toHaveCount(1);
    await continuer(page);

    // Toucher hors de la zone (une pierre coupée par le cadre, ligne 11) ne fait rien ; le 3-3 est juste.
    await toucher(page, 'C3', 19);
    await toucher(page, 'C3', 19);
    await expect(page.locator('.verdict-juste')).toBeVisible();
    await continuer(page);

    // Coin de 9 lignes : A à J, 1 à 9.
    await expect(board).toHaveAttribute('data-fenetre', 'A9:J1');
    await jouer(page, 'C4', 19);
    await expect(page.locator('.verdict-juste')).toBeVisible();
    await continuer(page);

    // Les hoshi du coin : 4.
    await page.getByRole('group', { name: 'Ta réponse' }).getByRole('button', { name: '4', exact: true }).click();
    await expect(page.locator('.choix-juste')).toHaveCount(1);
    await continuer(page);

    // Coin haut droit : K à T, lignes 10 à 19 ; libertés montrées en jade.
    await expect(board).toHaveAttribute('data-fenetre', 'K19:T10');
    await expect(board.locator('circle.liberte')).toHaveCount(4);
    await continuer(page);

    // Plateau entier, 19 lettres.
    await expect(board).not.toHaveAttribute('data-fenetre');
    expect((await coordonnees(page, 19)).lettres).toHaveLength(19);
    await sansDebord(page, '19 entier');
  });
}

// Zoom 200 % (195 px), 320 px, texte doublé, avec les polices web bloquées (police de repli plus large, comme en CI).
for (const cas of [{ nom: 'zoom 200 %', l: 195, h: 422 }, { nom: '320 px', l: 320, h: 640 }, { nom: 'police doublée', l: 390, h: 844, police: true }]) {
  test(`essai 19 × 19 cadré : ${cas.nom}, sans débord`, async ({ page }) => {
    await page.route(/\.(woff2?|ttf|otf)(\?|$)/, r => r.abort());
    await page.setViewportSize({ width: cas.l, height: cas.h });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    if (cas.police) await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = '200%'; });
    });
    await page.goto('/?lecon-essai=19');
    const board = plateau(page, 19);
    await expect(board).toHaveAttribute('data-fenetre', 'A10:K1');
    await sansDebord(page, `${cas.nom}, étape 1`);
    const r = await board.boundingBox();
    expect(r!.x).toBeGreaterThanOrEqual(0);
    expect(r!.x + r!.width).toBeLessThanOrEqual(cas.l + 1);
    // Le geste fait, l'action principale tient dans la largeur ; l'étape suivante non plus ne déborde pas.
    await jouer(page, 'D4', 19);
    await page.getByRole('button', { name: 'Continuer' }).click();
    await sansDebord(page, `${cas.nom}, étape 2`);
  });
}
