// Pseudos des adversaires (#400) : « Mes parties », la liste « Tes parties » des défis et « À faire » nomment l'ami au
// lieu de « Ton ami ». Lecture sous la RLS existante (profils visibles par tous, migration des profils) : une seule
// requête pour toute la liste (`in`), jamais une par ligne. Module à part de defi.ts, qui est dans le JS initial :
// celui-ci n'est chargé qu'avec les écrans qui l'utilisent.
import type { Db } from './supabase';

/** Pseudos déjà lus, d'une lecture à l'autre : id du joueur → pseudo, ou null (pas de pseudo, ou lecture ratée). */
export type Pseudos = Map<string, string | null>;

/** Plus d'identifiants par requête : l'adresse reste courte (20 défis au plus par liste, voir mesDefis). */
const PAR_REQUETE = 50;

/**
 * Lit en une requête les pseudos des `ids` pas encore dans `cache`, et les y range. Un échec de lecture n'est pas
 * gardé : la prochaine lecture réessaie, et l'écran dit « Ton ami » en attendant. Renvoie le cache complété.
 */
export async function lirePseudos(db: Db, ids: Iterable<string | null | undefined>, cache: Pseudos = new Map()): Promise<Pseudos> {
  const inconnus = [...new Set([...ids].filter((id): id is string => !!id && !cache.has(id)))].slice(0, PAR_REQUETE);
  if (!inconnus.length) return cache;
  const { data, error } = await db.from('profiles').select('id, username').in('id', inconnus);
  if (error) return cache;
  for (const id of inconnus) cache.set(id, data?.find(x => x.id === id)?.username || null);
  return cache;
}

/** L'adversaire de `userId` dans une partie à deux joueurs, ou null (place encore libre, ou joueur absent). */
export function adversaireDe(partie: { black_id: string | null; white_id: string | null }, userId: string): string | null {
  if (partie.black_id === userId) return partie.white_id;
  if (partie.white_id === userId) return partie.black_id;
  return null;
}
