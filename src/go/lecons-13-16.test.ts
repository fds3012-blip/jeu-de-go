// Issue #16 : leçons 13 à 16 (le point vital, le seki, finir la partie, compter une partie), prouvées avec src/go.
// Même exigence que les leçons 9 à 12 (src/go/lecons-16.test.ts) : les réponses acceptées sont exactement les coups qui
// atteignent le but, chaque réfutation est rejouée, chaque démonstration montre ce que dit son texte, chaque chiffre
// vient de score() (règle japonaise : territoire + prisonniers, komi à Blanc ; les points d'un seki ne comptent pas).
// Vie et mort : preuve exhaustive de src/go/preuve-vie-mort.ts dans une zone fermée (vérifiée par defautsDeZone). Un
// coup noir hors de la zone y vaut une passe : la passe est essayée par `coupsGagnants`.
import { CHAPITRES, LESSONS, explicationRefus, type LessonStep } from '../content/lessons';
import { imagesDemo, mots, type DemoImage } from '../content/demo';
import { ACQUIS } from '../content/acquis';
import { fromRows } from './position';
import { groupAt, isLegal, neighbors, play, type Position } from './rules';
import { fromLabel, toLabel } from './coords';
import { score } from './score';
import { frontieresOuvertes } from './frontieres';
import { attackerCaptures } from './lecteurs-lot-n';
import { coupsGagnants, defautsDeZone, evaluer, issueApres, yeuxDuGroupe } from './preuve-vie-mort';
import { KOMI_NORMAL } from '../app/equilibrage';

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
/** Position d'une image de démonstration (ou d'un plateau), avec le camp au trait. */
const posDe = (board: Int8Array, toPlay: 1 | 2): Position => ({ size: N, board: board.slice(), toPlay, ko: -1, captures: [0, 0, 0], lastMove: -1 });
const avec = (rows: string[], toPlay: 1 | 2) => fromRows(rows, toPlay).pos;
const zoneDe = (ls: string[]) => ls.map(at);
/** Nombre écrit à la française : « 34,5 ». */
const pts = (n: number) => String(n).replace('.', ',');
const IDS = ['l13', 'l14', 'l15', 'l16'];

