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
import { isLegal, neighbors, play, type Position } from './rules';
import { fromLabel, toLabel } from './coords';
import { score } from './score';
import { meilleursCoups, valeursDesCoups } from './preuve-fin-de-partie';

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
const IDS = ['l32'];

describe('leçons 32 et suivantes : place dans le programme (#16)', () => {
  it('chaque leçon a 4 à 6 étapes, sa phrase de fin et sa série de pratique', () => {
    for (const id of IDS) {
      expect(lecon(id).steps.length, id).toBeGreaterThanOrEqual(4);
      expect(lecon(id).steps.length, id).toBeLessThanOrEqual(6);
      expect(ACQUIS[id], id).toBeTruthy();
      expect(THEMES_DE_LECON[id]?.length, id).toBeGreaterThan(0);
    }
  });
  it('la valeur d’un coup prolonge « Fin de partie et comptage »', () => {
    const c = Object.fromEntries(CHAPITRES.map(x => [x.id, x]));
    expect(c.c5.lecons.map(l => l.id)).toEqual(['l15', 'l16', 'l22', 'l23', 'l32']);
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
