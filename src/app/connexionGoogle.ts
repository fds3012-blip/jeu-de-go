// Aller-retour chez un fournisseur de connexion : Google (#354), Apple et Facebook (#411).
// - Avant de partir, la page garde dans l'onglet (sessionStorage) ce que le joueur voulait faire : la raison de
//   « Crée ton compte » et l'action à reprendre, le défi ouvert par lien, ou le Profil ; et quel fournisseur, pour
//   quoi faire (`connexion`, `liaison` d'une ancienne session sans compte, `ajout` d'un moyen depuis Mon compte).
//   Au retour (même onglet), l'app relit puis efface cette note : le pseudo est demandé s'il manque, puis l'action reprend.
// - Retour en échec (`#error=…`) : l'écran de compte se rouvre avec une phrase claire (src/app/fournisseurs.ts, `Incident`).
import { estFournisseur, type Fournisseur, type Incident } from './fournisseurs';

/** Note gardée dans l'onglet le temps de l'aller-retour. */
export const RETOUR_CONNEXION_KEY = 'go.retour-connexion.v1';
/** Au-delà, la note est ignorée (le joueur est revenu bien plus tard, par un autre chemin). */
export const RETOUR_MAX_MS = 30 * 60 * 1000;

export interface DefiEnAttente { jeton: string; inviteur: string | null }
/** `connexion` : se connecter ou créer un compte ; `liaison` : relier à la session sans compte ; `ajout` : Mon compte. */
export type ActionSociale = 'connexion' | 'liaison' | 'ajout';
export interface RetourConnexion {
  /** Raison de l'écran « Crée ton compte » ouvert, et action à reprendre (forme de `Reprise` dans App.tsx). */
  raison: string | null;
  reprise: { quoi: string; [cle: string]: unknown } | null;
  /** Défi ouvert par un lien : il sera rejoint une fois le compte complet. */
  defi: DefiEnAttente | null;
  /** Connexion lancée depuis Profil → Mon compte. */
  profil: boolean;
  /** Fournisseur choisi (null : note d'avant #411, c'était Google). */
  fournisseur?: Fournisseur | null;
  action?: ActionSociale;
}

let courant: RetourConnexion = { raison: null, reprise: null, defi: null, profil: false };
/** L'app dit, à chaque changement d'écran, où revenir si le joueur part chez un fournisseur. */
export function definirRetour(r: RetourConnexion): void { courant = r; }

/** Écrit la note juste avant de partir. */
export function garderRetour(stockage: Pick<Storage, 'setItem'> | null = sessionStorageSur(), maintenant = Date.now(),
  quoi: { fournisseur: Fournisseur; action: ActionSociale } = { fournisseur: 'google', action: 'connexion' }): void {
  try { stockage?.setItem(RETOUR_CONNEXION_KEY, JSON.stringify({ ...courant, ...quoi, quand: maintenant })); } catch { /* pas de stockage : retour à l'accueil */ }
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
    const action: ActionSociale = o.action === 'liaison' || o.action === 'ajout' ? o.action : 'connexion';
    return { raison: typeof o.raison === 'string' ? o.raison : null, reprise, defi, profil: o.profil === true,
      fournisseur: estFournisseur(o.fournisseur) ? o.fournisseur : 'google', action };
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

/** Ce que le premier écran de compte affiché doit dire au retour (échec, ou moyen ajouté depuis Mon compte). */
export interface Annonce { incident: Incident | null; fournisseur: Fournisseur; action: ActionSociale }

let annonce: Annonce | null = null;
/** Posée par App.tsx au chargement, lue par l'écran de compte (Connexion.tsx, Account.tsx). */
export function annoncer(a: Annonce | null): void { annonce = a; }
/** Lue au rendu sans l'effacer : un rendu abandonné par React (écran chargé à la demande) ne doit pas la perdre. */
export function lireAnnonce(): Annonce | null { return annonce; }
/** Effacée une fois l'écran vraiment affiché (dans un effet). */
export function oublierAnnonce(): void { annonce = null; }

/** Clé du code de rattachement (même valeur que CLE_RATTACHEMENT de src/data/rattachement.ts, vérifié par un test). */
export const CLE_RATTACHEMENT_ATTENTE = 'go.rattachement.v1';
/** Un code de rattachement attend-il (session sans compte passée à un compte existant, #355) ? Lu sans charger le module. */
export function aRattacher(stockage: Pick<Storage, 'getItem'> | null = sessionStorageSur()): boolean {
  try { return stockage?.getItem(CLE_RATTACHEMENT_ATTENTE) != null; } catch { return false; }
}

function sessionStorageSur(): Storage | null {
  try { return typeof sessionStorage === 'undefined' ? null : sessionStorage; } catch { return null; }
}
