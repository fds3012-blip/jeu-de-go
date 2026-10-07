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
/**
 * Cadrage du plateau sur une zone (#454 : un coin d'un 19 × 19 lu sur téléphone). Fenêtre carrée de `k` intersections
 * à partir de la colonne `x` et de la ligne `y` (depuis le haut), comme src/ui/cadrage.ts.
 */
export interface FenetrePlateau { x: number; y: number; k: number }

/**
 * Bande des coordonnées d'un plateau cadré : plus large que `coordBand`, car les lettres et les chiffres sont posés
 * hors du bois coupé (une pierre de la ligne voisine, coupée par le cadre, ne passe jamais dessous).
 */
export const BANDE_FENETRE = C * 0.55;

/** Partie visible du plateau, en unités du viewBox : coin haut gauche (`x`, `y`), côté `span`, bande des coordonnées. */
export interface VuePlateau { x: number; y: number; span: number; bande: number; fenetre: FenetrePlateau | null }

/**
 * viewBox du plateau. Sans fenêtre (ou une fenêtre qui couvre tout le plateau), c'est exactement `viewBoxOf`.
 * Avec une fenêtre : le carré du bois autour des intersections de la fenêtre (marge M de chaque côté, comme un plateau
 * de `k` lignes), plus la bande des coordonnées en haut et à gauche.
 */
export function vueDe(size: number, fenetre?: FenetrePlateau | null): VuePlateau {
  const f = fenetre && fenetre.k < size ? fenetre : null;
  if (!f) { const e = coordBand(size); return { x: -e, y: -e, span: boardWidth(size) + e, bande: e, fenetre: null }; }
  return { x: f.x * C - BANDE_FENETRE, y: f.y * C - BANDE_FENETRE, span: boardWidth(f.k) + BANDE_FENETRE, bande: BANDE_FENETRE, fenetre: f };
}

