// Modes de jeu de l'accueil (issues #429 et #432). Logique pure, sans React.
//
// Tous les modes se joignent en 1 toucher depuis l'accueil, ou en 2 par « Plus », sans défiler :
// - une seule action principale : la partie en ligne classée dès le début (#432 : celle qui crée l'émulation,
//   cote, grade, « +14 »). Sans compte, elle passe par « Crée ton compte », puis reprend. L'ordi ne reprend la place
//   que hors ligne, sans comptes (Supabase absent), ou au tout premier lancement, qui a son propre écran
//   (« Joue ta première partie » contre Pomme, la promesse de Mochi) ;
// - sous le bouton, une rangée de tuiles pour les autres modes, toujours dans le même ordre (« Contre l'ordi »
//   y est pour tous, avec l'adversaire en cours) ;
// - au-delà de trois tuiles, les derniers modes passent sous « Plus ».

export type Mode = 'en_ligne' | 'ordi' | 'ami' | 'deux' | 'guidee';
/** D'où vient le choix (propriété `depuis` de `mode_choisi`). */
export type Depuis = 'bouton' | 'plateau' | 'tuile' | 'plus' | 'feuille';

/** Ordre fixe des modes : la place d'une tuile ne change pas d'un jour à l'autre. */
export const ORDRE_MODES: readonly Mode[] = ['en_ligne', 'ordi', 'ami', 'deux', 'guidee'];
/** Tuiles au plus sous le bouton, « Plus » compris : trois tiennent côte à côte en 320 px. */
export const TUILES_MAX = 3;

export interface ContexteModes {
  /** Comptes configurés (Supabase) : sans eux, ni partie en ligne ni défi entre amis. */
  comptes: boolean;
  /** Réseau disponible : hors ligne, la partie en ligne ne passe pas en action principale. */
  enLigne: boolean;
  /** Tout premier lancement (aucune partie, aucune leçon) : l'écran « Joue ta première partie » garde l'ordi. */
  premierLancement: boolean;
}

export interface ModesAccueil {
  principal: Mode;
  /** Tuiles sous le bouton, dans l'ordre ; « Plus » est ajoutée quand `plus` n'est pas vide. */
  tuiles: Mode[];
  /** Modes rangés sous « Plus ». */
  plus: Mode[];
}

/** Modes de l'accueil : l'action principale, les tuiles et ce qui passe sous « Plus ». */
export function modesAccueil(c: ContexteModes): ModesAccueil {
  const dispo = ORDRE_MODES.filter(m => c.comptes || (m !== 'en_ligne' && m !== 'ami'));
  const principal: Mode = c.comptes && c.enLigne && !c.premierLancement ? 'en_ligne' : 'ordi';
  const autres = dispo.filter(m => m !== principal);
  if (autres.length <= TUILES_MAX) return { principal, tuiles: autres, plus: [] };
  return { principal, tuiles: autres.slice(0, TUILES_MAX - 1), plus: autres.slice(TUILES_MAX - 1) };
}
