// Défi par lien (#81) : lecture des liens et des sessions, sans Supabase. Module à part (#513) : l'accueil
// (src/app/App.tsx, hooks.ts, adresseDefi.ts) le lit dès le chargement initial ; ./defi.ts (RPC, temps réel) arrive
// avec les écrans de défi.
import type { Session } from '@supabase/supabase-js';

/** Jeton du lien : 24 octets aléatoires en base64url (32 caractères). */
export const FORMAT_JETON = /^[A-Za-z0-9_-]{32}$/;

/** Paramètre du fragment de l'adresse : `https://…/#defi=JETON`. */
export const PARAM_DEFI = 'defi';
/** Pseudo de qui invite, dans le fragment après le jeton : `#defi=JETON&de=Pseudo` (#343). */
export const PARAM_DE = 'de';
const FORMAT_PSEUDO = /^[A-Za-z0-9_-]{3,24}$/;

/**
 * Session d'un vrai compte ? Une session anonyme (ouverte pour un défi) compte comme « pas de compte » partout
 * ailleurs : pas de synchronisation des leçons, pas de cote, pas de pseudo (le serveur les refuse de toute façon).
 */
export const estAnonyme = (session: Session | null | undefined): boolean => session?.user.is_anonymous === true;

/** Identifiant du compte, ou undefined sans compte ou avec une session anonyme. */
export const compteDe = (session: Session | null | undefined): string | undefined =>
  session && !estAnonyme(session) ? session.user.id : undefined;

/**
 * Lien à partager, court (#364) : `https://mochi-go.app/defi#JETON&de=Pseudo` (`/en/defi#…` pour un joueur en
 * anglais). Le jeton reste dans le fragment (`#`) : il n'est envoyé ni au serveur web ni dans l'en-tête Referer.
 * La page `/defi` porte l'aperçu du défi (Open Graph, outils/apercus.ts) ; index.html remet l'adresse à la forme
 * `/#defi=JETON` avant tout le reste. `jetonDepuisLien` lit les deux formes.
 */
export function lienDefi(jeton: string, origine: string, pseudo?: string | null, langue: 'fr' | 'en' = 'fr'): string {
  const de = pseudo && FORMAT_PSEUDO.test(pseudo) ? `&${PARAM_DE}=${pseudo}` : '';
  return `${origine.replace(/\/+$/, '')}${langue === 'en' ? '/en' : ''}/${PARAM_DEFI}#${jeton}${de}`;
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

/** Jeton du défi lu dans le fragment de l'adresse (`#defi=JETON`), ou null. */
export function jetonDeLAdresse(hash: string): string | null {
  const brut = hash.replace(/^#/, '');
  return brut.startsWith(`${PARAM_DEFI}=`) ? jetonDepuisLien(brut) : null;
}
