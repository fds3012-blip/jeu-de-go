// Issue #553 : les leçons d'ouverture qui ne se prouvent pas par une lecture exacte, prouvées par des positions KataGo
// figées : l47 le mur (s'étendre loin de lui), l48 couper et relier, l49 envahir ou réduire. 13 × 13 cadré.
//
// Comment la fixture a été produite (mêmes réglages et même outil que l29 à l31, #16) :
//   npm run fetch-model
//     réseau g170-b6c96-s175395328-d26788732 (celui de l'appli, public/reseaux/, sha256 f5d32604e3675c48…)
//   TFJS_NODE_DIR=<dossier où @tensorflow/tfjs-node 4.22.0 est installé> npm run preuves-katago -- l47 l48 l49
//     (outils/preuvesKataGo.ts : un seul processus, TensorFlow natif sur CPU)
// Réglages (REGLAGES de src/go/preuvesKataGo.ts, vérifiés ci-dessous) : komi 6,5, règle japonaise, 800 visites à la
// racine, 400 visites après chaque coup jugé, quatre symétries du plateau (0, 3, 5, 6) analysées chacune à part ; une
// valeur est la moyenne des symétries, et chaque écart est aussi exigé symétrie par symétrie.
// Seuils (src/go/preuvesKataGo.ts) : une réponse acceptée est à au plus TOLERANCE (1 pt) du meilleur coup ; un coup
// refusé perd au moins MARGE (2 pts) de plus que la moins bonne réponse (MARGE / 2 dans chaque symétrie) ; une pierre de
// démonstration est à au plus TOLERANCE_DEMO (1,5 pt) du meilleur coup.
//
// Le jugement commun à toutes les leçons KataGo (meilleur coup, réponses, refus, répliques citées « en L5 ») est rejoué
// par src/go/lecons-ouverture.test.ts. Ce fichier vérifie en plus chaque affirmation propre aux textes des leçons 47 à
// 49 : « bien plus », « bien moins » (écart d'au moins MARGE), « contre le mur », « trop près », « sous le hoshi »,
// « son coin est vide », « ses coins sont fermés », « sur la 2e ligne » (géométrie), « coupe », « séparées » (points de
// liaison, voir `liaisons`), et que chaque exercice est bien la même position que la démonstration, retournée.
import preuvesJson from './preuves-katago.json';
import { CHAPITRES, LESSONS_FR, type LessonStep } from '../content/lessons';
import { mots } from '../content/demo';
import { ACQUIS } from '../content/acquis';
import { THEMES_DE_LECON } from '../content/themes';
import { AIDE_DES_LECONS } from '../app/ouvrirAide';
import { MOTS } from '../content/aide';
import { fenetreDe, visible } from '../content/cadreLecon';
import { fromRows } from './position';
import { play, type Position } from './rules';
import { fromLabel, toLabel } from './coords';
import {
  CONTROLES, MARGE, REGLAGES, TOLERANCE, TOLERANCE_DEMO, bilan, cleDe, positionsDe, rowsSym, transformer,
  type Analyse, type Preuves,
} from './preuvesKataGo';

