// Reconnaissance d'un plateau photographié (#655) : homographie, classement, et précision par intersection sur les
// photos de test (src/go/__fixtures__/photos/, écrites par outils/photosSynthetiques.ts) et sur un lot généré ici.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { appliquer, homographie, homographieGrille, inverse, quadrilatereValide, type Coins } from './homographie';
import { affinerCoins, classer, precision, reconnaitre, SEUIL_INCERTAIN } from './reconnaissance';
import { decoderPng, encoderPng } from './pngNode';
import { hasard, synthetiser } from './synthese';

/** Seuil exigé : part des intersections bien lues, coins posés à ±0,15 case près (comme au doigt, avec la loupe). */
const SEUIL_PRECISION = 0.99;

const DOSSIER = fileURLToPath(new URL('../__fixtures__/photos/', import.meta.url));
interface Verite { taille: number; coins: [number, number][]; plateau: string[]; licence: string; source: string; limite?: boolean }
const VERITE = JSON.parse(readFileSync(`${DOSSIER}verite.json`, 'utf8')) as Record<string, Verite>;

const versPlateau = (rows: string[]) => Int8Array.from(rows.join(''), ch => (ch === 'X' ? 1 : ch === 'O' ? 2 : 0));
const coinsDe = (c: [number, number][]) => c.map(([x, y]) => ({ x, y })) as unknown as Coins;

/** Coins tels qu'un joueur les poserait : à ±`ecart` case près. */
function coinsDuJoueur(coins: Coins, taille: number, graine: number, ecart: number): Coins {
  const r = hasard(graine), cote = Math.hypot(coins[1].x - coins[0].x, coins[1].y - coins[0].y) / (taille - 1);
  return coins.map(c => ({ x: c.x + (r() * 2 - 1) * ecart * cote, y: c.y + (r() * 2 - 1) * ecart * cote })) as unknown as Coins;
}

describe('homographie', () => {
  const quad: Coins = [{ x: 100, y: 80 }, { x: 520, y: 60 }, { x: 600, y: 470 }, { x: 40, y: 430 }];

  it('envoie les 4 coins de la grille sur les coins de la photo', () => {
    const h = homographieGrille(quad, 19);
    const coins = [[0, 0], [18, 0], [18, 18], [0, 18]].map(([u, v]) => appliquer(h, u, v));
    coins.forEach((c, i) => { expect(c.x).toBeCloseTo(quad[i].x, 6); expect(c.y).toBeCloseTo(quad[i].y, 6); });
  });

  it('garde les droites : le milieu de la grille est à la croisée des diagonales', () => {
    const h = homographieGrille(quad, 9), m = appliquer(h, 4, 4);
    // Intersection des diagonales du quadrilatère.
    const [a, b, c, d] = quad;
    const croix = (u: { x: number; y: number }, v: { x: number; y: number }) => u.x * v.y - u.y * v.x;
    const sub = (u: { x: number; y: number }, v: { x: number; y: number }) => ({ x: u.x - v.x, y: u.y - v.y });
    const t = croix(sub(b, a), sub(d, b)) / croix(sub(c, a), sub(d, b));
    expect(m.x).toBeCloseTo(a.x + t * (c.x - a.x), 6);
    expect(m.y).toBeCloseTo(a.y + t * (c.y - a.y), 6);
  });

  it('inverse : aller-retour exact', () => {
    const h = homographie([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }], quad), hi = inverse(h);
    for (const [x, y] of [[0.3, 0.7], [0.5, 0.5], [1, 0]]) {
      const p = appliquer(h, x, y), q = appliquer(hi, p.x, p.y);
      expect(q.x).toBeCloseTo(x, 9); expect(q.y).toBeCloseTo(y, 9);
    }
  });

  it('refuse des coins croisés ou alignés', () => {
    expect(quadrilatereValide(quad)).toBe(true);
    expect(quadrilatereValide([quad[0], quad[2], quad[1], quad[3]])).toBe(false);
    expect(quadrilatereValide([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }])).toBe(false);
    expect(() => homographie([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }], quad)).toThrow();
  });
});

describe('classer : relatif au bois voisin', () => {
  it('bois, noire, blanche', () => {
    expect(classer(1, 1, 1)).toEqual({ couleur: 0, confiance: 1 });
    expect(classer(0.2, 1, 0.1).couleur).toBe(1);
    expect(classer(1.25, 1.9, 0.1).couleur).toBe(2);
  });
  it('sous une lampe orangée, la blanche reste plus bleue que le bois', () => {
    // Saturation proche de celle du bois, mais rapport bleu / rouge nettement au-dessus.
    expect(classer(1.2, 1.7, 0.55).couleur).toBe(2);
  });
  it('à la limite, la confiance tombe', () => {
    expect(classer(0.56, 1, 1).confiance).toBeLessThan(SEUIL_INCERTAIN);
    expect(classer(1, 1.3, 1).confiance).toBeLessThan(SEUIL_INCERTAIN);
  });
});

