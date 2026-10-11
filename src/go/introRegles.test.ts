// #523 : preuve de l'introduction des règles (src/content/introRegles.ts). Chaque position est rejouée avec le moteur
// de règles : libertés, captures, suicide interdit, ko interdit, score. Chaque chiffre et chaque coordonnée écrits dans
// les phrases (français et anglais) sont recalculés ici : changer une position sans changer sa phrase fait échouer ce test.
import { etapesIntro, KOMI_INTRO, LIBERTES_D4, leconIntro, NOTIONS, POSITIONS, PRISONNIERS, TERRITOIRE_NOIR } from '../content/introRegles';
import { imageDuGeste, imagesDemo } from '../content/demo';
import { traduire, type Cle } from '../content/i18n/secondaires';
import { KOMI_NORMAL } from '../app/equilibrage';
import { fromRows } from './position';
import { groupAt, play, type Position } from './rules';
import { fromLabel, toLabel } from './coords';
import { score } from './score';

const N = 7;
const at = (l: string) => fromLabel(l, N);
const ok = (r: Position | string): Position => { if (typeof r === 'string') throw new Error(r); return r; };
const libs = (pos: Position, l: string) => [...groupAt(pos.board, N, at(l)).liberties].map(p => toLabel(p, N)).sort();
const depart = (rows: string[]) => fromRows(rows).pos;
const vides = (pos: Position) => [...pos.board.keys()].filter(p => pos.board[p] === 0).map(p => toLabel(p, N));
/** Coups noirs légaux de la position, et ce qu'ils deviennent. */
const coupsLegaux = (pos: Position) => vides(pos).flatMap(l => { const r = play(pos, at(l)); return typeof r === 'string' ? [] : [{ l, r }]; });
const fr = (cle: string, v?: Record<string, string>) => traduire('fr', cle as Cle, v as never);
const en = (cle: string, v?: Record<string, string>) => traduire('en', cle as Cle, v as never);

describe('introduction des règles : forme', () => {
  it('8 écrans, un par notion, sur un plateau 7 × 7, dans les deux versions', () => {
    expect(NOTIONS).toHaveLength(8);
    for (const v of ['complete', 'express'] as const) {
      const e = etapesIntro(v);
      expect(e).toHaveLength(8);
      for (const s of e) { expect(s.rows).toHaveLength(N); for (const r of s.rows) expect(r).toHaveLength(N); }
    }
  });

  it('chaque écran se valide par un geste : pose, toucher, coup ou réponse (aucun écran sans geste)', () => {
    for (const s of etapesIntro('complete')) {
      if (s.kind === 'info') expect(s.geste, s.text).toBeTruthy();
      else expect(['move', 'touche', 'quiz']).toContain(s.kind);
    }
  });

  it('version express : mêmes positions, mêmes gestes et mêmes réponses ; consignes plus courtes', () => {
    const c = etapesIntro('complete'), x = etapesIntro('express');
    for (let i = 0; i < 8; i++) {
      expect({ ...x[i], text: '' }).toEqual({ ...c[i], text: '' });
      expect(x[i].text.length, x[i].text).toBeLessThan(c[i].text.length);
    }
  });

  it('les démonstrations se jouent et chaque geste attend sur la bonne image', () => {
    for (const s of etapesIntro('complete')) {
      if (s.kind !== 'info' || !s.demo) continue;
      const images = imagesDemo(s.rows, s.demo);
      expect(images.length).toBeGreaterThan(1);
      if (s.geste) expect(imageDuGeste(s.rows, s.demo, [], s.geste)).toBeGreaterThanOrEqual(0);
    }
  });

  it('leçon hors du chemin : identifiant à part, titre traduit', () => {
    expect(leconIntro('complete').id).toBe('intro-regles');
    expect(leconIntro('express').id).toBe('intro-express');
    expect(leconIntro('complete').title).toBe('Les règles du go');
  });
});

