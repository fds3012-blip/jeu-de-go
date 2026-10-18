import { expect, test, type Page } from '@playwright/test';
import { boutonPasser, choisirMode, coupsJoues, jouer, passer, plateau, toucherCta } from './plateau';
import { demarrerParcours, ouvrirRevue, preparerRevue } from './revueFactice';
import { fromLabel } from '../src/go/coords';

// Issue #527 : les trois décisions de Florian sur la passe design #509.
// 1. Mochi : sceau pour l'interface, portrait quand il parle de ta partie (règle figée par src/ui/mochiRegle.test.ts).
// 2. Revue : 3 catégories jusqu'à 15 kyu (cote interne, jamais affichée), notes détaillées au-delà.
// 3. 320 × 568 : plateau de partie d'au moins 260 px, sans défilement en partie ni au comptage ; 375 × 667 sans
//    défilement non plus (la bulle de Mochi passait sous la barre d'actions), plateau inchangé.

test.use({ reducedMotion: 'reduce' });

/** La page ne défile pas, et rien ne dépasse en largeur. */
async function sansDefilement(page: Page, ou: string) {
  const d = await page.evaluate(() => ({ v: document.documentElement.scrollHeight - innerHeight, h: document.documentElement.scrollWidth - innerWidth }));
  expect(d.v, `${ou} : défilement vertical`).toBeLessThanOrEqual(0);
  expect(d.h, `${ou} : défilement horizontal`).toBeLessThanOrEqual(0);
}

/** La bulle de Mochi visible se lit en entier au-dessus de la barre du bas, et ne couvre pas le plateau. */
async function bulleLisible(page: Page, bulle: string, barre: string, ou: string) {
  const [b, p, a] = await Promise.all([page.locator(bulle).boundingBox(), plateau(page).boundingBox(), page.locator(barre).boundingBox()]);
  expect(b!.y + b!.height, `${ou} : bulle sous la barre du bas`).toBeLessThanOrEqual(a!.y + 1);
  expect(b!.y, `${ou} : bulle sur le plateau`).toBeGreaterThanOrEqual(p!.y + p!.height - 1);
}

// Pomme : coups écrits d'avance (build VITE_E2E). Partie du coach (prise ratée en E4, e2e/coach-mochi.spec.ts).
const ORDI_COACH = ['E5', 'J9', 'J8', 'J7', 'H9', 'H8'].map(l => fromLabel(l, 9));
// Partie qui finit au comptage manuel (4e partie, e2e/comptage-premieres-parties.spec.ts).
const NOIR = ['D9', 'D8', 'D7', 'A6', 'B6', 'C6', 'D6', 'G9', 'G8', 'G7', 'G6', 'G5', 'G4', 'G3', 'G2', 'G1'];
const BLANC = ['C9', 'C8', 'C7', 'B7', 'A7', 'H9', 'H8', 'H7', 'H6', 'H5', 'H4', 'H3', 'H2', 'H1'];

async function preparer(page: Page, coups: number[], stockage: Record<string, string>) {
  await page.addInitScript(({ coups, stockage }) => {
    (window as unknown as { __coupsOrdi: number[] }).__coupsOrdi = [...coups];
    for (const [k, v] of Object.entries(stockage)) localStorage.setItem(k, v);
  }, { coups, stockage });
}

/** Joue un coup de Noir et attend la réponse de Pomme. */
async function coup(page: Page, l: string) {
  await expect(boutonPasser(page)).toBeEnabled({ timeout: 15_000 });
  const avant = await coupsJoues(page).count();
  await jouer(page, l);
  await expect.poll(async () => coupsJoues(page).count(), { timeout: 15_000 }).toBeGreaterThanOrEqual(avant + 2);
}