const preuves = preuvesJson as unknown as Preuves;
const IDS = ['l47', 'l48', 'l49'];
const N = 13;
const lecon = (id: string) => LESSONS_FR.find(l => l.id === id)!;
type Info = Extract<LessonStep, { kind: 'info' }>;
type Move = Extract<LessonStep, { kind: 'move' }>;
type Quiz = Extract<LessonStep, { kind: 'quiz' }>;
const step = <S extends LessonStep>(id: string, i: number) => lecon(id).steps[i] as S;
const at = (l: string) => fromLabel(l, N);
const xy = (l: string) => { const p = at(l); return [p % N, Math.floor(p / N)] as const; };
/** Ligne depuis le bord le plus proche (1 = premier rang). */
const ligne = (l: string) => { const [x, y] = xy(l); return Math.min(x, y, N - 1 - x, N - 1 - y) + 1; };
/** Distance « du roi » entre deux points (pas en diagonale compris). */
const dist = (a: string, b: string) => { const [ax, ay] = xy(a), [bx, by] = xy(b); return Math.max(Math.abs(ax - bx), Math.abs(ay - by)); };
const voisins = (a: string, b: string) => { const [ax, ay] = xy(a), [bx, by] = xy(b); return Math.abs(ax - bx) + Math.abs(ay - by) === 1; };
const diagonale = (a: string, b: string) => { const [ax, ay] = xy(a), [bx, by] = xy(b); return Math.abs(ax - bx) === 1 && Math.abs(ay - by) === 1; };
const pierre = (rows: string[], l: string) => { const [x, y] = xy(l); return rows[y][x]; };
const image = (l: string, k: number) => toLabel(transformer(at(l), N, k), N);
const inverse = (rows: string[]) => rows.map(r => r.replace(/X|O/g, c => (c === 'X' ? 'O' : 'X')));
const ok = (r: Position | string): Position => { if (typeof r === 'string') throw new Error(r); return r; };
const rowsDe = (pos: Position) => Array.from({ length: N }, (_, y) => Array.from({ length: N }, (_, x) => '.XO'[pos.board[y * N + x]]).join(''));
/** Joue des coups (couleur imposée) depuis `rows`. */
function apres(rows: string[], coups: [string, 1 | 2][]): string[] {
  let pos = fromRows(rows).pos;
  for (const [l, c] of coups) pos = ok(play({ ...pos, toPlay: c } as Position, at(l)));
  return rowsDe(pos);
}
/**
 * Points de liaison de deux pierres en saut de cavalier (keima) : les points vides voisins de l'une et en diagonale de
 * l'autre. Tant qu'il en reste un, la paire n'est pas coupée ; quand l'adversaire les occupe tous, elle est séparée.
 */
const liaisons = (rows: string[], a: string, b: string) => rows.flatMap((r, y) => [...r].flatMap((v, x) => {
  const l = toLabel(y * N + x, N);
  return v === '.' && ((voisins(l, a) && diagonale(l, b)) || (voisins(l, b) && diagonale(l, a))) ? [l] : [];
}));
const keima = (a: string, b: string) => { const [ax, ay] = xy(a), [bx, by] = xy(b); return [Math.abs(ax - bx), Math.abs(ay - by)].sort().join() === '1,2'; };

const analyse = (rows: string[], trait: 1 | 2 = 1): Analyse => {
  const a = preuves.positions[cleDe(rows, trait)];
  if (!a) throw new Error('position absente de la fixture : npm run preuves-katago -- l47 l48 l49');
  return a;
};
/** Écart moyen et plus petit écart par symétrie entre deux coups jugés (x meilleur que y). */
function ecart(a: Analyse, x: string, y: string) {
  const parSym = a.coups[x].map((v, i) => v - a.coups[y][i]);
  return { moyen: parSym.reduce((s, v) => s + v, 0) / parSym.length, min: Math.min(...parSym) };
}
/** « bien plus » / « bien moins » : au moins MARGE en moyenne, MARGE / 2 dans chaque symétrie. */
const bienPlus = (a: Analyse, x: string, y: string) => {
  const e = ecart(a, x, y);
  expect(e.moyen, `${x} devant ${y} : ${e.moyen.toFixed(2)} pt`).toBeGreaterThanOrEqual(MARGE);
  expect(e.min, `${x} devant ${y}, pire symétrie : ${e.min.toFixed(2)} pt`).toBeGreaterThanOrEqual(MARGE / 2);
};
const moinsBonneReponse = (a: Analyse, accept: string[]) => accept.reduce((x, y) => (bilan(a).moy[x] <= bilan(a).moy[y] ? x : y));

