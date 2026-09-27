import { describe, expect, it } from 'vitest';
import { newPosition, play, type Position } from '../go/rules';
import { fromLabel } from '../go/coords';
import { AUCUNE_ERREUR, conseilFiable, courbe, grossesErreurs, phraseErreur, positionsDepuisSgf, rejouerDici, sgfDepuisHistorique } from './revue';

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

describe('grossesErreurs', () => {
  const h = partie(['E5', 'D5', 'C3', 'E4', 'G7', 'F5', 'passe', 'passe']);
  // Avance de Noir après chaque position (index 0 : plateau vide).
  const avances = [-6.5, 2, 1, 0, 3, -5, 4, -8, -8];

  it('garde les 3 plus fortes chutes du joueur Noir, de la plus grosse à la plus petite', () => {
    // Coups de Noir : 1 (+8,5), 3 (-1), 5 (-8), 7 (-12).
    expect(grossesErreurs(h, avances, 1)).toEqual([{ coup: 7, perte: 12 }, { coup: 5, perte: 8 }, { coup: 3, perte: 1 }]);
  });

  it("écarte les chutes de moins d'un point : c'est du bruit", () => {
    expect(grossesErreurs(h, [0, 0, 0, -0.9, 0, -0.5, 0, -0.99, 0], 1)).toEqual([]);
    expect(AUCUNE_ERREUR).toBe('Aucune grosse erreur. Bien joué !');
  });

  it('pour Blanc, une hausse de Noir est une perte', () => {
    expect(grossesErreurs(h, avances, 2).map(e => e.coup)).toEqual([6, 4]);
  });

  it('sans joueur désigné (partie à deux), prend les deux couleurs et en garde 3', () => {
    expect(grossesErreurs(h, avances, null)).toEqual([{ coup: 7, perte: 12 }, { coup: 6, perte: 9 }, { coup: 5, perte: 8 }]);
  });

  it('ignore les positions non analysées', () => {
    expect(grossesErreurs(h, [9, null, 5, -9], 1)).toEqual([{ coup: 3, perte: 14 }]);
    expect(grossesErreurs(h, [9, -9, null, -9], 1)).toEqual([{ coup: 1, perte: 18 }]);
  });

  it("phrase de Mochi sans conseil : décrit l'erreur, sans aucune coordonnée", () => {
    expect(phraseErreur({ coup: 5, perte: 2.2 }, h, null)).toBe('Ici tu as perdu environ 2 points.');
    expect(phraseErreur({ coup: 7, perte: 12 }, h, null)).toBe('Tu as passé trop tôt : il restait des points à prendre.');
    expect(phraseErreur({ coup: 5, perte: 14 }, h, -1)).toBe('Ici tu as perdu environ 14 points.');
    for (const e of [{ coup: 5, perte: 2 }, { coup: 7, perte: 3 }]) expect(phraseErreur(e, h, null)).not.toMatch(/[A-HJ-T][1-9]/);
  });

  it('phrase de Mochi avec un conseil fiable de KataGo : la pierre verte', () => {
    expect(phraseErreur({ coup: 5, perte: 8 }, h, fromLabel('C7', 9))).toBe('Ici tu as perdu environ 8 points. Essaie plutôt C7, la pierre verte.');
  });

  it("phrase de Mochi : l'adversaire capture juste après", () => {
    const c = partie(['A9', 'B9', 'E5', 'A8']);
    expect(phraseErreur({ coup: 3, perte: 3 }, c, null)).toBe("Après ce coup, l'adversaire capture une pierre. Tu perds environ 3 points.");
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
