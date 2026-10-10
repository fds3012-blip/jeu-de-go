import type { UserIdentity } from '@supabase/supabase-js';
import type { Db } from './supabase';
import { ORDRE_FOURNISSEURS, NOM_FOURNISSEUR, estFournisseur, type Fournisseur } from '../app/fournisseurs';
import { usernameErrorFromDb, validateUsername } from './username';
import { langue, t } from '../content/i18n';

export type { Profile, Result } from './lectureProfil';
import type { Profile, Result } from './lectureProfil';

/**
 * Envoie l'e-mail de connexion (crée le compte s'il n'existe pas). Depuis #343, il porte un code à 6 chiffres
 * (`{{ .Token }}` dans le modèle Supabase, docs/growth/connexion-code.md) à saisir dans l'app, et garde le lien
 * comme second moyen. Le code marche là où le lien échoue : navigateur intégré de Messenger ou WhatsApp, app installée.
 */
export async function sendMagicLink(db: Db, email: string): Promise<Result<null>> {
  const { error } = await db.auth.signInWithOtp({
    email: email.trim(),
    // #473 : langue des e-mails (supabase/auth/modeles lisent `.Data.langue`), gardée à la création du compte.
    options: { emailRedirectTo: window.location.origin, shouldCreateUser: true, data: donneesLangue() }
  });
  if (error) return { ok: false, error: t(error.status === 429 ? 'erreur.tropDEssais' : 'erreur.envoiLien') };
  return { ok: true, value: null };
}
export const envoyerCode = sendMagicLink;

/**
 * Langue des e-mails de connexion (#473) : les modèles Supabase (supabase/auth/modeles) écrivent en anglais si
 * `user_metadata.langue` vaut `en`, sinon en français. Seule donnée ajoutée : la langue de l'interface.
 */
export const donneesLangue = (): { langue: 'fr' | 'en' } => ({ langue: langue() });

/**
 * Compte déjà créé (#473) : si la langue de l'interface a changé depuis, on la garde pour ses prochains e-mails.
 * Rien à faire sans session ni si elle est déjà la bonne ; une erreur ne bloque rien (les e-mails restent en français).
 */
export async function garderLangueDesEmails(db: Db): Promise<void> {
  try {
    const { data } = await db.auth.getSession();
    const user = data.session?.user;
    if (!user || user.is_anonymous || (user.user_metadata as { langue?: unknown } | undefined)?.langue === langue()) return;
    await db.auth.updateUser({ data: donneesLangue() });
  } catch { /* hors ligne : on réessaiera à la prochaine ouverture */ }
}

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
 * « Continuer avec Google / Apple / Facebook » (#354, #411) : part chez le fournisseur (redirection), qui revient sur
 * `retour` avec la session dans le fragment (flux implicite, lu par `detectSessionInUrl`). Même e-mail vérifié qu'un
 * compte existant : même compte (liaison automatique de Supabase). Seul l'e-mail sert : nom et photo jamais utilisés
 * (et effacés par le serveur, migrations `minimisation_*`).
 */
export async function connexionSociale(db: Db, fournisseur: Fournisseur, retour: string): Promise<Result<null>> {
  const { error } = await db.auth.signInWithOAuth({ provider: fournisseur, options: { redirectTo: retour } });
  if (error) return { ok: false, error: t('connexion.sociale.erreur', { nom: NOM_FOURNISSEUR[fournisseur] }) };
  return { ok: true, value: null };
}

/** Échec d'une liaison : `fermee` si la liaison manuelle n'est pas activée dans Supabase (repli : connexion classique). */
export type EchecLiaison = { ok: false; error: string; raison?: 'fermee' };

/**
 * Relie un fournisseur au compte EN PLACE (`linkIdentity`, #411) : session sans compte d'un ancien défi (même identifiant,
 * donc parties et défis gardés) ou compte complet qui ajoute un moyen (Mon compte). Demande « Manual linking » activé
 * dans Supabase ; sinon `raison: 'fermee'`. L'identité déjà reliée à un autre compte revient en erreur dans l'adresse
 * (`identity_already_exists`, src/app/fournisseurs.ts).
 */
export async function lierSociale(db: Db, fournisseur: Fournisseur, retour: string): Promise<Result<null> | EchecLiaison> {
  const { error } = await db.auth.linkIdentity({ provider: fournisseur, options: { redirectTo: retour } });
  if (!error) return { ok: true, value: null };
  if ((error as ErreurAuth).code === 'manual_linking_disabled') return { ok: false, error: t('compte.moyens.ferme'), raison: 'fermee' };
  return { ok: false, error: t('connexion.sociale.erreur', { nom: NOM_FOURNISSEUR[fournisseur] }) };
}

/** Un moyen de connexion du compte : `email` (code par e-mail) ou un fournisseur. */
export interface MoyenCompte { identite: UserIdentity; moyen: 'email' | Fournisseur | 'autre'; email: string | null }

/** Moyens de connexion du compte connecté (identités Supabase), e-mail d'abord puis dans l'ordre des boutons. */
export async function moyensDuCompte(db: Db): Promise<Result<MoyenCompte[]>> {
  const { data, error } = await db.auth.getUserIdentities();
  if (error || !data) return { ok: false, error: t('compte.moyens.erreur') };
  const rang = (m: MoyenCompte['moyen']) => m === 'email' ? -1 : m === 'autre' ? 99 : ORDRE_FOURNISSEURS.indexOf(m);
  return { ok: true, value: data.identities.map(identite => {
    const p = identite.provider;
    const moyen: MoyenCompte['moyen'] = p === 'email' ? 'email' : estFournisseur(p) ? p : 'autre';
    const e = identite.identity_data?.email;
    return { identite, moyen, email: typeof e === 'string' ? e : null };
  }).sort((a, b) => rang(a.moyen) - rang(b.moyen)) };
}

/** Retire un moyen (`unlinkIdentity`). Supabase refuse de retirer le dernier : il en faut toujours un. */
export async function retirerMoyen(db: Db, identite: UserIdentity): Promise<Result<null>> {
  const { error } = await db.auth.unlinkIdentity(identite);
  if (!error) return { ok: true, value: null };
  const code = (error as ErreurAuth).code;
  if (code === 'single_identity_not_deletable') return { ok: false, error: t('compte.moyens.dernier') };
  if (code === 'email_conflict_identity_not_deletable') return { ok: false, error: t('compte.moyens.conflit') };
  if (code === 'manual_linking_disabled') return { ok: false, error: t('compte.moyens.ferme') };
  return { ok: false, error: t('compte.moyens.erreur') };
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

// Lecture du profil, de la série et des gels : dans ./lectureProfil.ts, lue par l'accueil sans le reste de ce fichier (#513).
export { fetchGels, fetchProfile, fetchStreak } from './lectureProfil';

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
