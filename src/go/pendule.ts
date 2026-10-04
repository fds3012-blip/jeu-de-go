// Pendule des parties en direct (issue #360) : cadences, byo-yomi japonais et affichage. Logique pure, sans React.
//
// Le serveur fait foi : `public.pendule_apres`, `public.cadence_direct` et le déclencheur `games_direct_pendule`
// (supabase/migrations/20261004180100_partie_en_direct.sql) font exactement le même calcul. Le client ne décide jamais
// d'une perte au temps : il affiche la pendule, et demande au serveur de constater (`pendule_direct`).

export type Cadence = 'rapide' | 'normale' | 'lente';

export interface ReglesCadence {
  /** Temps principal de chaque joueur. */
  mainMs: number;
  /** Périodes de byo-yomi. */
  periodes: number;
  /** Durée d'une période. */
  periodeMs: number;
}

/** Mêmes valeurs que `public.cadence_direct`. */
export const CADENCES: Record<Cadence, ReglesCadence> = {
  rapide: { mainMs: 300_000, periodes: 3, periodeMs: 20_000 },
  normale: { mainMs: 600_000, periodes: 3, periodeMs: 30_000 },
  lente: { mainMs: 1_200_000, periodes: 5, periodeMs: 30_000 },
};
export const CADENCES_ORDRE: readonly Cadence[] = ['rapide', 'normale', 'lente'];
/** 10 min + 3 × 30 s. */
export const CADENCE_DEFAUT: Cadence = 'normale';
export const estCadence = (c: unknown): c is Cadence => typeof c === 'string' && c in CADENCES;

/** Déconnexion tolérée : au-delà, le joueur qui doit agir perd au temps (constaté par le serveur). */
export const ABSENCE_MS = 60_000;
/** Signe de présence envoyé au serveur (`pendule_direct`) quand c'est à soi de jouer. */
export const BATTEMENT_MS = 10_000;
/** Relecture quand c'est à l'adversaire (le temps réel prévient d'abord ; ceci rattrape un message perdu). */
export const RELECTURE_MS = 3_000;
/** Appel de `find_match` pendant l'attente (le serveur retire une attente sans nouvelles depuis 30 s). */
export const ATTENTE_MS = 2_500;

export interface Pendule {
  mainMs: number;
  periodes: number;
  tombe: boolean;
}

/**
 * Pendule d'un joueur après `ecouleMs` de réflexion sur un coup : le temps principal d'abord, puis le byo-yomi.
 * Une période dépassée est perdue ; tombée quand l'écoulé atteint le temps principal plus toutes les périodes.
 */
export function penduleApres(mainMs: number, periodes: number, periodeMs: number, ecouleMs: number): Pendule {
  const e = Math.max(0, Math.floor(ecouleMs));
  if (e >= mainMs + periodes * periodeMs) return { mainMs: 0, periodes: 0, tombe: true };
  if (e <= mainMs) return { mainMs: mainMs - e, periodes, tombe: false };
  return { mainMs: 0, periodes: periodes - Math.floor((e - mainMs) / periodeMs), tombe: false };
}

/** État renvoyé par `pendule_direct` (jsonb). */
export interface EtatDirect {
  statut: 'active' | 'finished' | 'aborted' | 'waiting';
  resultat: string | null;
  coups: string;
  comptage: boolean;
  mortes: string | null;
  mortesPar: string | null;
  cadence: Cadence;
  periodeMs: number;
  noir: { ms: number; periodes: number; vuLe: number | null };
  blanc: { ms: number; periodes: number; vuLe: number | null };
  /** Début du coup en cours (ms epoch du serveur), null si la pendule est arrêtée. */
  traitDepuis: number | null;
  /** Heure du serveur au moment de la réponse. */
  maintenant: number;
}

