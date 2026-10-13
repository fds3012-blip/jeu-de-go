// #528 : KataGo reçoit le komi de la partie (compensation du handicap comprise en chinois) et les pierres posées ;
// l'estimation (barre d'avantage, « Qui mène ? ») est juste dès la position de départ d'une partie à handicap.
import { afterEach, describe, expect, it } from 'vitest';
import { bestMoveExplique, estimateLead, estimateTerritoire, moteurDeLaPartie, reglesMoteur, setKataGo, type Analysis, type AnalyzeOptions, type KataGoBackend } from './index';
import { handicapPoints, newPosition, type Position } from '../go/rules';
import { fromLabel } from '../go/coords';

function faux(ownership: (pos: Position) => Float32Array) {
  const vus: { pos: Position; o: AnalyzeOptions }[] = [];
  const k: KataGoBackend = {
    info: { state: 'pret' } as KataGoBackend['info'],
    async analyze(pos, o): Promise<Analysis> {
      vus.push({ pos, o });
      const coup = fromLabel('E5', pos.size);
      return { moves: [{ move: coup, visits: 10, prior: 0.5, winrate: 0.5, lead: 0, scoreLoss: 0 }], winrate: 0.5, lead: 0, ownership: ownership(pos), visits: 10, ms: 1, engine: 'faux' };
    },
  };
  return { k, vus };
}

describe('moteurs et réglages de la partie', () => {
  afterEach(() => setKataGo(undefined));

  it('réglages par défaut : komi tel quel et aucune règle imposée à KataGo (équilibrage inchangé)', () => {
    expect(moteurDeLaPartie(0.5, 'japanese', 0)).toEqual({ komi: 0.5 });
    expect(moteurDeLaPartie(6.5, 'japanese', 0)).toEqual({ komi: 6.5 });
    expect(reglesMoteur('japanese', 0)).toBeUndefined();
  });
  it('handicap ou règle chinoise : la règle de la partie, et la compensation du handicap en chinois', () => {
    expect(moteurDeLaPartie(0.5, 'chinese', 4)).toEqual({ komi: 4.5, rules: 'chinese' });
    expect(moteurDeLaPartie(0.5, 'japanese', 4)).toEqual({ komi: 0.5, rules: 'japanese' });
    expect(moteurDeLaPartie(7.5, 'chinese', 0)).toEqual({ komi: 7.5, rules: 'chinese' });
  });

  it('coup de l’ordi : KataGo voit les 4 pierres posées, Blanc au trait, komi 4,5 et règle chinoise', async () => {
    const { k, vus } = faux(pos => new Float32Array(pos.size * pos.size));
    setKataGo(k);
    const depart = newPosition(9, handicapPoints(9, 4));
    const r = await bestMoveExplique(depart, 'bambou', { ...moteurDeLaPartie(0.5, 'chinese', 4), seed: 1 });
    expect(r.move).toBe(fromLabel('E5', 9));
    expect(vus).toHaveLength(1);
    expect(vus[0].pos.toPlay).toBe(2);
    expect(vus[0].pos.board.filter(v => v === 1)).toHaveLength(4);
    expect(vus[0].o).toMatchObject({ komi: 4.5, regles: 'chinese' });
  });

  it('partie par défaut : KataGo choisit ses coups comme avant (komi seul, sa règle habituelle)', async () => {
    const { k, vus } = faux(pos => new Float32Array(pos.size * pos.size));
    setKataGo(k);
    await bestMoveExplique(newPosition(9), 'bambou', { ...moteurDeLaPartie(6.5, 'japanese', 0), seed: 1 });
    expect(vus[0].o.komi).toBe(6.5);
    expect(vus[0].o.regles).toBeUndefined();
  });

  it('position de départ à 4 pierres : Noir mène, et autant en japonais qu’en chinois (compensation comprise)', async () => {
    // Propriété plausible au départ d'une partie à handicap : les pierres à Noir, le reste penche vers Noir.
    const own = (pos: Position) => Float32Array.from(pos.board, v => (v === 1 ? 1 : 0.3));
    const depart = newPosition(9, handicapPoints(9, 4));
    const { k, vus } = faux(own);
    setKataGo(k);
    const jp = moteurDeLaPartie(0.5, 'japanese', 4), cn = moteurDeLaPartie(0.5, 'chinese', 4);
    const ej = await estimateLead(depart, jp.komi, { rules: 'japanese' });
    const ec = await estimateLead(depart, cn.komi, { rules: 'chinese' });
    expect(ej!.engine).toBe('katago');
    expect(ej!.lead).toBeGreaterThan(0);
    expect(ec!.lead).toBeCloseTo(ej!.lead, 5);
    expect(vus.map(v => [v.o.komi, v.o.regles])).toEqual([[0.5, 'japanese'], [4.5, 'chinese']]);
    // « Qui mène ? » : même avance, et la carte des territoires part de la propriété de KataGo.
    const t = await estimateTerritoire(depart, cn.komi, { rules: 'chinese' });
    expect(t!.lead).toBeCloseTo(ec!.lead, 5);
  });
});
