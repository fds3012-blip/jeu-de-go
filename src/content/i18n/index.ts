// Socle i18n léger (issue #167), sans librairie : deux catalogues, une fonction `t` typée, Intl.PluralRules.
// Langue choisie une fois au chargement : `?lang=en|fr` dans l'adresse, sinon (si DETECTION_APPAREIL) la langue de l'appareil,
// sinon le français.
import { en } from './en';
import { fr } from './fr';
import type { Catalogue, Cle, Langue, Params, Texte } from './types';

export type { Cle, Langue } from './types';

export const LANGUES: readonly Langue[] = ['fr', 'en'];
export const CATALOGUES: Record<Langue, Catalogue> = { fr, en };

/**
 * Suivre la langue de l'appareil. À activer quand tous les écrans sont traduits : d'ici là, un appareil
 * en anglais reste en français (pas d'interface à moitié traduite) ; l'anglais passe par `?lang=en` ou un futur réglage.
 */
export const DETECTION_APPAREIL = false;

const estLangue = (x: string | null | undefined): x is Langue => !!x && (LANGUES as readonly string[]).includes(x);

/** Langue à utiliser : paramètre `lang` de l'adresse, puis (si `detection`) première langue connue de l'appareil, puis le français. */
export function detecterLangue(search: string, preferees: readonly string[], detection = DETECTION_APPAREIL): Langue {
  const param = new URLSearchParams(search).get('lang')?.toLowerCase();
  if (estLangue(param)) return param;
  if (!detection) return 'fr';
  for (const l of preferees) {
    const base = l.toLowerCase().split(/[-_]/)[0];
    if (estLangue(base)) return base;
  }
  return 'fr';
}

function langueDuNavigateur(): Langue {
  if (typeof location === 'undefined' || typeof navigator === 'undefined') return 'fr';
  const preferees = navigator.languages?.length ? navigator.languages : [navigator.language];
  return detecterLangue(location.search, preferees.filter(Boolean));
}

let courante: Langue = langueDuNavigateur();

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
