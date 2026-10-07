// Positions des leçons sur 13 × 13 et 19 × 19 (#454) : écrire 19 lignes de 19 caractères à la main est long et fragile.
// `plateau(19, { X: ['D4'], O: ['Q16'] })` rend les `rows` d'une étape (X noir, O blanc, T pierre blanche visée,
// S pierre noire à sauver), avec les coordonnées affichées : lettres A à T sans I, lignes numérotées depuis le bas.
// Format complet : docs/architecture/lecons-grands-plateaux.md.

const LETTRES = 'ABCDEFGHJKLMNOPQRST';

/**
 * Lignes d'une position de `taille` × `taille` (9, 13 ou 19), depuis le haut.
 * @param {9 | 13 | 19} taille
 * @param {{ X?: string[], O?: string[], T?: string[], S?: string[] }} [pierres]
 * @returns {string[]}
 */
export function plateau(taille, pierres = {}) {
  if (![9, 13, 19].includes(taille)) throw new Error(`plateau : taille ${taille} (9, 13 ou 19)`);
  const g = Array.from({ length: taille }, () => Array(taille).fill('.'));
  for (const [c, points] of Object.entries(pierres)) {
    if (!['X', 'O', 'T', 'S'].includes(c)) throw new Error(`plateau : pierre « ${c} » inconnue`);
    for (const l of points) {
      const x = LETTRES.indexOf(l[0]), y = taille - Number(l.slice(1));
      if (x < 0 || x >= taille || !Number.isInteger(y) || y < 0 || y >= taille) throw new Error(`plateau : ${l} hors du ${taille} × ${taille}`);
      if (g[y][x] !== '.') throw new Error(`plateau : ${l} déjà occupé`);
      g[y][x] = c;
    }
  }
  return g.map(r => r.join(''));
}
