import { describe, expect, it } from 'vitest';
import { ALL_PUZZLES } from '../content/puzzles';
import { checkAnswer, parsePuzzles } from '../data/puzzles';
import { fromLabel } from '../go/coords';
import { aideSuivante, recompense, refutation, reponseVue } from './aide';

const PZ = parsePuzzles(ALL_PUZZLES);
const b1 = PZ.find(p => p.id === 'b1')!;

describe('aide graduée (#197)', () => {
  it('indice, puis réfutation, puis réponse, et rien après', () => {
    expect(aideSuivante(0)).toBe(1);
    expect(aideSuivante(1)).toBe(2);
    expect(aideSuivante(2)).toBe(3);
    expect(aideSuivante(3)).toBeNull();
    expect([0, 1, 2, 3].map(n => reponseVue(n as 0 | 1 | 2 | 3))).toEqual([false, false, false, true]);
  });

  it('réfutation de b1 : après A1, Blanc s’échappe en E5', () => {
    const r = refutation(b1, fromLabel('A1', 9))!;
    expect(r.faux).toBe(fromLabel('A1', 9));
    expect(r.reponse).toBe(fromLabel('E5', 9));
    expect(r.pos.board[fromLabel('A1', 9)]).toBe(1);
    expect(r.pos.board[fromLabel('E5', 9)]).toBe(2);
    // La pierre blanche marquée (D5) est toujours là : elle s'est échappée.
    expect(r.pos.board[fromLabel('D5', 9)]).toBe(2);
  });

  it('un coup faux illégal ne se réfute pas', () => {
    expect(refutation(b1, fromLabel('D5', 9))).toBeNull();
  });

  it('chaque problème : un coup faux légal se réfute, et l’adversaire joue au point clé quand il le peut', () => {
    let avecReponse = 0;
    for (const pz of PZ) {
      const faux = pz.rows.join('').split('').findIndex((c, i) => c === '.' && checkAnswer(pz, i).kind === 'wrong');
      if (faux < 0) continue;
      const r = refutation(pz, faux);
      expect(r, pz.id).not.toBeNull();
      if (r!.reponse !== null) {
        avecReponse++;
        expect(pz.answers).toContain(r!.reponse);
        expect(r!.pos.board[r!.reponse]).toBe(3 - pz.toPlay);
      }
    }
    // Presque toujours, l'adversaire peut répondre au point clé.
    expect(avecReponse).toBeGreaterThan(PZ.length * 0.8);
  });

  it('résolu après la réponse : « Vu », sans XP ni palier ; la série du jour tient', () => {
    expect(recompense(0, false)).toEqual({ statut: 'reussi', xp: true, palier: true, serie: false });
    expect(recompense(2, true)).toEqual({ statut: 'reussi', xp: true, palier: true, serie: true });
    expect(recompense(3, false)).toEqual({ statut: 'vu', xp: false, palier: false, serie: false });
    expect(recompense(3, true)).toEqual({ statut: 'vu', xp: false, palier: false, serie: true });
  });
});
