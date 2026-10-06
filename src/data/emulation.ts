// Émulation entre amis (issue #369, décision du 05/10) : Go du jour entre amis, « Rappelle-lui », bilan de la semaine
// et records de cote. Le serveur est la source de vérité de tout ce qui compare des joueurs
// (supabase/migrations/20261005230100_emulation_amis.sql) : il compte les essais du Go du jour, ne rend que les amis
// acceptés, jamais de cote d'un autre ni d'identifiant. Ce module ne fait qu'appeler et lire, en ignorant ce qui est
// mal formé. Écrans : src/ui/AmisDuJour.tsx (feuille de réussite du Go du jour), src/app/Semaine.tsx (Profil),
// src/ui/BilanSemaine.tsx (accueil du lundi), src/ui/Cote.tsx (records).
import type { Result } from './account';
import { CODE_COMPTE_REQUIS, CODE_PSEUDO_REQUIS } from './compteRequis';
import type { Db } from './supabase';

/** Où en est un joueur au Go du jour d'aujourd'hui. « vu » : réussi après avoir vu la réponse. */
export type EtatDuJour = 'reussi' | 'vu' | 'pas_encore';

export interface LigneDuJour {
  pseudo: string;
  etat: EtatDuJour;
  /** Essais d'une réussite ; null sinon. */
  essais: number | null;
  /** Le joueur lui-même. */
  moi: boolean;
  /** Déjà rappelé aujourd'hui par le joueur. */
  rappele: boolean;
}

/** Résultat d'un essai envoyé au serveur. */
export type ResultatEssai = 'rate' | 'reussi' | 'vu';

const ETATS: readonly string[] = ['reussi', 'vu', 'pas_encore'];

/** Lignes de `classement_go_du_jour`, dans l'ordre du serveur, sans ce qui est mal formé. */
export function lireClassement(data: unknown): LigneDuJour[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap(l => {
    const r = l as Record<string, unknown> | null;
    if (!r || typeof r.pseudo !== 'string' || typeof r.etat !== 'string' || !ETATS.includes(r.etat)) return [];
    const essais = typeof r.essais === 'number' && Number.isFinite(r.essais) && r.essais > 0 ? Math.round(r.essais) : null;
    return [{ pseudo: r.pseudo, etat: r.etat as EtatDuJour, essais: r.etat === 'reussi' ? essais : null, moi: r.moi === true, rappele: r.rappele === true }];
  });
}

/** Refus connus de l'émulation (codes SQLSTATE de la migration et de #359, #343). */
export const CODES_EMULATION = {
  JGJ01: 'autreJour',
  JGJ02: 'dejaFait',
  JGJ03: 'limiteRappels',
  JGJ04: 'invalide',
  JGA01: 'introuvable',
  JGA02: 'toiMeme',
  JGA08: 'pasAmi',
  [CODE_COMPTE_REQUIS]: 'compte',
  [CODE_PSEUDO_REQUIS]: 'compte',
} as const;
export type RefusEmulation = (typeof CODES_EMULATION)[keyof typeof CODES_EMULATION] | 'serveur';

export function refusEmulation(erreur: unknown): RefusEmulation {
  const code = (erreur as { code?: unknown } | null | undefined)?.code;
  return typeof code === 'string' && code in CODES_EMULATION ? CODES_EMULATION[code as keyof typeof CODES_EMULATION] : 'serveur';
}

type Reponse<T> = { ok: true; value: T } | { ok: false; error: RefusEmulation };

/** Note un essai du Go du jour n° `numero` (celui d'aujourd'hui pour le serveur, sinon refus `autreJour`). */
export async function noterGoDuJour(db: Db, numero: number, resultat: ResultatEssai): Promise<Reponse<string>> {
  const { data, error } = await db.rpc('noter_go_du_jour', { p_numero: numero, p_resultat: resultat });
  if (error || typeof data !== 'string') return { ok: false, error: refusEmulation(error) };
  return { ok: true, value: data };
}

