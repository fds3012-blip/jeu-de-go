// Partager l'app elle-même (#521). Logique pure, sans React : le lien selon la langue, et la règle de l'invitation
// discrète aux moments forts (victoire, leçon finie, record).
// - Le lien est l'adresse publique (https://mochi-go.app, ou /en en anglais) : sa page a un aperçu riche (#489).
// - L'invitation n'est qu'une action secondaire, sur un écran de fin : jamais pendant une partie, jamais avant la
//   2e partie finie ni dans la première minute de la visite, au plus une fois par semaine sur l'appareil.
// - L'entrée « Partager Mochi Go » du Profil, elle, est toujours là.
import type { Langue } from '../content/i18n';

/** Adresse publique du jeu (même que `SITE` de partage.ts, sans charger ce module). */
export const SITE_APP = 'https://mochi-go.app';

/** Repère de la dernière invitation montrée sur l'appareil (horodatage en ms). */
export const INVITATION_APP_KEY = 'go.invitation-app.v1';
/** Une invitation au plus par semaine. */
export const DELAI_INVITATION_MS = 7 * 24 * 60 * 60 * 1000;
/** Jamais avant la 2e partie finie. */
export const PARTIES_AVANT_INVITATION = 2;
/** Jamais dans la première minute de la visite. */
export const SECONDES_AVANT_INVITATION = 60;

export type DepuisPartage = 'profil' | 'victoire' | 'lecon' | 'record';
export type MomentFort = Exclude<DepuisPartage, 'profil'>;

/** Lien partagé : la page d'accueil, en anglais pour un joueur en anglais. */
export function lienApp(l: Langue): string {
  return l === 'en' ? `${SITE_APP}/en` : SITE_APP;
}

export interface ContexteInvitation {
  /** Parties terminées sur l'appareil (`go.parties.v1`). */
  partiesFinies: number;
  /** Secondes depuis l'ouverture de la page. */
  secondes: number;
  /** Dernière invitation montrée (ms), ou null. */
  derniere: number | null;
  maintenant: number;
  /** Une partie est en cours : jamais d'invitation. */
  enPartie: boolean;
}

/** L'invitation peut-elle se montrer ? */
export function doitInviter(c: ContexteInvitation): boolean {
  if (c.enPartie) return false;
  if (!(c.partiesFinies >= PARTIES_AVANT_INVITATION)) return false;
  if (!(c.secondes >= SECONDES_AVANT_INVITATION)) return false;
  if (c.derniere === null) return true;
  // Repère loin dans le futur (horloge reculée) : on ne bloque pas l'invitation pour des mois.
  if (c.derniere - c.maintenant > DELAI_INVITATION_MS) return true;
  return c.maintenant - c.derniere >= DELAI_INVITATION_MS;
}

/** Relit le repère stocké, en tolérant une valeur abîmée. */
export function lireDerniere(brut: unknown): number | null {
  return typeof brut === 'number' && Number.isFinite(brut) && brut > 0 ? brut : null;
}
