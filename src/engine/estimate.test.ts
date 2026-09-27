import { afterEach, describe, expect, it } from 'vitest';
import { estimateLead, setKataGo, type Analysis, type KataGoBackend } from './index';
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
