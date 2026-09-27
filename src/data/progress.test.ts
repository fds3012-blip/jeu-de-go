import { cleanProgress, mergeProgress, pendingRows, syncProgress, type Progress, type ProgressStore } from './progress';

function fakeStore(remote: Progress, opts: { loadFails?: boolean; saveFails?: boolean } = {}) {
  const saved: { lesson_id: string; steps_done: number }[][] = [];
  const store: ProgressStore = {
    load: async () => (opts.loadFails ? { ok: false, error: 'x' } : { ok: true, value: remote }),
    save: async rows => { saved.push(rows); return opts.saveFails ? { ok: false, error: 'x' } : { ok: true, value: null }; }
  };
  return { store, saved };
}

describe('fusion de la progression des leçons', () => {
  it('garde le maximum par leçon', () => {
    expect(mergeProgress({ l1: 5, l2: 1 }, { l1: 3, l3: 2 })).toEqual({ l1: 5, l2: 1, l3: 2 });
  });

  it('nettoie les valeurs invalides', () => {
    expect(cleanProgress({ l1: 4.7, l2: -3, l3: 500, 'Mauvais id': 2, l4: 'x', l5: NaN })).toEqual({ l1: 4, l2: 0, l3: 100 });
    expect(cleanProgress(null)).toEqual({});
    expect(cleanProgress([1, 2])).toEqual({});
  });

  it('n’envoie que ce qui dépasse la base', () => {
    expect(pendingRows({ l1: 5, l2: 2, l3: 0 }, { l1: 5, l2: 1 })).toEqual([{ lesson_id: 'l2', steps_done: 2 }]);
  });
});

describe('synchronisation à la connexion', () => {
  it('envoie la progression locale plus avancée et renvoie la fusion', async () => {
    const { store, saved } = fakeStore({ l1: 2, l2: 4 });
    const r = await syncProgress({ l1: 5 }, store);
    expect(r).toEqual({ ok: true, value: { l1: 5, l2: 4 }, saved: true });
    expect(saved).toEqual([[{ lesson_id: 'l1', steps_done: 5 }]]);
  });

  it('n’écrit rien si la base est à jour', async () => {
    const { store, saved } = fakeStore({ l1: 5 });
    const r = await syncProgress({ l1: 3 }, store);
    expect(r.ok && r.value).toEqual({ l1: 5 });
    expect(saved).toEqual([]);
  });

  it('garde la fusion si l’écriture échoue', async () => {
    const { store } = fakeStore({}, { saveFails: true });
    expect(await syncProgress({ l1: 2 }, store)).toEqual({ ok: true, value: { l1: 2 }, saved: false });
  });

  it('signale l’échec de lecture', async () => {
    const { store } = fakeStore({}, { loadFails: true });
    expect((await syncProgress({ l1: 2 }, store)).ok).toBe(false);
  });
});
