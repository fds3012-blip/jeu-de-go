// Révision espacée (#469) : ce que l'accueil lit pour compter les révisions du jour (#563 : à part de
// src/app/revisionEspacee.ts, qui le réexporte, pour que l'accueil n'emporte pas le calendrier ni les séances).
// Logique pure, sans React ni stockage ; tests : revisionEspacee.test.ts.

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

/** Vrai si l'élément est à revoir aujourd'hui (ou en retard). */
export function estDu(s: Pick<Suivi, 'prochain'>, maintenant: Date): boolean {
  return s.prochain !== null && s.prochain <= jour(maintenant);
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

// ---------- État gardé sur l'appareil (problèmes ratés, erreurs acquises, XP du jour) ----------

export interface EtatRevisions {
  /** Problèmes ratés suivis, par id de problème. */
  problemes: Record<string, Suivi>;
  /** Erreurs acquises (sorties de go.erreurs.v1), par id, avec la date du changement : le compte l'apprend ainsi. */
  acquises: Record<string, number>;
  /** Jour de la dernière séance qui a rapporté de l'XP (une fois par jour). */
  xpLe?: string;
}

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
export function plusRecents<T>(o: Record<string, T>, max: number, date: (v: T) => number): Record<string, T> {
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

/** Problèmes de la file (ni acquis, ni absents de `disponibles` quand la liste est donnée). */
export function elementsProblemes(etat: EtatRevisions, disponibles?: (id: string) => boolean): ElementFile[] {
  return Object.entries(etat.problemes)
    .filter(([id, s]) => s.etape < ACQUIS && (!disponibles || disponibles(id)))
    .map(([id, suivi]) => ({ cle: cleProbleme(id), genre: 'probleme' as const, ref: id, suivi }));
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
