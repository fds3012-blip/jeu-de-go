// Abandons répétés (issue #442) : parties en direct quittées et parties lentes laissées expirer.
// Toute la règle est côté serveur (supabase/migrations/20261006150100_abandons_repetes.sql) :
// - `etat_abandons` : compteur, fin de l'attente du direct, délai de la prochaine partie quittée, plafond des parties
//   lentes, heure du serveur (l'écran calcule le temps restant avec l'heure du serveur, jamais avec la sienne seule) ;
// - `find_match` refuse pendant l'attente (JGD01 : `details` = fin de l'attente en ISO 8601, `hint` = minutes) ;
// - `chercher_partie_lente` refuse au plafond réduit (JGL11 : `details` = le plafond).
// Règles : docs/game-design/partie-en-direct.md et docs/game-design/partie-lente.md.
import type { Db } from './supabase';

export const CODE_ATTENTE_ABANDONS = 'JGD01';
export const CODE_PLAFOND_LENTES = 'JGL11';

/** Attente avant une nouvelle recherche en direct. `jusqua` : heure du serveur (ms) ; `delaiMin` : 5, 30 ou 1440. */
export interface AttenteDirect { jusqua: number; delaiMin: number }

/** État du joueur, lu à l'ouverture de l'écran. */
export interface EtatAbandons {
  /** Parties en direct quittées qui comptent (7 jours, 10 dernières parties). */
  abandons: number;
  /** Attente en cours, ou null. */
  attente: AttenteDirect | null;
  /** Délai (min) qu'entraînerait la prochaine partie quittée, ou null s'il n'y en aurait pas. */
  prochainMin: number | null;
  /** Parties lentes laissées expirer (30 jours) et plafond de parties lentes en cours. */
  lentesExpirees: number;
  lentesPlafond: number;
  /** Écart entre l'heure du serveur et celle du client (ms), à ajouter à Date.now(). */
  ecart: number;
}

const entier = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const date = (v: unknown): number | null => {
  if (typeof v !== 'string') return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
};

/** Réponse de `etat_abandons` → état ; null si elle est mal formée. `horloge` : heure du client à la réception. */
export function lireEtatAbandons(brut: unknown, horloge: number = Date.now()): EtatAbandons | null {
  if (!brut || typeof brut !== 'object') return null;
  const o = brut as Record<string, unknown>;
  const maintenant = date(o.maintenant);
  if (maintenant === null) return null;
  const jusqua = date(o.direct_jusqu_a);
  const delai = entier(o.direct_delai_min, 0);
  return {
    abandons: entier(o.direct_abandons, 0),
    attente: jusqua !== null && jusqua > maintenant ? { jusqua, delaiMin: delai } : null,
    prochainMin: typeof o.direct_prochain_min === 'number' ? o.direct_prochain_min : null,
    lentesExpirees: entier(o.lentes_expirees, 0),
    lentesPlafond: entier(o.lentes_plafond, 10),
    ecart: maintenant - horloge,
  };
}

/** Lit l'état du joueur ; null si le serveur ne répond pas ou n'a pas encore la migration (l'écran reste utilisable). */
export async function etatAbandons(db: Db): Promise<EtatAbandons | null> {
  const { data, error } = await db.rpc('etat_abandons');
  if (error) return null;
  return lireEtatAbandons(data);
}

/** Refus JGD01 de `find_match` → attente (heure du serveur) ; null pour tout autre refus. */
export function attenteDuRefus(erreur: unknown): AttenteDirect | null {
  const e = erreur as { code?: unknown; details?: unknown; hint?: unknown } | null | undefined;
  if (e?.code !== CODE_ATTENTE_ABANDONS) return null;
  const jusqua = date(e.details);
  const delaiMin = Number(e.hint);
  // Détail illisible : on retombe sur le délai le plus court, l'écran relira l'état.
  return { jusqua: jusqua ?? Date.now() + 5 * 60_000, delaiMin: Number.isFinite(delaiMin) && delaiMin > 0 ? delaiMin : 5 };
}

/** Plafond réduit des parties lentes, lu dans le refus JGL11 ; null pour tout autre refus. */
export function plafondDuRefus(erreur: unknown): number | null {
  const e = erreur as { code?: unknown; details?: unknown } | null | undefined;
  if (e?.code !== CODE_PLAFOND_LENTES) return null;
  const n = Number(e.details);
  return Number.isInteger(n) && n > 0 ? n : 2;
}

/** Temps restant avant la fin de l'attente, en ms (0 si elle est passée). `heureServeur` : Date.now() + écart. */
export const restantMs = (a: AttenteDirect, heureServeur: number): number => Math.max(0, a.jusqua - heureServeur);

/**
 * Temps restant lisible, arrondi vers le haut : « 5 min », « 1 h 30 », « 45 s ». `unites` : libellés de la langue.
 * Au-delà d'une heure, minutes à deux chiffres ; sous une minute, secondes.
 */
export function texteRestant(ms: number, unites: { s: string; min: string; h: string } = { s: 's', min: 'min', h: 'h' }): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 60) return `${s} ${unites.s}`;
  const min = Math.ceil(s / 60);
  if (min < 60) return `${min} ${unites.min}`;
  const h = Math.floor(min / 60), reste = min % 60;
  return reste ? `${h} ${unites.h} ${String(reste).padStart(2, '0')}` : `${h} ${unites.h}`;
}

/** Délai d'une sanction (5, 30, 1440 min) dit simplement : « 5 min », « 30 min », « 24 h ». */
export const texteDelai = (min: number, unites: { min: string; h: string } = { min: 'min', h: 'h' }): string =>
  (min >= 60 && min % 60 === 0 ? `${min / 60} ${unites.h}` : `${min} ${unites.min}`);
