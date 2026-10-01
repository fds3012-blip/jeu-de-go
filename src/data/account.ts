import type { Tables } from './database.types';
import type { Db } from './supabase';
import { usernameErrorFromDb, validateUsername } from './username';
import { liveStreak } from './puzzles';
import { t } from '../content/i18n';

export type Profile = Tables<'profiles'>;
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * Envoie l'e-mail de connexion (crée le compte s'il n'existe pas). Depuis #343, il porte un code à 6 chiffres
 * (`{{ .Token }}` dans le modèle Supabase, docs/growth/connexion-code.md) à saisir dans l'app, et garde le lien
 * comme second moyen. Le code marche là où le lien échoue : navigateur intégré de Messenger ou WhatsApp, app installée.
 */
export async function sendMagicLink(db: Db, email: string): Promise<Result<null>> {
  const { error } = await db.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: window.location.origin, shouldCreateUser: true }
  });
  if (error) return { ok: false, error: t(error.status === 429 ? 'erreur.tropDEssais' : 'erreur.envoiLien') };
  return { ok: true, value: null };
}
export const envoyerCode = sendMagicLink;

/** Erreur d'auth telle que renvoyée par supabase-js (AuthApiError) : seuls ces champs servent. */
export interface ErreurAuth { status?: number; code?: string; message?: string }

/**
 * #353 : l'adresse a déjà un compte (refus de `updateUser({ email })` sur une session anonyme). Supabase répond 422
 * `email_exists` ; les serveurs plus anciens, 422 sans code.
 */
export function adresseDejaPrise(e: ErreurAuth | null | undefined): boolean {
  if (!e) return false;
  if (e.code === 'email_exists' || e.code === 'user_already_exists') return true;
  return !e.code && e.status === 422;
}

/** #353 : aucun compte avec cette adresse (`signInWithOtp` avec `shouldCreateUser: false`). */
export function aucunCompte(e: ErreurAuth | null | undefined): boolean {
  if (!e) return false;
  return e.code === 'otp_disabled' || e.code === 'user_not_found' || /signups? not allowed/i.test(e.message ?? '');
}

/** Échec d'envoi du code, avec la raison qui fait changer l'écran (#353). */
export type EchecEnvoi = { ok: false; error: string; raison?: 'pris' | 'inconnu' };

/**
 * Connexion à un compte qui existe déjà (#353) : code par e-mail, sans jamais créer de compte. Adresse inconnue :
 * « Aucun compte avec cette adresse. Crée ton compte. » La session en place (anonyme comprise) n'est pas touchée :
 * seule la vérification du code la remplace.
 */
export async function envoyerCodeConnexion(db: Db, email: string): Promise<Result<null> | EchecEnvoi> {
  const { error } = await db.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: window.location.origin, shouldCreateUser: false }
  });
  if (!error) return { ok: true, value: null };
  if (aucunCompte(error)) return { ok: false, error: t('connexion.inconnu'), raison: 'inconnu' };
  return { ok: false, error: t(error.status === 429 ? 'erreur.tropDEssais' : 'erreur.envoiLien') };
}

/**
 * « Continuer avec Google » (#354) : part chez Google (redirection), qui revient sur `retour` avec la session dans le
 * fragment (flux implicite, lu par `detectSessionInUrl`). Même e-mail qu'un compte créé par code : même compte
 * (liaison automatique de Supabase). Seul l'e-mail sert : le nom et la photo de Google ne sont jamais utilisés.
 */
export async function connexionGoogle(db: Db, retour: string): Promise<Result<null>> {
  const { error } = await db.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: retour } });
  if (error) return { ok: false, error: t('connexion.google.erreur') };
  return { ok: true, value: null };
}

/** Nombre de chiffres du code (réglage « Email OTP Length » de Supabase, à laisser à 6). */
export const LONGUEUR_CODE = 6;

/** Garde les chiffres d'une saisie ou d'un collage (« 123 456 », « Code : 123456 »), au plus LONGUEUR_CODE. */
export function nettoyerCode(brut: string): string {
  return brut.replace(/\D/g, '').slice(0, LONGUEUR_CODE);
}

/** Vrai si le code a le bon nombre de chiffres. */
export const codeComplet = (code: string) => new RegExp(`^\\d{${LONGUEUR_CODE}}$`).test(code);

/**
 * Vérifie le code reçu par e-mail. `email` : connexion ou création de compte (`signInWithOtp`) ;
 * `email_change` : e-mail ajouté à une session sans compte (`updateUser`, ancien défi par lien). La session s'ouvre
 * dans CE navigateur, quel que soit celui où l'e-mail a été lu.
 */
