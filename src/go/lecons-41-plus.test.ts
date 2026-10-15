// Issue #547 (approfondir l'apprentissage, leçons 41 et suivantes) : chaque affirmation des leçons est prouvée par src/go.
// Les réponses acceptées sont exactement les coups qui atteignent le but annoncé, chaque réfutation est rejouée, chaque
// démonstration montre ce que dit son texte, chaque chiffre est recompté par le moteur.
// - Compter en règle chinoise (l41) : score() de src/go/score.ts, règles chinoise (komi 7,5) et japonaise (komi 6,5) ;
//   le dernier point qui rapporte : minimax exact de src/go/preuve-fin-de-partie.ts sur les endroits encore ouverts.
// - Lire l'échelle (l42) : lecteur d'échelle de src/go/tactics.ts (`ladderWorks` : l'attaquant prend par une suite
//   d'atari, contre toutes les défenses d'une pierre en atari, s'allonger ou prendre une pierre qui l'entoure ;
//   `canEscape` : le défenseur en atari sort de l'échelle).
// - Le triangle vide (l43) : libertés comptées par le moteur, pour chaque coup qui prolonge les pierres marquées.
// - Le deuxième rang (l44) : preuve exhaustive de vie et mort en zone fermée (src/go/preuve-vie-mort.ts, zone vérifiée
//   par defautsDeZone ; un ko n'est jamais compté comme une preuve).
import { CHAPITRES, LESSONS, explicationRefus, type LessonStep } from '../content/lessons';
import { imagesDemo, mots } from '../content/demo';
import { ACQUIS } from '../content/acquis';
import { THEMES_DE_LECON } from '../content/themes';
import { fromRows } from './position';
import { groupAt, isLegal, neighbors, play, type Position } from './rules';
import { score } from './score';
import { meilleursCoups } from './preuve-fin-de-partie';
import { fromLabel, toLabel } from './coords';
import { coupsGagnants, defautsDeZone, evaluer } from './preuve-vie-mort';
import { canEscape, ladderWorks } from './tactics';

