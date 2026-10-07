// Issue #16 (palier vers 8 kyu, leçons 32 et suivantes) : fin de partie et tesuji, chaque position prouvée par src/go.
// Même exigence que les leçons 21 à 31 : les réponses acceptées sont exactement les coups qui atteignent le but, chaque
// réfutation est rejouée, chaque démonstration montre ce que dit son texte, chaque chiffre est recompté.
// - Fin de partie : minimax exact de src/go/preuve-fin-de-partie.ts (élagage alpha-bêta, bornes basse et haute égales,
//   sinon aucune preuve) sur les endroits encore ouverts. Le meilleur coup se prouve en comptage par surfaces (une pierre
//   posée chez l'adversaire s'y prend sans perte) ; les chiffres annoncés au joueur sont recomptés en règle japonaise
//   (score() de src/go/score.ts) sur les suites montrées.
// - Tesuji et vie et mort : preuve exhaustive de src/go/preuve-vie-mort.ts en zone fermée (vérifiée par defautsDeZone ;
//   un ko n'est jamais compté comme une preuve), ou lecteur exact de capture sans ko.
import { CHAPITRES, LESSONS, explicationRefus, type LessonStep } from '../content/lessons';
import { imagesDemo, mots } from '../content/demo';
import { ACQUIS } from '../content/acquis';
import { THEMES_DE_LECON } from '../content/themes';
import { fromRows } from './position';
import { groupAt, isLegal, neighbors, play, type Position } from './rules';
import { fromLabel, toLabel } from './coords';
import { score } from './score';
import { meilleursCoups, valeursDesCoups } from './preuve-fin-de-partie';
import { defautsConnexion, evaluerConnexion, issueConnexion } from './preuve-connexion';

const N = 9;
const at = (l: string) => fromLabel(l, N);
const lab = (p: number) => (p < 0 ? 'passe' : toLabel(p, N));
const ok = (r: Position | string): Position => { if (typeof r === 'string') throw new Error(r); return r; };
const labels = (ps: Iterable<number>) => [...ps].map(lab).sort();
const lecon = (id: string) => LESSONS.find(l => l.id === id)!;
type Info = Extract<LessonStep, { kind: 'info' }>;
type Move = Extract<LessonStep, { kind: 'move' }>;
type Quiz = Extract<LessonStep, { kind: 'quiz' }>;
const step = <S extends LessonStep>(id: string, i: number) => lecon(id).steps[i] as S;
const images = (s: Info) => imagesDemo(s.rows, s.demo!, s.avant);
const avec = (rows: string[], toPlay: 1 | 2) => fromRows(rows, toPlay).pos;
const tous = [...Array(N * N).keys()];
/** Joue une suite de coups (étiquettes ou « passe »), en alternant à partir du camp au trait. */
const suite = (pos: Position, coups: string[]) => coups.reduce((p, c) => ok(play(p, at(c))), pos);
/** Noir moins Blanc, règle japonaise (territoire et prisonniers), sans komi. */
const japonais = (pos: Position) => { const s = score(pos, 0, 'japanese'); return s.black - s.white; };
const surfaces = { regle: 'chinese' as const };
const groupAtLibs = (pos: Position, p: number) => groupAt(pos.board, N, p).liberties;

/** Endroits encore ouverts : les points vides dont la région vide touche les deux couleurs. */
function ouverts(pos: Position): number[] {
  const nb = neighbors(N), vu = new Set<number>(), out: number[] = [];
  for (const p of tous) {
    if (pos.board[p] || vu.has(p)) continue;
    const region: number[] = [], pile = [p], bord = new Set<number>();
    vu.add(p);
    while (pile.length) {
      const q = pile.pop()!;
      region.push(q);
      for (const r of nb[q]) {
        if (pos.board[r]) bord.add(pos.board[r]);
        else if (!vu.has(r)) { vu.add(r); pile.push(r); }
      }
    }
    if (bord.size === 2) out.push(...region);
  }
  return out.sort((a, b) => a - b);
}

const LENT = 60_000;
const IDS = ['l32', 'l33', 'l34', 'l35', 'l36'];

