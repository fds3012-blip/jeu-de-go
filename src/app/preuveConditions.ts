// Preuve de l'accord aux conditions (#583, décision D2 de docs/juridique/compte-obligatoire.md). Chargé à la demande :
// rien ici n'entre dans le JS initial.
//
// La case « J'ai 15 ans ou plus, ou un parent est d'accord. J'accepte les conditions… » est cochée là où un compte naît
// (code par e-mail, Google / Apple / Facebook, liaison d'une ancienne session sans compte). Le serveur garde la date et
// la version par `accepter_conditions` (src/data/conditions.ts). Pour qu'un réseau coupé ne perde pas l'accord :
// 1. la case cochée est notée sur l'appareil (`CLE_ACCORD`) au moment où la session du compte s'ouvre ;
// 2. à chaque ouverture connectée, `verifierPreuve` lit la version acceptée (`mon_profil`) : à jour, la note s'efface ;
//    sinon, si la note existe, l'accord est envoyé (et réessayé à la prochaine ouverture tant qu'il échoue) ;
// 3. sans note ni preuve (compte d'avant #583, ou conditions changées), l'app remontre la case une fois
//    (AccordConditions.tsx) ; tant qu'elle n'est pas cochée, le jeu en ligne reste fermé (côté client, App.tsx).
import type { Db } from '../data/supabase';
import { VERSION_CONDITIONS, accepterConditions, conditionsAJour } from '../data/conditions';

/** Accord donné sur cet appareil, pas encore gardé par le serveur. Valeur : `1` (session pas encore vue) ou l'identifiant du compte. */
export const CLE_ACCORD = 'go.conditions-a-envoyer.v1';

type Stockage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function stockageLocal(): Stockage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

/** Note l'accord (case cochée) pour le compte `userId`, ou pour la session qui s'ouvre (`1`). */
export function noterAccord(userId = '1', s = stockageLocal()): void {
  try { s?.setItem(CLE_ACCORD, userId); } catch { /* pas de stockage : l'accord est envoyé tout de suite, sans réessai */ }
}

export function oublierAccord(s = stockageLocal()): void {
  try { s?.removeItem(CLE_ACCORD); } catch { /* rien */ }
}

/** Code refusé : la note posée avant la vérification (`1`, sans compte) est retirée. */
export function annulerAccordProvisoire(s = stockageLocal()): void {
  try { if (s?.getItem(CLE_ACCORD) === '1') s.removeItem(CLE_ACCORD); } catch { /* rien */ }
}

/** Vrai si un accord attend d'être envoyé pour ce compte. */
export function accordEnAttente(userId: string, s = stockageLocal()): boolean {
  try {
    const v = s?.getItem(CLE_ACCORD);
    return v === '1' || v === userId;
  } catch { return false; }
}

/**
 * `ok` : le serveur a la preuve de la version en vigueur, ou l'accord donné ici est en route (réessai à la prochaine
 * ouverture) ; `demander` : remontrer la case ; `inconnu` : profil illisible (hors ligne) : on ne bloque rien.
 * `auRetour` : la note d'aller-retour d'un fournisseur dit que la case était cochée.
 */
export type EtatPreuve = 'ok' | 'demander' | 'inconnu';

export async function verifierPreuve(db: Db, userId: string, auRetour = false, s = stockageLocal()): Promise<EtatPreuve> {
  if (auRetour) noterAccord(userId, s);
  let version: string | null | undefined;
  try {
    const { data, error } = await db.rpc('mon_profil').select('conditions_version').maybeSingle();
    if (error || !data) return accordEnAttente(userId, s) ? envoyer(db, userId, s) : 'inconnu';
    version = data.conditions_version;
  } catch { return 'inconnu'; }
  if (conditionsAJour({ conditions_version: version ?? null })) { oublierAccord(s); return 'ok'; }
  return accordEnAttente(userId, s) ? envoyer(db, userId, s) : 'demander';
}

/** Envoie l'accord ; en cas d'échec, la note reste (liée à ce compte) et l'envoi sera refait à la prochaine ouverture. */
export async function envoyer(db: Db, userId: string, s = stockageLocal()): Promise<'ok'> {
  noterAccord(userId, s);
  try {
    const r = await accepterConditions(db, VERSION_CONDITIONS);
    if (r.ok) oublierAccord(s);
  } catch { /* réseau : réessai à la prochaine ouverture */ }
  return 'ok';
}
