import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from './supabase';

// Issue #469 : synchronisation de la file de révision espacée, côté appareil. Environnement Node : stockage en mémoire,
// fenêtre et document réduits à leurs écouteurs, serveur simulé avec la même règle que `echanger_revisions`.
const memoire = new Map<string, string>();
const ecouteurs = new Map<string, Set<() => void>>();
vi.stubGlobal('localStorage', { getItem: (k: string) => memoire.get(k) ?? null, setItem: (k: string, v: string) => { memoire.set(k, v); }, removeItem: (k: string) => { memoire.delete(k); } });
vi.stubGlobal('window', {
  addEventListener: (n: string, f: () => void) => { if (!ecouteurs.has(n)) ecouteurs.set(n, new Set()); ecouteurs.get(n)!.add(f); },
  removeEventListener: (n: string, f: () => void) => { ecouteurs.get(n)?.delete(f); },
  dispatchEvent: (e: { type: string }) => { ecouteurs.get(e.type)?.forEach(f => f()); return true; },
});
vi.stubGlobal('document', { visibilityState: 'visible', addEventListener: () => undefined, removeEventListener: () => undefined });

const R = await import('./revisions');
const { ERREURS_KEY, REVISIONS_KEY, EVENEMENT_REVISIONS } = await import('../app/revisionEspacee');
const { noterProblemeRate } = await import('../app/revisionsAppareil');

type Ligne = { cle: string; etape: number; prochain: string | null; echecs: number; maj: number; contenu?: unknown };
/** Serveur simulé : le plus récent gagne, ligne par ligne. `panne` : hors ligne. */
function faux(depart: Ligne[] = []) {
  const s = { stock: new Map(depart.map(l => [l.cle, l])), envois: [] as Ligne[][], panne: false };
  const db = {
    rpc: async (nom: string, args: { p_elements: Ligne[] }) => {
      expect(nom).toBe('echanger_revisions');
      if (s.panne) return { data: null, error: { message: 'Failed to fetch' } };
      s.envois.push(args.p_elements);
      for (const l of args.p_elements) { const a = s.stock.get(l.cle); if (!a || l.maj > a.maj) s.stock.set(l.cle, l); }
      return { data: [...s.stock.values()], error: null };
    },
  } as unknown as Db;
  return { s, db };
}

beforeEach(() => { memoire.clear(); });

describe('synchronisation de la révision espacée (#469)', () => {
  it('au démarrage : l’appareil envoie sa file et reçoit ce qui est plus récent', async () => {
    noterProblemeRate('b1', new Date(2026, 9, 7, 12));
    const { s, db } = faux([{ cle: 'pb:b2', etape: 2, prochain: '2026-10-14', echecs: 1, maj: 10 }]);
    const arreter = R.demarrerSynchroRevisions(db);
    await vi.waitFor(() => expect(s.envois).toHaveLength(1));
    await vi.waitFor(() => expect(JSON.parse(memoire.get(REVISIONS_KEY)!).problemes.b2).toBeDefined());
    arreter();
    expect(s.envois[0].map(l => l.cle)).toEqual(['pb:b1']);
    expect(s.stock.has('pb:b1')).toBe(true);
  });

  it('après un essai, un envoi part 2 secondes plus tard ; hors ligne, rien ne casse', async () => {
    vi.useFakeTimers();
    try {
      const { s, db } = faux();
      const arreter = R.demarrerSynchroRevisions(db);
      await vi.advanceTimersByTimeAsync(10);
      expect(s.envois).toHaveLength(1);
      noterProblemeRate('b3');
      await vi.advanceTimersByTimeAsync(R.DELAI_ENVOI_MS - 100);
      expect(s.envois).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(200);
      expect(s.envois).toHaveLength(2);
      expect(s.envois[1].map(l => l.cle)).toContain('pb:b3');
      s.panne = true;
      window.dispatchEvent({ type: EVENEMENT_REVISIONS } as Event);
      await vi.advanceTimersByTimeAsync(R.DELAI_ENVOI_MS + 10);
      expect(JSON.parse(memoire.get(REVISIONS_KEY)!).problemes.b3).toBeDefined(); // la file locale reste
      arreter();
    } finally { vi.useRealTimers(); }
  });

  it('une erreur acquise sur un autre appareil quitte celui-ci', () => {
    memoire.set(ERREURS_KEY, JSON.stringify([{
      id: 'erreur-a', creeLe: '2026-10-01T10:00:00.000Z', prochain: '2026-10-08', rates: 1, reussites: 3, maj: 100,
      size: 9, rows: Array(9).fill('.........'), toPlay: 1, reponses: [40], joue: 0, coup: 3,
    }]));
    expect(R.appliquerServeur([{ cle: 'erreur-a', genre: 'erreur', etape: 5, prochain: null, echecs: 1, maj: 200, contenu: null }])).toBe(true);
    expect(JSON.parse(memoire.get(ERREURS_KEY)!)).toEqual([]);
    expect(JSON.parse(memoire.get(REVISIONS_KEY)!).acquises).toEqual({ 'erreur-a': 200 });
    expect(R.appliquerServeur([])).toBe(false);
  });
});
