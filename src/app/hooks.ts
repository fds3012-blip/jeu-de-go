import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Db } from '../data/supabase';
import { cleanProgress, mergeProgress, supabaseProgressStore, syncProgress, type Progress } from '../data/progress';

/** Session Supabase : undefined pendant le chargement, null sans connexion. */
export function useSession(db: Db | null): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(db ? undefined : null);
  useEffect(() => {
    if (!db) return;
    let alive = true;
    db.auth.getSession().then(({ data }) => { if (alive) setSession(data.session); }, () => { if (alive) setSession(null); });
    const { data } = db.auth.onAuthStateChange((_e, s) => { if (alive) setSession(s); });
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, [db]);
  return session;
}

/** Vrai quand le navigateur a du réseau. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const up = () => setOnline(true), down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);
  return online;
}

export function readLocal<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}
export function writeLocal(key: string, v: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* stockage indisponible */ }
}

const LESSONS_KEY = 'go.lecons.v1';
export type SyncState = 'local' | 'sync' | 'ok' | 'error';

/**
 * Progression des leçons. Toujours gardée dans localStorage ; avec un compte, fusionnée avec la base
 * à la connexion puis écrite en base à chaque étape.
 */
export function useLessonProgress(db: Db | null, userId: string | undefined): { progress: Progress; state: SyncState; record: (id: string, steps: number) => void } {
  const [progress, setProgress] = useState<Progress>(() => cleanProgress(readLocal(LESSONS_KEY, {})));
  const [state, setState] = useState<SyncState>('local');
  const ref = useRef(progress);

  const apply = useCallback((p: Progress) => { ref.current = p; setProgress(p); writeLocal(LESSONS_KEY, p); }, []);

  useEffect(() => {
    if (!db || !userId) { setState('local'); return; }
    let alive = true;
    setState('sync');
    syncProgress(ref.current, supabaseProgressStore(db, userId)).then(r => {
      if (!alive) return;
      if (r.ok) { apply(mergeProgress(ref.current, r.value)); setState(r.saved ? 'ok' : 'error'); } else setState('error');
    });
    return () => { alive = false; };
  }, [db, userId, apply]);

  const record = useCallback((id: string, steps: number) => {
    const prev = ref.current[id] ?? 0;
    if (steps <= prev) return;
    apply(mergeProgress(ref.current, { [id]: steps }));
    if (db && userId) {
      supabaseProgressStore(db, userId).save([{ lesson_id: id, steps_done: steps }])
        .then(r => setState(r.ok ? 'ok' : 'error'));
    }
  }, [db, userId, apply]);

  return { progress, state, record };
}

/** Vrai si l'utilisateur demande moins d'animations. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
