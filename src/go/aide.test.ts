// Aide du joueur (#362) : chaque schéma des règles, du comptage et du glossaire est vérifié par le moteur.
// Une preuve qui échoue ici veut dire qu'une phrase de l'aide est fausse : on corrige la position, jamais le test.
import { COMPTER, MOTS, REGLES, type Preuve, type Schema } from '../content/aide';
import { fromLabel, toLabel } from './coords';
import { fromRows } from './position';
import { groupAt, handicapPoints, isLegal, neighbors, play, type Color, type Position } from './rules';
import { findSeki, score } from './score';
import { canEscape, defenceFails, ladderWorks } from './tactics';

const ok = (r: Position | string): Position => { if (typeof r === 'string') throw new Error(`coup refusé : ${r}`); return r; };
const avec = (pos: Position, c: Color): Position => ({ ...pos, toPlay: c, ko: -1 });
const libs = (pos: Position, p: number) => groupAt(pos.board, pos.size, p).liberties;
const etiquettes = (s: Iterable<number>, n: number) => [...s].map(p => toLabel(p, n)).sort();

/** Vérifie une preuve sur la position du schéma. */
function verifier(s: Schema, pr: Preuve): void {
  const { pos } = fromRows(s.rows);
  const n = pos.size, at = (l: string) => fromLabel(l, n);

  if ('libertes' in pr) {
    const l = libs(pos, at(pr.libertes));
    expect(pos.board[at(pr.libertes)]).not.toBe(0);
    expect(l.size).toBe(pr.n);
    if (s.libs) expect(etiquettes(l, n)).toEqual([...s.libs].sort());
  } else if ('groupe' in pr) {
    const g = groupAt(pos.board, n, at(pr.groupe));
    expect(g.stones.length).toBe(pr.taille);
    expect(pos.board[at(pr.hors)]).toBe(pos.board[at(pr.groupe)]);
    expect(g.stones).not.toContain(at(pr.hors));
  } else if ('permis' in pr) {
    expect(isLegal(avec(pos, pr.par), at(pr.permis))).toBe(true);
  } else if ('prend' in pr) {
    const r = ok(play(avec(pos, pr.par), at(pr.prend)));
    expect(r.captures[pr.par]).toBe(pr.n);
  } else if ('suicide' in pr) {
    expect(play(avec(pos, pr.par), at(pr.suicide))).toBe('suicide');
  } else if ('ko' in pr) {
    const prise = ok(play(avec(pos, 1), at(pr.ko)));
    expect(prise.captures[1]).toBe(1);
    expect(prise.board[at(pr.reprise)]).toBe(0);
    expect(play(prise, at(pr.reprise))).toBe('ko');
    // « Il joue d'abord ailleurs, puis il pourra reprendre » : après un échange ailleurs, la reprise est permise.
    const ailleurs = [...Array(n * n).keys()].filter(p => prise.board[p] === 0 && p !== at(pr.reprise));
    const echange = ok(play(ok(play(prise, ailleurs[0])), ailleurs[ailleurs.length - 1]));
    const reprise = ok(play(echange, at(pr.reprise)));
    expect(reprise.captures[2]).toBe(1);
  } else if ('doubleAtari' in pr) {
    const r = ok(play(avec(pos, 1), at(pr.doubleAtari)));
    const enAtari = new Set<string>();
    for (let p = 0; p < n * n; p++) if (r.board[p] === 2 && libs(r, p).size === 1) enAtari.add(etiquettes(groupAt(r.board, n, p).stones, n).join());
    expect(enAtari.size).toBeGreaterThanOrEqual(2);
    expect(libs(r, at(pr.doubleAtari)).size).toBeGreaterThanOrEqual(2); // la pierre de Noir n'est pas elle-même en danger
  } else if ('echelle' in pr) {
    const t = at(pr.echelle), depart = avec(pos, 1);
    expect(libs(depart, t).size).toBe(2);
    expect(ladderWorks(depart, t)).toBe(true);
    const r = ok(play(depart, at(pr.coup)));
    expect(libs(r, t).size).toBe(1); // le premier coup de l'échelle est un atari
    expect(canEscape(r, t)).toBe(false); // et Blanc ne peut plus se sauver
    // Avec une pierre blanche sur le chemin (casse-échelle, en bas à gauche), Blanc se sauve.
    const casse = { ...r, board: r.board.slice() };
    casse.board[at('B2')] = 2;
    expect(canEscape(casse, t)).toBe(true);
  } else if ('filet' in pr) {
    const t = at(pr.filet);
    const r = ok(play(avec(pos, 1), at(pr.coup)));
    expect(libs(r, t).size).toBe(2); // ce n'est pas un atari
    expect(defenceFails(r, t, 12)).toBe(true);
    // Sans le filet (Noir passe), Blanc se sauve.
    expect(defenceFails(ok(play(avec(pos, 1), -1)), t, 12)).toBe(false);
  } else if ('priseEnRetour' in pr) {
    const sac = ok(play(avec(pos, 1), at(pr.priseEnRetour)));
    const prise = ok(play(sac, at(pr.prise)));
    expect(prise.captures[2]).toBe(1);
    expect(prise.ko).toBe(-1); // ce n'est pas un ko
    const retour = ok(play(prise, at(pr.priseEnRetour)));
    expect(retour.captures[1]).toBeGreaterThan(1);
  } else if ('vivant' in pr) {
    const g = groupAt(pos.board, n, at(pr.vivant));
    expect(etiquettes(g.liberties, n)).toEqual([...pr.yeux].sort());
    for (const y of pr.yeux) expect(play(avec(pos, 2), at(y))).toBe('suicide');
  } else if ('fauxOeil' in pr) {
    const p = at(pr.fauxOeil), voisins = neighbors(n)[p];
    expect(pos.board[p]).toBe(0);
    expect(voisins.every(v => pos.board[v] === 1)).toBe(true);
    const groupes = new Map<string, number>();
    for (const v of voisins) { const g = groupAt(pos.board, n, v); groupes.set(etiquettes(g.stones, n).join(), g.liberties.size); }
    expect(groupes.size).toBeGreaterThanOrEqual(2);
    // Un des groupes voisins n'a que ce point : Blanc y joue en capturant, l'« œil » disparaît.
    expect([...groupes.values()]).toContain(1);
    const r = ok(play(avec(pos, 2), p));
    expect(r.captures[2]).toBeGreaterThan(0);
  } else if ('seki' in pr) {
    const seki = findSeki(pos.board, n);
    for (const l of pr.seki) expect(seki.has(at(l)), l).toBe(true);
    const sc = score(pos, 0, 'japanese');
    for (const l of pr.neutres) {
      expect(sc.owner[at(l)]).toBe(0);
      // Personne ne joue dans une liberté partagée sans se mettre en atari puis se faire prendre.
      for (const c of [1, 2] as const) {
        const r = ok(play(avec(pos, c), at(l)));
        expect(libs(r, at(l)).size).toBe(1);
      }
    }
  } else if ('score' in pr) {
    const { regle, komi, noir, blanc, morts = [] } = pr.score;
    const sc = score(pos, komi, regle, new Set(morts.map(at)));
    expect([sc.black, sc.white]).toEqual([noir, blanc]);
  } else if ('neutre' in pr) {
    expect(pos.board[at(pr.neutre)]).toBe(0);
    expect(score(pos, 0, 'japanese').owner[at(pr.neutre)]).toBe(0);
    expect(new Set(neighbors(n)[at(pr.neutre)].map(v => pos.board[v]))).toEqual(new Set([1, 2]));
  } else if ('hane' in pr) {
    const [c, d, o] = [at(pr.hane), at(pr.de), at(pr.contre)];
    const xy = (p: number) => [p % n, Math.floor(p / n)];
    const [cx, cy] = xy(c), [dx, dy] = xy(d);
    expect(Math.abs(cx - dx) === 1 && Math.abs(cy - dy) === 1).toBe(true); // en diagonale de sa pierre
    expect(neighbors(n)[c]).toContain(o); // au contact de la pierre adverse
    expect(neighbors(n)[d]).toContain(o); // qui touche sa pierre
    expect(pos.board[d]).toBe(1);
    expect(pos.board[o]).toBe(2);
  } else if ('hoshi' in pr) {
    expect(etiquettes(handicapPoints(n, 5), n)).toEqual([...pr.hoshi].sort());
    const pierres = [...pos.board.keys()].filter(p => pos.board[p] !== 0);
    if (pierres.length) expect(etiquettes(pierres, n)).toEqual([...pr.hoshi].sort());
  } else {
    throw new Error(`preuve inconnue : ${JSON.stringify(pr)}`);
  }
}

