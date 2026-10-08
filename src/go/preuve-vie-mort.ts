// Issue #136 : preuve des problèmes de vie et mort (« tue », « fais vivre »).
// Recherche exhaustive, à profondeur limitée, dans une zone bornée : la liste des points jouables est fournie par le
// problème. Les deux camps ne jouent que dans la zone (ou passent). Le défenseur est le camp du groupe cible.
//
// Issues d'une position (valeur du point de vue du défenseur) :
//  +1 « vivant » : le groupe a deux yeux vrais et séparés au sens strict de Benson (vie sans condition : chaque chaîne
//     du groupe touche au moins deux yeux d'un point, entourés uniquement de chaînes elles-mêmes vivantes). Un faux œil
//     (un coin pris par l'adversaire, donc une chaîne voisine qui peut être prise) ne compte pas. Vivant aussi quand
//     l'attaquant n'a plus aucun coup légal dans la zone : il ne peut plus rien y faire, le groupe ne sera jamais pris.
//  -1 « mort » : le groupe est capturé. Un groupe qui ne peut plus faire deux yeux finit capturé : la recherche le
//     montre en jouant la suite jusqu'à la prise.
//   0 « non résolu » : double passe sans vie (seki compris), répétition, profondeur atteinte, ou ko.
//
// Ko, de façon prudente : un coup qui crée un ko (prise d'une pierre qui pourrait être reprise aussitôt) donne
// « non résolu » sans aller plus loin. Aucun des deux camps ne peut donc gagner grâce à un ko, et un problème dont la
// solution passe par un ko n'est jamais prouvé.
//
// Sûreté : +1 et -1 ne sont jamais tirés d'une coupure (profondeur, répétition, ko) ; ces coupures donnent 0, ce qui
// ne peut qu'empêcher une preuve, jamais en fabriquer une. La vie « l'attaquant n'a plus de coup légal » et la
// restriction des coups à la zone supposent une zone fermée : `defautsDeZone` le vérifie (toutes les libertés des
// chaînes du défenseur au contact de la zone sont dans la zone, chaque mur de l'attaquant a au moins deux libertés
// hors de la zone). Limite connue : la répétition n'est détectée que sur la ligne en cours, pas à travers la mémoire.
import { groupAt, neighbors, play, type Position } from './rules';
import { hasTwoEyes } from './tactics';

/** +1 vivant, -1 mort (capturé), 0 non résolu (seki, ko, répétition, profondeur atteinte). */
export type Issue = -1 | 0 | 1;
export type Verdict = 'vivant' | 'mort' | 'non-resolu';
export type But = 'vivre' | 'tuer';

export interface OptionsVieMort {
  /** Nombre maximal de coups (passes comprises) joués par la recherche. 30 par défaut. */
  profondeur?: number;
  /**
   * Nombre maximal de positions examinées (#486, comptage en fin de partie : la recherche ne doit jamais s'emballer).
   * Au-delà, chaque position restante vaut 0 (« non résolu ») : comme la profondeur, la borne empêche une preuve, elle
   * n'en fabrique jamais. Sans borne par défaut (problèmes vérifiés hors ligne).
   */
  budget?: number;
}

const verdictDe = (v: Issue): Verdict => (v === 1 ? 'vivant' : v === -1 ? 'mort' : 'non-resolu');

/** Points diagonaux d'un point. */
function diagonales(size: number, p: number): number[] {
  const x = p % size, y = Math.floor(p / size), out: number[] = [];
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const u = x + dx, v = y + dy;
    if (u >= 0 && v >= 0 && u < size && v < size) out.push(v * size + u);
  }
  return out;
}

/**
 * Yeux d'un point du groupe de `cible`, à la façon d'un joueur : point vide dont tous les voisins sont des pierres du
 * défenseur. `vrai` est faux pour un faux œil : au centre, deux coins (diagonales) ou plus pris par l'adversaire ; sur
 * le bord ou dans le coin, un seul suffit. Sert aux tests et aux explications ; la preuve, elle, s'appuie sur Benson.
 */
export function yeuxDuGroupe(pos: Position, cible: number): { point: number; vrai: boolean }[] {
  const d = pos.board[cible], a = 3 - d, nb = neighbors(pos.size);
  if (d === 0) return [];
  const pierres = new Set(groupeElargi(pos, cible));
  const out: { point: number; vrai: boolean }[] = [];
  for (let p = 0; p < pos.board.length; p++) {
    if (pos.board[p] !== 0 || !nb[p].every(r => pos.board[r] === d)) continue;
    if (!nb[p].some(r => pierres.has(r))) continue;
    const diag = diagonales(pos.size, p), pris = diag.filter(q => pos.board[q] === a).length;
    out.push({ point: p, vrai: diag.length === 4 ? pris <= 1 : pris === 0 });
  }
  return out;
}

