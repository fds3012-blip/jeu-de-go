// Issue #16 : leçons 9 à 12 (filet, prise en retour, course aux libertés, faux œil), prouvées avec src/go.
// Même exigence que les problèmes (src/go/lot-*.test.ts) : les réponses acceptées sont exactement les coups qui gagnent,
// chaque réfutation est rejouée, chaque démonstration montre ce que dit son texte.
// Captures : lecteur exact du lot N (tous les coups légaux et la passe, avec et sans ko), borné à k coups noirs.
// Vie et mort : preuve exhaustive de src/go/preuve-vie-mort.ts dans une zone fermée (vérifiée par defautsDeZone).
import { CHAPITRES, LESSONS, explicationRefus, type LessonStep } from '../content/lessons';
import { imagesDemo, type DemoImage } from '../content/demo';
import { ACQUIS } from '../content/acquis';
import { fromRows } from './position';
import { groupAt, play, type Position } from './rules';
import { fromLabel, toLabel } from './coords';
import { AVEC_KO, SANS_KO, attackerCaptures, captureEn } from './lecteurs-lot-n';
import { canEscape, hasTwoEyes } from './tactics';
import { coupsGagnants, defautsDeZone, evaluer, issueApres, yeuxDuGroupe } from './preuve-vie-mort';
import { cederLaMain, preuveParCoup } from './preuve-par-coup';

beforeEach(cederLaMain);

const N = 9;
const at = (l: string) => fromLabel(l, N);
const lab = (p: number) => (p < 0 ? 'passe' : toLabel(p, N));
const ok = (r: Position | string): Position => { if (typeof r === 'string') throw new Error(r); return r; };
const libs = (pos: Position | DemoImage, p: number) => groupAt(pos.board, N, p).liberties;
const labels = (ps: Iterable<number>) => [...ps].map(lab).sort();
const lecon = (id: string) => LESSONS.find(l => l.id === id)!;
type Info = Extract<LessonStep, { kind: 'info' }>;
type Move = Extract<LessonStep, { kind: 'move' }>;
type Touche = Extract<LessonStep, { kind: 'touche' }>;
const info = (id: string, i: number) => lecon(id).steps[i] as Info;
const move = (id: string, i: number) => lecon(id).steps[i] as Move;
const images = (s: Info) => imagesDemo(s.rows, s.demo!, s.avant);
/** Position d'une image de démonstration, avec le camp au trait. */
const posDe = (im: DemoImage, toPlay: 1 | 2): Position => ({ size: N, board: im.board.slice(), toPlay, ko: -1, captures: [0, 0, 0], lastMove: -1 });
/** Cibles d'une question : pierres marquées d'une couleur. */
const cibles = (s: Move, c: 1 | 2) => { const { pos, marked } = fromRows(s.rows); return marked.filter(p => pos.board[p] === c); };

describe('leçons 9 à 12 : place dans le programme (#16)', () => {
  it('quatre leçons de 3 à 6 étapes, rangées dans deux nouveaux chapitres en cours d’écriture', () => {
    for (const id of ['l9', 'l10', 'l11', 'l12']) expect(lecon(id).steps.length).toBeGreaterThanOrEqual(3);
    for (const id of ['l9', 'l10', 'l11', 'l12']) expect(lecon(id).steps.length).toBeLessThanOrEqual(6);
    const c = Object.fromEntries(CHAPITRES.map(x => [x.id, x]));
    expect(c.c3.titre).toBe('Capturer et sauver');
    expect(c.c3.lecons.map(l => l.id).slice(0, 3)).toEqual(['l9', 'l10', 'l11']);
    expect(c.c4.titre).toBe('Vie et mort');
    // Le chapitre « Vie et mort » continue avec les leçons 13 et 14 (src/go/lecons-13-16.test.ts).
    expect(c.c4.lecons.map(l => l.id)[0]).toBe('l12');
    expect([c.c3.complet, c.c4.complet]).toEqual([false, false]);
    for (const id of ['l9', 'l10', 'l11', 'l12']) expect(ACQUIS[id]).toBeTruthy();
  });
  it('vocabulaire expliqué à sa première apparition : filet (geta), semeai, faux œil, coin (diagonale)', () => {
    expect(info('l9', 1).text).toMatch(/^Filet \(geta\) : ferme ses sorties/);
    expect(move('l10', 2).ok).toMatch(/Prise en retour \(snapback\)/);
    expect(info('l11', 0).text).toMatch(/Course aux libertés \(semeai\)/);
    expect((lecon('l12').steps[2] as Touche).text).toMatch(/faux œil \(un œil que Blanc peut détruire\)/);
    expect((lecon('l12').steps[2] as Touche).no).toMatch(/coins \(diagonales\)/);
  });
  it('chaque coup refusé avec une explication est légal et n’est pas une réponse acceptée', () => {
    for (const id of ['l9', 'l10', 'l11', 'l12']) lecon(id).steps.forEach(s => {
      if (s.kind !== 'move' || !s.refus) return;
      const { pos } = fromRows(s.rows);
      for (const r of s.refus) for (const l of r.points) {
        expect(play(pos, at(l)), `${id} ${l}`).not.toBeTypeOf('string');
        expect(s.accept).not.toContain(l);
        expect(explicationRefus(s, l)).toBe(r.no);
      }
    });
  });
});

