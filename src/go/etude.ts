// Goban libre (#372) : une position posée à la main, puis des coups joués avec les règles. Logique pure.
//
// - La position de départ se pose pierre par pierre (Noir, Blanc, Effacer). Elle reste légale : une pierre posée
//   qui laisserait un groupe, le sien ou un voisin, sans liberté est refusée (rien n'est capturé en posant).
// - « Au trait » dit qui joue le prochain coup (utile à l'analyse).
// - Arbre de variantes (#562) : les coups forment un arbre. La première suite de chaque coup est la ligne principale ;
//   jouer un autre coup depuis une position passée crée une variante au lieu d'effacer la suite. On se déplace sur une
//   « ligne » (la branche choisie à chaque coup, prolongée jusqu'au bout) avec un curseur (0 : position de départ).
//   Variante supprimée ou promue en ligne principale ; retour à la ligne principale.
// - Komi et règle réglables (#562) : komi par demi-point, règle japonaise ou chinoise ; l'analyse reçoit le komi compté
//   (compensation du handicap comprise en chinois, comme les parties depuis #528) et la règle.
// - Export SGF : la position en AB/AW, le trait en PL, le komi en KM, la règle en RU, l'arbre en parenthèses imbriquées,
//   les commentaires en C. Se relit ici (`etudeDepuisSgf`) ; « Analyser une partie » et le partage par lien n'en
//   lisent que la ligne principale (`readSgf`).
import { groupAt, play, type Color, type MoveError, type Position } from './rules';
import { compensationHandicap, handicapDe, score, type Rules, type Score } from './score';
import { fromSgf, toSgf } from './coords';
import { komiLisible } from './importSgf';
import { ecrireArbreSgf, lireArbreSgf, type NoeudSgf } from './arbreSgf';

export type Outil = 'noir' | 'blanc' | 'effacer' | 'jouer';
export const TAILLES_ETUDE = [9, 13, 19] as const;
export type TailleEtude = (typeof TAILLES_ETUDE)[number];
/** Komi proposé d'abord. */
export const KOMI_ETUDE = 6.5;
/** Komi proposés d'un toucher ; tout autre demi-point se règle avec − et +. */
export const KOMIS_ETUDE = [0.5, 5.5, 6.5, 7.5] as const;
/** Komi le plus grand accepté, en valeur absolue. */
export const KOMI_MAX = 50;
/** Longueur maximale d'un commentaire gardé. */
export const MAX_NOTE = 4000;

/** Un coup de l'arbre. */
export interface Coup {
  /** Intersection (y * N + x), -1 : passe. */
  p: number;
  /** Camp qui joue ce coup. */
  c: Color;
  /** Commentaire (SGF `C`), lu dans un fichier : montré tel quel, en texte. */
  note?: string;
  /** Suites : la première est la ligne principale, les autres des variantes. */
  suites: Coup[];
}

export interface Etude {
  size: TailleEtude;
  /** Position posée (0 vide, 1 noir, 2 blanc). */
  depart: Int8Array;
  /** Camp au trait au départ. */
  trait: Color;
  /** Komi : points donnés à Blanc (demi-point). */
  komi: number;
  /** Règle de comptage. */
  regles: Rules;
  /** Commentaire de la position de départ. */
  note?: string;
  /** Coups joués depuis la position de départ ; [0] : ligne principale. */
  suites: Coup[];
  /** Branche choisie à chaque coup, prolongée jusqu'au bout de l'arbre. */
  ligne: number[];
  /** Coups montrés le long de la ligne (0 : position de départ). */
  curseur: number;
}

export function etudeVide(size: TailleEtude = 9): Etude {
  return { size, depart: new Int8Array(size * size), trait: 1, komi: KOMI_ETUDE, regles: 'japanese', suites: [], ligne: [], curseur: 0 };
}

