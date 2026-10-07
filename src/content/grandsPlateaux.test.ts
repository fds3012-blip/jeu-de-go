// #454 : leçons sur 13 × 13 et 19 × 19. Format (taille, cadre), leçons d'essai, et non-régression des leçons 9 × 9.
import { describe, expect, it } from 'vitest';
import { LECONS_ESSAI } from '../../content/lessons.essai.js';
import { plateau } from '../../content/plateau.js';
import { LESSONS_FR, type Lesson, type LessonStep } from './lessons';
import { COTE_COIN, LIGNES_CONFORT, TAILLES_LECON, fenetreDe, lignesVisibles, visible } from './cadreLecon';
import { imageDuGeste, imagesDemo, type DemoTemps } from './demo';
import { fromRows } from '../go/position';
import { play } from '../go/rules';
import { fromLabel } from '../go/coords';
import { dansFenetre, hoshi, vueDe, viewBoxOf } from '../ui/boardArt';
import { pointsGuide } from '../app/lecon';
import { genererIndexLecons } from '../../outils/leconsIndex';

const ESSAI = LECONS_ESSAI as unknown as Lesson[];

/** Tous les points qu'une étape nomme : l'élève doit pouvoir les voir et les toucher. */
function pointsNommes(s: LessonStep): string[] {
  const demo = (t: DemoTemps): string[] =>
    'pose' in t ? [t.pose] : 'libs' in t ? [t.libs] : 'yeux' in t ? t.yeux : 'interdit' in t ? [t.interdit] : 'atari' in t ? t.atari : 'zone' in t ? t.zone : [];
  const out: string[] = [];
  if (s.kind === 'info') {
    out.push(...(s.libs ?? []), ...(s.demo ?? []).flatMap(demo));
    if (s.geste) out.push(...('pose' in s.geste ? [s.geste.pose] : s.geste.touche));
  }
  if (s.kind === 'move') {
    if (Array.isArray(s.accept)) out.push(...s.accept);
    out.push(...(s.libs ?? []), ...(s.aide ?? []), ...(s.refus ?? []).flatMap(r => r.points));
  }
  if (s.kind === 'touche') out.push(...s.accept);
  return out;
}

/** Vérifications de forme communes à toutes les leçons, petites et grandes. */
function verifierLecon(l: Lesson) {
  const taille = l.taille ?? 9;
  expect(TAILLES_LECON, `${l.id} : taille`).toContain(taille);
  for (const [i, s] of l.steps.entries()) {
    const ou = `${l.id}, étape ${i + 1}`;
    expect(s.rows, `${ou} : ${taille} lignes`).toHaveLength(taille);
    for (const r of s.rows) expect(r, `${ou} : ${taille} colonnes`).toHaveLength(taille);
    const f = fenetreDe(s.cadre, taille);
    for (const p of pointsNommes(s)) expect(visible(p, taille, f), `${ou} : ${p} hors de la zone montrée`).toBe(true);
    // Les démonstrations se jouent sur la bonne taille, sans coup illégal.
    if (s.kind === 'info' && s.demo) {
      expect(() => imagesDemo(s.rows, s.demo!, s.avant), ou).not.toThrow();
      if (s.geste) expect(imageDuGeste(s.rows, s.demo, s.avant, s.geste), ou).toBeGreaterThanOrEqual(0);
    }
    // Un coup demandé est légal ; un point touché ou un geste est dans la zone.
    if (s.kind === 'move' && Array.isArray(s.accept)) {
      const { pos } = fromRows(s.rows);
      for (const a of s.accept) expect(typeof play(pos, fromLabel(a, taille)), `${ou} : ${a} illégal`).not.toBe('string');
    }
    for (const p of pointsGuide(s, true, taille)) expect(dansFenetre(p, taille, f), `${ou} : halo hors zone`).toBe(true);
  }
}

