// Révision espacée (#469) : les erreurs de partie (« Tes erreurs à rejouer », « Rejouer mes erreurs ») et les problèmes
// ratés reviennent au bon moment. Logique pure, sans React ni stockage ; tests : revisionEspacee.test.ts.
//
// Calendrier (validé par Florian, 08/10) : un élément raté entre dans la file et revient à J+1. Chaque réussite le fait
// monter d'une marche : J+3, puis J+7, J+14, J+30. Réussi à J+30 : il est acquis et sort de la file. Un échec le renvoie
// à J+1, au pied de l'échelle (boîtes de Leitner). Les jours sont des jours locaux (AAAA-MM-JJ), comme les erreurs (#77).
// En retard, l'intervalle suivant compte depuis le jour de la réussite : jamais de rattrapage en rafale.
//
// Ce module est léger (aucun texte, aucun moteur) : l'accueil l'importe pour compter les révisions du jour.
// Les écritures sur l'appareil : src/app/revisionsAppareil.ts ; la synchronisation avec un compte :
// src/app/revisionsSynchro.ts (logique) et src/data/revisions.ts (réseau).

/** Intervalles en jours, une marche après l'autre. */
export const INTERVALLES = [1, 3, 7, 14, 30] as const;
/** Étape d'un élément acquis (réussi à J+30) : il ne revient plus. */
export const ACQUIS = INTERVALLES.length;
/** Une séance courte, qu'on finit : 5 éléments au plus. */
export const SEANCE_MAX = 5;
/** Erreurs de partie gardées sur l'appareil (#77) : position, coups acceptés et place dans le calendrier. */
export const ERREURS_KEY = 'go.erreurs.v1';
/** Problèmes ratés suivis par la file, marques des erreurs acquises et jour de la dernière séance qui a rapporté de l'XP. */
export const REVISIONS_KEY = 'go.revisions.v1';
/** Événement de fenêtre envoyé après chaque écriture : l'accueil recompte, la synchronisation repart. */
export const EVENEMENT_REVISIONS = 'go:revisions';
/** Au plus 300 problèmes suivis et 100 marques d'erreurs acquises sur l'appareil (les plus anciens sortent). */
export const MAX_PROBLEMES = 300;
export const MAX_ACQUISES = 100;

export type Genre = 'erreur' | 'probleme';

/** Place d'un élément dans le calendrier. */
export interface Suivi {
  /** Marche atteinte : 0 (J+1) à 4 (J+30) ; ACQUIS : ne revient plus. */
  etape: number;
  /** Jour du prochain passage (AAAA-MM-JJ, heure locale) ; null : acquis. */
  prochain: string | null;
  /** Échecs comptés depuis l'entrée dans la file. */
  echecs: number;
  /** Date du dernier changement (ms depuis 1970) : le plus récent gagne entre deux appareils. */
  maj: number;
}

