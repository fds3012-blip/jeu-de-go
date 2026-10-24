// Modes de jeu de l'accueil (issues #429, #432 et #695). Logique pure, sans React.
//
// Tous les modes se joignent en 1 toucher depuis l'accueil, sans défiler. #613 : « joindre » veut
// dire arriver sur l'étape de lancement du mode (feuille de l'ordi ou d'à deux, écran en ligne, écran des défis) ; son
// bouton « Jouer » est le toucher suivant.
// - une seule action principale. #695 (décision de Florian, qui révise #432) : l'ordi, avec l'adversaire en cours,
//   tant qu'il y a moins de SEUIL_EN_LIGNE joueurs en ligne : « Jouer en ligne » en tête mène sinon à une file vide.
//   À partir du seuil, la partie en ligne classée (#432 : celle qui crée l'émulation, cote, grade, « +14 ») redevient
//   principale ; sans compte, elle passe par « Crée ton compte », puis reprend. Compteur inconnu (hors ligne, pas de
//   réponse, erreur) : on compte moins que le seuil. Hors ligne, sans comptes (Supabase absent) et au tout premier
//   lancement, qui a son propre écran (« Joue ta première partie » contre Pomme), l'ordi garde la place ;
// - sous le bouton, une rangée de tuiles pour les autres modes, toujours dans le même ordre (« Contre l'ordi »
//   y est pour tous, avec l'adversaire en cours) ;
// - #647 (décision F1) : la partie de découverte vit dans Apprendre (fin de « Les bases ») et à la fin de l'introduction
//   des règles ; elle a quitté l'accueil. Il reste trois tuiles au plus : la feuille « Plus » a disparu.

export type Mode = 'en_ligne' | 'ordi' | 'ami' | 'deux';
/** D'où vient le choix (propriété `depuis` de `mode_choisi`) ; 'apprendre' : la partie guidée, depuis l'onglet Apprendre (#589). */
export type Depuis = 'bouton' | 'plateau' | 'tuile' | 'feuille' | 'apprendre';

/** Ordre fixe des modes : la place d'une tuile ne change pas d'un jour à l'autre. */
// #589 : la partie guidée, et #647 la partie de découverte, ont quitté l'accueil pour Apprendre (loi de Hick,
// docs/ux/loi-de-hick-2026-10.md) ; `mode_choisi` les note toujours (`mode` guidee ou decouverte, `depuis` apprendre).
export const ORDRE_MODES: readonly Mode[] = ['en_ligne', 'ordi', 'ami', 'deux'];
/**
 * #695 : à partir de ce nombre de joueurs en ligne (en file ou en partie classée en direct), « Jouer en ligne » redevient
 * l'action principale. En dessous, l'ordi : une file vide ne tient pas la promesse du bouton. Seule définition du seuil.
 */
export const SEUIL_EN_LIGNE = 4;

/** #695 : assez de monde pour que « Jouer en ligne » tienne sa promesse ? Compteur inconnu (null, NaN) : non. */
export function assezDeMonde(joueursEnLigne: number | null | undefined): boolean {
  return typeof joueursEnLigne === 'number' && joueursEnLigne >= SEUIL_EN_LIGNE;
}

/** Tuiles au plus sous le bouton : trois tiennent côte à côte en 320 px. */
export const TUILES_MAX = 3;

export interface ContexteModes {
  /** Comptes configurés (Supabase) : sans eux, ni partie en ligne ni défi entre amis. */
  comptes: boolean;
  /** Réseau disponible : hors ligne, la partie en ligne ne passe pas en action principale. */
  enLigne: boolean;
  /** Tout premier lancement (aucune partie, aucune leçon) : l'écran « Joue ta première partie » garde l'ordi. */
  premierLancement: boolean;
  /** #695 : joueurs en ligne en ce moment (src/data/joueursEnLigne.ts) ; null tant qu'on ne sait pas : moins que le seuil. */
  joueursEnLigne: number | null;
}

export interface ModesAccueil {
  principal: Mode;
  /** Tuiles sous le bouton, dans l'ordre (trois au plus). */
  tuiles: Mode[];
}

/** Modes de l'accueil : l'action principale et les tuiles. */
export function modesAccueil(c: ContexteModes): ModesAccueil {
  const dispo = ORDRE_MODES.filter(m => c.comptes || (m !== 'en_ligne' && m !== 'ami'));
  const principal: Mode = c.comptes && c.enLigne && !c.premierLancement && assezDeMonde(c.joueursEnLigne) ? 'en_ligne' : 'ordi';
  return { principal, tuiles: dispo.filter(m => m !== principal) };
}

/** #613 : modes dont la partie se règle sur l'appareil, dans la feuille de lancement (src/app/LancementPartie.tsx). */
export type Lancement = 'ordi' | 'deux';

/**
 * #613 : la taille du plateau (et l'adversaire, contre l'ordi) se choisit au moment de jouer, plus sur l'accueil.
 * - L'ordi et à deux ouvrent la feuille de lancement, avec le dernier choix déjà coché.
 * - En ligne et un ami ont déjà leur écran de lancement (choix repliés, « Trouver un adversaire », « Créer un lien ») :
 *   pas de feuille en plus.
 * - Avant la toute première partie, aucune étape : le débutant n'a encore rien à choisir, il joue avec la valeur par
 *   défaut (Pomme, 9 × 9), comme avant.
 */
export function etapeDeLancement(mode: Mode, c: { premierePartie: boolean }): Lancement | null {
  if (mode !== 'ordi' && mode !== 'deux') return null;
  return c.premierePartie ? null : mode;
}
