// Reconnaissance des pierres sur une photo de goban (#655), sur l'appareil, sans bibliothèque : du canvas et des maths.
// 1. L'homographie des 4 coins de la grille donne la place de chaque intersection sur la photo (perspective corrigée).
// 2. Autour de chaque intersection, on lit une petite zone, sur les diagonales (pour éviter les lignes de la grille).
// 3. Le bois de référence est lu au centre des cases voisines, là où une pierre ne va jamais : le seuil suit l'éclairage
//    local (ombre d'un côté, lampe de l'autre).
// 4. Une pierre noire est nettement plus sombre que le bois ; une blanche est claire et sans couleur, alors que le bois
//    est jaune : on compare luminance, saturation et rapport bleu / rouge à ceux du bois voisin.
// Le résultat donne aussi une confiance par intersection : les points douteux sont montrés au joueur, qui corrige.
import { appliquer, homographieGrille, type Coins } from './homographie';

/** Image RGBA, comme `ImageData` (aussi lisible hors navigateur, pour les tests). */
export interface ImageRGBA { width: number; height: number; data: ArrayLike<number> }

export interface Reconnaissance {
  taille: number;
  /** 0 vide, 1 noir, 2 blanc ; index `y * taille + x`. */
  plateau: Int8Array;
  /** De 0 (au hasard) à 1 (sûr). */
  confiance: Float32Array;
  /** Intersections dont la confiance est sous SEUIL_INCERTAIN, triées. */
  incertaines: number[];
}

/** Sous cette confiance, une intersection est montrée comme incertaine. */
export const SEUIL_INCERTAIN = 0.5;

/**
 * Seuils, relatifs au bois voisin. Pierre noire : luminance sous NOIR_LUM fois celle du bois. Pierre blanche : plus
 * bleue que le bois (rapport bleu / rouge au-dessus de BLANC_BLEU fois celui du bois) ou bien moins saturée (sous
 * BLANC_SAT fois). Le bois est jaune, la pierre blanche prend la couleur de la lumière : comparer au bois voisin annule
 * la teinte de l'éclairage (lampe orangée, jour bleuté).
 */
export const SEUILS = { NOIR_LUM: 0.55, BLANC_BLEU: 1.3, BLANC_SAT: 0.45, MARGE_LUM: 0.2, MARGE_BLEU: 0.25, MARGE_SAT: 0.2 } as const;

/** Distances (en cases) des points lus autour d'une intersection, sur les 4 diagonales. */
const RAYONS = [0.12, 0.2, 0.28] as const;
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const;

interface Mesure { lum: number; sat: number; bleu: number }

function mediane(v: number[]): number {
  if (!v.length) return 0;
  const s = [...v].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Couleur au point (x, y) de l'image, interpolée entre les 4 pixels voisins ; null hors de l'image. */
function lire(img: ImageRGBA, x: number, y: number): [number, number, number] | null {
  if (!(x >= 0 && y >= 0 && x <= img.width - 1 && y <= img.height - 1)) return null;
  const x0 = Math.min(Math.floor(x), img.width - 2), y0 = Math.min(Math.floor(y), img.height - 2);
  const fx = x - x0, fy = y - y0, d = img.data, w = img.width;
  const out: [number, number, number] = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const a = d[(y0 * w + x0) * 4 + c], b = d[(y0 * w + x0 + 1) * 4 + c];
    const e = d[((y0 + 1) * w + x0) * 4 + c], f = d[((y0 + 1) * w + x0 + 1) * 4 + c];
    out[c] = (a * (1 - fx) + b * fx) * (1 - fy) + (e * (1 - fx) + f * fx) * fy;
  }
  return out;
}

/** Luminance, saturation (écart max − min des canaux) et rapport bleu / rouge de chaque point lu dans l'image. */
function lirePoints(img: ImageRGBA, points: { x: number; y: number }[]): Mesure[] {
  const out: Mesure[] = [];
  for (const p of points) {
    const c = lire(img, p.x, p.y);
    if (c) out.push({ lum: 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2], sat: Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]), bleu: (c[2] + 4) / (c[0] + 4) });
  }
  return out;
}

/** Mesures médianes des points lus (null si aucun n'est dans l'image). */
function mesurer(img: ImageRGBA, points: { x: number; y: number }[]): Mesure | null {
  const m = lirePoints(img, points);
  return m.length ? { lum: mediane(m.map(v => v.lum)), sat: mediane(m.map(v => v.sat)), bleu: mediane(m.map(v => v.bleu)) } : null;
}

const borne = (v: number) => Math.max(0, Math.min(1, v));

