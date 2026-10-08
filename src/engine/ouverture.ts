// Coups plausibles des adversaires faibles (#488). Pomme tirait parfois son premier coup en B1 : un coup au bord,
// que personne ne joue, qui donne au débutant une image fausse du go. Ici, on écarte les coups « sans raison » :
// - pendant l'ouverture, tout ce qui n'est pas sur la 3e ou la 4e ligne (le centre en plus sur 9 × 9) ;
// - ensuite, la 1re ligne, sauf capture, sauvetage, ou contact en fin de partie.
// Le hasard et les simulations choisissent ensuite parmi les coups restants : Pomme reste aussi maladroite au milieu
// de partie (mesures : docs/game-design/ouverture-pomme-2026-10-08.md).
import { groupAt, neighbors, play, type Position } from '../go/rules';
import { partieAvancee } from '../go/frontieres';

/**
 * Coups d'ouverture de l'ordi, par taille de plateau : tant qu'il a posé moins de pierres que ça, il ne joue que
 * dans la zone d'ouverture (ZONE_OUVERTURE). 9 × 9 : ses 3 premiers coups ; 13 × 13 : 4 ; 19 × 19 : 6.
 * Indicateur visé : part des premiers coups de Pomme sur la 1re ou la 2e ligne (0 %, contre 67,5 % avant sur 240 parties).
 */
export const COUPS_OUVERTURE: Readonly<Record<number, number>> = { 9: 3, 13: 4, 19: 6 };

/**
 * Lignes autorisées pendant l'ouverture, comptées depuis le bord (1 = 1re ligne). 3e et 4e ligne partout : coins
 * et bords d'abord. Sur 9 × 9, le centre (5e ligne) est aussi un coup d'ouverture courant.
 */
export const ZONE_OUVERTURE: Readonly<Record<number, readonly number[]>> = { 9: [3, 4, 5], 13: [3, 4], 19: [3, 4] };

/** Ligne du point `p` depuis le bord le plus proche (1 = 1re ligne). */
export function ligne(p: number, size: number): number {
  const x = p % size, y = (p - x) / size;
  return 1 + Math.min(x, y, size - 1 - x, size - 1 - y);
}

/** Coups d'ouverture pour cette taille (plateaux non standard : la règle de la taille standard la plus proche). */
function coupsOuverture(size: number): number {
  return COUPS_OUVERTURE[size] ?? (size < 11 ? 3 : size < 16 ? 4 : 6);
}
function zoneOuverture(size: number): readonly number[] {
  return ZONE_OUVERTURE[size] ?? (size < 11 ? [3, 4, 5] : [3, 4]);
}

/** Vrai si le joueur au trait n'a pas encore joué tous ses coups d'ouverture. */
export function enOuverture(pos: Position): boolean {
  let miennes = 0;
  for (const v of pos.board) if (v === pos.toPlay) miennes++;
  return miennes < coupsOuverture(pos.size);
}

/**
 * Coups qui ont une raison tactique : ils capturent, ou ils sortent de l'atari un groupe du joueur au trait
 * (au moins deux libertés après le coup). Ceux-là restent permis partout, même sur la 1re ligne.
 */
export function coupsTactiques(pos: Position): Set<number> {
  const { board, size } = pos, c = pos.toPlay, o = 3 - c, out = new Set<number>(), seen = new Uint8Array(board.length);
  for (let p = 0; p < board.length; p++) {
    if (!board[p] || seen[p]) continue;
    const g = groupAt(board, size, p);
    for (const s of g.stones) seen[s] = 1;
    if (g.liberties.size !== 1) continue;
    const l = [...g.liberties][0], r = play(pos, l);
    if (typeof r === 'string') continue;
    if (board[p] === o) out.add(l); // capture
    else if (groupAt(r.board, size, l).liberties.size >= 2) out.add(l); // sauvetage
  }
  return out;
}

/**
 * Filtre des coups plausibles, pour un joueur au trait dans `pos`. Renvoie une fonction qui dit si un coup est permis.
 * - Ouverture (`enOuverture`) : seulement la zone d'ouverture, ou un coup tactique.
 * - Ensuite : pas de 1re ligne, sauf coup tactique, ou contact avec une pierre une fois la partie avancée (fin de partie).
 */
export function coupPlausible(pos: Position, ouverture = enOuverture(pos)): (p: number) => boolean {
  const { size, board } = pos, nb = neighbors(size), tactiques = coupsTactiques(pos);
  if (ouverture) {
    const zone = zoneOuverture(size);
    return p => tactiques.has(p) || zone.includes(ligne(p, size));
  }
  const avancee = partieAvancee(board);
  return p => ligne(p, size) > 1 || tactiques.has(p) || (avancee && nb[p].some(q => board[q] !== 0));
}

/**
 * Garde les coups plausibles d'une liste. Zone d'ouverture vide : la règle d'après l'ouverture (pas de 1re ligne).
 * Rien de plausible (plateau presque plein) : la liste telle quelle. Le filtre ne fait jamais passer l'ordi à tort.
 */
export function plausibles<T>(pos: Position, coups: readonly T[], coup: (c: T) => number): T[] {
  const ouverture = enOuverture(pos);
  for (const regle of ouverture ? [true, false] : [false]) {
    const ok = coupPlausible(pos, regle), garde = coups.filter(c => ok(coup(c)));
    if (garde.length) return garde;
  }
  return [...coups];
}
