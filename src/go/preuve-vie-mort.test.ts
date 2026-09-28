// Issue #136 : l'outil de preuve de vie et mort (src/go/preuve-vie-mort.ts) sur des formes classiques connues.
// Chaque forme est un groupe blanc enfermé sur le bord par un mur noir solide ; la zone est l'espace intérieur.
import { fromLabel, toLabel } from './coords';
import { fromRows } from './position';
import { coupsGagnants, defautsDeZone, evaluer, issueApres, verdict, yeuxDuGroupe } from './preuve-vie-mort';
import { play, type Position } from './rules';

const E = '.........';
const at = (l: string) => fromLabel(l, 9);
const labels = (ms: number[]) => ms.map(m => (m < 0 ? 'passe' : toLabel(m, 9))).sort();
const zoneDe = (...ls: string[]) => ls.map(at);

/** Forme : lignes du plateau (Blanc = O défend), zone intérieure, pierre blanche de référence. */
function forme(rows: string[], zone: string[], cible: string, toPlay: 1 | 2) {
  const { pos } = fromRows(rows, toPlay);
  return { pos, zone: zoneDe(...zone), cible: at(cible) };
}

describe('preuve-vie-mort : trois points en ligne sur le bord', () => {
  const rows = [E, E, E, E, E, E, 'XXXXXXX..', 'XOOOOOX..', 'XO...OX..'];
  const zone = ['C1', 'D1', 'E1'];

  it('la zone est fermée', () => {
    const f = forme(rows, zone, 'B1', 1);
    expect(defautsDeZone(f.pos, f.cible, f.zone)).toEqual([]);
  });

  it('Noir au trait : seul le milieu, D1, tue', () => {
    const f = forme(rows, zone, 'B1', 1);
    expect(verdict(f.pos, f.cible, f.zone)).toBe('mort');
    expect(labels(coupsGagnants(f.pos, f.cible, f.zone, 'tuer'))).toEqual(['D1']);
    // Réfutation : après C1, Blanc joue D1 et vit.
    expect(issueApres(play(f.pos, at('C1')) as Position, at('D1'), f.cible, f.zone)).toBe(1);
  });

  it('Blanc au trait : seul le milieu, D1, fait vivre', () => {
    const f = forme(rows, zone, 'B1', 2);
    expect(verdict(f.pos, f.cible, f.zone)).toBe('vivant');
    expect(labels(coupsGagnants(f.pos, f.cible, f.zone, 'vivre'))).toEqual(['D1']);
    const apres = play(f.pos, at('D1')) as Position;
    expect(yeuxDuGroupe(apres, f.cible).map(y => [toLabel(y.point, 9), y.vrai])).toEqual([['C1', true], ['E1', true]]);
  });
});

describe('preuve-vie-mort : quatre points en ligne sur le bord', () => {
  const rows = [E, E, E, E, E, E, 'XXXXXXXX.', 'XOOOOOOX.', 'XO....OX.'];
  const zone = ['C1', 'D1', 'E1', 'F1'];

  it('vivant même si Noir joue le premier : aucun coup noir ne tue', () => {
    const f = forme(rows, zone, 'B1', 1);
    expect(defautsDeZone(f.pos, f.cible, f.zone)).toEqual([]);
    expect(verdict(f.pos, f.cible, f.zone)).toBe('vivant');
    expect(coupsGagnants(f.pos, f.cible, f.zone, 'tuer')).toEqual([]);
  });
});

describe('preuve-vie-mort : quatre points en carré', () => {
  const rows = [E, E, E, E, E, 'XXXXXX...', 'XOOOOX...', 'XO..OX...', 'XO..OX...'];
  const zone = ['C1', 'D1', 'C2', 'D2'];

  it('mort même si Blanc joue le premier', () => {
    const f = forme(rows, zone, 'B1', 2);
    expect(defautsDeZone(f.pos, f.cible, f.zone)).toEqual([]);
    expect(verdict(f.pos, f.cible, f.zone)).toBe('mort');
    expect(coupsGagnants(f.pos, f.cible, f.zone, 'vivre')).toEqual([]);
  });

  it('mort aussi si Noir joue le premier, et même s’il passe', () => {
    const f = forme(rows, zone, 'B1', 1);
    expect(verdict(f.pos, f.cible, f.zone)).toBe('mort');
    expect(issueApres(f.pos, -1, f.cible, f.zone)).toBe(-1);
  });
});

describe('preuve-vie-mort : bulky five (cinq en bloc)', () => {
  const rows = [E, E, E, E, E, 'XXXXXXX..', 'XOOOOOX..', 'XO..OOX..', 'XO...OX..'];
  const zone = ['C1', 'D1', 'E1', 'C2', 'D2'];

  it('Noir au trait : le point vital D1 tue, et lui seul', () => {
    const f = forme(rows, zone, 'B1', 1);
    expect(defautsDeZone(f.pos, f.cible, f.zone)).toEqual([]);
    expect(labels(coupsGagnants(f.pos, f.cible, f.zone, 'tuer'))).toEqual(['D1']);
  });

  it('Blanc au trait : D1 fait vivre ; C1 (quatre en zigzag) et D2 (quatre en L) aussi, pas E1 ni C2', () => {
    const f = forme(rows, zone, 'B1', 2);
    // E1 laisse un carré de quatre, mort ; C2 laisse un T de quatre (C1, D1, E1, D2), que Noir tue en D1.
    expect(labels(coupsGagnants(f.pos, f.cible, f.zone, 'vivre'))).toEqual(['C1', 'D1', 'D2']);
  });
});

