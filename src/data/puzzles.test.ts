import { BASE_PUZZLES } from '../content/puzzles';
import { fromLabel } from '../go/coords';
import { groupAt } from '../go/rules';
import { checkAnswer, liveStreak, parsePuzzle, parsePuzzles, puzzleOfDay, solutionFrames, startOf, type Puzzle, type PuzzleRow } from './puzzles';

const all = parsePuzzles(BASE_PUZZLES);
const pz = (id: string) => all.find(p => p.id === id)!;
const at = (p: Puzzle, l: string) => fromLabel(l, p.size);

describe('copie locale des problèmes de base', () => {
  it('contient les 6 problèmes, tous valides', () => {
    expect(all.map(p => p.id)).toEqual(['b1', 'b2', 'b3', 'b4', 'b5', 'b6']);
  });

  it('chaque réponse enregistrée est un coup légal accepté', () => {
    for (const p of all) for (const a of p.answers) expect(checkAnswer(p, a).kind).toBe('ok');
  });
});

describe('vérification des réponses', () => {
  it('b1 : E5 capture la pierre marquée', () => {
    const p = pz('b1');
    const r = checkAnswer(p, at(p, 'E5'));
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') { expect(r.after.board[at(p, 'D5')]).toBe(0); expect(r.after.captures[1]).toBe(1); }
  });

  it('b3 : E5 met les deux pierres marquées en atari', () => {
    const p = pz('b3');
    const r = checkAnswer(p, at(p, 'E5'));
    if (r.kind !== 'ok') throw new Error('attendu ok');
    for (const t of startOf(p).marked) expect(groupAt(r.after.board, 9, t).liberties.size).toBe(1);
  });

  it('b5 : F6 capture et sauve la pierre marquée', () => {
    const p = pz('b5');
    const r = checkAnswer(p, at(p, 'F6'));
    if (r.kind !== 'ok') throw new Error('attendu ok');
    expect(r.after.board[at(p, 'F5')]).toBe(0);
    expect(groupAt(r.after.board, 9, at(p, 'E5')).liberties.size).toBeGreaterThan(1);
  });

  it('b6 : les deux atari de l’échelle sont acceptés, un autre coup non', () => {
    const p = pz('b6');
    expect(checkAnswer(p, at(p, 'F5')).kind).toBe('ok');
    expect(checkAnswer(p, at(p, 'E4')).kind).toBe('ok');
    expect(checkAnswer(p, at(p, 'A1')).kind).toBe('wrong');
  });

  it('refuse un coup sur une pierre ou un suicide', () => {
    const p = pz('b1');
    expect(checkAnswer(p, at(p, 'D5'))).toEqual({ kind: 'illegal', reason: 'occupe' });
    const s = parsePuzzle({ ...BASE_PUZZLES[0], id: 's', setup: { rows: ['.O.......', 'O........', ...Array(7).fill('.........')], toPlay: 'B' }, answers: ['J1'] })!;
    expect(checkAnswer(s, at(s, 'A9'))).toEqual({ kind: 'illegal', reason: 'suicide' });
  });
});

describe('lecture des lignes de la base', () => {
  const base: PuzzleRow = BASE_PUZZLES[0];
  it('rejette les lignes mal formées', () => {
    expect(parsePuzzle({ ...base, size: 7 })).toBeNull();
    expect(parsePuzzle({ ...base, setup: { rows: ['...'] } })).toBeNull();
    expect(parsePuzzle({ ...base, setup: null })).toBeNull();
    expect(parsePuzzle({ ...base, answers: ['Z99'] })).toBeNull();
    expect(parsePuzzle({ ...base, answers: [] })).toBeNull();
    expect(parsePuzzle({ ...base, setup: { rows: (base.setup as { rows: string[] }).rows, toPlay: 'R' } })).toBeNull();
  });
  it('lit le trait de Blanc et des textes absents', () => {
    const p = parsePuzzle({ ...base, title: null, prompt: null, setup: { rows: (base.setup as { rows: string[] }).rows, toPlay: 'W' } })!;
    expect(p.toPlay).toBe(2);
    expect(p.title).toBe('Problème');
  });
  it('utilise une suite enregistrée si la colonne existe', () => {
    const p = parsePuzzle({ ...BASE_PUZZLES[5], solution: ['F5', 'E4', 'D4'] } as PuzzleRow)!;
    expect(p.line).toHaveLength(3);
    expect(solutionFrames(p)).toHaveLength(4);
  });
});

describe('suite et problème du jour', () => {
  it('la suite par défaut joue la réponse', () => {
    const frames = solutionFrames(pz('b1'));
    expect(frames).toHaveLength(2);
    expect(frames[1].lastMove).toBe(at(pz('b1'), 'E5'));
  });
  it('le problème du jour est stable dans la journée et change le lendemain', () => {
    const a = puzzleOfDay(all, new Date(2026, 8, 27, 8)), b = puzzleOfDay(all, new Date(2026, 8, 27, 23));
    const c = puzzleOfDay(all, new Date(2026, 8, 28, 8));
    expect(a).toBe(b);
    expect(c).not.toBe(a);
    expect(puzzleOfDay([], new Date())).toBeUndefined();
  });
  it('la série retombe à 0 après un jour sans problème', () => {
    const now = new Date(2026, 8, 27, 12);
    expect(liveStreak(3, '2026-09-27', now)).toBe(3);
    expect(liveStreak(3, '2026-09-26', now)).toBe(3);
    expect(liveStreak(3, '2026-09-25', now)).toBe(0);
    expect(liveStreak(0, null, now)).toBe(0);
  });
});