describe('format des grands plateaux (#454)', () => {
  it('un coin : carré collé au coin, 10 lignes sur 19 × 19, 8 sur 13 × 13', () => {
    expect(fenetreDe('bas-gauche', 19)).toEqual({ x: 0, y: 9, k: 10 });
    expect(fenetreDe('haut-droite', 19)).toEqual({ x: 9, y: 0, k: 10 });
    expect(fenetreDe('bas-droite', 13)).toEqual({ x: 5, y: 5, k: 8 });
    expect(fenetreDe('haut-gauche', 13)).toEqual({ x: 0, y: 0, k: 8 });
    expect(fenetreDe({ coin: 'bas-gauche', cote: 9 }, 19)).toEqual({ x: 0, y: 10, k: 9 });
    expect(COTE_COIN[19]).toBe(10);
  });
  it('une zone libre : l’intersection en haut à gauche et le côté', () => {
    expect(fenetreDe({ hautGauche: 'F14', cote: 7 }, 19)).toEqual({ x: 5, y: 5, k: 7 });
  });
  it('sans cadre, ou un cadre qui couvre tout : le plateau entier', () => {
    expect(fenetreDe(undefined, 19)).toBeNull();
    expect(fenetreDe({ coin: 'bas-gauche', cote: 13 }, 13)).toBeNull();
  });
  it('un cadre invalide est refusé', () => {
    expect(() => fenetreDe({ coin: 'bas-gauche', cote: 4 }, 19)).toThrow();
    expect(() => fenetreDe({ coin: 'bas-gauche', cote: 20 }, 19)).toThrow();
    expect(() => fenetreDe({ hautGauche: 'Q16', cote: 10 }, 19)).toThrow();
    expect(() => fenetreDe('milieu' as never, 19)).toThrow();
  });
  it('visible : un point dans la zone, ou n’importe où sans cadre', () => {
    const f = fenetreDe('bas-gauche', 19);
    expect(visible('K10', 19, f)).toBe(true);
    expect(visible('L10', 19, f)).toBe(false);
    expect(visible('K11', 19, f)).toBe(false);
    expect(visible('T19', 19, null)).toBe(true);
    expect(visible('U1', 19, null)).toBe(false);
  });
  it('lignes visibles : plus que le 9 × 9, la confirmation au doigt est forcée', () => {
    expect(lignesVisibles(13, null)).toBeGreaterThan(LIGNES_CONFORT);
    expect(lignesVisibles(19, fenetreDe('bas-gauche', 19))).toBeGreaterThan(LIGNES_CONFORT);
    expect(lignesVisibles(19, fenetreDe({ coin: 'bas-gauche', cote: 9 }, 19))).toBeLessThanOrEqual(LIGNES_CONFORT);
    expect(lignesVisibles(9, null)).toBeLessThanOrEqual(LIGNES_CONFORT);
  });
  it('plateau() écrit les rows depuis les coordonnées affichées', () => {
    const r = plateau(19, { X: ['D4'], O: ['Q16'], T: ['A1'], S: ['T19'] });
    expect(r).toHaveLength(19);
    expect(r[15][3]).toBe('X');
    expect(r[3][15]).toBe('O');
    expect(r[18][0]).toBe('T');
    expect(r[0][18]).toBe('S');
    expect(() => plateau(19, { X: ['U1'] })).toThrow();
    expect(() => plateau(13, { X: ['D4'], O: ['D4'] })).toThrow();
    expect(() => plateau(11 as 9)).toThrow();
  });
  it('vue du plateau : sans fenêtre, le viewBox d’avant ; avec, le coin montré et sa bande', () => {
    const v9 = vueDe(9), vb = viewBoxOf(9);
    expect([v9.x, v9.y, v9.span]).toEqual([vb.min, vb.min, vb.span]);
    const v = vueDe(19, fenetreDe('bas-gauche', 19));
    expect(v.fenetre).toEqual({ x: 0, y: 9, k: 10 });
    expect(v.span).toBeCloseTo(vueDe(10).span - vueDe(10).bande + v.bande);
    expect(v.y).toBeGreaterThan(0);
  });
  it('hoshi justes : 4 dans le coin cadré d’un 19 × 19, 5 sur le 13 × 13', () => {
    const f = fenetreDe('bas-gauche', 19);
    expect(hoshi(19).filter(p => dansFenetre(p, 19, f)).sort((a, b) => a - b)).toEqual(['D10', 'K10', 'D4', 'K4'].map(l => fromLabel(l, 19)).sort((a, b) => a - b));
    expect(hoshi(13).sort((a, b) => a - b)).toEqual(['D10', 'K10', 'G7', 'D4', 'K4'].map(l => fromLabel(l, 13)).sort((a, b) => a - b));
  });
  it('une démonstration se joue sur 19 × 19 : une pierre seule au coin a 4 libertés', () => {
    const im = imagesDemo(plateau(19, { O: ['Q16'] }), [{ libs: 'Q16' }]);
    expect(im[im.length - 1].libs).toHaveLength(4);
    expect(im[im.length - 1].board).toHaveLength(361);
  });
  it('l’index écrit la taille d’une leçon sur grand plateau, et rien pour le 9 × 9', () => {
    const src = genererIndexLecons([{ id: 'a', title: 'A', desc: 'a', steps: [1] }, { id: 'b', title: 'B', desc: 'b', taille: 19, steps: [1, 2] }], [{ id: 'c', titre: 'C', intro: 'c', lecons: ['a', 'b'] }]);
    expect(src).toContain('["a", "A", "a", 1],');
    expect(src).toContain('["b", "B", "b", 2, 19],');
  });
});

