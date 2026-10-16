// Issue #558 : réfutation prouvée d'un coup faux en fin de partie et en comptage. La preuve est un compte de points.
//
// Après ton coup faux et la réponse de l'adversaire, quoi que tu joues, le compte de la zone est pire d'au moins N points
// que celui obtenu par la bonne réponse. Méthode des preuves des lots W, Y, Z et AA (src/go/lot-*.test.ts) :
// - zone : les points encore ouverts (régions vides qui touchent les deux couleurs, pierres mortes retirées d'abord),
//   ou une zone déclarée (src/go/zones-problemes.ts) quand la région ouverte est trop grande (lot W) ; hors de la zone,
//   chaque point vide est à quelqu'un une fois la zone fermée (vérifié par `defautsZoneFin`) ;
// - recherche : minimax exact (alpha-bêta, à la manière de src/go/preuve-fin-de-partie.ts : bornes basse et haute
//   égales, sinon rien n'est affirmé) sur les points de la zone et la passe ; deux passes : on compte. Comme dans la
//   preuve du lot W, un camp ne joue dans la zone que sur un point encore ouvert (sa région vide touche les deux
//   couleurs), ou pour prendre, ou pour sauver une de ses chaînes en atari : en règle japonaise, une pierre jetée dans
//   un territoire fermé ne rapporte jamais rien (elle est morte, ou elle remplit son propre territoire), et la laisser
//   jouer ferait tourner la recherche sans fin (chaque jet est neutre au compte) ;
// - compte : règle japonaise (territoire et prisonniers, comme les textes des problèmes), les pierres mortes déclarées
//   retirées (prouvées mortes par src/go/preuve-vie-mort.ts, quel que soit le camp au trait) ; une pierre jouée hors de
//   la zone chez l'adversaire est morte (prisonnière), chez soi elle reste (un point de moins), comme dans les lots ;
// - ko : le joueur est maître du ko (il reprend aussitôt, menaces sans fin, src/go/preuve-ko.ts) : la perte prouvée
//   tient quelle que soit la gestion des menaces. Quand la réplique prend un ko et que seule la lecture sans menace
//   (ko simple pour les deux camps) prouve une perte, la réplique est « ko » : la phrase dit le fait et la perte « sans
//   menace », rien de plus.
// Les faits sur le coup faux (dans ton territoire, chez lui, dame, pierre déjà morte) sont lus sur le plateau de départ.
import { groupAt, neighbors, play, type Color, type Position } from './rules';
import { frontieresOuvertes } from './frontieres';
import { defautsDeZone, evaluer } from './preuve-vie-mort';
import { score } from './score';

/** Points vides au plus d'une zone déduite : au-delà, la recherche complète n'est plus raisonnable. */
export const VIDES_MAX_FIN = 8;
/** Profondeur de la recherche (coups, passes comprises) depuis la position de départ. */
export const PROFONDEUR_FIN = 16;

export interface ButFin {
  /** Points jouables par les deux camps (vides ou non au départ). */
  zone: number[];
  /** Pierres mortes (encore posées au départ), retirées au comptage. */
  mortes: number[];
}

/** Ce que le coup faux a fait, lu sur le plateau de départ. */
export type FaitFaux = 'territoire' | 'chezLui' | 'dame' | 'morte' | null;

export interface RepliqueFin {
  reponse: number;
  /** Points perdus au moins, par rapport au bon coup (règle japonaise), quoi que tu joues ensuite. */
  perte: number;
  /** Vrai : la réplique prend un ko, et la perte n'est prouvée que sans menace de ko (ko simple pour les deux camps). */
  ko: boolean;
  fait: FaitFaux;
}

export const jouer = (pos: Position, m: number): Position | null => {
  const r = play(pos, m);
  return typeof r === 'string' ? null : r;
};

/** Région vide (points vides d'un seul tenant) qui contient ou touche `p`. */
function regionVide(pos: Position, depart: Iterable<number>): number[] {
  const nb = neighbors(pos.size), vu = new Set<number>(), pile: number[] = [];
  for (const d of depart) if (!pos.board[d] && !vu.has(d)) { vu.add(d); pile.push(d); }
  while (pile.length) {
    const q = pile.pop()!;
    for (const r of nb[q]) if (!pos.board[r] && !vu.has(r)) { vu.add(r); pile.push(r); }
  }
  return [...vu].sort((a, b) => a - b);
}

/**
 * Défauts d'une pierre déclarée morte (liste vide si elle est prouvée morte) : sa chaîne et la région vide qu'elle
 * touche forment une zone fermée (defautsDeZone), petite, dans laquelle elle est prise quel que soit le camp au trait.
 */