/** Marques du schéma : sur le plateau, sur la bonne chose (pierre ou point vide). */
function verifierMarques(s: Schema): void {
  const { pos } = fromRows(s.rows);
  const n = pos.size, at = (l: string) => fromLabel(l, n);
  expect(s.rows.every(r => r.length === n && /^[XO.]+$/.test(r))).toBe(true);
  for (const l of s.libs ?? []) expect(pos.board[at(l)], `point vert ${l}`).toBe(0);
  for (const l of s.cibles ?? []) expect(pos.board[at(l)], `cible ${l}`).not.toBe(0);
  if (s.coup) expect(pos.board[at(s.coup)], `coup ${s.coup}`).toBe(0);
  if (s.interdit) expect(pos.board[at(s.interdit)], `interdit ${s.interdit}`).toBe(0);
  for (const l of s.morts ?? []) expect(pos.board[at(l)], `morte ${l}`).not.toBe(0);
  expect(s.preuves.length).toBeGreaterThan(0);
}

const tous: [string, Schema][] = [
  ...REGLES.filter(c => c.schema).map(c => [`règle ${c.id}`, c.schema!] as [string, Schema]),
  ...COMPTER.filter(c => c.schema).map(c => [`compter ${c.id}`, c.schema!] as [string, Schema]),
  ...MOTS.filter(m => m.schema).map(m => [`mot ${m.id}`, m.schema!] as [string, Schema]),
];

describe('aide (#362) : chaque schéma est vrai selon le moteur', () => {
  it.each(tous)('%s', (_, s) => {
    verifierMarques(s);
    for (const pr of s.preuves) verifier(s, pr);
  });

  it('des petits plateaux : 5 × 5 à 7 × 7, sauf les hoshi et le handicap (9 × 9)', () => {
    for (const [nom, s] of tous) {
      const n = s.rows.length;
      if (nom.endsWith('hoshi') || nom.endsWith('handicap')) expect(n).toBe(9);
      else expect(n, nom).toBeLessThanOrEqual(7);
    }
  });

  it('5 cartes de règles, 5 cartes de comptage', () => {
    expect(REGLES).toHaveLength(5);
    expect(COMPTER).toHaveLength(5);
  });
});