/** Position de départ (sans ko, sans dernier coup). */
export function positionDepart(e: Etude): Position {
  return { size: e.size, board: e.depart, toPlay: e.trait, ko: -1, captures: [0, 0, 0], lastMove: null };
}

/** Joue `p` pour le camp `c` (un fichier peut faire jouer deux fois le même camp : le ko ne vaut alors plus). */
function jouerPour(pos: Position, p: number, c: Color): Position | MoveError {
  return play(c === pos.toPlay ? pos : { ...pos, toPlay: c, ko: -1 }, p);
}

// ---------- Arbre et ligne ----------

/** La ligne `voulue`, corrigée (indices existants) et prolongée par la ligne principale jusqu'au bout de l'arbre. */
export function prolonger(suites: readonly Coup[], voulue: readonly number[]): number[] {
  const out: number[] = [];
  let liste = suites;
  for (let d = 0; liste.length; d++) {
    const v = voulue[d];
    const k = Number.isInteger(v) && v >= 0 && v < liste.length ? v : 0;
    out.push(k);
    liste = liste[k].suites;
  }
  return out;
}

/** Les coups de la ligne, du premier au bout de l'arbre. */
export function coupsDeLaLigne(e: Etude): Coup[] {
  const out: Coup[] = [];
  let liste = e.suites;
  for (const k of e.ligne) {
    const c = liste[k];
    if (!c) break;
    out.push(c);
    liste = c.suites;
  }
  return out;
}

/** Positions de toute la ligne : [départ, après le coup 1, …, bout de la ligne]. */
export function positionsLigne(e: Etude): Position[] {
  const out = [positionDepart(e)];
  for (const c of coupsDeLaLigne(e)) {
    const r = jouerPour(out[out.length - 1], c.p, c.c);
    if (typeof r === 'string') break;
    out.push(r);
  }
  return out;
}

/** Positions jusqu'au curseur : [départ, …, position montrée]. */
export function positionsEtude(e: Etude): Position[] {
  return positionsLigne(e).slice(0, e.curseur + 1);
}

/** Coups joués jusqu'au curseur (-1 : passe). */
export const coupsJoues = (e: Etude): number[] => coupsDeLaLigne(e).slice(0, e.curseur).map(c => c.p);

/** Copie de `suites` où la liste au bout de `chemin` (indices depuis la racine) est remplacée par `f(liste)`. */
function remplacer(suites: readonly Coup[], chemin: readonly number[], f: (l: Coup[]) => Coup[]): Coup[] {
  if (!chemin.length) return f([...suites]);
  const [k, ...reste] = chemin;
  const copie = [...suites];
  copie[k] = { ...copie[k], suites: remplacer(copie[k].suites, reste, f) };
  return copie;
}

/** Suites possibles depuis la position montrée. */
export function suitesIci(e: Etude): Coup[] {
  let liste = e.suites;
  for (const k of e.ligne.slice(0, e.curseur)) liste = liste[k]?.suites ?? [];
  return liste;
}

/** Commentaire de la position montrée. */
export function noteIci(e: Etude): string | undefined {
  return e.curseur === 0 ? e.note : coupsDeLaLigne(e)[e.curseur - 1]?.note;
}

/**
 * Joue un coup depuis la position montrée, avec les règles. Si ce coup existe déjà, on le suit ; sinon il s'ajoute :
 * en suite s'il n'y en avait pas, en variante sinon (la suite d'avant reste la ligne principale).
 */
export function jouerVariante(e: Etude, p: number): Etude | MoveError {
  const pos = positionsEtude(e).at(-1)!;
  const r = play(pos, p);
  if (typeof r === 'string') return r;
  const c = pos.toPlay;
  const chemin = e.ligne.slice(0, e.curseur);
  const ici = suitesIci(e);
  let k = ici.findIndex(x => x.p === p && x.c === c);
  let suites = e.suites;
  if (k < 0) {
    k = ici.length;
    suites = remplacer(e.suites, chemin, l => [...l, { p, c, suites: [] }]);
  }
  return { ...e, suites, ligne: prolonger(suites, [...chemin, k]), curseur: e.curseur + 1 };
}

