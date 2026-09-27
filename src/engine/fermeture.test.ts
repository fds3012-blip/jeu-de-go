// Politique de passe (#159) : l'adversaire ne passe pas tant qu'une frontière reste ouverte ; il la ferme.
import { afterEach, describe, expect, it } from 'vitest';
import { bestMove, chooseMove, OPPONENTS, opponent, setKataGo, type Analysis, type KataGoBackend } from './index';
import { avanceEstimee, deadStones, ownershipSimple } from './index';
import { CAS } from './dead.fixtures';
import { score } from '../go/score';
import { frontieresOuvertes } from '../go/frontieres';
import { newPosition, play, type Color, type Position } from '../go/rules';

function lire(rows: string[], toPlay: Color): Position {
  const size = rows.length, pos = newPosition(size);
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') pos.board[y * size + x] = ch === 'X' ? 1 : 2; }));
  return { ...pos, toPlay, lastMove: -1 }; // le joueur vient de passer
}
const at = (x: number, y: number) => y * 9 + x;

// Parties de débutant arrêtées trop tôt : le joueur (Noir) passe alors qu'il reste des points à fermer.
const DAME = ['...XO....', '...XOO...', '...XXO...', '....XO...', '....XO...', '...XXO...', '...XOO...', '...XO....', '...X.O...'];
const TROU = ['...XO....', '...XOO...', '...XXO...', '....XO...', '....X....', '...XXO...', '...XOO...', '...XO....', '...XO....'];
const FINIE = ['...XO....', '...XOO...', '...XXO...', '....XO...', '....XO...', '...XXO...', '...XOO...', '...XO....', '...XO....'];

describe('politique de passe : fermer les frontières (#159)', () => {
  afterEach(() => setKataGo(undefined));

  it('tous les niveaux ferment leurs frontières, débutants compris', () => {
    for (const o of OPPONENTS) expect(o.fermeFrontieres, o.id).toBe(true);
  });

  it('Pomme et Caillou jouent le point neutre au lieu de passer', () => {
    for (const id of ['pomme', 'caillou'] as const) {
      for (let seed = 1; seed <= 5; seed++) {
        expect(chooseMove(lire(DAME, 2), id, { seed, timeMs: 50 }), `${id} graine ${seed}`).toBe(at(4, 8));
      }
    }
  });

  it('mur percé : Pomme ne passe pas (elle joue, même maladroitement) ; mur fermé : elle passe', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const m = chooseMove(lire(TROU, 2), 'pomme', { seed, timeMs: 50 });
      expect(m).not.toBe(-1);
    }
    for (let seed = 1; seed <= 5; seed++) expect(chooseMove(lire(FINIE, 2), 'pomme', { seed, timeMs: 50 })).toBe(-1);
  });

  it('partie jouée jusqu’au bout : Pomme finit par passer, sans frontière ouverte', () => {
    // Noir passe à chaque tour ; Pomme ferme ce qui reste, puis passe.
    let pos = lire(DAME, 2);
    for (let i = 0; i < 10; i++) {
      const m = chooseMove(pos, 'pomme', { seed: i + 1, timeMs: 50 });
      if (m === -1) break;
      pos = play(play(pos, m) as Position, -1) as Position;
    }
    expect(frontieresOuvertes(pos.board, 9)).toEqual([]);
    expect(chooseMove(pos, 'pomme', { seed: 1, timeMs: 50 })).toBe(-1);
  });

  it('début de partie (moins d’un quart du plateau couvert) : si le joueur passe, Pomme passe aussi', () => {
    const vide: Position = { ...newPosition(9), toPlay: 2, lastMove: -1 };
    for (let seed = 1; seed <= 3; seed++) expect(chooseMove(vide, 'pomme', { seed, timeMs: 50 })).toBe(-1);
  });

  it('sans la politique (ancien comportement) : Pomme passait avec la frontière ouverte', () => {
    const sans = { ...opponent('pomme'), fermeFrontieres: false };
    expect(chooseMove(lire(DAME, 2), sans, { seed: 1, timeMs: 50 })).toBe(-1);
  });

  it('niveau KataGo : KataGo propose de passer, on ferme avec son meilleur coup de fermeture', async () => {
    const own = new Float32Array(81);
    const k: KataGoBackend = {
      info: { state: 'pret' } as KataGoBackend['info'],
      async analyze(): Promise<Analysis> {
        return {
          moves: [
            { move: -1, visits: 30, prior: 0.6, winrate: 0.7, lead: 5, scoreLoss: 0 },
            { move: at(0, 0), visits: 5, prior: 0.1, winrate: 0.6, lead: 4, scoreLoss: 1 },
            { move: at(5, 4), visits: 5, prior: 0.1, winrate: 0.7, lead: 5, scoreLoss: 0 },
          ],
          winrate: 0.7, lead: 5, ownership: own, visits: 40, ms: 1, engine: 'faux',
        };
      },
    };
    setKataGo(k);
    expect(await bestMove(lire(TROU, 2), 'bambou')).toBe(at(5, 4));
    // Position finie : la passe est gardée.
    expect(await bestMove(lire(FINIE, 2), 'bambou')).toBe(-1);
  });
});

describe('barre d’avantage avec la propriété des simulations (#159)', () => {
  it('positions finales réelles : l’estimation du moteur simple tombe sur le score japonais', () => {
    for (const cas of CAS.filter(c => c.rows.length === 9)) {
      const pos: Position = { ...lire(cas.rows.map(r => r.replace(/S/g, 'X').replace(/T/g, 'O')), 1), lastMove: 0, captures: [0, 2, 5] };
      const own = ownershipSimple(pos, { seed: 7 });
      const s = score(pos, 6.5, 'japanese', new Set(deadStones(pos, { seed: 7 })));
      expect(Math.abs(avanceEstimee(pos, own, 6.5, { fin: true }) - (s.black - s.white)), cas.nom).toBeLessThanOrEqual(1);
    }
  });
});
