// #488 : Pomme (et les autres adversaires faibles) ne jouent plus leurs premiers coups au bord, ni la 1re ligne
// sans raison. Mesures et réglages : docs/game-design/ouverture-pomme-2026-10-08.md.
import { describe, expect, it } from 'vitest';
import { newPosition, play, type Color, type Position } from '../go/rules';
import { score } from '../go/score';
import { chooseMove, opponent, type Opponent } from './simple';
import { deadStones } from './dead';
import { CRANS } from './guidee';
import { COUPS_OUVERTURE, coupPlausible, coupsTactiques, enOuverture, ligne, plausibles, ZONE_OUVERTURE } from './ouverture';
import { isEye, rng } from './sim';

const SANS_LIMITE = 600_000;

function lire(rows: string[], toPlay: Color): Position {
  const size = rows.length, pos = newPosition(size);
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') pos.board[y * size + x] = ch === 'X' ? 1 : 2; }));
  return { ...pos, toPlay, lastMove: null };
}

/** Coup au hasard d'un débutant (jamais dans ses yeux). */
function auHasard(pos: Position, r: () => number): number {
  const ok = [...pos.board.keys()].filter(p => !pos.board[p] && !isEye(pos.board, pos.size, p, pos.toPlay) && typeof play(pos, p) !== 'string');
  return ok.length ? ok[Math.floor(r() * ok.length)] : -1;
}

/** Premiers coups de `lvl` en Blanc contre un débutant au hasard : lignes jouées, `n` coups par partie. */
function premiersCoups(lvl: Opponent, size: number, parties: number, n: number, playouts: number): number[] {
  const lignes: number[] = [];
  for (let g = 0; g < parties; g++) {
    const r = rng(488 + g);
    let pos = newPosition(size);
    while (lignes.length < (g + 1) * n) {
      const m = pos.toPlay === 1 ? auHasard(pos, r) : chooseMove(pos, lvl, { seed: 1000 * g + lignes.length, timeMs: SANS_LIMITE, playouts, komi: 0.5 });
      if (pos.toPlay === 2) lignes.push(m < 0 ? 0 : ligne(m, size));
      pos = play(pos, m) as Position;
    }
  }
  return lignes;
}

describe('lignes et ouverture', () => {
  it('ligne depuis le bord le plus proche', () => {
    expect(ligne(0, 9)).toBe(1); // A9
    expect(ligne(9 * 8 + 1, 9)).toBe(1); // B1
    expect(ligne(9 * 7 + 1, 9)).toBe(2); // B2
    expect(ligne(9 * 6 + 2, 9)).toBe(3); // C3
    expect(ligne(40, 9)).toBe(5); // E5, le centre
    expect(ligne(13 * 3 + 3, 13)).toBe(4); // D10
  });

  it('constantes : 3e et 4e ligne (et le centre sur 9 × 9), pendant les 3, 4 ou 6 premiers coups', () => {
    expect(COUPS_OUVERTURE).toEqual({ 9: 3, 13: 4, 19: 6 });
    expect(ZONE_OUVERTURE).toEqual({ 9: [3, 4, 5], 13: [3, 4], 19: [3, 4] });
    for (const z of Object.values(ZONE_OUVERTURE)) expect(z).not.toContain(1);
    for (const z of Object.values(ZONE_OUVERTURE)) expect(z).not.toContain(2);
  });

  it('ouverture : comptée sur les pierres du joueur au trait', () => {
    const vide = newPosition(9);
    expect(enOuverture(vide)).toBe(true);
    const pos = lire(['.........', '..X......', '.........', '......X..', '.........', '.........', '..X...O..', '.........', '.........'], 2);
    expect(enOuverture(pos)).toBe(true); // Blanc n'a qu'une pierre
    expect(enOuverture({ ...pos, toPlay: 1 })).toBe(false); // Noir en a 3
  });
});

describe('aucun premier coup au bord (#488)', () => {
  it('Pomme, 9 × 9 : ses 3 premiers coups sur la 3e ligne ou plus loin, sur 300 tirages', () => {
    const l = premiersCoups(opponent('pomme'), 9, 100, 3, 60);
    expect(l).toHaveLength(300);
    expect(l.filter(x => x <= 2)).toEqual([]);
  }, 60_000);

  it('Pomme, 13 × 13 : ses 4 premiers coups sur la 3e ou la 4e ligne, sur 120 tirages', () => {
    const l = premiersCoups(opponent('pomme'), 13, 30, 4, 60);
    expect(l.filter(x => x !== 3 && x !== 4)).toEqual([]);
  }, 60_000);

  it('crans de Mochi plus doux que Pomme (hasard 0,9 et 0,8) : pas de premier coup au bord non plus', () => {
    for (const cran of CRANS.slice(0, 2)) expect(premiersCoups(cran, 9, 50, 3, 60).filter(x => x <= 2)).toEqual([]);
  }, 60_000);

  it('Caillou, 9 × 9 : ses 3 premiers coups hors des deux premières lignes', () => {
    expect(premiersCoups(opponent('caillou'), 9, 8, 3, 1500).filter(x => x <= 2)).toEqual([]);
  }, 60_000);

  it('témoin : sans le filtre, Pomme jouait au bord (le test mesure bien quelque chose)', () => {
    const l = premiersCoups({ ...opponent('pomme'), ouverture: false }, 9, 100, 3, 60);
    expect(l.filter(x => x <= 2).length).toBeGreaterThan(60);
  }, 60_000);
});