/** Vrai si jouer `p` ici créerait une variante (une autre suite existe déjà, pas celle-là). */
export function creeraitVariante(e: Etude, p: number): boolean {
  const ici = suitesIci(e);
  return ici.length > 0 && !ici.some(x => x.p === p);
}

/** Montre la position après `k` coups de la ligne (borné). */
export function allerA(e: Etude, k: number): Etude {
  const curseur = Math.max(0, Math.min(e.ligne.length, Math.round(k)));
  return curseur === e.curseur ? e : { ...e, curseur };
}
export const precedent = (e: Etude): Etude => allerA(e, e.curseur - 1);
export const suivant = (e: Etude): Etude => allerA(e, e.curseur + 1);

export interface VarianteIci {
  /** Rang parmi les coups possibles à ce moment (0 : ligne principale). */
  i: number;
  p: number;
  c: Color;
  /** Branche suivie en ce moment. */
  choisie: boolean;
}

/** Les coups possibles au coup montré (au moins deux, sinon liste vide) : la ligne principale d'abord. */
export function variantesIci(e: Etude): VarianteIci[] {
  if (e.curseur === 0) return [];
  let liste = e.suites;
  for (const k of e.ligne.slice(0, e.curseur - 1)) liste = liste[k]?.suites ?? [];
  if (liste.length < 2) return [];
  const choisie = e.ligne[e.curseur - 1];
  return liste.map((x, i) => ({ i, p: x.p, c: x.c, choisie: i === choisie }));
}

/** Suit une autre branche au coup montré (rang donné par `variantesIci`). */
export function choisirVariante(e: Etude, i: number): Etude {
  if (e.curseur === 0) return e;
  const ligne = prolonger(e.suites, [...e.ligne.slice(0, e.curseur - 1), i]);
  return { ...e, ligne };
}

/** Coup où commence la variante montrée (index dans la ligne), ou -1 si la position est sur la ligne principale. */
export function debutVariante(e: Etude): number {
  for (let d = 0; d < e.curseur; d++) if (e.ligne[d] > 0) return d;
  return -1;
}

/** Revient sur la ligne principale, au coup où la variante s'en écarte. */
export function lignePrincipale(e: Etude): Etude {
  const d = debutVariante(e);
  if (d < 0) return e;
  const ligne = prolonger(e.suites, []);
  return { ...e, ligne, curseur: Math.min(d + 1, ligne.length) };
}

/** Supprime la variante montrée (depuis le coup où elle s'écarte, avec toutes ses suites). */
export function supprimerVariante(e: Etude): Etude {
  const d = debutVariante(e);
  if (d < 0) return e;
  const k = e.ligne[d];
  const suites = remplacer(e.suites, e.ligne.slice(0, d), l => l.filter((_, j) => j !== k));
  return { ...e, suites, ligne: prolonger(suites, e.ligne.slice(0, d)), curseur: d };
}

/** Fait de la ligne montrée la ligne principale (à chaque embranchement jusqu'au coup montré). */
export function promouvoirVariante(e: Etude): Etude {
  if (debutVariante(e) < 0) return e;
  let suites = e.suites;
  const ligne = [...e.ligne];
  for (let d = 0; d < e.curseur; d++) {
    const k = ligne[d];
    if (k > 0) {
      suites = remplacer(suites, ligne.slice(0, d), l => [l[k], ...l.filter((_, j) => j !== k)]);
      ligne[d] = 0;
    }
  }
  return { ...e, suites, ligne: prolonger(suites, ligne) };
}

