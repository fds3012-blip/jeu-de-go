// Issue #16 (leçon « relier par le premier rang ») : preuve qu'un camp peut relier deux de ses chaînes, ou que l'autre
// camp peut l'en empêcher. Recherche exhaustive, à profondeur limitée, dans une zone bornée (les points jouables, fournis
// par la leçon), sur le modèle de src/go/preuve-vie-mort.ts.
//
// Issues (du point de vue du camp qui relie, la couleur de `a`) :
//  +1 « relié » : `a` et `b` sont dans la même chaîne, sur le plateau. Une chaîne ne se coupe plus jamais : seule une
//     prise pourrait la défaire, et la zone fermée (voir plus bas) garantit qu'elle a assez de libertés hors d'atteinte.
//  -1 « coupé » : la chaîne de `a` est prise.
//   0 « non résolu » : double passe sans liaison, profondeur atteinte, répétition sur la ligne, ou ko.
//
// Ko, de façon prudente : un coup qui crée un ko donne 0 sans aller plus loin ; aucune preuve ne dépend d'un ko.
// Sûreté : +1 et -1 ne sont jamais tirés d'une coupure. La restriction des coups à la zone suppose que rien ne se joue
// ailleurs : `defautsConnexion` vérifie que chaque chaîne du camp qui relie, au contact de la zone, a toutes ses libertés
// dans la zone, sauf la chaîne de `b` qui doit en avoir au moins deux dehors (elle ne peut pas être prise de l'extérieur
// en un coup), et que chaque chaîne adverse au contact de la zone a au moins deux libertés hors de la zone ou est entière
// dans la zone.
import { groupAt, neighbors, play, type Position } from './rules';

export type Issue = -1 | 0 | 1;

export function defautsConnexion(pos: Position, a: number, b: number, zone: readonly number[]): string[] {
  const c = pos.board[a], nb = neighbors(pos.size), dans = new Set(zone), vu = new Set<number>(), out: string[] = [];
  if (!c || pos.board[b] !== c) return ['a et b doivent porter des pierres de la même couleur'];
  const chaineB = new Set(groupAt(pos.board, pos.size, b).stones);
  const bord = new Set<number>([a]);
  for (const z of zone) { bord.add(z); for (const r of nb[z]) bord.add(r); }
  for (const p of bord) {
    if (!pos.board[p] || vu.has(p)) continue;
    const g = groupAt(pos.board, pos.size, p);
    g.stones.forEach(s => vu.add(s));
    const dehors = [...g.liberties].filter(l => !dans.has(l)).length;
    if (pos.board[p] === c && chaineB.has(p)) { if (dehors < 2) out.push(`chaîne de b : moins de deux libertés hors de la zone`); }
    else if (pos.board[p] === c && dehors > 0) out.push(`chaîne en ${p} : liberté hors de la zone`);
    else if (pos.board[p] !== c && dehors < 2 && !g.stones.every(s => dans.has(s))) out.push(`chaîne adverse en ${p} : moins de deux libertés hors de la zone`);
  }
  return out;
}

/** Issue de la position, le camp au trait jouant le premier. Coups : points vides de la zone, et la passe. */
export function evaluerConnexion(pos: Position, a: number, b: number, zone: readonly number[], profondeur = 24): Issue {
  const c = pos.board[a];
  const decisif = new Map<string, Issue>(), nul = new Map<string, number>(), enCours = new Set<string>();
  const rec = (p: Position, passes: number, reste: number): Issue => {
    if (p.board[a] !== c) return -1;
    if (p.board[b] === c && groupAt(p.board, p.size, a).stones.includes(b)) return 1;
    if (passes >= 2 || reste === 0) return 0;
    const cle = `${p.toPlay}${passes}${p.ko}:${p.board.join('')}`;
    const connu = decisif.get(cle);
    if (connu !== undefined) return connu;
    if ((nul.get(cle) ?? -1) >= reste || enCours.has(cle)) return 0;
    enCours.add(cle);
    const max = p.toPlay === c;
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
  return rec(pos, 0, profondeur);
}

/** Issue après le coup `m` du camp au trait ; null si le coup est illégal. */
export function issueConnexion(pos: Position, m: number, a: number, b: number, zone: readonly number[], profondeur = 24): Issue | null {
  const r = play(pos, m);
  if (typeof r === 'string') return null;
  if (r.ko !== -1) return 0;
  return evaluerConnexion(r, a, b, zone, profondeur - 1);
}