describe('leçons 32 et suivantes : place dans le programme (#16)', () => {
  it('chaque leçon a 4 à 6 étapes, sa phrase de fin et sa série de pratique', () => {
    for (const id of IDS) {
      expect(lecon(id).steps.length, id).toBeGreaterThanOrEqual(4);
      expect(lecon(id).steps.length, id).toBeLessThanOrEqual(6);
      expect(ACQUIS[id], id).toBeTruthy();
      expect(THEMES_DE_LECON[id]?.length, id).toBeGreaterThan(0);
    }
  });
  it('la valeur d’un coup et le sente avant le gote prolongent « Fin de partie et comptage », le watari « Formes et tesuji »', () => {
    const c = Object.fromEntries(CHAPITRES.map(x => [x.id, x]));
    expect(c.c5.lecons.map(l => l.id)).toEqual(['l15', 'l16', 'l22', 'l23', 'l32', 'l33']);
    expect(c.c6.lecons.map(l => l.id)).toEqual(['l18', 'l19', 'l20', 'l21', 'l34', 'l35', 'l36']);
    expect(LESSONS.map(l => l.id)).toEqual(CHAPITRES.flatMap(x => x.lecons.map(l => l.id)));
  });
  it('chaque consigne tient en 12 mots ; chaque geste « pose » est sur le point vert ; au plus une étape sans geste', () => {
    for (const id of IDS) {
      lecon(id).steps.forEach((s, i) => {
        expect(mots(s.text), `${id}.${i + 1}`).toBeLessThanOrEqual(12);
        if (s.kind === 'info' && s.geste && 'pose' in s.geste) expect(s.text, `${id}.${i + 1}`).toContain('point vert');
      });
      expect(lecon(id).steps.filter(s => s.kind === 'info' && !s.geste).length, id).toBeLessThanOrEqual(1);
    }
  });
  it('chaque coup refusé avec une explication est légal, n’est pas une réponse acceptée, et reçoit son explication', () => {
    for (const id of IDS) lecon(id).steps.forEach(s => {
      if (s.kind !== 'move' || !s.refus) return;
      const { pos } = fromRows(s.rows);
      for (const r of s.refus) for (const l of r.points) {
        expect(isLegal(pos, at(l)), `${id} ${l}`).toBe(true);
        expect(s.accept).not.toContain(l);
        expect(explicationRefus(s, l)).toBe(r.no);
      }
    });
  });
});

