// Course aux problèmes (issue #287) : 3 minutes, et la course s'arrête à la 3e erreur. Logique pure, sans React.
//
// - Les problèmes vont du plus facile au plus dur, en partant un peu sous la cote du joueur (#284).
// - Un seul essai par problème, sans indice : juste, le score monte ; faux, une erreur de plus.
// - Aucun total de problèmes affiché (décision #137, règle de Florian) : le meilleur score est un record
//   personnel de ce mode, gardé sur l'appareil sous MEILLEUR_COURSE_KEY (cité dans la politique de confidentialité).
// - La course ne touche ni la cote du joueur, ni les problèmes réussis, ni la série.
import { t } from '../content/i18n';
import { ECART_CIBLE } from './coteJoueur';
import { URL_JEU } from './goDuJour';
import { readLocal } from './hooks';

/** Durée d'une course, en millisecondes. */
export const DUREE_COURSE = 180_000;
/** Nombre d'erreurs qui arrête la course. */
export const ERREURS_MAX = 3;
/** Le lecteur d'écran annonce le temps restant à chaque multiple de ce pas (30 s), jamais chaque seconde. */
export const PAS_ANNONCE = 30_000;
/**
 * Départ : un peu sous la cote du joueur. La cible de « Problème suivant » est déjà à 85 % de réussite
 * (cote − ECART_CIBLE) ; la course part encore DEPART_SOUS plus bas, pour que les premiers tombent vite.
 */
export const DEPART_SOUS = 100;
/** Assez de problèmes devant soi : si la cote est très haute, le départ recule pour en garder au moins autant. */
export const PROBLEMES_MIN = 40;

/** Clé de stockage local : meilleur score de la course sur cet appareil. */
export const MEILLEUR_COURSE_KEY = 'go.course-meilleur.v1';

export type RaisonFin = 'temps' | 'erreurs' | 'epuise';

export interface EtatCourse {
  /** Instant de départ (ms, horloge du navigateur). */
  debut: number;
  /** Ids des problèmes, dans l'ordre de la course, sans doublon. */
  ordre: string[];
  /** Rang du problème en cours dans `ordre`. */
  rang: number;
  score: number;
  erreurs: number;
  fin?: { raison: RaisonFin; a: number };
}

/** Difficulté de départ pour une cote donnée. */
export function departPour(cote: number): number {
  return cote - ECART_CIBLE - DEPART_SOUS;
}

/**
 * Ordre des problèmes d'une course : difficultés non décroissantes, sans doublon, à partir de `departPour(cote)`.
 * À difficulté égale, l'ordre est tiré au hasard : deux courses ne se ressemblent pas. `exclure` : le Go du jour
 * (il reste le même pour tous, la course ne le dévoile pas).
 */
export function tirerCourse<T extends { id: string; difficulty: number }>(
  liste: readonly T[], cote: number, { exclure = [], alea = Math.random }: { exclure?: readonly string[]; alea?: () => number } = {}
): string[] {
  const vus = new Set<string>(exclure);
  const uniques: { p: T; x: number }[] = [];
  for (const p of liste) {
    if (vus.has(p.id)) continue;
    vus.add(p.id);
    uniques.push({ p, x: alea() });
  }
  const tries = uniques.sort((a, b) => a.p.difficulty - b.p.difficulty || a.x - b.x).map(u => u.p);
  const depart = departPour(cote);
  let i = tries.findIndex(p => p.difficulty >= depart);
  if (i < 0) i = tries.length;
  i = Math.max(0, Math.min(i, tries.length - PROBLEMES_MIN));
  return tries.slice(i).map(p => p.id);
}

/** Nouvelle course, commencée à `maintenant`. */
export function commencer(ordre: string[], maintenant: number): EtatCourse {
  const etat: EtatCourse = { debut: maintenant, ordre, rang: 0, score: 0, erreurs: 0 };
  return ordre.length ? etat : { ...etat, fin: { raison: 'epuise', a: maintenant } };
}

