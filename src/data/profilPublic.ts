// Profil public d'un joueur (issue #560), lu par son pseudo exact. Le serveur fait foi
// (supabase/migrations/20261016120000_profil_public.sql) : il ne rend que le pseudo, la cote arrondie, le nombre de
// parties classées, les 5 dernières (adversaire par pseudo seulement sans blocage entre lui et le demandeur) et le lien
// d'amitié avec le demandeur ; rien du tout (null) pour un pseudo inconnu ou si l'un bloque l'autre, sans distinguer
// les deux cas. Ce module ne fait qu'appeler et lire, en ignorant ce qui est mal formé. Écran : src/app/ProfilPublic.tsx.
import type { Result } from './account';
import { CODE_COMPTE_REQUIS, CODE_PSEUDO_REQUIS } from './compteRequis';
import type { Db } from './supabase';
import { FORMAT_PSEUDO } from './amis';
import { t } from '../content/i18n';
import { tp } from '../content/i18n/profilPublic';

/** Lien d'amitié vu du demandeur ; `moi` : son propre pseudo. */
export type LienAmitie = 'aucun' | 'envoyee' | 'recue' | 'amis' | 'moi';

export interface PartieClassee {
  /** Pseudo de l'adversaire ; null : « un joueur » (blocage entre lui et le demandeur, ou sans pseudo). */
  adversaire: string | null;
  /** L'adversaire est le demandeur lui-même. */
  toi: boolean;
  /** Vu du joueur consulté ; null : partie nulle ou résultat sans vainqueur. */
  gagnee: boolean | null;
  /** AAAA-MM-JJ (Paris). */
  le: string;
  taille: number;
  couleur: 'noir' | 'blanc';
}

export interface ProfilPublic {
  pseudo: string;
  cote: number;
  provisoire: boolean;
  partiesClassees: number;
  lien: LienAmitie;
  /** Les 5 dernières parties classées, la plus récente d'abord. */
  parties: PartieClassee[];
}

const LIENS: readonly string[] = ['aucun', 'envoyee', 'recue', 'amis', 'moi'];
const entier = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 0);

/** Lecture tolérante d'une réponse de `profil_public` ; null si elle n'est pas un profil. */
export function lireProfilPublic(data: unknown): ProfilPublic | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const p = data as Record<string, unknown>;
  if (typeof p.pseudo !== 'string' || !p.pseudo) return null;
  const lien = typeof p.lien === 'string' && LIENS.includes(p.lien) ? (p.lien as LienAmitie) : 'aucun';
  const parties = Array.isArray(p.parties) ? p.parties.flatMap(x => {
    const r = x as Record<string, unknown> | null;
    if (!r || typeof r.le !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.le)) return [];
    const taille = entier(r.taille);
    if (taille < 5 || taille > 25) return [];
    return [{
      adversaire: typeof r.adversaire === 'string' && r.adversaire ? r.adversaire : null,
      toi: r.toi === true,
      gagnee: typeof r.gagnee === 'boolean' ? r.gagnee : null,
      le: r.le, taille, couleur: r.couleur === 'blanc' ? 'blanc' as const : 'noir' as const,
    }];
  }).slice(0, 5) : [];
  return { pseudo: p.pseudo, cote: entier(p.cote), provisoire: p.provisoire === true, partiesClassees: Math.max(0, entier(p.parties_classees)), lien, parties };
}

/** Refus connus du serveur. */
export const CODES_PROFIL_PUBLIC = {
  JGV01: 'tropVite',
  [CODE_COMPTE_REQUIS]: 'compte',
  [CODE_PSEUDO_REQUIS]: 'compte',
} as const;
export type RefusProfilPublic = (typeof CODES_PROFIL_PUBLIC)[keyof typeof CODES_PROFIL_PUBLIC];

export function refusProfilPublic(erreur: unknown): RefusProfilPublic | null {
  const code = (erreur as { code?: unknown } | null | undefined)?.code;
  return typeof code === 'string' && code in CODES_PROFIL_PUBLIC ? CODES_PROFIL_PUBLIC[code as keyof typeof CODES_PROFIL_PUBLIC] : null;
}

/** Message clair (FR/EN) d'une erreur : le refus connu, sinon un message générique (jamais le texte brut du serveur). */
export function messageProfilPublic(erreur: unknown): string {
  const refus = refusProfilPublic(erreur);
  if (refus === 'tropVite') {
    const hint = (erreur as { hint?: unknown } | null | undefined)?.hint;
    const n = typeof hint === 'string' && /^\d+$/.test(hint) ? Number(hint) : 1;
    return tp('joueur.erreur.tropVite', { n });
  }
  return refus ? tp(`joueur.erreur.${refus}`) : t('erreur.serveur');
}

/**
 * Le profil public d'un joueur, ou `null` s'il n'est pas disponible (pseudo inconnu, ou blocage dans un sens ou
 * l'autre : le serveur ne distingue pas, l'écran non plus).
 */
export async function profilPublic(db: Db, brut: string): Promise<Result<ProfilPublic | null>> {
  const pseudo = brut.trim().replace(/^@/, '');
  if (!FORMAT_PSEUDO.test(pseudo)) return { ok: true, value: null };
  try {
    const { data, error } = await db.rpc('profil_public', { p_pseudo: pseudo });
    if (error) return { ok: false, error: messageProfilPublic(error) };
    return { ok: true, value: lireProfilPublic(data) };
  } catch (e) { return { ok: false, error: messageProfilPublic(e) }; }
}
