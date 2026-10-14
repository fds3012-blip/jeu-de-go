// Issue #549 : comprendre son erreur, et voir la solution complète. Logique pure, sans React.
//
// Règle d'or : aucune phrase de go inventée. Tout ce qui est montré ici sort du lecteur exact de capture
// (src/go/lecture-capture.ts) et des règles (src/go/rules.ts) :
// - la réponse de l'adversaire à un coup faux est un coup **prouvé** : après lui, le but du problème n'est plus
//   atteignable (prendre : tu ne peux plus prendre les pierres marquées dans le nombre de coups de la solution ;
//   sauver : ta pierre marquée sera prise quoi que tu fasses, dans la borne de lecture) ;
// - la phrase ne dit que des faits lus sur le plateau : le point joué, les pierres prises, la chaîne reliée, le nombre de
//   libertés ;
// - la solution complète alterne le bon coup et la défense qui tient le plus longtemps, jusqu'à la prise.
// Si le problème n'est pas de ce type (vie et mort, fin de partie…), ou si la lecture dépasse son budget, rien n'est
// calculé : le lecteur garde le comportement d'avant (#197, #237), le texte relu du problème.
import { groupAt, play, type Color, type Position } from '../go/rules';
import { toLabel } from '../go/coords';
import {
  attaquantPrend, compteur, coupsAvantPrise, coupsPourPrendre, defenseurEchoue, ordreDefense, prise, BUDGET_LECTURE, DELAI_LECTURE, K_ECHELLE, type Compteur
} from '../go/lecture-capture';
import { startOf, type Puzzle } from '../data/puzzles';
import { t } from '../content/i18n/secondaires';

/** But lisible sur le plateau : prendre les pierres marquées de l'adversaire, ou sauver les tiennes. */
export type But = { type: 'prendre' | 'sauver'; cibles: number[] };

/** Le but d'un problème, d'après ses pierres marquées ; `null` s'il n'en a pas, ou des deux couleurs. */
export function butDe(pz: Puzzle): But | null {
  const { pos, marked } = startOf(pz);
  if (!marked.length) return null;
  const couleurs = new Set(marked.map(m => pos.board[m]));
  if (couleurs.size !== 1) return null;
  return { type: couleurs.has(pz.toPlay) ? 'sauver' : 'prendre', cibles: marked };
}

const joue = (pos: Position, m: number): Position | null => {
  const r = play(pos, m);
  return typeof r === 'string' ? null : r;
};

/** Pierres d'une couleur retirées entre deux positions. */
const prises = (avant: Position, apres: Position, c: Color) => {
  let n = 0;
  for (let i = 0; i < avant.board.length; i++) if (avant.board[i] === c && apres.board[i] !== c) n++;
  return n;
};

/**
 * État des pierres marquées encore sur le plateau, en une phrase : leurs libertés (la plus petite, et si elles diffèrent
 * d'une chaîne à l'autre). Fait lu sur le plateau.
 */
function etatCibles(pos: Position, cibles: readonly number[]): { phrase: string; min: number } {
  const vues = new Set<number>(), libs: number[] = [];
  for (const c of cibles) {
    if (!pos.board[c] || vues.has(c)) continue;
    const g = groupAt(pos.board, pos.size, c);
    g.stones.forEach(s => vues.add(s));
    libs.push(g.liberties.size);
  }
  const min = Math.min(...libs);
  const cle = libs.length === 1 ? (vues.size === 1 ? 'erreur.libertes.pierre' : 'erreur.libertes.groupe')
    : libs.every(l => l === min) ? 'erreur.libertes.chacun' : 'erreur.libertes.auMoins';
  return { phrase: t(cle, { n: min }), min };
}

/** Le coup `m` relie-t-il une chaîne des cibles à une autre chaîne de sa couleur ? */
function relie(avant: Position, apres: Position, m: number, cibles: readonly number[]): boolean {
  const c = apres.board[m];
  const chaine = new Set(groupAt(apres.board, apres.size, m).stones);
  if (!cibles.some(x => chaine.has(x))) return false;
  const chainesAvant = new Set<number>();
  for (const s of chaine) {
    if (s === m || avant.board[s] !== c) continue;
    chainesAvant.add(Math.min(...groupAt(avant.board, avant.size, s).stones));
  }
  return chainesAvant.size >= 2;
}

/** Coups qu'il te reste à jouer après le bon coup pour prendre (lu une fois par problème). */
const DU_BON_COUP = new WeakMap<Puzzle, number | null>();
function coupsDuBonCoup(pz: Puzzle, depart: Position, cibles: readonly number[], c: Compteur): number | null {
  if (DU_BON_COUP.has(pz)) return DU_BON_COUP.get(pz)!;
  const apresBon = joue(depart, pz.answers[0]);
  const avant = c.reste;
  // Lecture complète d'abord, puis lecture d'échelle (une prise trouvée suffit : on cherche une borne, pas un « non »).
  const k = apresBon ? coupsAvantPrise(apresBon, cibles, c) ?? coupsAvantPrise(apresBon, cibles, c, K_ECHELLE, true) : null;
  // Un budget épuisé n'est pas une réponse : on ne le garde pas.
  if (k !== null || c.reste >= 0 || avant < 0) DU_BON_COUP.set(pz, k);
  return k;
}

