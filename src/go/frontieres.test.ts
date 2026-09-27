import { describe, expect, it } from 'vitest';
import { coupDeFermeture, frontieresOuvertes } from './frontieres';
import { avanceEstimee, mortesSelonPropriete } from './estimation';
import { newPosition, type Color, type Position } from './rules';
import { score } from './score';
import { CAS } from '../engine/dead.fixtures';

/** X noir, O blanc ; S (noire) et T (blanche) : pierres mortes attendues. */
function lire(rows: string[], toPlay: Color = 1, captures: [number, number, number] = [0, 0, 0]): { pos: Position; dead: number[] } {
  const size = rows.length, pos = newPosition(size), dead: number[] = [];
  rows.forEach((r, y) => [...r].forEach((ch, x) => {
    const p = y * size + x;
    if (ch === 'X' || ch === 'S') pos.board[p] = 1;
    if (ch === 'O' || ch === 'T') pos.board[p] = 2;
    if (ch === 'S' || ch === 'T') dead.push(p);
  }));
  return { pos: { ...pos, toPlay, captures, lastMove: -1 }, dead };
}
const at = (size: number, x: number, y: number) => y * size + x;

// Positions finales réelles de 9 × 9 : frontière en escalier bien fermée, puis la même avec des défauts.
const ESCALIER = ['...XO....', '...XOO...', '...XXO...', '....XO...', '....XO...', '...XXO...', '...XOO...', '...XO....', '...XO....'];
const TROU = ['...XO....', '...XOO...', '...XXO...', '....XO...', '....X....', '...XXO...', '...XOO...', '...XO....', '...XO....'];
// Un point neutre (dame) au bord : il touche les deux couleurs, la position est sinon finie.
const DAME = ['...XO....', '...XOO...', '...XXO...', '....XO...', '....XO...', '...XXO...', '...XOO...', '...XO....', '...X.O...'];

describe('frontieresOuvertes (#159)', () => {
  it('plateau vide : tout est ouvert', () => {
    expect(frontieresOuvertes(newPosition(9).board, 9)).toHaveLength(81);
  });

  it('frontière en escalier fermée : rien à fermer', () => {
    const { pos } = lire(ESCALIER);
    expect(frontieresOuvertes(pos.board, 9)).toEqual([]);
  });

  it('un trou dans le mur : toute la zone blanche est ouverte, et le trou est le coup de fermeture', () => {
    const { pos } = lire(TROU, 2);
    const ouverts = frontieresOuvertes(pos.board, 9);
    expect(ouverts).toContain(at(9, 5, 4));
    expect(ouverts).toContain(at(9, 8, 0)); // la zone blanche entière touche maintenant Noir
    expect(ouverts).not.toContain(at(9, 0, 0)); // la zone noire reste fermée
    expect(coupDeFermeture(pos)).toBe(at(9, 5, 4));
    expect(coupDeFermeture({ ...pos, toPlay: 1 })).toBe(at(9, 5, 4));
  });

  it('un point neutre (dame) : il est ouvert et on le joue avant de passer', () => {
    const { pos } = lire(DAME, 2);
    expect(frontieresOuvertes(pos.board, 9)).toEqual([at(9, 4, 8)]);
    expect(coupDeFermeture(pos)).toBe(at(9, 4, 8));
  });

  it('pierres mortes retirées : la zone qui les contient reste un territoire', () => {
    const cas = CAS.find(c => c.nom.startsWith('9 × 9 : une pierre isolée'))!;
    const { pos, dead } = lire(cas.rows);
    expect(frontieresOuvertes(pos.board, 9).length).toBeGreaterThan(0);
    expect(frontieresOuvertes(pos.board, 9, dead)).toEqual([]);
    expect(coupDeFermeture(pos, dead)).toBe(-1);
  });

  it('seki : les libertés partagées sont neutres, mais aucun coup de fermeture (ce serait se mettre en atari)', () => {
    const cas = CAS.find(c => c.nom === '9 × 9 : seki sans œil, rien de mort')!;
    const { pos } = lire(cas.rows);
    expect(frontieresOuvertes(pos.board, 9)).toEqual([at(9, 4, 4), at(9, 4, 5)]);
    expect(coupDeFermeture(pos)).toBe(-1);
    expect(coupDeFermeture({ ...pos, toPlay: 2 })).toBe(-1);
  });

  it('positions finales de référence : rien à fermer une fois les pierres mortes retirées, sauf une vraie frontière ouverte', () => {
    // Exceptions voulues : un groupe vivant chez l'adversaire touche encore une zone vide de l'autre camp (par exemple
    // colonnes 8 et 9, lignes 5 à 9 en 9 × 9). Elle n'est à personne tant qu'on ne la ferme pas : on y attend un coup.
    const ouverts = ['9 × 9 : groupe blanc à un seul œil, noir vivant à deux yeux chez Blanc', '13 × 13 : groupe blanc vivant chez Noir, groupe noir mort à un œil chez Blanc'];
    for (const cas of CAS) {
      const { pos, dead } = lire(cas.rows);
      for (const c of [1, 2] as const) {
        const m = coupDeFermeture({ ...pos, toPlay: c }, dead);
        if (ouverts.includes(cas.nom)) expect(frontieresOuvertes(pos.board, pos.size, dead), cas.nom).toContain(m);
        else expect(m, cas.nom).toBe(-1);
      }
    }
  });

  it('un coup proposé par le moteur est préféré s’il ferme une frontière', () => {
    const { pos } = lire(TROU, 2);
    // (6, 4) est dans la zone ouverte, (0, 0) non : le premier coup valable de la liste gagne.
    expect(coupDeFermeture(pos, [], [at(9, 0, 0), at(9, 6, 4), at(9, 5, 4)])).toBe(at(9, 6, 4));
  });
});

