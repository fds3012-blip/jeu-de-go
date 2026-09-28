// Aide graduée après un échec (issue #197) : logique pure, sans React.
//
// Après un coup faux, le joueur peut demander de l'aide, une marche à la fois :
//   1. un indice : la zone du bon coup est entourée (le point n'est pas désigné) ;
//   2. la réfutation : l'adversaire répond au coup faux sur le plateau, au point clé ;
//   3. la réponse : la suite est jouée.
// Un problème résolu après avoir vu la réponse est « Vu », pas « Réussi » : pas d'XP, pas de passage de palier.
// Pour le Go du jour, la série tient quand même (l'effort du jour compte, on ne punit pas).
import { play, type Position } from '../go/rules';
import { startOf, type Puzzle } from '../data/puzzles';

/** 0 : aucune aide ; 1 : indice vu ; 2 : réfutation vue ; 3 : réponse vue. */
export type NiveauAide = 0 | 1 | 2 | 3;

/** Marche suivante, ou null quand la réponse est déjà montrée. */
export function aideSuivante(n: NiveauAide): 1 | 2 | 3 | null {
  return n >= 3 ? null : ((n + 1) as 1 | 2 | 3);
}

/** La réponse a été vue : le problème ne peut plus être « Réussi ». */
export const reponseVue = (n: NiveauAide) => n >= 3;

export interface Refutation {
  /** Position après le coup faux, puis la réponse de l'adversaire (si elle est jouable). */
  pos: Position;
  /** Coup faux du joueur. */
  faux: number;
  /** Coup de l'adversaire, ou null s'il ne peut pas jouer au point clé (on montre alors seulement le coup faux). */
  reponse: number | null;
}

/**
 * Réfutation d'un coup faux : l'adversaire joue au point clé (la première réponse du problème),
 * selon le proverbe « le point clé de ton adversaire est ton point clé ». Il s'échappe, capture ou vit là où tu aurais dû jouer.
 * Null si le coup faux est illégal (rien à réfuter).
 */
export function refutation(pz: Puzzle, faux: number): Refutation | null {
  const apres = play(startOf(pz).pos, faux);
  if (typeof apres === 'string') return null;
  const cle = pz.answers.find(a => a !== faux && apres.board[a] === 0);
  if (cle === undefined) return { pos: apres, faux, reponse: null };
  const r = play(apres, cle);
  return typeof r === 'string' ? { pos: apres, faux, reponse: null } : { pos: r, faux, reponse: cle };
}

/** Ce que rapporte une réussite, selon l'aide reçue. */
export interface Recompense {
  /** « Réussi » (pastille, palier) ou « Vu ». */
  statut: 'reussi' | 'vu';
  /** XP et événement `probleme_resolu`. */
  xp: boolean;
  /** Compte pour les paliers et « Continuer ». */
  palier: boolean;
  /** Le Go du jour entretient la série, même vu. */
  serie: boolean;
}

export function recompense(n: NiveauAide, duJour: boolean): Recompense {
  const vu = reponseVue(n);
  return { statut: vu ? 'vu' : 'reussi', xp: !vu, palier: !vu, serie: duJour };
}

/**
 * Toucher le plateau pendant la réfutation ou la réponse montrée (#237, N6) : comme en leçon, pas de « Réessayer ».
 * Le plateau revient à la position de départ ; le point touché est joué s'il est vide au départ et à l'écran,
 * sinon (ta pierre fausse, la pierre de l'adversaire) il remet seulement la position.
 */
export function toucherApresErreur(videAuDepart: boolean, videAffiche: boolean): 'jouer' | 'remettre' {
  return videAuDepart && videAffiche ? 'jouer' : 'remettre';
}