/** Temps restant, en millisecondes (0 une fois la course finie par le temps). */
export function restant(etat: EtatCourse, maintenant: number): number {
  const a = etat.fin ? etat.fin.a : maintenant;
  return Math.max(0, DUREE_COURSE - (a - etat.debut));
}

/** Id du problème en cours (undefined si la course est finie). */
export function problemeEnCours(etat: EtatCourse): string | undefined {
  return etat.fin ? undefined : etat.ordre[etat.rang];
}

/** Arrête la course si les 3 minutes sont passées. Sans effet sinon. */
export function verifierTemps(etat: EtatCourse, maintenant: number): EtatCourse {
  if (etat.fin || maintenant - etat.debut < DUREE_COURSE) return etat;
  return { ...etat, fin: { raison: 'temps', a: etat.debut + DUREE_COURSE } };
}

/**
 * Réponse au problème en cours (un seul essai). Juste : le score monte ; faux : une erreur de plus, et la 3e arrête
 * la course. Une réponse arrivée après les 3 minutes ne compte pas. Plus de problème : la course s'arrête aussi.
 */
export function repondre(etat: EtatCourse, juste: boolean, maintenant: number): EtatCourse {
  const e = verifierTemps(etat, maintenant);
  if (e.fin) return e;
  const score = e.score + (juste ? 1 : 0);
  const erreurs = e.erreurs + (juste ? 0 : 1);
  const rang = e.rang + 1;
  const suite = { ...e, score, erreurs, rang };
  if (erreurs >= ERREURS_MAX) return { ...suite, fin: { raison: 'erreurs', a: maintenant } };
  if (rang >= e.ordre.length) return { ...suite, fin: { raison: 'epuise', a: maintenant } };
  return suite;
}

/** Durée réelle de la course, en secondes entières (pour la mesure). */
export function dureeSecondes(etat: EtatCourse, maintenant: number): number {
  return Math.round((DUREE_COURSE - restant(etat, maintenant)) / 1000);
}

/**
 * Annonce pour le lecteur d'écran : le multiple de 30 s franchi entre deux lectures du temps restant (en ms),
 * ou null. 3:00 n'est pas annoncé (la consigne le dit déjà), ni 0 (l'écran de fin prend le relais).
 */
export function palierAnnonce(avant: number, apres: number): number | null {
  const palier = Math.ceil(apres / PAS_ANNONCE) * PAS_ANNONCE;
  if (palier >= DUREE_COURSE || palier <= 0) return null;
  return avant > palier && apres <= palier ? palier : null;
}

/** Temps affiché, « 2:07 » (secondes arrondies vers le haut : 0:00 seulement à la fin). */
export function formatTemps(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Meilleur score relu du stockage : un nombre entier positif, sinon 0. */
export function nettoyerMeilleur(brut: unknown): number {
  return typeof brut === 'number' && Number.isFinite(brut) && brut > 0 ? Math.floor(brut) : 0;
}

/** Meilleur score gardé sur l'appareil (0 s'il n'y en a pas ou si le stockage est illisible). */
export function lireMeilleurCourse(): number {
  return nettoyerMeilleur(readLocal<unknown>(MEILLEUR_COURSE_KEY, 0));
}

/** Meilleur score après une course, et s'il vient d'être battu (jamais pour un score de 0). */
export function apresCourse(meilleur: number, score: number): { meilleur: number; nouveau: boolean } {
  return score > meilleur ? { meilleur: score, nouveau: true } : { meilleur, nouveau: false };
}

export interface PartageCourse { texte: string; url: string; complet: string }

/**
 * Texte à partager, sans spoiler : le score, la durée et le meilleur score, jamais une position ni une réponse.
 * Exemple : « Course de go : 14 problèmes en 3 min · meilleur 17 » puis le lien.
 */
export function texteCourse(score: number, meilleur: number): PartageCourse {
  const morceaux = [t('course.partage.score', { n: score })];
  if (meilleur > 0) morceaux.push(t('course.partage.meilleur', { meilleur }));
  const texte = morceaux.join(' · ');
  return { texte, url: URL_JEU, complet: `${texte}\n${URL_JEU}` };
}
