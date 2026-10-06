import { describe, expect, it } from 'vitest';
import { fromLabel } from './coords';
import { newPosition, play, type Position } from './rules';
import { numerosDesCoups } from './numeros';

// #365 : numéros des coups en revue.
const at = (l: string) => fromLabel(l, 9);
function partie(coups: string[]): Position[] {
  const out = [newPosition(9)];
  for (const c of coups) {
    const r = play(out.at(-1)!, c === 'passe' ? -1 : at(c));
    if (typeof r === 'string') throw new Error(r);
    out.push(r);
  }
  return out;
}

describe('numéros des coups', () => {
  it('numérote les pierres posées jusqu’au coup affiché, sans les passes', () => {
    const ps = partie(['C3', 'G7', 'passe', 'E5']);
    expect([...numerosDesCoups(ps, 4)]).toEqual([[at('C3'), 1], [at('G7'), 2], [at('E5'), 4]]);
    expect([...numerosDesCoups(ps, 1)]).toEqual([[at('C3'), 1]]);
    expect(numerosDesCoups(ps, 0).size).toBe(0);
  });
  it('une pierre prise perd son numéro ; un point rejoué prend le dernier', () => {
    // Noir B1 A2 ; Blanc A1 puis prise par Noir... ici : Blanc A1 est pris par Noir B2 ? On prend A1 avec B1 et A2.
    const ps = partie(['B1', 'A1', 'A2']);
    const n = numerosDesCoups(ps, 3);
    expect(n.has(at('A1'))).toBe(false);
    expect(n.get(at('A2'))).toBe(3);
  });
});
