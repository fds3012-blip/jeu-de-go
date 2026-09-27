// Vérification automatique des 7 leçons de content/lessons.fr.js : positions, bonnes réponses, et mauvaises réponses.
import { LESSONS, type LessonStep } from '../content/lessons';
import { fromRows } from './position';
import { groupAt, isLegal, neighbors, play, type Position } from './rules';
import { fromLabel, toLabel } from './coords';
import { score } from './score';
import { frontieresOuvertes } from './frontieres';
import { KOMI_NORMAL } from '../app/equilibrage';
import { canEscape, isDead, ladderWorks } from './tactics';
import { imagesDemo } from '../content/demo';

const N = 9;
const at = (l: string) => fromLabel(l, N);
const ok = (r: Position | string): Position => { if (typeof r === 'string') throw new Error(r); return r; };
const libs = (pos: Position, p: number) => groupAt(pos.board, N, p).liberties;
const step = (id: string, i: number) => LESSONS.find(l => l.id === id)!.steps[i];
const all = LESSONS.flatMap(l => l.steps.map((s, i) => ({ id: `${l.id}.${i + 1}`, s })));

/** Après le coup noir (Blanc au trait), l'une des pierres visées est-elle perdue, quoi que Blanc réponde ? */
function targetsLost(r: Position, targets: number[]): boolean {
  if (targets.some(t => r.board[t] === 0)) return true;
  const replies = new Set<number>([-1]);
  for (const t of targets) for (const s of groupAt(r.board, N, t).stones) {
    for (const l of libs(r, s)) replies.add(l);
    for (const q of neighbors(N)[s]) if (r.board[q] === 1 && libs(r, q).size === 1) replies.add([...libs(r, q)][0]);
  }
  return [...replies].every(w => {
    const q = play(r, w);
    return typeof q === 'string' || targets.some(u => q.board[u] === 2 && ladderWorks(q, u));
  });
}

describe('leçons : forme des positions', () => {
  it('sept leçons, chacune avec au moins deux étapes', () => {
    expect(LESSONS).toHaveLength(7);
    for (const l of LESSONS) expect(l.steps.length).toBeGreaterThanOrEqual(2);
  });
  for (const { id, s } of all) {
    it(`${id} : plateau 9 × 9 valide, sans groupe sans liberté`, () => {
      expect(s.rows).toHaveLength(N);
      for (const row of s.rows) expect(row).toMatch(/^[.XOTS]{9}$/);
      const { pos } = fromRows(s.rows);
      for (let p = 0; p < N * N; p++) if (pos.board[p]) expect(libs(pos, p).size).toBeGreaterThan(0);
    });
  }
});

describe('leçons : libertés montrées', () => {
  // Étapes « on fait ensemble » (#101) : les points verts sont exactement les libertés des pierres marquées.
  for (const { id, s } of all.filter(x => (x.s.kind === 'info' || x.s.kind === 'move') && x.s.libs)) {
    it(`${id} : chaque point vert est une liberté, et tout groupe concerné est montré en entier`, () => {
      const { pos, marked } = fromRows(s.rows);
      const shown = new Set((s as Extract<LessonStep, { kind: 'move' }>).libs!.map(at));
      if (s.kind === 'move') expect(new Set(marked.flatMap(p => [...libs(pos, p)]))).toEqual(shown);
      for (const p of shown) expect(pos.board[p]).toBe(0);
      const groups = [...Array(N * N).keys()].filter(p => pos.board[p] && [...libs(pos, p)].every(l => shown.has(l)));
      const covered = new Set(groups.flatMap(p => [...libs(pos, p)]));
      expect([...shown].every(p => covered.has(p))).toBe(true);
    });
  }
});

