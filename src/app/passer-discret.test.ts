// #487 (P10) : « Passer » sans fond plein tant que la partie n'est pas mûre.
import { describe, expect, it } from 'vitest';
import { avertirAvantPasse, PASSER_PLEIN_PIERRES, passerDiscret } from './partie';

function plateau(rows: string[]): Int8Array {
  const b = new Int8Array(rows.length * rows.length);
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') b[y * rows.length + x] = ch === 'X' ? 1 : 2; }));
  return b;
}

const VIDE = new Int8Array(81);
const PEU = plateau(['.........', '..X...O..', '.........', '.........', '....X....', '.........', '..X...O..', '.........', '.........']);
// Frontière fermée en colonne E/F : partie finie.
const FINIE = plateau(Array(9).fill('...XXO...'));
// 27 pierres, côté droit grand ouvert.
const OUVERTE = plateau(['...XX....', '..XX..O..', '..XX..O..', '..XX..O..', '..XX....O', '..XX..O..', '..XX..O..', '..XX..O..', '...XX.O..']);
const base = { size: 9, adversairePasse: false, evidence: false };

describe('« Passer » discret (#487)', () => {
  it('au coup 0 et en début de partie : discret', () => {
    expect(passerDiscret({ ...base, board: VIDE })).toBe(true);
    expect(passerDiscret({ ...base, board: PEU })).toBe(true);
  });

  it('frontières encore ouvertes : discret ; frontières fermées : plein', () => {
    expect(passerDiscret({ ...base, board: OUVERTE })).toBe(true);
    expect(passerDiscret({ ...base, board: FINIE })).toBe(false);
  });

  it('l’adversaire vient de passer, ou Mochi conseille de passer : plein, même sur un plateau vide', () => {
    expect(passerDiscret({ ...base, board: VIDE, adversairePasse: true })).toBe(false);
    expect(passerDiscret({ ...base, board: PEU, evidence: true })).toBe(false);
  });

  it('filet : 60 % du plateau couvert, plein même si les frontières semblent ouvertes', () => {
    const n = Math.ceil(PASSER_PLEIN_PIERRES * 81);
    // Pierres noires et blanches alternées, dans l'ordre de lecture : le reste du plateau est une grande frontière ouverte.
    const b = new Int8Array(81);
    for (let i = 0; i < n; i++) b[i] = i % 2 ? 2 : 1;
    expect(passerDiscret({ ...base, board: b })).toBe(false);
    const moins = b.slice(); moins[n - 1] = 0;
    // Une pierre de moins : la règle des frontières décide de nouveau (le bas du plateau, vide, touche les deux couleurs).
    expect(passerDiscret({ ...base, board: moins })).toBe(true);
  });

  it('même règle que l’avertissement de Mochi : jamais plein pendant qu’il dirait « il reste de la place »', () => {
    const contexte = { contreOrdi: true, aide: true, premieresParties: true, adversairePasse: false, size: 9 };
    for (const board of [VIDE, PEU, OUVERTE, FINIE]) {
      if (avertirAvantPasse({ ...contexte, board })) expect(passerDiscret({ ...base, board })).toBe(true);
    }
  });

  it('13 × 13 et 19 × 19 : plateau vide discret', () => {
    expect(passerDiscret({ ...base, size: 13, board: new Int8Array(169) })).toBe(true);
    expect(passerDiscret({ ...base, size: 19, board: new Int8Array(361) })).toBe(true);
  });
});
