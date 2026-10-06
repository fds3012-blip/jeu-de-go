// « Mes statistiques » (#368) : lectures Supabase, toutes sous RLS, aucune écriture.
// - `rating_history` : le joueur ne lit que ses lignes (« Chacun voit son historique »). Seuls les types `game` et
//   `depart` sont lus : jamais `puzzle` (décision #137, aucune cote de problème affichée).
// - `games` : taille des parties classées, lisible par leurs deux joueurs.
// Pas de migration : tout existe depuis #417 (supabase/migrations/20261004120100_cote_glicko.sql).
import type { Result } from './account';
import type { Db } from './supabase';
import type { PartieClassee, PointCote } from '../app/statsJoueur';

/** Fenêtre de la courbe de « Mes statistiques » (la carte « Ta cote » montre 30 jours). */
export const JOURS_STATS = 90;
/** Lignes lues au plus : une partie classée par ligne, largement assez pour 90 jours. */
const MAX_LIGNES = 500;

export interface DonneesCote {
  /** Cote actuelle et provisoire ou non ; `null` si le profil n'a pas de cote lisible. */
  cote: { cote: number; provisoire: boolean } | null;
  /** Points de la courbe sur 90 jours, du plus ancien au plus récent. */
  courbe: PointCote[];
  /** Parties classées comptées (toutes dates), pour le bilan « En ligne, classées ». */
  classees: PartieClassee[];
}

interface LigneHistorique { rating: unknown; created_at: unknown; kind: unknown; ecart: unknown; game_id: unknown }

/** Convertit les lignes lues ; pure, testée. `tailles` : taille de chaque partie, par identifiant. */
export function lireDonneesCote(
  profil: { rating?: unknown; cote_provisoire?: unknown } | null,
  lignes: readonly LigneHistorique[],
  tailles: ReadonlyMap<string, number>,
  depuis: number,
): DonneesCote {
  const cote = profil && typeof profil.rating === 'number' ? { cote: profil.rating, provisoire: profil.cote_provisoire !== false } : null;
  const courbe: PointCote[] = [];
  const classees: PartieClassee[] = [];
  for (const l of lignes) {
    if (typeof l.rating !== 'number' || typeof l.created_at !== 'string') continue;
    if (l.kind !== 'game' && l.kind !== 'depart') continue;
    if (Date.parse(l.created_at) >= depuis) courbe.push({ le: l.created_at, cote: l.rating });
    if (l.kind === 'game' && typeof l.ecart === 'number' && l.ecart !== 0) {
      classees.push({ taille: typeof l.game_id === 'string' ? tailles.get(l.game_id) ?? null : null, gagnee: l.ecart > 0 });
    }
  }
  courbe.sort((a, b) => Date.parse(a.le) - Date.parse(b.le));
  return { cote, courbe, classees };
}

/** Cote, courbe de 90 jours et parties classées du joueur connecté. */
export async function chargerDonneesCote(db: Db, userId: string, maintenant = Date.now()): Promise<Result<DonneesCote>> {
  const [p, h] = await Promise.all([
    db.from('profiles').select('rating, cote_provisoire').eq('id', userId).maybeSingle(),
    db.from('rating_history').select('rating, created_at, kind, ecart, game_id').eq('user_id', userId).in('kind', ['game', 'depart'])
      .order('created_at', { ascending: false }).limit(MAX_LIGNES),
  ]);
  if (p.error || h.error) return { ok: false, error: (p.error ?? h.error)?.message ?? 'lecture' };
  const lignes = (h.data ?? []) as LigneHistorique[];
  const ids = [...new Set(lignes.flatMap(l => (l.kind === 'game' && typeof l.game_id === 'string' ? [l.game_id] : [])))];
  const tailles = new Map<string, number>();
  if (ids.length) {
    const g = await db.from('games').select('id, size').in('id', ids);
    // Sans les tailles, le bilan par mode reste juste : seules les lignes par taille manquent ces parties.
    if (!g.error) for (const x of g.data ?? []) if (typeof x.size === 'number') tailles.set(x.id, x.size);
  }
  return { ok: true, value: lireDonneesCote(p.data, lignes, tailles, maintenant - JOURS_STATS * 864e5) };
}
