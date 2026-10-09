import { newPosition, play, type Position } from '../../go/rules';
import { bestMove, OPPONENTS, analyze, ownership, setKataGo, type Analysis } from '../index';
import { chooseFromAnalysis, styleBonus } from './choose';
import { KataGoClient, type WorkerLike } from './client';
import { fakeNetBytes } from './fakeNet';
import { features } from './features';
import { CACHE_NAME, loadModelBytes, selectBackend, type TfBackendApi } from './loader';
import { TfNet, type Evaluator, type NetOutput } from './net';
import { gunzip, isGzip, parseNet } from './parse';
import { PV_MAX, search } from './search';
import type { KgRequest, KgResponse } from './worker';

const i9 = (x: number, y: number) => y * 9 + x;
function jouer(pos: Position, coups: number[]): Position {
  for (const p of coups) { const r = play(pos, p); if (typeof r === 'string') throw new Error(r); pos = r; }
  return pos;
}

describe('sélection du backend', () => {
  function fakeTf(ok: string[]): TfBackendApi & { tried: string[] } {
    let cur = 'none';
    const tried: string[] = [];
    return {
      tried,
      async setBackend(n) { tried.push(n); if (!ok.includes(n)) return false; cur = n; return true; },
      async ready() {},
      getBackend: () => cur,
    };
  }
  it('prend WebGPU s’il est disponible', async () => {
    const tf = fakeTf(['webgpu', 'webgl', 'cpu']);
    let loaded = 0;
    expect(await selectBackend(tf, { hasWebGPU: true, loadWebGPU: async () => { loaded++; } })).toBe('webgpu');
    expect(loaded).toBe(1);
  });
  it('sans WebGPU, passe à WebGL', async () => {
    const tf = fakeTf(['webgl', 'cpu']);
    expect(await selectBackend(tf, { hasWebGPU: false, loadWebGPU: async () => {} })).toBe('webgl');
    expect(tf.tried).toEqual(['webgl']);
  });
  it('WebGPU qui plante au chargement puis WebGL refusé : CPU', async () => {
    const tf = fakeTf(['cpu']);
    expect(await selectBackend(tf, { hasWebGPU: true, loadWebGPU: async () => { throw new Error('pas d’adaptateur'); } })).toBe('cpu');
  });
  it('écarte un backend qui calcule faux', async () => {
    const tf = fakeTf(['webgl', 'cpu']);
    const b = await selectBackend(tf, { hasWebGPU: false, loadWebGPU: async () => {}, check: async () => tf.getBackend() === 'cpu' });
    expect(b).toBe('cpu');
  });
  it('aucun backend : erreur explicite', async () => {
    await expect(selectBackend(fakeTf([]), { hasWebGPU: false, loadWebGPU: async () => {} })).rejects.toThrow(/Aucun backend/);
  });
});

describe('cache du réseau', () => {
  function fakeCaches() {
    const store = new Map<string, Response>();
    const opened: string[] = [];
    const cache = {
      async match(u: string) { return store.get(u)?.clone(); },
      async put(u: string, r: Response) { store.set(u, r); },
    } as unknown as Cache;
    return { store, opened, caches: { open: async (n: string) => { opened.push(n); return cache; } } };
  }
  const bytes = fakeNetBytes();
  it('télécharge une fois, puis lit le cache', async () => {
    const c = fakeCaches();
    let calls = 0;
    const fetch = async () => { calls++; return new Response(bytes as BlobPart); };
    const a = await loadModelBytes('https://x/net.bin.gz', { fetch, caches: c.caches });
    const b = await loadModelBytes('https://x/net.bin.gz', { fetch, caches: c.caches });
    expect(calls).toBe(1);
    expect(a.fromCache).toBe(false);
    expect(b.fromCache).toBe(true);
    expect(b.bytes).toEqual(bytes);
    expect(c.opened[0]).toBe(CACHE_NAME);
  });
  it('sans Cache API, télécharge simplement', async () => {
    const r = await loadModelBytes('u', { fetch: async () => new Response(bytes as BlobPart) });
    expect(r.fromCache).toBe(false);
  });
  it('erreur HTTP ou fichier minuscule : échec', async () => {
    await expect(loadModelBytes('u', { fetch: async () => new Response('x', { status: 404 }) })).rejects.toThrow(/404/);
    await expect(loadModelBytes('u', { fetch: async () => new Response('petit') })).rejects.toThrow(/trop petit/);
  });
});