/** Classe une intersection d'après ses mesures relatives au bois voisin (1 : comme le bois) : couleur et confiance. */
export function classer(lumRel: number, bleuRel: number, satRel: number): { couleur: 0 | 1 | 2; confiance: number } {
  const S = SEUILS;
  if (lumRel < S.NOIR_LUM) return { couleur: 1, confiance: borne((S.NOIR_LUM - lumRel) / S.MARGE_LUM) };
  const clair = borne((lumRel - S.NOIR_LUM) / S.MARGE_LUM);
  // Indice de pierre blanche : positif si blanche, négatif si bois ; le plus fort des deux signes l'emporte.
  const blanc = Math.max((bleuRel - S.BLANC_BLEU) / S.MARGE_BLEU, (S.BLANC_SAT - satRel) / S.MARGE_SAT);
  return { couleur: blanc > 0 ? 2 : 0, confiance: Math.min(clair, borne(Math.abs(blanc))) };
}

interface Lecture { plateau: Int8Array; confiance: Float32Array; note: number }

/** Lecteur d'une photo pour des coins donnés : bois de référence, puis lecture des intersections. */
function lecteur(img: ImageRGBA, coins: Coins, taille: number): (du: number, dv: number) => Lecture {
  const h = homographieGrille(coins, taille), n = taille - 1;
  const vers = (u: number, v: number) => appliquer(h, u, v);

  // Bois au centre de chaque case : jamais sous une pierre posée sur une intersection.
  const cases: (Mesure | null)[] = [];
  for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) {
    const u = a + 0.5, v = b + 0.5;
    cases.push(mesurer(img, [vers(u, v), vers(u + 0.08, v + 0.08), vers(u - 0.08, v + 0.08), vers(u + 0.08, v - 0.08), vers(u - 0.08, v - 0.08)]));
  }
  // Une case trop peu saturée est couverte (pierre qui déborde, reflet) : elle ne sert pas de référence.
  const satGlobale = mediane(cases.flatMap(c => (c ? [c.sat] : [])));
  const valide = (c: Mesure | null): c is Mesure => !!c && c.sat >= 0.35 * satGlobale && c.sat > 4;
  const toutes = cases.filter(valide);
  const globale: Mesure = { lum: mediane(toutes.map(c => c.lum)) || 1, sat: mediane(toutes.map(c => c.sat)) || 1, bleu: mediane(toutes.map(c => c.bleu)) || 1 };

  /** Bois de référence autour de l'intersection (i, j) : médiane des cases voisines valides (4 × 4, plus si besoin). */
  const boisPres = (i: number, j: number): Mesure => {
    for (const r of [2, 3, 5]) {
      const lums: number[] = [], sats: number[] = [], bleus: number[] = [];
      for (let b = Math.max(0, j - r); b < Math.min(n, j + r); b++) for (let a = Math.max(0, i - r); a < Math.min(n, i + r); a++) {
        const c = cases[b * n + a];
        if (valide(c)) { lums.push(c.lum); sats.push(c.sat); bleus.push(c.bleu); }
      }
      if (lums.length >= 3) return { lum: mediane(lums), sat: mediane(sats), bleu: mediane(bleus) };
    }
    return globale;
  };
  const bois = Array.from({ length: taille * taille }, (_, p) => boisPres(p % taille, (p / taille) | 0));
  // Reflet de lampe : une case pâle et plus claire que le bois ressemble à une pierre blanche. Autour d'elle, une lecture
  // « blanche » ou « vide » n'est jamais sûre : on la montre au joueur.
  const reflet = (c: Mesure | null) => !!c && c.sat < 0.45 * globale.sat && c.lum > 1.05 * globale.lum;
  const eblouie = Array.from({ length: taille * taille }, (_, p) => {
    const i = p % taille, j = (p / taille) | 0;
    for (let b = j - 2; b <= j + 1; b++) for (let a = i - 2; a <= i + 1; a++) if (a >= 0 && b >= 0 && a < n && b < n && reflet(cases[b * n + a])) return true;
    return false;
  });

  /** Lit toutes les intersections, les points lus décalés de (du, dv) cases. */
  return (du, dv) => {
    const plateau = new Int8Array(taille * taille), confiance = new Float32Array(taille * taille);
    let note = 0;
    for (let j = 0; j < taille; j++) for (let i = 0; i < taille; i++) {
      const p = j * taille + i;
      const mesures = lirePoints(img, RAYONS.flatMap(r => DIAG.map(([dx, dy]) => vers(i + du + dx * r, j + dv + dy * r))));
      if (!mesures.length) continue;
      // Chaque point lu vote (un reflet sur une pierre noire, un bout de bois quand les coins sont un peu décalés : la
      // majorité l'emporte). Confiance : avance du gagnant sur le deuxième, rapportée au total des voix.
      const b = bois[p], voix = [0, 0, 0];
      for (const m of mesures) {
        const v = classer(m.lum / Math.max(1, b.lum), m.bleu / b.bleu, m.sat / Math.max(1, b.sat));
        voix[v.couleur] += 0.5 + 0.5 * v.confiance;
      }
      const ordre = [0, 1, 2].sort((x, y) => voix[y] - voix[x]);
      plateau[p] = ordre[0];
      confiance[p] = borne(((voix[ordre[0]] - voix[ordre[1]]) / (voix[0] + voix[1] + voix[2])) * 1.4);
      if (eblouie[p] && plateau[p] !== 1) confiance[p] = Math.min(confiance[p], 0.3);
      // Note de la lecture : les pierres comptent plus que le bois, sinon une grille décalée d'une demi-case (qui ne
      // lit que du bois, avec assurance) gagnerait.
      note += plateau[p] ? confiance[p] : 0.3 * confiance[p];
    }
    return { plateau, confiance, note };
  };
}

