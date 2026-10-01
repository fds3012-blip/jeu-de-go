// Défi par lien (issue #81) : partie 9 × 9 en différé, 3 jours par coup. Depuis #343, un compte avec pseudo est
// obligatoire pour créer ou rejoindre un défi : plus de nouvelle session anonyme. Les sessions anonymes déjà ouvertes
// (anciens défis) gardent leurs parties et lient un e-mail (`garderMonCompte`) pour continuer.
// Toute la sécurité est côté serveur (migrations 20260929003100_defi_par_lien.sql et 20260929100100_garde_anonymes.sql) :
// - `creer_defi` / `rejoindre_defi` / `victoire_au_temps` : fonctions SQL appelées en RPC ;
// - les coups passent par la fonction serveur `game-action` (action `defi_coup`), qui valide les règles puis appelle
//   `jouer_coup_defi` (réservée à la clé service) ;
// - le temps réel suit la ligne de `games` (coups, comptage, résultat) et celle de `defis` (date limite).
// Écrans : src/app/Defis.tsx.
import type { Session } from '@supabase/supabase-js';
import { adresseDejaPrise, type EchecEnvoi, type Result } from './account';
import type { Tables } from './database.types';
import type { Game } from './games';
import type { Db } from './supabase';
import { t } from '../content/i18n';

export type Defi = Tables<'defis'>;

/** Jeton du lien : 24 octets aléatoires en base64url (32 caractères). */
export const FORMAT_JETON = /^[A-Za-z0-9_-]{32}$/;

/** Délai par coup (le serveur fait foi : `defis.delai_coup`). */
export const DELAI_COUP_MS = 3 * 24 * 60 * 60 * 1000;

/** Paramètre du fragment de l'adresse : `https://…/#defi=JETON`. */
export const PARAM_DEFI = 'defi';
/** Pseudo de qui invite, dans le fragment après le jeton : `#defi=JETON&de=Pseudo` (#343). */
export const PARAM_DE = 'de';
const FORMAT_PSEUDO = /^[A-Za-z0-9_-]{3,24}$/;

const echec = (message?: string | null): { ok: false; error: string } => ({ ok: false, error: message || t('erreur.serveur') });

/**
 * Session d'un vrai compte ? Une session anonyme (ouverte pour un défi) compte comme « pas de compte » partout
 * ailleurs : pas de synchronisation des leçons, pas de cote, pas de pseudo (le serveur les refuse de toute façon).
 */
export const estAnonyme = (session: Session | null | undefined): boolean => session?.user.is_anonymous === true;

/** Identifiant du compte, ou undefined sans compte ou avec une session anonyme. */
export const compteDe = (session: Session | null | undefined): string | undefined =>
  session && !estAnonyme(session) ? session.user.id : undefined;

/**
 * Lien à partager. Le jeton est dans le fragment (`#`) de la page d'accueil : il n'est envoyé ni au serveur web
 * ni dans l'en-tête Referer, et aucune règle de réécriture n'est nécessaire chez l'hébergeur.
 */
export function lienDefi(jeton: string, origine: string, pseudo?: string | null): string {
  const de = pseudo && FORMAT_PSEUDO.test(pseudo) ? `&${PARAM_DE}=${pseudo}` : '';
  return `${origine.replace(/\/+$/, '')}/#${PARAM_DEFI}=${jeton}${de}`;
}

/**
 * Pseudo de qui invite, lu dans le lien (`&de=Pseudo`) ; null s'il manque ou n'a pas la forme d'un pseudo.
 * Il ne sert qu'à l'accueil de l'ami, avant son compte ; la partie affiche ensuite le pseudo lu en base.
 */
export function inviteurDepuisLien(lien: string): string | null {
  const fragment = lien.includes('#') ? lien.slice(lien.indexOf('#') + 1) : lien;
  const de = fragment.split('&').find(p => p.startsWith(`${PARAM_DE}=`))?.slice(PARAM_DE.length + 1) ?? '';
  return FORMAT_PSEUDO.test(de) ? de : null;
}

/** Lit le jeton d'un lien de défi (`#defi=JETON`, l'ancien `/defi#JETON`, ou le jeton seul) ; null sinon. */
export function jetonDepuisLien(lien: string): string | null {
  let brut = lien.includes('#') ? lien.slice(lien.indexOf('#') + 1) : lien;
  if (brut.startsWith(`${PARAM_DEFI}=`)) brut = brut.slice(PARAM_DEFI.length + 1);
  const jeton = brut.split('&')[0].trim();
  return FORMAT_JETON.test(jeton) ? jeton : null;
}

