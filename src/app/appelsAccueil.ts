// Issue #236 (N4) : un seul appel à la fois sur l'accueil. L'action principale (le bouton, dont la bulle de
// l'adversaire parle) et, au plus, un appel secondaire : une annonce de Mochi (gel, série perdue), la carte
// d'installation ou la pastille « À faire » du Go du jour. Logique pure ; App.tsx lit et écrit la mémoire du jour.

/** Jour (numéro du Go du jour) où Mochi a fait une annonce sur l'accueil : ce jour-là, pas de carte d'installation. */
export const ANNONCE_DU_JOUR_KEY = 'go.annonce-du-jour.v1';

export type AppelSecondaire = 'annonce' | 'installation' | 'aFaire' | null;

export interface Contexte {
  /** Numéro du jour. */
  jour: number;
  /** Parties déjà lancées : au tout premier lancement (0), la seule chose à faire est la première partie. */
  parties: number;
  /** Go du jour réussi aujourd'hui. */
  duJourFait: boolean;
  /** Mochi annonce un gel ou une série perdue, en ce moment. */
  annonce: boolean;
  /** Jour de la dernière annonce, lu dans `ANNONCE_DU_JOUR_KEY` (null : jamais). */
  jourAnnonce: number | null;
  /** La carte d'installation peut se proposer (moment « retour », plateforme, jamais montrée). */
  installation: boolean;
}

/**
 * L'appel secondaire de l'accueil, un seul :
 * - une annonce de Mochi passe d'abord (elle ne revient pas) ;
 * - la carte d'installation, seulement un jour sans annonce ; elle prend la place de la pastille « À faire » ;
 * - sinon la pastille « À faire », mais jamais au tout premier lancement (elle vient après la première partie).
 */
export function appelSecondaire(c: Contexte): AppelSecondaire {
  if (c.annonce) return 'annonce';
  if (c.installation && c.jourAnnonce !== c.jour) return 'installation';
  if (!c.duJourFait && c.parties > 0) return 'aFaire';
  return null;
}

/** État affiché sur la tuile du Go du jour : « Fait » est un constat, il reste ; « À faire » est un appel. */
export function etatTuile(appel: AppelSecondaire, duJourFait: boolean): 'fait' | 'aFaire' | null {
  if (duJourFait) return 'fait';
  return appel === 'aFaire' ? 'aFaire' : null;
}

/** Lecture tolérante du jour d'annonce gardé. */
export function lireJourAnnonce(brut: unknown): number | null {
  return typeof brut === 'number' && Number.isInteger(brut) && brut >= 0 ? brut : null;
}
