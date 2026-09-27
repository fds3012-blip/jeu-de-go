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