/** Propriété nette d'une position finie : territoires et pierres vivantes à leur couleur, pierres mortes à l'adversaire. */
function proprieteNette(pos: Position, dead: number[]): Float32Array {
  const s = score(pos, 0, 'chinese', new Set(dead)), own = new Float32Array(pos.board.length), mort = new Set(dead);
  for (let p = 0; p < own.length; p++) {
    const v = pos.board[p];
    if (v) own[p] = (mort.has(p) ? 3 - v : v) === 1 ? 1 : -1;
    else own[p] = s.owner[p] === 1 ? 1 : s.owner[p] === 2 ? -1 : 0;
  }
  return own;
}

describe('avanceEstimee : la barre converge vers le score (#159)', () => {
  it('positions finales réelles : exactement le score japonais et chinois, komi et prisonniers compris', () => {
    for (const cas of CAS) {
      const { pos, dead } = lire(cas.rows, 1, [0, 4, 7]);
      const own = proprieteNette(pos, dead);
      expect(mortesSelonPropriete(pos, own)).toEqual([...dead].sort((a, b) => a - b));
      for (const rules of ['japanese', 'chinese'] as const) {
        const s = score(pos, 6.5, rules, new Set(dead));
        expect(avanceEstimee(pos, own, 6.5, { rules }), `${cas.nom} (${rules})`).toBeCloseTo(s.black - s.white, 6);
      }
    }
  });

  it("l'ancienne formule (somme de la propriété moins le komi) oubliait les prisonniers : écart corrigé", () => {
    const { pos, dead } = lire(ESCALIER, 1, [0, 2, 9]);
    const own = proprieteNette(pos, dead);
    const s = score(pos, 6.5, 'japanese');
    const ancienne = own.reduce((a, v) => a + v, 0) - 6.5;
    expect(Math.abs(ancienne - (s.black - s.white))).toBeGreaterThan(5); // l'écart relevé dans l'analyse UX
    expect(avanceEstimee(pos, own, 6.5)).toBeCloseTo(s.black - s.white, 6);
  });

  it('frontière ouverte : partagée selon la propriété en cours de partie, neutre au moment de compter', () => {
    const { pos } = lire(TROU, 2);
    const own = proprieteNette(lire(ESCALIER).pos, []); // l'estimation voit la zone blanche comme blanche
    own[at(9, 5, 4)] = -1;
    const ferme = score(lire(ESCALIER).pos, 6.5, 'japanese');
    // En cours de partie : la zone ira à Blanc une fois le trou bouché (Blanc y joue, un point de moins).
    expect(avanceEstimee(pos, own, 6.5)).toBeCloseTo(ferme.black - ferme.white - 1, 6);
    // Si l'on compte maintenant : la zone ouverte est neutre, exactement comme le comptage.
    const maintenant = score(pos, 6.5, 'japanese');
    expect(avanceEstimee(pos, own, 6.5, { fin: true })).toBeCloseTo(maintenant.black - maintenant.white, 6);
  });

  it('début de partie : une pierre seule ne fait pas de tout le plateau un territoire', () => {
    const pos = newPosition(9);
    pos.board[40] = 1;
    const own = new Float32Array(81).fill(0.1);
    expect(avanceEstimee({ ...pos, toPlay: 2 }, own, 6.5)).toBeCloseTo(80 * 0.1 - 6.5, 5);
  });
});
