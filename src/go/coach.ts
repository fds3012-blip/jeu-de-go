// Coach Mochi pendant les parties contre l'IA (#470) : détection des moments clés, à partir des règles seules.
// Module pur, sans texte ni écran : src/app/coach.ts choisit le moment et la phrase.
//
// Principe : une détection ne renvoie un moment que si la phrase qui l'accompagne est vraie à coup sûr.
// Dans le doute, `null` (Mochi se tait).
//
// 1. atari        : un groupe du joueur vient d'être mis en atari (une seule liberté). Fait vérifiable : si le joueur
//                   ne fait rien (il passe), l'adversaire peut le prendre au coup suivant (la prise est toujours légale
//                   après une passe : pas de ko, jamais un suicide).
// 2. un-oeil      : un groupe du joueur (une seule chaîne) n'entoure qu'un seul œil, et la lecture prouve que
//                   l'adversaire, s'il jouait le premier, le prendrait (src/go/preuve-vie-mort.ts, zone fermée vérifiée,
//                   murs adverses solides). Sans preuve, rien. La vie n'est jamais annoncée.
// 3. prise-ratee  : au coup d'avant, le joueur pouvait prendre des pierres (coup légal, ko compris), sans prise en
//                   retour immédiate (la pierre qui prend garde deux libertés), alors qu'aucun de ses groupes n'était
//                   en atari ; il a joué ailleurs sans rien prendre.
// 4. zone-libre   : un coin entier encore vide, mesuré par un carré (marge comprise) sans aucune pierre, une fois
//                   l'ouverture passée.
import { groupAt, neighbors, play, type Color, type Position } from './rules';
import { defautsDeZone, evaluer } from './preuve-vie-mort';

export type CoinCoach = 'hd' | 'hg' | 'bd' | 'bg';

export type MomentCoach =
  | { type: 'atari'; repere: number; pierres: number[]; liberte: number }
  | { type: 'un-oeil'; repere: number; pierres: number[]; oeil: number[] }
  | { type: 'prise-ratee'; point: number; pierres: number[] }
  | { type: 'zone-libre'; coin: CoinCoach; zone: number[] };

interface Chaine { stones: number[]; liberties: Set<number> }

const trie = (xs: Iterable<number>) => [...new Set(xs)].sort((a, b) => a - b);

/** Chaînes d'une couleur, la plus grosse d'abord (à taille égale, la plus haute à gauche). */
function chaines(pos: Position, couleur: Color): Chaine[] {
  const vu = new Uint8Array(pos.board.length), res: Chaine[] = [];
  for (let p = 0; p < pos.board.length; p++) {
    if (pos.board[p] !== couleur || vu[p]) continue;
    const g = groupAt(pos.board, pos.size, p);
    for (const s of g.stones) vu[s] = 1;
    g.stones.sort((a, b) => a - b);
    res.push(g);
  }
  return res.sort((a, b) => b.stones.length - a.stones.length || a.stones[0] - b.stones[0]);
}

/** Pierre qui nomme le groupe : la première (ordre de lecture) qui touche un des points donnés. */
function repere(size: number, pierres: number[], points: Iterable<number>): number {
  const nb = neighbors(size), ps = new Set(points);
  return pierres.find(s => nb[s].some(r => ps.has(r))) ?? pierres[0];
}

// ---------- 1. Atari ----------

/**
 * Groupe de `moi` en atari dans `apres` qui ne l'était pas dans `avant` (le coup adverse vient de le mettre en atari).
 * Le plus gros d'abord.
 */
export function atariNouveau(avant: Position, apres: Position, moi: Color): MomentCoach | null {
  const deja = new Set<number>();
  for (const g of chaines(avant, moi)) if (g.liberties.size === 1) g.stones.forEach(s => deja.add(s));
  for (const g of chaines(apres, moi)) {
    if (g.liberties.size !== 1 || g.stones.every(s => deja.has(s))) continue;
    const liberte = [...g.liberties][0];
    return { type: 'atari', repere: repere(apres.size, g.stones, [liberte]), pierres: g.stones, liberte };
  }
  return null;
}