describe('lecture d’un réseau factice', () => {
  it('lit la structure (bloc ordinaire, bloc gpool, têtes)', () => {
    const n = parseNet(fakeNetBytes());
    expect(n.name).toBe('factice-b2c4');
    expect(n.version).toBe(8);
    expect(n.trunk.blocks.map(b => b.kind)).toEqual(['ordinary', 'gpool']);
    expect(n.policy.p2.outC).toBe(1);
    expect(n.value.sv3.outC).toBe(4);
  });
  it('refuse un fichier tronqué ou d’une version inconnue', () => {
    const b = fakeNetBytes();
    expect(() => parseNet(b.subarray(0, b.length - 50))).toThrow();
    expect(() => parseNet(new TextEncoder().encode('x 99 22 19'))).toThrow(/Version/);
  });
  it('décompresse un .gz', async () => {
    const raw = fakeNetBytes();
    const gz = new Uint8Array(await new Response(new Blob([raw as BlobPart]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
    expect(isGzip(gz)).toBe(true);
    expect(await gunzip(gz)).toEqual(raw);
    expect(await gunzip(raw)).toBe(raw);
  });
  it('s’évalue avec TensorFlow.js (CPU) et donne des sorties aux bonnes tailles', async () => {
    const tf = await import('@tensorflow/tfjs');
    await tf.setBackend('cpu');
    const net = new TfNet(tf, parseNet(fakeNetBytes()));
    const { spatial, global } = features(newPosition(9), { komi: 7 });
    const o = await net.evaluate(spatial, global, 9);
    expect(o.policy.length).toBe(82);
    expect(o.ownership.length).toBe(81);
    expect(o.value.every(Number.isFinite)).toBe(true);
    const a = await search(net, newPosition(9), { visits: 10 });
    expect(a.visits).toBe(10);
    expect(a.moves[0].move).toBeGreaterThanOrEqual(-1);
    net.dispose();
  }, 30000);
});

/** Réseau factice sans TensorFlow : la politique préfère un point, la valeur dépend des pierres. */
function scripted(pref: number): Evaluator {
  return {
    name: 'scripté',
    async evaluate(spatial, _g, size): Promise<NetOutput> {
      const n = size * size, policy = new Float32Array(n + 1).fill(-5);
      policy[pref] = 5;
      let mine = 0, theirs = 0;
      for (let p = 0; p < n; p++) { mine += spatial[p * 22 + 1]; theirs += spatial[p * 22 + 2]; }
      const d = (mine - theirs) / 4;
      return { policy, value: [d, -d, -10], score: new Float32Array([d / 4, 0, d / 4, 0]), ownership: new Float32Array(n).fill(0.5) };
    },
  };
}

describe('recherche PUCT', () => {
  it('suit la politique et renvoie des coups légaux', async () => {
    const a = await search(scripted(i9(4, 4)), newPosition(9), { visits: 30, komi: 7 });
    expect(a.moves[0].move).toBe(i9(4, 4));
    expect(a.visits).toBe(30);
    expect(a.moves.every(m => m.scoreLoss >= 0)).toBe(true);
    // Propriété du point de vue de Noir (Noir au trait, logits positifs).
    expect(a.ownership[0]).toBeGreaterThan(0);
  });
  it('ne choisit pas un point occupé même si la politique le préfère', async () => {
    const pos = jouer(newPosition(9), [i9(4, 4)]);
    const a = await search(scripted(i9(4, 4)), pos, { visits: 20 });
    expect(a.moves[0].move).not.toBe(i9(4, 4));
  });
  it('#497 : variante principale légale, qui commence par le coup, et propriété après le meilleur coup', async () => {
    const a = await search(scripted(i9(4, 4)), newPosition(9), { visits: 40, komi: 7 });
    const pv = a.moves[0].pv!;
    expect(pv[0]).toBe(a.moves[0].move);
    expect(pv.length).toBeGreaterThan(1);
    expect(pv.length).toBeLessThanOrEqual(PV_MAX);
    // Chaque coup de la variante se joue, l'un après l'autre.
    let pos = newPosition(9);
    for (const m of pv) {
      const r = m < 0 ? { ...pos, toPlay: (3 - pos.toPlay) as 1 | 2, ko: -1, lastMove: -1 } : play(pos, m);
      expect(typeof r).not.toBe('string');
      pos = r as typeof pos;
    }
    // Coups jamais visités : pas de variante.
    expect(a.moves.filter(m => m.visits === 0).every(m => m.pv === undefined)).toBe(true);
    // Après le coup de Noir, Blanc est au trait : le réseau scripté (logits +0,5 pour le joueur au trait) donne Blanc.
    expect(a.ownershipApres).toHaveLength(81);
    expect(a.ownershipApres![0]).toBeLessThan(0);
    expect(a.ownership[0]).toBeGreaterThan(0);
  });
  it('respecte le budget de temps', async () => {
    const a = await search(scripted(0), newPosition(9), { visits: 1e6, timeMs: 30 });
    expect(a.visits).toBeLessThan(1e6);
  });
});

describe('table des 9 niveaux', () => {
  it('de Pomme 20 kyu à Sensei 1 dan, dans l’ordre', () => {
    expect(OPPONENTS).toHaveLength(9);
    expect(OPPONENTS[0]).toMatchObject({ id: 'pomme', rang: '20 kyu' });
    expect(OPPONENTS[1]).toMatchObject({ id: 'caillou', rang: '16 kyu' });
    expect(OPPONENTS[8]).toMatchObject({ id: 'sensei', nom: 'Sensei', rang: '1 dan' });
    expect(new Set(OPPONENTS.map(o => o.id)).size).toBe(9);
    // Rang croissant : les kyu descendent, puis 1 dan.
    const force = (r: string) => (r.endsWith('dan') ? parseInt(r, 10) : 1 - parseInt(r, 10));
    for (let i = 1; i < OPPONENTS.length; i++) expect(force(OPPONENTS[i].rang)).toBeGreaterThan(force(OPPONENTS[i - 1].rang));
  });
  it('Pomme et Caillou : moteur simple ; les 7 autres : KataGo, plus fort à chaque marche', () => {
    expect(OPPONENTS.slice(0, 2).every(o => !o.katago)).toBe(true);
    const k = OPPONENTS.slice(2).map(o => o.katago!);
    expect(k).toHaveLength(7);
    for (let i = 1; i < k.length; i++) {
      expect(k[i].visits).toBeGreaterThan(k[i - 1].visits);
      expect(k[i].tolerance).toBeLessThan(k[i - 1].tolerance);
    }
    expect(new Set(k.map(l => l.style))).toEqual(new Set(['agressif', 'solide', 'territorial']));
    // Objectif « moins de 2 s » : même Sensei reste sous 256 visites.
    expect(Math.max(...k.map(l => l.visits))).toBeLessThanOrEqual(256);
  });
  it('textes courts et en français', () => {
    for (const o of OPPONENTS) { expect(o.description.length).toBeLessThan(80); expect(o.nom).toMatch(/^[A-ZÀ-Ý]/); }
  });
});

describe('choix du coup selon le niveau', () => {
  const pos = jouer(newPosition(9), [i9(4, 4)]); // Blanc au trait
  const a: Analysis = {
    moves: [
      { move: i9(2, 2), visits: 40, prior: 0.3, winrate: 0.5, lead: 0, scoreLoss: 0 },
      { move: i9(4, 5), visits: 20, prior: 0.2, winrate: 0.45, lead: -2, scoreLoss: 2 },
      { move: i9(0, 0), visits: 5, prior: 0.01, winrate: 0.1, lead: -20, scoreLoss: 20 },
      { move: -1, visits: 2, prior: 0.01, winrate: 0.2, lead: -8, scoreLoss: 8 },
    ],
    winrate: 0.5, lead: 0, ownership: new Float32Array(81), visits: 67, ms: 1, engine: 't',
  };
  it('tolérance 0 : toujours le meilleur coup', () => {
    for (let s = 0; s < 20; s++) expect(chooseFromAnalysis(a, pos, { visits: 1, tolerance: 0, style: 'solide' }, () => s / 20)).toBe(i9(2, 2));
  });
  it('ne joue jamais un coup au-delà de la tolérance, ni la passe', () => {
    for (let s = 0; s < 50; s++) {
      const m = chooseFromAnalysis(a, pos, { visits: 1, tolerance: 3, style: 'agressif' }, () => s / 50);
      expect([i9(2, 2), i9(4, 5)]).toContain(m);
    }
  });
  it('le style agressif préfère le contact', () => {
    expect(styleBonus(pos, i9(4, 5), 'agressif')).toBeGreaterThan(styleBonus(pos, i9(2, 2), 'agressif'));
    expect(styleBonus(pos, i9(2, 2), 'territorial')).toBeGreaterThan(styleBonus(pos, i9(4, 5), 'territorial'));
    let contact = 0;
    for (let s = 0; s < 100; s++) if (chooseFromAnalysis(a, pos, { visits: 1, tolerance: 3, style: 'agressif' }, () => s / 100) === i9(4, 5)) contact++;
    expect(contact).toBeGreaterThan(20);
  });
  it('l’adversaire a passé et passer ne coûte rien : on passe', () => {
    const passed = { ...pos, lastMove: -1 };
    const b: Analysis = { ...a, moves: [a.moves[0], { ...a.moves[3], scoreLoss: 0.2 }] };
    expect(chooseFromAnalysis(b, passed, { visits: 1, tolerance: 3, style: 'solide' })).toBe(-1);
  });
});

describe('repli sur le moteur simple', () => {
  afterEach(() => setKataGo(undefined));
  it('KataGo absent : bestMove joue quand même un coup légal', async () => {
    setKataGo(null);
    const m = await bestMove(newPosition(9), 'tigre', { seed: 3, timeMs: 50 });
    expect(m).toBeGreaterThanOrEqual(0);
  });
  it('KataGo en erreur : repli, et analyze donne une estimation simple', async () => {
    setKataGo({ info: { state: 'indisponible' }, analyze: async () => { throw new Error('réseau introuvable'); } });
    expect(await bestMove(newPosition(9), 'sensei', { seed: 1, timeMs: 50 })).toBeGreaterThanOrEqual(0);
    const a = await analyze(newPosition(9), { timeMs: 50 });
    expect(a.engine).toBe('simple');
    expect(a.ownership.length).toBe(81);
  });
  it('KataGo disponible : bestMove et ownership l’utilisent', async () => {
    const ev = scripted(i9(6, 2));
    setKataGo({ info: { state: 'pret' }, analyze: (p, o) => search(ev, p, o) });
    expect(await bestMove(newPosition(9), 'sensei')).toBe(i9(6, 2));
    expect((await ownership(newPosition(9)))[0]).toBeGreaterThan(0);
  });
  it('Pomme ne sollicite jamais KataGo', async () => {
    let called = 0;
    setKataGo({ info: { state: 'pret' }, analyze: async () => { called++; throw new Error(); } });
    await bestMove(newPosition(9), 'pomme', { seed: 2, timeMs: 30 });
    expect(called).toBe(0);
  });
});

describe('client du Worker KataGo', () => {
  function fakeWorker(reply: (m: KgRequest) => KgResponse | null): WorkerLike {
    const w: WorkerLike = {
      onmessage: null, onerror: null, terminate() {},
      postMessage(m) { const r = reply(m); if (r) setTimeout(() => w.onmessage?.({ data: r } as MessageEvent<KgResponse>), 0); },
    };
    return w;
  }
  it('initialise puis analyse', async () => {
    const analysis = { moves: [], winrate: 0.5, lead: 0, ownership: new Float32Array(81), visits: 1, ms: 1, engine: 'x' };
    const c = new KataGoClient({ makeWorker: () => fakeWorker(m => (m.type === 'init' ? { id: m.id, type: 'ready', backend: 'webgl', name: 'g170', ms: 5, fromCache: true } : { id: m.id, type: 'analysis', analysis })) });
    expect((await c.analyze(newPosition(9))).engine).toBe('x');
    expect(c.info).toMatchObject({ state: 'pret', backend: 'webgl', fromCache: true });
  });
  it('échec du chargement : indisponible, et les appels suivants échouent vite', async () => {
    let made = 0;
    const c = new KataGoClient({ makeWorker: () => { made++; return fakeWorker(m => ({ id: m.id, type: 'error', error: 'Téléchargement du réseau impossible (404)' })); } });
    await expect(c.analyze(newPosition(9))).rejects.toThrow(/404/);
    expect(c.info.state).toBe('indisponible');
    await expect(c.analyze(newPosition(9))).rejects.toThrow(/indisponible/);
    expect(made).toBe(1);
  });
  it('chargement trop long : rend la main sans attendre', async () => {
    const c = new KataGoClient({ initWaitMs: 20, makeWorker: () => fakeWorker(() => null) });
    await expect(c.analyze(newPosition(9))).rejects.toThrow(/pas encore prêt/);
  });
});
