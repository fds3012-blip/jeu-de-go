// Issue #539 (lot Z, leçon « grand œil contre petit œil ») : preuve d'une course aux libertés (semeai). Recherche
// exhaustive, à profondeur limitée, dans une zone bornée (les points jouables, fournis par la leçon ou le problème), sur
// le modèle de src/go/preuve-connexion.ts.
//
// Issues (du point de vue du camp de `a`) :
//  +1 « gagné » : la chaîne de `b` (l'adversaire) est prise.
//  -1 « perdu » : la chaîne de `a` est prise.
//   0 « non résolu » : double passe sans prise (seki compris), profondeur atteinte, répétition sur la ligne, ou ko.
//
// Ko, de façon prudente : un coup qui crée un ko donne 0 sans aller plus loin ; aucune preuve ne dépend d'un ko.
// Sûreté : +1 et -1 ne sont jamais tirés d'une coupure (profondeur, répétition, ko, budget) ; ces coupures donnent 0,
// ce qui ne peut qu'empêcher une preuve. La restriction des coups à la zone suppose que rien ne se joue ailleurs :
// `defautsCourse` vérifie que les chaînes `a` et `b` ont toutes leurs libertés dans la zone, et que toute autre chaîne
// au contact de la zone a soit toutes ses libertés dans la zone (son sort se lit entièrement dedans), soit au moins deux
// libertés hors de la zone (aucun coup de la zone ne peut la prendre).
import { groupAt, neighbors, play, type Position } from './rules';

export type Issue = -1 | 0 | 1;

export interface OptionsCourse {
  /** Nombre maximal de coups (passes comprises). 30 par défaut. */
  profondeur?: number;
  /** Nombre maximal de positions examinées ; au-delà, 0 (« non résolu »). Sans borne par défaut. */
  budget?: number;
}

/** Défauts de la zone (liste vide si elle est fermée au sens ci-dessus). */
export function defautsCourse(pos: Position, a: number, b: number, zone: readonly number[]): string[] {
  const out: string[] = [], nb = neighbors(pos.size), dans = new Set(zone), vu = new Set<number>();
  if (!pos.board[a] || !pos.board[b] || pos.board[a] === pos.board[b]) return ['a et b doivent être des pierres de couleurs opposées'];
  const ga = new Set(groupAt(pos.board, pos.size, a).stones), gb = new Set(groupAt(pos.board, pos.size, b).stones);
  const bord = new Set<number>([a, b]);
  for (const z of zone) { bord.add(z); for (const r of nb[z]) bord.add(r); }
  for (const p of bord) {
    if (!pos.board[p] || vu.has(p)) continue;
    const g = groupAt(pos.board, pos.size, p);
    g.stones.forEach(s => vu.add(s));
    const dehors = [...g.liberties].filter(l => !dans.has(l)).length;
    if (ga.has(p) || gb.has(p)) { if (dehors > 0) out.push(`chaîne ${ga.has(p) ? 'a' : 'b'} : liberté hors de la zone`); }
    else if (dehors === 1) out.push(`chaîne en ${p} : une seule liberté hors de la zone`);
  }
  // Une liberté de `a` (ou de `b`) qui touche aussi une chaîne sûre de la même couleur : y jouer relierait la chaîne au
  // dehors, et la course ne se lirait plus dans la zone.
  for (const z of zone) for (const [g, c] of [[ga, pos.board[a]], [gb, pos.board[b]]] as const) {
    if (!nb[z].some(r => g.has(r))) continue;
    for (const r of nb[z]) {
      if (pos.board[r] !== c || g.has(r)) continue;
      const h = groupAt(pos.board, pos.size, r);
      if ([...h.liberties].some(l => !dans.has(l))) out.push(`point ${z} : relie ${c === pos.board[a] ? 'a' : 'b'} à une chaîne du dehors`);
    }
  }
  return out;
}

/** Issue de la position (camp de `a`), le camp au trait jouant le premier. Coups : points vides de la zone, et la passe. */
export function evaluerCourse(pos: Position, a: number, b: number, zone: readonly number[], opts: OptionsCourse = {}): Issue {
  const ca = pos.board[a], cb = pos.board[b], prof = opts.profondeur ?? 30, budget = opts.budget ?? Infinity;
  let vues = 0;
  const decisif = new Map<string, Issue>(), nul = new Map<string, number>(), enCours = new Set<string>();
  const rec = (p: Position, passes: number, reste: number): Issue => {
    if (p.board[a] !== ca) return -1;
    if (p.board[b] !== cb) return 1;
    if (passes >= 2 || reste === 0 || ++vues > budget) return 0;
    const cle = `${p.toPlay}${passes}${p.ko}:${p.board.join('')}`;
    const connu = decisif.get(cle);
    if (connu !== undefined) return connu;
    if ((nul.get(cle) ?? -1) >= reste || enCours.has(cle)) return 0;
    enCours.add(cle);
    const max = p.toPlay === ca;
    let best: Issue = max ? -1 : 1;
    for (const m of [...zone.filter(z => p.board[z] === 0), -1]) {
      const r = play(p, m);
      if (typeof r === 'string') continue;
      const v: Issue = r.ko !== -1 ? 0 : rec(r, m === -1 ? passes + 1 : 0, reste - 1);
      if (max ? v > best : v < best) best = v;
      if (best === (max ? 1 : -1)) break;
    }
    enCours.delete(cle);
    if (best === 0) nul.set(cle, Math.max(nul.get(cle) ?? -1, reste));
    else decisif.set(cle, best);
    return best;
  };
  return rec(pos, 0, prof);
}

/** Issue (camp de `a`) après le coup `m` du camp au trait ; null si le coup est illégal. */
export function issueCourse(pos: Position, m: number, a: number, b: number, zone: readonly number[], opts: OptionsCourse = {}): Issue | null {
  const r = play(pos, m);
  if (typeof r === 'string') return null;
  if (r.ko !== -1) return 0;
  return evaluerCourse(r, a, b, zone, { ...opts, profondeur: (opts.profondeur ?? 30) - 1 });
}
