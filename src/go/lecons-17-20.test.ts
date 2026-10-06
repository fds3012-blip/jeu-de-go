// Issue #16 (décision du 05/10, vers le niveau dan) : leçons 17 à 20, prouvées avec src/go.
// Même exigence que les leçons 9 à 16 (src/go/lecons-16.test.ts, src/go/lecons-13-16.test.ts) : les réponses acceptées
// sont exactement les coups qui atteignent le but, chaque réfutation est rejouée, chaque démonstration montre ce que dit
// son texte. Vie et mort : preuve exhaustive de src/go/preuve-vie-mort.ts dans une zone fermée (vérifiée par
// defautsDeZone ; un ko n'est jamais compté comme une preuve). Captures : lecteur exact de src/go/lecteurs-lot-n.ts,
// sans ko (SANS_KO) : aucune réponse ne dépend d'un ko.
import { CHAPITRES, LESSONS, explicationRefus, type LessonStep } from '../content/lessons';
import { imagesDemo, mots, type DemoImage } from '../content/demo';
import { ACQUIS } from '../content/acquis';
import { THEMES_DE_LECON } from '../content/themes';
import { fromRows } from './position';
import { groupAt, isLegal, neighbors, play, type Position } from './rules';
import { fromLabel, toLabel } from './coords';
import { SANS_KO, attackerCaptures, captureEn } from './lecteurs-lot-n';
import { coupsGagnants, defautsDeZone, evaluer, issueApres, yeuxDuGroupe } from './preuve-vie-mort';

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
type Quiz = Extract<LessonStep, { kind: 'quiz' }>;
const step = <S extends LessonStep>(id: string, i: number) => lecon(id).steps[i] as S;
const images = (s: Info) => imagesDemo(s.rows, s.demo!, s.avant);
const avec = (rows: string[], toPlay: 1 | 2) => fromRows(rows, toPlay).pos;
const zoneDe = (ls: string[]) => ls.map(at);
const tous = [...Array(N * N).keys()];
const IDS = ['l17', 'l18', 'l19', 'l20'];
/** Coups légaux du camp au trait. */
const legaux = (pos: Position) => tous.filter(p => isLegal(pos, p));
/** Les pierres données sont-elles toutes dans la même chaîne ? */
const memeChaine = (pos: Position, ps: number[]) => ps.every(p => groupAt(pos.board, N, ps[0]).stones.includes(p));

