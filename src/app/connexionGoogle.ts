// « Continuer avec Google » (#354, docs/growth/connexion-google-apple.md, phase 1 : redirection).
// - Activation : variable publique VITE_AUTH_GOOGLE=1 (absente : rien n'apparaît). Build de test : `e2e.google`.
// - Avant de partir chez Google, la page garde dans l'onglet (sessionStorage) ce que le joueur voulait faire :
//   la raison de « Crée ton compte » et l'action à reprendre, le défi ouvert par lien, ou le Profil. Au retour (même
//   onglet), l'app relit puis efface cette note : le pseudo est demandé s'il manque, puis l'action reprend.
// - Google annulé ou en erreur : il revient avec `#error=…` ; l'écran de compte se rouvre avec une phrase claire.
import { t } from '../content/i18n';

/** Note gardée dans l'onglet le temps de l'aller-retour chez Google. */
export const RETOUR_CONNEXION_KEY = 'go.retour-connexion.v1';
/** Au-delà, la note est ignorée (le joueur est revenu bien plus tard, par un autre chemin). */
export const RETOUR_MAX_MS = 30 * 60 * 1000;

export interface DefiEnAttente { jeton: string; inviteur: string | null }
export interface RetourConnexion {
  /** Raison de l'écran « Crée ton compte » ouvert, et action à reprendre (forme de `Reprise` dans App.tsx). */
  raison: string | null;
  reprise: { quoi: string; [cle: string]: unknown } | null;
  /** Défi ouvert par un lien : il sera rejoint une fois le compte complet. */
  defi: DefiEnAttente | null;
  /** Connexion lancée depuis Profil → Mon compte. */
  profil: boolean;
}

/** Google est-il activé pour ce build ? */
export function googleActive(env: { VITE_AUTH_GOOGLE?: string; VITE_E2E?: string } = import.meta.env): boolean {
  if (env.VITE_AUTH_GOOGLE?.trim() === '1') return true;
  if (!env.VITE_E2E) return false;
  try { return localStorage.getItem('e2e.google') === '1'; } catch { return false; }
}

let courant: RetourConnexion = { raison: null, reprise: null, defi: null, profil: false };
/** L'app dit, à chaque changement d'écran, où revenir si le joueur part chez Google. */
export function definirRetour(r: RetourConnexion): void { courant = r; }

/** Écrit la note juste avant de partir chez Google. */
export function garderRetour(stockage: Pick<Storage, 'setItem'> | null = sessionStorageSur(), maintenant = Date.now()): void {
  try { stockage?.setItem(RETOUR_CONNEXION_KEY, JSON.stringify({ ...courant, quand: maintenant })); } catch { /* pas de stockage : retour à l'accueil */ }
}

/** Lit une note (validée) ; null si absente, abîmée ou trop vieille. */
export function lireRetour(brut: string | null, maintenant = Date.now()): RetourConnexion | null {
  if (!brut) return null;
  try {
    const o = JSON.parse(brut) as Record<string, unknown>;
    if (typeof o !== 'object' || !o || typeof o.quand !== 'number' || maintenant - o.quand > RETOUR_MAX_MS || o.quand > maintenant + 60_000) return null;
    const reprise = o.reprise && typeof o.reprise === 'object' && typeof (o.reprise as { quoi?: unknown }).quoi === 'string'
      ? o.reprise as RetourConnexion['reprise'] : null;
    const d = o.defi as Partial<DefiEnAttente> | null | undefined;
    const defi = d && typeof d === 'object' && typeof d.jeton === 'string' ? { jeton: d.jeton, inviteur: typeof d.inviteur === 'string' ? d.inviteur : null } : null;
    return { raison: typeof o.raison === 'string' ? o.raison : null, reprise, defi, profil: o.profil === true };
  } catch { return null; }
}

/** Lit puis efface la note (une seule fois, au chargement). */
export function prendreRetour(stockage: Pick<Storage, 'getItem' | 'removeItem'> | null = sessionStorageSur(), maintenant = Date.now()): RetourConnexion | null {
  if (!stockage) return null;
  try {
    const r = lireRetour(stockage.getItem(RETOUR_CONNEXION_KEY), maintenant);
    stockage.removeItem(RETOUR_CONNEXION_KEY);
    return r;
  } catch { return null; }
}

/**
 * Retour de Google en échec : `#error=access_denied` (le joueur a annulé) ou une autre erreur. Supabase renvoie
 * l'erreur dans le fragment (flux implicite), parfois dans la requête. Null si l'adresse ne porte pas d'erreur.
 */
export function erreurRetour(hash: string, search = ''): 'annule' | 'erreur' | null {
  for (const brut of [hash.replace(/^#/, ''), search.replace(/^\?/, '')]) {
    const p = new URLSearchParams(brut);
    const e = p.get('error');
    if (!e) continue;
    return e === 'access_denied' ? 'annule' : 'erreur';
  }
  return null;
}

/** Phrase à montrer sur l'écran de compte après un retour en échec. */
export const messageRetour = (e: 'annule' | 'erreur') => t(e === 'annule' ? 'connexion.google.annule' : 'connexion.google.erreur');

let messageEnAttente: string | null = null;
/** Message à montrer par le premier écran de connexion affiché (puis oublié). */
export function annoncerMessage(m: string | null): void { messageEnAttente = m; }
/** Lu au rendu sans l'effacer : un rendu abandonné par React (écran chargé à la demande) ne doit pas le perdre. */
export function lireMessage(): string | null { return messageEnAttente; }
/** Effacé une fois l'écran vraiment affiché (dans un effet). */
export function oublierMessage(): void { messageEnAttente = null; }

function sessionStorageSur(): Storage | null {
  try { return typeof sessionStorage === 'undefined' ? null : sessionStorage; } catch { return null; }
}