describe('leçons 47 à 49 : place, forme, vocabulaire (#553)', () => {
  it('à la fin du chapitre de l’ouverture, après les joseki (l30, l31) ; l’ordre du chemin suit les chapitres', () => {
    const c2 = CHAPITRES.find(c => c.id === 'c2')!.lecons.map(l => l.id);
    expect(c2.slice(-5)).toEqual(['l30', 'l31', ...IDS]);
    expect(LESSONS_FR.map(l => l.id)).toEqual(CHAPITRES.flatMap(c => c.lecons.map(l => l.id)));
  });
  it('13 × 13 cadré, 3 à 6 étapes, une seule étape sans geste au plus, et l’élève pose dès le premier écran', () => {
    for (const id of IDS) {
      const l = lecon(id);
      expect(l.taille, id).toBe(13);
      expect(l.steps.length, id).toBeGreaterThanOrEqual(3);
      expect(l.steps.length, id).toBeLessThanOrEqual(6);
      expect(l.steps.filter(s => s.kind === 'quiz' || (s.kind === 'info' && !s.geste)).length, id).toBeLessThanOrEqual(1);
      const s0 = l.steps[0] as Info;
      expect(s0.kind === 'info' && s0.geste && 'pose' in s0.geste, id).toBe(true);
      l.steps.forEach((s, i) => {
        expect(s.rows, `${id}.${i + 1}`).toHaveLength(N);
        expect(s.cadre, `${id}.${i + 1}`).toBeTruthy();
        expect(mots(s.text), `${id}.${i + 1} : « ${s.text} »`).toBeLessThanOrEqual(12);
        if (s.kind === 'info' && s.geste && 'pose' in s.geste) {
          expect(s.text, `${id}.${i + 1}`).toContain('point vert');
          expect(s.demo?.[0], `${id}.${i + 1}`).toEqual({ pose: s.geste.pose, couleur: 'B' });
        }
      });
    }
  });
  it('phrase de fin, série de pratique, fiche du « ? » reliée à la leçon', () => {
    for (const id of IDS) expect(ACQUIS[id], id).toBeTruthy();
    expect(THEMES_DE_LECON.l47).toEqual(['ouverture']);
    expect(THEMES_DE_LECON.l48).toEqual(['relier-couper']);
    expect(THEMES_DE_LECON.l49).toEqual(['ouverture']);
    expect(AIDE_DES_LECONS.l47).toEqual({ fiche: 'mots', mot: 'mur' });
    expect(AIDE_DES_LECONS.l48).toEqual({ fiche: 'mots', mot: 'couper' });
    expect(AIDE_DES_LECONS.l49).toEqual({ fiche: 'mots', mot: 'invasion' });
    for (const [mot, id] of [['mur', 'l47'], ['couper', 'l48'], ['invasion', 'l49'], ['reduction', 'l49']]) {
      expect(MOTS.find(m => m.id === mot)?.lecon, mot).toBe(id);
    }
  });
  it('chaque mot du go est expliqué à sa première apparition dans ces leçons', () => {
    const textes = IDS.flatMap(id => lecon(id).steps.map(s => s.text));
    const premier = (mot: RegExp) => textes.find(t => mot.test(t))!;
    expect(premier(/\bmur\b/i)).toMatch(/mur \(pierres en rang, face au bas\)/);
    expect(premier(/\bcoupe/i)).toMatch(/coupe \(sépare\)/);
    expect(premier(/invasion/i)).toMatch(/Invasion \(entrer chez Blanc\)/);
    expect(premier(/san-san/i)).toMatch(/san-san \(point 3-3\)/);
    expect(premier(/réduction/i)).toMatch(/Réduction \(rapetisser sa zone par-dessus\)/);
  });
});

