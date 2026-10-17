// Répertoire d'ouvertures (#591) : lecture des séquences stockées en SGF et positions coup par coup. Logique pure.
//
// Une entrée est une petite partie SGF : `(;SZ[19]AB[..]AW[..];W[..];B[..])`. Les pierres de départ (AB, AW) règlent
// le reste du plateau ; les coups (B, W) forment la séquence montrée. Chaque erreur courante remplace un coup de la
// séquence (`coup` : son rang, à partir de 0), et la réplique de l'adversaire (`reponse`), quand elle est donnée, est
// celle de KataGo dans chaque symétrie (src/go/ouvertures.test.ts).
import { lireArbreSgf } from './arbreSgf';
import { fromSgf } from './coords';
import { newPosition, play, type Color, type Position } from './rules';

export interface ErreurOuverture {
  /** Rang (à partir de 0) du coup de la séquence que l'erreur remplace. */
  coup: number;
  /** Point de l'erreur, en SGF (« cc »). */
  c: string;
  /** Réplique de l'adversaire, en SGF ; absente si KataGo ne la donne pas la même dans chaque symétrie. */
  reponse?: string;
  /** Ce que coûte l'erreur, en points, face au coup de la séquence (arrondi ; mesuré par KataGo). */
  perte: number;
}

export interface Ouverture {
  id: string;
  taille: 9 | 19;
  /** Zone montrée (src/content/cadreLecon.ts) ; absente : tout le plateau. */
  cadre?: 'bas-gauche';
  sgf: string;
  erreurs: ErreurOuverture[];
  /**
   * Après le dernier coup, la meilleure réponse de KataGo est hors de la zone montrée, dans chaque symétrie : le coin
   * est réglé, l'écran le dit (« … peut jouer ailleurs »).
   */
  ailleurs?: boolean;
  /**
   * Coups écartés, jamais montrés : jugés et figés avec la séquence, pour que la note pédagogique cite une mesure
   * prouvée (src/go/ouvertures.test.ts : ils perdent plus que TOLERANCE_DEMO).
   */
  ecartes?: { coup: number; c: string }[];
}

export interface CoupLu { couleur: Color; point: number }
export interface OuvertureLue { depart: Position; coups: CoupLu[] }

const nom = (c: Color) => (c === 1 ? 'B' : 'W');

/** Lit le SGF d'une entrée : position de départ (pierres AB, AW) et coups de la ligne principale. */
export function lireOuverture(o: Pick<Ouverture, 'id' | 'taille' | 'sgf'>): OuvertureLue {
  const racine = lireArbreSgf(o.sgf), n = o.taille;
  if (Number(racine.props.SZ?.[0]) !== n) throw new Error(`${o.id} : SZ ≠ ${n}`);
  const depart = newPosition(n);
  for (const [prop, c] of [['AB', 1], ['AW', 2]] as const) for (const v of racine.props[prop] ?? []) {
    const p = fromSgf(v, n);
    if (p < 0 || depart.board[p]) throw new Error(`${o.id} : ${prop}[${v}] invalide`);
    depart.board[p] = c;
  }
  const coups: CoupLu[] = [];
  for (let x = racine.enfants[0]; x; x = x.enfants[0]) {
    const c: Color | null = x.props.B ? 1 : x.props.W ? 2 : null;
    const v = (x.props.B ?? x.props.W)?.[0];
    if (!c || v === undefined) throw new Error(`${o.id} : nœud sans coup`);
    const p = fromSgf(v, n);
    if (p < 0) throw new Error(`${o.id} : ${nom(c)}[${v}] (passe ou hors plateau)`);
    coups.push({ couleur: c, point: p });
  }
  if (coups.length) depart.toPlay = coups[0].couleur;
  return { depart, coups };
}

/** Joue un coup avec la couleur donnée ; lève une erreur si le coup est illégal. */
export function jouerCoup(pos: Position, c: CoupLu): Position {
  const r = play({ ...pos, toPlay: c.couleur }, c.point);
  if (typeof r === 'string') throw new Error(`coup illégal (${r})`);
  return r;
}

/**
 * Positions de la séquence : `[0]` le départ, `[i]` après i coups (la dernière : toute la séquence jouée). La couleur
 * au trait de `[i]` est celle du coup i (ou l'autre couleur, après le dernier).
 */
export function positionsOuverture(lue: OuvertureLue): Position[] {
  const out = [lue.depart];
  for (const c of lue.coups) {
    const p = jouerCoup(out[out.length - 1], c);
    out.push(p);
  }
  for (let i = 0; i < lue.coups.length; i++) out[i] = { ...out[i], toPlay: lue.coups[i].couleur };
  return out;
}

/** Position montrée par « Voir l'erreur » : l'erreur jouée à la place du coup, puis la réplique s'il y en a une. */
export function positionsErreur(o: Ouverture, lue: OuvertureLue, e: ErreurOuverture): Position[] {
  const avant = positionsOuverture(lue)[e.coup], c = lue.coups[e.coup].couleur;
  const apres = jouerCoup(avant, { couleur: c, point: fromSgf(e.c, o.taille) });
  if (!e.reponse) return [apres];
  return [apres, jouerCoup(apres, { couleur: (3 - c) as Color, point: fromSgf(e.reponse, o.taille) })];
}
