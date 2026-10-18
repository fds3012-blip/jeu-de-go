// Photos synthétiques de goban (#655), pour mesurer la reconnaissance sans photo réelle : bois veiné, grille, hoshi,
// pierres en relief (reflet, ombre portée, léger débord vers l'objectif), perspective, éclairage inégal, bruit du capteur,
// et en option un reflet de lampe sur le bois. Déterministe : une graine donne toujours la même image.
// Utilisé par les tests et par outils/photosSynthetiques.ts (qui écrit src/go/__fixtures__/photos/). Jamais par l'app.
import { appliquer, homographieGrille, inverse, type Coins } from './homographie';
import type { ImageRGBA } from './reconnaissance';

export interface OptionsSynthese {
  graine: number;
  taille: 9 | 13 | 19;
  largeur?: number;
  hauteur?: number;
  /** Part des intersections occupées (0,4 par défaut). */
  densite?: number;
  /** Force de la perspective, de 0 (vue de dessus) à 1 (photo prise de biais). */
  inclinaison?: number;
  /** Écart d'éclairage, de 0 (uniforme) à 1 (un côté deux fois plus sombre). */
  eclairage?: number;
  /** Débord des pierres vers l'objectif, en cases (leur épaisseur vue de biais). */
  debord?: number;
  /** Amplitude du bruit du capteur, en niveaux (sur 255). */
  bruit?: number;
  /** Reflet de lampe sur le bois (une tache presque blanche). */
  reflet?: boolean;
  /** Couleur de la lumière, de −1 (froide, bleutée) à 1 (lampe à incandescence, orangée). */
  teinte?: number;
  /** Flou de l'objectif, rayon en pixels (0 : net). */
  flou?: number;
  /** Position imposée (sinon tirée au hasard). */
  plateau?: Int8Array;
}

export interface PhotoSynthetique { image: ImageRGBA & { data: Uint8ClampedArray }; coins: Coins; plateau: Int8Array }

/** Générateur pseudo-aléatoire reproductible (mulberry32). */
export function hasard(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HOSHI: Record<number, number[]> = { 9: [2, 4, 6], 13: [3, 6, 9], 19: [3, 9, 15] };

/** Position au hasard, en grappes (comme une vraie partie), avec `densite` pierres par intersection. */
function positionAuHasard(r: () => number, taille: number, densite: number): Int8Array {
  const b = new Int8Array(taille * taille);
  const cible = Math.round(densite * b.length);
  let poses = 0, essais = 0;
  while (poses < cible && essais++ < 20 * b.length) {
    const p = Math.floor(r() * b.length);
    if (b[p]) continue;
    // Une pierre préfère rejoindre une pierre de sa couleur : groupes et murs plutôt que poussière.
    const x = p % taille, y = (p / taille) | 0, voisins: number[] = [];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const q = (y + dy) * taille + x + dx;
      if (x + dx >= 0 && x + dx < taille && y + dy >= 0 && y + dy < taille && b[q]) voisins.push(b[q]);
    }
    b[p] = voisins.length && r() < 0.7 ? voisins[Math.floor(r() * voisins.length)] : r() < 0.5 ? 1 : 2;
    poses++;
  }
  return b;
}

