import { expect, type Locator, type Page } from '@playwright/test';
import { fromLabel } from '../src/go/coords';

// Géométrie du plateau, identique à src/ui/Board.tsx : écart C entre les lignes, marge M autour de la grille.
const C = 40;
const M = 34;

/** Le plateau de go (SVG accessible). */
export function plateau(page: Page, taille = 9): Locator {
  return page.getByRole('img', { name: `Plateau de go ${taille} × ${taille}` });
}

/** Coordonnées dans le viewBox d'une intersection affichée (« D5 » : lettres A à J sans I, lignes depuis le bas). */
function centre(label: string, taille: number): { cx: number; cy: number } {
  const p = fromLabel(label, taille);
  return { cx: M + (p % taille) * C, cy: M + Math.floor(p / taille) * C };
}

/** Position à l'écran (coordonnées de la page) d'une intersection affichée. */
export async function point(page: Page, label: string, taille = 9): Promise<{ x: number; y: number }> {
  const svg = plateau(page, taille);
  await svg.scrollIntoViewIfNeeded();
  const box = await svg.boundingBox();
  if (!box) throw new Error('Plateau introuvable');
  const w = Number((await svg.getAttribute('viewBox'))!.split(' ')[2]);
  const { cx, cy } = centre(label, taille);
  return { x: box.x + (cx * box.width) / w, y: box.y + (cy * box.height) / w };
}

/** Pose une pierre à la souris (pas de seconde touche de confirmation à la souris). */
export async function jouer(page: Page, label: string, taille = 9): Promise<void> {
  const { x, y } = await point(page, label, taille);
  await page.mouse.click(x, y);
}

/** Joue une suite de coups à la souris ; les couleurs alternent (Noir commence). */
export async function jouerSuite(page: Page, labels: string[], taille = 9): Promise<void> {
  for (const l of labels) await jouer(page, l, taille);
}

/** Touche une intersection au doigt. */
export async function toucher(page: Page, label: string, taille = 9): Promise<void> {
  const { x, y } = await point(page, label, taille);
  await page.touchscreen.tap(x, y);
}

/** Pierres posées d'une couleur (les pierres fantômes, semi-transparentes, sont exclues). */
export function pierres(page: Page, couleur: 'noir' | 'blanc', taille = 9): Locator {
  return plateau(page, taille).locator(`g[opacity="1"] > circle[fill="url(#${couleur === 'noir' ? 'gb' : 'gw'})"]`);
}

/** Pierre fantôme (coup en attente de confirmation au doigt). */
export function fantome(page: Page, taille = 9): Locator {
  return plateau(page, taille).locator('g[opacity="0.5"]');
}

/** Vérifie la pierre posée à une intersection (null : intersection vide). */
export async function attendrePierre(page: Page, label: string, couleur: 'noir' | 'blanc' | null, taille = 9): Promise<void> {
  const { cx, cy } = centre(label, taille);
  const ici = (id: string) => plateau(page, taille).locator(`g[opacity="1"] > circle[cx="${cx}"][cy="${cy}"][fill="url(#${id})"]`);
  if (couleur === null) {
    await expect(ici('gb')).toHaveCount(0);
    await expect(ici('gw')).toHaveCount(0);
  } else {
    await expect(ici(couleur === 'noir' ? 'gb' : 'gw')).toHaveCount(1);
  }
}

/** Depuis l'accueil déjà affiché : « Changer », puis « Jouer à deux sur ce téléphone » (issue #40, phase 4). */
export async function lancerADeux(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Changer' }).click();
  await page.getByRole('dialog', { name: 'Ton adversaire' }).getByRole('button', { name: 'Jouer à deux sur ce téléphone' }).click();
}

/** Ouvre une partie à deux sur le même téléphone depuis l'accueil. */
export async function partieADeux(page: Page): Promise<void> {
  await page.goto('/');
  await lancerADeux(page);
  await expect(plateau(page)).toBeVisible();
}

/** Bandeau d'un joueur, avec son compteur de prisonniers. */
export function bandeau(page: Page, nom: 'Noir' | 'Blanc'): Locator {
  return page.locator('.strip').filter({ has: page.locator('b', { hasText: new RegExp(`^${nom}$`) }) });
}

/** Message d'état sous le plateau (zone aria-live). */
export function message(page: Page): Locator {
  return page.locator('p.hint[aria-live="polite"]');
}