/** Coups de l'arbre et variantes (branches autres que la première). */
export function tailleArbre(e: Etude): { coups: number; variantes: number; notes: number } {
  let coups = 0, variantes = 0, notes = e.note ? 1 : 0;
  const pile: Coup[][] = [e.suites];
  while (pile.length) {
    const l = pile.pop()!;
    l.forEach((c, i) => { coups++; if (i > 0) variantes++; if (c.note) notes++; pile.push(c.suites); });
  }
  return { coups, variantes, notes };
}

// ---------- Position de départ ----------

export type RefusPose = 'sansLiberte';

/** Vrai si chaque groupe touché par `p` (le sien et ses voisins) garde au moins une liberté. */
function legaleAutour(board: Int8Array, size: number, p: number): boolean {
  const aVoir = [p];
  const x = p % size, y = Math.floor(p / size);
  if (x > 0) aVoir.push(p - 1);
  if (x < size - 1) aVoir.push(p + 1);
  if (y > 0) aVoir.push(p - size);
  if (y < size - 1) aVoir.push(p + size);
  return aVoir.every(q => !board[q] || groupAt(board, size, q).liberties.size > 0);
}

/** L'étude avec une autre position de départ : les coups joués partaient d'une autre position, ils sont abandonnés. */
export const avecDepart = (e: Etude, d: Partial<Pick<Etude, 'depart' | 'trait'>>): Etude =>
  ({ ...e, ...d, suites: [], ligne: [], curseur: 0 });

/**
 * Pose (ou efface) une pierre dans la position de départ. Les coups joués sont abandonnés (ils partaient d'une
 * autre position ; « Annuler » les rend). Refus si la position devient illégale (groupe sans liberté).
 */
export function poser(e: Etude, p: number, outil: Exclude<Outil, 'jouer'>): Etude | RefusPose {
  if (p < 0 || p >= e.size * e.size) return e;
  const c = outil === 'noir' ? 1 : outil === 'blanc' ? 2 : 0;
  if (e.depart[p] === c) {
    // Toucher une pierre de la même couleur l'enlève : poser et retirer avec le même outil.
    if (c === 0) return e;
    const depart = e.depart.slice();
    depart[p] = 0;
    return avecDepart(e, { depart });
  }
  const depart = e.depart.slice();
  depart[p] = c;
  if (c && !legaleAutour(depart, e.size, p)) return 'sansLiberte';
  return avecDepart(e, { depart });
}

/** Nombre de pierres sur la position posée. */
export const pierresPosees = (e: Etude): number => e.depart.reduce((n, c) => n + (c ? 1 : 0), 0);

// ---------- Komi et règle ----------

/** Komi ramené au demi-point le plus proche, dans ±KOMI_MAX ; `null` s'il ne se lit pas. */
export function komiValide(k: number): number | null {
  if (!Number.isFinite(k)) return null;
  const r = Math.round(k * 2) / 2;
  return Math.abs(r) <= KOMI_MAX ? r : null;
}

/** Change le komi et/ou la règle (les coups restent : ils ne dépendent pas du comptage). */
export function regler(e: Etude, r: { komi?: number; regles?: Rules }): Etude {
  const komi = r.komi === undefined ? e.komi : komiValide(r.komi) ?? e.komi;
  const regles = r.regles ?? e.regles;
  return komi === e.komi && regles === e.regles ? e : { ...e, komi, regles };
}

/** Pierres de handicap de la position posée (pierres noires seulement, Blanc au trait), 0 sinon. */
export const handicapEtude = (e: Etude): number => handicapDe(positionDepart(e));

/**
 * Ce que reçoit KataGo pour analyser l'étude : le komi compté (en chinois, Blanc reçoit en plus 1 point par pierre de
 * handicap, `compensationHandicap`) et la règle, toujours donnée (une étude n'a pas d'équilibrage à garder).
 */
export function reglagesAnalyse(e: Etude): { komi: number; regles: Rules; handicap: number } {
  const handicap = handicapEtude(e);
  return { komi: e.komi + compensationHandicap(e.regles, handicap), regles: e.regles, handicap };
}

