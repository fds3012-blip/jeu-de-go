// #584 : premier coup contre Bambou sans le réseau en cache. Avant, le client rendait la main après 15 s
// (`initWaitMs`) et le coup venait du moteur simple, sans le dire. Maintenant : on attend le démarrage de KataGo
// (progression visible), et un échec du démarrage est annoncé (`sansIA`).
import { afterEach, describe, expect, it } from 'vitest';
import { newPosition } from '../go/rules';
import { _reinitialiserPrechargement, bestMoveExplique, prechargerPourAdversaire, setKataGo } from './index';
import { KataGoClient, type WorkerLike } from './katago/client';
import { decisionPrechargement, type ContextePrechargement } from './katago/prechargement';
import type { Analysis } from './katago/search';
import type { KgRequest, KgResponse } from './katago/worker';
import { preparationIA } from '../app/progressionKataGo';

const i9 = (x: number, y: number) => y * 9 + x;
const COUP = i9(6, 2);
const analyse: Analysis = {
  moves: [{ move: COUP, visits: 100, prior: 1, winrate: 0.5, lead: 0, scoreLoss: 0 }],
  winrate: 0.5, lead: 0, ownership: new Float32Array(81), visits: 100, ms: 1, engine: 'katago',
};

/** Faux Worker : le démarrage répond après `demarrageMs` (téléchargement en 3G), avec une progression avant. */
function worker(demarrageMs: number, init: 'ready' | 'error' = 'ready'): WorkerLike {
  const w: WorkerLike = {
    onmessage: null, onerror: null, terminate() {},
    postMessage(m: KgRequest) {
      const r = (d: KgResponse, ms = 0) => setTimeout(() => w.onmessage?.({ data: d } as MessageEvent<KgResponse>), ms);
      if (m.type === 'init') {
        r({ id: m.id, type: 'progress', recu: 2_100_000, total: 3_800_000 }, demarrageMs / 2);
        r(init === 'ready' ? { id: m.id, type: 'ready', backend: 'webgl', name: 'g170', ms: demarrageMs, fromCache: false }
          : { id: m.id, type: 'error', error: 'Téléchargement du réseau impossible' }, demarrageMs);
      } else if (m.type === 'analyze') r({ id: m.id, type: 'analysis', analysis: analyse });
    },
  };
  return w;
}

afterEach(() => { setKataGo(undefined); _reinitialiserPrechargement(); });

describe('premier coup contre Bambou, réseau pas encore en cache (#584)', () => {
  it('démarrage plus long que l’attente du client : le coup vient quand même de KataGo', async () => {
    // initWaitMs : 20 ms ici pour 15 s en vrai ; le démarrage en prend 4 fois plus.
    const c = new KataGoClient({ initWaitMs: 20, makeWorker: () => worker(80) });
    setKataGo(c);
    const vus: ReturnType<typeof preparationIA>[] = [];
    c.ecouter(i => vus.push(preparationIA(i)));
    const r = await bestMoveExplique(newPosition(9), 'bambou', { seed: 1 });
    expect(r.move).toBe(COUP);
    expect(r.sansIA).toBeUndefined();
    // Ce que l'écran affiche pendant l'attente : « L'IA se prépare… », puis « 2,1 / 3,8 Mo ».
    expect(vus).toContainEqual({});
    expect(vus).toContainEqual({ recu: '2,1', total: '3,8' });
    expect(preparationIA(c.info)).toBeNull();
  });

  it('KataGo ne démarre pas (réseau coupé) : coup légal du moteur simple, annoncé comme tel', async () => {
    setKataGo(new KataGoClient({ makeWorker: () => worker(10, 'error') }));
    const r = await bestMoveExplique(newPosition(9), 'bambou', { seed: 1, timeMs: 30 });
    expect(r.move).toBeGreaterThanOrEqual(0);
    expect(r.sansIA).toBe(true);
  });

  it('Pomme (moteur simple voulu) : jamais annoncé « sans IA »', async () => {
    setKataGo(null);
    const r = await bestMoveExplique(newPosition(9), 'pomme', { seed: 1, timeMs: 30 });
    expect(r.sansIA).toBeUndefined();
  });
});

describe('préchargement à l’approche d’un adversaire KataGo (#584)', () => {
  const base: ContextePrechargement = { partiesLancees: 0, enCache: false, etat: 'inactif', visible: true, pourAdversaire: true };
  it('permis à la première partie et en données mobiles (3G, 4G)', () => {
    expect(decisionPrechargement(base)).toEqual({ ok: true });
    expect(decisionPrechargement({ ...base, connexion: { type: 'cellular', effectiveType: '3g' } })).toEqual({ ok: true });
  });
  it('jamais en économie de données ni en 2G, ni déjà en cache', () => {
    expect(decisionPrechargement({ ...base, connexion: { saveData: true } })).toEqual({ ok: false, raison: 'economie-donnees' });
    expect(decisionPrechargement({ ...base, connexion: { type: 'cellular', effectiveType: '2g' } })).toEqual({ ok: false, raison: 'connexion-lente' });
    expect(decisionPrechargement({ ...base, connexion: { effectiveType: 'slow-2g' } })).toEqual({ ok: false, raison: 'connexion-lente' });
    expect(decisionPrechargement({ ...base, enCache: true })).toEqual({ ok: false, raison: 'deja-en-cache' });
  });
  it('sans l’approche d’un adversaire KataGo, les règles de #475 restent (première partie, données mobiles)', () => {
    const sans = { ...base, pourAdversaire: false };
    expect(decisionPrechargement(sans)).toEqual({ ok: false, raison: 'premier-lancement' });
    expect(decisionPrechargement({ ...sans, partiesLancees: 3, connexion: { type: 'cellular' } })).toEqual({ ok: false, raison: 'reseau-mobile' });
  });
  it('lance le préchargement une seule fois par session', async () => {
    let n = 0;
    setKataGo({ info: { state: 'inactif' }, analyze: async () => analyse, precharger: async () => { n++; return true; } });
    expect(await prechargerPourAdversaire()).toEqual({ ok: true });
    expect(await prechargerPourAdversaire()).toEqual({ ok: false, raison: 'deja-en-route' });
    expect(n).toBe(1);
  });
});
