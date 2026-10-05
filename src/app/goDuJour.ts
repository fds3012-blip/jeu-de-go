// #433 : le calendrier et le problème du jour viennent de la version légère (titre et position, ≈ 5 Ko gzip) ;
// la liste complète (src/content/puzzles.ts) n'arrive qu'avec l'écran des problèmes.
import { GO_DU_JOUR } from '../content/goDuJour.gen';
import { TRADUCTIONS_PROBLEMES } from '../content/problemesLangue';
import { langue, t, type Langue } from '../content/i18n';
// Go du jour (issue #75) : un défi quotidien commun et partageable, façon Wordle. Logique pure, sans React.
// Tout le monde voit le même problème le même jour, en heure de Paris, quel que soit le fuseau de l'appareil.

/** Jour de lancement : le Go du jour n° 1. */
export const LANCEMENT = '2026-09-27';
export const FUSEAU = 'Europe/Paris';
export const URL_JEU = 'https://mochi-go.app/';
export const PARAM = 'go-du-jour';
/** Variante sans tiret, plus facile à taper à la main (`/?godujour=42`). */
export const PARAM_COURT = 'godujour';
/** Série du Go du jour sur cet appareil : dernier numéro réussi et nombre de jours de suite. */
export const SERIE_KEY = 'go.go-du-jour.v1';

/** Ordre du Go du jour : ordre d'arrivée des problèmes (CALENDRIER_GO_DU_JOUR de src/content/puzzles.ts). */
const CALENDRIER: readonly string[] = GO_DU_JOUR.map(([id]) => id);

const JOUR = 86_400_000;
const formatParis = new Intl.DateTimeFormat('en-CA', { timeZone: FUSEAU, year: 'numeric', month: '2-digit', day: '2-digit' });

/** Date du jour à Paris, au format AAAA-MM-JJ. */
export function dateParis(instant: Date): string {
  const parts = formatParis.formatToParts(instant);
  const v = (t: string) => parts.find(p => p.type === t)?.value ?? '';
  return `${v('year')}-${v('month')}-${v('day')}`;
}

const jourAbsolu = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / JOUR);
};

/** Numéro du Go du jour : 1 le jour du lancement, puis +1 à chaque minuit de Paris. */
export function numeroDuJour(instant: Date): number {
  return jourAbsolu(dateParis(instant)) - jourAbsolu(LANCEMENT) + 1;
}

/**
 * Problème d'un numéro donné : la liste est rangée dans l'ordre du calendrier (ordre d'arrivée des problèmes,
 * en ajout seulement), puis parcourue un problème par jour. Deux appareils voient donc le même problème sous
 * le même numéro, et l'ajout d'un lot de problèmes ne change pas les jours déjà prévus.
 * Un id absent du calendrier passe après, trié par id.
 */
export function problemeDuNumero<T extends { id: string }>(
  liste: readonly T[], numero: number, calendrier: readonly string[] = CALENDRIER
): T | undefined {
  if (!liste.length) return undefined;
  const rang = new Map(calendrier.map((id, i) => [id, i]));
  const cle = (id: string) => rang.get(id) ?? Number.MAX_SAFE_INTEGER;
  const tries = [...liste].sort((a, b) => cle(a.id) - cle(b.id) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const i = numero - 1;
  return tries[((i % tries.length) + tries.length) % tries.length];
}

/** Ce que l'accueil montre du Go du jour : titre (dans la langue de l'interface) et position. */
export interface ApercuDuJour { id: string; title: string; rows: string[] }

/**
 * Go du jour n° `numero` pour l'accueil (#433), sans charger les problèmes complets : même problème, même titre et
 * même position que `problemeDuNumero` sur la liste complète (vérifié par outils/goDuJour.test.ts).
 */
export function problemeDuJour(numero: number, l: Langue = langue()): ApercuDuJour | undefined {
  const e = problemeDuNumero(GO_DU_JOUR.map(([id, title, rows]) => ({ id, title, rows })), numero);
  if (!e) return undefined;
  const tr = l === 'fr' ? undefined : TRADUCTIONS_PROBLEMES[l][e.id];
  return { id: e.id, title: tr ? tr.title : e.title, rows: [...e.rows] };
}

/** Numéro demandé par un lien `?go-du-jour=N` ou `?godujour=N` (null si absent ou illisible). */
export function numeroDuLien(search: string): number | null {
  const params = new URLSearchParams(search);
  const brut = params.get(PARAM) ?? params.get(PARAM_COURT);
  if (brut === null || !/^\d{1,6}$/.test(brut.trim())) return null;
  return Number(brut.trim());
}

export interface Serie { dernier: number; jours: number }

/** Série après la réussite du Go du jour n° `numero` : +1 si la veille était réussie, sinon on repart à 1. */
export function serieApres(serie: Serie | null, numero: number): Serie {
  if (!serie) return { dernier: numero, jours: 1 };
  if (serie.dernier === numero) return serie;
  if (serie.dernier === numero - 1) return { dernier: numero, jours: serie.jours + 1 };
  return { dernier: numero, jours: 1 };
}

/** Série affichée aujourd'hui : elle tient si le dernier Go du jour réussi est celui d'aujourd'hui ou d'hier. */
export function serieVivante(serie: Serie | null, numero: number): number {
  return serie && numero - serie.dernier <= 1 && numero >= serie.dernier ? serie.jours : 0;
}

export interface Partage { texte: string; url: string; complet: string }

/**
 * Texte à partager, sans spoiler : jamais la coordonnée de la réponse, seulement le numéro, les essais et la série.
 * Exemple : « Go du jour n° 1 · résolu en 1 essai · série 3 🔥 » puis le lien.
 */
export function textePartage(numero: number, essais: number, serie: number): Partage {
  const n = Math.max(1, essais);
  const morceaux = [t('partage.numero', { numero }), t('partage.essais', { n })];
  if (serie > 0) morceaux.push(t('partage.serie', { serie }));
  const texte = morceaux.join(' · ');
  // Lien court (#285, #364) : `mochi-go.app/j/42`, avec sa page d'aperçu au numéro du jour (outils/apercus.ts) ; en
  // anglais, `/en/j/42`. index.html le remet à la forme `/?go-du-jour=42` à l'ouverture.
  const url = `${URL_JEU}${langue() === 'en' ? 'en/' : ''}j/${numero}`;
  return { texte, url, complet: `${texte}\n${url}` };
}
