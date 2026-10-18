// Coins proposés (#655) : une première place pour les 4 coins de la grille, que le joueur ajuste ensuite.
// Sans bibliothèque : on cherche la grande zone de bois (jaune, saturée) qui contient le centre de la photo, on prend ses
// 4 points extrêmes en diagonale (les coins du goban), puis on rentre de la marge habituelle entre le bord du bois et la
// première ligne. Ce n'est qu'un point de départ : la lecture affine ensuite les coins d'un tiers de case au plus.
import { appliquer, homographie, quadrilatereValide, type Coins } from './homographie';
import type { ImageRGBA } from './reconnaissance';

/** Marge entre le bord du bois et la première ligne, en cases (goban courant : 14 mm pour 22 mm entre deux lignes). */
export const MARGE_BOIS = 0.62;

/** Coins par défaut : un rectangle centré, à 12 % des bords. */
export function coinsParDefaut(largeur: number, hauteur: number): Coins {
  const mx = largeur * 0.12, my = hauteur * 0.12;
  return [{ x: mx, y: my }, { x: largeur - mx, y: my }, { x: largeur - mx, y: hauteur - my }, { x: mx, y: hauteur - my }];
}

/** Pixel de bois : jaune ou orangé (rouge > vert > bleu), assez saturé, ni noir ni brûlé. */
function bois(r: number, g: number, b: number): boolean {
  return r > 60 && r >= g && g >= b && (r - b) > 0.3 * r && r < 254;
}

/**
 * Coins proposés pour la grille, ou null si aucune zone de bois nette n'entoure le centre de la photo (le joueur place
 * alors les coins à la main, depuis `coinsParDefaut`).
 */
export function proposerCoins(img: ImageRGBA, taille: number): Coins | null {
  // Grille de lecture grossière (160 colonnes au plus) : rapide sur un téléphone.
  const pas = Math.max(1, Math.round(Math.max(img.width, img.height) / 160));
  const L = Math.floor(img.width / pas), H = Math.floor(img.height / pas);
  const lum = new Float32Array(L * H), bleu = new Float32Array(L * H), masque = new Uint8Array(L * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < L; x++) {
    const i = (y * pas * img.width + x * pas) * 4, d = img.data;
    lum[y * L + x] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    bleu[y * L + x] = (d[i + 2] + 4) / (d[i] + 4);
    masque[y * L + x] = bois(d[i], d[i + 1], d[i + 2]) ? 1 : 0;
  }
  // Le bois du goban est celui du centre de la photo. La tranche (plus sombre) et une table d'une autre teinte
  // (plus grise, ou plus rouge) n'en sont pas : on les retire.
  const lums: number[] = [], bleus: number[] = [];
  for (let y = Math.floor(H * 0.3); y < H * 0.7; y++) for (let x = Math.floor(L * 0.3); x < L * 0.7; x++) {
    if (masque[y * L + x]) { lums.push(lum[y * L + x]); bleus.push(bleu[y * L + x]); }
  }
  if (lums.length < 10) return null;
  const med = (v: number[]) => v.sort((a, b) => a - b)[v.length >> 1];
  const refLum = med(lums), refBleu = med(bleus);
  for (let p = 0; p < masque.length; p++) if (lum[p] < 0.55 * refLum || Math.abs(bleu[p] - refBleu) > 0.1) masque[p] = 0;
  // Les pierres et les lignes trouent le bois : on bouche les petits trous (fermeture de 2 cellules).
  const ferme = dilater(eroder(dilater(dilater(masque, L, H), L, H), L, H), L, H);
  // Zone du centre (ou la plus proche du centre).
  let depart = -1, meilleur = Infinity;
  for (let p = 0; p < ferme.length; p++) {
    if (!ferme[p]) continue;
    const d = Math.hypot((p % L) - L / 2, ((p / L) | 0) - H / 2);
    if (d < meilleur) { meilleur = d; depart = p; }
  }
  if (depart < 0 || meilleur > Math.min(L, H) * 0.25) return null;
  const vu = new Uint8Array(ferme.length), pile = [depart];
  vu[depart] = 1;
  let n = 0, tl = { s: Infinity, x: 0, y: 0 }, br = { s: -Infinity, x: 0, y: 0 }, tr = { s: -Infinity, x: 0, y: 0 }, bl = { s: -Infinity, x: 0, y: 0 };
  while (pile.length) {
    const p = pile.pop()!, x = p % L, y = (p / L) | 0;
    n++;
    if (x + y < tl.s) tl = { s: x + y, x, y };
    if (x + y > br.s) br = { s: x + y, x, y };
    if (x - y > tr.s) tr = { s: x - y, x, y };
    if (y - x > bl.s) bl = { s: y - x, x, y };
    for (const q of [p - 1, p + 1, p - L, p + L]) {
      if (q < 0 || q >= ferme.length || vu[q] || !ferme[q]) continue;
      if ((q === p - 1 && x === 0) || (q === p + 1 && x === L - 1)) continue;
      vu[q] = 1; pile.push(q);
    }
  }
  // Une zone trop petite (moins d'un dixième de la photo) n'est pas le goban.
  if (n < 0.1 * L * H) return null;
  const centre = (c: { x: number; y: number }) => ({ x: (c.x + 0.5) * pas, y: (c.y + 0.5) * pas });
  const bord: Coins = [centre(tl), centre(tr), centre(br), centre(bl)];
  if (!quadrilatereValide(bord)) return null;
  // Du bord du bois à la première ligne : la grille occupe (taille − 1) cases sur (taille − 1 + 2 × marge).
  const k = MARGE_BOIS / (taille - 1 + 2 * MARGE_BOIS);
  const h = homographie([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }], bord);
  const coins = [[k, k], [1 - k, k], [1 - k, 1 - k], [k, 1 - k]].map(([u, v]) => appliquer(h, u, v)) as unknown as Coins;
  return quadrilatereValide(coins) ? coins : null;
}

function dilater(m: Uint8Array, L: number, H: number): Uint8Array {
  const o = new Uint8Array(m.length);
  for (let y = 0; y < H; y++) for (let x = 0; x < L; x++) {
    const p = y * L + x;
    o[p] = m[p] || (x > 0 && m[p - 1]) || (x < L - 1 && m[p + 1]) || (y > 0 && m[p - L]) || (y < H - 1 && m[p + L]) ? 1 : 0;
  }
  return o;
}

function eroder(m: Uint8Array, L: number, H: number): Uint8Array {
  const o = new Uint8Array(m.length);
  for (let y = 0; y < H; y++) for (let x = 0; x < L; x++) {
    const p = y * L + x;
    o[p] = m[p] && (x === 0 || m[p - 1]) && (x === L - 1 || m[p + 1]) && (y === 0 || m[p - L]) && (y === H - 1 || m[p + L]) ? 1 : 0;
  }
  return o;
}