describe('pas de 1re ligne sans raison', () => {
  it('parties entières contre un débutant au hasard : chaque coup de Pomme en 1re ligne capture, sauve, ou touche une pierre en fin de partie', () => {
    let bord = 0, coups = 0;
    for (let g = 0; g < 12; g++) {
      const r = rng(9000 + g);
      let pos = newPosition(9), passes = 0;
      for (let n = 0; n < 140 && passes < 2; n++) {
        let m: number;
        if (pos.toPlay === 1) m = auHasard(pos, r);
        else {
          m = chooseMove(pos, 'pomme', { seed: g * 1000 + n, timeMs: SANS_LIMITE, playouts: 60, komi: 0.5 });
          if (m >= 0) {
            coups++;
            if (ligne(m, 9) === 1) { bord++; expect(coupPlausible(pos, false)(m), `partie ${g}, coup ${n}`).toBe(true); }
          }
        }
        passes = m < 0 ? passes + 1 : 0;
        pos = play(pos, m) as Position;
      }
    }
    expect(coups).toBeGreaterThan(300);
    console.info(`[#488] Pomme : ${bord} coups en 1re ligne sur ${coups}, tous justifiés`);
  }, 60_000);

  it('une capture en 1re ligne reste permise, même pendant l’ouverture', () => {
    // Blanc (2 pierres) peut prendre la pierre noire en A1 (atari) en jouant B1.
    const pos = lire(['.........', '.........', '.........', '.........', '.........', '.........', '.........', 'O........', 'X.....O..'], 2);
    const B1 = 8 * 9 + 1;
    expect(enOuverture(pos)).toBe(true);
    expect(coupsTactiques(pos).has(B1)).toBe(true);
    expect(coupPlausible(pos)(B1)).toBe(true);
    expect(chooseMove(pos, 'caillou', { seed: 1, timeMs: SANS_LIMITE, playouts: 500 })).toBe(B1);
  });

  it('un sauvetage en 1re ligne reste permis', () => {
    // La pierre blanche en B1 est en atari (A1 et B2 noirs) : C1 lui rend deux libertés (D1, C2).
    const pos = lire(['.........', '.........', '.........', '.........', '.........', '.........', '.........', '.X.......', 'XO.......'], 2);
    const C1 = 8 * 9 + 2;
    expect(coupsTactiques(pos).has(C1)).toBe(true);
    expect(coupPlausible(pos)(C1)).toBe(true);
    expect(coupPlausible(pos)(8 * 9 + 6)).toBe(false); // G1 : rien à sauver là
  });

  it('rien de plausible : la liste reste entière (l’ordi ne passe jamais à cause du filtre)', () => {
    const pos = newPosition(9);
    const bords = [0, 1, 2, 9, 18];
    expect(plausibles(pos, bords, m => m)).toEqual(bords);
    // Zone d'ouverture vide mais 2e ligne libre : la règle d'après l'ouverture s'applique.
    expect(plausibles(pos, [0, 10], m => m)).toEqual([10]);
  });
});

describe('Pomme reste aussi battable (#488)', () => {
  /**
   * Proxy du banc (ouverture.bench.test.ts) : un débutant simulé de la force de l'ancienne Pomme (hasard 0,3, sans filtre)
   * joue Noir contre Pomme, komi 0,5 (premières parties). Avant #488, Pomme gagnait 35 parties sur 80 (44 %) ; avec le
   * filtre et hasard 0,65, 34 sur 80 (42 %). Ici 16 parties à graines fixes : Pomme doit en gagner entre 3 et 10
   * (cible 65-80 % des marches de l'échelle pour le plus fort : Pomme ne doit jamais devenir une marche).
   */
  it('16 parties contre l’ancienne Pomme : Pomme en gagne entre 3 et 10', async () => {
    const ancienne: Opponent = { ...opponent('pomme'), hasard: 0.3, ouverture: false };
    let gagnees = 0;
    for (let g = 0; g < 16; g++) {
      let pos = newPosition(9), passes = 0;
      for (let n = 0; n < 200 && passes < 2; n++) {
        const lvl = pos.toPlay === 1 ? ancienne : opponent('pomme');
        let m = chooseMove(pos, lvl, { seed: (4880 + g) * 1000 + n, timeMs: SANS_LIMITE, playouts: 250, komi: 0.5, accommodant: pos.toPlay === 2 });
        if (m >= 0 && typeof play(pos, m) === 'string') m = -1;
        passes = m < 0 ? passes + 1 : 0;
        pos = m < 0 ? { ...pos, ko: -1, toPlay: (3 - pos.toPlay) as Color, lastMove: -1 } : (play(pos, m) as Position);
      }
      if (score(pos, 0.5, 'chinese', new Set(deadStones(pos, { seed: 4880 + g, playouts: 400, timeMs: SANS_LIMITE }))).winner === 2) gagnees++;
      await new Promise(r => setTimeout(r, 0));
    }
    console.info(`[#488] Pomme gagne ${gagnees} parties sur 16 contre l’ancienne Pomme`);
    expect(gagnees).toBeGreaterThanOrEqual(3);
    expect(gagnees).toBeLessThanOrEqual(10);
  }, 120_000);
});