for (const [l, h, plancher] of [[320, 568, 260], [375, 667, 327]] as const) {
  test.describe(`${l} × ${h}`, () => {
    test.use({ viewport: { width: l, height: h } });

    test(`première partie : bulle d'intro au portrait, sous le plateau (${l} × ${h})`, async ({ page }) => {
      await page.goto('/');
      await toucherCta(page);
      await expect(page.locator('.annonce-komi')).toBeVisible();
      expect((await plateau(page).boundingBox())!.width).toBeGreaterThanOrEqual(plancher);
      // Mochi parle de ta partie : son portrait, comme le coach qui suivra (#527).
      await expect(page.locator('.coach-intro .bubble [data-portrait="mochi"]')).toBeVisible();
      await expect(page.locator('.coach-intro .bubble .sceau')).toHaveCount(0);
      await bulleLisible(page, '.coach-intro', '.actions', 'intro');
      await sansDefilement(page, 'première partie');
    });

    test(`partie avec le coach : plateau d'au moins ${plancher} px, rien ne défile (${l} × ${h})`, async ({ page }) => {
      test.setTimeout(120_000);
      await preparer(page, ORDI_COACH, { 'go.parties.v1': JSON.stringify({ n: 2, ordi: 2, dernier: 'pomme' }), 'go.essai.v1': JSON.stringify({ terminees: 3, suivi: true }) });
      await page.goto('/');
      await choisirMode(page, 'ordi');
      for (const c of ['D5', 'F5', 'E6', 'A9']) await coup(page, c);
      const bulle = page.locator('[data-coach-bulle]');
      await expect(bulle).toBeVisible();
      await expect(bulle.locator('[data-portrait="mochi"]')).toBeVisible();
      const largeur = (await plateau(page).boundingBox())!.width;
      expect(largeur).toBeGreaterThanOrEqual(plancher);
      await bulleLisible(page, '[data-coach-bulle]', '.actions', 'coach');
      await sansDefilement(page, 'partie, coach');
      // Le bouton « Couper le coach » reste entier et touchable.
      const couper = bulle.getByRole('button', { name: 'Couper le coach' });
      await expect(couper).toBeInViewport({ ratio: 1 });
      expect((await couper.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    });

    test(`comptage manuel : plateau d'au moins ${plancher} px, score et bulle lisibles, rien ne défile (${l} × ${h})`, async ({ page }) => {
      test.setTimeout(120_000);
      await preparer(page, [...BLANC.map(x => fromLabel(x, 9)), -1, -1, -1], {
        'go.parties.v1': JSON.stringify({ n: 3, ordi: 3, dernier: 'pomme' }), 'go.essai.v1': JSON.stringify({ terminees: 3, suivi: true }), 'go.intro-but.v1': 'true',
      });
      await page.goto('/');
      await choisirMode(page, 'ordi');
      for (const c of NOIR) await coup(page, c);
      expect((await plateau(page).boundingBox())!.width).toBeGreaterThanOrEqual(plancher);
      await sansDefilement(page, 'partie pleine');
      await expect(boutonPasser(page)).toBeEnabled({ timeout: 15_000 });
      await passer(page);
      const valider = page.getByRole('button', { name: 'Valider le score' });
      await expect(valider).toBeVisible({ timeout: 15_000 });
      expect((await plateau(page).boundingBox())!.width).toBeGreaterThanOrEqual(plancher);
      await bulleLisible(page, '.partie-mochi > .coach', '.barre-comptage', 'comptage');
      // La ligne du score se lit en entier au-dessus de la barre du comptage.
      const [score, barre] = await Promise.all([page.locator('.comptage').boundingBox(), page.locator('.barre-comptage').boundingBox()]);
      expect(score!.y + score!.height).toBeLessThanOrEqual(barre!.y + 1);
      await expect(valider).toBeInViewport({ ratio: 1 });
      await sansDefilement(page, 'comptage');
    });
  });
}

test.describe('revue : 3 catégories jusqu’à 15 kyu, notes détaillées au-delà', () => {
  test('débutant (aucune cote gardée, 25 kyu) : bon coup, coup imprécis, erreur', async ({ page }) => {
    await preparerRevue(page, { debutant: true });
    await ouvrirRevue(page);
    const table = page.locator('.bilan-table');
    await expect(table).toHaveAttribute('data-grille', 'categories', { timeout: 60_000 });
    const lignes = table.locator('tbody tr[data-categorie]');
    await expect(lignes).toHaveCount(3);
    // Partie factice (e2e/revueFactice.ts) : Toi 3 classiques, Meilleur ×2, Excellent, Brillant, Bon = 6 bons coups ;
    // Coup manqué de 3,5 points (au-delà du seuil d'Imprécision : erreur) et Erreur de 5 points = 2 erreurs.
    // Pomme : Classique ×2, Meilleur ×2, Excellent ×2 = 6 ; Imprécision 1 ; Gaffe 1.
    await expect(lignes.nth(0)).toContainText('Bon coup');
    await expect(lignes.nth(0)).toContainText('Peu ou pas de points perdus');
    await expect(lignes.nth(0).locator('td')).toHaveText(['6', '6']);
    await expect(lignes.nth(1)).toContainText('Coup imprécis');
    await expect(lignes.nth(1).locator('td')).toHaveText(['–', '1']);
    await expect(lignes.nth(2)).toContainText('Erreur');
    await expect(lignes.nth(2).locator('td')).toHaveText(['2', '1']);
    // Aucune note détaillée dans le tableau.
    for (const mot of ['Brillant', 'Gaffe', 'Coup manqué', 'Classique']) await expect(table).not.toContainText(mot);
    // Mochi parle de ta partie : son portrait.
    await expect(page.locator('.bilan-coach [data-portrait="mochi"]')).toBeVisible();

    // Parcours : la Gaffe de Pomme (coup 6) se lit « erreur », sur le sceau, la bande et le titre.
    await demarrerParcours(page, 6);
    await expect(page.locator('.parcours-titre')).toContainText('E7 est une erreur');
    await expect(page.getByRole('button', { name: /^Coup 6, E7, Erreur$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Coup 7, D6, Erreur$/ })).toBeVisible();
  });

  test('joueur fort (10 kyu) : les notes détaillées, de Brillant à Gaffe', async ({ page }) => {
    await preparerRevue(page);
    await ouvrirRevue(page);
    const table = page.locator('.bilan-table');
    await expect(table).toHaveAttribute('data-grille', 'notes', { timeout: 60_000 });
    await expect(table.locator('tbody tr[data-categorie]')).toHaveCount(0);
    for (const l of ['brillant', 'meilleur', 'excellent', 'bon', 'classique', 'imprecision', 'erreur', 'manque', 'grosse']) {
      await expect(table.locator(`tr[data-ligne="${l}"]`)).toHaveCount(1);
    }
    await demarrerParcours(page, 6);
    await expect(page.locator('.parcours-titre')).toContainText('E7 est une gaffe');
    await expect(page.getByRole('button', { name: /^Coup 7, D6, Coup manqué$/ })).toBeVisible();
  });
});
