// Socle i18n léger (issue #167), sans librairie : deux catalogues, une fonction `t` typée, Intl.PluralRules.
// Langue choisie une fois au chargement, dans cet ordre : le choix du Profil (clé locale `go.langue.v1`), puis `?lang=en|fr`
// dans l'adresse, puis (si DETECTION_APPAREIL) la langue de l'appareil, sinon le français.
import { anglais, langueAuChargement } from '../anglais';
import { fr } from './fr';
import type { Catalogue, Cle, Langue, Params, Texte } from './types';

export type { Cle, Langue } from './types';

export { DETECTION_APPAREIL, LANGUE_KEY, LANGUES, detecterLangue, lireChoixLangue, memoriserChoixLangue } from './detection';

/**
 * Catalogues par langue. L'anglais n'est téléchargé que si l'interface est en anglais (#325, src/content/anglais.ts) :
 * sinon `CATALOGUES.en` est vide et `traduire('en', …)` retombe sur le français.
 */
export const CATALOGUES: Record<Langue, Catalogue> = {
  fr,
  get en() { return anglais()?.ui ?? ({} as Catalogue); },
};

let courante: Langue = langueAuChargement();

/** Langue de l'interface. */
export const langue = (): Langue => courante;

/** Change la langue (tests, futur réglage du Profil) et met à jour `<html lang>`. */
export function choisirLangue(l: Langue): void {
  courante = l;
  if (typeof document !== 'undefined') document.documentElement.lang = l;
}

const regles = new Map<Langue, Intl.PluralRules>();
function forme(texte: Texte, l: Langue, n: unknown): string {
  if (typeof texte === 'string') return texte;
  if (typeof n !== 'number') return texte.other;
  let r = regles.get(l);
  if (!r) regles.set(l, (r = new Intl.PluralRules(l)));
  return texte[r.select(n)] ?? texte.other;
}

/** Texte de `cle` dans une langue donnée (tests, comparaisons). */
export function traduire<K extends Cle>(l: Langue, cle: K, ...params: Params<K>): string {
  const vars = (params[0] ?? {}) as Record<string, string | number>;
  const brut = forme(CATALOGUES[l][cle] ?? fr[cle], l, vars.n);
  return brut.replace(/\{(\w+)\}/g, (tout, nom: string) => (nom in vars ? String(vars[nom]) : tout));
}

/** Nombre décimal lisible : virgule en français (« 6,5 »), point en anglais (« 6.5 »). */
export function nombre(n: number, l: Langue = courante): string {
  return l === 'fr' ? String(n).replace('.', ',') : String(n);
}

/** Texte de `cle` dans la langue de l'interface. Ex. : `t('profil.jours', { n: 3 })` → « 3 jours ». */
export function t<K extends Cle>(cle: K, ...params: Params<K>): string {
  return traduire(courante, cle, ...params);
}
