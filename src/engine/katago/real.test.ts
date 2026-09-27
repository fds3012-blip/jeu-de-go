// Test avec le vrai réseau g170-b6c96, s'il a été téléchargé (npm run fetch-model). Sinon, ignoré.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { newPosition, play, type Position } from '../../go/rules';
import { gunzip, parseNet } from './parse';
import { TfNet } from './net';
import { search } from './search';

const file = fileURLToPath(new URL('../../../public/models/g170-b6c96-s175395328-d26788732.bin.gz', import.meta.url));
const has = existsSync(file);

function jouer(pos: Position, coups: number[]): Position {
  for (const p of coups) { const r = play(pos, p); if (typeof r === 'string') throw new Error(r); pos = r; }
  return pos;
}

describe.skipIf(!has)('KataGo g170-b6c96 (réseau réel)', () => {
  let net: TfNet;
  beforeAll(async () => {
    const tf = await import('@tensorflow/tfjs');
    await tf.setBackend('cpu');
    const parsed = parseNet(await gunzip(new Uint8Array(readFileSync(file))));
    expect(parsed.name).toContain('g170-b6c96');
    net = new TfNet(tf, parsed);
  }, 60000);

  it('ouvre au centre ou près du centre en 9 × 9', async () => {
    const a = await search(net, newPosition(9), { komi: 7, visits: 24 });
    const m = a.moves[0].move, x = m % 9, y = (m - x) / 9;
    expect(x).toBeGreaterThanOrEqual(2); expect(x).toBeLessThanOrEqual(6);
    expect(y).toBeGreaterThanOrEqual(2); expect(y).toBeLessThanOrEqual(6);
    expect(a.winrate).toBeGreaterThan(0.2); expect(a.winrate).toBeLessThan(0.8);
    console.log(`9x9 vide : ${a.visits} visites en ${a.ms.toFixed(0)} ms, coup ${m}, winrate ${a.winrate.toFixed(2)}, avance ${a.lead.toFixed(1)}`);
  }, 60000);

  it('capture une pierre en atari', async () => {
    // Noir C3(2,6)... Blanc en E5 (4,4) entouré sur 3 côtés par Noir : Noir capture en (4,5).
    const i = (x: number, y: number) => y * 9 + x;
    const pos = jouer(newPosition(9), [i(4, 3), i(4, 4), i(3, 4), i(0, 0), i(5, 4), i(8, 8)]);
    const a = await search(net, pos, { komi: 7, visits: 16 });
    expect(a.moves[0].move).toBe(i(4, 5));
    // Propriété : la pierre blanche est morte, donc le point est plutôt noir.
    expect(a.ownership[i(4, 4)]).toBeGreaterThan(0);
  }, 60000);
});