export function defautsMorte(pos: Position, m: number): string[] {
  if (!pos.board[m]) return [`pas de pierre en ${m}`];
  const g = groupAt(pos.board, pos.size, m);
  const region = regionVide(pos, g.liberties);
  if (region.length > VIDES_MAX_FIN) return [`pierre ${m} : région trop grande (${region.length} points)`];
  const zone = [...g.stones, ...region].sort((a, b) => a - b);
  const out = defautsDeZone(pos, m, zone);
  for (const c of [1, 2] as const) if (evaluer({ ...pos, toPlay: c, ko: -1 }, m, zone) !== -1) out.push(`pierre ${m} : pas prouvée morte, trait ${c}`);
  return out;
}

/**
 * Propriétaire de chaque point vide hors de la zone, une fois la zone fermée : région vide (zone retirée) bordée par
 * une seule couleur, pierres mortes retirées. 0 : à personne (défaut de zone), ou point de la zone.
 */
export function proprietaires(pos: Position, but: ButFin): Int8Array {
  const nb = neighbors(pos.size), dans = new Set(but.zone), mortes = new Set(but.mortes);
  const board = pos.board.slice();
  for (const m of mortes) board[m] = 0;
  const owner = new Int8Array(board.length), vu = new Uint8Array(board.length);
  for (let p = 0; p < board.length; p++) {
    if (board[p] || vu[p] || dans.has(p)) continue;
    const region: number[] = [], pile = [p];
    let bord = 0;
    vu[p] = 1;
    while (pile.length) {
      const q = pile.pop()!;
      region.push(q);
      for (const r of nb[q]) {
        if (board[r]) bord |= board[r];
        else if (!dans.has(r) && !vu[r]) { vu[r] = 1; pile.push(r); }
      }
    }
    if (bord === 1 || bord === 2) for (const q of region) owner[q] = bord;
  }
  return owner;
}

/**
 * Défauts du but (liste vide s'il est sain) : pierres mortes prouvées ; chaque point vide hors de la zone à quelqu'un ;
 * chaque chaîne qui borde une région fermée a au moins deux libertés, sauf les pierres mortes et les chaînes en atari
 * dont la liberté est dans la zone (le sujet du problème : les coups qui les prennent ou les sauvent sont lus).
 */
export function defautsZoneFin(pos: Position, but: ButFin): string[] {
  const out = but.mortes.flatMap(m => defautsMorte(pos, m));
  const owner = proprietaires(pos, but), dans = new Set(but.zone), mortes = new Set(but.mortes), vues = new Set<number>();
  for (let p = 0; p < pos.board.length; p++) if (!pos.board[p] && !dans.has(p) && !owner[p]) out.push(`point vide ${p} : à personne hors de la zone`);
  for (let p = 0; p < pos.board.length; p++) {
    if (!pos.board[p] || vues.has(p) || mortes.has(p)) continue;
    const g = groupAt(pos.board, pos.size, p);
    g.stones.forEach(s => vues.add(s));
    if (g.liberties.size >= 2 || [...g.liberties].every(l => dans.has(l))) continue;
    out.push(`chaîne en ${p} : en atari hors de la zone`);
  }
  return out;
}

/** Zone déduite du plateau : les points ouverts, les pierres mortes retirées d'abord. */
export const zoneOuverte = (pos: Position, mortes: readonly number[]): number[] => frontieresOuvertes(pos.board, pos.size, mortes);

export interface OptionsFinProuvee {
  /** Camp maître du ko ; sans lui, ko simple pour les deux camps. */
  maitre?: Color;
  /** Profondeur depuis la position de départ (PROFONDEUR_FIN par défaut). */
  profondeur?: number;
}

/** Pierres mortes après le coup `m` de `moi` : les déclarées, et la pierre jouée chez l'adversaire hors de la zone. */
function mortesApres(pos: Position, but: ButFin, m: number, owner: Int8Array): number[] {
  const adv = 3 - pos.toPlay;
  return m >= 0 && !but.zone.includes(m) && owner[m] === adv ? [...but.mortes, m] : but.mortes;
}

/** Coup `m` du camp au trait ; le maître du ko n'est jamais tenu par la règle du ko. */
const jouerMaitre = (p: Position, m: number, maitre?: Color): Position | null =>
  jouer(p.toPlay === maitre && p.ko !== -1 ? { ...p, ko: -1 } : p, m);

/** Pierres mortes encore posées. */
const mortesSur = (p: Position, mortes: readonly number[]) => mortes.filter(m => p.board[m] !== 0);

/**
 * Coups du camp au trait dans la zone (voir l'en-tête) : points encore ouverts (pierres mortes retirées), prises, et
 * libertés d'une de ses chaînes en atari ; puis la passe.
 */
