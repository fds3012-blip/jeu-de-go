// Socle i18n léger (issue #167), sans librairie : deux catalogues, une fonction `t` typée, Intl.PluralRules.
// Langue choisie une fois au chargement, dans cet ordre : le choix du Profil (clé locale `go.langue.v1`), puis `?lang=en|fr`
// dans l'adresse, puis (si DETECTION_APPAREIL) la langue de l'appareil, sinon le français.
import { anglais, langueAuChargement } from '../anglais';
import { fr } from './fr';
import type { Catalogue, Cle, CleTout, Langue, Params, Texte } from './types';

export type { Cle, CleTout, Langue } from './types';

export { DETECTION_APPAREIL, LANGUE_KEY, LANGUES, detecterLangue, lireChoixLangue, memoriserChoixLangue } from './detection';

/**
 * Français : catalogue de l'accueil, complété par celui des écrans secondaires quand le premier d'entre eux arrive
 * (#433, src/content/i18n/secondaires.ts). Seul `ajouterTextes` le modifie.
 */
const francais: Record<string, Texte> = { ...fr };

/** Ajoute les textes français des écrans secondaires (src/content/i18n/secondaires.ts). */
export function ajouterTextes(textes: Partial<Catalogue>): void {
  Object.assign(francais, textes);
}

/**
 * Catalogues par langue. L'anglais n'est téléchargé que si l'interface est en anglais (#325, src/content/anglais.ts) :
 * sinon `CATALOGUES.en` est vide et `traduire('en', …)` retombe sur le français. Le français ne contient les textes
 * des écrans secondaires qu'une fois src/content/i18n/secondaires.ts chargé (#433).
 */
export const CATALOGUES: Record<Langue, Catalogue> = {
  fr: francais as Catalogue,
  get en() { return anglais()?.ui ?? ({} as Catalogue); },
};

let courante: Langue = langueAuChargement();

/** Langue de l'interface. */
export const langue = (): Langue => courante;

/** Manifeste de la PWA par langue (#473) : nom et description proposés à l'installation. */
export const MANIFESTES: Record<Langue, string> = { fr: '/manifest.webmanifest', en: '/manifest.en.webmanifest' };

/** Change la langue (tests, futur réglage du Profil) et met à jour `<html lang>`, le manifeste et la description. */
export function choisirLangue(l: Langue): void {
  courante = l;
  if (typeof document === 'undefined') return;
  document.documentElement.lang = l;
  document.querySelector('link[rel="manifest"]')?.setAttribute('href', MANIFESTES[l]);
  document.querySelector('meta[name="description"]')?.setAttribute('content', traduire(l, 'meta.description'));
}

const regles = new Map<Langue, Intl.PluralRules>();
function forme(texte: Texte, l: Langue, n: unknown): string {
  if (typeof texte === 'string') return texte;
  if (typeof n !== 'number') return texte.other;
  let r = regles.get(l);
  if (!r) regles.set(l, (r = new Intl.PluralRules(l)));
  return texte[r.select(n)] ?? texte.other;
}

/**
 * Texte de n'importe quelle clé (#433). Une clé d'écran secondaire n'est connue qu'une fois ses textes chargés :
 * passer par `t` ou `traduire` de src/content/i18n/secondaires, qui les importe. Clé inconnue : la clé elle-même,
 * jamais une erreur.
 */
export function traduireTout<K extends CleTout>(l: Langue, cle: K, ...params: Params<K>): string {
  const vars = (params[0] ?? {}) as Record<string, string | number>;
  const brut = forme(CATALOGUES[l][cle] ?? francais[cle] ?? cle, l, vars.n);
  return brut.replace(/\{(\w+)\}/g, (tout, nom: string) => (nom in vars ? String(vars[nom]) : tout));
}

/** Texte de `cle` dans une langue donnée (tests, comparaisons). Clés de l'accueil seulement ; les autres : src/content/i18n/secondaires. */
export function traduire<K extends Cle>(l: Langue, cle: K, ...params: Params<K>): string {
  return traduireTout(l, cle, ...params);
}

/** Nombre décimal lisible : virgule en français (« 6,5 »), point en anglais (« 6.5 »). */
export function nombre(n: number, l: Langue = courante): string {
  return l === 'fr' ? String(n).replace('.', ',') : String(n);
}

/** Texte de `cle` dans la langue de l'interface. Ex. : `t('profil.jours', { n: 3 })` → « 3 jours ». */
export function t<K extends Cle>(cle: K, ...params: Params<K>): string {
  return traduire(courante, cle, ...params);
}