describe('leçon 32 : la valeur d’un coup', () => {
  const V = step<Info>('l32', 0).rows;

  it('la partie est finie sauf deux endroits : E9 en haut, le premier rang A1-F1 en bas', () => {
    expect(labels(ouverts(avec(V, 1)))).toEqual(['A1', 'B1', 'C1', 'D1', 'E1', 'E9', 'F1']);
  });

  it('l32.1 : E9 prend C9 et D9 ; deux prisonniers, et C9-D9 deviennent du territoire noir', () => {
    const r = ok(play(avec(V, 1), at('E9')));
    expect(r.captures[1]).toBe(2);
    const s = score(r, 0, 'japanese');
    for (const l of ['C9', 'D9']) expect(s.owner[at(l)], l).toBe(1);
    const im = images(step<Info>('l32', 0));
    expect(im.at(-1)!.board).toEqual(r.board);
    expect(labels(im.at(-1)!.yeux)).toEqual(['C9', 'D9']);
    // Gote : après la prise, il n'y a plus rien à défendre en haut.
    expect(labels(ouverts(r))).toEqual(['A1', 'B1', 'C1', 'D1', 'E1', 'F1']);
  });

  it('l32.2 et l32.3 : si Blanc relie en E9, Noir ne gagne rien ; prendre ou relier fait quatre points d’écart', () => {
    const pos = avec(V, 1);
    const relie = suite(pos, ['passe', 'E9']);
    expect(relie.captures[1]).toBe(0);
    expect(labels(ouverts(relie))).toEqual(['A1', 'B1', 'C1', 'D1', 'E1', 'F1']);
    expect(images(step<Info>('l32', 1)).at(-1)!.board[at('E9')]).toBe(2);
    const ecart = japonais(suite(pos, ['E9', 'passe'])) - japonais(relie);
    expect(ecart).toBe(4);
    const q = step<Quiz>('l32', 2);
    expect(q.choices[q.answer]).toBe(String(ecart));
  });

  it('l32.1 : sur la position de la leçon, la prise E9 est le seul meilleur coup de Noir', () => {
    expect(meilleursCoups(avec(V, 1), ouverts(avec(V, 1)), surfaces).map(lab)).toEqual(['E9']);
  }, LENT);

  it('l32.4 : retournée, la prise E1 est le seul meilleur coup ; le haut perd au moins deux points ; le hane vaut 2, la prise 4', () => {
    const m = step<Move>('l32', 3);
    expect(m.rows).toEqual([...V].reverse());
    const pos = avec(m.rows, 1);
    const z = ouverts(pos);
    expect(labels(z)).toEqual(['A9', 'B9', 'C9', 'D9', 'E1', 'E9', 'F9']);
    expect(meilleursCoups(pos, z, surfaces).map(lab)).toEqual(m.accept);
    const v = valeursDesCoups(pos, z, surfaces);
    for (const l of m.refus![0].points) expect(v.get(at('E1'))! - v.get(at(l))!, l).toBeGreaterThanOrEqual(2);
    // Règle japonaise, sur les suites montrées : le hane (Noir E9, Blanc F9, Noir D9) contre celui de Blanc (D9, C9, E9).
    expect(japonais(suite(pos, ['E9', 'F9', 'D9'])) - japonais(suite(pos, ['passe', 'D9', 'C9', 'E9']))).toBe(2);
    expect(japonais(suite(pos, ['E1', 'passe'])) - japonais(suite(pos, ['passe', 'E1']))).toBe(4);
  }, LENT);
});

describe('leçon 33 : le sente avant le gote', () => {
  const S = step<Info>('l33', 0).rows;

  it('deux endroits ouverts : la prise E9 en haut, l’atari E2 en bas (leçon 22)', () => {
    expect(labels(ouverts(avec(S, 1)))).toEqual(['E2', 'E9', 'F1', 'F2']);
    // En haut, D9 est en atari : la prendre fait deux points d'écart (un prisonnier, un point).
    const pos = avec(S, 1);
    expect(japonais(suite(pos, ['E9', 'passe'])) - japonais(suite(pos, ['passe', 'E9']))).toBe(2);
    expect(S.slice(7)).toEqual(step<Info>('l22', 0).rows.slice(7));
  });

  it('l33.1 et l33.2 : l’atari E2 est le seul meilleur coup ; Blanc doit relier en F1 ; puis la prise E9', () => {
    const pos = avec(S, 1), z = ouverts(pos);
    for (const regle of ['japanese', 'chinese'] as const) expect(meilleursCoups(pos, z, { regle }).map(lab), regle).toEqual(['E2']);
    const r = ok(play(pos, at('E2')));
    const v = valeursDesCoups(r, z, surfaces);
    expect(meilleursCoups(r, z, surfaces).map(lab)).toEqual(['F1']);
    for (const [m, x] of v) if (m !== at('F1')) expect(x - v.get(at('F1'))!, lab(m)).toBeGreaterThanOrEqual(2);
    const rf = ok(play(r, at('F1')));
    expect(rf.toPlay).toBe(1);
    expect(meilleursCoups(rf, z, surfaces).map(lab)).toEqual(['E9']);
    const im1 = images(step<Info>('l33', 0));
    expect(labels(im1.find(x => x.atari.length)!.atari)).toEqual(['D1', 'E1']);
    expect(im1.at(-1)!.board).toEqual(rf.board);
    const s2 = step<Info>('l33', 1);
    expect(s2.avant).toEqual([{ pose: 'E2', couleur: 'B' }, { pose: 'F1', couleur: 'W' }]);
    expect(images(s2).at(-1)!.board).toEqual(ok(play(rf, at('E9'))).board);
  }, LENT);

  it('l33.3 et l33.4 : la prise d’abord, Blanc répond E2 ; deux points d’écart (règle japonaise)', () => {
    const pos = avec(S, 1), z = ouverts(pos);
    const q3 = step<Quiz>('l33', 2);
    expect(meilleursCoups(ok(play(pos, at('E9'))), z, surfaces).map(lab)).toEqual([q3.choices[q3.answer]]);
    const sente = japonais(suite(pos, ['E2', 'F1', 'E9'])), prise = japonais(suite(pos, ['E9', 'E2']));
    const q4 = step<Quiz>('l33', 3);
    expect(sente - prise).toBe(2);
    expect(q4.choices[q4.answer]).toBe(String(sente - prise));
    // Compte par surfaces, jeu exact : la prise d'abord coûte aussi deux points.
    const v = valeursDesCoups(pos, z, surfaces);
    expect(v.get(at('E2'))! - v.get(at('E9'))!).toBe(2);
  }, LENT);

  it('l33.5 : retournée, seul l’atari E8 est le meilleur coup ; la prise E1 d’abord perd deux points', () => {
    const m = step<Move>('l33', 4);
    expect(m.rows).toEqual([...S].reverse());
    const pos = avec(m.rows, 1), z = ouverts(pos);
    expect(meilleursCoups(pos, z, surfaces).map(lab)).toEqual(m.accept);
    const v = valeursDesCoups(pos, z, surfaces);
    expect(v.get(at('E8'))! - v.get(at('E1'))!).toBe(2);
    expect(meilleursCoups(ok(play(pos, at('E1'))), z, surfaces).map(lab)).toEqual(['E8']);
    expect(japonais(suite(pos, ['E8', 'F9', 'E1'])) - japonais(suite(pos, ['E1', 'E8']))).toBe(2);
  }, LENT);
});