describe('leçons : bonnes et mauvaises réponses', () => {
  for (const { id, s } of all.filter(x => x.s.kind === 'move')) {
    const m = s as Extract<LessonStep, { kind: 'move' }>;
    it(`${id} : chaque bonne réponse est légale et atteint le but`, () => {
      const { pos, marked } = fromRows(m.rows);
      if (m.accept === 'line3') {
        const good = [...Array(N * N).keys()].filter(p => { const x = p % N, y = Math.floor(p / N); return x >= 2 && x <= 6 && y >= 2 && y <= 6; });
        expect(good).toHaveLength(25);
        for (const p of good) expect(isLegal(pos, p)).toBe(true);
        return;
      }
      if (m.accept === 'terrB') {
        // Question sur le goban (#101) : les points acceptés sont exactement le territoire noir du moteur.
        const owner = score(pos, 0, 'japanese').owner;
        const good = [...Array(N * N).keys()].filter(p => owner[p] === 1 && !pos.board[p]);
        expect(good).toHaveLength(27);
        for (const p of good) expect(isLegal(pos, p)).toBe(true);
        expect([...Array(N * N).keys()].filter(p => owner[p] === 2 && !pos.board[p])).toHaveLength(36);
        return;
      }
      if (m.aide) {
        // Frontière à fermer (#177) : le point vert est la seule réponse, et c'est lui qui fait compter le territoire noir.
        expect(m.aide).toEqual(m.accept);
        const avant = score(pos, 0, 'japanese').territory[1];
        for (const p of [...Array(N * N).keys()].filter(q => isLegal(pos, q))) {
          const r = ok(play(pos, p));
          const ferme = frontieresOuvertes(r.board, N).length === 0 && score(r, 0, 'japanese').territory[1] > avant;
          expect(ferme, toLabel(p, N)).toBe(m.accept.includes(toLabel(p, N)));
        }
        return;
      }
      const targets = marked.filter(p => pos.board[p] === 2), saved = marked.filter(p => pos.board[p] === 1);
      expect(marked.length).toBeGreaterThan(0);
      for (const a of m.accept) {
        const r = ok(play(pos, at(a)));
        if (targets.length) expect(targetsLost(r, targets)).toBe(true);
        for (const s of saved) expect(libs(r, s).size >= 3 || (libs(r, s).size === 2 && !ladderWorks(r, s))).toBe(true);
      }
      // Pierres en atari ou à deux libertés : les autres libertés ne marchent pas, la bonne réponse est unique.
      if (marked.some(p => libs(pos, p).size > 2)) return;
      const others = new Set(marked.flatMap(p => [...libs(pos, p)]).filter(p => !m.accept.includes(toLabel(p, N))));
      for (const o of others) {
        const r = play(pos, o);
        if (typeof r === 'string') continue;
        if (targets.length) expect(targetsLost(r, targets), `${toLabel(o, N)} ne devrait pas suffire`).toBe(false);
        for (const s of saved) expect(libs(r, s).size, `${toLabel(o, N)} ne devrait pas sauver`).toBeLessThanOrEqual(1);
      }
    });
  }
});