/** Réponse prouvée de l'adversaire à un coup faux, et la phrase qui la dit. */
export interface ErreurComprise {
  faux: number;
  /** Coup de l'adversaire. */
  reponse: number;
  /** Position après le coup faux. */
  apresFaux: Position;
  /** Position après la réponse. */
  pos: Position;
  /** Une phrase courte, faite de faits lus sur le plateau. */
  phrase: string;
}

const nomCouleur = (c: Color) => t(c === 1 ? 'erreur.noir' : 'erreur.blanc');

/** Les bonnes réponses d'abord (« le point clé de ton adversaire est ton point clé »), puis l'ordre naturel. */
const candidats = (pos: Position, pz: Puzzle, ordre: number[]) =>
  [...new Set([...pz.answers, ...ordre])].filter(m => m >= 0 && !pos.board[m]);

/**
 * Comprendre un coup faux (#549) : la réponse de l'adversaire qui le réfute, prouvée par le lecteur exact, et sa phrase.
 * `null` quand le problème n'est pas une prise ou un sauvetage, quand le coup faux atteint quand même le but, ou quand
 * la lecture dépasse son budget : le lecteur garde alors le texte du problème.
 */
export function comprendreErreur(pz: Puzzle, faux: number, c: Compteur = compteur()): ErreurComprise | null {
  const but = butDe(pz);
  if (!but || pz.answers.includes(faux)) return null;
  const depart = startOf(pz).pos;
  const apresFaux = joue(depart, faux);
  if (!apresFaux) return null;
  const adv = apresFaux.toPlay, moi = pz.toPlay;
  if (but.type === 'prendre') {
    // Combien de coups te restait-il avec le bon coup ? Le faux doit les avoir perdus.
    const k = coupsDuBonCoup(pz, depart, but.cibles, c);
    if (k === null || prise(apresFaux, but.cibles, adv)) return null;
    for (const m of candidats(apresFaux, pz, ordreDefense(apresFaux, but.cibles))) {
      const r = joue(apresFaux, m);
      if (!r) continue;
      const v = attaquantPrend(r, but.cibles, k, c);
      if (v === null) return null;
      if (v) continue;
      return { faux, reponse: m, apresFaux, pos: r, phrase: phrasePrendre(apresFaux, r, m, but.cibles, adv) };
    }
    return null;
  }
  // Sauver : l'adversaire prend ta pierre marquée quoi que tu fasses, dans la borne (lecture complète, sinon d'échelle :
  // une prise trouvée contre toutes tes défenses est une preuve).
  let echelle = false;
  let k = coupsPourPrendre(apresFaux, but.cibles, c);
  if (k === null) { echelle = true; k = coupsPourPrendre(apresFaux, but.cibles, c, K_ECHELLE, true); }
  if (k === null) return null;
  for (const m of candidats(apresFaux, pz, ordreDefense(apresFaux, but.cibles))) {
    const r = joue(apresFaux, m);
    if (!r) continue;
    const v = defenseurEchoue(r, but.cibles, k - 1, c, echelle);
    if (v === null) return null;
    if (!v) continue;
    const phrase = t(prise(r, but.cibles, moi) ? 'erreur.sauver.prise' : 'erreur.sauver.perdue', { couleur: nomCouleur(adv), point: toLabel(m, pz.size) });
    return { faux, reponse: m, apresFaux, pos: r, phrase };
  }
  return null;
}

function phrasePrendre(avant: Position, apres: Position, m: number, cibles: readonly number[], adv: Color): string {
  const point = toLabel(m, apres.size), couleur = nomCouleur(adv);
  const n = prises(avant, apres, (3 - adv) as Color);
  const etat = etatCibles(apres, cibles).phrase;
  const geste = n > 0 ? t('erreur.prendre.prise', { couleur, point, n })
    : relie(avant, apres, m, cibles) ? t('erreur.prendre.relie', { couleur, point })
    : t('erreur.prendre.repond', { couleur, point });
  return `${geste} ${etat}`;
}

/** Une position de la solution complète, avec sa légende. */
export interface CadreSolution { pos: Position; legende: string }

/** Coups de la solution au plus (bon coup et défenses comprises) : au-delà, la suite n'est pas montrée. */
export const SOLUTION_MAX = 2 * K_ECHELLE;