export function coupsFin(pos: Position, zone: readonly number[], mortes: readonly number[], maitre?: Color): number[] {
  const ouverts = new Set(frontieresOuvertes(pos.board, pos.size, mortesSur(pos, mortes))), nb = neighbors(pos.size), moi = pos.toPlay;
  const out: number[] = [];
  for (const z of zone) {
    if (pos.board[z]) continue;
    const r = jouerMaitre(pos, z, maitre);
    if (!r) continue;
    if (ouverts.has(z) || r.captures[moi] > pos.captures[moi]) { out.push(z); continue; }
    if (nb[z].some(q => pos.board[q] === moi && groupAt(pos.board, pos.size, q).liberties.size === 1)) out.push(z);
  }
  out.push(-1);
  return out;
}

/** Bornes connues de la valeur d'une position (à profondeur et coupure fixées) et le meilleur coup trouvé. */
interface Entree { bas: number; haut: number; coup: number }

interface Recherche { but: ButFin; maitre?: Color; coupure: number; table: Map<string, Entree> }

/**
 * Minimax à profondeur bornée avec élagage alpha-bêta (celui de src/go/preuve-fin-de-partie.ts), valeur Noir − Blanc en
 * règle japonaise, pierres mortes retirées. La table garde un encadrement de la valeur de chaque position.
 */
function borne(pos: Position, prof: number, passes: number, rech: Recherche, alpha = -Infinity, beta = Infinity): number {
  if (passes >= 2) { const s = score(pos, 0, 'japanese', new Set(mortesSur(pos, rech.but.mortes))); return s.black - s.white; }
  if (prof === 0) return rech.coupure;
  const cle = `${prof}|${pos.toPlay}${passes}${pos.toPlay === rech.maitre ? -1 : pos.ko}|${pos.captures[1]},${pos.captures[2]}:${pos.board.join('')}`;
  const connu = rech.table.get(cle);
  if (connu) {
    if (connu.bas === connu.haut || connu.bas >= beta) return connu.bas;
    if (connu.haut <= alpha) return connu.haut;
    alpha = Math.max(alpha, connu.bas);
    beta = Math.min(beta, connu.haut);
  }
  const a0 = alpha, b0 = beta, max = pos.toPlay === 1;
  const coups = coupsFin(pos, rech.but.zone, rech.but.mortes, rech.maitre);
  if (connu && coups.includes(connu.coup)) coups.unshift(...coups.splice(coups.indexOf(connu.coup), 1));
  let best = max ? -Infinity : Infinity, meilleur = -1;
  for (const z of coups) {
    const r = jouerMaitre(pos, z, rech.maitre);
    if (!r) continue;
    const v = borne(r, prof - 1, z < 0 ? passes + 1 : 0, rech, alpha, beta);
    if (max ? v > best : v < best) { best = v; meilleur = z; }
    if (max) alpha = Math.max(alpha, best); else beta = Math.min(beta, best);
    if (alpha >= beta) break;
  }
  const bas = Math.max(connu?.bas ?? -Infinity, best <= a0 ? -Infinity : best);
  const haut = Math.min(connu?.haut ?? Infinity, best >= b0 ? Infinity : best);
  rech.table.set(cle, { bas, haut, coup: meilleur });
  return best;
}

/**
 * Valeur prouvée (Noir − Blanc, règle japonaise, sans komi) de la position, le camp au trait jouant le premier ; `passes` :
 * passes déjà jouées juste avant. Null si la borne de profondeur ne suffit pas (bornes basse et haute différentes) :
 * jamais une valeur tirée d'une coupure.
 */
export function valeurFin(pos: Position, but: ButFin, opts: OptionsFinProuvee = {}, passes = 0): number | null {
  const prof = opts.profondeur ?? PROFONDEUR_FIN;
  const bas = borne(pos, prof, passes, { but, maitre: opts.maitre, coupure: -Infinity, table: new Map() });
  const haut = borne(pos, prof, passes, { but, maitre: opts.maitre, coupure: Infinity, table: new Map() });
  return bas === haut ? bas : null;
}

/**
 * Valeur prouvée de la position après le coup `m` du camp au trait (point du plateau ou -1 pour la passe), ou null si
 * elle n'est pas prouvée (coup illégal, profondeur insuffisante).
 */
export function valeurApres(pos: Position, but: ButFin, m: number, owner: Int8Array, opts: OptionsFinProuvee = {}): number | null {
  const r = jouerMaitre(pos, m, opts.maitre);
  if (!r) return null;
  const prof = (opts.profondeur ?? PROFONDEUR_FIN) - 1;
  return valeurFin(r, { zone: but.zone, mortes: mortesApres(pos, but, m, owner) }, { maitre: opts.maitre, profondeur: prof }, m < 0 ? 1 : 0);
}

/** Coups légaux du camp au trait, passe comprise. */
export const coupsLegaux = (pos: Position): number[] => [...Array(pos.board.length).keys(), -1].filter(m => jouer(pos, m) !== null);