/** Le Go du jour d'aujourd'hui du joueur et de ses amis acceptés. */
export async function classementGoDuJour(db: Db): Promise<Reponse<LigneDuJour[]>> {
  const { data, error } = await db.rpc('classement_go_du_jour');
  if (error) return { ok: false, error: refusEmulation(error) };
  return { ok: true, value: lireClassement(data) };
}

/** « Rappelle-lui » : `envoye`, ou `deja` s'il a déjà été rappelé aujourd'hui. */
export async function rappelerGoDuJour(db: Db, pseudo: string): Promise<Reponse<'envoye' | 'deja'>> {
  const { data, error } = await db.rpc('rappeler_go_du_jour', { p_pseudo: pseudo });
  if (error || (data !== 'envoye' && data !== 'deja')) return { ok: false, error: refusEmulation(error) };
  return { ok: true, value: data };
}

export interface AmiAffronte { pseudo: string; victoires: number; defaites: number }

/** Bilan d'une semaine (lundi à dimanche, heure de Paris) lu sur le serveur. */
export interface BilanServeur {
  /** Lundi de la semaine (AAAA-MM-JJ). */
  semaine: string;
  /** Parties entre humains finies. */
  parties: number;
  victoires: number;
  partiesClassees: number;
  /** Points de cote gagnés (positif) ou perdus. */
  coteEcart: number;
  goDuJour: number;
  /** Amis acceptés affrontés, 5 au plus, le plus battu d'abord. */
  amis: AmiAffronte[];
}

const entier = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 0);

/** Lecture tolérante de `bilan_semaine` ; null si la réponse n'en est pas un. */
export function lireBilanServeur(data: unknown): BilanServeur | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const b = data as Record<string, unknown>;
  if (typeof b.semaine !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(b.semaine)) return null;
  const amis = Array.isArray(b.amis) ? b.amis.flatMap(a => {
    const x = a as Record<string, unknown> | null;
    return x && typeof x.pseudo === 'string' ? [{ pseudo: x.pseudo, victoires: Math.max(0, entier(x.victoires)), defaites: Math.max(0, entier(x.defaites)) }] : [];
  }).slice(0, 5) : [];
  return {
    semaine: b.semaine, parties: Math.max(0, entier(b.parties)), victoires: Math.max(0, entier(b.victoires)),
    partiesClassees: Math.max(0, entier(b.parties_classees)), coteEcart: entier(b.cote_ecart), goDuJour: Math.max(0, entier(b.go_du_jour)), amis,
  };
}

/** Bilan de la semaine en cours, ou de la précédente. */
export async function bilanSemaine(db: Db, precedente = false): Promise<Reponse<BilanServeur>> {
  const { data, error } = await db.rpc('bilan_semaine', { p_precedente: precedente });
  const b = error ? null : lireBilanServeur(data);
  if (!b) return { ok: false, error: refusEmulation(error) };
  return { ok: true, value: b };
}

/** Records de cote du joueur (parties classées). */
export interface Records {
  parties: number;
  /** Meilleure cote atteinte après une partie classée ; null avant la première. */
  meilleureCote: number | null;
  /** Date de ce record (AAAA-MM-JJ, Paris). */
  meilleureCoteLe: string | null;
  serieVictoires: number;
  serieEnCours: number;
}

export function lireRecords(data: unknown): Records | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const r = data as Record<string, unknown>;
  const cote = typeof r.meilleure_cote === 'number' && Number.isFinite(r.meilleure_cote) ? Math.round(r.meilleure_cote) : null;
  return {
    parties: Math.max(0, entier(r.parties)),
    meilleureCote: cote,
    meilleureCoteLe: cote !== null && typeof r.meilleure_cote_le === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.meilleure_cote_le) ? r.meilleure_cote_le : null,
    serieVictoires: Math.max(0, entier(r.serie_victoires)),
    serieEnCours: Math.max(0, entier(r.serie_en_cours)),
  };
}

export async function mesRecords(db: Db): Promise<Result<Records>> {
  const { data, error } = await db.rpc('mes_records');
  const r = error ? null : lireRecords(data);
  if (!r) return { ok: false, error: refusEmulation(error) };
  return { ok: true, value: r };
}