describe('leçon 9 : le filet (geta)', () => {
  const s1 = info('l9', 0), s2 = info('l9', 1), q = move('l9', 2);
  const T = at('E5');

  it('l9.1 : les deux atari échouent (l’échelle casse sur une pierre blanche) ; la démo finit à 3 libertés', () => {
    const { pos } = fromRows(s1.rows);
    expect(labels(libs(pos, T))).toEqual(['D5', 'E6']);
    for (const m of ['D5', 'E6']) expect(canEscape(ok(play(pos, at(m))), T), m).toBe(true);
    const fin = images(s1).at(-1)!;
    expect(fin.board[T]).toBe(2);
    expect(fin.compteur!.n).toBeGreaterThanOrEqual(3);
    // La pierre qui fuit rejoint la pierre blanche C7.
    expect(groupAt(fin.board, N, T).stones).toContain(at('C7'));
  });

  it('l9.2 : D6 ne touche pas la pierre et la prend en trois coups noirs, contre toute défense, avec ou sans ko', () => {
    const { pos } = fromRows(s2.rows);
    expect(libs(ok(play(pos, at('D6'))), T).size).toBe(2);
    for (const o of [AVEC_KO, SANS_KO]) expect(captureEn(pos, at('D6'), [T], 3, o)).toBe(true);
    const im = images(s2);
    expect(im.at(-1)!.board[T]).toBe(0);
    expect(['D5', 'E6'].every(l => im.at(-1)!.board[at(l)] === 0)).toBe(true);
    // Le compteur de libertés de la démo : 2 après le filet, puis jamais plus de 2.
    for (const x of im.slice(2)) if (x.compteur) expect(x.compteur.n).toBeLessThanOrEqual(2);
  });

  // l9.3 : les coups qui prennent la pierre en cinq coups noirs au plus sont exactement les réponses acceptées.
  { const { pos } = fromRows(q.rows); const t = cibles(q, 2);
    preuveParCoup('l9.3 (filet, 5 coups)', pos, (q.accept as string[]).map(at), m => captureEn(pos, m, t, 5)); }
  it('l9.3 : une seule pierre visée ; « elle a encore deux libertés » après chaque filet accepté', () => {
    const { pos } = fromRows(q.rows);
    const t = cibles(q, 2);
    expect(labels(t)).toEqual(['E5']);
    for (const a of q.accept as string[]) expect(libs(ok(play(pos, at(a))), t[0]).size, a).toBe(2);
  });

  it('l9.3 : réfutation, les deux atari laissent la pierre s’échapper', () => {
    const { pos } = fromRows(q.rows);
    const t = cibles(q, 2)[0];
    expect(labels(libs(pos, t))).toEqual([...q.refus![0].points].sort());
    for (const l of q.refus![0].points) expect(canEscape(ok(play(pos, at(l))), t), l).toBe(true);
  });
});

describe('leçon 10 : la prise en retour', () => {
  const s1 = info('l10', 0), s2 = info('l10', 1), q = move('l10', 2);

  it('l10.1 : la pierre posée en J5 est en atari, et Blanc la prend en H5', () => {
    const { pos } = fromRows(s1.rows);
    const r = ok(play(pos, at('J5')));
    expect(libs(r, at('J5')).size).toBe(1);
    const fin = images(s1).at(-1)!;
    expect(fin.board[at('J5')]).toBe(0);
    expect(fin.board[at('H5')]).toBe(2);
  });

  it('l10.2 : après la prise, le groupe blanc n’a qu’une liberté, J5 ; Noir y reprend trois pierres, sans ko', () => {
    const im = images(s2);
    expect(labels(im[1].libs)).toEqual(['J5']);
    const avant = posDe(im[1], 1);
    const r = ok(play(avant, at('J5')));
    expect(r.captures[1]).toBe(3);
    expect(r.ko).toBe(-1);
    expect(im.at(-1)!.board).toEqual(r.board);
    expect(s2.text).toContain('en atari');
  });

  // l10.3 : les coups qui prennent les pierres marquées en quatre coups noirs au plus sont exactement E9 ; sans ko aussi.
  { const { pos } = fromRows(q.rows); const t = cibles(q, 2);
    preuveParCoup('l10.3 (prise en retour, 4 coups)', pos, (q.accept as string[]).map(at), m => captureEn(pos, m, t, 4));
    preuveParCoup('l10.3 (prise en retour, 2 coups, sans ko)', pos, (q.accept as string[]).map(at), m => captureEn(pos, m, t, 2, SANS_KO)); }

  it('l10.3 : la suite annoncée, Blanc prend E9 en E8, Noir reprend trois pierres en E9 : pas un ko', () => {
    const { pos } = fromRows(q.rows);
    const a = ok(play(pos, at('E9')));
    const b = ok(play(a, at('E8')));
    expect(b.board[at('E9')]).toBe(0);
    const c = ok(play(b, at('E9')));
    expect(c.captures[1]).toBe(3);
    expect(c.ko).toBe(-1);
    expect(q.ok).toContain('trois');
  });

  it('l10.3 : réfutation, l’atari en E8 laisse Blanc se relier en E9 et respirer', () => {
    const { pos } = fromRows(q.rows);
    const t = cibles(q, 2);
    const r = ok(play(ok(play(pos, at('E8'))), at('E9')));
    expect(libs(r, t[0]).size).toBeGreaterThanOrEqual(3);
    expect(groupAt(r.board, N, t[0]).stones).toContain(at('B9'));
    expect(attackerCaptures(r, t, 3)).toBe(false);
    expect(q.refus![0].no).toContain('E9');
  });
});