/**
 * Valeur de chaque coup légal de Noir au départ (pour le joueur `pos.toPlay`), et la meilleure. Du point de vue du
 * joueur : positive quand elle lui est favorable.
 */
export function valeursDepart(pos: Position, but: ButFin, opts: OptionsFinProuvee = {}): { valeurs: Map<number, number | null>; meilleure: number | null } {
  const owner = proprietaires(pos, but), signe = pos.toPlay === 1 ? 1 : -1;
  const valeurs = new Map<number, number | null>();
  let meilleure: number | null = null;
  for (const m of coupsLegaux(pos)) {
    const v = valeurApres(pos, but, m, owner, opts);
    valeurs.set(m, v === null ? null : v * signe);
    if (v !== null && (meilleure === null || v * signe > meilleure)) meilleure = v * signe;
  }
  return { valeurs, meilleure };
}

/** Le point `p` est une dame : vide, au contact des deux couleurs, et le compte ne change pas si l'un ou l'autre y joue. */
export function estDame(pos: Position, p: number, mortes: readonly number[]): boolean {
  if (pos.board[p]) return false;
  const nb = neighbors(pos.size), autour = new Set(nb[p].map(r => pos.board[r]));
  if (!autour.has(1) || !autour.has(2)) return false;
  const dead = new Set(mortes), avant = score(pos, 0, 'japanese', dead);
  for (const c of [1, 2] as const) {
    const r = jouer({ ...pos, toPlay: c, ko: -1 }, p);
    if (!r || r.captures[c] !== pos.captures[c]) return false;
    const s = score(r, 0, 'japanese', dead);
    if (s.black !== avant.black || s.white !== avant.white) return false;
  }
  return true;
}

/**
 * Ce que le coup faux `faux` a fait, lu sur le plateau de départ. Une dame : le compte ne change pas si l'un ou l'autre
 * y joue, et le coup vaut exactement la passe dans la recherche (`vFaux` et `vPasse`, même modèle) : il ne vaut rien.
 */
export function faitDuFaux(pos: Position, but: ButFin, faux: number, apresFaux: Position, vFaux: number | null, vPasse: number | null): FaitFaux {
  const moi = pos.toPlay, adv = (3 - moi) as Color, owner = proprietaires(pos, but);
  const prises = but.mortes.filter(m => pos.board[m] === adv && apresFaux.board[m] !== adv);
  if (prises.length) return 'morte';
  if (!but.zone.includes(faux)) return owner[faux] === moi ? 'territoire' : owner[faux] === adv ? 'chezLui' : null;
  return vFaux !== null && vFaux === vPasse && estDame(pos, faux, but.mortes) ? 'dame' : null;
}

/** Valeurs de référence d'un problème (point de vue du joueur) : le bon coup dans chaque modèle de ko, et la passe (maître). */
export interface ReferencesFin { maitre: number | null; simple: number | null; passe: number | null }

/**
 * Réplique prouvée au coup faux `faux` : la première des `candidats` (points du plateau) après laquelle, quoi que tu
 * joues, tu finis au moins un point sous `ref.maitre` (la valeur du bon coup, même modèle). La recherche est du point
 * de vue du joueur, maître du ko. Sans réplique ainsi prouvée, lecture sans menace (ko simple, référence `ref.simple`) :
 * seule une réplique qui prend un ko est alors gardée, marquée `ko`.
 */
export function repliqueFin(pos: Position, but: ButFin, faux: number, candidats: readonly number[], ref: ReferencesFin): RepliqueFin | null {
  const moi = pos.toPlay, signe = moi === 1 ? 1 : -1, owner = proprietaires(pos, but);
  const apresFaux = jouer(pos, faux);
  if (!apresFaux) return null;
  const vFaux = valeurApres(pos, but, faux, owner, { maitre: moi });
  const fait = faitDuFaux(pos, but, faux, apresFaux, vFaux === null ? null : vFaux * signe, ref.passe);
  const butApres: ButFin = { zone: but.zone, mortes: mortesApres(pos, but, faux, owner) };
  const essai = (opts: OptionsFinProuvee, ref: number | null, ko: boolean): RepliqueFin | null => {
    if (ref === null) return null;
    for (const m of candidats) {
      if (m < 0 || apresFaux.board[m]) continue;
      const r = jouer(apresFaux, m);
      if (!r || (ko && r.ko === -1)) continue;
      const v = valeurApres(apresFaux, butApres, m, owner, { ...opts, profondeur: PROFONDEUR_FIN - 1 });
      if (v === null) continue;
      const perte = ref - v * signe;
      if (perte >= 1) return { reponse: m, perte, ko, fait };
    }
    return null;
  };
  return essai({ maitre: moi }, ref.maitre, false) ?? essai({}, ref.simple, true);
}