// ---------- 2. Un seul œil ----------

/** Profondeur de la lecture de vie et de mort (coups, passes comprises). Zone de 6 points au plus : rapide. */
export const PROFONDEUR_OEIL = 16;
/** Libertés dehors (hors de l'œil) au plus : au-delà, le groupe a de la place et la lecture n'est pas tentée. */
export const OEIL_LIBERTES_MAX = 4;
/** Libertés minimales de chaque mur adverse hors de la zone : un mur fragile pourrait être pris, la preuve tomberait. */
export const MUR_LIBERTES_MIN = 3;

/** Vrai œil (pas un faux œil) : sur le bord, aucune diagonale adverse ; au centre, au plus une. */
function vraiOeil(pos: Position, region: number[], moi: Color): boolean {
  const n = pos.size, dans = new Set(region);
  for (const p of region) {
    const x = p % n, y = Math.floor(p / n);
    let adverses = 0, dehors = 0;
    for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const a = x + dx, b = y + dy;
      if (a < 0 || b < 0 || a >= n || b >= n) { dehors++; continue; }
      const q = b * n + a;
      if (!dans.has(q) && pos.board[q] === 3 - moi) adverses++;
    }
    if (dehors > 0 ? adverses > 0 : adverses > 1) return false;
  }
  return true;
}

/** Région vide contenant `p` : ses points et les couleurs qui la bordent. */
function region(pos: Position, p: number): { points: number[]; bords: Set<number>; voisins: Set<number> } {
  const nb = neighbors(pos.size), vu = new Set<number>([p]), pile = [p], points: number[] = [], bords = new Set<number>(), voisins = new Set<number>();
  while (pile.length) {
    const q = pile.pop()!;
    points.push(q);
    for (const r of nb[q]) {
      if (pos.board[r] === 0) { if (!vu.has(r)) { vu.add(r); pile.push(r); } }
      else { bords.add(pos.board[r]); voisins.add(r); }
    }
  }
  return { points, bords, voisins };
}

/**
 * Groupe de `moi` (une seule chaîne, 3 pierres au moins, au moins 2 libertés) qui n'entoure qu'un seul œil d'un ou
 * deux points, et que l'adversaire prendrait s'il jouait le premier : prouvé par la lecture, dans une zone fermée.
 */
export function unSeulOeil(pos: Position, moi: Color): MomentCoach | null {
  const eux = (3 - moi) as Color;
  for (const g of chaines(pos, moi)) {
    if (g.stones.length < 3 || g.liberties.size < 2) continue;
    const pierres = new Set(g.stones);
    // Régions fermées voisines : bordées par le joueur seul, et par cette chaîne seule.
    const vues = new Set<number>(), yeux: number[][] = [];
    let autre = false;
    for (const l of g.liberties) {
      if (vues.has(l)) continue;
      const r = region(pos, l);
      r.points.forEach(p => vues.add(p));
      if (r.bords.size !== 1 || !r.bords.has(moi)) continue;
      if (![...r.voisins].every(s => pierres.has(s))) { autre = true; break; } // œil partagé avec une autre chaîne : on ne lit pas
      yeux.push(r.points);
    }
    if (autre || yeux.length !== 1) continue;
    const oeil = yeux[0];
    if (oeil.length > 2 || !vraiOeil(pos, oeil, moi)) continue;
    const libres = [...g.liberties].filter(l => !oeil.includes(l));
    if (libres.length < 1 || libres.length > OEIL_LIBERTES_MAX) continue;
    const zone = trie([...oeil, ...libres]);
    if (defautsDeZone(pos, g.stones[0], zone).length) continue;
    // Murs adverses au contact de la chaîne ou de la zone : assez de libertés dehors pour tenir pendant la lecture.
    const nb = neighbors(pos.size), dansZone = new Set(zone), murs = new Set<number>();
    for (const p of [...g.stones, ...zone]) for (const r of nb[p]) if (pos.board[r] === eux) murs.add(r);
    let fragile = false;
    const murVu = new Set<number>();
    for (const m of murs) {
      if (murVu.has(m)) continue;
      const h = groupAt(pos.board, pos.size, m);
      h.stones.forEach(s => murVu.add(s));
      if ([...h.liberties].filter(l => !dansZone.has(l)).length < MUR_LIBERTES_MIN) { fragile = true; break; }
    }
    if (fragile) continue;
    const tourAdverse: Position = { ...pos, toPlay: eux, ko: -1 };
    if (evaluer(tourAdverse, g.stones[0], zone, { profondeur: PROFONDEUR_OEIL }) !== -1) continue;
    return { type: 'un-oeil', repere: repere(pos.size, g.stones, oeil), pierres: g.stones, oeil: trie(oeil) };
  }
  return null;
}

