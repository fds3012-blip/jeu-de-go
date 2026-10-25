// #562 : l'analyse de l'étude reçoit le komi compté et la règle choisis dans l'étude.
import { afterEach, describe, expect, it } from 'vitest';
import { setKataGo, type Analysis, type KataGoBackend } from './index';
import { analyseEtude, brancherApprofondi } from './revueKataGo';
import { newPosition } from '../go/rules';
import { etudeVide, poser, positionsEtude, regler, reglagesAnalyse, type Etude } from '../go/etude';
import { fromLabel } from '../go/coords';

function faux(): KataGoBackend & { recu: { komi?: number; regles?: string }[] } {
  const k: KataGoBackend & { recu: { komi?: number; regles?: string }[] } = {
    recu: [],
    info: { state: 'pret' } as KataGoBackend['info'],
    async analyze(_pos, o): Promise<Analysis> {
      k.recu.push({ komi: o.komi, regles: o.regles });
      return { moves: [{ move: 40, visits: 10, prior: 0.5, winrate: 0.6, lead: 2, scoreLoss: 0 }], winrate: 0.6, lead: 2, ownership: new Float32Array(81), visits: 10, ms: 1, engine: 'faux' };
    },
  };
  return k;
}

describe('analyse de l’étude', () => {
  afterEach(() => setKataGo(undefined));

  it('komi et règle de l’étude ; handicap en chinois : 1 point de plus à Blanc par pierre', async () => {
    const k = faux();
    setKataGo(k);
    let e: Etude = etudeVide(9);
    for (const l of ['C3', 'G7']) e = poser(e, fromLabel(l, 9), 'noir') as Etude;
    e = regler({ ...e, trait: 2 }, { komi: 0.5, regles: 'chinese' });
    const r = reglagesAnalyse(e);
    const a = await analyseEtude(positionsEtude(e).at(-1)!, r.komi, 16, r.regles);
    expect(a.katago).toBe(true);
    expect(k.recu.at(-1)).toEqual({ komi: 2.5, regles: 'chinese' });
    const j = regler(e, { komi: 7.5, regles: 'japanese' });
    const rj = reglagesAnalyse(j);
    await analyseEtude(positionsEtude(j).at(-1)!, rj.komi, 16, rj.regles);
    expect(k.recu.at(-1)).toEqual({ komi: 7.5, regles: 'japanese' });
  });
});

describe('analyseEtude avec l’analyse approfondie (C8)', () => {
  it('le réseau approfondi s’il est prêt (approfondie: true), le petit sinon ou en cas d’échec', async () => {
    const mk = (lead: number, boom = false): KataGoBackend => ({
      info: { state: 'pret' } as KataGoBackend['info'],
      async analyze() { if (boom) throw new Error('GPU perdu'); return { moves: [], winrate: 0.5, lead, ownership: new Float32Array(81), visits: 16, ms: 1, engine: 'faux' }; },
    });
    const pos = newPosition(9);
    setKataGo(mk(2));
    brancherApprofondi({ fournir: async () => mk(9), echec: () => {}, raisonRepli: () => null, options: o => o });
    expect(await analyseEtude(pos, 6.5, 16)).toMatchObject({ katago: true, lead: 9, approfondie: true });
    brancherApprofondi({ fournir: async () => mk(9, true), echec: () => {}, raisonRepli: () => null, options: o => o });
    const r = await analyseEtude(pos, 6.5, 16);
    expect(r).toMatchObject({ katago: true, lead: 2 });
    expect('approfondie' in r).toBe(false);
    brancherApprofondi(null);
    setKataGo(undefined);
  });
});