/** L'intersection `p` est-elle dans la fenêtre (toujours vrai sans fenêtre) ? */
export function dansFenetre(p: number, size: number, f: FenetrePlateau | null | undefined): boolean {
  if (!f) return p >= 0 && p < size * size;
  const x = p % size, y = Math.floor(p / size);
  return x >= f.x && x < f.x + f.k && y >= f.y && y < f.y + f.k;
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
 * Thèmes du goban (issue #109) : le kaya par défaut, puis les récompenses cosmétiques débloquées par niveau
 * (src/app/xp.ts, RECOMPENSES). Un thème règle la teinte du bois, l'encre des lignes et la nacre des pierres blanches.
 * Le goban ne change pas avec le mode sombre ou clair de l'interface : un thème a les mêmes couleurs dans les deux.
 */
export type IdThemeGoban = 'kaya' | 'kaya-clair' | 'ardoise' | 'coquillage-dore';
export interface ThemeGoban {
  id: IdThemeGoban;
  nom: string;
  /** Dégradé de fond du bois (centre, milieu, bord). */
  fond: [string, string, string];
  /** Couleur (r, g, b entre 0 et 1) et opacité (a, b de feColorMatrix) du veinage fin puis du veinage large. */
  fin: [number, number, number, number, number];
  large: [number, number, number, number, number];
  vignette: string;
  /** Encre des lignes, des hoshi et des coordonnées. */
  ligne: string;
  coord: string;
  /** Dégradé des pierres blanches (4 arrêts) et couleur des stries sombres. */
  blanche: [string, string, string, string];
  strie: string;
}

export const THEMES_GOBAN: Record<IdThemeGoban, ThemeGoban> = {
  kaya: {
    id: 'kaya', nom: 'Kaya', fond: ['#EDC27A', '#DDA95C', '#C58D42'],
    fin: [0.52, 0.30, 0.10, 0.8, -0.34], large: [0.62, 0.38, 0.14, 0.55, -0.24], vignette: '#3C1E05',
    ligne: '#2b1a08', coord: '#4a2f10', blanche: ['#fff', '#F3EEE3', '#DDD5C4', '#BDB3A0'], strie: '#8C7B5E',
  },
  // Bois plus pâle, veinage discret : les pierres blanches ressortent par leur ombre et leur liseré.
  'kaya-clair': {
    id: 'kaya-clair', nom: 'Kaya clair', fond: ['#F6DDAA', '#EDCB8C', '#DDB272'],
    fin: [0.62, 0.42, 0.18, 0.55, -0.26], large: [0.70, 0.50, 0.24, 0.4, -0.18], vignette: '#4A2A0A',
    ligne: '#2b1a08', coord: '#3f280c', blanche: ['#fff', '#F3EEE3', '#DDD5C4', '#BDB3A0'], strie: '#8C7B5E',
  },
  // Ardoise gris-bleu de luminance moyenne : lignes sombres, et les deux couleurs de pierres gardent 3:1 avec le fond.
  ardoise: {
    id: 'ardoise', nom: 'Ardoise', fond: ['#8B96A0', '#7C8792', '#66717C'],
    fin: [0.30, 0.34, 0.38, 0.5, -0.2], large: [0.40, 0.45, 0.50, 0.45, -0.18], vignette: '#10161C',
    ligne: '#0e1318', coord: '#0e1318', blanche: ['#fff', '#F4F4F1', '#DCDDDA', '#B4B8BA'], strie: '#6E7A84',
  },
  // Pierres blanches nacrées et dorées, sur le kaya habituel.
  'coquillage-dore': {
    id: 'coquillage-dore', nom: 'Coquillage doré', fond: ['#EDC27A', '#DDA95C', '#C58D42'],
    fin: [0.52, 0.30, 0.10, 0.8, -0.34], large: [0.62, 0.38, 0.14, 0.55, -0.24], vignette: '#3C1E05',
    ligne: '#2b1a08', coord: '#4a2f10', blanche: ['#FFFBEF', '#F7EBCB', '#E6CF97', '#C4A462'], strie: '#9A7A35',
  },
};

export const ORDRE_THEMES: readonly IdThemeGoban[] = ['kaya', 'kaya-clair', 'ardoise', 'coquillage-dore'];

export function themeGoban(id: string | null | undefined): ThemeGoban {
  return THEMES_GOBAN[id as IdThemeGoban] ?? THEMES_GOBAN.kaya;
}

const matrice = ([r, g, b, a, d]: ThemeGoban['fin']) => `0 0 0 0 ${r.toFixed(2)}  0 0 0 0 ${g.toFixed(2)}  0 0 0 0 ${b.toFixed(2)}  0 0 0 ${a} ${d}`;

/**
 * Bois du goban : deux couches de bruit fractal (veinage fin et veinage large), couleur du thème et vignettage.
 * Rendu une seule fois par thème en image SVG `data:` (le navigateur la rastérise et la garde en cache) :
 * les filtres feTurbulence ne sont jamais recalculés quand une pierre est posée.
 */
const woodCache = new Map<IdThemeGoban, string>();
export function woodDataUrl(id: IdThemeGoban = 'kaya'): string {
  const t = themeGoban(id);
  const deja = woodCache.get(t.id);
  if (deja) return deja;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
<defs>
<filter id="g" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
<feTurbulence type="fractalNoise" baseFrequency="0.004 0.22" numOctaves="3" seed="7" result="fin"/>
<feColorMatrix in="fin" type="matrix" result="finA" values="${matrice(t.fin)}"/>
<feTurbulence type="fractalNoise" baseFrequency="0.002 0.018" numOctaves="2" seed="11" result="large"/>
<feColorMatrix in="large" type="matrix" result="largeA" values="${matrice(t.large)}"/>
<feMerge><feMergeNode in="largeA"/><feMergeNode in="finA"/></feMerge>
</filter>
<radialGradient id="b" cx="42%" cy="35%" r="85%"><stop offset="0" stop-color="${t.fond[0]}"/><stop offset=".6" stop-color="${t.fond[1]}"/><stop offset="1" stop-color="${t.fond[2]}"/></radialGradient>
<radialGradient id="v" cx="50%" cy="50%" r="72%"><stop offset=".7" stop-color="${t.vignette}" stop-opacity="0"/><stop offset="1" stop-color="${t.vignette}" stop-opacity=".28"/></radialGradient>
</defs>
<rect width="400" height="400" fill="url(#b)"/>
<rect width="400" height="400" filter="url(#g)"/>
<rect width="400" height="400" fill="url(#v)"/>
</svg>`;
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  woodCache.set(t.id, url);
  return url;
}

/** Luminance relative et rapport de contraste WCAG entre deux couleurs #rgb ou #rrggbb. */
export function luminance(hex: string): number {
  const h = hex.replace('#', ''), full = h.length === 3 ? [...h].map(c => c + c).join('') : h;
  const [r, g, b] = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contraste(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
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
