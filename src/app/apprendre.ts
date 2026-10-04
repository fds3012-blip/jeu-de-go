// Onglet Apprendre (issue #40, phase 6) : logique pure du chemin des leçons, sans React.
import type { Lesson } from '../content/lessons';
import { t } from '../content/i18n/secondaires';

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

/**
 * Bouton principal du chemin : la leçon qu'il ouvre, son nom complet pour les lecteurs d'écran (`texte`)
 * et le seul verbe affiché (`verbe`), puisque le titre de la leçon est écrit juste au-dessus.
 */
export function boutonChemin(lecons: Lesson[], progression: Progression): { texte: string; verbe: string; id: string } | null {
  if (!lecons.length) return null;
  const suivante = lecons.find(l => (progression[l.id] ?? 0) < l.steps.length);
  if (!suivante) return { texte: t('apprendre.revoirTitre', { titre: titreCourt(lecons[0].title) }), verbe: t('apprendre.revoir'), id: lecons[0].id };
  const commence = lecons.some(l => (progression[l.id] ?? 0) > 0);
  if (!commence) return { texte: t('apprendre.commencer'), verbe: t('apprendre.commencer'), id: suivante.id };
  // #237 : « Continuer » est réservé à l'étape suivante dans une leçon. Sur le chemin, le verbe dit l'action :
  // « Reprendre » une leçon entamée, « Commencer » la suivante.
  const titre = titreCourt(suivante.title);
  return (progression[suivante.id] ?? 0) > 0
    ? { texte: t('apprendre.reprendreTitre', { titre }), verbe: t('apprendre.reprendre'), id: suivante.id }
    : { texte: t('apprendre.commencerTitre', { titre }), verbe: t('apprendre.commencer'), id: suivante.id };
}

/** Titre et phrase de l'écran de fin : plus modestes qu'une victoire, sauf pour la dernière leçon du chapitre. */
export function finDeLecon(lecons: Lesson[], id: string): { titre: string; derniere: boolean } {
  const derniere = lecons.length > 0 && lecons[lecons.length - 1].id === id;
  return { titre: t(derniere ? 'apprendre.fin.chapitre' : 'apprendre.fin.lecon'), derniere };
}

/** Fin de chapitre (#200) : la dernière leçon est terminée, ou toutes les leçons le sont. */
export function finDeChapitre(lecons: Lesson[], progression: Progression, id: string): boolean {
  if (!lecons.length) return false;
  return lecons[lecons.length - 1].id === id || lecons.every(l => (progression[l.id] ?? 0) >= l.steps.length);
}

export type ActionFin = 'jouer' | 'pratique' | 'suivante' | 'chemin';

/**
 * Actions de l'écran de fin de leçon (#200), la principale d'abord (en relief), puis les liens discrets.
 * Fin de chapitre : « Joue contre Pomme ». Sinon, la série de 3 problèmes du thème s'il y en a une, puis la leçon suivante.
 */
export function actionsFin({ chapitre, pratique, suivante, jouer }: { chapitre: boolean; pratique: boolean; suivante: boolean; jouer: boolean }): { principale: ActionFin; liens: ActionFin[] } {
  const ordre: ActionFin[] = chapitre
    ? [...(jouer ? ['jouer' as const] : []), ...(pratique ? ['pratique' as const] : []), 'chemin']
    : [...(pratique ? ['pratique' as const] : []), ...(suivante ? ['suivante' as const] : []), 'chemin'];
  const [principale, ...liens] = ordre;
  return { principale, liens };
}

/** Point d'ancrage d'une pierre du chemin : x compté depuis le milieu de l'écran, y depuis le haut du chapitre. */
export interface Ancre { x: number; y: number }

/**
 * Colonne de chaque pierre du chemin, en « pas » depuis le milieu (négatif à gauche) : le chemin serpente,
 * jamais deux pierres de suite du même côté, et laisse en face la place d'un titre.
 */
export const COLONNES = [-1, 1, -0.6, 1, -1, 0.6];
export const colonne = (i: number): number => COLONNES[i % COLONNES.length];

/**
 * Tracé SVG d'une courbe lisse qui passe par chaque ancre, de haut en bas : entre deux pierres, un arc en S
 * (tangentes verticales), comme un sentier qui serpente. Vide avec moins de deux points.
 */
export function courbe(points: readonly Ancre[]): string {
  if (points.length < 2) return '';
  const r = (n: number) => Math.round(n * 10) / 10;
  let d = `M${r(points[0].x)} ${r(points[0].y)}`;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], my = (a.y + b.y) / 2;
    d += a.x === b.x ? `L${r(b.x)} ${r(b.y)}` : `C${r(a.x)} ${r(my)} ${r(b.x)} ${r(my)} ${r(b.x)} ${r(b.y)}`;
  }
  return d;
}

/** Durée annoncée d'une leçon, en minutes : une vingtaine de secondes par étape, jamais moins d'une minute. */
export function dureeMinutes(etapes: number): number {
  return Math.max(1, Math.round(etapes * 0.3));
}

/** Chapitres déjà fêtés sur le chemin (clé locale) : la fête de fin de chapitre ne se joue qu'une fois. */
export const FETES_KEY = 'go.fetes-chapitres.v1';

/** Chapitres entièrement faits qui n'ont pas encore eu leur fête, dans l'ordre du chemin. */
export function chapitresAFeter(chapitres: { id: string; complet: boolean; lecons: Lesson[] }[], progression: Progression, fetes: readonly string[]): string[] {
  return chapitres
    .filter(c => c.complet && c.lecons.length > 0 && c.lecons.every(l => (progression[l.id] ?? 0) >= l.steps.length) && !fetes.includes(c.id))
    .map(c => c.id);
}

/** Chapitres du programme (issue #16) annoncés, pas encore commencés (« Fin de partie et comptage » a ses deux premières leçons). */
export const CHAPITRES_A_VENIR = [
  'Formes et tesuji, les coups astucieux',
  'Ouverture en 19\u00A0×\u00A019',
];

/** Chapitres à venir dans la langue de l'interface (#167) ; en français, les textes ci-dessus (vérifié par un test). */
export const chapitresAVenir = (): string[] => ([3, 4] as const).map(i => t(`apprendre.avenir.${i}`));