describe('leçons : cas particuliers', () => {
  it('l1 : la pierre marquée est capturée, puis les deux pierres du groupe', () => {
    const s1 = fromRows(step('l1', 3).rows);
    expect(ok(play(s1.pos, at('E5'))).board[s1.marked[0]]).toBe(0);
    const r = ok(play(fromRows(step('l1', 5).rows).pos, at('E4')));
    expect(r.captures[1]).toBe(2);
  });
  it('l1 : dans le coin, deux libertés seulement ; au centre, quatre', () => {
    const fin = (i: number) => { const s = step('l1', i) as Extract<LessonStep, { kind: 'info' }>; return imagesDemo(s.rows, s.demo!).at(-1)!; };
    expect(fin(0).libs.map(p => toLabel(p, N)).sort()).toEqual(['D5', 'E4', 'E6', 'F5']);
    expect(fin(1).libs.map(p => toLabel(p, N)).sort()).toEqual(['A2', 'B1']);
  });
  it('l2 : la pierre blanche est en atari en F5', () => {
    const { pos } = fromRows(step('l2', 1).rows);
    expect([...libs(pos, at('E5'))].map(p => toLabel(p, N))).toEqual(['F5']);
  });
  it('l2 : s’allonger en E6 laisse en atari, capturer F5 sauve', () => {
    const { pos, marked } = fromRows(step('l2', 5).rows);
    expect(libs(ok(play(pos, at('E6'))), marked[0]).size).toBe(1);
    const r = ok(play(pos, at('F6')));
    expect(r.board[at('F5')]).toBe(0);
    expect(r.captures[1]).toBe(1);
  });
  it('l3 : l’échelle marche des deux côtés, et un casseur blanc la fait échouer', () => {
    const { pos, marked } = fromRows(step('l3', 7).rows);
    expect(ladderWorks(pos, marked[0])).toBe(true);
    const rows = step('l3', 7).rows.slice();
    rows[7] = '.O.......'; // pierre blanche en B2, sur le chemin de l'échelle
    const b = fromRows(rows);
    expect(canEscape(ok(play(b.pos, at('F5'))), b.marked[0])).toBe(true);
  });
  it('l3 : pousser vers le centre (E1) laisse la pierre s’échapper', () => {
    const { pos, marked } = fromRows(step('l3', 4).rows);
    expect(canEscape(ok(play(pos, at('E1'))), marked[0])).toBe(true);
  });
  it('l4 : après la capture, Blanc ne peut pas reprendre tout de suite ; l’étape suivante montre ce ko', () => {
    const { pos } = fromRows(step('l4', 3).rows);
    const r = ok(play(pos, at('F5')));
    expect(play(r, at('E5'))).toBe('ko');
    expect(fromRows(step('l4', 4).rows).pos.board).toEqual(r.board);
  });
  const corner = [...Array(N * N).keys()].filter(p => p % N <= 4 && Math.floor(p / N) >= 6);
  it('l5 : un groupe à deux yeux ne peut pas être tué', () => {
    for (const i of [0, 1, 2]) expect(isDead(fromRows(step('l5', i).rows, 2).pos, at('B2'), corner)).toBe(false);
  });
  it('l5 : A1 et C1 sont des yeux : vides, entourés seulement de pierres noires du même groupe', () => {
    const { pos } = fromRows(step('l5', 0).rows);
    const groupe = new Set(groupAt(pos.board, N, at('B2')).stones);
    for (const e of ['A1', 'C1']) {
      expect(pos.board[at(e)]).toBe(0);
      for (const q of neighbors(N)[at(e)]) expect(groupe.has(q), `${e} → ${toLabel(q, N)}`).toBe(true);
    }
  });
  it('l5 : deux yeux, Blanc ne peut jouer ni en A1 ni en C1', () => {
    const { pos } = fromRows(step('l5', 1).rows, 2);
    expect(play(pos, at('A1'))).toBe('suicide');
    expect(play(pos, at('C1'))).toBe('suicide');
  });
  it('l5 : B1 fait vivre le groupe noir ; ailleurs, Blanc le tue', () => {
    const { pos, marked } = fromRows(step('l5', 3).rows);
    expect(isDead(ok(play(pos, at('B1'))), marked[0], corner)).toBe(false);
    for (const l of ['A1', 'C1']) expect(isDead(ok(play(pos, at(l))), marked[0], corner), l).toBe(true);
  });
  it('l5 : B1 tue le groupe blanc ; sinon Blanc vit', () => {
    const { pos, marked } = fromRows(step('l5', 4).rows);
    expect(isDead(ok(play(pos, at('B1'))), marked[0], corner)).toBe(true);
    for (const l of ['A1', 'C1']) expect(isDead(ok(play(pos, at(l))), marked[0], corner), l).toBe(false);
  });
  it('l6 : « trois colonnes de neuf » pour Noir, 36 pour Blanc, comptés par le moteur ; la démo colore les mêmes points', () => {
    const q = step('l6', 0);
    const s = score(fromRows(q.rows).pos, 0, 'japanese');
    expect(s.territory[1]).toBe(27);
    expect(s.territory[2]).toBe(36);
    expect(step('l6', 1).text).toContain('trois colonnes de neuf');
    for (const [i, c] of [[1, 1], [2, 2]] as const) {
      const info = step('l6', i) as Extract<LessonStep, { kind: 'info' }>;
      const t = imagesDemo(info.rows, info.demo!).at(-1)!.terr!;
      expect(t.couleur).toBe(c);
      expect(t.points).toHaveLength(s.territory[c]);
    }
  });
});

/** Nombre de points écrit à la française : « 33,5 ». */
const pts = (n: number) => String(n).replace('.', ',');
/** Position d'une question, avec les prisonniers déjà faits (Noir, Blanc). */
function avecPrises(rows: string[], prises: [number, number] = [0, 0]): Position {
  const { pos } = fromRows(rows);
  return { ...pos, captures: [0, prises[0], prises[1]] };
}
type Quiz = Extract<LessonStep, { kind: 'quiz' }>;

