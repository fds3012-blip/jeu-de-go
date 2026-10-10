// Conseil de Mochi (#80) : ce que le calque posé sur le plateau doit marquer (fonction pure, sans React).
// Passe design #509, point 3 : plus de cases teintées ni de contour autour de la zone (une « capsule » verte qui
// délavait la pierre blanche). Trois repères seulement, chacun avec un sens :
// - la cible : un anneau en tirets sur le seul point à jouer (même grammaire que la cible des problèmes) ;
// - le halo : un liseré de 2 px autour des pierres concernées (la pierre en atari, le groupe à sauver), sans les couvrir ;
// - les points : une petite pastille sur les autres intersections vides de la zone (libertés, œil, coin à prendre).

export interface ReperesConseil {
  /** Point vide nommé par la phrase (à jouer, ou à éviter), sinon `null`. */
  cible: number | null;
  /** Pierres de la zone : un halo autour de chacune. */
  halos: number[];
  /** Intersections vides de la zone, hors cible : une petite pastille. */
  points: number[];
}

/** Repères du calque : la zone et le point de la phrase, lus sur le plateau courant (0 = vide). */
export function reperes(zone: readonly number[], point: number | null, board: ArrayLike<number>): ReperesConseil {
  const cible = point !== null && point >= 0 && point < board.length && !board[point] ? point : null;
  const halos: number[] = [], points: number[] = [];
  for (const p of new Set(zone)) {
    if (p < 0 || p >= board.length || p === cible) continue;
    (board[p] ? halos : points).push(p);
  }
  // La pierre nommée par la phrase (« ton groupe en E5 ») reçoit son halo même si la zone l'a oubliée.
  if (point !== null && cible === null && point >= 0 && point < board.length && board[point] && !halos.includes(point)) halos.push(point);
  return { cible, halos, points };
}