describe('leçon 11 : la course aux libertés (semeai)', () => {
  const s1 = info('l11', 0), s2 = info('l11', 1), q = move('l11', 2);
  const blanc = at('E2'), noir = at('H2');

  it('l11.1 : deux groupes sans œil, trois libertés chacun, aucune en commun ; la démo compte 3 puis 3', () => {
    const { pos } = fromRows(s1.rows);
    const lb = libs(pos, blanc), ln = libs(pos, noir);
    expect([lb.size, ln.size]).toEqual([3, 3]);
    expect([...lb].some(l => ln.has(l))).toBe(false);
    for (const l of [...lb, ...ln]) expect(groupAt(pos.board, N, l).stones.length).toBe(1);
    expect(yeuxDuGroupe(pos, blanc)).toEqual([]);
    expect(yeuxDuGroupe(pos, noir)).toEqual([]);
    const im = images(s1);
    expect(im.filter(x => x.compteur && x.libs.length === x.compteur.n).map(x => x.compteur!.n).slice(-1)).toEqual([3]);
    expect(im.at(-1)!.compteur!.p).toBe(noir);
    expect([...(s1.geste as { touche: string[] }).touche].sort()).toEqual(labels(groupAt(pos.board, N, blanc).stones));
  });

  it('l11.2 : Noir joue d’abord et gagne : D1 prend le groupe blanc en trois coups, contre toute défense', () => {
    const { pos } = fromRows(s2.rows);
    for (const o of [AVEC_KO, SANS_KO]) expect(captureEn(pos, at('D1'), [blanc], 3, o)).toBe(true);
    // La démo ne montre aucun coup suicidaire de Blanc : chacune de ses pierres garde au moins deux libertés.
    const im = images(s2);
    for (const x of im) if (x.derniere != null && x.board[x.derniere] === 2) expect(libs(x, x.derniere).size, lab(x.derniere)).toBeGreaterThanOrEqual(2);
    const fin = im.at(-1)!;
    expect(['D2', 'E2', 'F2'].every(l => fin.board[at(l)] === 0)).toBe(true);
    expect(fin.board[noir]).toBe(1);
  });

  // l11.3 : les coups qui gagnent la course en quatre coups noirs au plus sont exactement les réponses acceptées.
  { const { pos } = fromRows(q.rows); const t = cibles(q, 2);
    preuveParCoup('l11.3 (course, 4 coups)', pos, (q.accept as string[]).map(at), m => captureEn(pos, m, t, 4)); }
  it('l11.3 : après chaque réponse acceptée, Blanc n’a plus qu’une liberté', () => {
    const { pos } = fromRows(q.rows);
    const t = cibles(q, 2);
    for (const a of q.accept as string[]) expect(libs(ok(play(pos, at(a))), t[0]).size, a).toBe(1);
  });

  it('l11.3 : réfutation, boucher sa propre liberté perd la course (Blanc prend en deux coups)', () => {
    const { pos } = fromRows(q.rows);
    const miens = cibles(q, 1);
    expect(labels(libs(pos, miens[0]))).toEqual([...q.refus![0].points].sort());
    for (const l of q.refus![0].points) expect(attackerCaptures(ok(play(pos, at(l))), miens, 2), l).toBe(true);
  });
});

