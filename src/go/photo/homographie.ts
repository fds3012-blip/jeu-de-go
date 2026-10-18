// Homographie (#655) : correction de perspective d'un plateau photographié, à partir de ses 4 coins.
// Maths pures, sans DOM : la même fonction sert à l'écran, au générateur d'images de test et aux tests.

export interface Point { x: number; y: number }
/** Matrice 3 × 3 rangée par lignes, h[8] = 1. */
export type Homographie = readonly number[];
/** Coins de la grille dans l'ordre : haut gauche, haut droite, bas droite, bas gauche. */
export type Coins = readonly [Point, Point, Point, Point];

/** Résout A x = b (Gauss avec pivot partiel). Lève une erreur si le système est singulier. */
function resoudre(a: number[][], b: number[]): number[] {
  const n = b.length, m = a.map((l, i) => [...l, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let l = c + 1; l < n; l++) if (Math.abs(m[l][c]) > Math.abs(m[piv][c])) piv = l;
    if (Math.abs(m[piv][c]) < 1e-12) throw new Error('homographie dégénérée');
    [m[c], m[piv]] = [m[piv], m[c]];
    for (let l = 0; l < n; l++) {
      if (l === c) continue;
      const f = m[l][c] / m[c][c];
      for (let k = c; k <= n; k++) m[l][k] -= f * m[c][k];
    }
  }
  return m.map((l, i) => l[n] / l[i]);
}

/** Homographie qui envoie chaque point `de[i]` sur `vers[i]`. */
export function homographie(de: readonly Point[], vers: readonly Point[]): Homographie {
  const a: number[][] = [], b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = de[i], { x: u, y: v } = vers[i];
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  return [...resoudre(a, b), 1];
}

/** Image d'un point par l'homographie. */
export function appliquer(h: Homographie, x: number, y: number): Point {
  const w = h[6] * x + h[7] * y + h[8];
  return { x: (h[0] * x + h[1] * y + h[2]) / w, y: (h[3] * x + h[4] * y + h[5]) / w };
}

/** Inverse d'une homographie (matrice adjointe, normalisée). */
export function inverse(h: Homographie): Homographie {
  const [a, b, c, d, e, f, g, k, l] = h;
  const m = [e * l - f * k, c * k - b * l, b * f - c * e, f * g - d * l, a * l - c * g, c * d - a * f, d * k - e * g, b * g - a * k, a * e - b * d];
  return m.map(v => v / m[8]);
}

const CARRE: Coins = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];

/**
 * Homographie du plateau : coordonnées de grille (colonne `i`, ligne `j`, de 0 à taille − 1, y depuis le haut) vers
 * les pixels de la photo. Les coins sont ceux de la grille (les 4 intersections des bords), pas du bois.
 */
export function homographieGrille(coins: Coins, taille: number): Homographie {
  const n = taille - 1;
  return homographie(CARRE.map(p => ({ x: p.x * n, y: p.y * n })), coins);
}

/** Vrai si les 4 coins forment un quadrilatère convexe, dans l'ordre horaire ou anti-horaire (sinon : coins croisés). */
export function quadrilatereValide(coins: Coins): boolean {
  let signe = 0;
  for (let i = 0; i < 4; i++) {
    const a = coins[i], b = coins[(i + 1) % 4], c = coins[(i + 2) % 4];
    const z = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(z) < 1e-9) return false;
    const s = Math.sign(z);
    if (signe && s !== signe) return false;
    signe = s;
  }
  return true;
}