/** Longueur moyenne d'une case sur la photo, en pixels (pour régler les pas d'affinage). */
function pasCase(coins: Coins, taille: number): number {
  let l = 0;
  for (let i = 0; i < 4; i++) l += Math.hypot(coins[(i + 1) % 4].x - coins[i].x, coins[(i + 1) % 4].y - coins[i].y);
  return l / 4 / (taille - 1);
}

/**
 * Affine les coins posés par le joueur : chaque coin bouge d'au plus 0,3 case si la lecture devient plus nette
 * (confiance totale plus haute). Un coin posé à quelques pixels près suffit donc ; jamais plus d'un tiers de case,
 * pour ne pas sauter d'une ligne à l'autre.
 */
export function affinerCoins(img: ImageRGBA, coins: Coins, taille: number): Coins {
  let actuels = [...coins] as [Coins[0], Coins[1], Coins[2], Coins[3]];
  let note = lecteur(img, actuels, taille)(0, 0).note;
  const pas = pasCase(coins, taille);
  for (const fraction of [0.15, 0.075]) {
    for (let tour = 0; tour < 2; tour++) {
      let mieux = false;
      for (let k = 0; k < 4; k++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const essai = [...actuels] as typeof actuels;
        const c = essai[k], x = c.x + dx * fraction * pas, y = c.y + dy * fraction * pas;
        if (Math.hypot(x - coins[k].x, y - coins[k].y) > 0.3 * pas) continue;
        essai[k] = { x, y };
        const s = lecteur(img, essai, taille)(0, 0).note;
        if (s > note + 0.25) { actuels = essai; note = s; mieux = true; }
      }
      if (!mieux) break;
    }
  }
  return actuels;
}

/**
 * Lit le plateau sur la photo. `coins` : les 4 coins de la grille, en pixels (haut gauche, haut droite, bas droite,
 * bas gauche). `affiner` (vrai par défaut) : les coins sont d'abord ajustés finement (`affinerCoins`).
 */
export function reconnaitre(img: ImageRGBA, coins: Coins, taille: number, affiner = true): Reconnaissance {
  const lire = lecteur(img, affiner ? affinerCoins(img, coins, taille) : coins, taille);
  // Débord : vues de biais, les pierres (épaisses) semblent glisser vers l'objectif. On essaie de petits décalages de
  // la zone lue et on garde la lecture la plus nette (confiance totale).
  let meilleur = lire(0, 0);
  for (const du of DECALAGES) for (const dv of DECALAGES) {
    if (!du && !dv) continue;
    const l = lire(du, dv);
    if (l.note > meilleur.note + 0.5) meilleur = l;
  }
  const incertaines: number[] = [];
  meilleur.confiance.forEach((c, p) => { if (c < SEUIL_INCERTAIN) incertaines.push(p); });
  return { taille, plateau: meilleur.plateau, confiance: meilleur.confiance, incertaines };
}

/** Décalages essayés, en cases. */
const DECALAGES = [-0.2, -0.1, 0, 0.1, 0.2] as const;

/** Part des intersections bien lues (de 0 à 1). */
export function precision(lu: ArrayLike<number>, vrai: ArrayLike<number>): number {
  let ok = 0;
  for (let p = 0; p < vrai.length; p++) if (lu[p] === vrai[p]) ok++;
  return vrai.length ? ok / vrai.length : 1;
}