/** Compte la position montrée avec le komi, la règle et le handicap de l'étude (`dead` : pierres mortes retirées). */
export function compterEtude(e: Etude, dead: Set<number> = new Set()): Score {
  return score(positionsEtude(e).at(-1)!, e.komi, e.regles, dead, handicapEtude(e));
}

// ---------- SGF ----------

/** Écrit un komi SGF : `6.5`, `-0.5`, `0`. */
const komiSgf = (k: number) => String(k);

/** L'étude en SGF : position, trait, komi, règle, handicap, arbre des coups et commentaires. */
export function etudeVersSgf(e: Etude): string {
  const props: Record<string, string[]> = {
    GM: ['1'], FF: ['4'], CA: ['UTF-8'], SZ: [String(e.size)], KM: [komiSgf(e.komi)], RU: [e.regles === 'chinese' ? 'Chinese' : 'Japanese'],
  };
  const ha = handicapEtude(e);
  if (ha >= 2 && ha <= 9) props.HA = [String(ha)];
  const ab: string[] = [], aw: string[] = [];
  e.depart.forEach((c, p) => { if (c === 1) ab.push(toSgf(p, e.size)); else if (c === 2) aw.push(toSgf(p, e.size)); });
  if (ab.length) props.AB = ab;
  if (aw.length) props.AW = aw;
  props.PL = [e.trait === 1 ? 'B' : 'W'];
  if (e.note) props.C = [e.note];
  const racine: NoeudSgf = { props, enfants: [] };
  // Sans récursion : chaque coup devient un nœud, ses suites dans l'ordre.
  const pile: { coups: Coup[]; parent: NoeudSgf }[] = [{ coups: e.suites, parent: racine }];
  while (pile.length) {
    const { coups, parent } = pile.pop()!;
    for (const c of coups) {
      const n: NoeudSgf = { props: { [c.c === 1 ? 'B' : 'W']: [toSgf(c.p, e.size)], ...(c.note ? { C: [c.note] } : {}) }, enfants: [] };
      parent.enfants.push(n);
      pile.push({ coups: c.suites, parent: n });
    }
  }
  return ecrireArbreSgf(racine);
}

/** Coup SGF lu : -1 pour une passe (`[]`, `[tt]`), `null` si la coordonnée est hors du goban. */
function coupSgf(v: string, size: number): number | null {
  if (v === '' || v === 'tt') return -1;
  const p = v.length === 2 ? fromSgf(v, size) : -1;
  return p >= 0 ? p : null;
}

const note = (n: NoeudSgf): string | undefined => {
  const t = n.props.C?.join('\n').trim();
  return t ? t.slice(0, MAX_NOTE) : undefined;
};

/**
 * Relit une étude exportée, ou tout SGF de taille 9, 13 ou 19, variantes et commentaires compris ; `null` si le
 * fichier ne convient pas. Chaque coup est rejoué avec les règles : une branche s'arrête au premier coup refusé, ou à
 * un nœud qui pose des pierres en cours de partie (AB, AW, AE hors de la racine), qu'une étude ne sait pas montrer.
 */