/**
 * Session d'un vrai compte, exigée pour créer ou rejoindre un défi (#343). Aucune session anonyme n'est plus ouverte :
 * sans compte, ou avec une ancienne session anonyme, l'écran demande d'abord le compte (e-mail et pseudo).
 */
export async function exigerCompte(db: Db): Promise<Result<{ userId: string; anonyme: false }>> {
  const { data } = await db.auth.getSession();
  const user = data.session?.user;
  if (!user || user.is_anonymous === true) return echec(t('defi.compteRequis'));
  return { ok: true, value: { userId: user.id, anonyme: false } };
}

/** Crée un défi (compte avec pseudo exigé, #343) : renvoie la partie et le jeton du lien. */
export async function creerDefi(db: Db): Promise<Result<{ partieId: string; jeton: string; anonyme: boolean }>> {
  const session = await exigerCompte(db);
  if (!session.ok) return session;
  const { data, error } = await db.rpc('creer_defi');
  const ligne = data?.[0];
  if (error || !ligne) return echec(error?.message);
  return { ok: true, value: { partieId: ligne.partie_id, jeton: ligne.jeton, anonyme: session.value.anonyme } };
}

/** Ouvre un lien de défi avec son compte, puis prend la place d'invité (Noir). Renvoie la partie et le joueur. */
export async function ouvrirDefi(db: Db, jeton: string): Promise<Result<{ partieId: string; userId: string; anonyme: boolean; createur: boolean }>> {
  if (!FORMAT_JETON.test(jeton)) return echec(t('defi.erreur.introuvable'));
  const session = await exigerCompte(db);
  if (!session.ok) return session;
  const { data, error } = await db.rpc('rejoindre_defi', { p_jeton: jeton });
  if (error || !data) return echec(error?.message);
  // Le créateur qui rouvre son propre lien n'est pas un nouvel invité (mesure du coefficient viral).
  const ligne = await db.from('defis').select('createur_id').eq('partie_id', data).maybeSingle();
  return { ok: true, value: { partieId: data, ...session.value, createur: ligne.data?.createur_id === session.value.userId } };
}

/** Codes de refus de `game-action` pour `defi_coup` (contrat avec le backend, #81). */
export const CODES_REFUS = ['connexion', 'format', 'introuvable', 'spectateur', 'terminee', 'comptage', 'tour', 'temps',
  'hors-plateau', 'occupe', 'suicide', 'ko'] as const;
export type CodeRefus = (typeof CODES_REFUS)[number];

/** Réponse de `game-action` pour l'action `defi_coup`. */
type ReponseCoup = { ok: true; game?: Partial<Game> } | { ok?: false; error?: string; message?: string; resultat?: string };

/** Message clair (FR/EN) d'un refus : d'abord le code connu, sinon le message du serveur, sinon un message générique. */
export function messageRefus(corps: { error?: unknown; message?: unknown } | null | undefined): string {
  const code = corps?.error;
  if (typeof code === 'string' && (CODES_REFUS as readonly string[]).includes(code)) return t(`defi.refus.${code as CodeRefus}`);
  if (typeof corps?.message === 'string' && corps.message) return corps.message;
  return t('erreur.serveur');
}

/** Corps JSON d'une réponse en erreur HTTP de la fonction serveur, ou null. */
async function corpsErreur(error: unknown): Promise<{ error?: unknown; message?: unknown } | null> {
  const ctx = (error as { context?: unknown } | null)?.context;
  if (ctx && typeof (ctx as Response).json === 'function') {
    try { return (await (ctx as Response).json()) as { error?: unknown; message?: unknown }; } catch { /* corps illisible */ }
  }
  return null;
}

/**
 * Joue un coup de défi (SGF deux lettres, `tt` = passe) par la fonction serveur `game-action`.
 * Le serveur refuse : coup illégal, hors tour, joueur tiers, délai de 3 jours dépassé (la victoire au temps est alors
 * enregistrée). Renvoie la ligne de partie mise à jour quand le serveur la donne.
 */
export async function jouerCoupDefi(db: Db, partieId: string, coup: string): Promise<Result<Partial<Game> | null>> {
  const { data, error } = await db.functions.invoke<ReponseCoup>('game-action', { body: { action: 'defi_coup', game_id: partieId, move: coup } });
  if (error) return echec(messageRefus(await corpsErreur(error)));
  if (!data || data.ok !== true) return echec(messageRefus(data as { error?: string; message?: string } | null));
  return { ok: true, value: data.game ?? null };
}

