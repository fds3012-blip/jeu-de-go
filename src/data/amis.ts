// Amis (issue #359) : trouver un joueur par son pseudo exact, lui envoyer une demande, l'accepter ou la refuser,
// retirer un ami, et le défier directement (sans lien).
// Toute la sécurité est côté serveur (supabase/migrations/20261002010100_amis.sql) : compte avec pseudo exigé,
// 20 demandes par 24 heures, pas de doublon ni de demande à soi-même, pas de relance du même joueur sous 7 jours,
// 3 défis en cours au plus contre un ami. Les fonctions ne prennent et ne rendent que des pseudos : jamais d'e-mail
// ni d'identifiant. Écran : src/app/Amis.tsx.
import type { Result } from './account';
import { CODE_COMPTE_REQUIS, CODE_PSEUDO_REQUIS } from './compteRequis';
import type { Db } from './supabase';
import { t } from '../content/i18n';
import { ta } from '../content/i18n/amis';

/** Relation vue par le joueur : ami accepté, demande reçue, demande envoyée. */
export type EtatAmi = 'ami' | 'recue' | 'envoyee';

export interface Ami {
  pseudo: string;
  etat: EtatAmi;
  /** Date de la demande (ISO). */
  depuis: string;
}

/** Même forme qu'un pseudo choisi (src/data/username.ts) : 3 à 24 lettres, chiffres, _ ou -. */
export const FORMAT_PSEUDO = /^[A-Za-z0-9_-]{3,24}$/;

/** Refus connus du serveur (codes SQLSTATE de la migration), et refus « compte » ou « pseudo » de #343. */
export const CODES_AMIS = {
  JGA01: 'introuvable',
  JGA02: 'toiMeme',
  JGA03: 'dejaAmis',
  JGA04: 'dejaEnvoyee',
  JGA05: 'limiteJour',
  JGA06: 'recente',
  JGA07: 'aucuneDemande',
  JGA08: 'pasAmi',
  JGA09: 'tropDeParties',
  // #363 : l'un des deux a bloqué l'autre (même refus dans les deux sens).
  JGB01: 'indisponible',
  [CODE_COMPTE_REQUIS]: 'compte',
  [CODE_PSEUDO_REQUIS]: 'compte',
} as const;
export type RefusAmi = (typeof CODES_AMIS)[keyof typeof CODES_AMIS];

/** Le refus reconnu dans une erreur de Supabase (`{ code }`), ou null. */
export function refusAmi(erreur: unknown): RefusAmi | null {
  const code = (erreur as { code?: unknown } | null | undefined)?.code;
  return typeof code === 'string' && code in CODES_AMIS ? CODES_AMIS[code as keyof typeof CODES_AMIS] : null;
}

/** Message clair (FR/EN) d'une erreur : le refus connu, sinon un message générique (jamais le texte brut du serveur). */
export function messageAmi(erreur: unknown): string {
  const refus = refusAmi(erreur);
  return refus ? ta(`amis.erreur.${refus}`) : t('erreur.serveur');
}

/** Pseudo nettoyé (espaces autour retirés), ou null s'il ne peut pas être un pseudo. */
export function pseudoSaisi(brut: string): string | null {
  const p = brut.trim().replace(/^@/, '');
  return FORMAT_PSEUDO.test(p) ? p : null;
}

const ETATS: readonly string[] = ['ami', 'recue', 'envoyee'];

/** Lignes renvoyées par `mes_amis`, en ignorant ce qui est mal formé. */
export function lireAmis(data: unknown): Ami[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap(l => {
    const r = l as Record<string, unknown> | null;
    if (!r || typeof r.pseudo !== 'string' || typeof r.etat !== 'string' || !ETATS.includes(r.etat)) return [];
    return [{ pseudo: r.pseudo, etat: r.etat as EtatAmi, depuis: typeof r.depuis === 'string' ? r.depuis : '' }];
  });
}

/** Ordre de l'écran : demandes reçues (à traiter), amis, demandes envoyées. Chaque groupe par pseudo. */
export function grouperAmis(amis: readonly Ami[]): Record<EtatAmi, Ami[]> {
  const tri = (e: EtatAmi) => amis.filter(a => a.etat === e).sort((a, b) => a.pseudo.localeCompare(b.pseudo, undefined, { sensitivity: 'base' }));
  return { recue: tri('recue'), ami: tri('ami'), envoyee: tri('envoyee') };
}

const echec = (erreur: unknown): { ok: false; error: string } => ({ ok: false, error: messageAmi(erreur) });

/** Amis et demandes du joueur connecté. */
export async function mesAmis(db: Db): Promise<Result<Ami[]>> {
  const { data, error } = await db.rpc('mes_amis');
  if (error) return echec(error);
  return { ok: true, value: lireAmis(data) };
}

/** Envoie une demande. `amis` : l'autre avait déjà demandé, vous êtes amis tout de suite. */
export async function demanderAmi(db: Db, brut: string): Promise<Result<'envoyee' | 'amis'>> {
  const pseudo = pseudoSaisi(brut);
  if (!pseudo) return { ok: false, error: ta('amis.erreur.introuvable') };
  const { data, error } = await db.rpc('demander_ami', { p_pseudo: pseudo });
  if (error || (data !== 'envoyee' && data !== 'amis')) return echec(error);
  return { ok: true, value: data };
}

/** Accepte ou refuse une demande reçue. Un refus n'est pas annoncé à l'autre joueur. */
export async function repondreAmi(db: Db, pseudo: string, accepter: boolean): Promise<Result<'amis' | 'refusee'>> {
  const { data, error } = await db.rpc('repondre_ami', { p_pseudo: pseudo, p_accepter: accepter });
  if (error || (data !== 'amis' && data !== 'refusee')) return echec(error);
  return { ok: true, value: data };
}

/** Retire un ami, ou annule une demande envoyée. */
export async function retirerAmi(db: Db, pseudo: string): Promise<Result<null>> {
  const { error } = await db.rpc('retirer_ami', { p_pseudo: pseudo });
  if (error) return echec(error);
  return { ok: true, value: null };
}

/**
 * Défie un ami sans lien : le serveur crée la partie (9 × 9, non classée, 3 jours par coup), l'ami a Noir et joue
 * le premier. Elle s'ouvre avec l'écran du défi (src/app/Defis.tsx). Renvoie l'identifiant de la partie.
 */
export async function defierAmi(db: Db, pseudo: string): Promise<Result<string>> {
  const { data, error } = await db.rpc('defier_ami', { p_pseudo: pseudo });
  if (error || typeof data !== 'string' || !data) return echec(error);
  return { ok: true, value: data };
}
