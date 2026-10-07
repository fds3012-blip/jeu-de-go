// Issue #16 (palier 27-30) : chaque position prouvée, même exigence que les leçons 21 à 26 (src/go/lecons-21-30.test.ts).
// - Attaquer et défendre (l27) : un jugement de stratégie, que seul KataGo mesure. Les preuves sont figées dans
//   src/go/attaque-defense.fixture.ts (réseau g170 b6c96, komi 6,5, règle japonaise, huit graines : les huit symétries du
//   plateau) et rejouées ici sans le modèle. Règles :
//   · la démonstration et chaque réponse acceptée : premier choix de la recherche dans les huit graines, ou à moins de
//     TOLERANCE point du meilleur coup dans les huit graines à la recherche la plus longue ;
//   · aucun autre coup examiné ne remplit ces conditions (les réponses acceptées sont exactement celles-là) ;
//   · chaque coup refusé avec une explication perd au moins MARGE points dans chaque graine, et la réponse qu'annonce
//     l'explication est le premier choix de l'adversaire dans chaque graine ;
//   · chaque coup que la recherche a regardé de près (quatre premiers de chaque graine) a été évalué.
//   Le bloc « KataGo rejoué » (KATAGO_L27=1, après npm run fetch-model) relance le réseau et compare.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CHAPITRES, LESSONS, explicationRefus, type LessonStep } from '../content/lessons';
import { mots } from '../content/demo';
import { ACQUIS } from '../content/acquis';
import { THEMES_DE_LECON } from '../content/themes';
import { KATAGO_L27, type PreuveKataGo } from './attaque-defense.fixture';
import { fromRows } from './position';
import { isLegal, play, type Position } from './rules';
import { fromLabel, toLabel } from './coords';

const N = 9;
const at = (l: string) => fromLabel(l, N);
const lecon = (id: string) => LESSONS.find(l => l.id === id)!;
type Info = Extract<LessonStep, { kind: 'info' }>;
type Move = Extract<LessonStep, { kind: 'move' }>;
const step = <S extends LessonStep>(id: string, i: number) => lecon(id).steps[i] as S;
const IDS = ['l27'];

/** Une réponse acceptée est à moins de TOLERANCE point du meilleur coup, dans chaque graine. */
const TOLERANCE = 1;
/** Un coup refusé avec une explication perd au moins MARGE points, dans chaque graine. */
const MARGE = 3;
const GRAINES = 8;

/** Plateau sans les marques (T, S) : celui que KataGo a analysé. */
const sansMarques = (rows: string[]) => rows.map(r => r.replace(/T/g, 'O').replace(/S/g, 'X'));
/** Évaluation la plus longue d'un coup : ses valeurs par graine. */
function valeurs(p: PreuveKataGo, coup: string): number[] {
  const ev = p.evaluations.filter(e => coup in e.coups).sort((a, b) => b.visites - a.visites)[0];
  if (!ev) throw new Error(`${coup} n'a pas été évalué`);
  return ev.coups[coup];
}
/** Coups évalués à la plus longue recherche disponible pour chacun. */
const evalues = (p: PreuveKataGo) => [...new Set(p.evaluations.flatMap(e => Object.keys(e.coups)))].sort();
/** Perte d'un coup dans chaque graine, par rapport au meilleur coup évalué de cette graine. */
function pertes(p: PreuveKataGo, coup: string): number[] {
  const tous = evalues(p).map(c => valeurs(p, c));
  return valeurs(p, coup).map((v, s) => Math.max(...tous.map(t => t[s])) - v);
}
const premiers = (p: PreuveKataGo) => p.racine.graines.map(g => g[0][0]);
/** Coups qui remplissent la règle d'acceptation. */
const justes = (p: PreuveKataGo) => evalues(p).filter(c =>
  premiers(p).every(x => x === c) || pertes(p, c).every(x => x <= TOLERANCE));