export interface EtatDefi {
  partie: Game;
  defi: Defi;
  /** Résultat si la partie est finie (`W+T` : Blanc gagne au temps). */
  resultat: string | null;
}

/**
 * Lit un défi. Constate d'abord la victoire au temps si le délai du coup en cours est passé (pas de tâche planifiée).
 * Tant que l'ami n'a pas ouvert le lien, la partie n'a qu'un joueur : on lit sans constater le temps.
 */
export async function lireDefi(db: Db, partieId: string): Promise<Result<EtatDefi>> {
  const temps = await db.rpc('victoire_au_temps', { p_partie: partieId });
  if (temps.error) return echec(temps.error.message);
  const [partie, defi] = await Promise.all([
    db.from('games').select('*').eq('id', partieId).maybeSingle(),
    db.from('defis').select('*').eq('partie_id', partieId).maybeSingle()
  ]);
  if (partie.error || defi.error || !partie.data || !defi.data) return echec(partie.error?.message ?? defi.error?.message);
  return { ok: true, value: { partie: partie.data, defi: defi.data, resultat: temps.data ?? partie.data.result } };
}

/** Les défis du joueur (créés ou rejoints), du plus récent au plus ancien, avec leur partie. */
export async function mesDefis(db: Db, userId: string): Promise<Result<EtatDefi[]>> {
  const defis = await db.from('defis').select('*').or(`createur_id.eq.${userId},invite_id.eq.${userId}`).order('cree_le', { ascending: false }).limit(20);
  if (defis.error) return echec(defis.error.message);
  const lignes = defis.data ?? [];
  if (!lignes.length) return { ok: true, value: [] };
  const parties = await db.from('games').select('*').in('id', lignes.map(d => d.partie_id));
  if (parties.error) return echec(parties.error.message);
  const parId = new Map((parties.data ?? []).map(g => [g.id, g]));
  return {
    ok: true,
    value: lignes.flatMap(d => {
      const partie = parId.get(d.partie_id);
      return partie ? [{ partie, defi: d, resultat: partie.result }] : [];
    })
  };
}

/**
 * Suit un défi en temps réel : coups et résultat (table `games`), date limite (table `defis`).
 * `onChange` est appelé à chaque changement ; l'écran relit alors le défi. Renvoie la fonction qui arrête le suivi.
 */
export function abonnerDefi(db: Db, partieId: string, onChange: () => void): () => void {
  const canal = db.channel(`defi-${partieId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${partieId}` }, onChange)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'defis', filter: `partie_id=eq.${partieId}` }, onChange)
    .subscribe();
  return () => { void db.removeChannel(canal); };
}

/** Abandonne le défi (autorisé sans compte pour un défi). Renvoie le résultat (`W+R` ou `B+R`). */
export async function abandonnerDefi(db: Db, partieId: string): Promise<Result<string>> {
  const { data, error } = await db.rpc('resign_game', { p_game: partieId });
  if (error || !data) return echec(error?.message);
  return { ok: true, value: data };
}

/** Temps restant pour le coup en cours, en millisecondes (0 si dépassé, null si le délai n'a pas commencé). */
export function tempsRestant(dateLimite: string | null, maintenant = Date.now()): number | null {
  if (!dateLimite) return null;
  const fin = Date.parse(dateLimite);
  return Number.isNaN(fin) ? null : Math.max(0, fin - maintenant);
}

/**
 * Inscription d'une session anonyme d'un ancien défi : relie l'e-mail à la session (même identifiant), la partie en
 * cours est donc gardée. Supabase envoie un e-mail avec un code (`verifyOtp` de type `email_change`) et un lien.
 */
export async function garderMonCompte(db: Db, email: string, redirection: string): Promise<Result<null> | EchecEnvoi> {
  const { error } = await db.auth.updateUser({ email: email.trim() }, { emailRedirectTo: redirection });
  if (!error) return { ok: true, value: null };
  // #353 : l'adresse a déjà un compte. L'écran bascule vers la connexion à ce compte (raison `pris`).
  if (adresseDejaPrise(error)) return { ok: false, error: t('defi.erreur.emailPris'), raison: 'pris' };
  return echec(t(error.status === 429 ? 'erreur.tropDEssais' : 'erreur.envoiLien'));
}
