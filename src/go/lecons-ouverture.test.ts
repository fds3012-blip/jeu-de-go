// Issue #16 : l'ouverture en 13 × 13 (l29) et les joseki en 19 × 19 cadré (l30 le san-san, l31 le 3-4 et l'approche).
//
// Forme : tailles, cadres, chapitre, glossaire. Jugement : les analyses KataGo figées dans src/go/preuves-katago.json
// (`npm run preuves-katago`, réseau g170 local), rejouées ici sans le modèle. Seuils et méthode : src/go/preuvesKataGo.ts.
// - exercice : le meilleur coup jugé (moyenne des symétries) est une réponse acceptée, ou un coup hors du cadre (jouer
//   ailleurs) dont la meilleure réponse est à moins de TOLERANCE ; chaque réponse est à moins de TOLERANCE du meilleur ;
//   tout coup du cadre que la racine propose en tête (3 premiers, chaque symétrie) et qui est à moins de TOLERANCE est
//   accepté ; chaque coup refusé perd au moins MARGE points de plus que la moins bonne réponse (MARGE / 2 dans chaque
//   symétrie) ; une réfutation qui cite « en D4 » est la réplique de KataGo dans toutes les symétries ;
// - démonstration : chaque pierre posée (Noir ou Blanc) est à moins de TOLERANCE_DEMO du meilleur coup ;
// - question « lequel » : la bonne réponse bat l'autre d'au moins MARGE points.
import preuvesJson from './preuves-katago.json';
import { CHAPITRES, LESSONS_FR, type Lesson, type LessonStep } from '../content/lessons';
import { fenetreDe, visible } from '../content/cadreLecon';
import { ACQUIS } from '../content/acquis';
import { AIDE_DES_LECONS } from '../app/ouvrirAide';
import { MOTS } from '../content/aide';
import { THEMES_DE_LECON } from '../content/themes';
import { mots } from '../content/demo';
import { fromRows } from './position';
import { fromLabel } from './coords';
import {
  CONTROLES, MARGE, REGLAGES, TOLERANCE, TOLERANCE_DEMO, bilan, cleDe, pointsExercice, positionsDe, temoins,
  type Analyse, type Preuves,
} from './preuvesKataGo';

const preuves = preuvesJson as unknown as Preuves;
const IDS = ['l29', 'l30', 'l31'];
const lecon = (id: string) => LESSONS_FR.find(l => l.id === id)!;
type Move = Extract<LessonStep, { kind: 'move' }>;
const analyse = (rows: string[], trait: 1 | 2): Analyse => {
  const a = preuves.positions[cleDe(rows, trait)];
  if (!a) throw new Error('position absente de la fixture : npm run preuves-katago');
  return a;
};
/** Écart moyen et plus petit écart par symétrie entre deux coups (a meilleur que b). */
function ecart(a: Analyse, x: string, y: string) {
  const ex = a.coups[x], ey = a.coups[y];
  const parSym = ex.map((v, i) => v - ey[i]);
  return { moyen: parSym.reduce((s, v) => s + v, 0) / parSym.length, min: Math.min(...parSym) };
}
const pts = (v: number) => `${v.toFixed(2)} pt`;