describe('leçons d’essai (#454) : 13 × 13 entier et cadré, 19 × 19 cadré', () => {
  it('sont deux, hors du catalogue', () => {
    expect(ESSAI.map(l => [l.id, l.taille])).toEqual([['essai-13', 13], ['essai-19', 19]]);
    for (const l of ESSAI) expect(LESSONS_FR.some(x => x.id === l.id)).toBe(false);
  });
  for (const l of ESSAI) it(`${l.id} : positions, zones et réponses justes`, () => verifierLecon(l));
  it('essai-19 : au moins une étape jouable cadrée sur un coin', () => {
    const l = ESSAI[1];
    expect(l.steps.some(s => (s.kind === 'move' || s.kind === 'touche') && fenetreDe(s.cadre, 19))).toBe(true);
  });
  it('essai-19 : la question des hoshi dit vrai (4 repères vides dans le coin)', () => {
    const s = ESSAI[1].steps.find(x => x.kind === 'quiz')!;
    if (s.kind !== 'quiz') throw new Error();
    const f = fenetreDe(s.cadre, 19), { pos } = fromRows(s.rows);
    const n = hoshi(19).filter(p => dansFenetre(p, 19, f) && !pos.board[p]).length;
    expect(s.choices[s.answer]).toBe(String(n));
  });
  it('essai-13 : le hoshi touché est bien un hoshi, dans le coin cadré', () => {
    const s = ESSAI[0].steps.find(x => x.kind === 'touche')!;
    if (s.kind !== 'touche') throw new Error();
    for (const a of s.accept) expect(hoshi(13)).toContain(fromLabel(a, 13));
  });
});

describe('non-régression : les leçons 9 × 9 ne changent pas (#454)', () => {
  it('une leçon du chemin sans taille est en 9 × 9 entier, sans cadre (#16 : seules l29, l30 et l31 ont une taille)', () => {
    expect(LESSONS_FR.filter(l => l.taille).map(l => l.id)).toEqual(['l29', 'l30', 'l31']);
    for (const l of LESSONS_FR.filter(x => !x.taille)) {
      expect(l.taille ?? 9, l.id).toBe(9);
      for (const s of l.steps) {
        expect(s.cadre, l.id).toBeUndefined();
        expect(fenetreDe(s.cadre, 9)).toBeNull();
      }
    }
  });
  for (const l of LESSONS_FR) it(`${l.id} : forme valide`, () => verifierLecon(l));
});
