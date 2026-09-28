// Défi par lien (issue #81) : partie 9 × 9 en différé, 3 jours par coup, jouable sans compte (session anonyme Supabase).
// Toute la sécurité est côté serveur (migration 20260929003100_defi_par_lien.sql) :
// - `creer_defi` / `rejoindre_defi` / `victoire_au_temps` : fonctions SQL appelées en RPC ;
// - les coups passent par la fonction serveur `game-action`, qui valide les règles puis appelle `jouer_coup_defi`.
// Pas encore d'écran : ce module est prêt pour le front.
import type { Result } from './account';
import type { Tables } from './database.types';
import { playMove, type Game } from './games';
import type { Db } from './supabase';
import { t } from '../content/i18n';

export type Defi = Tables<'defis'>;

/** Jeton du lien : 24 octets aléatoires en base64url (32 caractères). */
export const FORMAT_JETON = /^[A-Za-z0-9_-]{32}$/;

/** Délai par coup (le serveur fait foi : `defis.delai_coup`). */
export const DELAI_COUP_MS = 3 * 24 * 60 * 60 * 1000;

const echec = (message?: string | null): { ok: false; error: string } => ({ ok: false, error: message || t('erreur.serveur') });

/**
 * Lien à partager. Le jeton est dans le fragment (`#`) : il n'est envoyé ni au serveur web ni dans l'en-tête Referer.
 */
export function lienDefi(jeton: string, origine: string): string {
  return `${origine.replace(/\/+$/, '')}/defi#${jeton}`;
}

/** Lit le jeton d'un lien de défi (ou le jeton seul) ; null si le format ne correspond pas. */
export function jetonDepuisLien(lien: string): string | null {
  const brut = lien.includes('#') ? lien.slice(lien.indexOf('#') + 1) : lien;
  const jeton = brut.trim();
  return FORMAT_JETON.test(jeton) ? jeton : null;
}

/** Garantit une session : si le joueur n'est pas connecté, ouvre une session anonyme (sans e-mail ni pseudo). */
export async function assurerSession(db: Db): Promise<Result<{ userId: string; anonyme: boolean }>> {
  const { data } = await db.auth.getSession();
  const user = data.session?.user;
  if (user) return { ok: true, value: { userId: user.id, anonyme: user.is_anonymous === true } };
  const { data: cree, error } = await db.auth.signInAnonymously();
  if (error || !cree.user) return echec();
  return { ok: true, value: { userId: cree.user.id, anonyme: true } };
}

/** Crée un défi : renvoie la partie et le jeton du lien. */
export async function creerDefi(db: Db): Promise<Result<{ partieId: string; jeton: string }>> {
  const session = await assurerSession(db);
  if (!session.ok) return session;
  const { data, error } = await db.rpc('creer_defi');
  const ligne = data?.[0];
  if (error || !ligne) return echec(error?.message);
  return { ok: true, value: { partieId: ligne.partie_id, jeton: ligne.jeton } };
}

/** Ouvre un lien de défi : session anonyme si besoin, puis place d'invité (Noir). Renvoie l'identifiant de la partie. */
export async function ouvrirDefi(db: Db, jeton: string): Promise<Result<string>> {
  if (!FORMAT_JETON.test(jeton)) return { ok: false, error: 'Défi introuvable' };
  const session = await assurerSession(db);
  if (!session.ok) return session;
  const { data, error } = await db.rpc('rejoindre_defi', { p_jeton: jeton });
  if (error || !data) return echec(error?.message);
  return { ok: true, value: data };
}

/** Joue un coup de défi (SGF deux lettres, `tt` = passe). Le serveur refuse coup illégal, hors tour, tiers et délai dépassé. */
export const jouerCoupDefi = (db: Db, partieId: string, coup: string) => playMove(db, partieId, coup);

export interface EtatDefi {
  partie: Game;
  defi: Defi;
  /** Résultat si la partie est finie (`W+T` : Blanc gagne au temps). */
  resultat: string | null;
}

/**
 * Lit un défi. Constate d'abord la victoire au temps si le délai du coup en cours est passé (pas de tâche planifiée).
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

/** Temps restant pour le coup en cours, en millisecondes (0 si dépassé, null si le délai n'a pas commencé). */
export function tempsRestant(dateLimite: string | null, maintenant = Date.now()): number | null {
  if (!dateLimite) return null;
  const fin = Date.parse(dateLimite);
  return Number.isNaN(fin) ? null : Math.max(0, fin - maintenant);
}

/**
 * Inscription après un défi joué sans compte : relie l'e-mail à la session anonyme (même identifiant),
 * la partie en cours est donc gardée. Supabase envoie un lien de confirmation.
 */
export async function garderMonCompte(db: Db, email: string, redirection: string): Promise<Result<null>> {
  const { error } = await db.auth.updateUser({ email: email.trim() }, { emailRedirectTo: redirection });
  if (error) return echec(t(error.status === 429 ? 'erreur.tropDEssais' : 'erreur.envoiLien'));
  return { ok: true, value: null };
}