describe('introduction des règles : chaque position prouvée par le moteur', () => {
  it('(a) poser : D4 puis E5, chacun son tour, sur les croisements', () => {
    const p1 = ok(play(depart(POSITIONS.poser), at('D4')));
    expect(p1.toPlay).toBe(2);
    const p2 = ok(play(p1, at('E5')));
    expect(p2.board[at('D4')]).toBe(1);
    expect(p2.board[at('E5')]).toBe(2);
  });

  it('(b) libertés : les points à toucher sont exactement les 4 libertés de D4 (pas les diagonales)', () => {
    const pos = depart(POSITIONS.libertes);
    expect(libs(pos, 'D4')).toEqual([...LIBERTES_D4].sort());
    expect(LIBERTES_D4).toHaveLength(4);
    for (const d of ['C5', 'E5', 'C3', 'E3']) expect(LIBERTES_D4).not.toContain(d);
  });

  it('(c) capturer : D3 est la dernière liberté de la pierre blanche ; seul D3 capture, et fait 1 prisonnier', () => {
    const pos = depart(POSITIONS.capturer);
    expect(libs(pos, 'D4')).toEqual(['D3']);
    const captures = coupsLegaux(pos).filter(c => c.r.captures[1] > 0).map(c => c.l);
    expect(captures).toEqual(['D3']);
    const apres = ok(play(pos, at('D3')));
    expect(apres.board[at('D4')]).toBe(0);
    expect(apres.captures[1]).toBe(1);
  });

  it('(d) atari : la pierre marquée a 1 liberté ; D3 la sauve avec 3 libertés partagées, tout autre coup la laisse en atari', () => {
    const pos = depart(POSITIONS.atari);
    expect(libs(pos, 'D4')).toEqual(['D3']);
    const apres = ok(play(pos, at('D3')));
    expect(groupAt(apres.board, N, at('D4')).stones.length).toBe(2);
    expect(libs(apres, 'D4')).toHaveLength(3);
    for (const { l, r } of coupsLegaux(pos).filter(c => c.l !== 'D3')) {
      expect(libs(r, 'D4'), l).toHaveLength(1);
      // Blanc la prend alors au coup suivant.
      expect(ok(play(r, at('D3'))).board[at('D4')], l).toBe(0);
    }
  });

  it('(e) suicide : A1 est interdit ; G5, sans liberté lui non plus, est permis parce qu’il capture 2 pierres et gagne 2 libertés', () => {
    const pos = depart(POSITIONS.suicide);
    expect(play(pos, at('A1'))).toBe('suicide');
    // G5 : aucun voisin vide avant le coup (il « n'aurait aucune liberté »).
    const g5 = at('G5');
    expect([g5 - N, g5 + N, g5 - 1].every(p => pos.board[p] === 2)).toBe(true);
    const apres = ok(play(pos, g5));
    expect(apres.captures[1]).toBe(2);
    expect(apres.board[at('G6')]).toBe(0);
    expect(apres.board[at('G4')]).toBe(0);
    expect(libs(apres, 'G5')).toEqual(['G4', 'G6']);
    // Les pierres marquées sont celles qui tombent ; G5 est le seul coup qui capture.
    expect(fromRows(POSITIONS.suicide).marked.map(p => toLabel(p, N)).sort()).toEqual(['G4', 'G6']);
    expect(coupsLegaux(pos).filter(c => c.r.captures[1] > 0).map(c => c.l)).toEqual(['G5']);
    // A1 est le seul suicide de la position : le refus « en A1 » est le seul utile.
    expect(vides(pos).filter(l => play(pos, at(l)) === 'suicide')).toEqual(['A1']);
    const etape = etapesIntro('complete')[4];
    expect(etape.kind === 'move' && etape.refus?.[0].points).toEqual(['A1']);
  });

  it('(f) ko : C4 prend D4 ; Blanc ne peut pas reprendre en D4 tout de suite, mais le peut après avoir joué ailleurs', () => {
    const pos = depart(POSITIONS.ko);
    const prise = ok(play(pos, at('C4')));
    expect(prise.captures[1]).toBe(1);
    expect(play(prise, at('D4'))).toBe('ko');
    const ailleurs = ok(play(ok(play(prise, at('A7'))), at('G1')));
    const reprise = ok(play(ailleurs, at('D4')));
    expect(reprise.board[at('C4')]).toBe(0);
    expect(reprise.captures[2]).toBe(1);
  });

  it('(g) territoire : les points à toucher sont exactement le territoire noir (21, à gauche des pierres noires)', () => {
    const pos = depart(POSITIONS.fin);
    const s = score(pos, 0, 'japanese');
    const noir = [...s.owner.keys()].filter(p => s.owner[p] === 1).map(p => toLabel(p, N)).sort();
    expect(noir).toEqual([...TERRITOIRE_NOIR].sort());
    expect(s.territory[1]).toBe(21);
    expect(s.territory[2]).toBe(14);
    // « à gauche » : tout le territoire noir est à gauche de la première pierre noire.
    const xNoir = Math.min(...[...pos.board.keys()].filter(p => pos.board[p] === 1).map(p => p % N));
    expect(TERRITOIRE_NOIR.every(l => at(l) % N < xNoir)).toBe(true);
  });

  it('(h) fin : 21 + 2 = 23 pour Noir, 14 + 1 + 6,5 = 21,5 pour Blanc ; Noir gagne de 1,5 point', () => {
    expect(KOMI_INTRO).toBe(KOMI_NORMAL);
    const pos = depart(POSITIONS.fin);
    const s = score({ ...pos, captures: [0, PRISONNIERS.noir, PRISONNIERS.blanc] }, KOMI_INTRO, 'japanese');
    expect(s.black).toBe(23);
    expect(s.white).toBe(21.5);
    expect(s.winner).toBe(1);
    expect(s.margin).toBe(1.5);
    const quiz = etapesIntro('complete')[7];
    expect(quiz.kind).toBe('quiz');
    if (quiz.kind === 'quiz') expect(quiz.choices[quiz.answer]).toBe(fr('intro.h.noir'));
  });
});

