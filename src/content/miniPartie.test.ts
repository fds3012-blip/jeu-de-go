// #715 : preuves de la mini-partie (src/content/miniPartie.ts). Suivre l'aide de Mochi gagne contre TOUTES les réponses
// de Pomme (parcours exhaustif, passe comprise), sur chaque départ ; Pomme, elle, joue vraiment (elle prend quand elle peut).
import { describe, expect, it } from 'vitest';
import { MINI_AIDE_APRES, MINI_CAPTURES, MINI_DEPARTS, MINI_ORDRE, MINI_TAILLE, aideMini, coupsLegaux, departMini, pommeJoue } from './miniPartie';
import { groupAt, play, type Position } from '../go/rules';
import { toLabel } from '../go/coords';
import { fromRows } from '../go/position';

const ok = (r: Position | string): Position => { if (typeof r === 'string') throw new Error(r); return r; };

/** Générateur déterministe (mulberry32). */
function graine(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

describe('mini-partie : les départs', () => {
  for (const nom of MINI_ORDRE) {
    it(`${nom} : 5 × 5, chaque pierre blanche n’a qu’une liberté, aucune pierre noire n’est en atari`, () => {
      const pos = departMini(MINI_ORDRE.indexOf(nom));
      expect(pos.size).toBe(MINI_TAILLE);
      expect(MINI_DEPARTS[nom]).toHaveLength(MINI_TAILLE);
      const blanches = [...pos.board.keys()].filter(p => pos.board[p] === 2);
      expect(blanches.length).toBe(nom === 'quatreCoins' ? 4 : 3);
      for (const p of blanches) expect(groupAt(pos.board, MINI_TAILLE, p).liberties.size, toLabel(p, MINI_TAILLE)).toBe(1);
      for (const p of [...pos.board.keys()].filter(q => pos.board[q] === 1)) expect(groupAt(pos.board, MINI_TAILLE, p).liberties.size).toBeGreaterThanOrEqual(3);
      expect(pos.toPlay).toBe(1);
      expect(pos.captures).toEqual([0, 0, 0]);
    });
  }

  it('les départs alternent, et il y a autant de pierres à prendre que de captures pour gagner (ou plus)', () => {
    expect(toLabel(0, 5)).toBe('A5');
    expect(departMini(0).board).toEqual(departMini(2).board);
    expect(departMini(0).board).not.toEqual(departMini(1).board);
    for (const nom of MINI_ORDRE) expect(MINI_DEPARTS[nom].join('').split('O').length - 1).toBeGreaterThanOrEqual(MINI_CAPTURES);
  });
});

describe('mini-partie : l’aide de Mochi gagne contre toutes les réponses de Pomme', () => {
  /** Noir suit l'aide ; Pomme joue n'importe quel coup permis, ou passe. Renvoie le nombre de feuilles et le plus long parcours (coups de Noir). */
  function parcourir(pos: Position, coupsNoir: number, stats = { feuilles: 0, maxCoups: 0 }) {
    const aide = aideMini(pos);
    expect(aide, 'Noir a toujours un coup').not.toBeNull();
    const apres = ok(play(pos, aide!.p));
    const n = coupsNoir + 1;
    expect(n, 'la partie ne traîne pas').toBeLessThanOrEqual(MINI_CAPTURES + 1);
    if (apres.captures[1] >= MINI_CAPTURES) { stats.feuilles++; stats.maxCoups = Math.max(stats.maxCoups, n); return stats; }
    expect(apres.captures[2], 'Pomme ne gagne jamais').toBeLessThan(MINI_CAPTURES);
    for (const q of [...coupsLegaux(apres), -1]) parcourir(ok(play(apres, q)), n, stats);
    return stats;
  }

  for (const nom of MINI_ORDRE) {
    it(`${nom} : victoire de Noir en ${MINI_CAPTURES} coups au plus, quoi que joue Pomme`, () => {
      const s = parcourir(departMini(MINI_ORDRE.indexOf(nom)), 0);
      expect(s.feuilles).toBeGreaterThan(100); // des centaines de réponses de Pomme essayées, aucune n'échappe
      expect(s.maxCoups).toBeLessThanOrEqual(MINI_CAPTURES);
    });
  }

  it('l’aide montre toujours une capture tant qu’il y en a une, et dit son type', () => {
    const pos = departMini(0);
    const a = aideMini(pos)!;
    expect(a.type).toBe('capture');
    expect(ok(play(pos, a.p)).captures[1]).toBeGreaterThan(0);
  });

  it('1 000 parties jouées avec l’aide contre la vraie Pomme (au hasard, elle prend quand elle peut) : 1 000 victoires', () => {
    for (let g = 0; g < 1000; g++) {
      const rng = graine(g + 1);
      let pos = departMini(g), coups = 0;
      while (pos.captures[1] < MINI_CAPTURES && pos.captures[2] < MINI_CAPTURES && coups < 40) {
        pos = ok(play(pos, aideMini(pos)!.p));
        coups++;
        if (pos.captures[1] >= MINI_CAPTURES) break;
        pos = ok(play(pos, pommeJoue(pos, rng)));
      }
      expect(pos.captures[1], `partie ${g}`).toBeGreaterThanOrEqual(MINI_CAPTURES);
      expect(pos.captures[2]).toBeLessThan(MINI_CAPTURES);
      expect(coups).toBeLessThanOrEqual(MINI_CAPTURES);
    }
  });
});

describe('mini-partie : Pomme joue pour de vrai', () => {
  it('elle prend une pierre quand elle peut, joue un coup permis sinon, passe seulement sans coup', () => {
    // Noir en B1 n'a plus qu'une liberté (C1) : Pomme y joue et le prend.
    const pos = fromRows(['.....', '.....', '.....', '.O...', 'OX...'], 2).pos;
    const p = pommeJoue(pos, () => 0.5);
    expect(toLabel(p, 5)).toBe('C1');
    expect(ok(play(pos, p)).captures[2]).toBe(1);
    // Sans prise possible : un coup permis, au hasard (deux graines, deux coups possibles différents).
    const vide = { ...departMini(0), toPlay: 2 as const };
    const choix = new Set([0, 0.3, 0.6, 0.99].map(r => pommeJoue(vide, () => r)));
    expect(choix.size).toBeGreaterThan(1);
    for (const q of choix) expect(typeof play(vide, q)).not.toBe('string');
  });

  it('Noir qui pose ses pierres au hasard perd moins d’une partie sur quatre : Pomme est une débutante, pas un piège', () => {
    let perdues = 0;
    for (let g = 0; g < 500; g++) {
      const rng = graine(10_000 + g);
      let pos = departMini(g), coups = 0;
      while (pos.captures[1] < MINI_CAPTURES && pos.captures[2] < MINI_CAPTURES && coups < 60) {
        const l = coupsLegaux(pos);
        pos = ok(play(pos, l.length ? l[Math.floor(rng() * l.length)] : -1));
        if (pos.captures[1] >= MINI_CAPTURES) break;
        pos = ok(play(pos, pommeJoue(pos, rng)));
        coups++;
      }
      if (pos.captures[2] >= MINI_CAPTURES) perdues++;
    }
    expect(perdues / 500).toBeLessThan(0.25); // mesuré : 17 % pour un joueur qui pose ses pierres au hasard
  });

  it('les délais et seuils sont des constantes nommées sensées', () => {
    expect(MINI_AIDE_APRES).toBeGreaterThanOrEqual(1);
    expect(MINI_AIDE_APRES).toBeLessThanOrEqual(3);
  });
});
