// Détection de la langue de l'interface (#167), à part d'index.ts (#325) : src/content/anglais.ts s'en sert pour
// savoir, avant tout le reste, s'il faut télécharger les textes anglais. Réexportée par index.ts.
import type { Langue } from './types';

export const LANGUES: readonly Langue[] = ['fr', 'en'];
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

/** Langue au chargement : choix du Profil, `?lang`, puis langue de l'appareil (français hors navigateur). */
export function langueDuNavigateur(): Langue {
  if (typeof location === 'undefined' || typeof navigator === 'undefined') return 'fr';
  const preferees = navigator.languages?.length ? navigator.languages : [navigator.language];
  return detecterLangue(location.search, preferees.filter(Boolean), DETECTION_APPAREIL, lireChoixLangue());
}
