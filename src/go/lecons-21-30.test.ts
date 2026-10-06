// Issue #16 (palier suivant, leçons 21 à 30) : chaque position prouvée par le moteur de src/go.
// Même exigence que les leçons 17 à 20 (src/go/lecons-17-20.test.ts) : les réponses acceptées sont exactement les coups qui
// atteignent le but, chaque réfutation est rejouée, chaque démonstration montre ce que dit son texte, chaque chiffre est
// recompté.
// - Captures (manque de libertés, course avec un œil) : lecteur exact de src/go/lecteurs-lot-n.ts, sans ko (SANS_KO) : aucune réponse ne
//   dépend d'un ko.
// - Vie et mort (agrandir ou réduire) : preuve exhaustive de src/go/preuve-vie-mort.ts dans une zone fermée (vérifiée par
//   defautsDeZone ; un ko n'est jamais compté comme une preuve).
// - Fin de partie (sente et gote, hane au premier rang) : minimax exact de src/go/preuve-fin-de-partie.ts sur les endroits
//   encore ouverts (les régions vides qui touchent les deux couleurs), puis score() en règle japonaise sur la suite prouvée.
import { CHAPITRES, LESSONS, explicationRefus, type LessonStep } from '../content/lessons';
import { imagesDemo, mots } from '../content/demo';
import { ACQUIS } from '../content/acquis';
import { THEMES_DE_LECON } from '../content/themes';
import { fromRows } from './position';
import { groupAt, isLegal, neighbors, play, type Position } from './rules';
import { fromLabel, toLabel } from './coords';
import { score } from './score';
import { AVEC_KO, SANS_KO, attackerCaptures, captureEn, defenderFails, sauveEn } from './lecteurs-lot-n';
import { meilleursCoups, valeurExacte, valeursDesCoups } from './preuve-fin-de-partie';
import { coupsGagnants, defautsDeZone, evaluer, issueApres, yeuxDuGroupe } from './preuve-vie-mort';

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
const japonais = (pos: Position) => { const s = score(pos, 0, 'japanese'); return { noir: s.black, blanc: s.white }; };

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

/** Délai des tests de minimax (fin de partie) : quelques secondes, davantage sur un processeur chargé. */
const LENT = 60_000;
const IDS = ['l21', 'l22', 'l23', 'l24', 'l25', 'l26'];
const zoneDe = (ls: string) => ls.split(' ').map(at);

