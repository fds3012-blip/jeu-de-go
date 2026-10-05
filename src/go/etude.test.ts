import { describe, expect, it } from 'vitest';
import { fromLabel, toLabel } from './coords';
import { readSgf } from './sgf';
import { etudeDepuisSgf, etudeVersSgf, etudeVide, jouerVariante, lireEtude, pierresPosees, poser, positionsEtude, type Etude } from './etude';

// #372 : goban libre, variante, retour à la position de départ, export SGF relu par l'import.
const at = (l: string, n = 9) => fromLabel(l, n);
function ok<T>(r: T | string): T { if (typeof r === 'string') throw new Error(r); return r; }

describe('poser une position', () => {
  it('pose, remplace et enlève des pierres', () => {
    let e = etudeVide(9);
    e = ok(poser(e, at('D4'), 'noir'));
    e = ok(poser(e, at('E5'), 'blanc'));
    expect(pierresPosees(e)).toBe(2);
    e = ok(poser(e, at('E5'), 'noir')); // remplace la blanche
    expect(e.depart[at('E5')]).toBe(1);
    e = ok(poser(e, at('E5'), 'noir')); // même couleur : enlève
    expect(e.depart[at('E5')]).toBe(0);
    e = ok(poser(e, at('D4'), 'effacer'));
    expect(pierresPosees(e)).toBe(0);
  });
  it('refuse une pierre qui laisserait un groupe sans liberté (rien n’est capturé en posant)', () => {
    let e = etudeVide(9);
    for (const l of ['A2', 'B1']) e = ok(poser(e, at(l), 'noir'));
    expect(poser(e, at('A1'), 'blanc')).toBe('sansLiberte');
    // La noire en B1 qui fermerait la dernière liberté d'une blanche posée en A1 est refusée aussi.
    let f = ok(poser(etudeVide(9), at('A1'), 'blanc'));
    f = ok(poser(f, at('A2'), 'noir'));
    expect(poser(f, at('B1'), 'noir')).toBe('sansLiberte');
  });
});

describe('variante', () => {
  const depart = (): Etude => {
    let e = etudeVide(9);
    for (const l of ['C3', 'D4', 'E3']) e = ok(poser(e, at(l), 'noir'));
    for (const l of ['D3', 'G7']) e = ok(poser(e, at(l), 'blanc'));
    return e;
  };
  it('se joue avec les règles (prise) et laisse la position de départ intacte', () => {
    const e = depart();
    const avant = e.depart.slice();
    let v = ok(jouerVariante(e, at('D2'))); // Noir prend D3
    expect(positionsEtude(v).at(-1)!.board[at('D3')]).toBe(0);
    v = ok(jouerVariante(v, at('F5')));
    expect(v.variante.map(p => toLabel(p, 9))).toEqual(['D2', 'F5']);
    expect([...v.depart]).toEqual([...avant]);
    const revenu = { ...v, variante: [] };
    expect(positionsEtude(revenu)).toHaveLength(1);
    expect(positionsEtude(revenu)[0].board[at('D3')]).toBe(2);
  });
  it('refuse le ko et le suicide', () => {
    let e = etudeVide(9);
    for (const l of ['B1', 'A2']) e = ok(poser(e, at(l), 'noir'));
    e = { ...e, trait: 2 };
    expect(jouerVariante(e, at('A1'))).toBe('suicide');
    expect(jouerVariante(e, at('B1'))).toBe('occupe');
    let k = etudeVide(9);
    for (const l of ['B1', 'A2', 'B3']) k = ok(poser(k, at(l), 'noir'));
    for (const l of ['C1', 'D2', 'C3', 'B2']) k = ok(poser(k, at(l), 'blanc'));
    k = ok(jouerVariante(k, at('C2'))); // Noir prend B2
    expect(jouerVariante(k, at('B2'))).toBe('ko');
  });
});

describe('SGF', () => {
  it('export relu à l’identique (position, trait, variante) et par la lecture SGF de l’import', () => {
    let e = etudeVide(13);
    for (const l of ['D4', 'K10']) e = ok(poser(e, at(l, 13), 'noir'));
    e = ok(poser(e, at('C3', 13), 'blanc'));
    e = { ...e, trait: 2 };
    e = ok(jouerVariante(e, at('D10', 13)));
    e = ok(jouerVariante(e, -1));
    const sgf = etudeVersSgf(e);
    expect(sgf).toContain('AB[');
    expect(sgf).toContain('PL[W]');
    const g = readSgf(sgf);
    expect(g.size).toBe(13);
    expect(g.moves).toEqual([{ color: 2, p: at('D10', 13) }, { color: 1, p: -1 }]);
    const relue = etudeDepuisSgf(sgf)!;
    expect(relue.size).toBe(13);
    expect(relue.trait).toBe(2);
    expect([...relue.depart]).toEqual([...e.depart]);
    expect(relue.variante).toEqual(e.variante);
    expect(lireEtude({ sgf })?.variante).toEqual(e.variante);
  });
  it('refuse ce qui n’est pas une étude lisible', () => {
    expect(etudeDepuisSgf('pas un sgf')).toBeNull();
    expect(lireEtude(null)).toBeNull();
    expect(lireEtude({ sgf: 3 })).toBeNull();
  });
});
