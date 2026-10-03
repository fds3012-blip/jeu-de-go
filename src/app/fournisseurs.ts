// Connexion sociale (#411, suite de #354) : Google, Apple, Facebook, à côté du code par e-mail.
// docs/growth/connexion-sociale.md (réglages pour Florian) ; docs/produit/benchmark-connexion.md (pourquoi ces trois).
// Module pur, léger (lu par App.tsx au chargement) : drapeaux, ordre, visibilité, lecture des erreurs de retour.
// - Un drapeau public par fournisseur : VITE_AUTH_GOOGLE, VITE_AUTH_APPLE, VITE_AUTH_FACEBOOK (« 1 » : montré).
//   Un fournisseur non réglé n'apparaît jamais. Builds de test : `e2e.google`, `e2e.apple`, `e2e.facebook` à « 1 ».
// - Même ordre sur tous les écrans : Google, Apple, Facebook (part d'usage en France), puis « ou », puis le code.
// - Cachés là où la redirection OAuth échoue : navigateurs intégrés (Messenger, Instagram, TikTok…) et app installée
//   sur iPhone (src/app/navigateurIntegre.ts). Le code par e-mail marche partout et reste toujours visible.
import type { ContexteNavigateur } from './navigateurIntegre';
import { t } from '../content/i18n';

export type Fournisseur = 'google' | 'apple' | 'facebook';

/** Ordre unique, sur tous les écrans de compte. */
export const ORDRE_FOURNISSEURS: readonly Fournisseur[] = ['google', 'apple', 'facebook'];

/** Noms de marque : jamais traduits. */
export const NOM_FOURNISSEUR: Readonly<Record<Fournisseur, string>> = { google: 'Google', apple: 'Apple', facebook: 'Facebook' };

const DRAPEAU: Readonly<Record<Fournisseur, 'VITE_AUTH_GOOGLE' | 'VITE_AUTH_APPLE' | 'VITE_AUTH_FACEBOOK'>> = {
  google: 'VITE_AUTH_GOOGLE', apple: 'VITE_AUTH_APPLE', facebook: 'VITE_AUTH_FACEBOOK',
};

export interface EnvAuth { VITE_AUTH_GOOGLE?: string; VITE_AUTH_APPLE?: string; VITE_AUTH_FACEBOOK?: string; VITE_E2E?: string }

export const estFournisseur = (v: unknown): v is Fournisseur => typeof v === 'string' && (ORDRE_FOURNISSEURS as readonly string[]).includes(v);

/** Fournisseurs réglés pour ce build, dans l'ordre d'affichage. */
export function fournisseursActifs(env: EnvAuth = import.meta.env, stockage: Pick<Storage, 'getItem'> | null = stockageLocal()): Fournisseur[] {
  return ORDRE_FOURNISSEURS.filter(f => {
    if (env[DRAPEAU[f]]?.trim() === '1') return true;
    if (!env.VITE_E2E || !stockage) return false;
    try { return stockage.getItem(`e2e.${f}`) === '1'; } catch { return false; }
  });
}

/** Fournisseurs montrés ici : réglés, et seulement dans un navigateur où la redirection revient dans le jeu. */
export function fournisseursVisibles(c: ContexteNavigateur, actifs: readonly Fournisseur[]): Fournisseur[] {
  if (c.integre || c.appIos) return [];
  return ORDRE_FOURNISSEURS.filter(f => actifs.includes(f));
}

/** « Google », « Google ou Apple », « Google, Apple ou Facebook » (`ou` : mot de la langue). */
export function listeNoms(fs: readonly Fournisseur[], ou: string): string {
  const noms = fs.map(f => NOM_FOURNISSEUR[f]);
  if (noms.length <= 1) return noms.join('');
  return `${noms.slice(0, -1).join(', ')} ${ou} ${noms[noms.length - 1]}`;
}

/**
 * Ce qui a mal tourné au retour du fournisseur (Supabase met l'erreur dans le fragment, parfois dans la requête) :
 * - `annule` : le joueur a fermé ou refusé (Google, Facebook : `access_denied` ; Apple : `user_cancelled_authorize`) ;
 * - `deja_lie` : ce compte Google (ou Apple, Facebook) est déjà relié à un AUTRE compte du jeu (`identity_already_exists`) ;
 * - `email_pris` : l'adresse a déjà un compte, créé avec un autre moyen, et Supabase refuse de les relier tout seul ;
 * - `email_a_confirmer` : le fournisseur n'a pas vérifié l'adresse ; Supabase envoie un e-mail de confirmation ;
 * - `liaison_fermee` : la liaison manuelle n'est pas activée dans Supabase (`manual_linking_disabled`) ;
 * - `erreur` : tout le reste.
 */
export type Incident = 'annule' | 'deja_lie' | 'email_pris' | 'email_a_confirmer' | 'liaison_fermee' | 'erreur';

export function incidentRetour(hash: string, search = ''): Incident | null {
  for (const brut of [hash.replace(/^#/, ''), search.replace(/^\?/, '')]) {
    const p = new URLSearchParams(brut);
    const e = p.get('error');
    const code = p.get('error_code') ?? '';
    const texte = (p.get('error_description') ?? '').toLowerCase();
    if (!e && !code) continue;
    if (e === 'access_denied' || e === 'user_cancelled_authorize' || code === 'access_denied') return 'annule';
    if (code === 'identity_already_exists' || texte.includes('already linked to another user')) return 'deja_lie';
    if (code === 'email_exists' || code === 'user_already_exists' || texte.includes('email address already')) return 'email_pris';
    if (code === 'provider_email_needs_verification') return 'email_a_confirmer';
    if (code === 'manual_linking_disabled') return 'liaison_fermee';
    return 'erreur';
  }
  return null;
}

/** Phrase montrée au retour d'un fournisseur en échec (hors `deja_lie`, qui a son encadré). */
export function messageIncident(i: Exclude<Incident, 'deja_lie'>, f: Fournisseur): string {
  const nom = NOM_FOURNISSEUR[f];
  switch (i) {
    case 'annule': return t('connexion.sociale.annule');
    case 'email_pris': return t('connexion.sociale.emailPris', { nom });
    case 'email_a_confirmer': return t('connexion.sociale.emailAConfirmer', { nom });
    case 'liaison_fermee': return t('compte.moyens.ferme');
    default: return t('connexion.sociale.erreur', { nom });
  }
}

function stockageLocal(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}