describe('leçons d’ouverture et de joseki : forme (#16)', () => {
  it('trois leçons, à la fin du chapitre de l’ouverture, après les leçons 8 et 27', () => {
    const c2 = CHAPITRES.find(c => c.id === 'c2')!;
    expect(c2.titre).toBe('L’ouverture');
    expect(c2.lecons.map(l => l.id)).toEqual(['l8', 'l27', ...IDS]);
    expect(IDS.map(id => lecon(id).taille)).toEqual([13, 19, 19]);
  });
  it('chaque leçon : 3 à 6 étapes, au plus une étape sans geste, et sa phrase de fin, son thème, sa fiche', () => {
    for (const id of IDS) {
      const l = lecon(id);
      expect(l.steps.length, id).toBeGreaterThanOrEqual(3);
      expect(l.steps.length, id).toBeLessThanOrEqual(6);
      expect(l.steps.filter(s => s.kind === 'quiz' || (s.kind === 'info' && !s.geste)).length, id).toBeLessThanOrEqual(1);
      expect(ACQUIS[id], id).toBeTruthy();
      expect(THEMES_DE_LECON[id], id).toEqual(['ouverture']);
      for (const s of l.steps) expect(mots(s.text), `${id} : « ${s.text} »`).toBeLessThanOrEqual(12);
    }
    expect(AIDE_DES_LECONS.l30).toEqual({ fiche: 'mots', mot: 'sanSan' });
    expect(AIDE_DES_LECONS.l31).toEqual({ fiche: 'mots', mot: 'kakari' });
  });
  it('19 × 19 : chaque étape est cadrée sur le coin bas gauche ; le 13 × 13 se montre entier', () => {
    for (const id of ['l30', 'l31']) for (const s of lecon(id).steps) expect(s.cadre, id).toBe('bas-gauche');
    for (const s of lecon('l29').steps) expect(s.cadre).toBeUndefined();
  });
  it('vocabulaire : chaque mot nouveau est expliqué à sa première apparition et a sa fiche', () => {
    const premier = (mot: RegExp) => IDS.flatMap(id => lecon(id).steps.map(s => s.text)).find(t => mot.test(t))!;
    expect(premier(/san-san/i)).toMatch(/San-san \(point 3-3\)/);
    expect(premier(/hoshi/i)).toMatch(/hoshi \(point étoile\)/);
    expect(premier(/komoku/i)).toMatch(/komoku : 3e ligne d’un bord, 4e de l’autre/);
    expect(premier(/kakari/i)).toMatch(/Blanc approche : kakari/);
    expect(premier(/tsuke/i)).toMatch(/Tsuke \(coup au contact\)/);
    expect(premier(/kosumi/i)).toMatch(/kosumi \(un pas en diagonale\)/);
    for (const m of ['sanSan', 'komoku', 'kakari', 'tsuke', 'kosumi', 'hoshi']) expect(MOTS.some(x => x.id === m), m).toBe(true);
  });
  it('les exercices en miroir : même forme que la démonstration, retournée sur la diagonale du coin', () => {
    // l30 : la démonstration bloque en D3 ; l'exercice (miroir) accepte D3 et son image C4.
    const miroir = (l: string) => { const x = fromLabel(l, 19) % 19, y = 19 - Math.floor(fromLabel(l, 19) / 19); return `${'ABCDEFGHJKLMNOPQRST'[y - 1]}${x + 1}`; };
    expect(miroir('D5')).toBe('E4');
    expect((lecon('l30').steps[3] as Move).accept).toEqual(['D5', 'C5', 'C6'].map(miroir));
    expect((lecon('l31').steps[2] as Move).accept).toEqual(['D3', 'D5'].map(miroir));
  });
});

describe('preuves KataGo figées (src/go/preuves-katago.json)', () => {
  it('réglages : réseau g170, komi 6,5, règle japonaise, plusieurs centaines de visites, quatre symétries', () => {
    expect(preuves.reglages).toEqual(REGLAGES);
    expect(REGLAGES.visitesRacine).toBeGreaterThanOrEqual(400);
    expect(REGLAGES.visitesCoup).toBeGreaterThanOrEqual(400);
    expect(REGLAGES.symetries).toHaveLength(4);
  });
  it('chaque position jugée est dans la fixture, telle que la leçon la montre, avec chaque coup dans chaque symétrie', () => {
    const utiles = new Set<string>();
    for (const c of CONTROLES) for (const p of positionsDe(lecon(c.lecon), c)) {
      const a = analyse(p.rows, p.trait);
      utiles.add(p.cle);
      expect(a.rows).toEqual(p.rows);
      expect(a.racines.map(r => r.sym)).toEqual([...REGLAGES.symetries]);
      for (const r of a.racines) expect(r.visites).toBe(REGLAGES.visitesRacine);
      for (const m of [...p.coups, ...temoins(a)]) {
        expect(a.coups[m], m).toHaveLength(REGLAGES.symetries.length);
        expect(a.repliques[m], m).toHaveLength(REGLAGES.symetries.length);
      }
    }
    expect(Object.keys(preuves.positions).sort()).toEqual([...utiles].sort());
  });
});