describe('leçon 12 : le faux œil', () => {
  const s1 = info('l12', 0), s2 = info('l12', 1), s3 = lecon('l12').steps[2] as Touche, q4 = move('l12', 3), q5 = move('l12', 4);
  const B2 = at('B2');

  it('l12.1 : A1 est un vrai œil, C1 un faux œil ; D1 et E1 ne sont pas reliées au groupe et ont deux libertés, C1 et F1', () => {
    const { pos } = fromRows(s1.rows);
    expect(yeuxDuGroupe(pos, B2).map(e => `${lab(e.point)} ${e.vrai ? 'vrai' : 'faux'}`).sort()).toEqual(['A1 vrai', 'C1 faux']);
    expect(groupAt(pos.board, N, B2).stones).not.toContain(at('D1'));
    expect(labels(libs(pos, at('D1')))).toEqual(['C1', 'F1']);
    expect(labels(groupAt(pos.board, N, at('D1')).stones)).toEqual([...(s1.geste as { touche: string[] }).touche].sort());
    const fin = images(s1).at(-1)!;
    expect(labels(fin.yeux)).toEqual(['A1', 'C1']);
    expect(fin.compteur).toEqual({ p: at('D1'), n: 2 });
  });

  it('l12.2 : F1 met D1 en atari ; relier en C1 laisse une seule liberté (A1), et Blanc prend sept pierres', () => {
    const im = images(s2);
    const apresF1 = im.findIndex(x => x.derniere === at('F1'));
    expect(im[apresF1].compteur).toEqual({ p: at('D1'), n: 1 });
    const apresC1 = im.findIndex(x => x.derniere === at('C1'));
    expect(labels(libs(im[apresC1], B2))).toEqual(['A1']);
    const fin = im.at(-1)!;
    expect(['A2', 'B2', 'C2', 'B1', 'C1', 'D1', 'E1'].every(l => fin.board[at(l)] === 0)).toBe(true);
  });

  it('l12.2 : le groupe noir est mort, même si Noir joue le premier, sans aucun ko (zone fermée A1, C1, F1)', () => {
    const { pos } = fromRows(s2.rows);
    const zone = ['A1', 'C1', 'F1'].map(at);
    expect(defautsDeZone(pos, B2, zone)).toEqual([]);
    // La preuve compte tout ko comme « non résolu » : -1 dit que Blanc tue sans passer par un ko.
    expect(evaluer(pos, B2, zone)).toBe(-1);
    // Si Noir ne relie pas, Blanc prend D1 et E1 en C1 : deux pierres, donc pas de ko.
    const r = ok(play(ok(play(ok(play(pos, -1)), at('F1'))), -1));
    const w = ok(play(r, at('C1')));
    expect(w.captures[2]).toBe(2);
    expect(w.ko).toBe(-1);
  });

  it('l12.3 : le seul faux œil du groupe est la réponse ; son coin D2 est blanc', () => {
    const { pos } = fromRows(s3.rows);
    const faux = yeuxDuGroupe(pos, B2).filter(e => !e.vrai).map(e => lab(e.point));
    expect(faux).toEqual(s3.accept);
    expect(pos.board[at('D2')]).toBe(2);
    expect(yeuxDuGroupe(pos, B2).filter(e => e.vrai).map(e => lab(e.point))).toEqual(['A1']);
  });

  it('l12.4 : les coups qui font vivre le groupe noir sont exactement D2 ; boucher un œil le tue', () => {
    const { pos, marked } = fromRows(q4.rows);
    const zone = ['A1', 'C1', 'D2'].map(at);
    expect(defautsDeZone(pos, marked[0], zone)).toEqual([]);
    expect(coupsGagnants(pos, marked[0], zone, 'vivre').map(lab)).toEqual(q4.accept);
    for (const l of q4.refus![0].points) expect(issueApres(pos, at(l), marked[0], zone), l).toBe(-1);
    const r = ok(play(pos, at('D2')));
    expect(hasTwoEyes(r, marked[0])).toBe(true);
    expect(yeuxDuGroupe(r, marked[0]).every(e => e.vrai)).toBe(true);
    // Si Blanc prend D2 le premier, C1 devient le faux œil de l'étape 3.
    expect(ok(play({ ...pos, toPlay: 2 }, at('D2'))).board).toEqual(fromRows(s3.rows).pos.board);
  });

  it('l12.5 : le coup qui tue le groupe blanc est exactement F8 ; après lui, G9 est un faux œil', () => {
    const { pos, marked } = fromRows(q5.rows);
    const zone = ['J9', 'G9', 'F8'].map(at);
    expect(defautsDeZone(pos, marked[0], zone)).toEqual([]);
    expect(coupsGagnants(pos, marked[0], zone, 'tuer').map(lab)).toEqual(q5.accept);
    const r = ok(play(pos, at('F8')));
    expect(yeuxDuGroupe(r, marked[0]).map(e => `${lab(e.point)} ${e.vrai ? 'vrai' : 'faux'}`).sort()).toEqual(['G9 faux', 'J9 vrai']);
  });
});