describe('preuve-vie-mort : rabbity six (six en lapin)', () => {
  const rows = [E, E, E, E, 'XXXXXXX..', 'XOOOOOX..', 'XOO.OOX..', 'XO...OX..', 'XOO..OX..'];
  const zone = ['D3', 'C2', 'D2', 'E2', 'D1', 'E1'];

  it('Noir au trait : le point vital D2 tue, et lui seul', () => {
    const f = forme(rows, zone, 'C1', 1);
    expect(defautsDeZone(f.pos, f.cible, f.zone)).toEqual([]);
    expect(labels(coupsGagnants(f.pos, f.cible, f.zone, 'tuer'))).toEqual(['D2']);
  });

  it('Blanc au trait : D2 fait vivre ; D1 et E2 aussi, pas les bouts D3, C2 ni E1', () => {
    const f = forme(rows, zone, 'C1', 2);
    expect(labels(coupsGagnants(f.pos, f.cible, f.zone, 'vivre'))).toEqual(['D1', 'D2', 'E2']);
  });
});

describe('preuve-vie-mort : le faux œil', () => {
  // Blanc : un œil vrai en A1. C1 est entouré de pierres blanches, mais le coin D2 est noir : D1-E1 peut être pris.
  const faux = [E, E, E, E, E, E, 'XXXXXX...', 'OOOXXX...', '.O.OOX...'];
  // Même forme, D2 et E2 blancs : C1 devient un œil vrai.
  const vrai = [E, E, E, E, E, E, 'XXXXXX...', 'OOOOOX...', '.O.OOX...'];
  const zone = ['A1', 'C1'];

  it('C1 est reconnu comme faux œil, A1 comme œil vrai', () => {
    const f = forme(faux, zone, 'B1', 2);
    expect(yeuxDuGroupe(f.pos, f.cible).map(y => [toLabel(y.point, 9), y.vrai])).toEqual([['A1', true], ['C1', false]]);
    const v = forme(vrai, zone, 'B1', 2);
    expect(yeuxDuGroupe(v.pos, v.cible).map(y => [toLabel(y.point, 9), y.vrai])).toEqual([['A1', true], ['C1', true]]);
  });

  it('avec un faux œil, le groupe est mort, même si Blanc joue le premier', () => {
    for (const toPlay of [1, 2] as const) {
      const f = forme(faux, zone, 'B1', toPlay);
      expect(defautsDeZone(f.pos, f.cible, f.zone)).toEqual([]);
      expect(verdict(f.pos, f.cible, f.zone), `trait ${toPlay}`).toBe('mort');
    }
  });

  it('avec deux yeux vrais, le groupe est vivant, même si Noir joue le premier', () => {
    const f = forme(vrai, zone, 'B1', 1);
    expect(evaluer(f.pos, f.cible, f.zone)).toBe(1);
  });
});

describe('preuve-vie-mort : trois en L dans le coin', () => {
  const rows = [E, E, E, E, E, 'XXX......', 'OOXX.....', '.OOX.....', '..OX.....'];
  const zone = ['A1', 'B1', 'A2'];

  it('Noir au trait : le coin, A1, tue, et lui seul', () => {
    const f = forme(rows, zone, 'B2', 1);
    expect(defautsDeZone(f.pos, f.cible, f.zone)).toEqual([]);
    expect(labels(coupsGagnants(f.pos, f.cible, f.zone, 'tuer'))).toEqual(['A1']);
  });

  it('Blanc au trait : A1 fait vivre, et lui seul', () => {
    const f = forme(rows, zone, 'B2', 2);
    expect(labels(coupsGagnants(f.pos, f.cible, f.zone, 'vivre'))).toEqual(['A1']);
  });
});

describe('preuve-vie-mort : prudence', () => {
  it('profondeur trop courte : non résolu, jamais une fausse preuve', () => {
    const rows = [E, E, E, E, E, 'XXXXXX...', 'XOOOOX...', 'XO..OX...', 'XO..OX...'];
    const f = forme(rows, ['C1', 'D1', 'C2', 'D2'], 'B1', 2);
    expect(evaluer(f.pos, f.cible, f.zone, { profondeur: 2 })).toBe(0);
  });

  it('avec un faux œil d’une seule pierre, c’est un ko : non résolu, quel que soit le camp au trait', () => {
    // D1 seul : Noir le prend en C1, Blanc peut reprendre en D1. Blanc au trait passe plutôt que de relier en C1.
    const rows = [E, E, E, E, E, E, 'XXXX.....', 'OOOXX....', '.O.OX....'];
    expect(verdict(fromRows(rows, 1).pos, at('B1'), zoneDe('A1', 'C1'))).toBe('non-resolu');
    expect(verdict(fromRows(rows, 2).pos, at('B1'), zoneDe('A1', 'C1'))).toBe('non-resolu');
    // Relier en C1 tue Blanc : un seul œil, A1.
    expect(issueApres(fromRows(rows, 2).pos, at('C1'), at('B1'), zoneDe('A1', 'C1'))).toBe(-1);
  });

  it('un ko compte comme non résolu', () => {
    // Blanc prend C8 en B8 : sa pierre B8 pourrait être reprise aussitôt, c'est un ko.
    const k = fromRows(['.XO......', 'X.XO.....', '.XO......', E, E, E, E, E, E], 2).pos;
    const r = play(k, at('B8')) as Position;
    expect(r.ko).toBe(at('C8'));
    expect(issueApres(k, at('B8'), at('D8'), zoneDe('B8', 'C8'))).toBe(0);
  });

  it('une zone ouverte est signalée', () => {
    const rows = [E, E, E, E, E, E, E, 'XOOOOOX..', 'XO...OX..'];
    const f = forme(rows, ['C1', 'D1', 'E1'], 'B1', 1);
    expect(defautsDeZone(f.pos, f.cible, f.zone).length).toBeGreaterThan(0);
  });
});
