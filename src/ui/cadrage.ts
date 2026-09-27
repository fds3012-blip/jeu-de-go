// Cadrage d'une position (miniatures de plateau, problème du jour) : fonctions pures, sans React.

/** Fenêtre carrée d'un plateau : colonne `x`, ligne `y` du coin haut gauche, et côté `k` (en intersections). */
export interface Fenetre { x: number; y: number; k: number }

/**
 * Plus petite fenêtre carrée qui contient toutes les pierres, avec `marge` lignes autour, sans sortir du plateau.
 * `rows` : une chaîne par ligne depuis le haut, « . » pour une intersection vide. Plateau vide : tout le plateau.
 */
export function cadrage(rows: string[], marge = 1, min = 4): Fenetre {
  const n = rows.length;
  let x0 = n, y0 = n, x1 = -1, y1 = -1;
  rows.forEach((r, y) => [...r].forEach((ch, x) => {
    if (ch !== '.') { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  }));
  if (x1 < 0) return { x: 0, y: 0, k: n };
  const k = Math.min(n, Math.max(min, Math.max(x1 - x0, y1 - y0) + 1 + 2 * marge));
  const place = (a: number, b: number) => Math.max(0, Math.min(n - k, Math.round((a + b) / 2 - (k - 1) / 2)));
  return { x: place(x0, x1), y: place(y0, y1), k };
}

/** Centre vertical des pierres, en intersections depuis le haut (milieu du plateau s'il est vide). */
export function centreVertical(rows: string[]): number {
  const lignes = rows.map((r, y) => (/[^.]/.test(r) ? y : -1)).filter(y => y >= 0);
  if (!lignes.length) return (rows.length - 1) / 2;
  return (lignes[0] + lignes[lignes.length - 1]) / 2;
}
