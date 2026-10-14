// Issue #539 (vers 5 kyu, leçons 37 et suivantes) : chaque position prouvée par src/go, comme les leçons 21 à 36.
// Les réponses acceptées sont exactement les coups qui atteignent le but, chaque réfutation est rejouée, chaque
// démonstration montre ce que dit son texte, chaque chiffre est recompté.
// - Vie et mort (miai) : preuve exhaustive de src/go/preuve-vie-mort.ts en zone fermée (vérifiée par defautsDeZone ;
//   un ko n'est jamais compté comme une preuve). Un coup de Noir hors de la zone vaut une passe : la passe est jugée.
// - Fin de partie (jouer ailleurs) : minimax exact de src/go/preuve-fin-de-partie.ts (élagage alpha-bêta, bornes basse et
//   haute égales, sinon aucune preuve) sur les endroits encore ouverts, en comptage par surfaces ; les chiffres annoncés
//   au joueur sont recomptés en règle japonaise (score() de src/go/score.ts) sur les suites montrées.
import { CHAPITRES, LESSONS, explicationRefus, type LessonStep } from '../content/lessons';
import { imagesDemo, mots } from '../content/demo';
import { ACQUIS } from '../content/acquis';
import { THEMES_DE_LECON } from '../content/themes';
import { fromRows } from './position';
import { isLegal, neighbors, play, type Position } from './rules';
import { score } from './score';
import { meilleursCoups, valeursDesCoups } from './preuve-fin-de-partie';
import { fromLabel, toLabel } from './coords';
import { coupsGagnants, defautsDeZone, evaluer, yeuxDuGroupe } from './preuve-vie-mort';

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
/** Joue une suite de coups (étiquettes ou « passe »), en alternant à partir du camp au trait. */
const suite = (pos: Position, coups: string[]) => coups.reduce((p, c) => ok(play(p, at(c))), pos);

/** Noir moins Blanc, règle japonaise (territoire et prisonniers), sans komi. */
const japonais = (pos: Position) => { const s = score(pos, 0, 'japanese'); return s.black - s.white; };
const surfaces = { regle: 'chinese' as const };

