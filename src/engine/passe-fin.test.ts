// Passer doit finir la partie (#185) : quand le joueur passe, l'ordi passe aussi une fois les frontières fermées.
// Premières parties (`accommodant`) : il passe même s'il pourrait grappiller. Ensuite : il ne continue que si un coup
// rapporte au moins SEUIL_POINTS, et il dit pourquoi. Indicateur de l'issue : au plus 2 passes du joueur pour finir.
import { afterEach, describe, expect, it } from 'vitest';
import { bestMoveExplique, chooseMoveDetail, gainDuCoup, SEUIL_POINTS, setKataGo, type Analysis, type KataGoBackend, type OpponentId } from './index';
import { CAS } from './dead.fixtures';
import { frontieresOuvertes } from '../go/frontieres';
import { newPosition, play, type Color, type Position } from '../go/rules';

/** Position lue ligne par ligne (X noir, O blanc ; S et T : pierres mortes des fixtures, posées comme les autres). */
function lire(rows: string[], toPlay: Color): Position {
  const size = rows.length, pos = newPosition(size);
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') pos.board[y * size + x] = ch === 'X' || ch === 'S' ? 1 : 2; }));
  return { ...pos, toPlay, lastMove: -1 }; // le joueur (Noir) vient de passer
}

/**
 * Fin de partie jouée : le joueur (Noir) passe, l'ordi (Blanc) répond, jusqu'à ce que l'ordi passe à son tour.
 * Renvoie le nombre de passes du joueur et les raisons données quand l'ordi a joué.
 */
function finir(pos: Position, id: OpponentId, accommodant: boolean, seed: number): { passes: number; raisons: string[] } {
  let passes = 1;
  const raisons: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = chooseMoveDetail(pos, id, { seed: seed + i, timeMs: 60, playouts: 400, accommodant, passesJoueur: passes });
    if (r.move === -1) return { passes, raisons };
    raisons.push(r.raison?.texte ?? '(sans raison)');
    pos = play(play(pos, r.move) as Position, -1) as Position;
    passes++;
  }
  return { passes: Infinity, raisons };
}

// Seule position des fixtures qui n'est pas finie : Blanc doit encore fermer deux points (H5 et J5). Test à part plus bas.
const DEUX_A_FERMER = '9 × 9 : groupe blanc à un seul œil, noir vivant à deux yeux chez Blanc';
const NEUF = CAS.filter(c => c.rows.length === 9 && c.nom !== DEUX_A_FERMER);

