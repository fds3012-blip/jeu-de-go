import { expect, type Locator, type Page } from '@playwright/test';
import { fromLabel } from '../src/go/coords';

// Géométrie du plateau (src/ui/boardArt.ts) : écart C entre les lignes, marge M autour de la grille.
const C = 40;
const M = 34;

/** Le plateau de go (SVG accessible) : une grille s'il est jouable (issue #116), une image sinon. */
export function plateau(page: Page, taille = 9): Locator {
  const name = `Plateau de go ${taille} × ${taille}`;
  return page.getByRole('grid', { name }).or(page.getByRole('img', { name }));
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
  // viewBox « min min étendue min » : une bande de coordonnées déborde en haut et à gauche (min < 0).
  const [min, , w] = (await svg.getAttribute('viewBox'))!.split(' ').map(Number);
  const { cx, cy } = centre(label, taille);
  return { x: box.x + ((cx - min) * box.width) / w, y: box.y + ((cy - min) * box.height) / w };
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

// Chaque pierre posée porte data-pierre (« noir » ou « blanc ») et data-point (« D5 »). Les pierres fantômes
// et les pierres prises en train de s'effacer n'ont pas data-pierre. Les pierres mortes du comptage portent data-morte.
/** Pierres posées d'une couleur (les pierres fantômes et les pierres mortes du comptage sont exclues). */
export function pierres(page: Page, couleur: 'noir' | 'blanc', taille = 9): Locator {
  return plateau(page, taille).locator(`g[data-pierre="${couleur}"]:not([data-morte])`);
}

/** Pierre fantôme (coup en attente de confirmation au doigt). */
export function fantome(page: Page, taille = 9): Locator {
  return plateau(page, taille).locator('g[data-fantome]');
}

/** Vérifie la pierre posée à une intersection (null : intersection vide). */
export async function attendrePierre(page: Page, label: string, couleur: 'noir' | 'blanc' | null, taille = 9): Promise<void> {
  fromLabel(label, taille); // valide la coordonnée
  const ici = plateau(page, taille).locator(`g[data-point="${label.toUpperCase()}"][data-pierre]:not([data-morte])`);
  if (couleur === null) await expect(ici).toHaveCount(0);
  else await expect(ici.and(page.locator(`[data-pierre="${couleur}"]`))).toHaveCount(1);
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

/** Bandeau d'un joueur (« Noir », « Blanc », « Toi » ou le nom de l'adversaire), avec son couvercle. */
export function bandeau(page: Page, nom: string): Locator {
  return page.locator(`.joueur[data-joueur="${nom}"]`);
}

/** Couvercle d'un joueur : pierres qu'il a capturées (texte accessible « 1 pierre capturée »). */
export function couvercle(page: Page, nom: string): Locator {
  return bandeau(page, nom).locator('.couvercle');
}

/** Phrase du coach Mochi sous le plateau (zone aria-live). */
export function message(page: Page): Locator {
  return page.locator('.coach p[aria-live="polite"]');
}

/**
 * Contre l'ordi : passe jusqu'à la fin de la partie, puis valide le score. Depuis #117, le comptage est automatique
 * quand les pierres mortes sont sûres (récit direct) ; sinon, phase manuelle et « Valider le score ».
 */
export async function passerJusquAuScore(page: Page, adversaire = 'Pomme'): Promise<void> {
  const passer = page.getByRole('button', { name: 'Passer' });
  const fin = page.locator('.recit, .barre-comptage .btn.primary:enabled');
  for (let i = 0; i < 6 && !(await fin.first().isVisible()); i++) {
    await expect(passer).toBeEnabled({ timeout: 10_000 });
    await passer.click();
    await expect(fin.or(page.getByText(new RegExp(`${adversaire} (joue|capture|continue)`))).first()).toBeVisible({ timeout: 10_000 });
  }
  await expect(fin.first()).toBeVisible({ timeout: 10_000 });
  const valider = page.getByRole('button', { name: 'Valider le score' });
  if (await valider.isVisible()) await valider.click();
}
