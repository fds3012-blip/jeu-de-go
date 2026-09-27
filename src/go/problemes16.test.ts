// Issue #16 : preuve de chacun des 12 nouveaux problèmes avec le moteur de règles.
// Pour chaque problème : position de départ légale, bonne réponse qui produit le résultat annoncé,
// et réfutation des erreurs (le texte affiché après un échec doit dire vrai).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PUZZLES_16 } from '../content/puzzles';
import { checkAnswer, parsePuzzles, startOf, type Puzzle } from '../data/puzzles';
import { fromLabel, toLabel } from './coords';
import { groupAt, play, type Position } from './rules';
import { canEscape, captureWorks, defenceFails, hasTwoEyes, isDead, ladderWorks } from './tactics';

const all = parsePuzzles(PUZZLES_16);
const pz = (id: string) => all.find(p => p.id === id)!;
const at = (l: string) => fromLabel(l, 9);
const ok = (r: Position | string): Position => { if (typeof r === 'string') throw new Error(r); return r; };
const libs = (pos: Position, p: number) => groupAt(pos.board, pos.size, p).liberties.size;
const chain = (pos: Position, p: number) => new Set(groupAt(pos.board, pos.size, p).stones);
/** Réponse du joueur, vérifiée par la même fonction que l'appli. */
const answer = (p: Puzzle, l: string): Position => {
  const r = checkAnswer(p, at(l));
  if (r.kind !== 'ok') throw new Error(`${p.id} : ${l} refusé (${r.kind})`);
  return r.after;
};
/** Tous les coups légaux (et la passe) du camp au trait. */
const legalMoves = (pos: Position) => [...Array(81).keys(), -1].filter(m => typeof play(pos, m) !== 'string');