describe('les exercices sont les positions des démonstrations, retournées ou inversées', () => {
  // Symétries de src/go/preuvesKataGo.ts : 2 miroir gauche-droite, 4 miroir haut-bas, 3 quart de tour.
  it('l47 : le mur face au haut (miroir haut-bas) puis à droite (miroir gauche-droite) ; réponses et refus suivent', () => {
    const m = step<Info>('l47', 0).rows;
    expect(step<Quiz>('l47', 1).rows).toEqual(rowsSym(m, 4));
    expect(step<Quiz>('l47', 1).choices).toEqual(['E3', 'K3'].map(l => image(l, 4)));
    const e = step<Move>('l47', 2);
    expect(e.rows).toEqual(rowsSym(m, 2));
    expect(e.accept).toEqual(['K3', 'L3'].map(l => image(l, 2)));
    expect(e.refus![0].points).toEqual(['E3', 'F3', 'F4'].map(l => image(l, 2)));
  });
  it('l48 : le keima retourné de gauche à droite, puis les mêmes pierres couleurs inversées', () => {
    const k = step<Info>('l48', 0).rows;
    expect(step<Move>('l48', 1).rows).toEqual(rowsSym(k, 2));
    expect(step<Info>('l48', 2).rows).toEqual(inverse(k));
    expect(step<Move>('l48', 3).rows).toEqual(rowsSym(inverse(k), 2));
    for (const i of [1, 3]) {
      expect(step<Move>('l48', i).accept).toEqual([image('C5', 2)]);
      expect(step<Move>('l48', i).refus![0].points).toEqual(['D4', 'E6'].map(l => image(l, 2)));
    }
  });
  it('l49 : l’exercice d’invasion est la même position, l’autre coin ; la question de réduction, un quart de tour', () => {
    expect(step<Move>('l49', 1).rows).toEqual(step<Info>('l49', 0).rows);
    expect(step<Info>('l49', 0).rows).toEqual(rowsSym(step<Info>('l49', 0).rows, 2)); // symétrique : les deux coins se valent
    const f = step<Info>('l49', 2).rows, q = step<Quiz>('l49', 3);
    expect(q.rows).toEqual(rowsSym(f, 3));
    expect(q.choices).toEqual(['G4', 'F2'].map(l => image(l, 3)));
  });
});

describe('preuves KataGo des leçons 47 à 49 : réglages et présence dans la fixture', () => {
  it('réseau g170 b6c96, komi 6,5, règle japonaise, 800 et 400 visites, quatre symétries', () => {
    expect(preuves.reglages).toEqual(REGLAGES);
    expect(REGLAGES).toMatchObject({ modele: 'g170-b6c96-s175395328-d26788732', komi: 6.5, regles: 'japanese', visitesRacine: 800, visitesCoup: 400 });
    expect(REGLAGES.symetries).toEqual([0, 3, 5, 6]);
  });
  it('chaque étape de ces leçons est contrôlée, et chaque position est analysée telle que la leçon la montre', () => {
    for (const id of IDS) {
      const etapes = CONTROLES.filter(c => c.lecon === id).map(c => c.etape);
      expect(etapes, id).toEqual(lecon(id).steps.map((_, i) => i));
      for (const c of CONTROLES.filter(x => x.lecon === id)) for (const p of positionsDe(lecon(id), c)) {
        const a = analyse(p.rows, p.trait);
        expect(a.rows).toEqual(p.rows);
        for (const m of p.coups) expect(a.coups[m], `${id}.${c.etape + 1} ${m}`).toHaveLength(REGLAGES.symetries.length);
      }
    }
  });
});

describe('l47, le mur', () => {
  const m = step<Info>('l47', 0), q = step<Quiz>('l47', 1), e = step<Move>('l47', 2);
  it('l47.1 : le mur noir est d’un seul tenant (pierres voisines ou en diagonale), face au bas ; K3 est loin de lui', () => {
    const w = ['D3', 'D4', 'D5', 'C6', 'C7', 'B7'];
    for (const l of w) expect(pierre(m.rows, l), l).toBe('X');
    for (let i = 1; i < w.length; i++) expect(voisins(w[i - 1], w[i]) || diagonale(w[i - 1], w[i]), w[i]).toBe(true);
    expect(Math.min(...w.map(l => dist(l, 'K3')))).toBeGreaterThanOrEqual(6);
  });
  it(`l47.1 : K3 est à moins de ${TOLERANCE_DEMO} pt du meilleur coup du plateau`, () => {
    const a = analyse(m.rows);
    expect(bilan(a).perte('K3'), `meilleur ${bilan(a).meilleur}`).toBeLessThanOrEqual(TOLERANCE_DEMO);
  });
  it('l47.2 : E11 touche le mur, K11 en est loin ; K11 rapporte bien plus (au moins MARGE)', () => {
    expect(pierre(q.rows, 'D11')).toBe('X');
    expect(voisins('E11', 'D11')).toBe(true);
    expect(dist('K11', 'D11')).toBeGreaterThanOrEqual(6);
    expect(q.choices[q.answer]).toBe('K11');
    const a = analyse(q.rows);
    expect(bilan(a).perte('K11')).toBeLessThanOrEqual(TOLERANCE);
    bienPlus(a, 'K11', 'E11');
  });
  it('l47.3 : « trop près de ton mur » : chaque refus est à deux pas du mur au plus, et perd bien plus que chaque réponse', () => {
    const wall = ['K3', 'K4', 'K5', 'L6', 'L7', 'M7'];
    for (const l of wall) expect(pierre(e.rows, l), l).toBe('X');
    const a = analyse(e.rows), pire = moinsBonneReponse(a, e.accept as string[]);
    for (const r of e.refus![0].points) {
      expect(Math.min(...wall.map(l => dist(l, r))), r).toBeLessThanOrEqual(2);
      bienPlus(a, pire, r);
    }
  });
  it('l47.3 : « loin de ton mur, sous le hoshi blanc D4 » : chaque réponse est sous D4 (droit ou en diagonale), à six pas du mur', () => {
    const wall = ['K3', 'K4', 'K5', 'L6', 'L7', 'M7'];
    expect(pierre(e.rows, 'D4')).toBe('O');
    for (const r of e.accept as string[]) {
      expect(Math.min(...wall.map(l => dist(l, r))), r).toBeGreaterThanOrEqual(6);
      expect(xy(r)[1], r).toBe(xy('D4')[1] + 1);
      expect(voisins(r, 'D4') || diagonale(r, 'D4'), r).toBe(true);
    }
  });
});