describe('PNG des photos de test', () => {
  it('encode puis décode à l’identique', () => {
    const s = synthetiser({ graine: 5, taille: 9, largeur: 64, hauteur: 48 });
    const d = decoderPng(encoderPng(s.image));
    expect([d.width, d.height]).toEqual([64, 48]);
    expect(Array.from(d.data)).toEqual(Array.from(s.image.data));
  });
});

describe('précision sur les photos de test (src/go/__fixtures__/photos)', () => {
  const noms = Object.keys(VERITE);
  it('le dossier contient des photos, chacune avec sa source et sa licence', () => {
    expect(noms.length).toBeGreaterThanOrEqual(6);
    for (const n of noms) { expect(VERITE[n].licence).toBeTruthy(); expect(VERITE[n].source).toBeTruthy(); }
  });

  let total = 0, justes = 0;
  for (const nom of noms) {
    it(nom, () => {
      const v = VERITE[nom], img = decoderPng(readFileSync(`${DOSSIER}${nom}`));
      const vrai = versPlateau(v.plateau);
      // Coins exacts, puis coins posés au doigt (à ±0,15 case).
      const exact = reconnaitre(img, coinsDe(v.coins), v.taille);
      const doigt = reconnaitre(img, coinsDuJoueur(coinsDe(v.coins), v.taille, nom.length, 0.15), v.taille);
      const p = Math.min(precision(exact.plateau, vrai), precision(doigt.plateau, vrai));
      total += vrai.length; justes += precision(doigt.plateau, vrai) * vrai.length;
      // Cas limite (reflet) : mesuré, et chaque faute doit au moins être signalée au joueur.
      if (/reflet/.test(nom)) {
        for (let q = 0; q < vrai.length; q++) if (doigt.plateau[q] !== vrai[q]) expect(doigt.incertaines).toContain(q);
      } else expect(p).toBeGreaterThanOrEqual(0.98);
    }, 30_000);
  }
  it(`au moins ${SEUIL_PRECISION * 100} % des intersections bien lues sur l’ensemble`, () => {
    expect(total).toBeGreaterThan(0);
    expect(justes / total).toBeGreaterThanOrEqual(SEUIL_PRECISION);
  });
});

describe('précision sur un lot synthétique varié (perspective, éclairage, teinte, flou, débord)', () => {
  it(`au moins ${SEUIL_PRECISION * 100} % par intersection, et toute faute signalée comme incertaine`, () => {
    let total = 0, justes = 0, nonSignalees = 0;
    for (const taille of [9, 13, 19] as const) for (let g = 1; g <= 3; g++) {
      const r = hasard(taille * 31 + g);
      const s = synthetiser({
        graine: taille * 7919 + g, taille, largeur: 640, hauteur: 480, inclinaison: r(), eclairage: r(), debord: 0.25 * r(),
        teinte: 2 * r() - 1, flou: Math.floor(3 * r()), bruit: 4 + 8 * r(),
      });
      const rec = reconnaitre(s.image, coinsDuJoueur(s.coins, taille, g * 13, 0.15), taille);
      total += s.plateau.length; justes += precision(rec.plateau, s.plateau) * s.plateau.length;
      for (let p = 0; p < s.plateau.length; p++) if (rec.plateau[p] !== s.plateau[p] && !rec.incertaines.includes(p)) nonSignalees++;
    }
    expect(justes / total).toBeGreaterThanOrEqual(SEUIL_PRECISION);
    expect(nonSignalees).toBe(0);
  }, 120_000);

  it('affinage : des coins décalés d’un quart de case reviennent sur la grille', () => {
    const s = synthetiser({ graine: 77, taille: 13, largeur: 640, hauteur: 480, inclinaison: 0.6 });
    const poses = coinsDuJoueur(s.coins, 13, 3, 0.25);
    const ecart = (c: Coins) => Math.max(...c.map((p, i) => Math.hypot(p.x - s.coins[i].x, p.y - s.coins[i].y)));
    expect(ecart(affinerCoins(s.image, poses, 13))).toBeLessThan(ecart(poses));
  }, 30_000);

  it('plateau vide : rien d’inventé', () => {
    const s = synthetiser({ graine: 4, taille: 9, largeur: 480, hauteur: 360, plateau: new Int8Array(81), eclairage: 0.8 });
    const rec = reconnaitre(s.image, s.coins, 9);
    expect([...rec.plateau].every(v => v === 0)).toBe(true);
  }, 30_000);
});