describe('les 12 problèmes de l’issue #16', () => {
  it('sont tous lisibles, en 9 × 9, avec Noir au trait', () => {
    expect(all.map(p => p.id)).toEqual(['c1', 'c2', 'c3', 'c4', 's1', 's2', 's3', 's4', 'v1', 'v2', 'v3', 'v4']);
    for (const p of all) { expect(p.size).toBe(9); expect(p.toPlay).toBe(1); expect(p.refutation).toBeTruthy(); }
  });

  it('positions de départ légales : chaque chaîne a au moins une liberté, les pierres marquées existent', () => {
    for (const p of all) {
      const { pos, marked } = startOf(p);
      expect(marked.length, p.id).toBeGreaterThan(0);
      for (let q = 0; q < 81; q++) if (pos.board[q]) expect(libs(pos, q), `${p.id} ${q}`).toBeGreaterThan(0);
      for (const a of p.answers) expect(checkAnswer(p, a).kind, p.id).toBe('ok');
    }
  });

  it('difficultés dans la plage des 6 problèmes de base (400 à 850)', () => {
    for (const p of all) { expect(p.difficulty).toBeGreaterThanOrEqual(400); expect(p.difficulty).toBeLessThanOrEqual(850); }
  });

  it('la migration insère exactement ces 12 problèmes, sans toucher aux anciens', () => {
    const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/20260927160000_problemes_capture_sauvetage_vie_mort.sql'), 'utf8');
    expect(sql).not.toMatch(/\b(delete|update|drop|truncate)\b/i);
    expect(sql).toMatch(/on conflict \(id\) do nothing/i);
    for (const row of PUZZLES_16) {
      const q = (s: string) => s.replace(/'/g, "''");
      expect(sql).toContain(`('${row.id}', null, 9, '${q(JSON.stringify(row.setup))}', array[${row.answers.map(a => `'${a}'`).join(',')}], '${q(row.title!)}', '${q(row.prompt!)}', '${q(row.explanation!)}', ${row.difficulty})`);
    }
  });
});

describe('capture', () => {
  it('c1 double atari : E5 met les deux pierres en atari, et Noir en prend une quoi que fasse Blanc', () => {
    const p = pz('c1'), r = answer(p, 'E5'), [a, b] = startOf(p).marked;
    expect(libs(r, a)).toBe(1);
    expect(libs(r, b)).toBe(1);
    for (const w of legalMoves(r)) {
      const after = ok(play(r, w));
      const captures = legalMoves(after).some(m => { const x = play(after, m); return typeof x !== 'string' && (x.board[a] === 0 || x.board[b] === 0); });
      expect(captures, `réponse blanche ${w}`).toBe(true);
    }
    // Réfutation : un seul atari, Blanc relie en E5 et ses trois pierres ont 3 libertés.
    const e7 = ok(play(ok(play(startOf(p).pos, at('E7'))), at('E5')));
    expect(chain(e7, a).has(b)).toBe(true);
    expect(libs(e7, a)).toBe(3);
  });

  it('c2 échelle : E4 capture jusqu’au bord, F5 bute sur la pierre blanche C2', () => {
    const p = pz('c2'), t = startOf(p).marked[0];
    const r = answer(p, 'E4');
    expect(libs(r, t)).toBe(1);
    expect(canEscape(r, t)).toBe(false);
    // On joue vraiment l'échelle : Blanc s'allonge, Noir remet en atari, jusqu'à la capture.
    let q = r;
    while (q.board[t]) {
      // Blanc s'allonge ; contre le bord, s'allonger devient un suicide : il passe et Noir capture.
      const ext = play(q, [...groupAt(q.board, 9, t).liberties][0]);
      q = typeof ext === 'string' ? ok(play(q, -1)) : ext;
      const m = [...groupAt(q.board, 9, t).liberties].find(l => { const x = play(q, l); return typeof x !== 'string' && (x.board[t] === 0 || (libs(x, t) === 1 && !canEscape(x, t))); })!;
      q = ok(play(q, m));
    }
    expect(q.captures[1]).toBeGreaterThanOrEqual(5);
    const wrong = checkAnswer(p, at('F5'));
    expect(wrong.kind).toBe('wrong');
    if (wrong.kind === 'wrong') expect(canEscape(wrong.after, t)).toBe(true);
  });

  it('c3 filet : F4 enferme la pierre, les deux atari directs la laissent s’échapper', () => {
    const p = pz('c3'), t = startOf(p).marked[0], r = answer(p, 'F4');
    expect(defenceFails(r, t, 11)).toBe(true);
    // Les deux sorties décrites dans l'explication.
    const f5 = ok(play(ok(play(ok(play(r, at('F5'))), at('G5'))), at('E4')));
    expect(ok(play(f5, at('E3'))).board[t]).toBe(0);
    const e4 = ok(play(ok(play(ok(play(r, at('E4'))), at('E3'))), at('F5')));
    expect(ok(play(e4, at('G5'))).board[t]).toBe(0);
    for (const direct of ['E4', 'F5']) {
      const w = checkAnswer(p, at(direct));
      expect(w.kind).toBe('wrong');
      if (w.kind === 'wrong') expect(canEscape(w.after, t), direct).toBe(true);
    }
    // C'est bien la pierre G2 qui casse l'échelle : sans elle, l'atari direct E4 suffirait.
    const sansG2 = startOf(p).pos;
    sansG2.board[at('G2')] = 0;
    expect(canEscape(ok(play(sansG2, at('E4'))), t)).toBe(false);
  });

  it('c4 retour de capture : C1, Blanc prend en B1, Noir reprend 5 pierres en C1 (pas un ko)', () => {
    const p = pz('c4'), t = startOf(p).marked[0], r = answer(p, 'C1');
    expect(libs(r, t)).toBe(1);
    expect(libs(r, at('C1'))).toBe(1);
    const take = ok(play(r, at('B1')));
    expect(take.captures[2]).toBe(1);
    expect(take.ko).toBe(-1);
    const back = ok(play(take, at('C1')));
    expect(back.captures[1]).toBe(5);
    expect(back.board[t]).toBe(0);
    // Blanc ne peut rien faire d'autre : le groupe est pris par force.
    expect(defenceFails(r, t, 6)).toBe(true);
    // Réfutation : après B1, Blanc prend en C1 et se relie à D1-E1.
    const b1 = ok(play(ok(play(startOf(p).pos, at('B1'))), at('C1')));
    expect(b1.captures[2]).toBe(1);
    expect(chain(b1, t).has(at('E1'))).toBe(true);
    expect(libs(b1, t)).toBeGreaterThanOrEqual(4);
  });
});

describe('sauvetage', () => {
  it('s1 : E2 donne 3 libertés, tout autre coup laisse Blanc capturer en E2', () => {
    const p = pz('s1'), s = startOf(p).marked[0], r = answer(p, 'E2');
    expect(libs(r, s)).toBe(3);
    expect(captureWorks(r, s)).toBe(false);
    expect(ladderWorks(r, s)).toBe(false);
    const { pos } = startOf(p);
    for (const m of legalMoves(pos).filter(m => m !== at('E2'))) expect(ok(play(ok(play(pos, m)), at('E2'))).board[s], `coup ${m}`).toBe(0);
  });

  it('s2 : E5 relie les deux pierres en un groupe de 3 libertés ; sinon Blanc coupe en E5', () => {
    const p = pz('s2'), [a, b] = startOf(p).marked, r = answer(p, 'E5');
    expect(chain(r, a).has(b)).toBe(true);
    expect(libs(r, a)).toBe(3);
    expect(captureWorks(r, a)).toBe(false);
    const { pos } = startOf(p);
    // Sans réponse, la coupe E5 est un double atari.
    const cut = ok(play({ ...pos, toPlay: 2 }, at('E5')));
    expect(libs(cut, a)).toBe(1);
    expect(libs(cut, b)).toBe(1);
    for (const m of legalMoves(pos).filter(m => m !== at('E5') && m !== -1)) {
      const w = ok(play(ok(play(pos, m)), at('E5')));
      expect(chain(w, a).has(b), `coup ${m}`).toBe(false);
    }
  });

  it('s3 : E6 capture la pierre qui coupe et sauve la pierre marquée ; D6 échoue', () => {
    const p = pz('s3'), s = startOf(p).marked[0], r = answer(p, 'E6');
    expect(r.board[at('E5')]).toBe(0);
    expect(r.captures[1]).toBe(1);
    expect(captureWorks(r, s)).toBe(false);
    // Si Blanc remet en atari en D6, Noir se relie en E5.
    const d6 = ok(play(ok(play(r, at('D6'))), at('E5')));
    expect(chain(d6, s).has(at('E4'))).toBe(true);
    expect(libs(d6, s)).toBeGreaterThanOrEqual(4);
    const w = checkAnswer(p, at('D6'));
    expect(w.kind).toBe('wrong');
    if (w.kind === 'wrong') {
      const e6 = ok(play(w.after, at('E6')));
      expect(libs(e6, at('E5'))).toBeGreaterThanOrEqual(2);
      expect(defenceFails(e6, s, 12)).toBe(true);
    }
  });

  it('s4 : D2 relie en un groupe de 4 libertés ; après tout autre coup, Blanc capture une pierre marquée', () => {
    const p = pz('s4'), [a, b] = startOf(p).marked, r = answer(p, 'D2');
    expect(chain(r, a).has(b)).toBe(true);
    expect(libs(r, a)).toBe(4);
    expect(captureWorks(r, a)).toBe(false);
    const { pos } = startOf(p);
    for (const m of legalMoves(pos).filter(m => m !== at('D2'))) {
      const x = ok(play(pos, m));
      expect(captureWorks(x, a) || captureWorks(x, b), `coup ${m}`).toBe(true);
    }
  });
});

describe('vie et mort', () => {
  const area = (...l: string[]) => l.map(at);

  it('v1 : B1 fait deux yeux (A1 et C1) ; tout autre coup et Blanc tue', () => {
    const p = pz('v1'), s = startOf(p).marked[0], r = answer(p, 'B1');
    expect(hasTwoEyes(r, s)).toBe(true);
    expect(play(r, at('A1'))).toBe('suicide');
    expect(play(r, at('C1'))).toBe('suicide');
    const { pos } = startOf(p), zone = area('A1', 'B1', 'C1');
    expect(isDead(ok(play({ ...pos, toPlay: 2 }, at('B1'))), s, zone)).toBe(true);
    for (const m of legalMoves(pos).filter(m => m !== at('B1'))) expect(isDead(ok(play(pos, m)), s, zone), `coup ${m}`).toBe(true);
  });

  it('v2 : A1 fait deux yeux (A2 et B1) ; tout autre coup et Blanc tue', () => {
    const p = pz('v2'), s = startOf(p).marked[0], r = answer(p, 'A1');
    expect(hasTwoEyes(r, s)).toBe(true);
    expect(play(r, at('A2'))).toBe('suicide');
    expect(play(r, at('B1'))).toBe('suicide');
    const { pos } = startOf(p), zone = area('A1', 'A2', 'B1');
    for (const m of legalMoves(pos).filter(m => m !== at('A1'))) expect(isDead(ok(play(pos, m)), s, zone), `coup ${m}`).toBe(true);
  });

  it('v3 : E9 tue (un seul œil) ; après tout autre coup, Blanc vit en E9', () => {
    const p = pz('v3'), t = startOf(p).marked[0], r = answer(p, 'E9');
    expect(isDead(r, t, area('D9', 'E9', 'F9'))).toBe(true);
    const { pos } = startOf(p);
    for (const m of legalMoves(pos).filter(m => m !== at('E9'))) expect(hasTwoEyes(ok(play(ok(play(pos, m)), at('E9'))), t), `coup ${m}`).toBe(true);
  });

  it('v4 : J9 tue le coude ; après tout autre coup, Blanc vit en J9', () => {
    const p = pz('v4'), t = startOf(p).marked[0], r = answer(p, 'J9');
    expect(isDead(r, t, area('H9', 'J9', 'J8'))).toBe(true);
    const { pos } = startOf(p);
    for (const m of legalMoves(pos).filter(m => m !== at('J9'))) expect(hasTwoEyes(ok(play(ok(play(pos, m)), at('J9'))), t), `coup ${m}`).toBe(true);
  });
});

describe('ensemble exact des bonnes réponses (tous les coups légaux de Noir)', () => {
  /** Capture garantie : quelle que soit la réponse de Blanc (tous ses coups légaux et la passe), Noir capture une cible. */
  // Tous les coups blancs sont essayés ; les coups près des cibles d'abord, pour trouver vite une défense qui marche.
  const nearFirst = (r: Position, targets: number[]) => {
    const near = new Set<number>();
    for (const t of targets) for (const s of groupAt(r.board, 9, t).stones) {
      const x = s % 9, y = Math.floor(s / 9);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && xx < 9 && yy >= 0 && yy < 9) near.add(yy * 9 + xx);
      }
    }
    const all = legalMoves(r);
    return [...all.filter(m => near.has(m)), ...all.filter(m => !near.has(m))];
  };
  const captureGuaranteed = (r: Position, targets: number[], depth = 12) => nearFirst(r, targets).every(w => {
    const x = ok(play(r, w));
    // Deux lecteurs : l'échelle (sans limite pratique de longueur) et le lecteur de capture général.
    return targets.some(t => x.board[t] === 0 || ladderWorks(x, t) || captureWorks(x, t, depth));
  });
  /** Groupe sauvé : Blanc au trait ne trouve aucune capture de la pierre marquée. */
  const saved = (r: Position, s: number) => r.board[s] !== 0 && !captureWorks(r, s) && !ladderWorks(r, s);
  const winners = (id: string, goal: (r: Position, marked: number[]) => boolean) => {
    const p = pz(id), { pos, marked } = startOf(p);
    return legalMoves(pos).filter(m => m !== -1 && goal(ok(play(pos, m)), marked)).map(m => toLabel(m, 9)).sort();
  };
  const accepted = (id: string) => pz(id).answers.map(a => toLabel(a, 9)).sort();

  it('c1 : seul E5 garantit une capture', { timeout: 60_000 }, () => {
    expect(accepted('c1')).toEqual(['E5']);
    expect(winners('c1', captureGuaranteed)).toEqual(accepted('c1'));
  });
  it('c2 : seul E4 garantit la capture', { timeout: 60_000 }, () => {
    expect(accepted('c2')).toEqual(['E4']);
    expect(winners('c2', captureGuaranteed)).toEqual(accepted('c2'));
  });
  it('c3 : seuls les coups acceptés (F4, G4, F3) garantissent la capture', { timeout: 180_000 }, () => {
    expect(accepted('c3')).toEqual(['F3', 'F4', 'G4']);
    expect(winners('c3', captureGuaranteed)).toEqual(accepted('c3'));
  });
  it('s3 : seul E6 sauve la pierre marquée', () => {
    expect(accepted('s3')).toEqual(['E6']);
    expect(winners('s3', (r, [s]) => saved(r, s))).toEqual(accepted('s3'));
  });
});

describe('lecteurs tactiques', () => {
  it('hasTwoEyes : un seul œil ne suffit pas', () => {
    const { pos } = startOf(pz('v1'));
    expect(hasTwoEyes(pos, at('A2'))).toBe(false);
    expect(hasTwoEyes(pos, at('E5'))).toBe(false);
  });
  it('captureWorks : une pierre libre au centre ne se capture pas', () => {
    const { pos } = startOf(pz('s1'));
    const r = ok(play({ ...pos, toPlay: 2 }, -1));
    expect(captureWorks({ ...r, toPlay: 2 }, at('E1'))).toBe(true);
    expect(captureWorks({ ...r, toPlay: 1 }, at('E1'))).toBe(false);
  });
});