export async function verifierCode(db: Db, email: string, code: string, type: 'email' | 'email_change' = 'email'): Promise<Result<null>> {
  const token = nettoyerCode(code);
  if (!codeComplet(token)) return { ok: false, error: t('connexion.code.incomplet', { n: LONGUEUR_CODE }) };
  const { data, error } = await db.auth.verifyOtp({ email: email.trim(), token, type });
  if (error) return { ok: false, error: t(error.status === 429 ? 'erreur.tropDEssais' : error.status && error.status < 500 ? 'connexion.code.faux' : 'erreur.serveur') };
  // E-mail ajouté à une session anonyme : sans nouvelle session renvoyée, le jeton en place dit encore « anonyme ».
  // On le renouvelle pour que l'app (et la RLS) voient tout de suite un vrai compte.
  if (type === 'email_change' && !data?.session) await db.auth.refreshSession().catch(() => null);
  return { ok: true, value: null };
}

/**
 * Pseudo libre ? Même règle que l'index unique de la base (sans tenir compte des majuscules). Les profils sont
 * lisibles par tous (RLS « Profils visibles par tous ») ; `_` est un joker de ILIKE, il est donc échappé.
 * La base revérifie à l'enregistrement : ceci n'est qu'une aide à la saisie.
 */
export async function pseudoDisponible(db: Db, pseudo: string, userId?: string): Promise<Result<boolean>> {
  const check = validateUsername(pseudo);
  if (!check.ok) return check;
  let requete = db.from('profiles').select('id').ilike('username', check.value.replace(/[\\%_]/g, c => `\\${c}`));
  if (userId) requete = requete.neq('id', userId);
  const { data, error } = await requete.limit(1);
  if (error) return { ok: false, error: t('pseudo.erreur') };
  return { ok: true, value: (data ?? []).length === 0 };
}

export async function fetchProfile(db: Db, userId: string): Promise<Result<Profile | null>> {
  const { data, error } = await db.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) return { ok: false, error: t('erreur.profil') };
  return { ok: true, value: data };
}

/**
 * Série de jours du joueur connecté (profil `streak_days`, `streak_last`), telle qu'affichée :
 * 0 si le dernier jour joué date d'avant-hier ou plus (même règle que l'onglet Problèmes).
 */
export async function fetchStreak(db: Db, userId: string, now = new Date()): Promise<Result<number>> {
  const { data, error } = await db.from('profiles').select('streak_days, streak_last, streak_freezes').eq('id', userId).maybeSingle();
  if (error) return { ok: false, error: t('erreur.serie') };
  if (!data) return { ok: true, value: 0 };
  return { ok: true, value: liveStreak(data.streak_days, data.streak_last, now, data.streak_freezes) };
}

/** Gels de série en réserve du joueur connecté (profil `streak_freezes`, écrit par le serveur seul ; issue #76). */
export async function fetchGels(db: Db, userId: string): Promise<Result<number>> {
  const { data, error } = await db.from('profiles').select('streak_freezes').eq('id', userId).maybeSingle();
  if (error) return { ok: false, error: t('erreur.gels') };
  return { ok: true, value: data?.streak_freezes ?? 0 };
}

/** Enregistre le pseudo. La base vérifie à nouveau le format et l'unicité. */
export async function saveUsername(db: Db, userId: string, raw: string): Promise<Result<Profile>> {
  const check = validateUsername(raw);
  if (!check.ok) return check;
  const { data, error } = await db.from('profiles').update({ username: check.value }).eq('id', userId).select('*').single();
  if (error) return { ok: false, error: usernameErrorFromDb(error.code) };
  return { ok: true, value: data };
}

/** Mot à taper pour confirmer la suppression du compte (#114). */
export const MOT_SUPPRESSION = 'SUPPRIMER';

/** Mot de confirmation dans la langue de l'interface (#167) : « SUPPRIMER » en français, « DELETE » en anglais. */
export const motSuppression = () => t('compte.supprimer.mot');

/** Vrai si la saisie vaut le mot de confirmation affiché (espaces et casse ignorés). Le mot français reste accepté partout. */
export function confirmationValide(saisie: string): boolean {
  const s = saisie.trim().toUpperCase();
  return s === MOT_SUPPRESSION || s === motSuppression();
}

/**
 * Supprime définitivement le compte du joueur connecté (#114), puis ferme la session locale.
 * Tout se passe côté serveur dans `delete_my_account()`, qui n'agit que sur auth.uid().
 */
export async function deleteMyAccount(db: Db): Promise<Result<null>> {
  const { error } = await db.rpc('delete_my_account');
  if (error) return { ok: false, error: t('erreur.suppression') };
  // L'utilisateur n'existe plus côté serveur : on efface seulement la session de cet appareil.
  await db.auth.signOut({ scope: 'local' });
  return { ok: true, value: null };
}
