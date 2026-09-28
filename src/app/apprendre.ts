// Onglet Apprendre (issue #40, phase 6) : logique pure du chemin des leçons, sans React.
import type { Lesson } from '../content/lessons';
import { t } from '../content/i18n';

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
  return commence
    ? { texte: t('apprendre.continuerTitre', { titre: titreCourt(suivante.title) }), verbe: t('apprendre.continuer'), id: suivante.id }
    : { texte: t('apprendre.commencer'), verbe: t('apprendre.commencer'), id: suivante.id };
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

/** Écart entre deux lignes du goban dessiné sous le chemin, en px : une pierre tient pile sur une intersection. */
export const LIGNE = 56;

/** Géométrie du chemin de pierres posé sur les lignes d'un goban. Repère en px ; x compté depuis le milieu de l'écran. */
export interface Trace {
  /** Chaque pierre est sur une intersection : `col` en lignes depuis le milieu (négatif à gauche), x = col × LIGNE, y depuis le haut. */
  pierres: { col: number; x: number; y: number }[];
  hauteur: number;
  /** Ligne (y) où le chemin tourne sous chaque pierre pour rejoindre la suivante : sous la rangée, jamais à travers son texte. */
  virages: number[];
  /** Tracé SVG (x relatif au milieu) qui suit les lignes du goban : descendre, tourner à angle droit, descendre. */
  d: string;
}

/** Colonne de chaque pierre : le chemin passe d'un côté à l'autre, jamais deux fois au même endroit, et laisse la place d'un titre en face. */
const COLS = [-2, 2, -1, 2, -2, 1];

/** Morceau de tracé d'une pierre à la suivante, sur les lignes : descendre jusqu'à la ligne `tourne`, traverser, descendre. */
function morceau(a: { x: number; y: number }, b: { x: number; y: number }, tourne: number): string {
  return a.x === b.x ? `V${b.y}` : `V${tourne}H${b.x}V${b.y}`;
}

/**
 * Place minimale, en px, entre le bas d'une rangée (titre, description, bouton) et la ligne du virage au-dessous.
 * 4 px (#232) : c'est l'écart réel des rangées de trois lignes à 390 px, où le chemin ne bouge pas.
 */
export const MARGE_RANGEE = 4;

/**
 * Place occupée par une rangée sous sa ligne du goban, en px (#232), à partir de sa boîte à l'écran (`haut`, `bas`)
 * et du diamètre de la pierre. La rangée est posée une demi-pierre au-dessus de sa ligne (CSS de `.pas`) :
 * la ligne est donc à `haut + pierre / 2`, même quand la pierre est dessinée plus bas, centrée sur un texte
 * plus haut qu'elle (police doublée : jusqu'à 110 px sous sa ligne). Mesurer depuis le centre de la pierre
 * oubliait ce décalage, et les rangées se chevauchaient.
 */
export function placeSousLigne(rangee: { haut: number; bas: number }, pierre: number): number {
  return Math.ceil(rangee.bas - (rangee.haut + pierre / 2));
}

/** Plus petit multiple de LIGNE supérieur ou égal à `y` : la première ligne du goban à partir de `y`. */
const ligneSous = (y: number) => Math.ceil(y / LIGNE) * LIGNE;

/**
 * Chemin de pierres sur les lignes du goban : une pierre toutes les deux lignes, en alternant les côtés.
 * `encours` : indice de la leçon en cours ; elle a `apres` lignes de plus au-dessous, pour son bouton en relief.
 * `bas` (#169) : pour chaque rangée, la place qu'elle occupe sous sa ligne, en px (mesurée à l'écran, voir `placeSousLigne`).
 * Une rangée plus haute que l'écart prévu (titre sur plusieurs lignes au zoom 200 %) repousse la suivante
 * d'autant de lignes qu'il faut, et le virage passe sous elle. Sans mesure, ou si tout tient, rien ne change.
 */
export function trace(n: number, { encours = -1, apres = 2, bas = [] as readonly number[] } = {}): Trace {
  const pierres: Trace['pierres'] = [];
  const virages: number[] = [];
  let y = LIGNE;
  for (let i = 0; i < n; i++) {
    const col = COLS[i % COLS.length];
    pierres.push({ col, x: col * LIGNE, y });
    // Virage par défaut : la première ligne sous la pierre, ou juste au-dessus de la suivante sous la leçon en cours.
    const ecart = 2 * LIGNE + (i === encours ? apres * LIGNE : 0);
    const defaut = i === encours ? y + ecart - LIGNE : y + LIGNE;
    const v = Math.max(defaut, ligneSous(y + (bas[i] ?? 0) + MARGE_RANGEE));
    virages.push(v);
    y = Math.max(y + ecart, v + LIGNE);
  }
  // Le goban s'arrête une ligne sous la dernière pierre ; il s'allonge si la dernière rangée dépasse la place
  // qu'elle aurait au milieu du chemin. Dernière leçon en cours (#177, sept leçons) : sa place est toujours réservée,
  // plus une ligne de marge, sinon son bouton en relief mord sur « Bientôt ».
  const der = n - 1, place = (der === encours ? apres + 1 : 1) * LIGNE, rangee = (bas[der] ?? 0) + MARGE_RANGEE;
  const hauteur = n ? pierres[der].y + (der === encours ? Math.max(place, ligneSous(rangee)) + LIGNE : rangee > place ? ligneSous(rangee) : LIGNE) : 0;
  return { pierres, hauteur, virages, d: traceJusqua({ pierres, hauteur, virages, d: '' }, n - 1, true) };
}

/** Tracé partiel : du début du chemin jusqu'à la pierre d'indice `jusqua` (incluse). Vide si `jusqua` < 1, sauf `seul` (une pierre seule). */
export function traceJusqua(t: Trace, jusqua: number, seul = false): string {
  const p = t.pierres, k = Math.min(jusqua, p.length - 1);
  if (k < 0 || (k < 1 && !seul)) return '';
  let d = `M${p[0].x} ${p[0].y}`;
  for (let i = 1; i <= k; i++) d += morceau(p[i - 1], p[i], t.virages[i - 1]);
  return d;
}

/** Chapitres du programme (issue #16) après « Les bases » : annoncés, pas encore écrits. */
export const CHAPITRES_A_VENIR = [
  'Capturer et sauver',
  'Vie et mort',
  'Formes et tesuji, les coups astucieux',
  'Ouverture en 19\u00A0×\u00A019',
  'Fin de partie et comptage',
];

/** Chapitres à venir dans la langue de l'interface (#167) ; en français, les textes ci-dessus (vérifié par un test). */
export const chapitresAVenir = (): string[] => ([1, 2, 3, 4, 5] as const).map(i => t(`apprendre.avenir.${i}`));
