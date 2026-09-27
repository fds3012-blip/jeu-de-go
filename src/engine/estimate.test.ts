import { afterEach, describe, expect, it } from 'vitest';
import { estimateLead, meilleurCoup, setKataGo, type Analysis, type KataGoBackend } from './index';
import { newPosition, play, type Position } from '../go/rules';

function faux(lead: number, state: 'pret' | 'chargement'): KataGoBackend & { appels: number } {
  const k = {
    appels: 0,
    info: { state } as KataGoBackend['info'],
    async analyze(): Promise<Analysis> {
      k.appels++;
      return { moves: [], winrate: 0.5, lead, ownership: new Float32Array(81), visits: 16, ms: 1, engine: 'faux' };
    },
  };
  return k;
}

describe("estimation d'avantage (barre de l'écran de partie)", () => {
  afterEach(() => setKataGo(undefined));

  it("KataGo prêt : avance convertie du point de vue de Noir", async () => {
    const k = faux(4, 'pret');
    setKataGo(k);
    const p0 = newPosition(9);
    expect(await estimateLead(p0, 6.5)).toEqual({ lead: 4, engine: 'katago' }); // Noir au trait
    const p1 = play(p0, 40) as Position;
    expect(await estimateLead(p1, 6.5)).toEqual({ lead: -4, engine: 'katago' }); // Blanc au trait
  });

  it("KataGo occupé ou pas encore chargé : on ne l'appelle pas ; sans Worker, pas d'estimation", async () => {
    const pret = faux(4, 'pret'), charge = faux(4, 'chargement');
    setKataGo(pret);
    expect(await estimateLead(newPosition(9), 6.5, { kataGo: false })).toBeNull();
    setKataGo(charge);
    expect(await estimateLead(newPosition(9), 6.5)).toBeNull();
    expect(pret.appels + charge.appels).toBe(0);
  });
});

describe('meilleurCoup (revue, issue #34)', () => {
  afterEach(() => setKataGo(undefined));

  it('sans KataGo chargé ni réseau en cache : aucun conseil (jamais le moteur simple)', async () => {
    setKataGo(faux(3, 'chargement'));
    expect(await meilleurCoup(newPosition(9), 6.5)).toEqual({ katago: false });
    setKataGo(null);
    expect(await meilleurCoup(newPosition(9), 6.5)).toEqual({ katago: false });
  });

  it('KataGo prêt : son premier coup et son avance', async () => {
    const k = faux(3, 'pret');
    k.analyze = async () => ({ moves: [{ move: 40, visits: 40, prior: 0.5, winrate: 0.6, lead: 4, scoreLoss: 0 }], winrate: 0.6, lead: 4, ownership: new Float32Array(81), visits: 48, ms: 1, engine: 'faux' });
    setKataGo(k);
    expect(await meilleurCoup(newPosition(9), 6.5)).toEqual({ katago: true, move: 40, lead: 4 });
  });
});
