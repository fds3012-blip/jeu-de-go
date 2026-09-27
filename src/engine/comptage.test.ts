// Comptage automatique (#117) : pierres mortes marquées sans le joueur, groupes incertains renvoyés à la main.
import { fromRows } from '../go/position';
import { score } from '../go/score';
import { comptageAuto, groupesIncertains } from './dead';
import { CAS } from './dead.fixtures';
import { modeComptage } from '../app/partie';

describe('comptage automatique (comptageAuto)', () => {
  for (const { nom, rows } of CAS) {
    it(`${nom} : morts marqués, rien d'incertain, comptage automatique`, () => {
      const { pos, marked } = fromRows(rows, 1);
      const r = comptageAuto(pos, { seed: 7 });
      expect(r.dead).toEqual([...marked].sort((a, b) => a - b));
      expect(r.incertains).toEqual([]);
      expect(modeComptage(true, r.incertains)).toBe('auto');
    });
  }

  it('un groupe blanc mort : le score validé sans rien toucher est correct', () => {
    // Noir tient A à E, Blanc F à J ; une pierre blanche perdue en B5 (colonne 2, ligne 5).
    const { pos } = fromRows(['....XO...', '....XO...', '....XO...', '....XO...', '.O..XO...', '....XO...', '....XO...', '....XO...', '....XO...'], 1);
    const r = comptageAuto(pos, { seed: 3 });
    expect(r.dead).toEqual([4 * 9 + 1]);
    expect(r.incertains).toEqual([]);
    const s = score(pos, 6.5, 'japanese', new Set(r.dead));
    // Territoire : Noir 36 cases (B5 comprise) + 1 prisonnier = 37 ; Blanc 27 + 6,5 = 33,5.
    expect(s.black).toBe(37);
    expect(s.white).toBe(33.5);
    expect(s.winner).toBe(1);
  });

  it('plateau vide : rien à marquer, comptage automatique', () => {
    const r = comptageAuto(fromRows(Array(9).fill('.........')).pos);
    expect(r).toEqual({ dead: [], incertains: [] });
  });

  it('KataGo en désaccord sur un groupe : il devient incertain, comptage à la main', () => {
    const { pos } = fromRows(['....XO...', '....XO...', '..O.XO...', '....XO...', '....XO...', '....XO...', '....XO...', '....XO...', '....XO...'], 1);
    const p = 2 * 9 + 2, r = comptageAuto(pos, { seed: 7 });
    expect(r.dead).toEqual([p]);
    // KataGo voit la pierre blanche vivante (propriété blanche) : désaccord.
    const own = new Float32Array(81);
    own[p] = -0.9;
    expect(groupesIncertains(pos, r.dead, [own])).toEqual([p]);
    expect(modeComptage(true, groupesIncertains(pos, r.dead, [own]))).toBe('manuel');
    // KataGo d'accord (propriété noire) : rien d'incertain.
    own[p] = 0.95;
    expect(groupesIncertains(pos, r.dead, [own])).toEqual([]);
  });

  it('propriété entre vie et mort : groupe incertain', () => {
    const { pos } = fromRows(['....XO...', '....XO...', '..O.XO...', '....XO...', '....XO...', '....XO...', '....XO...', '....XO...', '....XO...'], 1);
    const p = 2 * 9 + 2, own = new Float32Array(81);
    own[p] = 0.4; // vue de Blanc : -0,4, dans la zone de doute
    expect(groupesIncertains(pos, [], [own])).toEqual([p]);
    expect(groupesIncertains(pos, [p], [own])).toEqual([p]);
  });

  it('seki : propriété proche de 0 chez KataGo, vivant et certain', () => {
    const seki = CAS.find(c => c.nom.startsWith('9 × 9 : seki sans œil'))!;
    const { pos } = fromRows(seki.rows, 1);
    expect(groupesIncertains(pos, [], [new Float32Array(81)])).toEqual([]);
  });

  it('partie inachevée : un groupe à la vie discutable est renvoyé à la main', () => {
    // Deux pierres blanches au milieu d'une grande zone noire ouverte : la simulation ne tranche pas nettement.
    const { pos } = fromRows(['.........', '.........', '.........', '...XO....', '...XO....', '...X.....', '.........', '.........', '.........'], 1);
    const r = comptageAuto(pos, { seed: 7 });
    expect(r.incertains.length).toBeGreaterThan(0);
    expect(modeComptage(true, r.incertains)).toBe('manuel');
  });

  it('à deux sur un appareil : toujours la phase manuelle', () => {
    expect(modeComptage(false, [])).toBe('manuel');
  });
});
