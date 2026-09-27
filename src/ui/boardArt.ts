// Matière du goban v2 (docs/design/v2/direction.md, section 4) : fonctions pures, sans React.
// Tout ce qui coûte cher (bruit fractal du bois, stries des coquillages) est calculé une seule fois.

/** Écart entre deux lignes et marge autour de la grille, en unités du viewBox (e2e/plateau.ts s'en sert aussi). */
export const C = 40;
export const M = 34;
/** Rayon d'une pierre blanche ; la noire est plus large de 0,7 % (les vraies font 0,3 mm de plus). */
export const R = C * 0.485;
export const R_NOIR = R * 1.007;
/** Nombre de variantes de stries des pierres blanches. */
export const VARIANTES_COQUILLAGE = 10;

/** Hachage entier stable d'une intersection (FNV-1a sur la taille et l'index). */
export function hashPoint(p: number, size: number): number {
  let h = 0x811c9dc5;
  for (const v of [size, p, p * 7 + 3]) {
    h ^= v & 0xff; h = Math.imul(h, 0x01000193);
    h ^= (v >>> 8) & 0xff; h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Variante de coquillage (0 à 9) d'une pierre blanche, toujours la même pour une intersection donnée. */
export function shellVariant(p: number, size: number): number {
  return hashPoint(p, size) % VARIANTES_COQUILLAGE;
}

/** Largeur du viewBox pour une taille de plateau. */
export function boardWidth(size: number): number {
  return 2 * M + (size - 1) * C;
}

/**
 * Bande des coordonnées, ajoutée en haut et à gauche seulement (environ 10 px à l'écran) :
 * les lettres et les chiffres ne passent jamais sous une pierre du bord, même en 19 × 19.
 * Le viewBox commence donc à (−bande, −bande) ; les intersections gardent leurs coordonnées M + i × C.
 */
export function coordBand(size: number): number {
  return +((10 * boardWidth(size)) / 358).toFixed(2);
}
export function viewBoxOf(size: number): { min: number; span: number } {
  const e = coordBand(size);
  return { min: -e, span: boardWidth(size) + e };
}
/** Centre des coordonnées : à mi-chemin entre le bord du bois et le bord des pierres de la première ligne. */
export function coordCenter(size: number): number {
  return (-coordBand(size) + (M - R_NOIR)) / 2;
}

/**
 * Micro-décalage d'une pierre (comme sur un vrai goban), en unités du viewBox.
 * Il reste sous 1 px à l'écran : le plateau affiché fait au moins ~360 px de large,
 * on borne donc la norme à 0,9 × largeur / 400.
 */
export function jitterMax(size: number): number {
  return (0.9 * boardWidth(size)) / 400;
}
export function jitter(p: number, size: number): [number, number] {
  const h = hashPoint(p, size);
  const angle = ((h & 0xffff) / 0x10000) * Math.PI * 2;
  const norme = (((h >>> 16) & 0xff) / 255) * jitterMax(size);
  return [Math.cos(angle) * norme, Math.sin(angle) * norme];
}

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Strie { cx: number; cy: number; r: number; w: number; o: number; clair: boolean }

/**
 * Stries d'une variante de coquillage : arcs concentriques (lignes de croissance du coquillage)
 * centrés hors de la pierre, espacés irrégulièrement. Coordonnées centrées sur la pierre.
 */
export function shellStriae(variant: number): Strie[] {
  const rnd = prng(variant * 7919 + 101);
  const theta = ((variant * 36 + rnd() * 24) * Math.PI) / 180;
  const d = R * (2.1 + rnd() * 1.4);
  const cx = Math.cos(theta) * d, cy = Math.sin(theta) * d;
  const out: Strie[] = [];
  for (let r = d - R + 0.6; r < d + R; r += 0.7 + rnd() * 1.5) {
    out.push({ cx, cy, r: +r.toFixed(2), w: +(0.25 + rnd() * 0.75).toFixed(2), o: +(0.05 + rnd() * 0.16).toFixed(3), clair: rnd() < 0.18 });
  }
  return out;
}

/**
 * Bois de kaya : deux couches de bruit fractal (veinage fin et veinage large), couleur chaude et vignettage.
 * Rendu une seule fois en image SVG `data:` (le navigateur la rastérise et la garde en cache) :
 * les filtres feTurbulence ne sont jamais recalculés quand une pierre est posée.
 */
let woodCache: string | null = null;
export function woodDataUrl(): string {
  if (woodCache) return woodCache;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
<defs>
<filter id="g" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
<feTurbulence type="fractalNoise" baseFrequency="0.004 0.22" numOctaves="3" seed="7" result="fin"/>
<feColorMatrix in="fin" type="matrix" result="finA" values="0 0 0 0 0.52  0 0 0 0 0.30  0 0 0 0 0.10  0 0 0 0.95 -0.38"/>
<feTurbulence type="fractalNoise" baseFrequency="0.002 0.018" numOctaves="2" seed="11" result="large"/>
<feColorMatrix in="large" type="matrix" result="largeA" values="0 0 0 0 0.62  0 0 0 0 0.38  0 0 0 0 0.14  0 0 0 0.9 -0.35"/>
<feMerge><feMergeNode in="largeA"/><feMergeNode in="finA"/></feMerge>
</filter>
<radialGradient id="b" cx="42%" cy="35%" r="85%"><stop offset="0" stop-color="#EDC27A"/><stop offset=".6" stop-color="#DDA95C"/><stop offset="1" stop-color="#C58D42"/></radialGradient>
<radialGradient id="v" cx="50%" cy="50%" r="72%"><stop offset=".7" stop-color="#3C1E05" stop-opacity="0"/><stop offset="1" stop-color="#3C1E05" stop-opacity=".28"/></radialGradient>
</defs>
<rect width="400" height="400" fill="url(#b)"/>
<rect width="400" height="400" filter="url(#g)"/>
<rect width="400" height="400" fill="url(#v)"/>
</svg>`;
  woodCache = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return woodCache;
}

/** Points étoiles (hoshi). */
export function hoshi(size: number): number[] {
  const s = size === 9 ? [2, 6] : size === 13 ? [3, 9] : size === 19 ? [3, 9, 15] : [];
  const out: number[] = [];
  for (const a of s) for (const b of s) out.push(b * size + a);
  // En 19 × 19, la grille 3 × 3 contient déjà le centre (tengen) et les côtés.
  if (size !== 19 && size % 2) out.push((size >> 1) * size + (size >> 1));
  return out;
}

/** Changement d'un plateau à l'autre : pierre posée et pierres prises (seulement pour un coup simple). */
export interface BoardDiff { placed: number; captured: number[] }
export function diffBoards(prev: Int8Array, next: Int8Array): BoardDiff | null {
  if (prev.length !== next.length) return null;
  let placed = -1;
  const captured: number[] = [];
  for (let p = 0; p < next.length; p++) {
    if (prev[p] === next[p]) continue;
    if (!prev[p] && next[p]) { if (placed >= 0) return null; placed = p; }
    else if (prev[p] && !next[p]) captured.push(p);
    else return null;
  }
  if (placed < 0) return null;
  for (const p of captured) if (prev[p] === next[placed]) return null; // pas une capture : annulation, autre position
  return { placed, captured };
}
