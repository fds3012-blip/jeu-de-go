// Modes de jeu de l'accueil (issue #429). Logique pure, sans React.
//
// Tous les modes se joignent en 1 toucher depuis l'accueil, ou en 2 par « Plus », sans défiler :
// - une seule action principale, selon le joueur : le débutant garde l'ordi ; ensuite, la partie en ligne classée
//   (celle qui crée l'émulation : cote, grade, « +14 ») ;
// - sous le bouton, une rangée de tuiles pour les autres modes, toujours dans le même ordre ;
// - au-delà de trois tuiles, les derniers modes passent sous « Plus ».

export type Mode = 'en_ligne' | 'ordi' | 'ami' | 'deux' | 'guidee';
/** D'où vient le choix (propriété `depuis` de `mode_choisi`). */
export type Depuis = 'bouton' | 'plateau' | 'tuile' | 'plus' | 'feuille';

/** Ordre fixe des modes : la place d'une tuile ne change pas d'un jour à l'autre. */
export const ORDRE_MODES: readonly Mode[] = ['en_ligne', 'ordi', 'ami', 'deux', 'guidee'];
/** Leçons à finir avant que la partie en ligne passe en action principale (les leçons ouvertes sans compte). */
export const LECONS_DEBUT = 3;
/** Tuiles au plus sous le bouton, « Plus » compris : trois tiennent côte à côte en 320 px. */
export const TUILES_MAX = 3;

export interface ContexteModes {
  /** Comptes configurés (Supabase) : sans eux, ni partie en ligne ni défi entre amis. */
  comptes: boolean;
  /** Réseau disponible : hors ligne, la partie en ligne ne passe pas en action principale. */
  enLigne: boolean;
  /** Pomme, le premier adversaire, battue au moins une fois. */
  pommeBattue: boolean;
  /** Les premières leçons (LECONS_DEBUT) sont finies, ou le placement a donné un niveau (« Je sais déjà jouer »). */
  basesFaites: boolean;
}

export interface ModesAccueil {
  principal: Mode;
  /** Tuiles sous le bouton, dans l'ordre ; « Plus » est ajoutée quand `plus` n'est pas vide. */
  tuiles: Mode[];
  /** Modes rangés sous « Plus ». */
  plus: Mode[];
}

/** Débutant : Pomme pas encore battue, ou premières leçons pas faites. Il garde l'ordi en action principale. */
export const estDebutant = (c: ContexteModes) => !c.pommeBattue || !c.basesFaites;

/** Modes de l'accueil : l'action principale, les tuiles et ce qui passe sous « Plus ». */
export function modesAccueil(c: ContexteModes): ModesAccueil {
  const dispo = ORDRE_MODES.filter(m => c.comptes || (m !== 'en_ligne' && m !== 'ami'));
  const principal: Mode = c.comptes && c.enLigne && !estDebutant(c) ? 'en_ligne' : 'ordi';
  const autres = dispo.filter(m => m !== principal);
  if (autres.length <= TUILES_MAX) return { principal, tuiles: autres, plus: [] };
  return { principal, tuiles: autres.slice(0, TUILES_MAX - 1), plus: autres.slice(TUILES_MAX - 1) };
}