// ---------- 3. Prise ratée ----------

/**
 * Au coup d'avant (`avant`, joueur `moi` au trait), le joueur pouvait prendre ; il a joué `apres` sans rien prendre.
 * Rien si un de ses groupes était en atari (il avait une raison de jouer ailleurs), ni si la prise se faisait reprendre
 * aussitôt (pierre qui prend à une seule liberté : ko ou prise en retour).
 */
export function priseRatee(avant: Position, apres: Position, moi: Color): MomentCoach | null {
  if (avant.toPlay !== moi || apres.toPlay === moi) return null;
  if (apres.captures[moi] !== avant.captures[moi]) return null;
  if (chaines(avant, moi).some(g => g.liberties.size === 1)) return null;
  for (const g of chaines(avant, (3 - moi) as Color)) {
    if (g.liberties.size !== 1) continue;
    const m = [...g.liberties][0];
    if (m === apres.lastMove) continue;
    const r = play(avant, m);
    if (typeof r === 'string' || r.board[g.stones[0]] !== 0) continue;
    if (groupAt(r.board, r.size, m).liberties.size < 2) continue;
    return { type: 'prise-ratee', point: m, pierres: g.stones };
  }
  return null;
}

// ---------- 4. Grande zone libre ----------

/**
 * Côté du coin mesuré (marge comprise : la ligne qui le borde doit être vide aussi) et nombre de pierres à partir duquel
 * l'ouverture est passée. 9 × 9 : carré de 5 (25 points sur 81) après 6 pierres ; 13 × 13 : 6 après 10 ; 19 × 19 : 7 après 16.
 */
export function reglesZoneLibre(size: number): { cote: number; minPierres: number } | null {
  if (size === 9) return { cote: 5, minPierres: 6 };
  if (size === 13) return { cote: 6, minPierres: 10 };
  if (size === 19) return { cote: 7, minPierres: 16 };
  return null;
}

/** Ordre de lecture des coins : en haut à droite, en bas à gauche, en bas à droite, en haut à gauche. */
const COINS: [CoinCoach, boolean, boolean][] = [['hd', true, false], ['bg', false, true], ['bd', true, true], ['hg', false, false]];

/** Un coin encore tout vide (carré `cote` × `cote`), l'ouverture passée. La zone montrée est le carré sans sa marge. */
export function zoneLibre(pos: Position): MomentCoach | null {
  const r = reglesZoneLibre(pos.size);
  if (!r) return null;
  const n = pos.size, pierres = pos.board.reduce((s, v) => s + (v ? 1 : 0), 0);
  if (pierres < r.minPierres) return null;
  for (const [coin, droite, bas] of COINS) {
    const xs = Array.from({ length: r.cote }, (_, i) => (droite ? n - 1 - i : i));
    const ys = Array.from({ length: r.cote }, (_, i) => (bas ? n - 1 - i : i));
    if (!ys.every(y => xs.every(x => pos.board[y * n + x] === 0))) continue;
    const zone = ys.slice(0, r.cote - 1).flatMap(y => xs.slice(0, r.cote - 1).map(x => y * n + x));
    return { type: 'zone-libre', coin, zone: trie(zone) };
  }
  return null;
}
