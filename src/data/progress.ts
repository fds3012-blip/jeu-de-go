// Progression des leçons : localStorage sans compte, table `lesson_progress` avec un compte.
// À la connexion, la progression locale et celle de la base sont fusionnées (on garde le maximum).
import type { Db } from './supabase';
import type { Result } from './account';

/** Nombre d'étapes faites par leçon. */
export type Progress = Record<string, number>;

const LESSON_ID = /^[a-z0-9_-]{1,32}$/;

/** Borne comme la base : entier entre 0 et 100. */
export function clampSteps(n: unknown): number | null {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.floor(n)));
}

/** Nettoie une progression lue (localStorage ou base) : identifiants valides et valeurs bornées. */
export function cleanProgress(raw: unknown): Progress {
  const out: Progress = {};
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out;
  for (const [id, v] of Object.entries(raw)) {
    const n = clampSteps(v);
    if (LESSON_ID.test(id) && n !== null) out[id] = n;
  }
  return out;
}

/** Fusionne deux progressions : pour chaque leçon, on garde le plus grand nombre d'étapes. */
export function mergeProgress(a: Progress, b: Progress): Progress {
  const out = cleanProgress(a);
  for (const [id, n] of Object.entries(cleanProgress(b))) out[id] = Math.max(out[id] ?? 0, n);
  return out;
}

/** Lignes à écrire en base : les leçons où la progression fusionnée dépasse celle de la base. */
export function pendingRows(merged: Progress, remote: Progress): { lesson_id: string; steps_done: number }[] {
  return Object.entries(cleanProgress(merged))
    .filter(([id, n]) => n > (remote[id] ?? 0))
    .map(([lesson_id, steps_done]) => ({ lesson_id, steps_done }));
}

export interface ProgressStore {
  load(): Promise<Result<Progress>>;
  save(rows: { lesson_id: string; steps_done: number }[]): Promise<Result<null>>;
}

/**
 * Synchronise à la connexion : lit la base, fusionne avec la progression locale et écrit ce qui manque en base.
 * Renvoie la progression fusionnée. Si l'écriture échoue, la fusion est quand même renvoyée (elle reste
 * dans localStorage et sera renvoyée à la prochaine synchronisation).
 */
export async function syncProgress(local: Progress, store: ProgressStore): Promise<Result<Progress> & { saved?: boolean }> {
  const remote = await store.load();
  if (!remote.ok) return remote;
  const merged = mergeProgress(local, remote.value);
  const rows = pendingRows(merged, remote.value);
  if (!rows.length) return { ok: true, value: merged, saved: true };
  const w = await store.save(rows);
  return { ok: true, value: merged, saved: w.ok };
}

/** Accès à `lesson_progress` pour le joueur connecté (RLS : chacun ne voit et n'écrit que sa ligne). */
export function supabaseProgressStore(db: Db, userId: string): ProgressStore {
  return {
    async load() {
      const { data, error } = await db.from('lesson_progress').select('lesson_id, steps_done').eq('user_id', userId);
      if (error) return { ok: false, error: 'Impossible de charger ta progression.' };
      return { ok: true, value: cleanProgress(Object.fromEntries(data.map(r => [r.lesson_id, r.steps_done]))) };
    },
    async save(rows) {
      const now = new Date().toISOString();
      const { error } = await db.from('lesson_progress')
        .upsert(rows.map(r => ({ ...r, user_id: userId, updated_at: now })), { onConflict: 'user_id,lesson_id' });
      if (error) return { ok: false, error: 'Progression non enregistrée.' };
      return { ok: true, value: null };
    }
  };
}