describe('l48, couper et relier', () => {
  const d = step<Info>('l48', 0), e = step<Move>('l48', 1), dB = step<Info>('l48', 2), eB = step<Move>('l48', 3);
  it('l48.1 : C4 et D6 font un keima ; Blanc tient déjà D5 ; C5 est le dernier point de liaison (il « coupe » s’il est blanc)', () => {
    expect(keima('C4', 'D6')).toBe(true);
    expect(pierre(d.rows, 'C4') + pierre(d.rows, 'D6') + pierre(d.rows, 'D5')).toBe('XXO');
    expect(liaisons(d.rows, 'C4', 'D6')).toEqual(['C5']);
    expect(liaisons(apres(d.rows, [['C5', 2]]), 'C4', 'D6')).toEqual([]);
  });
  it(`l48.1 : C5 est à moins de ${TOLERANCE_DEMO} pt du meilleur coup`, () => {
    expect(bilan(analyse(d.rows)).perte('C5')).toBeLessThanOrEqual(TOLERANCE_DEMO);
  });
  it('l48.2 : L5, la réponse, est le seul point de liaison ; chaque refus perd bien plus ; après la réplique L5 de Blanc, tes pierres sont séparées', () => {
    expect(liaisons(e.rows, 'L4', 'K6')).toEqual(['L5']);
    expect(e.accept).toEqual(['L5']);
    const a = analyse(e.rows);
    expect(bilan(a).meilleur).toBe('L5');
    for (const r of e.refus![0].points) {
      bienPlus(a, 'L5', r);
      expect(a.repliques[r], r).toEqual(REGLAGES.symetries.map(() => 'L5'));
      expect(liaisons(apres(e.rows, [[r, 1], ['L5', 2]]), 'L4', 'K6'), r).toEqual([]);
    }
  });
  it('l48.3 : couleurs inversées, C5 est le dernier point de liaison des pierres blanches ; Noir y coupe, à moins de TOLERANCE_DEMO', () => {
    expect(pierre(dB.rows, 'C4') + pierre(dB.rows, 'D6') + pierre(dB.rows, 'D5')).toBe('OOX');
    expect(liaisons(dB.rows, 'C4', 'D6')).toEqual(['C5']);
    expect(bilan(analyse(dB.rows)).perte('C5')).toBeLessThanOrEqual(TOLERANCE_DEMO);
  });
  it('l48.4 : « Coupé : les deux pierres blanches sont séparées » ; chaque refus perd bien plus, et Blanc répond L5', () => {
    expect(liaisons(apres(eB.rows, [['L5', 1]]), 'L4', 'K6')).toEqual([]);
    const a = analyse(eB.rows);
    expect(bilan(a).meilleur).toBe('L5');
    for (const r of eB.refus![0].points) {
      bienPlus(a, 'L5', r);
      expect(a.repliques[r], r).toEqual(REGLAGES.symetries.map(() => 'L5'));
    }
  });
});