describe('leçons 21 à 30 : place dans le programme (#16)', () => {
  it('chaque leçon a 4 à 6 étapes, sa phrase de fin et sa série de pratique', () => {
    for (const id of IDS) {
      expect(lecon(id).steps.length, id).toBeGreaterThanOrEqual(4);
      expect(lecon(id).steps.length, id).toBeLessThanOrEqual(6);
      expect(ACQUIS[id], id).toBeTruthy();
      expect(THEMES_DE_LECON[id]?.length, id).toBeGreaterThan(0);
    }
  });
  it('sente et gote, puis le hane, prolongent « Fin de partie et comptage »', () => {
    const c = Object.fromEntries(CHAPITRES.map(x => [x.id, x]));
    expect(c.c6.lecons.map(l => l.id)).toEqual(['l18', 'l19', 'l20', 'l21']);
    expect(c.c3.lecons.map(l => l.id)).toEqual(['l9', 'l10', 'l11', 'l26']);
    expect(c.c4.lecons.map(l => l.id)).toEqual(['l12', 'l13', 'l14', 'l17', 'l24', 'l25']);
    expect(c.c5.lecons.map(l => l.id)).toEqual(['l15', 'l16', 'l22', 'l23']);
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
    expect(step<Info>('l21', 1).text).toMatch(/^Manque de libertés : relier le met en atari/);
    expect(step<Info>('l22', 0).text).toMatch(/^Sente \(coup qui oblige à répondre\)/);
    expect(step<Info>('l22', 2).text).toMatch(/^Gote \(coup qui ne menace rien\)/);
    expect(step<Info>('l23', 0).text).toMatch(/^Hane \(coup qui contourne une pierre\)/);
    const avant = (id: string) => LESSONS.slice(0, LESSONS.findIndex(l => l.id === id))
      .flatMap(l => l.steps.flatMap(s => [s.text, 'ok' in s ? s.ok : '', 'no' in s ? s.no : ''])).join(' ');
    expect(avant('l22')).not.toMatch(/\bsente\b|\bgote\b/i);
    expect(avant('l23')).not.toMatch(/\bhane\b/i);
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

describe('leçon 21 : le manque de libertés', () => {
  /** Chaînes blanches de la position (une pierre de chacune). */
  const chaines = (pos: Position) => [...new Set(tous.filter(p => pos.board[p] === 2).map(p => Math.min(...groupAt(pos.board, N, p).stones)))];
  const libsDe = (pos: Position, p: number) => groupAt(pos.board, N, p).liberties;

  it('l21.1 : deux chaînes blanches reliées seulement par A2 ou B1 ; leur seule liberté extérieure est E1', () => {
    const s = step<Info>('l21', 0);
    const pos = avec(s.rows, 1);
    expect(chaines(pos).map(lab).sort()).toEqual(['A1', 'B2']);
    expect(labels(libsDe(pos, at('A1')))).toEqual(['A2', 'B1']);
    expect(labels(libsDe(pos, at('C1')))).toEqual(['A2', 'B1', 'E1']);
    const r = ok(play(pos, at('E1')));
    expect(labels(libsDe(r, at('C1')))).toEqual(['A2', 'B1']);
    expect(labels(images(s).at(-1)!.libs)).toEqual(['A2', 'B1']);
    // Sans E1, relier en B1 laisse deux libertés (A2 et E1) : c'est E1 qui crée le manque de libertés.
    expect(labels(libsDe(suite(pos, ['passe', 'B1']), at('B1')))).toEqual(['A2', 'E1']);
  });

  it('l21.2 et l21.3 : après E1, relier en A2 ou en B1 laisse une seule liberté ; Noir prend alors les six pierres', () => {
    const r = ok(play(avec(step<Info>('l21', 1).rows, 1), at('E1')));
    expect(fromRows(step<Quiz>('l21', 2).rows).pos.board).toEqual(r.board);
    for (const [relie, prise] of [['B1', 'A2'], ['A2', 'B1']]) {
      const w = ok(play(r, at(relie)));
      expect(labels(libsDe(w, at(relie))), relie).toEqual([prise]);
      expect(ok(play(w, at(prise))).captures[1], relie).toBe(6);
    }
    const q = step<Quiz>('l21', 2);
    expect(q.choices[q.answer]).toBe(String(libsDe(ok(play(r, at('A2'))), at('A2')).size));
    const im = images(step<Info>('l21', 1));
    expect(labels(im.find(x => x.atari.length)!.atari)).toEqual(['A1', 'B1', 'B2', 'C1', 'C2', 'D1']);
    expect(im.at(-1)!.board[at('C1')]).toBe(0);
  });

  for (const i of [0, 3]) it(`l21.${i + 1} : prendre tout le blanc en trois coups noirs, c’est exactement E1 ; ensuite chaque connexion met Blanc en atari`, () => {
    const rows = lecon('l21').steps[i].rows;
    const pos = avec(rows, 1);
    const cibles = chaines(pos);
    expect(cibles).toHaveLength(2);
    const prend = tous.filter(p => isLegal(pos, p) && captureEn(pos, p, cibles, 3, SANS_KO));
    expect(prend.map(lab)).toEqual(['E1']);
    if (i === 3) expect(step<Move>('l21', 3).accept).toEqual(prend.map(lab));
    // Aucun coup ne prend en deux coups : il faut d'abord boucher la liberté extérieure.
    expect(tous.filter(p => isLegal(pos, p) && captureEn(pos, p, cibles, 2, SANS_KO))).toEqual([]);
    const r = ok(play(pos, at('E1')));
    const communs = [...libsDe(r, cibles[0])];
    expect(communs).toHaveLength(2);
    expect(labels(libsDe(r, cibles[1]))).toEqual(labels(communs));
    for (const c of communs) {
      const w = ok(play(r, c));
      expect(libsDe(w, c).size, lab(c)).toBe(1);
      expect(cibles.every(x => groupAt(w.board, N, c).stones.includes(x)), lab(c)).toBe(true);
    }
  });
});

describe('leçon 22 : sente et gote', () => {
  const S = step<Info>('l22', 0).rows;
  const zone = ouverts(avec(S, 1));

  it('la partie est finie sauf deux endroits : E9-F9 en haut, E2-F2-F1 en bas', () => {
    expect(labels(zone)).toEqual(['E2', 'E9', 'F1', 'F2', 'F9']);
  }, LENT);

  it('l22.1 : l’atari E2 est le meilleur coup ; Blanc doit relier en F1, sinon il perd deux pierres et au moins 3 points', () => {
    const pos = avec(S, 1);
    for (const regle of ['japanese', 'chinese'] as const) expect(meilleursCoups(pos, zone, { regle }).map(lab), regle).toEqual(['E2']);
    const r = ok(play(pos, at('E2')));
    expect(labels(groupAt(r.board, N, at('E1')).liberties)).toEqual(['F1']);
    const v = valeursDesCoups(r, zone);
    expect(meilleursCoups(r, zone).map(lab)).toEqual(['F1']);
    for (const [m, x] of v) if (m !== at('F1')) expect(x - v.get(at('F1'))!, lab(m)).toBeGreaterThanOrEqual(3);
    // Si Blanc joue ailleurs, F1 prend D1 et E1.
    expect(captureEn(ok(play(r, -1)), at('F1'), [at('E1')], 1, SANS_KO)).toBe(true);
    const im = images(step<Info>('l22', 0));
    expect(labels(im.find(x => x.atari.length)!.atari)).toEqual(['D1', 'E1']);
    expect(im.at(-1)!.board[at('F1')]).toBe(2);
  }, LENT);

  it('l22.2 : après l’échange, Noir a encore la main, et fermer le haut en E9 est son meilleur coup', () => {
    const r = suite(avec(S, 1), ['E2', 'F1']);
    expect(r.toPlay).toBe(1);
    expect(meilleursCoups(r, zone).map(lab)).toEqual(['E9']);
    expect(step<Info>('l22', 1).avant).toEqual([{ pose: 'E2', couleur: 'B' }, { pose: 'F1', couleur: 'W' }]);
  }, LENT);

  it('l22.3 : E9 ne menace rien ; Blanc répond ailleurs, en E2, et E9 d’abord coûte deux points', () => {
    const pos = avec(S, 1);
    const r = ok(play(pos, at('E9')));
    expect(meilleursCoups(r, zone).map(lab)).toEqual(['E2']);
    for (const regle of ['japanese', 'chinese'] as const) {
      const v = valeursDesCoups(pos, zone, { regle });
      expect(v.get(at('E2'))! - v.get(at('E9'))!, regle).toBe(2);
    }
    expect(images(step<Info>('l22', 2)).at(-1)!.board[at('E2')]).toBe(2);
  }, LENT);

  it('l22.4 et l22.5 : en miroir, E1 est gote (Blanc joue ailleurs) ; seul E8 est le meilleur coup ; E1 d’abord perd deux points', () => {
    const q = step<Quiz>('l22', 3), m = step<Move>('l22', 4);
    expect(q.rows).toEqual([...S].reverse());
    expect(m.rows).toEqual(q.rows);
    const pos = avec(m.rows, 1);
    const z = ouverts(pos);
    expect(meilleursCoups(ok(play(pos, at('E1'))), z).map(lab)).toEqual(['E8']);
    expect(q.choices[q.answer]).toBe('Gote');
    expect(meilleursCoups(pos, z).map(lab)).toEqual(m.accept);
    const v = valeursDesCoups(pos, z);
    expect(v.get(at('E8'))! - v.get(at('E1'))!).toBe(2);
    expect(m.refus![0].no).toMatch(/Deux points de moins/);
    // Sente : après E8, la seule bonne réponse de Blanc est de relier en F9 ; puis Noir ferme le bas en E1.
    expect(meilleursCoups(ok(play(pos, at('E8'))), z).map(lab)).toEqual(['F9']);
    expect(meilleursCoups(suite(pos, ['E8', 'F9']), z).map(lab)).toEqual(['E1']);
  }, LENT);
});

describe('leçon 23 : le hane au premier rang', () => {
  const H = step<Info>('l23', 0).rows;
  const surfaces = { regle: 'chinese' as const };

  it('seule la première ligne reste à jouer ; le hane E1 est le seul meilleur coup de Noir, D1 celui de Blanc', () => {
    const pos = avec(H, 1);
    const zone = ouverts(pos);
    expect(labels(zone)).toEqual(['A1', 'B1', 'C1', 'D1', 'E1', 'F1']);
    // Compte par surfaces : une pierre posée chez l'adversaire y est prise sans rien coûter (src/go/preuve-fin-de-partie.ts).
    expect(meilleursCoups(pos, zone, surfaces).map(lab)).toEqual(['E1']);
    expect(meilleursCoups(avec(H, 2), zone, surfaces).map(lab)).toEqual(['D1']);
    // Les deux suites de la leçon atteignent ces valeurs : ce sont des suites optimales.
    const noir = suite(pos, ['E1', 'F1', 'D1']), blanc = suite(avec(H, 2), ['D1', 'C1', 'E1']);
    expect(valeurExacte(noir, zone, surfaces)).toBe(valeurExacte(pos, zone, surfaces));
    expect(valeurExacte(blanc, zone, surfaces)).toBe(valeurExacte(avec(H, 2), zone, surfaces));
    expect(images(step<Info>('l23', 0)).at(-1)!.board).toEqual(noir.board);
  }, LENT);

  it('l23.2 : après le blocage F1, E1 est en atari ; seul D1 la sauve, et Blanc finit avec un point de moins qu’après un simple blocage', () => {
    const q = step<Move>('l23', 1);
    const pos = avec(q.rows, 1);
    expect(fromRows(q.rows).pos.board).toEqual(suite(avec(H, 1), ['E1', 'F1']).board);
    expect(labels(groupAt(pos.board, N, at('E1')).liberties)).toEqual(['D1']);
    // Ko compris : C1 laisse Blanc prendre E1 en D1 (un ko), ce n'est pas un sauvetage.
    expect(tous.filter(p => isLegal(pos, p) && sauveEn(pos, p, [at('E1')], 2, AVEC_KO)).map(lab)).toEqual(q.accept);
    const c1 = suite(pos, ['C1', 'D1']);
    expect(c1.board[at('E1')]).toBe(0);
    expect(c1.ko).toBe(at('E1'));
    // Simple blocage : Noir D1, Blanc ferme en E1. Avec le hane, Blanc a un point de moins, Noir autant.
    const hane = japonais(ok(play(pos, at('D1')))), bloc = japonais(suite(avec(H, 1), ['D1', 'E1']));
    expect(hane.blanc).toBe(bloc.blanc - 1);
    expect(hane.noir).toBe(bloc.noir);
  }, LENT);

  it('l23.3 : entre le hane de Noir et celui de Blanc, deux points d’écart (règle japonaise)', () => {
    const q = step<Quiz>('l23', 2);
    const noir = japonais(suite(avec(H, 1), ['E1', 'F1', 'D1'])), blanc = japonais(suite(avec(H, 2), ['D1', 'C1', 'E1']));
    expect(noir.noir - blanc.noir).toBe(1);
    expect(blanc.blanc - noir.blanc).toBe(1);
    expect(q.choices[q.answer]).toBe(String((noir.noir - noir.blanc) - (blanc.noir - blanc.blanc)));
  }, LENT);

  it('l23.4 : en miroir, E1 est le seul meilleur coup ; bloquer en F1 donne un point de moins', () => {
    const q = step<Move>('l23', 3);
    const pos = avec(q.rows, 1);
    const zone = ouverts(pos);
    expect(labels(zone)).toEqual(['D1', 'E1', 'F1', 'G1', 'H1', 'J1']);
    expect(meilleursCoups(pos, zone, surfaces).map(lab)).toEqual(q.accept);
    const v = valeursDesCoups(pos, zone, surfaces);
    expect(v.get(at('F1'))!).toBeLessThan(v.get(at('E1'))!);
    const hane = japonais(suite(pos, ['E1', 'D1', 'F1'])), bloc = japonais(suite(pos, ['F1', 'E1']));
    // « Blanc recule d'un point » : Blanc a un point de moins, Noir autant.
    expect(hane.blanc).toBe(bloc.blanc - 1);
    expect(hane.noir).toBe(bloc.noir);
    expect(valeurExacte(suite(pos, ['E1', 'D1', 'F1']), zone, surfaces)).toBe(valeurExacte(pos, zone, surfaces));
  }, LENT);
});

describe('leçon 24 : agrandir ou réduire', () => {
  const ZONE = zoneDe('A2 B2 C2 D2 E2 F2 G2 A1 B1 C1 D1 E1 F1 G1');
  const A2 = at('A2');

  it('l24.1 : E1, au bord de l’espace, est le seul coup qui vit ; ensuite A1-B1 et D1 font deux yeux', () => {
    const s = step<Info>('l24', 0);
    const pos = avec(s.rows, 1);
    expect(defautsDeZone(pos, A2, ZONE)).toEqual([]);
    expect(coupsGagnants(pos, A2, ZONE, 'vivre').map(lab)).toEqual(['E1']);
    const r = ok(play(pos, at('E1')));
    expect(evaluer(r, A2, ZONE)).toBe(1);
    expect(labels(images(s).at(-1)!.yeux)).toEqual(['A1', 'B1', 'D1']);
    // D1 est un œil (tous ses voisins noirs) ; A1-B1 est un espace fermé de deux points.
    expect(neighbors(N)[at('D1')].every(v => r.board[v] === 1)).toBe(true);
    for (const l of ['A1', 'B1']) expect(neighbors(N)[at(l)].every(v => r.board[v] === 1 || ['A1', 'B1'].includes(lab(v))), l).toBe(true);
  });

  it('l24.2 : si Blanc joue E1 d’abord, c’est le seul coup qui tue ; Noir ne peut plus vivre', () => {
    const s = step<Info>('l24', 1);
    const W = avec(s.rows, 2);
    expect(coupsGagnants(W, A2, ZONE, 'tuer').map(lab)).toEqual(['E1']);
    const r = ok(play(W, at('E1')));
    expect(coupsGagnants(r, A2, ZONE, 'vivre')).toEqual([]);
    expect(evaluer(r, A2, ZONE)).toBe(-1);
    // Toute autre réduction blanche laisse Noir vivre.
    for (const p of ZONE.filter(z => !W.board[z] && z !== at('E1'))) expect(issueApres(W, p, A2, ZONE), lab(p)).toBe(1);
    expect(images(s).at(-1)!.board[at('E1')]).toBe(2);
  });

  it('l24.3 : couleurs inversées, seul E1 tue ; chaque coup à l’intérieur laisse Blanc vivre en prenant E1', () => {
    const q = step<Move>('l24', 2);
    const { pos, marked } = fromRows(q.rows);
    const zone = zoneDe('C2 D2 E2 F2 G2 H2 J2 C1 D1 E1 F1 G1 H1 J1');
    expect(defautsDeZone(pos, marked[0], zone)).toEqual([]);
    expect(coupsGagnants(pos, marked[0], zone, 'tuer').map(lab)).toEqual(q.accept);
    // L'intérieur : les points vides de la zone qui ne touchent aucune pierre noire.
    const dedans = zone.filter(p => !pos.board[p] && !neighbors(N)[p].some(v => pos.board[v] === 1));
    expect(labels(dedans)).toEqual([...q.refus![0].points].sort());
    for (const p of dedans) {
      expect(issueApres(pos, p, marked[0], zone), lab(p)).toBe(1);
      expect(coupsGagnants(ok(play(pos, p)), marked[0], zone, 'vivre').map(lab), lab(p)).toContain('E1');
    }
  });

  it('l24.4 : la même forme sur le bord droit ; seul J5 vit ; chaque coup dedans laisse Blanc tuer en J5', () => {
    const q = step<Move>('l24', 3);
    const pos = avec(q.rows, 1);
    const zone = zoneDe('H9 H8 H7 H6 H5 H4 H3 J9 J8 J7 J6 J5 J4 J3');
    const H9 = at('H9');
    expect(defautsDeZone(pos, H9, zone)).toEqual([]);
    expect(coupsGagnants(pos, H9, zone, 'vivre').map(lab)).toEqual(q.accept);
    const dedans = zone.filter(p => !pos.board[p] && !neighbors(N)[p].some(v => pos.board[v] === 2));
    expect(labels(dedans)).toEqual([...q.refus![0].points].sort());
    for (const p of dedans) {
      expect(issueApres(pos, p, H9, zone), lab(p)).toBe(-1);
      expect(coupsGagnants(ok(play(pos, p)), H9, zone, 'tuer').map(lab), lab(p)).toContain('J5');
    }
  });
});

describe('leçon 25 : les groupes du coin', () => {
  const ZONE = zoneDe('A2 B2 C2 D2 E2 A1 B1 C1 D1 E1');
  const B2 = at('B2');

  it('l25.1 : A2, le point du coin, est le seul coup qui vit ; ensuite deux yeux (A1-B1 et D1)', () => {
    const s = step<Info>('l25', 0);
    const pos = avec(s.rows, 1);
    expect(defautsDeZone(pos, B2, ZONE)).toEqual([]);
    expect(coupsGagnants(pos, B2, ZONE, 'vivre').map(lab)).toEqual(['A2']);
    expect(evaluer(ok(play(pos, at('A2'))), B2, ZONE)).toBe(1);
    expect(labels(images(s).at(-1)!.yeux)).toEqual(['A1', 'B1', 'D1']);
  });

  it('l25.2 et l25.3 : si Blanc prend A2, Blanc ne peut pas tuer sans ko, Noir ne peut pas vivre sans ko ; A1 puis B1 fait le ko', () => {
    const W = avec(step<Info>('l25', 1).rows, 2);
    // Sans ko, personne ne gagne : la preuve ne compte jamais un ko.
    expect(coupsGagnants(W, B2, ZONE, 'tuer')).toEqual([]);
    expect(evaluer(W, B2, ZONE)).toBe(0);
    const a2 = ok(play(W, at('A2')));
    expect(coupsGagnants(a2, B2, ZONE, 'vivre')).toEqual([]);
    expect(issueApres(a2, at('A1'), B2, ZONE)).toBe(0);
    // Toute autre réponse noire meurt.
    for (const p of [...ZONE.filter(z => !a2.board[z] && z !== at('A1')), -1]) expect(issueApres(a2, p, B2, ZONE), lab(p)).toBe(-1);
    // Le ko : Blanc prend A1 en B1 ; Noir ne peut pas reprendre aussitôt.
    const ko = suite(a2, ['A1', 'B1']);
    expect(ko.board[at('A1')]).toBe(0);
    expect(ko.ko).toBe(at('A1'));
    expect(play(ko, at('A1'))).toBe('ko');
    const im = images(step<Info>('l25', 1));
    expect(im.at(-1)!.interdit).toBe(at('A1'));
    // Si Noir ne se bat pas pour le ko, Blanc remplit A1 et Noir meurt ; s'il reprend, B1 n'est qu'un faux œil.
    expect(evaluer(suite(ko, ['passe', 'A1']), B2, ZONE)).toBe(-1);
    const reprise = suite(ko, ['passe', 'passe', 'A1']);
    expect(yeuxDuGroupe(reprise, B2).find(e => e.point === at('B1'))?.vrai).toBe(false);
    const q = step<Quiz>('l25', 2);
    expect(q.choices[q.answer]).toBe('Un ko commence');
  });

  it('l25.4 : tourné dans le coin en haut à droite, seul J8 vit ; H9 meurt, J9 donne un ko, F9 bouche l’œil', () => {
    const q = step<Move>('l25', 3);
    const pos = avec(q.rows, 1);
    const zone = zoneDe('E9 F9 G9 H9 J9 E8 F8 G8 H8 J8');
    const H8 = at('H8');
    expect(defautsDeZone(pos, H8, zone)).toEqual([]);
    expect(coupsGagnants(pos, H8, zone, 'vivre').map(lab)).toEqual(q.accept);
    const h9 = ok(play(pos, at('H9')));
    expect(coupsGagnants(h9, H8, zone, 'tuer').map(lab)).toEqual(['J8']);
    const j9 = ok(play(pos, at('J9')));
    expect(issueApres(j9, at('J8'), H8, zone)).toBe(0);
    expect(coupsGagnants(j9, H8, zone, 'tuer')).toEqual([]);
    // Après J9 puis J8, Blanc prend J9 en H9 : un ko.
    const k = suite(j9, ['J8', 'passe', 'H9']);
    expect(k.board[at('J9')]).toBe(0);
    expect(k.ko).toBe(at('J9'));
    expect(issueApres(pos, at('F9'), H8, zone)).toBe(-1);
    expect(q.refus!.map(r => r.points[0])).toEqual(['H9', 'J9', 'F9']);
  });
});


describe('leçon 26 : la course avec un œil', () => {
  /** Noir au trait joue `m` : il prend le groupe blanc en trois coups noirs au plus, et Blanc ne prend jamais le groupe noir. */
  const gagne = (pos: Position, m: number, blanc: number, noir: number) =>
    captureEn(pos, m, [blanc], 3, SANS_KO) && !attackerCaptures(ok(play(pos, m)), [noir], 3, SANS_KO);

  it('l26.1 : un œil en A1 ; Blanc ne peut pas y jouer tant que Noir a une autre liberté', () => {
    const s = step<Info>('l26', 0);
    const pos = avec(s.rows, 2);
    expect(labels(groupAt(pos.board, N, at('B2')).liberties)).toEqual(['A1', 'C1']);
    expect(neighbors(N)[at('A1')].every(v => pos.board[v] === 1)).toBe(true);
    expect(play(pos, at('A1'))).toBe('suicide');
    expect(images(s).at(-1)!.interdit).toBe(at('A1'));
    // Quand A1 est la dernière liberté, Blanc y joue et prend tout.
    expect(ok(play(suite(pos, ['C1', 'passe']), at('A1'))).captures[2]).toBe(4);
  });

  it('l26.2 : Noir au trait gagne exactement en bouchant le dehors (E1 ou E2) ; C1 et A1 perdent', () => {
    const s = step<Info>('l26', 1);
    const pos = avec(s.rows, 1);
    const D1 = at('D1'), B2 = at('B2');
    expect(labels(groupAt(pos.board, N, D1).liberties)).toEqual(['C1', 'E1', 'E2']);
    expect(tous.filter(p => isLegal(pos, p) && gagne(pos, p, D1, B2)).map(lab).sort()).toEqual(['E1', 'E2']);
    for (const l of ['C1', 'A1']) expect(attackerCaptures(ok(play(pos, at(l))), [B2], 1, SANS_KO), l).toBe(true);
    expect(labels(images(s).at(-1)!.libs)).toEqual(['C1', 'E1']);
  });

  it('l26.3 : si Blanc joue le premier, Blanc gagne : il bouche C1, puis prend dans l’œil', () => {
    const q = step<Quiz>('l26', 2);
    const W = avec(q.rows, 2);
    expect(attackerCaptures(W, [at('B2')], 2, SANS_KO)).toBe(true);
    expect(defenderFails(W, [at('D1')], 3, SANS_KO)).toBe(false);
    const c1 = ok(play(W, at('C1')));
    expect(labels(groupAt(c1.board, N, at('B2')).liberties)).toEqual(['A1']);
    expect(groupAt(c1.board, N, at('D1')).liberties.size).toBe(2);
    expect(q.choices[q.answer]).toBe('Blanc');
  });

  it('l26.4 : en miroir, seuls E1 et E2 gagnent ; G1 (liberté commune) et J1 (l’œil) mettent Noir en atari, Blanc prend', () => {
    const q = step<Move>('l26', 3);
    const pos = avec(q.rows, 1);
    const F1 = at('F1'), H2 = at('H2');
    expect(tous.filter(p => isLegal(pos, p) && gagne(pos, p, F1, H2)).map(lab).sort()).toEqual([...q.accept].sort());
    for (const [l, prise] of [['G1', 'J1'], ['J1', 'G1']]) {
      const r = ok(play(pos, at(l)));
      expect(labels(groupAt(r.board, N, H2).liberties), l).toEqual([prise]);
      expect(ok(play(r, at(prise))).board[H2], l).toBe(0);
    }
  });
});