describe('leçon 34 : relier par en dessous (watari)', () => {
  const W = step<Info>('l34', 0).rows;
  /** Zone : les deux premières rangées, de A à F (sous le mur blanc, jusqu'au mur noir G). */
  const ZONE = [7, 8].flatMap(y => [0, 1, 2, 3, 4, 5].map(x => y * N + x));
  const ZONE_M = ZONE.map(p => Math.floor(p / N) * N + (N - 1 - (p % N)));
  const B2 = at('B2'), G2 = at('G2');
  /** Coups de Noir (dans la zone) qui relient à coup sûr, sans ko. */
  const relient = (pos: Position, a: number, b: number, zone: number[]) =>
    zone.filter(p => !pos.board[p] && issueConnexion(pos, p, a, b, zone) === 1).map(lab).sort();

  it('la zone est fermée : rien ne se décide hors des deux premières rangées', () => {
    expect(defautsConnexion(avec(W, 1), B2, G2, ZONE)).toEqual([]);
    expect(defautsConnexion(avec(step<Move>('l34', 3).rows, 1), at('H2'), at('C2'), ZONE_M)).toEqual([]);
  });

  it('l34.1 : E1, sous la pierre blanche, est le seul coup qui relie ; si Blanc joue d’abord, il coupe', () => {
    const pos = avec(W, 1);
    expect(relient(pos, B2, G2, ZONE)).toEqual(['E1']);
    expect(evaluerConnexion(avec(W, 2), B2, G2, ZONE)).toBe(-1);
    expect(images(step<Info>('l34', 0)).at(-1)!.board[at('E1')]).toBe(1);
  });

  it('l34.2 : après E1, Blanc coupe en D1 ; D2 le met en atari, et seul D2 relie', () => {
    const s = step<Info>('l34', 1);
    expect(s.avant).toEqual([{ pose: 'E1', couleur: 'B' }]);
    const r = suite(avec(W, 1), ['E1', 'D1']);
    expect(relient(r, B2, G2, ZONE)).toEqual(['D2']);
    const d2 = ok(play(r, at('D2')));
    expect(labels(groupAtLibs(d2, at('D1')))).toEqual(['C1']);
    expect(images(s).at(-1)!.board).toEqual(d2.board);
  });

  it('l34.3 : après E1 et la coupe D2, seul D1 relie ; C1 laisse Blanc couper en D1 ; ensuite C1 blanc serait en atari', () => {
    const m = step<Move>('l34', 2);
    const pos = avec(m.rows, 1);
    expect(pos.board).toEqual(suite(avec(W, 1), ['E1', 'D2']).board);
    expect(relient(pos, B2, G2, ZONE)).toEqual(m.accept);
    const c1 = ok(play(pos, at('C1')));
    expect(issueConnexion(c1, at('D1'), B2, G2, ZONE)).toBe(-1);
    const c1blanc = suite(pos, ['D1', 'C1']);
    expect(labels(groupAtLibs(c1blanc, at('C1')))).toEqual(['B1']);
  });

  it('l34.4 : en miroir, seul E1 relie ; F2 laisse Blanc bloquer en E1', () => {
    const m = step<Move>('l34', 3);
    expect(m.rows).toEqual(W.map(r => [...r].reverse().join('')));
    const pos = avec(m.rows, 1), H2 = at('H2'), C2 = at('C2');
    expect(relient(pos, H2, C2, ZONE_M)).toEqual(m.accept);
    expect(issueConnexion(ok(play(pos, at('F2'))), at('E1'), H2, C2, ZONE_M)).toBe(-1);
  });
});