export function synthetiser(o: OptionsSynthese): PhotoSynthetique {
  const r = hasard(o.graine);
  const N = o.taille, n = N - 1;
  const W = o.largeur ?? 960, H = o.hauteur ?? 720;
  const incl = o.inclinaison ?? 0.5, ecl = o.eclairage ?? 0.5, debord = o.debord ?? 0.08, bruit = o.bruit ?? 6;
  const plateau = o.plateau ? Int8Array.from(o.plateau) : positionAuHasard(r, N, o.densite ?? 0.4);

  // Coins de la grille : un rectangle centré, rétréci en haut (perspective), tourné un peu, chaque coin bougé un peu.
  const cote = Math.min(W, H) * (0.78 + 0.08 * r());
  const cx = W / 2 + (r() - 0.5) * 0.06 * W, cy = H / 2 + (r() - 0.5) * 0.05 * H;
  const haut = 1 - 0.32 * incl, hauteurVue = 1 - 0.18 * incl;
  const angle = (r() - 0.5) * 0.12;
  const brut = [[-haut / 2, -hauteurVue / 2], [haut / 2, -hauteurVue / 2], [0.5, hauteurVue / 2], [-0.5, hauteurVue / 2]];
  const coins = brut.map(([x, y]) => {
    const jx = x + (r() - 0.5) * 0.03, jy = y + (r() - 0.5) * 0.03;
    return { x: cx + cote * (jx * Math.cos(angle) - jy * Math.sin(angle)), y: cy + cote * (jx * Math.sin(angle) + jy * Math.cos(angle)) };
  }) as unknown as Coins;
  const vers = homographieGrille(coins, N), depuis = inverse(vers);

  // Pierres : petit décalage et rayon propres à chacune ; débord vers le bas de la photo (vers l'objectif).
  const pierres = new Map<number, { cx: number; cy: number; ray: number; c: 1 | 2 }>();
  for (let p = 0; p < plateau.length; p++) {
    if (!plateau[p]) continue;
    pierres.set(p, { cx: (p % N) + (r() - 0.5) * 0.1, cy: ((p / N) | 0) + debord + (r() - 0.5) * 0.1, ray: 0.47 + (r() - 0.5) * 0.03, c: plateau[p] as 1 | 2 });
  }
  const marge = 0.62 + 0.1 * r();
  const table: [number, number, number] = r() < 0.5 ? [70, 66, 62] : [118, 104, 92];
  const bois: [number, number, number] = [222 + (r() - 0.5) * 16, 178 + (r() - 0.5) * 16, 112 + (r() - 0.5) * 20];
  // Éclairage : un dégradé dans une direction au hasard, plus une tache plus claire (la lampe).
  const dir = r() * Math.PI * 2, lampeX = r() * W, lampeY = r() * H;
  const lumiere = (x: number, y: number) => {
    const t = ((x - W / 2) * Math.cos(dir) + (y - H / 2) * Math.sin(dir)) / Math.hypot(W, H) + 0.5;
    const lampe = Math.exp(-((x - lampeX) ** 2 + (y - lampeY) ** 2) / (2 * (0.3 * W) ** 2));
    return (1.05 - ecl * 0.55 * t) * (0.9 + 0.15 * lampe);
  };
  const reflet = o.reflet ? { x: W * (0.3 + 0.4 * r()), y: H * (0.3 + 0.4 * r()), rx: W * 0.07, ry: H * 0.05 } : null;
  const veine = r() * 10;
  const tt = o.teinte ?? 0;
  const illum = tt >= 0 ? [1, 1 - 0.1 * tt, 1 - 0.32 * tt] : [1 + 0.15 * tt, 1 + 0.05 * tt, 1];

  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const { x: u, y: v } = appliquer(depuis, x + 0.5, y + 0.5);
    let c: [number, number, number];
    if (u < -marge || v < -marge || u > n + marge || v > n + marge) {
      // Tranche du goban (sous le bord bas), puis la table.
      c = v > n + marge && v < n + marge + 0.5 && u > -marge && u < n + marge ? [122, 78, 34] : [...table];
    } else {
      const g = 1 + 0.05 * Math.sin(v * 7.3 + veine + 0.8 * Math.sin(u * 1.7)) + 0.03 * Math.sin(v * 23 + u * 0.4);
      c = [bois[0] * g, bois[1] * g, bois[2] * g];
      // Lignes de la grille (0,035 case de demi-épaisseur), et hoshi.
      const du = Math.abs(u - Math.round(u)), dv = Math.abs(v - Math.round(v));
      const dansU = Math.round(u) >= 0 && Math.round(u) <= n && v >= -0.02 && v <= n + 0.02;
      const dansV = Math.round(v) >= 0 && Math.round(v) <= n && u >= -0.02 && u <= n + 0.02;
      const ligne = (dansU && du < 0.035) || (dansV && dv < 0.035);
      const hoshi = HOSHI[N].includes(Math.round(u)) && HOSHI[N].includes(Math.round(v)) && Math.hypot(du, dv) < 0.09;
      if (ligne || hoshi) c = [c[0] * 0.3, c[1] * 0.25, c[2] * 0.2];
      // Ombre portée d'une pierre voisine (vers le bas à droite), puis la pierre elle-même.
      let pierre: { cx: number; cy: number; ray: number; c: 1 | 2 } | null = null, ombre = false;
      for (let dj = -1; dj <= 1 && !pierre; dj++) for (let di = -1; di <= 1; di++) {
        const i = Math.round(u) + di, j = Math.round(v - debord) + dj;
        if (i < 0 || j < 0 || i > n || j > n) continue;
        const s = pierres.get(j * N + i);
        if (!s) continue;
        const d = Math.hypot(u - s.cx, v - s.cy);
        if (d < s.ray) { pierre = s; break; }
        if (Math.hypot(u - s.cx - 0.07, v - s.cy - 0.07) < s.ray) ombre = true;
      }
      if (pierre) {
        const dx = (u - pierre.cx) / pierre.ray, dy = (v - pierre.cy) / pierre.ray;
        const bord = 1 - 0.35 * (dx * dx + dy * dy);
        const eclat = Math.exp(-((dx + 0.35) ** 2 + (dy + 0.4) ** 2) / 0.05);
        c = pierre.c === 1
          ? [24 * bord + 90 * eclat, 25 * bord + 92 * eclat, 27 * bord + 95 * eclat]
          : [236 * bord + 19 * eclat, 233 * bord + 22 * eclat, 224 * bord + 31 * eclat];
      } else if (ombre) c = [c[0] * 0.72, c[1] * 0.7, c[2] * 0.68];
    }
    const l = lumiere(x, y);
    let rr = c[0] * l * illum[0], gg = c[1] * l * illum[1], bb = c[2] * l * illum[2];
    if (reflet) {
      const k = Math.exp(-(((x - reflet.x) / reflet.rx) ** 2 + ((y - reflet.y) / reflet.ry) ** 2));
      rr += (255 - rr) * 0.85 * k; gg += (255 - gg) * 0.85 * k; bb += (255 - bb) * 0.85 * k;
    }
    const e = (r() + r() + r() - 1.5) * bruit;
    const i4 = (y * W + x) * 4;
    data[i4] = rr + e; data[i4 + 1] = gg + e; data[i4 + 2] = bb + e; data[i4 + 3] = 255;
  }
  return { image: { width: W, height: H, data: o.flou ? flouter(data, W, H, Math.round(o.flou)) : data }, coins, plateau };
}

/** Flou en boîte (horizontal puis vertical), comme une mise au point imparfaite. */
function flouter(src: Uint8ClampedArray, w: number, h: number, r: number): Uint8ClampedArray {
  const passe = (a: Uint8ClampedArray, dx: number, dy: number) => {
    const b = new Uint8ClampedArray(a.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 4; c++) {
      let s = 0, k = 0;
      for (let d = -r; d <= r; d++) {
        const xx = x + d * dx, yy = y + d * dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        s += a[(yy * w + xx) * 4 + c]; k++;
      }
      b[(y * w + x) * 4 + c] = s / k;
    }
    return b;
  };
  return passe(passe(src, 1, 0), 0, 1);
}
