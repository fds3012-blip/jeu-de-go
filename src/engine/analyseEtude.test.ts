// #562 : l'analyse de l'étude reçoit le komi compté et la règle choisis dans l'étude.
import { afterEach, describe, expect, it } from 'vitest';
import { analyseEtude, setKataGo, type Analysis, type KataGoBackend } from './index';
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