const lecon = (id: string) => LESSONS.find(l => l.id === id)!;
type Info = Extract<LessonStep, { kind: 'info' }>;
type Move = Extract<LessonStep, { kind: 'move' }>;
type Quiz = Extract<LessonStep, { kind: 'quiz' }>;
type Touche = Extract<LessonStep, { kind: 'touche' }>;
const step = <S extends LessonStep>(id: string, i: number) => lecon(id).steps[i] as S;
const ok = (r: Position | string): Position => { if (typeof r === 'string') throw new Error(r); return r; };
const taille = (rows: string[]) => rows.length;
const at = (l: string, n = 9) => fromLabel(l, n);
const lab = (p: number, n = 9) => (p < 0 ? 'passe' : toLabel(p, n));
const labels = (ps: Iterable<number>, n = 9) => [...ps].map(p => lab(p, n)).sort();
const avec = (rows: string[], toPlay: 1 | 2 = 1) => fromRows(rows, toPlay).pos;
const images = (s: Info) => imagesDemo(s.rows, s.demo!, s.avant);
const libs = (pos: Position, p: number) => groupAt(pos.board, pos.size, p).liberties;
/** Points vides du plateau. */
const vides = (pos: Position) => [...pos.board.keys()].filter(p => !pos.board[p]);
/** Endroits encore ouverts : les points vides dont la région vide touche les deux couleurs. */
function ouverts(pos: Position): number[] {
  const n = pos.size, nb = neighbors(n), vu = new Set<number>(), out: number[] = [];
  for (let p = 0; p < n * n; p++) {
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
const IDS = ['l41', 'l42', 'l43', 'l44'];

describe('leçons 41 et suivantes : place dans le programme (#547)', () => {
  it('chaque leçon a 4 à 6 étapes, sa phrase de fin et sa série de pratique', () => {
    for (const id of IDS) {
      expect(lecon(id).steps.length, id).toBeGreaterThanOrEqual(4);
      expect(lecon(id).steps.length, id).toBeLessThanOrEqual(6);
      expect(ACQUIS[id], id).toBeTruthy();
      expect(THEMES_DE_LECON[id]?.length, id).toBeGreaterThan(0);
    }
  });
  it('chaque leçon est à sa place dans son chapitre ; l’ordre du chemin suit les chapitres', () => {
    const c = Object.fromEntries(CHAPITRES.map(x => [x.id, x.lecons.map(l => l.id)]));
    // Lire l'échelle ouvre « Capturer et sauver », avant le filet qui s'en sert.
    expect(c.c3.slice(0, 2)).toEqual(['l42', 'l9']);
    // Le deuxième rang suit « Agrandir ou réduire » (le bord de l'espace), avant les groupes du coin.
    expect(c.c4.slice(4, 7)).toEqual(['l24', 'l44', 'l25']);
    // Compter en règle chinoise suit « Compter une partie ».
    expect(c.c5.slice(0, 3)).toEqual(['l15', 'l16', 'l41']);
    // Le triangle vide suit les bonnes formes.
    expect(c.c6.slice(0, 3)).toEqual(['l18', 'l43', 'l19']);
    expect(LESSONS.map(l => l.id)).toEqual(CHAPITRES.flatMap(x => x.lecons.map(l => l.id)));
  });
  it('chaque consigne tient en 12 mots ; chaque geste « pose » est sur le point vert ; au plus une étape sans geste', () => {
    for (const id of IDS) {
      lecon(id).steps.forEach((s, i) => {
        expect(mots(s.text), `${id}.${i + 1}`).toBeLessThanOrEqual(12);
        if (s.kind === 'info' && s.geste && 'pose' in s.geste) expect(s.text, `${id}.${i + 1}`).toContain('point vert');
      });
      expect(lecon(id).steps.filter(s => s.kind === 'info' && !s.geste).length, id).toBeLessThanOrEqual(1);
      // On pose ou on touche dès le premier écran.
      const s0 = lecon(id).steps[0];
      expect(s0.kind === 'info' ? !!s0.geste : true, id).toBe(true);
    }
  });
  it('chaque coup refusé avec une explication est légal, n’est pas une réponse acceptée, et reçoit son explication', () => {
    for (const id of IDS) lecon(id).steps.forEach(s => {
      if (s.kind !== 'move' || !s.refus) return;
      const pos = avec(s.rows), n = taille(s.rows);
      for (const r of s.refus) for (const l of r.points) {
        expect(isLegal(pos, at(l, n)), `${id} ${l}`).toBe(true);
        expect(s.accept).not.toContain(l);
        expect(explicationRefus(s, l)).toBe(r.no);
      }
    });
  });
});

describe('leçon 41 : compter en règle chinoise', () => {
  const P = step<Info>('l41', 0).rows;
  const chinois = (pos: Position) => score(pos, 7.5, 'chinese');
  const japonais = (pos: Position) => score(pos, 6.5, 'japanese');

  it('l41.1 : la partie de la leçon 7 ; Noir touche une de ses pierres ; la démonstration colore les 36 points de son territoire', () => {
    expect(P).toEqual(step<Quiz>('l7', 1).rows);
    const s = step<Info>('l41', 0), pos = avec(P);
    expect(s.geste).toMatchObject({ touche: [...Array(9).keys()].map(i => `E${i + 1}`) });
    for (const l of (s.geste as { touche: string[] }).touche) expect(pos.board[at(l)]).toBe(1);
    expect(images(s).at(-1)!.terr!.points).toHaveLength(36);
  });

  it('l41.2 : territoire plus pierres : 36 + 9 = 45 ; les prisonniers ne changent rien en chinois, tout en japonais', () => {
    const pos = avec(P), s = chinois(pos);
    expect(s.territory[1]).toBe(36);
    expect(pos.board.filter(v => v === 1).length).toBe(9);
    expect(s.black).toBe(45);
    const q = step<Quiz>('l41', 1);
    expect(q.choices[q.answer]).toBe(String(s.black));
    // Avec les prisonniers de la leçon 7 (3 et 5), le compte chinois ne bouge pas ; le japonais, si.
    const prises = { ...pos, captures: [0, 3, 5] as Position['captures'] };
    expect(chinois(prises).black).toBe(45);
    expect(chinois(prises).white).toBe(chinois(pos).white);
    expect(japonais(prises).black).toBe(japonais(pos).black + 3);
  });

  it('l41.3 : Blanc 27 + 9 + 7,5 = 43,5 ; Noir gagne de 1,5 point en chinois (et de 2,5 en japonais : même gagnant)', () => {
    const pos = avec(P), s = chinois(pos);
    expect(s.territory[2]).toBe(27);
    expect(pos.board.filter(v => v === 2).length).toBe(9);
    expect(s.white).toBe(43.5);
    expect(s.winner).toBe(1);
    const q = step<Quiz>('l41', 2);
    expect(q.choices[q.answer]).toBe('Noir');
    expect(q.ok).toContain('45 contre 43,5');
    expect(japonais(pos).winner).toBe(1);
  });

  it('l41.4 : F5 est une dame (elle touche les deux couleurs) ; la remplir donne un point en chinois, aucun en japonais', () => {
    const s = step<Info>('l41', 3), pos = avec(s.rows);
    expect(labels(ouverts(pos))).toEqual(['F5']);
    const apres = images(s).at(-1)!.board;
    const r = ok(play(pos, at('F5')));
    expect(apres).toEqual(r.board);
    expect(chinois(r).black - chinois(pos).black).toBe(1);
    expect(chinois(r).white).toBe(chinois(pos).white);
    expect(japonais(r).black).toBe(japonais(pos).black);
    expect(japonais(r).white).toBe(japonais(pos).white);
  });

  it('l41.5 : seul endroit ouvert, E6 ; en chinois, E6 est le seul meilleur coup ; en japonais, passer vaut autant', () => {
    const m = step<Move>('l41', 4), pos = avec(m.rows), z = ouverts(pos);
    expect(labels(z)).toEqual(['E6']);
    expect(labels(meilleursCoups(pos, z, { regle: 'chinese' }))).toEqual(m.accept);
    expect(labels(meilleursCoups(pos, z, { regle: 'japanese' }))).toEqual(['E6', 'passe']);
    const r = ok(play(pos, at('E6')));
    expect(chinois(r).black - chinois(pos).black).toBe(1);
    expect(japonais(r).black - japonais(pos).black).toBe(0);
    // Un coup chez soi ne coûte rien en chinois (il en coûte un en japonais) : il ne rapporte rien non plus.
    const chezSoi = ok(play(pos, at('A1')));
    expect(chinois(chezSoi).black).toBe(chinois(pos).black);
    expect(japonais(chezSoi).black).toBe(japonais(pos).black - 1);
  });
});

describe('leçon 42 : lire l’échelle', () => {
  const R = step<Info>('l42', 0).rows, E5 = at('E5');

  it('l42.1 : ta pierre E5 est en atari et ne peut pas sortir de l’échelle ; si tu cours en E4, l’échelle blanche marche', () => {
    const pos = avec(R);
    expect(labels(libs(pos, E5))).toEqual(['E4']);
    expect(canEscape(pos, E5)).toBe(false);
    const r = ok(play(pos, at('E4')));
    expect(libs(r, E5).size).toBe(2);
    expect(ladderWorks(r, E5)).toBe(true);
    // Chaque coup blanc de la démonstration laisse les pierres noires en atari.
    const s = step<Info>('l42', 0);
    for (const im of images(s).slice(1)) if (im.derniere !== undefined && im.board[im.derniere] === 2) {
      expect(groupAt(im.board, 9, E5).liberties.size).toBe(1);
    }
  });

  it('l42.2 : la suite finit au bord ; les huit pierres noires sont prises', () => {
    const s = step<Info>('l42', 1);
    const fin = images(s).at(-1)!.board;
    expect(fin[E5]).toBe(0);
    const pos = avec(R);
    let p = pos;
    for (const t of [...s.avant!, ...s.demo!]) if ('pose' in t) p = ok(play({ ...p, toPlay: t.couleur === 'B' ? 1 : 2 }, at(t.pose)));
    expect(p.board).toEqual(fin);
    expect(p.captures[2]).toBe(8);
    expect(s.text).toContain('Huit pierres');
  });

  it('l42.3 : avec ta pierre F2 sur le chemin, tu sors de l’échelle ; la démonstration finit relié à F2, avec 3 libertés ou plus', () => {
    const s = step<Info>('l42', 2), pos = avec(s.rows);
    expect(canEscape(pos, E5)).toBe(true);
    const im = images(s).at(-1)!;
    const g = groupAt(im.board, 9, E5);
    expect(g.stones).toContain(at('F2'));
    expect(g.liberties.size).toBeGreaterThanOrEqual(3);
    // Sans F2, la même position ne sort pas.
    expect(s.rows.map((r, y) => (y === 7 ? '.........' : r))).toEqual(R);
  });

  it('l42.4 : le miroir de l42.1 : aucune pierre noire sur le chemin ; courir laisse l’échelle blanche marcher', () => {
    const q = step<Quiz>('l42', 3);
    expect(q.rows).toEqual(R.map(r => [...r].reverse().join('')));
    const pos = avec(q.rows);
    expect(libs(pos, E5).size).toBe(1);
    expect(canEscape(pos, E5)).toBe(false);
    const run = ok(play(pos, [...libs(pos, E5)][0]));
    expect(ladderWorks(run, E5)).toBe(true);
    expect(q.choices[q.answer]).toMatch(/^Non/);
  });

  it('l42.5 : la pierre marquée, en atari, sort de l’échelle grâce à G2, et seulement grâce à G2 ; J3, à côté du chemin, n’y est pour rien', () => {
    const t = step<Touche>('l42', 4), T = at('E5');
    const blanc = (sauf?: string) => { const p = avec(t.rows, 2); if (sauf) p.board[at(sauf)] = 0; return p; };
    const pos = blanc();
    expect(pos.board[T]).toBe(2);
    expect(libs(pos, T).size).toBe(1);
    expect(canEscape(pos, T)).toBe(true);
    const blanches = [...pos.board.keys()].filter(p => pos.board[p] === 2 && p !== T);
    expect(labels(blanches)).toEqual(['G2', 'J3']);
    expect(labels(blanches.filter(b => !canEscape(blanc(lab(b)), T)))).toEqual(t.accept);
    // L'échelle de la leçon 3 : sans casseur, elle marche.
    expect(canEscape(blanc('G2'), T)).toBe(false);
    expect(canEscape(blanc('J3'), T)).toBe(true);
  });
});

describe('leçon 43 : le triangle vide', () => {
  const D5 = at('D5');
  /** Le point `t` ferme-t-il un carré 2 × 2 de trois pierres de la chaîne et d'un point vide (triangle vide) ? */
  const triangleVide = (pos: Position, t: number) => {
    const x = t % 9, y = Math.floor(t / 9), c = pos.board[t];
    return [[0, 0], [-1, 0], [0, -1], [-1, -1]].some(([dx, dy]) => {
      const x0 = x + dx, y0 = y + dy;
      if (x0 < 0 || y0 < 0 || x0 > 7 || y0 > 7) return false;
      const pts = [y0 * 9 + x0, y0 * 9 + x0 + 1, (y0 + 1) * 9 + x0, (y0 + 1) * 9 + x0 + 1];
      return pts.filter(p => pos.board[p] === c).length === 3 && pts.filter(p => !pos.board[p]).length === 1;
    });
  };
  /** Libertés des pierres marquées après chaque coup qui les prolonge. */
  const prolongements = (rows: string[]) => {
    const { pos, marked } = fromRows(rows);
    return new Map([...libs(pos, marked[0])].map(m => { const r = ok(play(pos, m)); return [lab(m), { n: libs(r, marked[0]).size, tri: triangleVide(r, m) }] as const; }));
  };

  it('l43.1 et l43.2 : E6 fait un triangle vide (7 libertés), F5 une ligne (8) : la démonstration les compte', () => {
    const s1 = step<Info>('l43', 0), s2 = step<Info>('l43', 1);
    expect(s1.rows).toEqual(s2.rows);
    const tri = ok(play(avec(s1.rows), at('E6'))), ligne = ok(play(avec(s1.rows), at('F5')));
    expect(triangleVide(tri, at('E6'))).toBe(true);
    expect(triangleVide(ligne, at('F5'))).toBe(false);
    expect(libs(tri, D5).size).toBe(7);
    expect(libs(ligne, D5).size).toBe(8);
    expect(images(s1).at(-1)!.libs).toHaveLength(7);
    expect(images(s2).at(-1)!.libs).toHaveLength(8);
    expect(s2.text).toContain('huit libertés au lieu de sept');
  });

  it('l43.3 : le coin vide du triangle est D6, déjà une liberté de D5 avant E6', () => {
    const t = step<Touche>('l43', 2), pos = avec(t.rows);
    expect(pos.board[at('E6')]).toBe(1);
    // Un seul point vide complète un carré avec trois pierres noires : D6 (le coin vide).
    const carres = vides(pos).filter(p => {
      const x = p % 9, y = Math.floor(p / 9);
      return [[0, 0], [-1, 0], [0, -1], [-1, -1]].some(([dx, dy]) => {
        const x0 = x + dx, y0 = y + dy;
        if (x0 < 0 || y0 < 0 || x0 > 7 || y0 > 7) return false;
        return [y0 * 9 + x0, y0 * 9 + x0 + 1, (y0 + 1) * 9 + x0, (y0 + 1) * 9 + x0 + 1].filter(q => pos.board[q] === 1).length === 3;
      });
    });
    expect(labels(carres)).toEqual(t.accept);
    expect(libs(avec(step<Info>('l43', 0).rows), D5).has(at('D6'))).toBe(true);
  });

  for (const i of [3, 4]) it(`l43.${i + 1} : réponse acceptée = le prolongement qui garde le plus de libertés ; chaque refus est un triangle vide, une liberté de moins`, () => {
    const m = step<Move>('l43', i), v = prolongements(m.rows);
    const max = Math.max(...[...v.values()].map(x => x.n));
    expect([...v].filter(([, x]) => x.n === max).map(([l]) => l).sort()).toEqual(m.accept);
    for (const l of m.accept) expect(v.get(l)!.tri, l).toBe(false);
    for (const l of m.refus![0].points) {
      expect(v.get(l)!.tri, l).toBe(true);
      expect(v.get(l)!.n, l).toBe(max - 1);
    }
    expect(m.ok).toMatch(new RegExp(['Six', 'Sept'][i - 3]));
    expect(String(max)).toBe(String([6, 7][i - 3]));
  });
});

describe('leçon 44 : le deuxième rang', () => {
  const N = 13;
  const a = (l: string) => at(l, N), lb = (ps: Iterable<number>) => labels(ps, N);
  /** n pierres noires sur la 2e ligne, de B2 à la n-ième ; zone : le premier rang sous elles. */
  const cas = (rows: string[], noir = true) => {
    const pos = avec(rows), c = noir ? 1 : 2;
    const pierres = [...pos.board.keys()].filter(p => Math.floor(p / N) === N - 2 && pos.board[p] === c);
    const zone = [...pos.board.keys()].filter(p => Math.floor(p / N) === N - 1 && !pos.board[p] && pierres.some(q => q % N === p % N));
    return { pos, cible: pierres[0], n: pierres.length, zone };
  };

  it('les zones sont fermées : tout se joue au premier rang, sous les pierres ; les bouts sont fermés aux deux rangs', () => {
    for (const [i, noir] of [[0, true], [2, true], [3, true], [4, false]] as const) {
      const { pos, cible, zone, n } = cas(lecon('l44').steps[i].rows, noir);
      expect(defautsDeZone(pos, cible, zone), `étape ${i + 1}`).toEqual([]);
      expect(zone).toHaveLength(n);
    }
  });

  it('l44.1 : sept pierres ; Noir au trait vit (E1 en fait partie), et après E1 Blanc ne tue plus', () => {
    const s = step<Info>('l44', 0), { pos, cible, zone, n } = cas(s.rows);
    expect(n).toBe(7);
    expect(evaluer(pos, cible, zone)).toBe(1);
    expect(lb(coupsGagnants(pos, cible, zone, 'vivre'))).toContain('E1');
    const r = ok(play(pos, a('E1')));
    expect(evaluer(r, cible, zone)).toBe(1);
    expect(images(s).at(-1)!.board).toEqual(r.board);
  }, LENT);

  it('l44.2 : Blanc au trait tue sept pierres ; les coups qui tuent sont exactement les deux bouts, B1 et H1', () => {
    const s = step<Info>('l44', 1), { pos, cible, zone } = cas(s.rows);
    const w = { ...pos, toPlay: 2 as const };
    expect(evaluer(w, cible, zone)).toBe(-1);
    expect(lb(coupsGagnants(w, cible, zone, 'tuer'))).toEqual(['B1', 'H1']);
    expect((s.geste as { touche: string[] }).touche).toEqual(['B1', 'H1']);
    const r = ok(play(w, a('B1')));
    expect(evaluer(r, cible, zone)).toBe(-1);
  }, LENT);

  it('l44.3 : six pierres meurent, même si Noir joue d’abord', () => {
    const q = step<Quiz>('l44', 2), { pos, cible, zone, n } = cas(q.rows);
    expect(n).toBe(6);
    expect(evaluer(pos, cible, zone)).toBe(-1);
    expect(evaluer({ ...pos, toPlay: 2 }, cible, zone)).toBe(-1);
    expect(q.choices[q.answer]).toBe('Non, jamais');
  }, LENT);

  it('l44.4 : huit pierres vivent même si Blanc commence ; après chaque coup blanc, Noir a une réponse qui vit', () => {
    const q = step<Quiz>('l44', 3), { pos, cible, zone, n } = cas(q.rows);
    expect(n).toBe(8);
    const w = { ...pos, toPlay: 2 as const };
    expect(evaluer(w, cible, zone)).toBe(1);
    for (const m of zone) expect(coupsGagnants(ok(play(w, m)), cible, zone, 'vivre').length, lab(m, N)).toBeGreaterThan(0);
    expect(q.choices[q.answer]).toBe('Non');
  }, LENT);

  it('l44.5 : sept pierres blanches (le premier dessin, couleurs inversées, retourné) ; les coups noirs qui tuent sont exactement les deux bouts', () => {
    const m = step<Move>('l44', 4);
    const premier = step<Info>('l44', 0).rows;
    expect(m.rows).toEqual(premier.map(r => [...r].reverse().map(c => ({ X: 'O', O: 'X' } as Record<string, string>)[c] ?? c).join('')));
    const { pos, cible, zone, n } = cas(m.rows, false);
    expect(n).toBe(7);
    expect(lb(coupsGagnants(pos, cible, zone, 'tuer'))).toEqual([...m.accept].sort());
  }, LENT);
});
