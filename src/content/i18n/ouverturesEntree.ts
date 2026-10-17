// #591 : la ligne « Ouvertures » d'Apprendre, FR et EN. À part du catalogue de l'écran (src/content/i18n/ouvertures.ts),
// pour que le chemin des leçons n'emporte pas les textes de toutes les ouvertures.
import { langue, type Langue } from './index';

const FR = {
  'titre': 'Ouvertures',
  'texte': 'Les premiers coups d’une partie, vérifiés par KataGo.',
};

export type CleEntreeOuvertures = keyof typeof FR;

const EN: { readonly [K in CleEntreeOuvertures]: string } = {
  'titre': 'Openings',
  'texte': 'The first moves of a game, checked by KataGo.',
};

export const CATALOGUE_ENTREE_OUVERTURES: Record<Langue, { readonly [K in CleEntreeOuvertures]: string }> = { fr: FR, en: EN };

/** Texte dans la langue de l'interface. */
export const tentree = (cle: CleEntreeOuvertures): string => CATALOGUE_ENTREE_OUVERTURES[langue()][cle] || FR[cle];
