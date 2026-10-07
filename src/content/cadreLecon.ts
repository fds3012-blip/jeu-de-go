// Leçons sur 13 × 13 et 19 × 19 (#454) : taille d'une étape et cadrage sur une zone. Logique pure, sans React.
// Format complet et conseils d’écriture : docs/architecture/lecons-grands-plateaux.md.
import { fromLabel } from '../go/coords';
import type { FenetrePlateau } from '../ui/boardArt';

/** Tailles de plateau acceptées dans une leçon. */
export const TAILLES_LECON = [9, 13, 19] as const;
export type TailleLecon = (typeof TAILLES_LECON)[number];

export type Coin = 'bas-gauche' | 'bas-droite' | 'haut-gauche' | 'haut-droite';

/**
 * Cadrage d'une étape :
 * - un coin (`'bas-gauche'`…) : carré de `COTE_COIN[taille]` lignes collé à ce coin ;
 * - `{ coin, cote }` : le même coin, avec un autre côté ;
 * - `{ hautGauche: 'C12', cote: 9 }` : carré de `cote` lignes dont l'intersection en haut à gauche est `C12`.
 */
export type Cadre = Coin | { coin: Coin; cote?: number } | { hautGauche: string; cote: number };

/** Côté par défaut d'un coin : 10 lignes sur 19 × 19 (le coin et son bord jusqu'au hoshi du côté), 8 sur 13 × 13. */
export const COTE_COIN: Record<TailleLecon, number> = { 9: 9, 13: 8, 19: 10 };

/** Côté minimal d'un cadre : en dessous, la forme perd ses repères (hoshi, bords). */
export const COTE_MIN = 5;

/**
 * Plus grand nombre de lignes montrées sans seconde touche obligatoire : celui du 9 × 9 entier (36 px par intersection
 * sur un iPhone de 390 px). Au-delà (13 × 13 entier, coin de 10 lignes : 32 px), le lecteur force la confirmation au
 * doigt, même si le réglage « Confirmer au doigt » est coupé.
 */
export const LIGNES_CONFORT = 9;

/** Fenêtre de l'étape sur un plateau de `taille` lignes ; `null` : tout le plateau. Lève une erreur sur un cadre invalide. */
export function fenetreDe(cadre: Cadre | undefined | null, taille: number): FenetrePlateau | null {
  if (!cadre) return null;
  const c = typeof cadre === 'string' ? { coin: cadre } : cadre;
  const k = ('cote' in c && c.cote) || COTE_COIN[taille as TailleLecon] || taille;
  if (!Number.isInteger(k) || k < COTE_MIN || k > taille) throw new Error(`cadre : côté ${k} hors de ${COTE_MIN}..${taille}`);
  if (k === taille) return null;
  if ('hautGauche' in c) {
    const p = fromLabel(c.hautGauche, taille);
    const x = p % taille, y = Math.floor(p / taille);
    if (x + k > taille || y + k > taille) throw new Error(`cadre : ${c.hautGauche} + ${k} lignes sort du plateau`);
    return { x, y, k };
  }
  const coin = c.coin;
  if (!['bas-gauche', 'bas-droite', 'haut-gauche', 'haut-droite'].includes(coin)) throw new Error(`cadre : coin « ${coin} » inconnu`);
  return { x: coin.endsWith('gauche') ? 0 : taille - k, y: coin.startsWith('haut') ? 0 : taille - k, k };
}

/** Nombre de lignes visibles d'une étape : le côté du cadre, ou la taille du plateau. */
export function lignesVisibles(taille: number, fenetre: FenetrePlateau | null): number {
  return fenetre ? fenetre.k : taille;
}

/** Un point (« D16 ») est-il dans la zone montrée ? */
export function visible(label: string, taille: number, fenetre: FenetrePlateau | null): boolean {
  let p: number;
  try { p = fromLabel(label, taille); } catch { return false; }
  if (p < 0) return false;
  if (!fenetre) return true;
  const x = p % taille, y = Math.floor(p / taille);
  return x >= fenetre.x && x < fenetre.x + fenetre.k && y >= fenetre.y && y < fenetre.y + fenetre.k;
}
