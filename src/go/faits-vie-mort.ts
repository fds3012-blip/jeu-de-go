// Issue #554 : faits de vie et mort lus sur le plateau, pour la phrase d'une réfutation (src/app/comprendreErreur.ts).
// Module léger, chargé avec l'écran des problèmes : aucune recherche ici, seulement des lectures de la position.
import { groupAt, neighbors, type Position } from './rules';
import { hasTwoEyes } from './tactics';

/** Le point vide `e` n'a que des pierres de la couleur `d` pour voisins (forme d'un œil d'un point). */
const formeDOeil = (pos: Position, e: number, d: number) => !pos.board[e] && neighbors(pos.size)[e].every(r => pos.board[r] === d);

/** Pierres reliées à `cible` directement ou par des points en forme d'œil (le « groupe » au sens du joueur). */
export function groupeDuJoueur(pos: Position, cible: number): Set<number> {
  const d = pos.board[cible], nb = neighbors(pos.size), vu = new Set<number>([cible]), pile = [cible];
  while (pile.length) {
    const q = pile.pop()!;
    for (const r of nb[q]) {
      if (vu.has(r)) continue;
      if (pos.board[r] === d) { vu.add(r); pile.push(r); }
      else if (formeDOeil(pos, r, d)) for (const s of nb[r]) if (!vu.has(s)) { vu.add(s); pile.push(s); }
    }
  }
  return vu;
}

/**
 * Point `e` en forme d'œil du groupe de `cible` (vide, tous ses voisins sont des pierres du groupe) qui devient un faux
 * œil entre `avant` et `apres` : une chaîne voisine de `e`, autre que celle de la cible, n'a plus que `e` pour liberté
 * (l'adversaire la prend en y jouant), alors qu'elle en avait plus d'une avant. Fait lu sur le plateau ; -1 sinon.
 */
export function fauxOeilCree(avant: Position, apres: Position, cible: number): number {
  const d = apres.board[cible], nb = neighbors(apres.size);
  if (!d) return -1;
  const groupe = groupeDuJoueur(apres, cible);
  const chaineCible = new Set(groupAt(apres.board, apres.size, cible).stones);
  for (let e = 0; e < apres.board.length; e++) {
    if (!formeDOeil(apres, e, d) || !nb[e].some(r => groupe.has(r))) continue;
    for (const r of nb[e]) {
      if (chaineCible.has(r)) continue;
      const g = groupAt(apres.board, apres.size, r);
      if (g.liberties.size !== 1) continue;
      if (avant.board[r] === d && groupAt(avant.board, avant.size, r).liberties.size > 1) return e;
    }
  }
  return -1;
}

/** Le groupe cible a-t-il deux yeux (au sens de Benson) dans cette position ? */
export const aDeuxYeux = (pos: Position, cible: number): boolean => !!pos.board[cible] && hasTwoEyes(pos, cible);

