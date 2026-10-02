// Notifications dans l'app (issue #367, partie serveur). La table `notifications` est écrite par le serveur seul
// (déclencheurs sur les défis et les demandes d'ami, migration 20261002200100_notifications.sql) ; chaque joueur lit
// les siennes (RLS) et les marque lues par `marquer_notifications_lues`. Purge à 30 jours (pg_cron).
//
// Rôle côté app :
// - signal en temps réel : le client écoute SA file (filtre `destinataire_id`, et la RLS refuse de toute façon
//   les lignes d'un autre). Il n'écoute plus toute la table `games`, que la RLS ouvre aux parties publiques de tous ;
// - « déjà vu » : une notification en attente allume la pastille ; ouvrir la partie la marque lue (src/data/defi.ts).
import type { Result } from './account';
import type { Db } from './supabase';

export const TYPES_NOTIFICATION = ['tour', 'comptage', 'fin', 'ami'] as const;
export type TypeNotification = (typeof TYPES_NOTIFICATION)[number];

export interface NotificationEnAttente {
  id: number;
  type: TypeNotification;
  /** Partie visée (défi), null pour une demande d'ami. */
  partieId: string | null;
  creeeLe: string;
}

/** Au-delà, ce n'est plus une liste qu'on lit : le serveur en garde de toute façon une seule par partie et par type. */
export const MAX_LUES = 50;

const estType = (x: unknown): x is TypeNotification => (TYPES_NOTIFICATION as readonly unknown[]).includes(x);

/** Notifications en attente (non lues) du joueur, la plus récente d'abord. */
export async function notificationsEnAttente(db: Db, userId: string): Promise<Result<NotificationEnAttente[]>> {
  const { data, error } = await db.from('notifications').select('id, type, partie_id, creee_le')
    .eq('destinataire_id', userId).is('lue_le', null).order('creee_le', { ascending: false }).limit(MAX_LUES);
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    value: (data ?? []).flatMap(n => estType(n.type) ? [{ id: n.id, type: n.type, partieId: n.partie_id, creeeLe: n.creee_le }] : []),
  };
}

/** Parties qui ont une notification en attente (tour ou comptage) : ce que le joueur n'a pas encore vu. */
export function partiesNonVues(liste: readonly NotificationEnAttente[]): Set<string> {
  return new Set(liste.flatMap(n => (n.type === 'tour' || n.type === 'comptage') && n.partieId ? [n.partieId] : []));
}

/**
 * Marque lues les notifications du joueur : celles d'une partie (ouverte), d'un type (liste des amis), ou toutes.
 * Renvoie le nombre de lignes marquées.
 */
export async function marquerLues(db: Db, cible: { partieId?: string; type?: TypeNotification } = {}): Promise<Result<number>> {
  // Un argument absent (undefined, retiré du JSON) prend la valeur par défaut du serveur : null, « toutes ».
  const { data, error } = await db.rpc('marquer_notifications_lues', { p_partie: cible.partieId, p_type: cible.type });
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: data ?? 0 };
}

/**
 * Écoute les notifications du joueur en temps réel (création, rafraîchissement, lecture sur un autre appareil).
 * `onChange` est appelé à chaque changement. Renvoie la fonction qui arrête l'écoute.
 */
export function ecouterNotifications(db: Db, userId: string, onChange: () => void): () => void {
  const canal = db.channel(`notifications-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `destinataire_id=eq.${userId}` }, onChange)
    .subscribe();
  return () => { void db.removeChannel(canal); };
}