const date = (v: unknown): number | null => {
  if (typeof v !== 'string') return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
};
const entier = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Lit la réponse de `pendule_direct` ; null si elle est mal formée. */
export function lireEtatDirect(j: unknown): EtatDirect | null {
  if (!j || typeof j !== 'object') return null;
  const o = j as Record<string, unknown>;
  const statut = o.statut;
  if (statut !== 'active' && statut !== 'finished' && statut !== 'aborted' && statut !== 'waiting') return null;
  const maintenant = date(o.maintenant);
  const nMs = entier(o.noir_ms), bMs = entier(o.blanc_ms), nP = entier(o.noir_periodes), bP = entier(o.blanc_periodes);
  const pMs = entier(o.periode_ms);
  if (maintenant === null || nMs === null || bMs === null || nP === null || bP === null || pMs === null || !estCadence(o.cadence)) return null;
  return {
    statut,
    resultat: typeof o.resultat === 'string' ? o.resultat : null,
    coups: typeof o.coups === 'string' ? o.coups : '',
    comptage: o.comptage === true,
    mortes: typeof o.mortes === 'string' ? o.mortes : null,
    mortesPar: typeof o.mortes_par === 'string' ? o.mortes_par : null,
    cadence: o.cadence,
    periodeMs: pMs,
    noir: { ms: nMs, periodes: nP, vuLe: date(o.noir_vu_le) },
    blanc: { ms: bMs, periodes: bP, vuLe: date(o.blanc_vu_le) },
    traitDepuis: date(o.trait_depuis),
    maintenant,
  };
}

/** Couleur au trait (1 Noir, 2 Blanc) d'une partie classée (handicap 0) : Noir joue les coups pairs. */
export const traitDe = (coups: string): 1 | 2 => ((coups.length / 2) % 2 === 0 ? 1 : 2);

export interface Cadran {
  /** Temps affiché (ms) : temps principal restant, ou ce qui reste de la période en cours. */
  ms: number;
  /** Périodes restantes. */
  periodes: number;
  /** Le temps principal est épuisé. */
  byoyomi: boolean;
  /** Cette pendule tourne. */
  tourne: boolean;
  /** À zéro (le serveur va constater la perte au temps). */
  tombe: boolean;
}

/**
 * Cadran d'un joueur à l'heure `maintenantServeur` (heure du client corrigée de l'écart avec le serveur).
 * Seule la pendule du joueur au trait tourne, et seulement si la partie est en cours hors comptage.
 */
export function cadran(e: EtatDirect, couleur: 1 | 2, maintenantServeur: number): Cadran {
  const p = couleur === 1 ? e.noir : e.blanc;
  const tourne = e.statut === 'active' && !e.comptage && e.traitDepuis !== null && traitDe(e.coups) === couleur;
  if (!tourne) {
    return p.ms > 0 ? { ms: p.ms, periodes: p.periodes, byoyomi: false, tourne: false, tombe: false }
      : { ms: p.periodes > 0 ? e.periodeMs : 0, periodes: p.periodes, byoyomi: true, tourne: false, tombe: p.periodes === 0 };
  }
  const ecoule = Math.max(0, maintenantServeur - (e.traitDepuis ?? maintenantServeur));
  const r = penduleApres(p.ms, p.periodes, e.periodeMs, ecoule);
  if (r.tombe) return { ms: 0, periodes: 0, byoyomi: true, tourne: true, tombe: true };
  if (r.mainMs > 0) return { ms: r.mainMs, periodes: r.periodes, byoyomi: false, tourne: true, tombe: false };
  const dansPeriodes = ecoule - p.ms;
  return { ms: e.periodeMs - (dansPeriodes % e.periodeMs), periodes: r.periodes, byoyomi: true, tourne: true, tombe: false };
}

/** « 9:58 », « 0:07 » ; au-delà d'une heure « 1:00:00 ». Arrondi à la seconde supérieure (0:00 seulement à zéro). */
export function texteTemps(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const ss = String(sec).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Écart entre l'heure du serveur et celle du client, mesuré à une réponse (latence comptée pour moitié). */
export function ecartHorloge(maintenantServeur: number, envoi: number, reception: number): number {
  return maintenantServeur - (envoi + reception) / 2;
}
