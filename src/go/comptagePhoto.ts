// Comptage d'un plateau photographié (#655) : chaque terme du score, visible, dans la règle choisie.
// Aucun calcul à part : tout vient de `score` (src/go/score.ts), le même comptage qu'en fin de partie (seki, dame,
// pierres mortes). Ce module ne fait qu'ajouter les prisonniers saisis par le joueur (une photo ne les voit pas) et
// détailler le résultat terme par terme.
import { newPosition } from './rules';
import { score, type Rules } from './score';

/** Komi usuel de chaque règle : 6,5 en japonais, 7,5 en chinois. */
export const KOMI_USUEL: Readonly<Record<Rules, number>> = { japanese: 6.5, chinese: 7.5 };

export interface OptionsComptagePhoto {
  regle: Rules;
  komi: number;
  /**
   * Prisonniers gardés hors du plateau, saisis par le joueur : `noir` = pierres blanches prises par Noir, `blanc` =
   * pierres noires prises par Blanc. Les pierres mortes marquées s'y ajoutent toutes seules. Ignorés en chinois.
   */
  prisonniers?: { noir: number; blanc: number };
  /** Pierres mortes (index `y * taille + x`), retirées avant le comptage. */
  mortes?: Iterable<number>;
}

/** Ce que compte un camp. `prisonniers` (japonais) ou `pierres` (chinois) : l'autre vaut 0. */
export interface TermesCamp {
  territoire: number;
  /** Japonais : prisonniers saisis + pierres mortes adverses. */
  prisonniers: number;
  /** Chinois : pierres vivantes sur le plateau. */
  pierres: number;
  komi: number;
  total: number;
}

export interface ComptageExplique {
  regle: Rules;
  noir: TermesCamp;
  blanc: TermesCamp;
  /** Pierres mortes retirées, par couleur (index 1 noires, 2 blanches). */
  mortes: { noires: number; blanches: number };
  /** Points vides à personne : dame, libertés partagées d'un seki et, en japonais, les yeux d'un seki. */
  neutres: number;
  /** Pierres en seki (vie commune). */
  seki: number;
  /** Propriétaire de chaque point vide (0 à personne), pour l'afficher sur le goban. */
  owner: Int8Array;
  /** 0 : égalité. */
  gagnant: 0 | 1 | 2;
  marge: number;
}

/** Compte un plateau (0 vide, 1 noir, 2 blanc) avec les termes visibles. */
export function compterPhoto(plateau: ArrayLike<number>, taille: number, o: OptionsComptagePhoto): ComptageExplique {
  const pos = newPosition(taille);
  for (let p = 0; p < taille * taille; p++) pos.board[p] = plateau[p] === 1 ? 1 : plateau[p] === 2 ? 2 : 0;
  const saisis = o.regle === 'japanese' ? o.prisonniers ?? { noir: 0, blanc: 0 } : { noir: 0, blanc: 0 };
  pos.captures = [0, entierPositif(saisis.noir), entierPositif(saisis.blanc)];
  const mortes = new Set([...(o.mortes ?? [])].filter(p => pos.board[p] !== 0));
  const sc = score(pos, o.komi, o.regle, mortes);
  let noiresMortes = 0, blanchesMortes = 0, noiresVivantes = 0, blanchesVivantes = 0, neutres = 0;
  for (let p = 0; p < pos.board.length; p++) {
    const v = pos.board[p];
    if (v && mortes.has(p)) { if (v === 1) noiresMortes++; else blanchesMortes++; }
    else if (v === 1) noiresVivantes++;
    else if (v === 2) blanchesVivantes++;
    if ((v === 0 || mortes.has(p)) && sc.owner[p] === 0) neutres++;
  }
  const japonais = o.regle === 'japanese';
  const noir: TermesCamp = {
    territoire: sc.territory[1],
    prisonniers: japonais ? pos.captures[1] + blanchesMortes : 0,
    pierres: japonais ? 0 : noiresVivantes,
    komi: 0,
    total: sc.black,
  };
  const blanc: TermesCamp = {
    territoire: sc.territory[2],
    prisonniers: japonais ? pos.captures[2] + noiresMortes : 0,
    pierres: japonais ? 0 : blanchesVivantes,
    komi: o.komi,
    total: sc.white,
  };
  const egalite = sc.black === sc.white;
  return {
    regle: o.regle, noir, blanc, mortes: { noires: noiresMortes, blanches: blanchesMortes }, neutres, seki: sc.seki.length,
    owner: sc.owner, gagnant: egalite ? 0 : sc.winner, marge: egalite ? 0 : sc.margin,
  };
}

function entierPositif(n: number): number {
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}