describe('introduction des règles : chaque phrase dit ce que le moteur calcule', () => {
  const dec = (l: 'fr' | 'en', n: number) => (l === 'fr' ? String(n).replace('.', ',') : String(n));
  for (const [l, tr] of [['fr', fr], ['en', en]] as const) {
    it(`${l} : chiffres du compte, prisonniers, komi`, () => {
      const pos = depart(POSITIONS.fin);
      const s = score({ ...pos, captures: [0, PRISONNIERS.noir, PRISONNIERS.blanc] }, KOMI_INTRO, 'japanese');
      const okH = tr('intro.h.ok');
      for (const n of [s.territory[1], PRISONNIERS.noir, s.black, s.territory[2], PRISONNIERS.blanc, KOMI_INTRO, s.white, s.margin]) {
        expect(okH, String(n)).toContain(dec(l, n));
      }
      for (const cle of ['intro.h.texte', 'intro.h.court']) {
        expect(tr(cle)).toContain(dec(l, KOMI_INTRO));
        expect(tr(cle)).toMatch(l === 'fr' ? /Noir 2, Blanc 1/ : /Black 2, White 1/);
      }
    });

    it(`${l} : libertés après le sauvetage (3), prises et libertés du coup permis (2 et 2), A1 interdit`, () => {
      expect(tr('intro.d.ok')).toMatch(/\b3\b/);
      expect(tr('intro.e.ok').match(/\b2\b/g)).toHaveLength(2);
      for (const cle of ['intro.e.texte', 'intro.e.refus']) expect(tr(cle)).toContain('A1');
    });

    it(`${l} : le vocabulaire du go est expliqué la première fois (libertés, atari, prisonnier, ko, territoire, komi)`, () => {
      expect(tr('intro.b.texte')).toMatch(l === 'fr' ? /libertés/ : /liberties/);
      expect(tr('intro.c.ok')).toMatch(l === 'fr' ? /prisonnier/ : /prisoner/);
      expect(tr('intro.d.texte')).toMatch(/atari/);
      expect(tr('intro.f.texte')).toMatch(/ko/);
      expect(tr('intro.g.texte')).toMatch(l === 'fr' ? /territoire/ : /territory/);
      // Le komi : combien, à qui, pourquoi.
      expect(tr('intro.h.texte')).toMatch(l === 'fr' ? /komi, car Noir a commencé/ : /komi because Black went first/);
    });
  }
});