describe('leçons 13 à 16 : place dans le programme (#16)', () => {
  it('quatre leçons de 5 à 8 étapes ; l13 et l14 finissent « Vie et mort », l15 et l16 ouvrent « Fin de partie et comptage »', () => {
    for (const id of IDS) {
      expect(lecon(id).steps.length, id).toBeGreaterThanOrEqual(5);
      expect(lecon(id).steps.length, id).toBeLessThanOrEqual(8);
      expect(ACQUIS[id], id).toBeTruthy();
    }
    const c = Object.fromEntries(CHAPITRES.map(x => [x.id, x]));
    expect(c.c4.lecons.map(l => l.id)).toEqual(['l12', 'l13', 'l14']);
    expect(c.c5.titre).toBe('Fin de partie et comptage');
    expect(c.c5.lecons.map(l => l.id)).toEqual(['l15', 'l16']);
    expect([c.c4.complet, c.c5.complet]).toEqual([false, false]);
  });
  it('chaque consigne tient en 12 mots ; chaque geste « pose » est sur le point vert', () => {
    for (const id of IDS) lecon(id).steps.forEach((s, i) => {
      expect(mots(s.text), `${id}.${i + 1}`).toBeLessThanOrEqual(12);
      if (s.kind === 'info' && s.geste && 'pose' in s.geste) expect(s.text).toContain('point vert');
    });
  });
  it('vocabulaire expliqué à sa première apparition : point vital, seki (vie commune), dame (point neutre), pierre morte', () => {
    expect(step<Info>('l13', 1).text).toMatch(/point vital/);
    expect(step<Info>('l14', 0).text).toMatch(/^Seki \(vie commune\)/);
    expect(step<Info>('l15', 0).text).toMatch(/^Dame \(point neutre\)/);
    expect(step<Info>('l15', 3).text).toMatch(/^Pierre morte : elle ne peut plus vivre/);
    // « Point vital » est défini à la leçon 5 ; « seki » et « dame » n'apparaissent dans aucune leçon avant.
    const avant = LESSONS.slice(0, LESSONS.findIndex(l => l.id === 'l13'))
      .flatMap(l => l.steps.flatMap(s => [s.text, 'ok' in s ? s.ok : '', 'no' in s ? s.no : ''])).join(' ');
    expect(avant).toContain('Point vital (celui qui décide)');
    expect(avant).not.toMatch(/\bseki\b|\bdame\b/i);
  });
  it('chaque coup refusé avec une explication est légal et n’est pas une réponse acceptée', () => {
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

describe('leçon 13 : le point vital', () => {
  const trois = zoneDe(['C1', 'D1', 'E1']);
  const B2 = at('B2');

  it('l13.1 : trois points en ligne ; Noir au milieu vit (deux vrais yeux C1 et E1), et c’est son seul coup qui vit', () => {
    const s = step<Info>('l13', 0);
    const pos = avec(s.rows, 1);
    expect(defautsDeZone(pos, B2, trois)).toEqual([]);
    expect(coupsGagnants(pos, B2, trois, 'vivre').map(lab)).toEqual(['D1']);
    const fin = images(s).at(-1)!;
    expect(labels(fin.yeux)).toEqual(['C1', 'E1']);
    const r = posDe(fin.board, 2);
    expect(yeuxDuGroupe(r, B2).map(e => `${lab(e.point)} ${e.vrai}`).sort()).toEqual(['C1 true', 'E1 true']);
  });

  it('l13.2 : on touche le milieu ; si Blanc le prend, le groupe noir meurt même si Noir joue ensuite, sans ko', () => {
    const s = step<Info>('l13', 1);
    expect((s.geste as { touche: string[] }).touche).toEqual(['D1']);
    const fin = images(s).at(-1)!;
    expect(fin.board[at('D1')]).toBe(2);
    expect(evaluer(posDe(fin.board, 1), B2, trois)).toBe(-1);
    expect(coupsGagnants(avec(s.rows, 2), B2, trois, 'tuer').map(lab)).toEqual(['D1']);
  });

  it('l13.3 : tuer le groupe blanc, c’est exactement D9 ; C9 et E9 le laissent vivre', () => {
    const q = step<Move>('l13', 2);
    const { pos, marked } = fromRows(q.rows);
    const zone = zoneDe(['C9', 'D9', 'E9']);
    expect(defautsDeZone(pos, marked[0], zone)).toEqual([]);
    expect(coupsGagnants(pos, marked[0], zone, 'tuer').map(lab)).toEqual(q.accept);
    for (const l of q.refus![0].points) expect(issueApres(pos, at(l), marked[0], zone), l).toBe(1);
  });

  it('l13.4 : faire vivre le groupe noir, c’est exactement J3 (deux vrais yeux J4 et J2) ; J4 et J2 le tuent', () => {
    const q = step<Move>('l13', 3);
    const { pos, marked } = fromRows(q.rows);
    const zone = zoneDe(['J4', 'J3', 'J2']);
    expect(defautsDeZone(pos, marked[0], zone)).toEqual([]);
    expect(coupsGagnants(pos, marked[0], zone, 'vivre').map(lab)).toEqual(q.accept);
    for (const l of q.refus![0].points) expect(issueApres(pos, at(l), marked[0], zone), l).toBe(-1);
    const r = ok(play(pos, at('J3')));
    expect(yeuxDuGroupe(r, marked[0]).map(e => `${lab(e.point)} ${e.vrai}`).sort()).toEqual(['J2 true', 'J4 true']);
    expect(q.ok).toContain('J4 et J2');
  });

  it('l13.5 : quatre en ligne vivent même si Blanc entre le premier ; après D1 blanc, E1 noir vit', () => {
    const s = step<Info>('l13', 4);
    const zone = zoneDe(['C1', 'D1', 'E1', 'F1']);
    const pos = avec(s.rows, 2);
    expect(defautsDeZone(pos, B2, zone)).toEqual([]);
    expect(evaluer(pos, B2, zone)).toBe(1);
    const im = images(s);
    const apresE1 = im.find(x => x.derniere === at('E1'))!;
    expect(evaluer(posDe(apresE1.board, 2), B2, zone)).toBe(1);
    expect(im.at(-1)!.compteur).toEqual({ p: at('D1'), n: 1 });
  });

  it('l13.6 : deux points ne vivent jamais, que Noir ou Blanc joue le premier', () => {
    const q = step<Quiz>('l13', 5);
    const { marked } = fromRows(q.rows);
    const zone = zoneDe(['F1', 'G1']);
    expect(defautsDeZone(avec(q.rows, 1), marked[0], zone)).toEqual([]);
    expect(evaluer(avec(q.rows, 1), marked[0], zone)).toBe(-1);
    expect(evaluer(avec(q.rows, 2), marked[0], zone)).toBe(-1);
    expect(q.choices[q.answer]).toBe('Non, jamais');
  });
});

describe('leçon 14 : le seki (vie commune)', () => {
  const s1 = step<Info>('l14', 0);
  // Preuve depuis le groupe blanc : sa zone (les deux libertés et les pierres noires du dedans) est fermée.
  const W = at('B2'), noirDedans = at('C2');
  const zoneBlanc = zoneDe(['C1', 'E1', 'C2', 'D2', 'E2']);

  it('l14.1 : aucun œil ; la chaîne noire, la chaîne blanche et la pierre D1 partagent exactement C1 et E1', () => {
    const { pos } = fromRows(s1.rows);
    for (const p of [noirDedans, W, at('D1')]) expect(labels(libs(pos, p)), lab(p)).toEqual(['C1', 'E1']);
    expect(yeuxDuGroupe(pos, W)).toEqual([]);
    expect(yeuxDuGroupe(pos, noirDedans)).toEqual([]);
    expect([...(s1.geste as { touche: string[] }).touche].sort()).toEqual(['C1', 'E1']);
    const im = images(s1);
    // Le compteur monte une liberté à la fois : il s'arrête à 2 pour la chaîne noire, puis à 2 pour la blanche.
    const fins = im.filter((x, k) => x.compteur && (k === im.length - 1 || im[k + 1].compteur?.p !== x.compteur.p || im[k + 1].compteur!.n < x.compteur.n));
    expect(fins.map(x => [lab(x.compteur!.p), x.compteur!.n])).toEqual([['C2', 2], ['B2', 2]]);
  });

  it('l14.1 : c’est un seki : zone fermée, et ni Noir ni Blanc ne gagne en jouant le premier (deux passes : non résolu)', () => {
    for (const c of [1, 2] as const) {
      const pos = avec(s1.rows, c);
      expect(defautsDeZone(pos, W, zoneBlanc)).toEqual([]);
      expect(evaluer(pos, W, zoneBlanc)).toBe(0);
    }
    // Celui qui remplit une liberté partagée perd : Noir en C1 ou E1 laisse vivre Blanc, Blanc en C1 ou E1 meurt.
    for (const l of ['C1', 'E1']) {
      expect(issueApres(avec(s1.rows, 1), at(l), W, zoneBlanc), `Noir ${l}`).toBe(1);
      expect(issueApres(avec(s1.rows, 2), at(l), W, zoneBlanc), `Blanc ${l}`).toBe(-1);
    }
  });

  it('l14.2 : Noir remplit C1, se met en atari (une liberté, E1) ; Blanc prend les quatre pierres en E1', () => {
    const s = step<Info>('l14', 1);
    const r = ok(play(avec(s.rows, 1), at('C1')));
    expect(labels(libs(r, noirDedans))).toEqual(['E1']);
    const w = ok(play(r, at('E1')));
    expect(w.captures[2]).toBe(4);
    expect(images(s).at(-1)!.board).toEqual(w.board);
    expect(s.text).toContain('atari');
  });

  it('l14.3 : si Blanc remplit C1, Noir prend tout le groupe blanc en E1', () => {
    const s = step<Info>('l14', 2);
    const w = ok(play(avec(s.rows, 2), at('C1')));
    expect(libs(w, W).size).toBe(1);
    const b = ok(play(w, at('E1')));
    expect(b.board[W]).toBe(0);
    expect(b.captures[1]).toBe(groupAt(w.board, N, W).stones.length);
    expect(images(s).at(-1)!.board).toEqual(b.board);
  });

  it('l14.4 : au comptage, C1 et E1 ne sont à personne ; le moteur voit le seki (règle japonaise et chinoise)', () => {
    const q = step<Quiz>('l14', 3);
    const { pos } = fromRows(q.rows);
    for (const regle of ['japanese', 'chinese'] as const) {
      const s = score(pos, 0, regle);
      expect(s.owner[at('C1')], regle).toBe(0);
      expect(s.owner[at('E1')], regle).toBe(0);
      expect(s.seki).toContain(noirDedans);
      expect(s.seki).toContain(W);
    }
    expect(q.choices[q.answer]).toBe('À personne');
  });

  it('l14.5 : E2 est le seul coup qui sauve les pierres noires, par un seki (C1, E1 et la passe laissent Blanc les prendre)', () => {
    const q = step<Move>('l14', 4);
    const pos = avec(q.rows, 1);
    expect(defautsDeZone(pos, W, zoneBlanc)).toEqual([]);
    // Blanc vit (+1) dès que Noir ne joue pas E2 ; après E2, personne ne gagne : seki.
    const issues = [...zoneBlanc.filter(z => pos.board[z] === 0), -1].map(m => [lab(m), issueApres(pos, m, W, zoneBlanc)]);
    expect(issues.filter(([, v]) => v !== 1).map(([m]) => m)).toEqual(q.accept);
    expect(issueApres(pos, at('E2'), W, zoneBlanc)).toBe(0);
    // Après E2, c'est exactement la position de l'étape 1.
    expect(ok(play(pos, at('E2'))).board).toEqual(fromRows(s1.rows).pos.board);
    // Réfutations : chaque coup se met en atari, et Blanc prend les pierres marquées.
    const { marked } = fromRows(q.rows);
    for (const l of q.refus![0].points) {
      const r = ok(play(pos, at(l)));
      expect(libs(r, at(l)).size, l).toBe(1);
      expect(attackerCaptures(r, marked, 2), l).toBe(true);
    }
  });
});

describe('leçon 15 : finir la partie', () => {
  const P = step<Info>('l15', 0).rows;
  const B2 = at('B2');
  const morte = new Set([B2]);

  it('l15.1 : avec B2 morte, le seul point encore ouvert est la dame E7, qui touche Noir et Blanc', () => {
    const { pos } = fromRows(P);
    expect(frontieresOuvertes(pos.board, N, morte).map(lab)).toEqual(['E7']);
    const couleurs = new Set(neighbors(N)[at('E7')].map(q => pos.board[q]));
    expect([...couleurs].sort()).toEqual([1, 2]);
    expect(images(step<Info>('l15', 0)).at(-1)!.yeux).toEqual([at('E7')]);
  });

  it('l15.2 : remplir la dame ne change aucun score, qui que ce soit qui la remplisse', () => {
    const { pos } = fromRows(P);
    const avant = score(pos, KOMI_NORMAL, 'japanese', morte);
    for (const c of [1, 2] as const) {
      const r = ok(play({ ...pos, toPlay: c }, at('E7')));
      const apres = score(r, KOMI_NORMAL, 'japanese', morte);
      expect([apres.black, apres.white], `couleur ${c}`).toEqual([avant.black, avant.white]);
    }
  });

  it('l15.3 : fermer en E8 garde 26 points, le plus possible ; D8 ferme aussi, mais un point de moins', () => {
    const q = step<Move>('l15', 2);
    const { pos } = fromRows(q.rows);
    const t = (p: Position) => score(p, 0, 'japanese', morte).territory[1];
    expect(t(pos)).toBe(score(pos, 0, 'japanese', morte).territory[1]);
    const parCoup = new Map<string, number>();
    for (let p = 0; p < N * N; p++) { const r = play(pos, p); if (typeof r !== 'string') parCoup.set(lab(p), t(r)); }
    const max = Math.max(...parCoup.values());
    expect(max).toBe(26);
    expect([...parCoup].filter(([, v]) => v === max).map(([k]) => k)).toEqual(q.accept);
    expect(parCoup.get('D8')).toBe(max - 1);
    // Fermée en E8 : il ne reste que la dame ; fermée en D8 aussi (E8 devient un point neutre).
    expect(frontieresOuvertes(ok(play(pos, at('E8'))).board, N, morte).map(lab)).toEqual(['E7']);
    expect(labels(frontieresOuvertes(ok(play(pos, at('D8'))).board, N, morte))).toEqual(['E7', 'E8']);
    // Avec E8, on retrouve la position de fin de l'étape 1.
    expect(ok(play(pos, at('E8'))).board).toEqual(fromRows(P).pos.board);
  });

  it('l15.4 : B2 est morte, même si Blanc joue le premier, sans ko (zone fermée A1, A2, B1)', () => {
    const zone = zoneDe(['A1', 'A2', 'B1']);
    for (const c of [1, 2] as const) {
      const pos = avec(P, c);
      expect(defautsDeZone(pos, B2, zone)).toEqual([]);
      expect(evaluer(pos, B2, zone)).toBe(-1);
    }
    expect((step<Info>('l15', 3).geste as { touche: string[] }).touche).toEqual(['B2']);
    expect(images(step<Info>('l15', 3)).at(-1)!.compteur).toEqual({ p: B2, n: 2 });
  });

  it('l15.5 : capturer B2 coûte deux points (A2 puis B1, Blanc passe) : 25 au lieu de 27', () => {
    const q = step<Quiz>('l15', 4);
    const { pos } = fromRows(q.rows);
    const sansJouer = score(pos, 0, 'japanese', morte).black;
    const r = ok(play(ok(play(ok(play(pos, at('A2'))), -1)), at('B1')));
    expect(r.board[B2]).toBe(0);
    const apres = score(r, 0, 'japanese').black;
    expect([sansJouer, apres]).toEqual([27, 25]);
    expect(q.choices[q.answer]).toBe('Non, je passe');
    expect(q.no).toContain('un point');
  });

  it('l15.6 : B2 retirée, Noir a 26 de territoire + 1 prisonnier = 27, comme le moteur avec B2 morte', () => {
    const q = step<Quiz>('l15', 5);
    const c = q.compte!;
    const s = score({ ...fromRows(q.rows).pos, captures: [0, c.prises![0], c.prises![1]] }, c.komi, 'japanese');
    expect(s.territory[1]).toBe(26);
    expect(q.choices[q.answer]).toBe(pts(s.black));
    expect(s.black).toBe(score(fromRows(P).pos, c.komi, 'japanese', morte).black);
    expect(q.ok).toBe(`${s.territory[1]} de territoire + 1 prisonnier = ${s.black}.`);
    expect(q.terr).toBe(true);
  });
});

describe('leçon 16 : compter une partie', () => {
  const P = step<Info>('l16', 0).rows;
  const mortes = new Set([at('B2'), at('H8')]);

  it('l16.1 et l16.2 : H8 (noire) et B2 (blanche) sont mortes, quel que soit le camp au trait, sans ko', () => {
    for (const [c, z] of [['H8', ['H9', 'J9', 'J8']], ['B2', ['A1', 'A2', 'B1']]] as const) {
      for (const t of [1, 2] as const) {
        const pos = avec(P, t);
        expect(defautsDeZone(pos, at(c), zoneDe([...z]))).toEqual([]);
        expect(evaluer(pos, at(c), zoneDe([...z])), `${c}, trait ${t}`).toBe(-1);
      }
    }
    const s1 = step<Info>('l16', 0);
    expect((s1.geste as { touche: string[] }).touche).toEqual(['H8']);
    expect(fromRows(P).pos.board[at('H8')]).toBe(1);
    const q = step<Touche>('l16', 1);
    expect(q.accept).toEqual(['B2']);
    expect(fromRows(q.rows).pos.board[at('B2')]).toBe(2);
    // Mortes retirées, il ne reste qu'un point ouvert : la dame E5.
    expect(frontieresOuvertes(fromRows(P).pos.board, N, mortes).map(lab)).toEqual(['E5']);
  });

  it('l16.3 : mortes retirées, 26 points de territoire chacun, colorés par la démonstration', () => {
    const s = step<Info>('l16', 2);
    const sc = score(fromRows(s.rows).pos, 0, 'japanese');
    expect([sc.territory[1], sc.territory[2]]).toEqual([26, 26]);
    const im = images(s);
    expect(im.at(-2)!.terr).toMatchObject({ couleur: 1 });
    expect(im.at(-2)!.terr!.points).toHaveLength(26);
    expect(im.at(-1)!.terr!.points).toHaveLength(26);
    expect(s.text).toContain('26 points chacun');
    // Retirer les mortes du plateau donne le même compte que les marquer mortes.
    const marque = score(fromRows(P).pos, 0, 'japanese', mortes);
    expect([marque.territory[1], marque.territory[2]]).toEqual([26, 26]);
  });

  for (const i of [3, 4]) it(`l16.${i + 1} : la bonne réponse est le score du moteur ; les erreurs courantes sont les autres choix`, () => {
    const q = step<Quiz>('l16', i);
    const c = q.compte!;
    expect(c.komi).toBe(KOMI_NORMAL);
    const s = score({ ...fromRows(q.rows).pos, captures: [0, c.prises![0], c.prises![1]] }, c.komi, 'japanese');
    expect(q.choices[q.answer]).toBe(pts(c.pour === 'B' ? s.black : s.white));
    expect(new Set(q.choices).size).toBe(3);
    // Le compte des prisonniers : ceux de la partie, plus la morte prise chez l'autre.
    expect(q.text).toContain(c.pour === 'B' ? `${c.prises![0] - 1} prisonniers, plus la morte` : `${c.prises![1] - 1} prisonnier, plus la morte`);
    // Erreurs courantes : Noir oublie la morte (33) ou prend le komi (40,5) ; Blanc oublie le komi (28) ou les prisonniers (32,5).
    if (c.pour === 'B') expect(q.choices).toEqual([pts(s.black - 1), pts(s.black), pts(s.black + c.komi)]);
    else expect(q.choices).toEqual([pts(s.white - c.komi), pts(s.territory[2] + c.komi), pts(s.white)]);
  });

  it('l16.6 : Noir 34, Blanc 34,5 : Blanc gagne d’un demi-point', () => {
    const q = step<Quiz>('l16', 5);
    const c = step<Quiz>('l16', 3).compte!;
    const s = score({ ...fromRows(q.rows).pos, captures: [0, c.prises![0], c.prises![1]] }, c.komi, 'japanese');
    expect([s.black, s.white, s.winner, s.margin]).toEqual([34, 34.5, 2, 0.5]);
    expect(q.text).toContain(`Noir ${s.black}, Blanc ${pts(s.white)}`);
    expect(q.choices[q.answer]).toBe('Blanc');
    expect(q.ok).toMatch(/demi-point/);
    expect(step<Quiz>('l16', 3).ok).toBe('26 + 7 + 1 = 34.');
    expect(step<Quiz>('l16', 4).ok).toBe('26 + 1 + 1 + 6,5 = 34,5.');
  });
});