describe('leçons 17 à 20 : place dans le programme (#16)', () => {
  it('quatre leçons de 4 à 6 étapes, chacune avec sa phrase de fin et sa série de pratique', () => {
    for (const id of IDS) {
      expect(lecon(id).steps.length, id).toBeGreaterThanOrEqual(4);
      expect(lecon(id).steps.length, id).toBeLessThanOrEqual(6);
      expect(ACQUIS[id], id).toBeTruthy();
      expect(THEMES_DE_LECON[id]?.length, id).toBeGreaterThan(0);
    }
  });
  it('l17 finit « Vie et mort » ; l18 à l20 forment « Formes et tesuji », chapitre en cours d’écriture', () => {
    const c = Object.fromEntries(CHAPITRES.map(x => [x.id, x]));
    expect(c.c4.lecons.map(l => l.id).slice(0, 4)).toEqual(['l12', 'l13', 'l14', 'l17']);
    expect(c.c6.titre).toBe('Formes et tesuji');
    expect(c.c6.lecons.map(l => l.id).slice(0, 3)).toEqual(['l18', 'l19', 'l20']);
    expect(c.c6.complet).toBe(false);
    // L'ordre des leçons suit celui du chemin : la leçon suivante est toujours la suivante sur le chemin.
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
  it('vocabulaire nouveau expliqué à sa première apparition', () => {
    expect(step<Touche>('l18', 0).text).toMatch(/^Point de coupe : Blanc y sépare tes pierres/);
    expect(step<Info>('l18', 1).text).toMatch(/^Bouche du tigre \(trois pierres autour d’un vide\)/);
    expect(step<Info>('l18', 3).text).toMatch(/^Bambou : deux passages/);
    expect(step<Info>('l19', 1).text).toMatch(/^Diamant \(ponnuki\)/);
    expect(CHAPITRES.find(c => c.id === 'c6')!.intro).toMatch(/coups malins/);
    const avant = LESSONS.slice(0, LESSONS.findIndex(l => l.id === 'l18'))
      .flatMap(l => l.steps.flatMap(s => [s.text, 'ok' in s ? s.ok : '', 'no' in s ? s.no : ''])).join(' ');
    expect(avant).not.toMatch(/bouche du tigre|bambou|ponnuki|point de coupe/i);
    // « Point vital » est défini à la leçon 5, rappelé à la leçon 13 : la leçon 17 l'emploie.
    expect(avant).toContain('Point vital (celui qui décide)');
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

describe('leçon 17 : les formes d’yeux', () => {
  const T_NOIR = zoneDe(['B1', 'C1', 'D1', 'C2']);
  const A1 = at('A1');

  it('l17.1 : espace en T ; le centre C1 est le seul coup qui vit, et il donne trois vrais yeux', () => {
    const s = step<Info>('l17', 0);
    const pos = avec(s.rows, 1);
    expect(defautsDeZone(pos, A1, T_NOIR)).toEqual([]);
    expect(coupsGagnants(pos, A1, T_NOIR, 'vivre').map(lab)).toEqual(['C1']);
    // Le centre touche les trois autres points de l'espace ; aucun autre point ne le fait.
    expect(T_NOIR.filter(p => T_NOIR.filter(q => neighbors(N)[p].includes(q)).length === 3).map(lab)).toEqual(['C1']);
    const fin = images(s).at(-1)!;
    expect(labels(fin.yeux)).toEqual(['B1', 'C2', 'D1']);
    const r = ok(play(pos, at('C1')));
    expect(yeuxDuGroupe(r, A1).map(e => `${lab(e.point)} ${e.vrai}`).sort()).toEqual(['B1 true', 'C2 true', 'D1 true']);
    // Si Blanc prend le centre le premier, Noir meurt.
    expect(coupsGagnants(avec(s.rows, 2), A1, T_NOIR, 'tuer').map(lab)).toEqual(['C1']);
  });

  it('l17.2 : tuer le T blanc, c’est exactement G1 ; F1, H1 et G2 laissent Blanc vivre', () => {
    const q = step<Move>('l17', 1);
    const { pos, marked } = fromRows(q.rows);
    const zone = zoneDe(['F1', 'G1', 'H1', 'G2']);
    expect(defautsDeZone(pos, marked[0], zone)).toEqual([]);
    expect(coupsGagnants(pos, marked[0], zone, 'tuer').map(lab)).toEqual(q.accept);
    for (const l of q.refus![0].points) expect(issueApres(pos, at(l), marked[0], zone), l).toBe(1);
    expect(labels(q.refus![0].points.map(at))).toEqual(labels(zone.filter(z => !q.accept.includes(lab(z)))));
  });

  it('l17.3 : le carré de quatre meurt même si Noir joue le premier ; après chaque coup dedans, Blanc tue au coin opposé', () => {
    const q = step<Quiz>('l17', 2);
    const zone = zoneDe(['A1', 'B1', 'A2', 'B2']);
    const C3 = at('C3');
    const pos = avec(q.rows, 1);
    expect(defautsDeZone(pos, C3, zone)).toEqual([]);
    expect(evaluer(pos, C3, zone)).toBe(-1);
    expect(evaluer(avec(q.rows, 2), C3, zone)).toBe(-1);
    const oppose: Record<string, string> = { A1: 'B2', B2: 'A1', A2: 'B1', B1: 'A2' };
    for (const z of zone) {
      const r = ok(play(pos, z));
      expect(coupsGagnants(r, C3, zone, 'tuer').map(lab), lab(z)).toEqual([oppose[lab(z)]]);
    }
    expect(q.choices[q.answer]).toBe('Non');
  });

  it('l17.4 : cinq en grappe ; B1 est le seul coup qui vit, et le seul qui tue si Blanc joue', () => {
    const s = step<Info>('l17', 3);
    const zone = zoneDe(['A1', 'B1', 'C1', 'A2', 'B2']);
    const C3 = at('C3');
    const pos = avec(s.rows, 1);
    expect(defautsDeZone(pos, C3, zone)).toEqual([]);
    expect(coupsGagnants(pos, C3, zone, 'vivre').map(lab)).toEqual(['B1']);
    expect(coupsGagnants(avec(s.rows, 2), C3, zone, 'tuer').map(lab)).toEqual(['B1']);
    // Après B1, Blanc au trait ne tue plus : C1 est un vrai œil, A1-A2-B2 donne le second.
    const r = ok(play(pos, at('B1')));
    expect(evaluer(r, C3, zone)).toBe(1);
    const fin = images(s).at(-1)!;
    expect(labels(fin.yeux)).toEqual(['A1', 'A2', 'B2', 'C1']);
    expect(yeuxDuGroupe(r, C3).find(e => e.point === at('C1'))?.vrai).toBe(true);
  });

  it('l17.5 : tuer la grappe blanche, c’est exactement H1, le point qui touche trois points vides ; c’est aussi le coup qui fait vivre Blanc', () => {
    const q = step<Move>('l17', 4);
    const { pos, marked } = fromRows(q.rows);
    const zone = zoneDe(['G1', 'H1', 'J1', 'H2', 'J2']);
    expect(defautsDeZone(pos, marked[0], zone)).toEqual([]);
    expect(coupsGagnants(pos, marked[0], zone, 'tuer').map(lab)).toEqual(q.accept);
    expect(coupsGagnants(avec(q.rows, 2), marked[0], zone, 'vivre').map(lab)).toEqual(q.accept);
    for (const l of q.refus![0].points) expect(issueApres(pos, at(l), marked[0], zone), l).toBe(1);
    expect(zone.filter(p => neighbors(N)[p].filter(v => pos.board[v] === 0).length === 3).map(lab)).toEqual(['H1']);
  });
});

describe('leçon 18 : les bonnes formes', () => {
  /** Après le coup noir, une coupe blanche en `c` est-elle impossible, ou aussitôt en atari sans rien prendre ? */
  const coupeProtegee = (r: Position, c: number) => {
    if (r.board[c]) return true;
    const w = play({ ...r, toPlay: 2 }, c);
    return typeof w === 'string' || (libs(w, c).size === 1 && w.captures[2] === r.captures[2]);
  };

  it('l18.1 : le point de coupe est le seul point vide qui touche les deux pierres noires ; Blanc y coupe avec deux libertés', () => {
    const q = step<Touche>('l18', 0);
    const { pos } = fromRows(q.rows);
    const noires = tous.filter(p => pos.board[p] === 1);
    expect(labels(noires)).toEqual(['D4', 'E5']);
    expect(labels(tous.filter(p => !pos.board[p] && noires.every(b => neighbors(N)[p].includes(b))))).toEqual(q.accept);
    const w = ok(play({ ...pos, toPlay: 2 }, at('D5')));
    expect(libs(w, at('D5')).size).toBe(2);
    expect(memeChaine(w, noires)).toBe(false);
  });

  it('l18.2 : bouche du tigre en C5 ; Blanc qui entre en D5 n’a qu’une liberté, D6, et Noir l’y prend', () => {
    const s = step<Info>('l18', 1);
    const im = images(s);
    const apresBlanc = im.find(x => x.derniere === at('D5'))!;
    expect(libs(apresBlanc, at('D5')).size).toBe(1);
    expect(im.find(x => x.compteur?.p === at('D5'))!.compteur!.n).toBe(1);
    expect(labels(im.at(-2)!.libs)).toEqual(['D6']);
    expect(im.at(-1)!.board[at('D5')]).toBe(0);
    // Trois pierres noires autour du point D5 : C5, E5, D4.
    const r = ok(play(fromRows(s.rows).pos, at('C5')));
    expect(neighbors(N)[at('D5')].filter(v => r.board[v] === 1).map(lab).sort()).toEqual(['C5', 'D4', 'E5']);
  });

  it('l18.3 : la bouche du tigre (B7 ou C8) est exactement l’ensemble des coups qui protègent C7 sans le remplir', () => {
    const q = step<Move>('l18', 2);
    const { pos, marked } = fromRows(q.rows);
    const C7 = at('C7');
    const protegent = legaux(pos).filter(p => coupeProtegee(ok(play(pos, p)), C7));
    expect(labels(protegent)).toEqual(['B7', 'C7', 'C8']);
    expect([...q.accept].sort()).toEqual(labels(protegent.filter(p => p !== C7)));
    expect(q.refus![0].points).toEqual(['C7']);
    // Le coup plein relie aussi : il n'est pas faux, il est refusé avec une explication douce.
    expect(memeChaine(ok(play(pos, C7)), marked)).toBe(true);
    expect(q.refus![0].no).toMatch(/^Ça relie/);
    // Sans protection, la coupe tient : deux libertés.
    expect(libs(ok(play({ ...pos, toPlay: 2 }, C7)), C7).size).toBe(2);
  });

  it('l18.4 et l18.5 : un bambou ne se coupe pas ; quel que soit le passage pris par Blanc, l’autre relie tout', () => {
    const s = step<Info>('l18', 3);
    expect(images(s).at(-1)!.board[at('D5')]).toBe(1);
    const fin = ok(play(ok(play({ ...fromRows(s.rows).pos, toPlay: 2 }, at('C5'))), at('D5')));
    expect(memeChaine(fin, tous.filter(p => fin.board[p] === 1))).toBe(true);
    for (const [w, b] of [['C5', 'D5'], ['D5', 'C5']]) {
      const r = ok(play(ok(play({ ...fromRows(s.rows).pos, toPlay: 2 }, at(w))), at(b)));
      expect(memeChaine(r, tous.filter(p => r.board[p] === 1)), w).toBe(true);
    }
    const q = step<Move>('l18', 4);
    const { pos, marked } = fromRows(q.rows);
    expect(legaux(pos).filter(p => memeChaine(ok(play(pos, p)), marked)).map(lab)).toEqual(q.accept);
    // Si Noir joue ailleurs, Blanc prend aussi G5 : les deux moitiés restent séparées.
    const r = ok(play(ok(play(pos, -1)), at('G5')));
    expect(memeChaine(r, marked)).toBe(false);
  });
});

describe('leçon 19 : les pierres qui coupent', () => {
  const E6 = at('E6'), E5 = at('E5');
  /** Après le coup noir : E6 est prise et Blanc ne peut plus y jouer (diamant). */
  const diamant = (r: Position) => r.board[E6] === 0 && play({ ...r, toPlay: 2 }, E6) === 'suicide';

  it('l19.1 et l19.2 : E6 est en atari (E5) ; la prendre fait un diamant où Blanc ne peut plus entrer', () => {
    const s = step<Info>('l19', 0);
    const { pos } = fromRows(s.rows);
    expect(labels(libs(pos, E6))).toEqual(['E5']);
    // Avant la prise, les trois pierres noires autour d'E6 sont trois chaînes séparées.
    expect(new Set(['D6', 'F6', 'E7'].map(l => Math.min(...groupAt(pos.board, N, at(l)).stones))).size).toBe(3);
    const fin = images(s).at(-1)!;
    expect(fin.board[E6]).toBe(0);
    expect(diamant(ok(play(pos, E5)))).toBe(true);
    const s2 = step<Info>('l19', 1);
    expect(images(s2).at(-1)!.interdit).toBe(E6);
    expect(s2.avant).toEqual([{ pose: 'E5', couleur: 'B' }]);
  });

  for (const i of [2, 3]) it(`l19.${i + 1} : deux groupes blancs en atari ; seul E5 prend la pierre qui coupe ; prendre l’autre laisse Blanc s’échapper et couper`, () => {
    const q = step<Move>('l19', i);
    const { pos, marked } = fromRows(q.rows);
    const blancs = [...new Set(tous.filter(p => pos.board[p] === 2).map(p => Math.min(...groupAt(pos.board, N, p).stones)))];
    const enAtari = blancs.filter(b => libs(pos, b).size === 1);
    expect(enAtari).toHaveLength(2);
    expect(legaux(pos).filter(p => diamant(ok(play(pos, p)))).map(lab)).toEqual(q.accept);
    // La queue : prise, elle ne change rien à la coupe. Blanc s'allonge en E5 : 5 libertés, imprenable en 3 coups.
    const queue = enAtari.find(b => !groupAt(pos.board, N, b).stones.includes(E6))!;
    const prise = [...libs(pos, queue)][0];
    expect(q.refus![0].points).toEqual([lab(prise)]);
    const r = ok(play(pos, prise));
    expect(r.captures[1]).toBe(groupAt(pos.board, N, queue).stones.length);
    const w = ok(play(r, E5));
    const coupe = groupAt(w.board, N, E6);
    expect(coupe.liberties.size).toBeGreaterThanOrEqual(5);
    expect(attackerCaptures(w, coupe.stones, 3, SANS_KO)).toBe(false);
    expect(memeChaine(w, marked)).toBe(false);
  });
});

describe('leçon 20 : relier et mourir', () => {
  const E1 = at('E1');

  it('l20.1 : après F1, E1 n’a plus que D1 ; si Blanc relie, toute la chaîne n’a qu’une liberté, C1', () => {
    const s = step<Info>('l20', 0);
    const pos = fromRows(s.rows).pos;
    expect(labels(libs(pos, E1))).toEqual(['D1', 'F1']);
    const b = ok(play(pos, at('F1')));
    expect(labels(libs(b, E1))).toEqual(['D1']);
    const w = ok(play(b, at('D1')));
    expect(labels(libs(w, E1))).toEqual(['C1']);
    expect(groupAt(w.board, N, E1).stones.length).toBe(5);
    const fin = images(s).at(-1)!;
    expect(fin.board).toEqual(w.board);
    expect(fin.compteur).toEqual({ p: at('D1'), n: 1 });
  });

  it('l20.2 : C1 prend les cinq pierres, pour une pierre noire posée', () => {
    const s = step<Info>('l20', 1);
    const fin = images(s).at(-1)!;
    for (const l of ['B2', 'C2', 'D2', 'D1', 'E1']) expect(fin.board[at(l)], l).toBe(0);
    expect(s.text).toContain('cinq pierres pour une');
  });

  it('l20.3 : prendre les pierres marquées en deux coups noirs, c’est exactement C9 ; après F9, Blanc prend en G9', () => {
    const q = step<Move>('l20', 2);
    const { pos, marked } = fromRows(q.rows);
    expect(legaux(pos).filter(p => captureEn(pos, p, marked, 2, SANS_KO)).map(lab)).toEqual(q.accept);
    // Après C9, Blanc qui relie en F9 n'a plus qu'une liberté ; sans relier, il perd ses deux pierres.
    const b = ok(play(pos, at('C9')));
    expect(labels(libs(b, marked[0]))).toEqual(['F9']);
    const w = ok(play(b, at('F9')));
    expect(libs(w, marked[0]).size).toBe(1);
    // L'atari du mauvais côté : la pierre F9 n'a qu'une liberté, G9 ; Blanc la prend et sauve tout.
    const f = ok(play(pos, at('F9')));
    expect(labels(libs(f, at('F9')))).toEqual(['G9']);
    const g = ok(play(f, at('G9')));
    expect(g.board[at('F9')]).toBe(0);
    // Après cette prise, les pierres marquées ont de nouveau deux libertés : l'oiotoshi est perdu, il faut tout recommencer.
    expect(labels(libs(g, marked[0]))).toEqual(['C9', 'F9']);
    expect(captureEn(pos, at('F9'), marked, 2, SANS_KO)).toBe(false);
  });

  it('l20.4 : relier perd cinq pierres, abandonner n’en perd qu’une', () => {
    const q = step<Quiz>('l20', 3);
    const b = ok(play(fromRows(q.rows).pos, at('F1')));
    const relie = ok(play(ok(play(b, at('D1'))), at('C1')));
    expect(relie.captures[1]).toBe(5);
    const abandonne = ok(play(ok(play(b, -1)), at('D1')));
    expect(abandonne.captures[1]).toBe(1);
    expect(q.choices[q.answer]).toBe('Non, il abandonne E1');
    expect(q.ok).toMatch(/cinq pierres/);
  });
});