describe('leçon 7 : compter les points (#177), chaque chiffre vient de score()', () => {
  const l7 = (i: number) => step('l7', i);
  it('komi annoncé : celui des parties normales (6,5)', () => {
    expect(KOMI_NORMAL).toBe(6.5);
    expect(l7(0).text).toContain(`komi (${pts(KOMI_NORMAL)} points`);
  });
  it('l7.1 : la démo compte 36 points noirs puis 27 blancs, comme le moteur', () => {
    const info = l7(0) as Extract<LessonStep, { kind: 'info' }>;
    const s = score(fromRows(info.rows).pos, KOMI_NORMAL, 'japanese');
    expect([s.territory[1], s.territory[2]]).toEqual([36, 27]);
    const im = imagesDemo(info.rows, info.demo!);
    expect(im.at(-2)!.terr).toMatchObject({ couleur: 1 });
    expect(im.at(-2)!.terr!.points).toHaveLength(36);
    expect(im.at(-1)!.terr!.points).toHaveLength(27);
    expect(frontieresOuvertes(fromRows(info.rows).pos.board, N)).toEqual([]);
  });
  for (const i of [1, 5]) it(`l7.${i + 1} : la bonne réponse est le score du moteur, les deux autres choix aussi sont des nombres`, () => {
    const q = l7(i) as Quiz;
    const c = q.compte!;
    const s = score(avecPrises(q.rows, c.prises), c.komi, 'japanese');
    expect(q.choices[q.answer]).toBe(pts(c.pour === 'B' ? s.black : s.white));
    expect(new Set(q.choices).size).toBe(3);
    for (const x of q.choices) expect(x).toMatch(/^\d+(,5)?$/);
  });
  it('l7.2 : Blanc 27 + 6,5 = 33,5 ; Noir 36 gagne de 2,5, comme le dit la réponse', () => {
    const q = l7(1) as Quiz;
    const s = score(avecPrises(q.rows), q.compte!.komi, 'japanese');
    expect([s.black, s.white, s.winner, s.margin]).toEqual([36, 33.5, 1, 2.5]);
    expect(q.ok).toContain(`27 + ${pts(KOMI_NORMAL)} = ${pts(s.white)}`);
    expect(q.ok).toContain(`${s.black}`);
    expect(q.ok).toContain(`${pts(s.margin)} points`);
    expect(q.terr).toBe(true);
  });
  it('l7.6 : avec 3 et 5 prisonniers, Noir 39, Blanc 38,5 : Noir gagne d’un demi-point', () => {
    const q = l7(5) as Quiz;
    const [pn, pb] = q.compte!.prises!;
    expect(q.text).toContain(`${pn} prisonniers, Blanc ${pb}`);
    const s = score(avecPrises(q.rows, q.compte!.prises), q.compte!.komi, 'japanese');
    expect([s.black, s.white, s.winner, s.margin]).toEqual([39, 38.5, 1, 0.5]);
    expect(q.ok).toContain(`36 + ${pn} = ${s.black}`);
    expect(q.ok).toContain(`27 + ${pb} + ${pts(KOMI_NORMAL)} = ${pts(s.white)}`);
    // Erreurs courantes : oublier les prisonniers (36), donner le komi à Noir (42,5).
    expect(q.choices).toEqual(['36', pts(s.black), pts(s.territory[1] + KOMI_NORMAL)]);
    expect(q.terr).toBeFalsy();
  });
  it('l7.3 : trou en E7, le territoire noir ne compte pas ; après E7, 36 points', () => {
    const info = l7(2) as Extract<LessonStep, { kind: 'info' }>;
    const { pos } = fromRows(info.rows);
    expect(score(pos, 0, 'japanese').territory[1]).toBe(0);
    expect(frontieresOuvertes(pos.board, N)).toContain(at('E7'));
    const t = imagesDemo(info.rows, info.demo!).at(-1)!.terr!;
    expect(t.couleur).toBe(1);
    expect(t.points).toHaveLength(36);
  });
  it('l7.3 et l7.4 : miroir, le trou est en E7 puis en E3 ; fermé, on retrouve la position du compte', () => {
    const r = ok(play(fromRows(l7(3).rows).pos, at('E3')));
    expect(r.board).toEqual(fromRows(l7(0).rows).pos.board);
    expect((l7(3) as Extract<LessonStep, { kind: 'move' }>).ok).toContain(`${score(r, 0, 'japanese').territory[1]} points`);
    // Si Noir passe, Blanc entre en E3.
    const w = play({ ...fromRows(l7(3).rows).pos, toPlay: 2 }, at('E3'));
    expect(typeof w).not.toBe('string');
  });
  it('l7.5 : tout est fermé, on passe ; jouer chez soi coûte un point, chez Blanc la pierre est seule chez lui', () => {
    const q = l7(4) as Quiz;
    expect(q.choices[q.answer]).toBe('Je passe');
    const { pos } = fromRows(q.rows);
    expect(frontieresOuvertes(pos.board, N)).toEqual([]);
    const avant = score(pos, KOMI_NORMAL, 'japanese').black;
    for (const l of ['A1', 'B5', 'D9']) expect(score(ok(play(pos, at(l))), KOMI_NORMAL, 'japanese').black, l).toBe(avant - 1);
    // Une pierre noire en H5 : aucune voisine noire, dans une zone entourée par Blanc seul.
    const h = ok(play(pos, at('H5')));
    expect(neighbors(N)[at('H5')].every(q => h.board[q] !== 1)).toBe(true);
    expect(score(pos, 0, 'japanese').owner[at('H5')]).toBe(2);
  });
});