describe('leçon 27 : place dans le programme (#16)', () => {
  it('4 à 6 étapes, phrase de fin, série de pratique ; ouvre la suite de « Ouverture sur 9 × 9 »', () => {
    for (const id of IDS) {
      expect(lecon(id).steps.length, id).toBeGreaterThanOrEqual(4);
      expect(lecon(id).steps.length, id).toBeLessThanOrEqual(6);
      expect(ACQUIS[id], id).toBeTruthy();
      expect(THEMES_DE_LECON[id]?.length, id).toBeGreaterThan(0);
    }
    expect(CHAPITRES.find(c => c.id === 'c2')!.lecons.map(l => l.id)).toEqual(['l8', 'l27']);
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
  it('vocabulaire nouveau expliqué à sa première apparition : la pierre faible', () => {
    expect(step<Info>('l27', 0).text).toMatch(/^Pierre faible \(seule chez l’adversaire\)/);
    const avant = LESSONS.slice(0, LESSONS.findIndex(l => l.id === 'l27'))
      .flatMap(l => l.steps.flatMap(s => [s.text, 'ok' in s ? s.ok : '', 'no' in s ? s.no : ''])).join(' ');
    expect(avant).not.toMatch(/pierre faible/i);
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

describe('leçon 27 : attaquer et défendre (preuves KataGo figées)', () => {
  const P = KATAGO_L27.positions;

  it('les preuves portent sur les positions de la leçon, avec le réseau et les règles annoncés', () => {
    expect(KATAGO_L27.reseau).toBe('g170-b6c96-s175395328-d26788732');
    expect(KATAGO_L27.komi).toBe(6.5);
    expect(KATAGO_L27.regle).toBe('japanese');
    const l = lecon('l27').steps;
    expect(P.faible.rows).toEqual(sansMarques(l[0].rows));
    expect(P.blancJoue.rows).toEqual(sansMarques(l[1].rows));
    expect(P.cote.rows).toEqual(sansMarques(l[2].rows));
    expect(P.sors.rows).toEqual(sansMarques(l[3].rows));
    expect([P.faible.toPlay, P.blancJoue.toPlay, P.cote.toPlay, P.sors.toPlay]).toEqual([1, 2, 1, 1]);
    for (const [nom, p] of Object.entries(P)) {
      expect(p.racine.graines, nom).toHaveLength(GRAINES);
      expect(p.racine.visites, nom).toBeGreaterThanOrEqual(800);
      for (const e of p.evaluations) {
        expect(e.visites, nom).toBeGreaterThanOrEqual(400);
        for (const v of Object.values(e.coups)) expect(v, nom).toHaveLength(GRAINES);
      }
      // Tout coup que la recherche a regardé de près a été évalué.
      for (const g of p.racine.graines) for (const [c] of g) expect(evalues(p), `${nom} ${c}`).toContain(c);
      // Les coups évalués sont légaux dans la position.
      const pos = fromRows(p.rows, p.toPlay).pos;
      for (const c of evalues(p)) expect(isLegal(pos, at(c)), `${nom} ${c}`).toBe(true);
    }
  });

  it('l27.1 : F4 ferme le centre ; premier choix dans les huit graines, et le meilleur coup évalué', () => {
    const p = P.faible;
    expect(premiers(p)).toEqual(Array(GRAINES).fill('F4'));
    // Évaluée à part, F6 (fermer de plus loin) passe une fois devant, de moins d'un demi-point ; elle perd plus d'un point
    // dans les sept autres graines : ce n'est pas une réponse.
    for (const x of pertes(p, 'F4')) expect(x).toBeLessThanOrEqual(0.5);
    expect(justes(p)).toEqual(['F4']);
    expect(step<Info>('l27', 0).demo).toEqual([{ pose: 'F4', couleur: 'B' }]);
    // L'erreur courante : bloquer le long de la 3e ligne (E3) ou passer dessous (F2) ; E3 perd plus de MARGE points.
    for (const x of pertes(p, 'E3')) expect(x).toBeGreaterThanOrEqual(MARGE);
  });

  it('l27.2 : si Blanc joue d’abord, son meilleur coup est le même point, F4', () => {
    const p = P.blancJoue;
    // F4 est le meilleur coup évalué dans chaque graine, d'au moins un point.
    for (const c of evalues(p)) if (c !== 'F4') for (const x of pertes(p, c)) expect(x, c).toBeGreaterThanOrEqual(1);
    expect(pertes(p, 'F4')).toEqual(Array(GRAINES).fill(0));
    // Premier choix de la recherche dans au moins sept graines sur huit ; dans l'autre, le coup le plus visité vaut au
    // moins deux points de moins que F4 (la recherche n'a pas fini de le départager).
    expect(premiers(p).filter(c => c === 'F4').length).toBeGreaterThanOrEqual(GRAINES - 1);
    p.racine.graines.forEach((g, s) => { if (g[0][0] !== 'F4') expect(pertes(p, g[0][0])[s]).toBeGreaterThanOrEqual(2); });
    const s = step<Info>('l27', 1);
    expect(s.geste).toMatchObject({ touche: ['F4'] });
    expect(s.demo).toEqual([{ pose: 'F4', couleur: 'W' }]);
    expect(s.rows).toEqual(step<Info>('l27', 0).rows);
  });

  it('l27.3 : sur le côté, la réponse acceptée est exactement F4 ; G5 perd au moins trois points, et Blanc sort en F4', () => {
    const p = P.cote, m = step<Move>('l27', 2);
    expect(premiers(p)).toEqual(Array(GRAINES).fill('F4'));
    expect(justes(p)).toEqual([...(m.accept as string[])].sort());
    for (const r of m.refus!) for (const c of r.points) for (const x of pertes(p, c)) expect(x, c).toBeGreaterThanOrEqual(MARGE);
    expect(p.reponses!.G5).toEqual(Array(GRAINES).fill('F4'));
    expect(m.refus![0].no).toMatch(/sort par F4/);
  });

  it('l27.4 : ta pierre faible sort vers le centre ; F4 et D4 exactement ; E3 et F2 perdent au moins trois points, et après F2 Blanc ferme le centre en F6', () => {
    const p = P.sors, m = step<Move>('l27', 3);
    expect(premiers(p)).toEqual(Array(GRAINES).fill('F4'));
    expect(justes(p)).toEqual([...(m.accept as string[])].sort());
    expect(m.refus!.map(r => r.points)).toEqual([['E3'], ['F2']]);
    for (const r of m.refus!) for (const c of r.points) for (const x of pertes(p, c)) expect(x, c).toBeGreaterThanOrEqual(MARGE);
    expect(p.reponses!.F2).toEqual(Array(GRAINES).fill('F6'));
    expect(m.refus![1].no).toMatch(/ferme le centre en F6/);
    // Après E3, Blanc ne répond pas en F4 (il joue G4) : l'explication ne prétend rien sur sa réponse.
    expect(m.refus![0].no).not.toMatch(/[A-J]\d/);
  });

  it('les positions sont symétriques deux à deux : le côté est la position du bas tournée, couleurs gardées', () => {
    // G4 entre G3 et G7 est F3 entre C3 et G3 vue par la diagonale : même idée, autre endroit du plateau.
    const tourne = (rows: string[]) => rows.map((_, y) => rows.map(r => r[y]).join(''));
    expect(tourne(P.faible.rows)).toEqual(P.cote.rows);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// KataGo rejoué. Désactivé par défaut (quelques minutes avec @tensorflow/tfjs-node, bien plus sur le processeur seul).
//   npm run fetch-model
//   KATAGO_L27=1 npx vitest run src/go/lecons-27-30.test.ts
// Relance la recherche de la graine 0 de chaque position et vérifie le premier choix et l'avance figés.
const MODELE = fileURLToPath(new URL('../../public/models/g170-b6c96-s175395328-d26788732.bin.gz', import.meta.url));
const KATAGO = process.env.KATAGO_L27 === '1' && existsSync(MODELE);

describe.skipIf(!KATAGO)('leçon 27, KataGo rejoué (KATAGO_L27=1)', () => {
  let analyser: (pos: Position, visites: number) => Promise<{ coup: string; avance: number }>;
  beforeAll(async () => {
    const tf = await import('@tensorflow/tfjs');
    const natif = '@tensorflow/tfjs-node';
    try { await import(/* @vite-ignore */ natif); await tf.setBackend('tensorflow'); } catch { await tf.setBackend('cpu'); }
    const { gunzip, parseNet } = await import('../engine/katago/parse');
    const { TfNet } = await import('../engine/katago/net');
    const { search } = await import('../engine/katago/search');
    const net = new TfNet(tf, parseNet(await gunzip(new Uint8Array(readFileSync(MODELE)))));
    analyser = async (pos, visites) => {
      const a = await search(net, pos, { komi: KATAGO_L27.komi, visits: visites, regles: KATAGO_L27.regle });
      return { coup: toLabel(a.moves[0].move, N), avance: a.lead };
    };
  }, 60000);

  for (const nom of ['faible', 'blancJoue', 'cote', 'sors'] as const) {
    it(`${nom} : même premier choix, même avance (à un point près), graine 0`, async () => {
      const p = KATAGO_L27.positions[nom];
      const pos = fromRows(p.rows, p.toPlay).pos;
      pos.lastMove = null as unknown as number;
      const r = await analyser(pos, p.racine.visites);
      expect(r.coup).toBe(p.racine.graines[0][0][0]);
      expect(Math.abs(r.avance - p.racine.graines[0][0][2])).toBeLessThanOrEqual(1);
      // Un coup refusé, rejoué : il perd toujours au moins MARGE points dans la graine 0.
      const refus = Object.keys(p.reponses ?? {})[0];
      if (refus) {
        const apres = await analyser(play(pos, at(refus)) as Position, 400);
        expect(r.avance - -apres.avance, refus).toBeGreaterThanOrEqual(MARGE - 1);
      }
    }, 4 * 3600 * 1000);
  }
});
