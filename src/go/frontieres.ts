// Frontières ouvertes (#159) : points vides qui ne sont encore à personne.
// Au comptage, une zone vide ne compte que si une seule couleur l'entoure. Une zone qui touche les deux couleurs
// (ou aucune) reste neutre : si l'on passe avant de la fermer, ses points ne rapportent rien.
// Fonctions pures, sans DOM : utilisables par le moteur, par l'écran de partie et dans les tests.
import { groupAt, neighbors, play, type Color, type Position } from './rules';

/** Plateau sans les pierres marquées mortes. */
function sansMortes(board: Int8Array, dead?: Iterable<number>): Int8Array {
  const b = board.slice();
  if (dead) for (const p of dead) b[p] = 0;
  return b;
}

/**
 * Points vides encore contestés : chaque point d'une zone vide qui touche les deux couleurs, ou aucune
 * (plateau vide). `dead` : pierres mortes retirées d'abord (une pierre morte n'ouvre pas un territoire).
 * Renvoie les index `y * size + x`, triés. Une position bien finie renvoie seulement les vrais points neutres
 * (dame et libertés partagées d'un seki), qu'aucun coup utile ne peut remplir.
 */
export function frontieresOuvertes(board: Int8Array, size: number, dead?: Iterable<number>): number[] {
  const b = sansMortes(board, dead), nb = neighbors(size), seen = new Uint8Array(b.length), out: number[] = [];
  for (let p = 0; p < b.length; p++) {
    if (b[p] || seen[p]) continue;
    const region: number[] = [], stack = [p];
    let border = 0;
    seen[p] = 1;
    while (stack.length) {
      const q = stack.pop()!;
      region.push(q);
      for (const r of nb[q]) {
        if (!b[r]) { if (!seen[r]) { seen[r] = 1; stack.push(r); } }
        else border |= b[r];
      }
    }
    if (border !== 1 && border !== 2) out.push(...region);
  }
  return out.sort((a, c) => a - c);
}

/**
 * Partie assez avancée pour qu'on parle de frontières : au moins un quart du plateau couvert de pierres
 * (21 pierres en 9 × 9). Avant, si le joueur passe, c'est qu'il veut arrêter : on ne l'oblige pas à jouer
 * tout le plateau (et « Passer » sur un plateau vide reste un moyen rapide de finir).
 */
export function partieAvancee(board: Int8Array): boolean {
  let pierres = 0;
  for (const v of board) if (v) pierres++;
  return pierres * 4 >= board.length;
}

/**
 * Coup qui ferme une frontière pour le joueur au trait, ou -1 s'il n'y en a aucun qui ait un sens.
 * Un coup a un sens s'il est légal, ne remplit pas un œil de sa couleur et laisse au moins deux libertés
 * (sauf s'il capture) : on ne se met jamais en atari pour fermer, donc un seki reste un seki.
 * `prefer` : coups proposés par un moteur, du meilleur au moins bon ; le premier qui ferme une frontière gagne.
 * Sinon, priorité aux points qui touchent les deux couleurs (vraie frontière), puis à ceux qui touchent l'adversaire.
 */
export function coupDeFermeture(pos: Position, dead?: Iterable<number>, prefer: readonly number[] = []): number {
  const { size } = pos, c = pos.toPlay, o = (3 - c) as Color, nb = neighbors(size);
  const mortes = new Set(dead ?? []);
  const ouverts = new Set(frontieresOuvertes(pos.board, size, mortes));
  if (!ouverts.size) return -1;
  // Le point doit être vide sur le vrai plateau (une pierre morte n'est pas encore retirée).
  const sensé = (p: number): boolean => {
    if (p < 0 || !ouverts.has(p) || pos.board[p] !== 0) return false;
    // Œil de sa couleur : le remplir ne ferme rien.
    if (nb[p].every(r => pos.board[r] === c)) return false;
    const r = play(pos, p);
    if (typeof r === 'string') return false;
    const captured = r.captures[c] - pos.captures[c];
    return captured > 0 || groupAt(r.board, size, p).liberties.size >= 2;
  };
  for (const p of prefer) if (sensé(p)) return p;
  let best = -1, bestScore = -1;
  for (const p of ouverts) {
    if (!sensé(p)) continue;
    const vivantes = (col: Color) => nb[p].some(r => pos.board[r] === col && !mortes.has(r));
    const s = (vivantes(c) && vivantes(o) ? 2 : 0) + (vivantes(o) ? 1 : 0);
    if (s > bestScore) { bestScore = s; best = p; }
  }
  return best;
}

/** Points des zones vides (sur `b`) voisines de `p` entourées par la seule couleur `c`. */
function zonesA(b: Int8Array, size: number, p: number, c: Color): number {
  const nb = neighbors(size), seen = new Uint8Array(b.length);
  let total = 0;
  for (const d of nb[p]) {
    if (b[d] || seen[d]) continue;
    const stack = [d];
    let n = 0, border = 0;
    seen[d] = 1;
    while (stack.length) {
      const q = stack.pop()!;
      n++;
      for (const r of nb[q]) {
        if (!b[r]) { if (!seen[r]) { seen[r] = 1; stack.push(r); } }
        else border |= b[r];
      }
    }
    if (border === c) total += n;
  }
  return total;
}

/** Points qu'une brèche doit au moins protéger pour être fermée (un seul point : un œil, pas une frontière). */
export const BRECHE_MIN = 2;

/**
 * Parties accommodantes (#235) : après la passe du joueur, l'ordi ne ferme que **sa** frontière, jamais celle du joueur.
 * Une brèche est un point ouvert, collé à une de ses pierres vivantes, qui change une zone contestée en zone à lui
 * (entourée de sa seule couleur) : il ferme sa porte, il n'entre pas chez le joueur (une zone qui touche une pierre
 * du joueur n'est jamais « à lui »). Renvoie la brèche qui protège le plus de points (au moins BRECHE_MIN), sinon -1.
 * Mêmes garde-fous que `coupDeFermeture` : coup légal, pas dans son œil, au moins deux libertés (sauf prise).
 * `prefer` départage les égalités (coups du moteur, du meilleur au moins bon).
 */
export function brecheAFermer(pos: Position, dead?: Iterable<number>, prefer: readonly number[] = []): number {
  const { size } = pos, c = pos.toPlay, nb = neighbors(size);
  const mortes = new Set(dead ?? []);
  const ouverts = frontieresOuvertes(pos.board, size, mortes);
  if (!ouverts.length) return -1;
  const b = sansMortes(pos.board, mortes), rang = new Map(prefer.map((m, i) => [m, i] as const));
  let best = -1, bestGain = BRECHE_MIN - 1, bestRang = Infinity;
  for (const p of ouverts) {
    if (pos.board[p] !== 0 || !nb[p].some(r => b[r] === c)) continue;
    if (nb[p].every(r => pos.board[r] === c)) continue;
    const r = play(pos, p);
    if (typeof r === 'string') continue;
    const prises = r.captures[c] - pos.captures[c];
    if (!prises && groupAt(r.board, size, p).liberties.size < 2) continue;
    // Une pierre du joueur prise en fermant (intruse en atari dans sa frontière) compte avec la zone protégée.
    const gain = zonesA(sansMortes(r.board, mortes), size, p, c) + prises;
    const k = rang.get(p) ?? prefer.length;
    if (gain > bestGain || (gain === bestGain && k < bestRang)) { best = p; bestGain = gain; bestRang = k; }
  }
  return best;
}