describe('passer finit la partie (#185)', () => {
  afterEach(() => setKataGo(undefined));

  for (const accommodant of [true, false]) {
    for (const c of NEUF) {
      it(`${accommodant ? 'accommodant' : 'normal'} : ${c.nom} : au plus 2 passes`, () => {
        for (const id of ['pomme', 'caillou'] as const) {
          for (const seed of [1, 7]) {
            const f = finir(lire(c.rows, 2), id, accommodant, seed);
            expect(f.passes, `${id} graine ${seed} : ${f.raisons.join(' ; ')}`).toBeLessThanOrEqual(2);
          }
        }
      });
    }
  }

  it('13 × 13 : positions finales réelles, au plus 2 passes', () => {
    for (const c of CAS.filter(x => x.rows.length === 13)) {
      for (const accommodant of [true, false]) {
        const f = finir(lire(c.rows, 2), 'caillou', accommodant, 3);
        expect(f.passes, `${c.nom} ${accommodant} : ${f.raisons.join(' ; ')}`).toBeLessThanOrEqual(2);
      }
    }
  });

  it('deux points à fermer : l’ordi les ferme l’un après l’autre en disant où, puis passe', () => {
    const c = CAS.find(x => x.nom === DEUX_A_FERMER)!;
    const f = finir(lire(c.rows, 2), 'pomme', false, 1);
    // Une passe par point à fermer, plus la dernière : c'est le minimum, et chaque coup a sa raison.
    expect(f.passes).toBe(3);
    expect(f.raisons.every(r => r.startsWith('il reste une frontière à fermer en '))).toBe(true);
    // Parties accommodantes (#235) : aucun coup seul ne ferme sa zone, elle passe tout de suite (au plus 2 passes).
    expect(finir(lire(c.rows, 2), 'pomme', true, 1).passes).toBeLessThanOrEqual(2);
  });

  // Blanc (l'ordi) peut capturer la pierre noire en F5 (atari) en jouant E5 : le point E5 est une frontière ouverte.
  const ATARI = ['...XO....', '...XO....', '...XO....', '...XOO...', '...X.XO..', '...XOO...', '...XO....', '...XO....', '...XO....'];

  it('frontière ouverte : même accommodant, l’ordi la ferme et dit où', () => {
    const r = chooseMoveDetail(lire(ATARI, 2), 'pomme', { seed: 1, timeMs: 50 });
    expect(r.move).toBe(4 * 9 + 4);
    expect(r.raison).toMatchObject({ motif: 'frontiere', texte: 'il reste une frontière à fermer en E5' });
    // Accommodant (#235) : c'est un trou dans SA frontière (la pierre noire en atari chez elle), elle le ferme aussi.
    const a = chooseMoveDetail(lire(ATARI, 2), 'pomme', { seed: 1, timeMs: 50, accommodant: true });
    expect(a.move).toBe(4 * 9 + 4);
    expect(a.raison).toMatchObject({ motif: 'frontiere', texte: 'il reste un trou dans sa frontière en E5' });
  });

  it('début de partie : accommodant, l’ordi passe toujours ; plateau vide, il passe aussi sinon', () => {
    const peu = lire(['.........', '..X...O..', '.........', '.........', '....X....', '.........', '..X...O..', '.........', '.........'], 2);
    for (let seed = 1; seed <= 3; seed++) expect(chooseMoveDetail(peu, 'caillou', { seed, timeMs: 50, accommodant: true }).move).toBe(-1);
    const vide: Position = { ...newPosition(9), toPlay: 2, lastMove: -1 };
    expect(chooseMoveDetail(vide, 'pomme', { seed: 1, timeMs: 50 }).move).toBe(-1);
  });

  it('gain d’un coup : rien à gagner chez l’adversaire ni en remplissant son territoire, une vraie prise rapporte', () => {
    const finie = lire(CAS[1].rows, 2);
    expect(frontieresOuvertes(finie.board, 9)).toEqual([]);
    // Invasion chez Noir (B5) et coup dans son propre territoire (H5) : pas de gain.
    expect(gainDuCoup(finie, 4 * 9 + 1, { seed: 1 })).toBeLessThan(SEUIL_POINTS);
    expect(gainDuCoup(finie, 4 * 9 + 7, { seed: 1 })).toBeLessThan(SEUIL_POINTS);
    // Prise de la pierre noire en atari (E5 prend F5) : la pierre et son point.
    expect(gainDuCoup(lire(ATARI, 2), 4 * 9 + 4, { seed: 1 })).toBeGreaterThanOrEqual(SEUIL_POINTS);
  });

  describe('niveaux KataGo', () => {
    const own = new Float32Array(81);
    const faux = (moves: { move: number; lead: number }[]): KataGoBackend => ({
      info: { state: 'pret' } as KataGoBackend['info'],
      async analyze(): Promise<Analysis> {
        return {
          moves: moves.map(m => ({ ...m, visits: 10, prior: 0.2, winrate: 0.5, scoreLoss: moves[0].lead - m.lead })),
          winrate: 0.5, lead: moves[0].lead, ownership: own, visits: 30, ms: 1, engine: 'faux',
        };
      },
    });
    // Position finie (frontière en escalier), Blanc au trait : KataGo propose un coup en B5.
    const finie = () => lire(CAS[1].rows, 2);
    const B5 = 4 * 9 + 1;

    it('le coup rapporte 4 points de plus que la passe : l’ordi joue et dit pourquoi', async () => {
      setKataGo(faux([{ move: B5, lead: 5 }, { move: -1, lead: 1 }]));
      const r = await bestMoveExplique(finie(), 'sensei', { komi: 6.5 });
      expect(r.move).toBe(B5);
      expect(r.raison).toMatchObject({ motif: 'points', gain: 4, texte: 'il reste 4 points à prendre en B5' });
    });

    it('un seul point de mieux que la passe : sous le seuil, l’ordi passe', async () => {
      setKataGo(faux([{ move: B5, lead: 2 }, { move: -1, lead: 1 }]));
      expect(await bestMoveExplique(finie(), 'sensei', { komi: 6.5 })).toEqual({ move: -1, raison: null });
    });

    it('accommodant : l’ordi passe même si un coup rapporte', async () => {
      setKataGo(faux([{ move: B5, lead: 9 }, { move: -1, lead: 1 }]));
      expect((await bestMoveExplique(finie(), 'sensei', { komi: 6.5, accommodant: true })).move).toBe(-1);
    });

    it('frontière ouverte : l’ordi la ferme, accommodant ou non', async () => {
      setKataGo(faux([{ move: -1, lead: 1 }]));
      const r = await bestMoveExplique(lire(ATARI, 2), 'sensei', { komi: 6.5, accommodant: true });
      expect(r.move).toBe(4 * 9 + 4);
      expect(r.raison?.motif).toBe('frontiere');
    });
  });
});
