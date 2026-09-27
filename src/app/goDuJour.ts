// Go du jour (issue #75) : un défi quotidien commun et partageable, façon Wordle. Logique pure, sans React.
// Tout le monde voit le même problème le même jour, en heure de Paris, quel que soit le fuseau de l'appareil.

/** Jour de lancement : le Go du jour n° 1. */
export const LANCEMENT = '2026-09-27';
export const FUSEAU = 'Europe/Paris';
export const URL_JEU = 'https://jeu-de-go.vercel.app/';
export const PARAM = 'go-du-jour';
/** Série du Go du jour sur cet appareil : dernier numéro réussi et nombre de jours de suite. */
export const SERIE_KEY = 'go.go-du-jour.v1';

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
 * Problème d'un numéro donné : la liste est triée par id (stable), puis parcourue dans l'ordre, un par jour.
 * Deux appareils avec la même liste voient donc le même problème sous le même numéro.
 */
export function problemeDuNumero<T extends { id: string }>(liste: readonly T[], numero: number): T | undefined {
  if (!liste.length) return undefined;
  const tries = [...liste].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const i = numero - 1;
  return tries[((i % tries.length) + tries.length) % tries.length];
}

/** Numéro demandé par un lien `?go-du-jour=N` (null si absent ou illisible). */
export function numeroDuLien(search: string): number | null {
  const brut = new URLSearchParams(search).get(PARAM);
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
  const morceaux = [`Go du jour n° ${numero}`, `résolu en ${n} essai${n > 1 ? 's' : ''}`];
  if (serie > 0) morceaux.push(`série ${serie} 🔥`);
  const texte = morceaux.join(' · ');
  const url = `${URL_JEU}?${PARAM}=${numero}`;
  return { texte, url, complet: `${texte}\n${url}` };
}