describe('jugement KataGo, rejoué', () => {
  for (const c of CONTROLES) {
    const l = lecon(c.lecon), s = l.steps[c.etape], id = `${l.id}.${c.etape + 1}`, n = s.rows.length;
    const f = fenetreDe(s.cadre, n);
    if (c.type === 'demo') it(`${id} : chaque pierre de la démonstration est à moins de ${TOLERANCE_DEMO} pt du meilleur coup`, () => {
      for (const p of positionsDe(l, c)) {
        const a = analyse(p.rows, p.trait), b = bilan(a), m = p.coups[0];
        expect(b.perte(m), `${p.trait === 1 ? 'Noir' : 'Blanc'} ${m} (meilleur ${b.meilleur})`).toBeLessThanOrEqual(TOLERANCE_DEMO);
      }
    });
    if (c.type === 'duel') it(`${id} : ${c.meilleur} bat ${c.pire} d’au moins ${MARGE} pt, et c’est la bonne réponse`, () => {
      const [p] = positionsDe(l, c), a = analyse(p.rows, p.trait), b = bilan(a);
      if (s.kind !== 'quiz') throw new Error();
      expect(s.choices[s.answer]).toBe(c.meilleur);
      expect(s.choices).toContain(c.pire);
      expect(b.perte(c.meilleur)).toBeLessThanOrEqual(TOLERANCE);
      const e = ecart(a, c.meilleur, c.pire);
      expect(e.moyen, pts(e.moyen)).toBeGreaterThanOrEqual(MARGE);
      expect(e.min, pts(e.min)).toBeGreaterThanOrEqual(MARGE / 2);
    });
    if (c.type === 'exercice') {
      const m = s as Move;
      const { accept, refus } = pointsExercice(m);
      const [p] = positionsDe(l, c);
      const a = () => analyse(p.rows, p.trait);
      const pire = () => accept.reduce((x, y) => (bilan(a()).moy[x] <= bilan(a()).moy[y] ? x : y));
      it(`${id} : le meilleur coup est une réponse (ou jouer ailleurs, hors du cadre, sans rien gagner de net)`, () => {
        const b = bilan(a());
        if (!accept.includes(b.meilleur)) {
          expect(visible(b.meilleur, n, f), `meilleur ${b.meilleur}, dans le cadre mais refusé`).toBe(false);
          expect(Math.min(...accept.map(b.perte)), `meilleure réponse face à ${b.meilleur}`).toBeLessThanOrEqual(TOLERANCE);
        }
      });
      it(`${id} : chaque réponse acceptée est à moins de ${TOLERANCE} pt du meilleur coup`, () => {
        const b = bilan(a());
        for (const x of accept) expect(b.perte(x), `${x} (meilleur ${b.meilleur})`).toBeLessThanOrEqual(TOLERANCE);
      });
      it(`${id} : aucun bon coup du cadre n’est refusé (têtes de la racine à moins de ${TOLERANCE} pt)`, () => {
        const b = bilan(a());
        for (const t of temoins(a())) if (visible(t, n, f) && b.perte(t) <= TOLERANCE) expect(accept, t).toContain(t);
      });
      if (refus.length) it(`${id} : chaque coup refusé perd au moins ${MARGE} pt de plus que la moins bonne réponse`, () => {
        for (const r of refus) {
          const e = ecart(a(), pire(), r);
          expect(e.moyen, `${r} : ${pts(e.moyen)} derrière ${pire()}`).toBeGreaterThanOrEqual(MARGE);
          expect(e.min, `${r}, pire symétrie : ${pts(e.min)}`).toBeGreaterThanOrEqual(MARGE / 2);
        }
      });
      if (c.pires?.length) it(`${id} : ${c.pires.join(', ')} moins bon que chaque réponse (le centre en dernier)`, () => {
        for (const x of c.pires!) expect(ecart(a(), pire(), x).moyen, x).toBeGreaterThan(0.5);
      });
      for (const r of m.refus ?? []) {
        const cite = r.no.match(/\ben ([A-T]\d{1,2})\b/)?.[1];
        if (cite) it(`${id} : « ${r.no} » : ${cite} est la réplique de KataGo, dans chaque symétrie`, () => {
          for (const x of r.points) expect(a().repliques[x], x).toEqual(REGLAGES.symetries.map(() => cite));
        });
      }
    }
  }
});

describe('positions jouables', () => {
  for (const id of IDS) it(`${id} : chaque réponse et chaque refus est un point vide, dans le cadre`, () => {
    for (const s of lecon(id).steps) if (s.kind === 'move') {
      const { pos } = fromRows(s.rows), n = s.rows.length, f = fenetreDe(s.cadre, n);
      const { accept, refus } = pointsExercice(s);
      for (const x of [...accept, ...refus]) {
        expect(pos.board[fromLabel(x, n)], x).toBe(0);
        expect(visible(x, n, f), x).toBe(true);
      }
      expect(new Set([...accept, ...refus]).size).toBe(accept.length + refus.length);
    }
  });
  it('les leçons de grand plateau ne sont que ces trois-là', () => {
    expect(LESSONS_FR.filter((l: Lesson) => (l.taille ?? 9) !== 9).map(l => l.id)).toEqual(IDS);
  });
});