/** Pierres du défenseur reliées à `cible` directement ou par des yeux d'un point (le « groupe » au sens du joueur). */
function groupeElargi(pos: Position, cible: number): number[] {
  const d = pos.board[cible], nb = neighbors(pos.size), vu = new Set<number>([cible]), pile = [cible];
  while (pile.length) {
    const q = pile.pop()!;
    for (const r of nb[q]) {
      if (vu.has(r)) continue;
      if (pos.board[r] === d) { vu.add(r); pile.push(r); }
      else if (pos.board[r] === 0 && nb[r].every(s => pos.board[s] === d)) {
        vu.add(r);
        for (const s of nb[r]) if (!vu.has(s)) { vu.add(s); pile.push(s); }
      }
    }
  }
  return [...vu].filter(p => pos.board[p] === d);
}

/**
 * Défauts de la zone (liste vide si la zone est fermée) : une chaîne du défenseur au contact de la zone a une liberté
 * hors de la zone, ou un mur de l'attaquant au contact de la zone a moins de deux libertés hors de la zone.
 */
export function defautsDeZone(pos: Position, cible: number, zone: readonly number[]): string[] {
  const d = pos.board[cible], a = 3 - d, nb = neighbors(pos.size), dans = new Set(zone), vu = new Set<number>(), out: string[] = [];
  if (d === 0) return ['pas de pierre sur la cible'];
  if (![...groupAt(pos.board, pos.size, cible).liberties].some(l => dans.has(l))) out.push('la chaîne cible ne touche pas la zone');
  const bord = new Set<number>([cible]);
  for (const z of zone) { bord.add(z); for (const r of nb[z]) bord.add(r); }
  for (const p of bord) {
    if (pos.board[p] === 0 || vu.has(p)) continue;
    const g = groupAt(pos.board, pos.size, p);
    g.stones.forEach(s => vu.add(s));
    const dehors = [...g.liberties].filter(l => !dans.has(l)).length;
    if (pos.board[p] === d && dehors > 0) out.push(`chaîne du défenseur en ${p} : liberté hors de la zone`);
    if (pos.board[p] === a && dehors < 2 && !g.stones.every(s => dans.has(s))) out.push(`mur de l'attaquant en ${p} : moins de deux libertés hors de la zone`);
  }
  return out;
}

/** L'attaquant n'a aucun coup légal dans la zone (ko ignoré : c'est le cas le plus favorable pour lui). */
function attaquantBloque(pos: Position, zone: readonly number[], a: number): boolean {
  const essai: Position = { ...pos, toPlay: a as 1 | 2, ko: -1 };
  return zone.every(z => pos.board[z] !== 0 || typeof play(essai, z) === 'string');
}

/**
 * Valeur de la position, le camp au trait jouant le premier. Coups : points vides de la zone, et la passe.
 */
export function evaluer(pos: Position, cible: number, zone: readonly number[], opts: OptionsVieMort = {}): Issue {
  const d = pos.board[cible];
  if (d === 0) return -1;
  const a = 3 - d, prof = opts.profondeur ?? 30, budget = opts.budget ?? Infinity;
  let vues = 0;
  const decisif = new Map<string, Issue>(), nul = new Map<string, number>(), enCours = new Set<string>();
  const rec = (p: Position, passes: number, reste: number): Issue => {
    if (p.board[cible] !== d) return -1;
    if (hasTwoEyes(p, cible) || attaquantBloque(p, zone, a)) return 1;
    if (passes >= 2 || reste === 0 || ++vues > budget) return 0;
    const cle = `${p.toPlay}${passes}${p.ko}:${p.board.join('')}`;
    const connu = decisif.get(cle);
    if (connu !== undefined) return connu;
    // Un 0 trouvé avec au moins autant de profondeur reste 0 ici (moins de coups ne crée pas de preuve).
    if ((nul.get(cle) ?? -1) >= reste) return 0;
    if (enCours.has(cle)) return 0;
    enCours.add(cle);
    const max = p.toPlay === d;
    let best: Issue = max ? -1 : 1;
    for (const m of [...zone.filter(z => p.board[z] === 0), -1]) {
      const r = play(p, m);
      if (typeof r === 'string') continue;
      // Ko : prudence, la ligne n'est pas résolue.
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

/** Verdict de la position, le camp au trait jouant le premier. */
export function verdict(pos: Position, cible: number, zone: readonly number[], opts: OptionsVieMort = {}): Verdict {
  return verdictDe(evaluer(pos, cible, zone, opts));
}

/** Issue après le coup `m` (point de la zone ou -1 pour la passe) du camp au trait ; null si le coup est illégal. */
export function issueApres(pos: Position, m: number, cible: number, zone: readonly number[], opts: OptionsVieMort = {}): Issue | null {
  const r = play(pos, m);
  if (typeof r === 'string') return null;
  if (r.ko !== -1) return 0;
  return evaluer(r, cible, zone, opts);
}

/** Coups du camp au trait (points de la zone et passe) qui atteignent le but à coup sûr : vivre (+1) ou tuer (-1). */
export function coupsGagnants(pos: Position, cible: number, zone: readonly number[], but: But, opts: OptionsVieMort = {}): number[] {
  const vise: Issue = but === 'vivre' ? 1 : -1;
  return [...zone.filter(z => pos.board[z] === 0), -1].filter(m => issueApres(pos, m, cible, zone, opts) === vise);
}