export function etudeDepuisSgf(texte: string): Etude | null {
  let racine: NoeudSgf;
  try { racine = lireArbreSgf(texte); } catch { return null; }
  const r = racine.props;
  const size = Number((r.SZ?.[0] ?? '19').split(':')[0]);
  if (size !== 9 && size !== 13 && size !== 19) return null;
  const e = etudeVide(size);
  for (const [cle, c] of [['AB', 1], ['AW', 2]] as const) {
    for (const v of r[cle] ?? []) { const p = fromSgf(v, size); if (p >= 0) e.depart[p] = c; }
  }
  e.komi = komiValide(komiLisible(Number(r.KM?.[0] ?? KOMI_ETUDE))) ?? KOMI_ETUDE;
  e.regles = /chin|aga|area|tromp|nz|new zealand/.test((r.RU?.[0] ?? '').toLowerCase()) ? 'chinese' : 'japanese';
  const pl = r.PL?.[0]?.toUpperCase();
  // Sans PL : le camp du premier coup de la ligne principale, sinon Noir.
  let premier: NoeudSgf | undefined = racine;
  while (premier && !premier.props.B && !premier.props.W) premier = premier.enfants[0];
  e.trait = pl === 'B' ? 1 : pl === 'W' ? 2 : premier?.props.W ? 2 : 1;
  e.note = note(racine);

  const depart = positionDepart(e);
  type Tache = { n: NoeudSgf; liste: Coup[]; parent: Coup | null; pos: Position };
  const taches: Tache[] = [];
  const pousser = (enfants: NoeudSgf[], liste: Coup[], parent: Coup | null, pos: Position) => {
    for (let k = enfants.length - 1; k >= 0; k--) taches.push({ n: enfants[k], liste, parent, pos });
  };
  // Un premier coup écrit dans la racine (certains logiciels) : la racine compte comme un coup.
  if (r.B || r.W) {
    const sansRacine: NoeudSgf = { props: { ...(r.B ? { B: r.B } : { W: r.W! }) }, enfants: racine.enfants };
    e.note = undefined;
    if (racine.props.C) sansRacine.props.C = racine.props.C;
    pousser([sansRacine], e.suites, null, depart);
  } else pousser(racine.enfants, e.suites, null, depart);
  while (taches.length) {
    const { n, liste, parent, pos } = taches.pop()!;
    if (n.props.AB || n.props.AW || n.props.AE) continue;
    const v = n.props.B?.[0] ?? n.props.W?.[0];
    if (v === undefined) {
      // Nœud sans coup (commentaire seul) : son texte rejoint le coup d'avant, ses suites continuent d'ici.
      const t = note(n);
      if (t) {
        if (parent) parent.note = (parent.note ? `${parent.note}\n${t}` : t).slice(0, MAX_NOTE);
        else e.note = (e.note ? `${e.note}\n${t}` : t).slice(0, MAX_NOTE);
      }
      pousser(n.enfants, liste, parent, pos);
      continue;
    }
    const c: Color = n.props.B ? 1 : 2;
    const p = coupSgf(v, size);
    if (p === null) continue;
    const apres = jouerPour(pos, p, c);
    if (typeof apres === 'string') continue;
    // Le même coup deux fois au même endroit (fichier fusionné) : une seule branche.
    let coup = liste.find(x => x.p === p && x.c === c);
    if (!coup) {
      coup = { p, c, suites: [] };
      const t = note(n);
      if (t) coup.note = t;
      liste.push(coup);
    }
    pousser(n.enfants, coup.suites, coup, apres);
  }
  e.ligne = prolonger(e.suites, []);
  e.curseur = e.ligne.length;
  return e;
}

// ---------- Stockage (appareil) ----------

export const ETUDE_KEY = 'go.etude.v1';

/** Ce qui est gardé sur l'appareil : le SGF de l'étude, et où on en était. */
export const etudeAGarder = (e: Etude): { sgf: string; ligne: number[]; curseur: number } => ({ sgf: etudeVersSgf(e), ligne: e.ligne, curseur: e.curseur });

/** Étude gardée sur l'appareil, ou `null` si absente ou abîmée. */
export function lireEtude(brut: unknown): Etude | null {
  if (!brut || typeof brut !== 'object') return null;
  const o = brut as Record<string, unknown>;
  const e = typeof o.sgf === 'string' ? etudeDepuisSgf(o.sgf) : null;
  if (!e) return null;
  if (Array.isArray(o.ligne)) {
    const ligne = prolonger(e.suites, o.ligne.map(Number));
    const k = typeof o.curseur === 'number' ? o.curseur : ligne.length;
    return { ...e, ligne, curseur: Math.max(0, Math.min(ligne.length, Math.round(k) || 0)) };
  }
  return e;
}
