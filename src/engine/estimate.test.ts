import { afterEach, describe, expect, it } from 'vitest';
import { estimateLead, meilleurCoup, setKataGo, type Analysis, type KataGoBackend } from './index';
import { newPosition, play, type Position } from '../go/rules';

function faux(lead: number, state: 'pret' | 'chargement', ownership = new Float32Array(81)): KataGoBackend & { appels: number; regles?: string } {
  const k: KataGoBackend & { appels: number; regles?: string } = {
    appels: 0,
    info: { state } as KataGoBackend['info'],
    async analyze(_pos, o): Promise<Analysis> {
      k.appels++;
      k.regles = o.regles;
      return { moves: [], winrate: 0.5, lead, ownership, visits: 16, ms: 1, engine: 'faux' };
    },
  };
  return k;
}

describe("estimation d'avantage (barre de l'écran de partie)", () => {
  afterEach(() => setKataGo(undefined));

  it("KataGo prêt : avance de Noir comptée depuis sa propriété, en japonais comme le comptage (#159)", async () => {
    // Propriété uniforme de +0,2 : 81 × 0,2 points pour Noir, moins le komi. Le `lead` brut de KataGo (compté
    // en chinois, sans les prisonniers) n'est plus utilisé : c'est lui qui contredisait le score final.
    const k = faux(40, 'pret', new Float32Array(81).fill(0.2));
    setKataGo(k);
    const p0 = newPosition(9);
    expect((await estimateLead(p0, 6.5))!.lead).toBeCloseTo(81 * 0.2 - 6.5, 5);
    expect(k.regles).toBe('japanese');
    const p1 = play(p0, 40) as Position; // même estimation quel que soit le joueur au trait
    const e1 = await estimateLead(p1, 6.5);
    expect(e1!.engine).toBe('katago');
    // La pierre noire vivante ne compte pas en japonais ; les 80 points vides valent 0,2 chacun.
    expect(e1!.lead).toBeCloseTo(80 * 0.2 - 6.5, 5);
    // En chinois, la pierre vivante compte un point.
    expect((await estimateLead(p1, 6.5, { rules: 'chinese' }))!.lead).toBeCloseTo(1 + 80 * 0.2 - 6.5, 5);
  });

  it('après une passe : on compte comme au comptage, frontières ouvertes neutres, prisonniers compris', async () => {
    const own = new Float32Array(81).fill(0.9); // l'estimation donnerait tout à Noir…
    setKataGo(faux(0, 'pret', own));
    const p = { ...(play(newPosition(9), 40) as Position), captures: [0, 3, 1] as [number, number, number] };
    const passe = play(p, -1) as Position;
    // …mais la zone touche une seule couleur : c'est un territoire noir de 80 points, plus 3 - 1 prisonniers.
    expect((await estimateLead(passe, 6.5))!.lead).toBeCloseTo(80 + 3 - 1 - 6.5, 5);
    // Une pierre blanche vivante (propriété -1) ouvre la zone : neutre après la passe…
    const own2 = own.slice();
    own2[41] = -1;
    setKataGo(faux(0, 'pret', own2));
    const blanc: Position = { ...passe, board: passe.board.slice(), lastMove: 41 };
    blanc.board[41] = 2;
    expect((await estimateLead({ ...blanc, lastMove: -1 }, 6.5))!.lead).toBeCloseTo(3 - 1 - 6.5, 5);
    // …mais partagée selon la propriété en cours de partie.
    expect((await estimateLead(blanc, 6.5))!.lead).toBeCloseTo(79 * 0.9 + 3 - 1 - 6.5, 5);
    // Une pierre à la propriété nettement adverse est comptée morte : prisonnier et territoire, comme au comptage.
    setKataGo(faux(0, 'pret', own));
    expect((await estimateLead({ ...blanc, lastMove: -1 }, 6.5))!.lead).toBeCloseTo(80 + 3 + 1 - 1 - 6.5, 5);
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
