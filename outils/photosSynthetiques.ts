// Photos de test de la reconnaissance du plateau (#655).
//
//   npx vite-node outils/photosSynthetiques.ts            écrit les photos synthétiques et leur vérité dans
//                                                         src/go/__fixtures__/photos/ (PNG + verite.json)
//   npx vite-node outils/photosSynthetiques.ts mesure     mesure la précision par intersection sur un grand lot
//                                                         (rien n'est écrit) ; chiffres repris dans
//                                                         docs/produit/photo-score-2026-10.md
//
// Les images sont générées par src/go/photo/synthese.ts (déterministe). Une vraie photo s'ajoute à la main dans le même
// dossier, avec sa ligne dans verite.json (coins de la grille, plateau, source et licence) : le test la lit aussi.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { encoderPng } from '../src/go/photo/pngNode';
import { hasard, synthetiser, type OptionsSynthese } from '../src/go/photo/synthese';
import { precision, reconnaitre } from '../src/go/photo/reconnaissance';
import type { Coins } from '../src/go/photo/homographie';

const DOSSIER = fileURLToPath(new URL('../src/go/__fixtures__/photos/', import.meta.url));

/** Lot figé : une image par difficulté. */
export const LOT: (OptionsSynthese & { nom: string; description: string })[] = [
  { nom: 'synth-19-dessus', description: '19 × 19 vu presque de dessus, lumière égale', graine: 19001, taille: 19, inclinaison: 0.1, eclairage: 0.1, debord: 0.03 },
  { nom: 'synth-19-biais-lampe', description: '19 × 19 de biais, lampe orangée d’un côté, pierres qui débordent', graine: 19002, taille: 19, inclinaison: 0.9, eclairage: 0.9, debord: 0.18, teinte: 0.8, flou: 1 },
  { nom: 'synth-19-jour-flou', description: '19 × 19, lumière du jour bleutée, photo un peu floue et bruitée', graine: 19003, taille: 19, inclinaison: 0.6, eclairage: 0.6, debord: 0.1, teinte: -0.8, flou: 2, bruit: 12 },
  { nom: 'synth-13-ombre', description: '13 × 13, une moitié dans l’ombre', graine: 13001, taille: 13, inclinaison: 0.5, eclairage: 1, debord: 0.12 },
  { nom: 'synth-9-dense', description: '9 × 9 très rempli', graine: 9001, taille: 9, inclinaison: 0.7, eclairage: 0.5, debord: 0.15, densite: 0.75 },
  { nom: 'synth-9-reflet', description: '9 × 9 avec un reflet de lampe sur le bois (cas limite)', graine: 9002, taille: 9, inclinaison: 0.4, eclairage: 0.4, debord: 0.08, reflet: true },
];

/** Plateau en lignes de texte (X noir, O blanc, . vide), lisible dans verite.json. */
export function lignes(b: ArrayLike<number>, n: number): string[] {
  return Array.from({ length: n }, (_, y) => Array.from({ length: n }, (_, x) => '.XO'[b[y * n + x]]).join(''));
}

/** Coins tels qu'un joueur les poserait : à ±`ecart` case près de la vérité. */
export function coinsDuJoueur(coins: Coins, taille: number, graine: number, ecart: number): Coins {
  const r = hasard(graine), cote = Math.hypot(coins[1].x - coins[0].x, coins[1].y - coins[0].y) / (taille - 1);
  return coins.map(c => ({ x: c.x + (r() * 2 - 1) * ecart * cote, y: c.y + (r() * 2 - 1) * ecart * cote })) as unknown as Coins;
}

function ecrire() {
  const verite: Record<string, unknown> = {};
  try { Object.assign(verite, JSON.parse(readFileSync(`${DOSSIER}verite.json`, 'utf8'))); } catch { /* premier passage */ }
  for (const o of LOT) {
    const { nom, description, ...opts } = o;
    const s = synthetiser({ largeur: 800, hauteur: 600, ...opts });
    writeFileSync(`${DOSSIER}${nom}.png`, encoderPng(s.image));
    verite[`${nom}.png`] = {
      description, source: 'synthétique : outils/photosSynthetiques.ts', licence: 'MIT (comme le projet)',
      taille: o.taille, coins: s.coins.map(c => [Math.round(c.x * 10) / 10, Math.round(c.y * 10) / 10]), plateau: lignes(s.plateau, o.taille),
    };
    console.log('écrit', nom);
  }
  writeFileSync(`${DOSSIER}verite.json`, `${JSON.stringify(verite, null, 2)}\n`);
}

function mesurer() {
  const lots: { nom: string; options: (r: () => number) => Partial<OptionsSynthese>; ecart: number }[] = [
    { nom: 'courant (coins à ±0,15 case)', ecart: 0.15, options: r => ({ inclinaison: r(), eclairage: r(), debord: 0.25 * r(), teinte: 2 * r() - 1, flou: Math.floor(3 * r()), bruit: 4 + 10 * r() }) },
    { nom: 'coins imprécis (±0,3 case)', ecart: 0.3, options: r => ({ inclinaison: r(), eclairage: r(), debord: 0.25 * r(), teinte: 2 * r() - 1, flou: Math.floor(3 * r()), bruit: 4 + 10 * r() }) },
    { nom: 'reflet de lampe sur le bois', ecart: 0.15, options: r => ({ inclinaison: r(), eclairage: r(), debord: 0.2 * r(), reflet: true }) },
  ];
  for (const lot of lots) {
    let total = 0, justes = 0, incertaines = 0, fautesNonSignalees = 0, images = 0, t = 0;
    for (const taille of [9, 13, 19] as const) for (let g = 1; g <= 20; g++) {
      const r = hasard(taille * 1000 + g);
      const s = synthetiser({ graine: taille * 977 + g, taille, largeur: 800, hauteur: 600, ...lot.options(r) });
      const t0 = performance.now();
      const rec = reconnaitre(s.image, coinsDuJoueur(s.coins, taille, g, lot.ecart), taille);
      t += performance.now() - t0;
      images++; total += s.plateau.length; justes += Math.round(precision(rec.plateau, s.plateau) * s.plateau.length);
      incertaines += rec.incertaines.length;
      for (let p = 0; p < s.plateau.length; p++) if (rec.plateau[p] !== s.plateau[p] && !rec.incertaines.includes(p)) fautesNonSignalees++;
    }
    console.log(`${lot.nom} : ${images} images, ${total} intersections, précision ${(100 * justes / total).toFixed(2)} %, ` +
      `${total - justes} fautes dont ${fautesNonSignalees} non signalées, ${incertaines} incertaines, ${Math.round(t / images)} ms par image (Node)`);
  }
}

if (process.argv.includes('mesure')) mesurer(); else ecrire();