/**
 * Solution complète d'un problème de prise (#549) : le bon coup, puis la défense qui tient le plus longtemps, puis ton
 * coup qui prend le plus vite, et ainsi de suite jusqu'à la prise. Chaque coup est prouvé par le lecteur exact. `null`
 * si le problème n'est pas une prise, si la suite tient en un seul coup (la réponse suffit), ou si la lecture dépasse
 * son budget (la solution s'ouvre sur un geste du joueur : trois fois le délai d'une réfutation, 120 ms au plus).
 */
export function solutionComplete(pz: Puzzle, c: Compteur = compteur(3 * BUDGET_LECTURE, 3 * DELAI_LECTURE)): CadreSolution[] | null {
  const but = butDe(pz);
  if (!but || but.type !== 'prendre') return null;
  const depart = startOf(pz).pos, moi = pz.toPlay, adv = (3 - moi) as Color;
  const premier = joue(depart, pz.answers[0]);
  if (!premier) return null;
  const cadres: CadreSolution[] = [{ pos: depart, legende: '' }, { pos: premier, legende: legendeAttaque(depart, premier, pz.answers[0], but.cibles, moi) }];
  let pos = premier;
  // Coups qu'il te faut encore, l'adversaire au trait : lecture complète, sinon lecture d'échelle (ton coup sur une
  // liberté des pierres marquées à chaque tour ; une prise trouvée contre toutes les défenses reste une preuve).
  let echelle = false;
  let k = coupsAvantPrise(pos, but.cibles, c);
  if (k === null) { echelle = true; k = coupsAvantPrise(pos, but.cibles, c, K_ECHELLE, true); }
  if (k === null) return null;
  while (!prise(pos, but.cibles, adv)) {
    if (cadres.length > SOLUTION_MAX) return null;
    // La défense qui tient le plus longtemps parmi les coups au contact (libertés des pierres marquées et leurs voisins) :
    // celle après laquelle il te faut le plus de coups ; à égalité, la plus naturelle (ordreDefense). S'il n'y en a
    // aucune de jouable, l'adversaire ne peut plus rien : la suite le dit, sans inventer de coup (passe).
    let meilleure: { m: number; r: Position; k: number } | null = null;
    const locaux = ordreDefense(pos, but.cibles);
    for (const m of locaux.slice(0, locaux.indexOf(-1))) {
      const r = joue(pos, m);
      if (!r || prise(r, but.cibles, adv)) continue;
      const kr = coupsPourPrendre(r, but.cibles, c, k, echelle);
      if (kr === null) return null;
      if (!meilleure || kr > meilleure.k) meilleure = { m, r, k: kr };
      if (kr === k) break;
    }
    if (meilleure) {
      cadres.push({ pos: meilleure.r, legende: legendeDefense(pos, meilleure.r, meilleure.m, but.cibles, adv) });
      pos = meilleure.r;
      k = meilleure.k;
    } else {
      const passe = joue(pos, -1);
      if (!passe) return null;
      cadres.push({ pos: passe, legende: t('solution.sansDefense', { couleur: nomCouleur(adv) }) });
      pos = passe;
    }
    // Ton coup qui prend en `k` coups au plus (les libertés des pierres marquées d'abord).
    let choisi: { m: number; r: Position } | null = null;
    for (const m of ordreDefense(pos, but.cibles)) {
      if (m < 0) continue;
      const r = joue(pos, m);
      if (!r) continue;
      const v = defenseurEchoue(r, but.cibles, k - 1, c, echelle);
      if (v === null) return null;
      if (v) { choisi = { m, r }; break; }
    }
    if (!choisi) return null;
    cadres.push({ pos: choisi.r, legende: legendeAttaque(pos, choisi.r, choisi.m, but.cibles, moi) });
    pos = choisi.r;
    k -= 1;
  }
  return cadres.length > 2 ? cadres : null;
}

function legendeAttaque(avant: Position, apres: Position, m: number, cibles: readonly number[], moi: Color): string {
  const point = toLabel(m, apres.size), couleur = nomCouleur(moi), adv = (3 - moi) as Color;
  const n = prises(avant, apres, adv);
  if (prise(apres, cibles, adv)) return t('solution.prise', { couleur, point, n });
  const e = etatCibles(apres, cibles);
  const geste = n > 0 ? t('erreur.prendre.prise', { couleur, point, n }) : t(e.min === 1 ? 'solution.atari' : 'solution.coup', { couleur, point });
  return `${geste} ${e.phrase}`;
}

function legendeDefense(avant: Position, apres: Position, m: number, cibles: readonly number[], adv: Color): string {
  const point = toLabel(m, apres.size), couleur = nomCouleur(adv);
  const n = prises(avant, apres, (3 - adv) as Color);
  const geste = n > 0 ? t('solution.defense.prise', { couleur, point, n }) : t('solution.defense', { couleur, point });
  return `${geste} ${etatCibles(apres, cibles).phrase}`;
}