describe('l49, envahir ou réduire', () => {
  const d = step<Info>('l49', 0), e = step<Move>('l49', 1), r = step<Info>('l49', 2), q = step<Quiz>('l49', 3);
  const coinVide = (rows: string[], hoshi: string) => {
    const [hx, hy] = xy(hoshi), sx = hx < N / 2 ? -1 : 1;
    for (let y = hy; y < N; y++) for (let x = hx; x >= 0 && x < N; x += sx) {
      const l = toLabel(y * N + x, N);
      if (l !== hoshi) expect(pierre(rows, l), l).toBe('.');
    }
  };
  it('l49.1 : « son coin est vide » : sous et à côté des hoshi blancs D4 et K4, jusqu’aux bords, rien ; C3 est le san-san', () => {
    expect(pierre(d.rows, 'D4') + pierre(d.rows, 'K4')).toBe('OO');
    coinVide(d.rows, 'D4');
    coinVide(d.rows, 'K4');
    expect([ligne('C3'), diagonale('C3', 'D4')]).toEqual([3, true]);
  });
  it(`l49.1 : C3 est à moins de ${TOLERANCE_DEMO} pt du meilleur coup`, () => {
    expect(bilan(analyse(d.rows)).perte('C3')).toBeLessThanOrEqual(TOLERANCE_DEMO);
  });
  it('l49.2 : chaque réponse est dans le coin, sous le hoshi K4 ou à côté ; G2 est au milieu, sur la 2e ligne, et perd bien plus', () => {
    for (const x of e.accept as string[]) {
      expect(voisins(x, 'K4') || diagonale(x, 'K4'), x).toBe(true);
      expect(xy(x)[0] >= xy('K4')[0] && xy(x)[1] >= xy('K4')[1], x).toBe(true);
    }
    expect(e.refus![0].points).toEqual(['G2']);
    expect([ligne('G2'), xy('G2')[0]]).toEqual([2, (N - 1) / 2]);
    const a = analyse(e.rows);
    bienPlus(a, moinsBonneReponse(a, e.accept as string[]), 'G2');
  });
  it('l49.3 : « ses coins sont fermés » : deux pierres blanches dans chaque coin du bas ; G4 se pose juste au-dessus de G3', () => {
    for (const l of ['C4', 'D3', 'L4', 'K3', 'G3']) expect(pierre(r.rows, l), l).toBe('O');
    expect(pierre(r.rows, 'G3')).toBe('O');
    expect(xy('G4')[1]).toBe(xy('G3')[1] - 1);
    expect(bilan(analyse(r.rows)).perte('G4')).toBeLessThanOrEqual(TOLERANCE_DEMO);
  });
  it('l49.4 : D7 est par-dessus (4e ligne), B8 dessous (2e ligne) ; D7 rapporte bien plus, et c’est la bonne réponse', () => {
    expect([ligne('D7'), ligne('B8')]).toEqual([4, 2]);
    expect(q.choices[q.answer]).toBe('D7');
    const a = analyse(q.rows);
    expect(bilan(a).perte('D7')).toBeLessThanOrEqual(TOLERANCE);
    bienPlus(a, 'D7', 'B8');
  });
});

describe('positions jouables', () => {
  it('chaque réponse, refus, choix et pierre de démonstration est un point vide, dans le cadre', () => {
    for (const id of IDS) for (const s of lecon(id).steps) {
      const f = fenetreDe(s.cadre, N), vide = (l: string) => expect(pierre(s.rows, l), `${id} ${l}`).toBe('.');
      const pts = s.kind === 'move' ? [...(s.accept as string[]), ...(s.refus ?? []).flatMap(x => x.points)]
        : s.kind === 'quiz' ? s.choices : s.kind === 'info' ? (s.demo ?? []).flatMap(t => ('pose' in t ? [t.pose] : [])) : [];
      for (const l of pts) { vide(l); expect(visible(l, N, f), `${id} ${l} hors du cadre`).toBe(true); }
    }
  });
});
