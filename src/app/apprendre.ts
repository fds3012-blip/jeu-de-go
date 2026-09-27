// Onglet Apprendre (issue #40, phase 6) : logique pure du chemin des leçons, sans React.
import type { Lesson } from '../content/lessons';

export type Progression = Record<string, number>;
export type EtatPierre = 'faite' | 'encours' | 'avenir';

export interface Etape {
  lecon: Lesson;
  /** Rang affiché, à partir de 1. */
  rang: number;
  etat: EtatPierre;
  /** Étapes déjà faites dans la leçon. */
  faites: number;
}

/** État de chaque pierre du chemin : faites, puis la première leçon pas finie (en cours), puis celles à venir. */
export function etapes(lecons: Lesson[], progression: Progression): Etape[] {
  const suivante = lecons.findIndex(l => (progression[l.id] ?? 0) < l.steps.length);
  return lecons.map((lecon, i) => {
    const faites = Math.min(progression[lecon.id] ?? 0, lecon.steps.length);
    const etat: EtatPierre = faites >= lecon.steps.length ? 'faite' : i === suivante ? 'encours' : 'avenir';
    return { lecon, rang: i + 1, etat, faites };
  });
}

/** Titre court d'une leçon, pour un bouton : la partie avant « : » (« Atari : attaquer et se sauver » donne « Atari »). */
export function titreCourt(titre: string): string {
  return titre.split(/\s*:\s*/)[0];
}

/** Libellé du bouton principal du chemin, et la leçon qu'il ouvre. */
export function boutonChemin(lecons: Lesson[], progression: Progression): { texte: string; id: string } | null {
  if (!lecons.length) return null;
  const suivante = lecons.find(l => (progression[l.id] ?? 0) < l.steps.length);
  if (!suivante) return { texte: `Revoir : ${titreCourt(lecons[0].title)}`, id: lecons[0].id };
  const commence = lecons.some(l => (progression[l.id] ?? 0) > 0);
  return { texte: commence ? `Continuer : ${titreCourt(suivante.title)}` : 'Commencer', id: suivante.id };
}

/** Réplique courte de Mochi posée à côté de la pierre en cours. */
export function repliqueMochi(e: Etape | undefined): string {
  if (!e) return 'Tout le chemin est fait. Bravo !';
  if (e.faites > 0) return 'On reprend ici ?';
  return e.rang === 1 ? 'On commence ici !' : 'À toi, deux minutes !';
}

/** Géométrie du chemin de pierres de gué, en pixels verticaux et en pourcentage de largeur. */
export interface Trace {
  /** Centre de chaque pierre : x en % de la largeur, y en px depuis le haut du chemin. */
  pierres: { x: number; y: number }[];
  hauteur: number;
  /** Tracé SVG dans un repère « x en %, y en px » (viewBox 0 0 100 hauteur, étiré sans conserver le rapport). */
  d: string;
}

/** Positions horizontales des pierres, en % : le chemin serpente de gauche à droite, jamais deux fois au même endroit. */
const XS = [24, 74, 30, 78, 22, 70];

/**
 * Chemin qui serpente verticalement. Chaque courbe part verticalement d'une pierre et arrive verticalement sur la suivante :
 * à la hauteur d'une pierre, le tracé reste sous elle, et le titre posé de l'autre côté ne le croise pas.
 * `avant` : place réservée au-dessus de la pierre d'indice `bulle` (la bulle de Mochi).
 */
export function trace(n: number, { pas = 112, marge = 44, bulle = -1, avant = 56 } = {}): Trace {
  const pierres: { x: number; y: number }[] = [];
  let y = marge;
  for (let i = 0; i < n; i++) {
    if (i === bulle) y += avant;
    pierres.push({ x: XS[i % XS.length], y });
    y += pas;
  }
  const hauteur = n ? pierres[n - 1].y + marge : 0;
  let d = n ? `M${pierres[0].x} ${pierres[0].y}` : '';
  for (let i = 1; i < n; i++) {
    const a = pierres[i - 1], b = pierres[i], m = (a.y + b.y) / 2;
    d += `C${a.x} ${m} ${b.x} ${m} ${b.x} ${b.y}`;
  }
  return { pierres, hauteur, d };
}

/** Tracé partiel : du début du chemin jusqu'à la pierre d'indice `jusqua` (incluse). Vide si `jusqua` < 1. */
export function traceJusqua(t: Trace, jusqua: number): string {
  const k = Math.min(jusqua, t.pierres.length - 1);
  if (k < 1) return '';
  const p = t.pierres;
  let d = `M${p[0].x} ${p[0].y}`;
  for (let i = 1; i <= k; i++) {
    const a = p[i - 1], b = p[i], m = (a.y + b.y) / 2;
    d += `C${a.x} ${m} ${b.x} ${m} ${b.x} ${b.y}`;
  }
  return d;
}

/** Chapitres du programme (issue #16) après « Les bases » : annoncés, pas encore écrits. */
export const CHAPITRES_A_VENIR = [
  'Capturer et sauver',
  'Vie et mort',
  'Formes et tesuji, les coups astucieux',
  'Ouverture en 9\u00A0×\u00A09 puis en 19\u00A0×\u00A019',
  'Fin de partie et comptage',
];