/** Endroits encore ouverts : les points vides dont la région vide touche les deux couleurs. */
function ouverts(pos: Position): number[] {
  const nb = neighbors(N), vu = new Set<number>(), out: number[] = [];
  for (let p = 0; p < N * N; p++) {
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
const IDS = ['l37', 'l38'];

describe('leçons 37 et suivantes : place dans le programme (#539)', () => {
  it('chaque leçon a 4 à 6 étapes, sa phrase de fin et sa série de pratique', () => {
    for (const id of IDS) {
      expect(lecon(id).steps.length, id).toBeGreaterThanOrEqual(4);
      expect(lecon(id).steps.length, id).toBeLessThanOrEqual(6);
      expect(ACQUIS[id], id).toBeTruthy();
      expect(THEMES_DE_LECON[id]?.length, id).toBeGreaterThan(0);
    }
  });
  it('les points miai ferment « Vie et mort », jouer ailleurs « Fin de partie » ; l’ordre du chemin suit les chapitres', () => {
    const c = Object.fromEntries(CHAPITRES.map(x => [x.id, x]));
    expect(c.c5.lecons.map(l => l.id)).toEqual(['l15', 'l16', 'l22', 'l23', 'l32', 'l33', 'l38']);
    expect(c.c4.lecons.map(l => l.id)).toEqual(['l12', 'l13', 'l14', 'l17', 'l24', 'l25', 'l37']);
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

describe('leçon 37 : les points miai', () => {
  const M = step<Info>('l37', 0).rows;
  /** Zone : l'espace enfermé par le mur blanc (A3-G3, G2, G1), cible : le groupe noir. */
  const ZONE = ['A2', 'A1', 'B1', 'C1', 'E1'].map(at);
  const ZONE_D1 = ['A2', 'A1', 'C1', 'D1', 'E1'].map(at);
  const ZONE_M = ['J2', 'J1', 'H1', 'G1', 'E1'].map(at);
  const B2 = at('B2'), H2 = at('H2');
  /** Coups de Noir (dans la zone, ou la passe : un coup ailleurs) qui font vivre le groupe à coup sûr, sans ko. */
  const vivent = (pos: Position, c: number, zone: number[]) => labels(coupsGagnants(pos, c, zone, 'vivre'));

  it('les zones sont fermées : tout se décide dans l’espace enfermé par le mur blanc', () => {
    expect(defautsDeZone(avec(M, 1), B2, ZONE)).toEqual([]);
    expect(defautsDeZone(avec(step<Move>('l37', 3).rows, 1), B2, ZONE_D1)).toEqual([]);
    expect(defautsDeZone(avec(step<Move>('l37', 4).rows, 1), H2, ZONE_M)).toEqual([]);
  });

  it('E1 est déjà un œil ; Blanc au trait ne tue pas : le groupe vit, sans rien ajouter (l37.3)', () => {
    const pos = avec(M, 2);
    expect(yeuxDuGroupe(pos, B2).filter(y => y.vrai).map(y => lab(y.point))).toEqual(['E1']);
    expect(evaluer(pos, B2, ZONE)).toBe(1);
    const q = step<Quiz>('l37', 2);
    expect(q.choices[q.answer]).toBe('Non');
  });

  it('A2 et B1 sont miai : ce sont les deux seuls coups blancs qui obligent Noir à répondre, et chacun appelle l’autre', () => {
    const pos = avec(M, 2);
    const obligent = ZONE.filter(m => isLegal(pos, m) && evaluer(ok(play(ok(play(pos, m)), -1)), B2, ZONE) !== 1);
    expect(labels(obligent)).toEqual(['A2', 'B1']);
    expect(vivent(ok(play(pos, at('A2'))), B2, ZONE)).toEqual(['B1']);
    expect(vivent(ok(play(pos, at('B1'))), B2, ZONE)).toEqual(['A2']);
  });

  it('l37.1 : Blanc A2, Noir B1 : deux vrais yeux, C1 et E1', () => {
    const s = step<Info>('l37', 0);
    const fin = suite(avec(M, 2), ['A2', 'B1']);
    expect(images(s).at(-1)!.board).toEqual(fin.board);
    expect(labels(images(s).at(-1)!.yeux)).toEqual(['C1', 'E1']);
    expect(yeuxDuGroupe(fin, B2).filter(y => y.vrai).map(y => lab(y.point)).sort()).toEqual(['C1', 'E1']);
    expect(evaluer({ ...fin, toPlay: 2 }, B2, ZONE)).toBe(1);
  });

  it('l37.2 : Blanc B1, Noir A2 : le groupe vit', () => {
    const fin = suite(avec(M, 2), ['B1', 'A2']);
    expect(images(step<Info>('l37', 1)).at(-1)!.board).toEqual(fin.board);
    expect(evaluer(fin, B2, ZONE)).toBe(1);
  });

  it('l37.4 : Blanc a pris D1 (le point vital de C1-D1-E1) ; seul A2 vit ; A1, C1, E1 et la passe laissent Blanc tuer en A2', () => {
    const m = step<Move>('l37', 3);
    const pos = avec(m.rows, 1);
    expect(vivent(pos, B2, ZONE_D1)).toEqual(m.accept);
    for (const l of [...m.refus![0].points, 'passe']) {
      expect(labels(coupsGagnants(ok(play(pos, at(l))), B2, ZONE_D1, 'tuer')), l).toContain('A2');
    }
    // Sans D1, la forme est miai elle aussi : Blanc A2 appelle D1, Blanc D1 appelle A2.
    const avant = avec(m.rows.map((r, y) => (y === 8 ? '.X...XO..' : r)), 2);
    expect(evaluer(avant, B2, ZONE_D1)).toBe(1);
    expect(vivent(ok(play(avant, at('A2'))), B2, ZONE_D1)).toEqual(['D1']);
  }, LENT);

  it('l37.5 : la première forme en miroir, Blanc a pris H1 ; seul J2 vit ; J1 et E1 laissent Blanc tuer en J2', () => {
    const m = step<Move>('l37', 4);
    const miroir = M.map(r => [...r].reverse().join(''));
    expect(m.rows).toEqual(miroir.map((r, y) => (y === 8 ? `${r.slice(0, 7)}O${r.slice(8)}` : r)));
    const pos = avec(m.rows, 1);
    expect(vivent(pos, H2, ZONE_M)).toEqual(m.accept);
    for (const l of [...m.refus![0].points, 'passe']) {
      expect(labels(coupsGagnants(ok(play(pos, at(l))), H2, ZONE_M, 'tuer')), l).toContain('J2');
    }
  }, LENT);
});

describe('leçon 38 : jouer ailleurs (tenuki)', () => {
  const T = step<Info>('l38', 0).rows;
  /** Les trois présentations de la même partie : telle quelle (Noir prend en E9), retournée (E1), sur la diagonale (A5). */
  const CAS = [
    { rows: T, prise: 'E9', bloque: 'D1', recule: 'C1' },
    { rows: step<Move>('l38', 3).rows, prise: 'E1', bloque: 'D9', recule: 'C9' },
    { rows: step<Move>('l38', 4).rows, prise: 'A5', bloque: 'J6', recule: 'J7' },
  ];

  it('les exercices sont la même partie, retournée de haut en bas, puis sur la diagonale', () => {
    expect(CAS[1].rows).toEqual([...T].reverse());
    expect(CAS[2].rows).toEqual(T.map((_, y) => T.map(r => r[y]).join('')));
  });

  for (const [i, c] of CAS.entries()) {
    it(`${['l38.1', 'l38.4', 'l38.5'][i]} : deux endroits ouverts ; la prise ${c.prise} est le seul meilleur coup ; suivre Blanc en ${c.bloque} perd au moins 4 points (surfaces)`, () => {
      const pos = avec(c.rows, 1), z = ouverts(pos);
      expect(z).toHaveLength(5);
      expect(meilleursCoups(pos, z, surfaces).map(lab)).toEqual([c.prise]);
      const v = valeursDesCoups(pos, z, surfaces);
      for (const [m, x] of v) if (m !== at(c.prise)) expect(v.get(at(c.prise))! - x, lab(m)).toBeGreaterThanOrEqual(4);
      if (i > 0) {
        const m = step<Move>('l38', i + 2);
        expect(m.accept).toEqual([c.prise]);
        expect(m.refus![0].points).toEqual([c.bloque]);
        // La réfutation : après le blocage, Blanc relie à l'endroit de la prise (meilleur coup exact de Blanc).
        expect(meilleursCoups(ok(play(pos, at(c.bloque))), z, surfaces).map(lab)).toContain(c.prise);
      }
    }, LENT);

    it(`${['l38.1 à l38.3', 'l38.4', 'l38.5'][i]} : règle japonaise sur les suites montrées : prendre puis reculer, contre bloquer et laisser relier : 3 points`, () => {
      const pos = avec(c.rows, 1);
      const prise = suite(pos, [c.prise, c.bloque, c.recule]), bloque = suite(pos, [c.bloque, c.prise]);
      expect(ouverts(prise)).toEqual([]);
      expect(ouverts(bloque)).toEqual([]);
      expect(prise.captures[1]).toBe(2);
      expect(japonais(prise) - japonais(bloque)).toBe(3);
      // La prise vaut 4 points (2 prisonniers, 2 de territoire) ; Blanc qui avance d'un pas, un seul.
      expect(japonais(suite(pos, [c.prise, 'passe'])) - japonais(suite(pos, ['passe', c.prise]))).toBe(4);
      expect(japonais(suite(pos, [c.bloque, 'passe'])) - japonais(suite(pos, ['passe', c.bloque, c.recule]))).toBe(1);
    });
  }

  it('l38.1 et l38.2 : les démonstrations finissent sur ces suites ; le quiz donne l’écart compté', () => {
    const pos = avec(T, 1);
    expect(images(step<Info>('l38', 0)).at(-1)!.board).toEqual(suite(pos, ['E9', 'D1', 'C1']).board);
    expect(images(step<Info>('l38', 1)).at(-1)!.board).toEqual(suite(pos, ['D1', 'E9']).board);
    const q = step<Quiz>('l38', 2);
    expect(q.choices[q.answer]).toBe(String(japonais(suite(pos, ['E9', 'D1', 'C1'])) - japonais(suite(pos, ['D1', 'E9']))));
  });
});