/** Jour local au format AAAA-MM-JJ. */
export function jour(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Jour `n` jours après `d` (heure locale, changements d'heure compris). */
export function dansJours(d: Date, n: number): string {
  return jour(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}

/** Nombre de jours entre deux jours AAAA-MM-JJ (`b - a`). */
export function ecartJours(a: string, b: string): number {
  const ms = (s: string) => { const [y, m, j] = s.split('-').map(Number); return Date.UTC(y, m - 1, j); };
  return Math.round((ms(b) - ms(a)) / 86_400_000);
}

/** Échec (ou entrée dans la file) : retour au pied de l'échelle, prochain passage demain. */
export function apresEchec(s: Pick<Suivi, 'echecs'> | undefined, maintenant: Date): Suivi {
  return { etape: 0, prochain: dansJours(maintenant, INTERVALLES[0]), echecs: (s?.echecs ?? 0) + 1, maj: maintenant.getTime() };
}

/** Réussite : une marche de plus (J+3, J+7, J+14, J+30 comptés depuis aujourd'hui) ; après J+30, acquis. */
export function apresReussite(s: Suivi, maintenant: Date): Suivi {
  const etape = Math.min(ACQUIS, s.etape + 1);
  return { etape, prochain: etape >= ACQUIS ? null : dansJours(maintenant, INTERVALLES[etape]), echecs: s.echecs, maj: maintenant.getTime() };
}

export function apresEssai(s: Suivi, reussi: boolean, maintenant: Date): Suivi {
  return reussi ? apresReussite(s, maintenant) : apresEchec(s, maintenant);
}

/** Vrai si l'élément est à revoir aujourd'hui (ou en retard). */
export function estDu(s: Pick<Suivi, 'prochain'>, maintenant: Date): boolean {
  return s.prochain !== null && s.prochain <= jour(maintenant);
}

/** Jours de retard (0 : dû aujourd'hui). */
export function retard(s: Pick<Suivi, 'prochain'>, maintenant: Date): number {
  return s.prochain === null ? 0 : Math.max(0, ecartJours(s.prochain, jour(maintenant)));
}

/** Un élément de la file : erreur de partie ou problème raté. */
export interface ElementFile {
  /** Clé commune à l'appareil et au serveur : `erreur-…` (id de l'erreur) ou `pb:<id du problème>`. */
  cle: string;
  genre: Genre;
  /** Id de l'erreur ou du problème. */
  ref: string;
  suivi: Suivi;
}

export const cleProbleme = (id: string) => `pb:${id}`;

/**
 * Éléments dus, du plus en retard au moins en retard ; à retard égal, les erreurs de partie d'abord (elles viennent
 * de tes parties), puis par clé (ordre stable).
 */
export function dus(elements: readonly ElementFile[], maintenant: Date): ElementFile[] {
  return elements
    .filter(e => estDu(e.suivi, maintenant))
    .sort((a, b) => (a.suivi.prochain! < b.suivi.prochain! ? -1 : a.suivi.prochain! > b.suivi.prochain! ? 1 : 0)
      || (a.genre === b.genre ? 0 : a.genre === 'erreur' ? -1 : 1)
      || (a.cle < b.cle ? -1 : a.cle > b.cle ? 1 : 0));
}

/** La séance du jour : les éléments dus, 5 au plus. */
export function seance(elements: readonly ElementFile[], maintenant: Date, max = SEANCE_MAX): ElementFile[] {
  return dus(elements, maintenant).slice(0, max);
}

// ---------- État gardé sur l'appareil (problèmes ratés, erreurs acquises, XP du jour) ----------

export interface EtatRevisions {
  /** Problèmes ratés suivis, par id de problème. */
  problemes: Record<string, Suivi>;
  /** Erreurs acquises (sorties de go.erreurs.v1), par id, avec la date du changement : le compte l'apprend ainsi. */
  acquises: Record<string, number>;
  /** Jour de la dernière séance qui a rapporté de l'XP (une fois par jour). */
  xpLe?: string;
}

export const ETAT_VIDE: EtatRevisions = { problemes: {}, acquises: {} };

const JOUR_RE = /^\d{4}-\d{2}-\d{2}$/;
const entier = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

/** Suivi bien formé, ou null. */
export function suiviValide(brut: unknown): Suivi | null {
  if (!brut || typeof brut !== 'object') return null;
  const s = brut as Partial<Suivi>;
  if (!entier(s.etape, 0, ACQUIS) || !entier(s.echecs, 0, 100_000) || !entier(s.maj, 0, Number.MAX_SAFE_INTEGER)) return null;
  const acquis = s.etape === ACQUIS;
  if (acquis ? s.prochain !== null : typeof s.prochain !== 'string' || !JOUR_RE.test(s.prochain)) return null;
  return { etape: s.etape!, prochain: acquis ? null : s.prochain!, echecs: s.echecs!, maj: s.maj! };
}

/** Garde les `max` plus récents (par date de changement). */
function plusRecents<T>(o: Record<string, T>, max: number, date: (v: T) => number): Record<string, T> {
  const l = Object.entries(o);
  if (l.length <= max) return o;
  return Object.fromEntries(l.sort(([, a], [, b]) => date(b) - date(a)).slice(0, max));
}

/** Relit l'état gardé, en écartant ce qui est mal formé. */
export function lireRevisions(brut: unknown): EtatRevisions {
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return { problemes: {}, acquises: {} };
  const b = brut as Record<string, unknown>;
  const problemes: Record<string, Suivi> = {};
  if (b.problemes && typeof b.problemes === 'object') {
    for (const [id, s] of Object.entries(b.problemes as Record<string, unknown>)) {
      const v = suiviValide(s);
      if (v && id.length <= 64) problemes[id] = v;
    }
  }
  const acquises: Record<string, number> = {};
  if (b.acquises && typeof b.acquises === 'object') {
    for (const [id, t] of Object.entries(b.acquises as Record<string, unknown>)) if (entier(t, 0, Number.MAX_SAFE_INTEGER)) acquises[id] = t as number;
  }
  const etat: EtatRevisions = { problemes: plusRecents(problemes, MAX_PROBLEMES, s => s.maj), acquises: plusRecents(acquises, MAX_ACQUISES, t => t) };
  if (typeof b.xpLe === 'string' && JOUR_RE.test(b.xpLe)) etat.xpLe = b.xpLe;
  return etat;
}

/**
 * Premier essai d'un problème hors séance (onglet Problèmes) : raté, il entre dans la file (ou y repart de J+1).
 * Réussi : rien ne change (seule la séance fait monter l'échelle, au jour prévu).
 */
export function problemeRate(etat: EtatRevisions, id: string, maintenant: Date): EtatRevisions {
  return { ...etat, problemes: plusRecents({ ...etat.problemes, [id]: apresEchec(etat.problemes[id], maintenant) }, MAX_PROBLEMES, s => s.maj) };
}

/** Essai d'un problème de la file pendant la séance. */
export function problemeRevu(etat: EtatRevisions, id: string, reussi: boolean, maintenant: Date): EtatRevisions {
  const s = etat.problemes[id];
  if (!s) return etat;
  return { ...etat, problemes: { ...etat.problemes, [id]: apresEssai(s, reussi, maintenant) } };
}

/** Erreur acquise : sa marque reste sur l'appareil, pour que le compte l'apprenne. */
export function erreurAcquise(etat: EtatRevisions, id: string, maj: number): EtatRevisions {
  return { ...etat, acquises: plusRecents({ ...etat.acquises, [id]: maj }, MAX_ACQUISES, t => t) };
}

/** Problèmes de la file (ni acquis, ni absents de `disponibles` quand la liste est donnée). */
export function elementsProblemes(etat: EtatRevisions, disponibles?: (id: string) => boolean): ElementFile[] {
  return Object.entries(etat.problemes)
    .filter(([id, s]) => s.etape < ACQUIS && (!disponibles || disponibles(id)))
    .map(([id, suivi]) => ({ cle: cleProbleme(id), genre: 'probleme' as const, ref: id, suivi }));
}

/** Ids des problèmes que la file suit (acquis compris) : la Révision du jour (#199) les laisse à la file. */
export function problemesSuivis(etat: EtatRevisions): Set<string> {
  return new Set(Object.keys(etat.problemes));
}

/** XP de la séance : une fois par jour. Renvoie le nouvel état, ou null si l'XP du jour est déjà prise. */
export function prendreXp(etat: EtatRevisions, maintenant: Date): EtatRevisions | null {
  const j = jour(maintenant);
  return etat.xpLe === j ? null : { ...etat, xpLe: j };
}

// ---------- Compte rapide pour l'accueil (sans relire le détail des erreurs) ----------

/** Erreurs gardées (go.erreurs.v1), vues seulement par leur id et leur prochain passage. */
export function elementsErreursBruts(brut: unknown): ElementFile[] {
  if (!Array.isArray(brut)) return [];
  const out: ElementFile[] = [];
  for (const e of brut as unknown[]) {
    if (!e || typeof e !== 'object') continue;
    const x = e as { id?: unknown; prochain?: unknown; reussites?: unknown; rates?: unknown; maj?: unknown };
    if (typeof x.id !== 'string' || typeof x.prochain !== 'string' || !JOUR_RE.test(x.prochain)) continue;
    const etape = entier(x.reussites, 0, ACQUIS - 1) ? x.reussites as number : 0;
    out.push({ cle: x.id, genre: 'erreur', ref: x.id, suivi: { etape, prochain: x.prochain, echecs: entier(x.rates, 0, 100_000) ? x.rates as number : 0, maj: entier(x.maj, 0, Number.MAX_SAFE_INTEGER) ? x.maj as number : 0 } });
  }
  return out;
}

/** Nombre d'éléments dus aujourd'hui (erreurs et problèmes ratés), plafonné à la taille d'une séance pour l'affichage. */
export function compterDus(brutErreurs: unknown, brutRevisions: unknown, maintenant: Date): number {
  const elements = [...elementsErreursBruts(brutErreurs), ...elementsProblemes(lireRevisions(brutRevisions))];
  return Math.min(SEANCE_MAX, dus(elements, maintenant).length);
}