describe('leçon 35 : couper par en dessous', () => {
  const D = step<Info>('l35', 0).rows;
  const ZONE = [7, 8].flatMap(y => [0, 1, 2, 3, 4, 5].map(x => y * N + x));
  const ZONE_M = ZONE.map(p => Math.floor(p / N) * N + (N - 1 - (p % N)));
  const B2 = at('B2'), G2 = at('G2');
  /** Coups noirs (dans la zone) qui coupent à coup sûr les pierres blanches a et b, sans ko. */
  const coupent = (pos: Position, a: number, b: number, zone: number[]) =>
    zone.filter(p => !pos.board[p] && issueConnexion(pos, p, a, b, zone) === -1).map(lab).sort();

  it('la zone est fermée ; Blanc au trait relie (par F1)', () => {
    expect(defautsConnexion(avec(D, 1), B2, G2, ZONE)).toEqual([]);
    expect(defautsConnexion(avec(step<Move>('l35', 3).rows, 1), at('H2'), at('C2'), ZONE_M)).toEqual([]);
    expect(evaluerConnexion(avec(D, 2), B2, G2, ZONE)).toBe(1);
  });

  it('l35.1 : E1 est le seul coup qui coupe ; E2, le blocage naturel, laisse Blanc répondre en E1 sans coupe possible', () => {
    const pos = avec(D, 1);
    expect(coupent(pos, B2, G2, ZONE)).toEqual(['E1']);
    const e2 = suite(pos, ['E2', 'E1']);
    expect(coupent(e2, B2, G2, ZONE)).toEqual([]);
    expect(images(step<Info>('l35', 0)).at(-1)!.board[at('E1')]).toBe(1);
  });

  it('l35.2 et l35.3 : après E1, E2 et F1 se répondent : chacun coupe si Blanc prend l’autre, et seulement lui', () => {
    const e1 = ok(play(avec(D, 1), at('E1')));
    expect(evaluerConnexion(e1, B2, G2, ZONE)).toBe(-1);
    expect(coupent(ok(play(e1, at('E2'))), B2, G2, ZONE)).toEqual(['F1']);
    expect(coupent(ok(play(e1, at('F1'))), B2, G2, ZONE)).toEqual(['E2']);
    const s = step<Info>('l35', 1);
    expect(s.avant).toEqual([{ pose: 'E1', couleur: 'B' }]);
    expect(images(s).at(-1)!.board).toEqual(suite(e1, ['E2', 'F1']).board);
    const q = step<Quiz>('l35', 2);
    expect(q.choices[q.answer]).toBe('E2');
  });

  it('l35.4 : en miroir, seul E1 coupe ; E2 ou D1, Blanc répond en E1 et Noir ne coupe plus sans ko', () => {
    const m = step<Move>('l35', 3);
    expect(m.rows).toEqual(D.map(r => [...r].reverse().join('')));
    const pos = avec(m.rows, 1), H2 = at('H2'), C2 = at('C2');
    expect(coupent(pos, H2, C2, ZONE_M)).toEqual(m.accept);
    for (const l of m.refus![0].points) expect(coupent(suite(pos, [l, 'E1']), H2, C2, ZONE_M), l).toEqual([]);
    const e1 = ok(play(pos, at('E1')));
    expect(coupent(ok(play(e1, at('E2'))), H2, C2, ZONE_M)).toEqual(['D1']);
    expect(coupent(ok(play(e1, at('D1'))), H2, C2, ZONE_M)).toEqual(['E2']);
  });
});

