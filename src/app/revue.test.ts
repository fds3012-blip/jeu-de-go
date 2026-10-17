import { describe, expect, it } from 'vitest';
import { newPosition, play, type Position } from '../go/rules';
import { fromLabel } from '../go/coords';
import { conseilFiable, courbe, positionsDepuisSgf, rejouerDici, resultatSgf, sgfDepuisHistorique } from './revue';
import { readSgf } from '../go/sgf';

/** Joue une suite de coups (« E5 », « passe ») sur un 9 × 9 et renvoie l'historique. */
function partie(coups: string[], size = 9): Position[] {
  const h = [newPosition(size)];
  for (const c of coups) {
    const r = play(h[h.length - 1], c === 'passe' ? -1 : fromLabel(c, size));
    if (typeof r === 'string') throw new Error(`${c} : ${r}`);
    h.push(r);
  }
  return h;
}

describe('SGF de la partie', () => {
  it('écrit les coups et les passes (tt), puis reconstruit chaque position', () => {
    const h = partie(['E5', 'D5', 'C3', 'passe', 'passe']);
    const sgf = sgfDepuisHistorique(h, 6.5, { noir: 'Toi', blanc: 'Pomme' });
    expect(sgf).toContain('SZ[9]KM[6.5]');
    expect(sgf).toContain(';B[ee];W[de];B[cg];W[tt];B[tt])');
    const { positions, komi } = positionsDepuisSgf(sgf);
    expect(komi).toBe(6.5);
    expect(positions).toHaveLength(h.length);
    positions.forEach((p, i) => { expect(Array.from(p.board)).toEqual(Array.from(h[i].board)); expect(p.toPlay).toBe(h[i].toPlay); });
  });

  it('reconstruit une capture réelle : la pierre prise disparaît', () => {
    // Blanc en A9 (coin) capturé par Noir en B9 puis A8.
    const h = partie(['B9', 'A9', 'A8']);
    const { positions } = positionsDepuisSgf(sgfDepuisHistorique(h, 6.5));
    const fin = positions[3];
    expect(fin.board[fromLabel('A9', 9)]).toBe(0);
    expect(fin.captures[1]).toBe(1);
  });
});

describe('conseilFiable', () => {
  const ouvert = partie(['E5', 'D5', 'C3'])[3];

  it('accepte un bon coup légal, loin du bord, qui gagne au moins un point', () => {
    expect(conseilFiable(ouvert, fromLabel('C7', 9), 3)).toBe(true);
  });

  it('refuse la première ligne tant que le plateau est ouvert (A9 dans le coin)', () => {
    expect(conseilFiable(ouvert, fromLabel('A9', 9), 5)).toBe(false);
    expect(conseilFiable(ouvert, fromLabel('E1', 9), 5)).toBe(false);
  });

  it('accepte la première ligne quand le plateau est bien rempli', () => {
    const plein = newPosition(9);
    for (let p = 20; p < 50; p++) plein.board[p] = p % 2 ? 1 : 2;
    expect(conseilFiable(plein, fromLabel('A9', 9), 5)).toBe(true);
  });

  it('refuse un coup illégal, une passe ou rien', () => {
    expect(conseilFiable(ouvert, fromLabel('E5', 9), 5)).toBe(false); // occupé
    expect(conseilFiable(ouvert, -1, 5)).toBe(false);
    expect(conseilFiable(ouvert, null, 5)).toBe(false);
    expect(conseilFiable(ouvert, 999, 5)).toBe(false);
  });

  it("refuse un coup qui n'améliore pas l'estimation", () => {
    expect(conseilFiable(ouvert, fromLabel('C7', 9), 0.5)).toBe(false);
    expect(conseilFiable(ouvert, fromLabel('C7', 9), -2)).toBe(false);
    expect(conseilFiable(ouvert, fromLabel('C7', 9), Number.NaN)).toBe(false);
  });
});

describe("rejouer d'ici", () => {
  const h = partie(['E5', 'D5', 'C3', 'E4', 'G7']);

  it('reprend juste avant le coup fautif, Noir au trait', () => {
    const r = rejouerDici(h, 5, 1);
    expect(r).toHaveLength(5);
    expect(r[r.length - 1].toPlay).toBe(1);
    expect(r[r.length - 1].board[fromLabel('G7', 9)]).toBe(0);
  });

  it('recule d’un coup si le coup choisi est celui de Blanc', () => {
    const r = rejouerDici(h, 4, 1);
    expect(r).toHaveLength(3);
    expect(r[2].toPlay).toBe(1);
  });

  it('au début, garde au moins le plateau vide', () => {
    expect(rejouerDici(h, 0, 1)).toHaveLength(1);
    expect(rejouerDici(h, 1, 1)).toHaveLength(1);
  });
});

describe('courbe', () => {
  it('Noir en tête fait monter la courbe ; égalité au milieu', () => {
    const { ligne, aire } = courbe([0, 20, -20], 100, 60, 9);
    const ys = ligne.slice(1).split('L').map(s => Number(s.split(' ')[1]));
    expect(ys[0]).toBe(30);
    expect(ys[1]).toBeLessThan(30);
    expect(ys[2]).toBeGreaterThan(30);
    expect(aire.endsWith('Z')).toBe(true);
  });

  it('une valeur inconnue reprend la précédente', () => {
    const { ligne } = courbe([5, null], 100, 60, 9);
    const ys = ligne.slice(1).split('L').map(s => s.split(' ')[1]);
    expect(ys[0]).toBe(ys[1]);
  });
});

describe('résultat dans le SGF (#187)', () => {
  it("écrit RE avec l'écart exact, l'abandon ou l'égalité", () => {
    expect(resultatSgf(1, false, 3.5)).toBe('B+3.5');
    expect(resultatSgf(2, false, 12)).toBe('W+12');
    expect(resultatSgf(2, true, 0)).toBe('W+R');
    expect(resultatSgf(0, false, 0)).toBe('0');
    const h = partie(['E5', 'passe', 'passe']);
    const texte = sgfDepuisHistorique(h, 6.5, { noir: 'Toi', blanc: 'Pomme', resultat: 'B+18.5' });
    expect(texte).toContain('RE[B+18.5]');
    expect(readSgf(texte).result).toBe('B+18.5');
    expect(positionsDepuisSgf(texte).positions).toHaveLength(h.length);
  });
});

describe('partie importée avec handicap (#286)', () => {
  it('la revue part des pierres de handicap, Blanc au trait', () => {
    const { positions, komi } = positionsDepuisSgf('(;GM[1]SZ[19]KM[0.5]HA[2]AB[pd][dp];W[dd];B[pp])');
    expect(komi).toBe(0.5);
    expect(positions).toHaveLength(3);
    expect(positions[0].board.filter(c => c === 1)).toHaveLength(2);
    expect(positions[0].toPlay).toBe(2);
    expect(positions[2].board.filter(c => c === 1)).toHaveLength(3);
  });
});
