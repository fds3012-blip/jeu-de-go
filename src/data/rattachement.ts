// Rattacher une session sans compte (ancien défi par lien) au compte connecté (suite de #343, #353, #354).
// Serveur : migration 20261002001100_rattacher_session_anonyme.sql (le raisonnement sur le risque y est écrit).
//
// Pourquoi un code : l'identifiant d'une session anonyme n'est pas secret (l'adversaire le lit). La seule preuve que
// l'appelant contrôlait la session anonyme est un code tiré PENDANT que cette session est valide, puis présenté par
// le vrai compte. Le code (32 caractères, 15 minutes, usage unique) ne quitte l'appareil que vers notre serveur.
//
// Branchement attendu (front, pas fait ici), dans l'écran de compte quand `estAnonyme(session)` :
// 1. avant « J'ai déjà un compte » (`envoyerCodeConnexion`) et avant « Continuer avec Google » (`connexionGoogle`) :
//    `const code = await preparerRattachement(db); if (code.ok) garderCodeRattachement(code.value);`
//    (le stockage de session survit à l'aller-retour chez Google dans le même onglet) ;
// 2. quand la nouvelle session d'un VRAI compte arrive (`onAuthStateChange`, utilisateur non anonyme) :
//    `const code = lireCodeRattachement(); if (code) { await rattacherSessionAnonyme(db, code); oublierCodeRattachement(); }`
//    puis recharger les parties : les défis en cours suivent (même jeton, même date limite).
// Le chemin « e-mail neuf relié à la session anonyme » (`verifierCode` type `email_change`) garde le même identifiant :
// aucun rattachement n'est nécessaire, et le serveur refuse alors le code (rien à déplacer).
import type { Result } from './account';
import type { Db } from './supabase';
import { t } from '../content/i18n';

/** Forme du code tiré par le serveur (24 octets aléatoires en base64url). */
export const FORMAT_CODE_RATTACHEMENT = /^[A-Za-z0-9_-]{32}$/;

/** Clé du stockage de session : code et heure du tirage, effacés à la fermeture de l'onglet ou après usage. */
export const CLE_RATTACHEMENT = 'go.rattachement.v1';

/** Durée de validité côté serveur (15 minutes) ; au-delà le code n'est plus présenté. */
export const DUREE_CODE_MS = 15 * 60 * 1000;

interface CodeGarde { code: string; le: number }

/** À appeler en session ANONYME, juste avant de passer au compte : tire le code à présenter ensuite. */
export async function preparerRattachement(db: Db): Promise<Result<string>> {
  const { data, error } = await db.rpc('preparer_rattachement');
  if (error || typeof data !== 'string' || !FORMAT_CODE_RATTACHEMENT.test(data)) return { ok: false, error: t('erreur.serveur') };
  return { ok: true, value: data };
}

/**
 * À appeler avec la session du VRAI compte : les parties et défis de la session anonyme passent au compte.
 * Renvoie le nombre de parties déplacées (0 si la session anonyme n'avait rien).
 */
export async function rattacherSessionAnonyme(db: Db, code: string): Promise<Result<number>> {
  if (!FORMAT_CODE_RATTACHEMENT.test(code)) return { ok: false, error: t('erreur.serveur') };
  const { data, error } = await db.rpc('rattacher_session_anonyme', { p_code: code });
  if (error) return { ok: false, error: t('erreur.serveur') };
  return { ok: true, value: typeof data === 'number' ? data : 0 };
}

/**
 * Au retour sur le vrai compte : présente le code gardé, s'il y en a un. #474 : le code n'est oublié qu'après un
 * rattachement réussi. Avant, il était effacé AVANT l'appel : un réseau coupé à ce moment-là, et les parties de la
 * session sans compte ne rejoignaient jamais le compte. En cas d'échec, le prochain chargement réessaie
 * (le code reste valable 15 minutes). `null` : aucun code à présenter.
 */
export async function rattacherCodeGarde(db: Db, stockage: Storage | null = stockageSession()): Promise<Result<number> | null> {
  const code = lireCodeRattachement(stockage);
  if (!code) return null;
  const r = await rattacherSessionAnonyme(db, code);
  if (r.ok) oublierCodeRattachement(stockage);
  return r;
}

/** Garde le code sur l'appareil le temps de créer ou retrouver le compte (stockage de session, jamais localStorage). */
export function garderCodeRattachement(code: string, stockage: Storage | null = stockageSession(), maintenant = Date.now()): void {
  if (!stockage || !FORMAT_CODE_RATTACHEMENT.test(code)) return;
  try { stockage.setItem(CLE_RATTACHEMENT, JSON.stringify({ code, le: maintenant } satisfies CodeGarde)); } catch { /* stockage plein ou interdit */ }
}

/** Code gardé s'il est encore valide (moins de 15 minutes) ; null sinon (et l'entrée périmée est effacée). */
export function lireCodeRattachement(stockage: Storage | null = stockageSession(), maintenant = Date.now()): string | null {
  if (!stockage) return null;
  try {
    const brut = stockage.getItem(CLE_RATTACHEMENT);
    if (!brut) return null;
    const garde = JSON.parse(brut) as Partial<CodeGarde>;
    if (typeof garde.code === 'string' && FORMAT_CODE_RATTACHEMENT.test(garde.code)
        && typeof garde.le === 'number' && maintenant - garde.le >= 0 && maintenant - garde.le < DUREE_CODE_MS) {
      return garde.code;
    }
    stockage.removeItem(CLE_RATTACHEMENT);
  } catch { /* contenu illisible */ }
  return null;
}

/** Efface le code (après usage, ou si le joueur renonce). */
export function oublierCodeRattachement(stockage: Storage | null = stockageSession()): void {
  try { stockage?.removeItem(CLE_RATTACHEMENT); } catch { /* rien à faire */ }
}

function stockageSession(): Storage | null {
  try { return typeof sessionStorage === 'undefined' ? null : sessionStorage; } catch { return null; }
}