describe('leçon 36 : couper, puis reprendre', () => {
  const R = step<Info>('l36', 0).rows;
  const ZONE = [7, 8].flatMap(y => [0, 1, 2, 3, 4, 5].map(x => y * N + x));
  const ZONE_M = ZONE.map(p => Math.floor(p / N) * N + (N - 1 - (p % N)));
  const B2 = at('B2'), G2 = at('G2');
  const coupent = (pos: Position, a: number, b: number, zone: number[]) =>
    zone.filter(p => !pos.board[p] && issueConnexion(pos, p, a, b, zone) === -1).map(lab).sort();

  it('la zone est fermée ; Blanc au trait passe', () => {
    expect(defautsConnexion(avec(R, 1), B2, G2, ZONE)).toEqual([]);
    expect(defautsConnexion(avec(step<Move>('l36', 3).rows, 1), at('H2'), at('C2'), ZONE_M)).toEqual([]);
    expect(evaluerConnexion(avec(R, 2), B2, G2, ZONE)).toBe(1);
  });

  it('l36.1 : B1 est le seul coup qui coupe ; ensuite, toute réponse blanche reste coupée', () => {
    const pos = avec(R, 1);
    expect(coupent(pos, B2, G2, ZONE)).toEqual(['B1']);
    expect(evaluerConnexion(ok(play(pos, at('B1'))), B2, G2, ZONE)).toBe(-1);
    expect(images(step<Info>('l36', 0)).at(-1)!.board[at('B1')]).toBe(1);
  });

  it('l36.2 : Blanc relie en C1 ; E1 est la seule coupe, et met cinq pierres blanches en atari', () => {
    const r = suite(avec(R, 1), ['B1', 'C1']);
    expect(coupent(r, B2, G2, ZONE)).toEqual(['E1']);
    const e1 = ok(play(r, at('E1')));
    const g = groupAt(e1.board, N, at('C1'));
    expect(g.stones.length).toBe(5);
    expect(labels(g.liberties)).toEqual(['A1']);
    const s = step<Info>('l36', 1);
    expect(images(s).at(-1)!.board).toEqual(e1.board);
    expect(labels(images(s).at(-1)!.atari)).toEqual(labels(g.stones));
  });

  it('l36.3 : Blanc prend B1 en A1 ; Noir reprend en B1 et prend six pierres (prise en retour)', () => {
    const a1 = suite(avec(R, 1), ['B1', 'C1', 'E1', 'A1']);
    expect(a1.board[at('B1')]).toBe(0);
    expect(a1.ko).toBe(-1);
    const r = ok(play(a1, at('B1')));
    expect(r.captures[1] - a1.captures[1]).toBe(6);
    const s = step<Info>('l36', 2);
    expect(images(s).at(-1)!.board).toEqual(r.board);
  });

  it('l36.4 : en miroir, seul H1 coupe ; après E1 ou G1, Blanc prend H1 et Noir ne coupe plus sans ko', () => {
    const m = step<Move>('l36', 3);
    expect(m.rows).toEqual(R.map(r => [...r].reverse().join('')));
    const pos = avec(m.rows, 1), H2 = at('H2'), C2 = at('C2');
    expect(coupent(pos, H2, C2, ZONE_M)).toEqual(m.accept);
    for (const l of m.refus![0].points) expect(coupent(suite(pos, [l, 'H1']), H2, C2, ZONE_M), l).toEqual([]);
  });
});
