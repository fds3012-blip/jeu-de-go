// Socle i18n léger (issue #167), sans librairie : deux catalogues, une fonction `t` typée, Intl.PluralRules.
// Langue choisie une fois au chargement, dans cet ordre : le choix du Profil (clé locale `go.langue.v1`), puis `?lang=en|fr`
// dans l'adresse, puis (si DETECTION_APPAREIL) la langue de l'appareil, sinon le français.
import { en } from './en';
import { fr } from './fr';
import type { Catalogue, Cle, Langue, Params, Texte } from './types';

export type { Cle, Langue } from './types';

export const LANGUES: readonly Langue[] = ['fr', 'en'];
export const CATALOGUES: Record<Langue, Catalogue> = { fr, en };

/**
 * Suivre la langue de l'appareil : activé depuis que toute l'interface, les leçons et les problèmes existent en anglais.
 * L'app prend la première langue traduite (français ou anglais) de la liste de l'appareil ; à défaut, le français.
 */
export const DETECTION_APPAREIL = true;

/** Clé locale du choix fait dans le Profil (« Langue ») : il prime sur `?lang` et sur l'appareil. */
export const LANGUE_KEY = 'go.langue.v1';

const estLangue = (x: string | null | undefined): x is Langue => !!x && (LANGUES as readonly string[]).includes(x);

/**
 * Langue à utiliser : `choix` du Profil, puis paramètre `lang` de l'adresse, puis (si `detection`) la première langue
 * traduite de la liste de l'appareil, sinon le français.
 */
export function detecterLangue(search: string, preferees: readonly string[], detection = DETECTION_APPAREIL, choix: string | null = null): Langue {
  if (estLangue(choix)) return choix;
  const param = new URLSearchParams(search).get('lang')?.toLowerCase();
  if (estLangue(param)) return param;
  if (!detection) return 'fr';
  // Première langue traduite dans la liste de l'appareil (décision de Florian, 29/09) : un appareil en espagnol qui accepte
  // aussi l'anglais s'ouvre en anglais ; un appareil en allemand qui accepte aussi le français s'ouvre en français.
  for (const p of preferees) {
    const base = p.toLowerCase().split(/[-_]/)[0];
    if (estLangue(base)) return base;
  }
  return 'fr';
}

/** Choix du Profil gardé sur l'appareil, ou null (aucun choix, stockage indisponible). */
export function lireChoixLangue(): Langue | null {
  try {
    const v = JSON.parse(localStorage.getItem(LANGUE_KEY) ?? 'null') as unknown;
    return typeof v === 'string' && estLangue(v) ? v : null;
  } catch { return null; }
}

/** Garde le choix du Profil sur l'appareil. Le rechargement de la page l'applique partout (leçons comprises). */
export function memoriserChoixLangue(l: Langue): void {
  try { localStorage.setItem(LANGUE_KEY, JSON.stringify(l)); } catch { /* le choix vaut pour cette visite seulement */ }
}

function langueDuNavigateur(): Langue {
  if (typeof location === 'undefined' || typeof navigator === 'undefined') return 'fr';
  const preferees = navigator.languages?.length ? navigator.languages : [navigator.language];
  return detecterLangue(location.search, preferees.filter(Boolean), DETECTION_APPAREIL, lireChoixLangue());
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
