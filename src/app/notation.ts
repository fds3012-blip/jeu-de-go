// Revue v3 (#405) : notes de coup pensées pour le go. Logique pure, testée dans notation.test.ts.
// Seuils et raisons documentés dans docs/game-design/notation-go.md.
//
// La base vient de `noterCoups` (revue.ts) : la perte en points de chaque coup, d'après KataGo ou le moteur simple.
// Ce module ajoute ce que le go a de propre, en lisant le plateau :
// - Classique : coup d'ouverture connu (3-3, 3-4, 4-4, 3-5, 4-5, centre en 9 × 9, approche, fermeture) ;
// - Forcé : la réponse obligée à un atari (sauver le groupe, ou prendre les pierres qui le menacent) ;
// - Coup manqué : l'adversaire vient de se tromper et tu ne l'as pas puni (KataGo seulement) ;
// - Gaffe : très grosse perte, ou un groupe pris juste après ;
// - Brillant « seul bon coup » : premier choix de KataGo, toute autre réponse perd gros, et ce n'est ni une prise ni
//   un sauvetage évident (un sacrifice, un tesuji, un point vital). Toujours confirmé par une analyse longue ;
// - Passe trop tôt : une passe qui coûte des points.
// Règle d'or, inchangée : aucune note fausse. Sans KataGo, ni Brillant, ni Meilleur, ni Coup manqué.
import { groupAt, neighbors, play, type Color, type Position } from '../go/rules';
import { facteurTaille, seuilsKataGo, seuilsSimple, VISITES_MIN, type AnalyseRevue, type Note, type NoteCoup } from './revue';

/** Pourquoi un coup a sa note : sert à la phrase de Mochi. */
export type Raison =
  | 'coin33' | 'coin34' | 'coin44' | 'coin35' | 'coin45' | 'tengen' | 'approche' | 'fermeture'
  | 'sauve' | 'prend' | 'sacrifice' | 'tesuji' | 'pointVital' | 'mieuxQueKataGo' | 'groupePris';

export interface CoupNote extends NoteCoup {
  raison?: Raison;
  /** Meilleur coup de KataGo, s'il diffère du coup joué (index interne, jamais une passe). */
  meilleur?: number;
  /** Passe qui a coûté des points. */
  passeTot?: boolean;
  /** Coup manqué : pierres que le meilleur coup aurait prises. */
  prisesManquees?: number;
  /** Gaffe par groupe pris : pierres prises par l'adversaire juste après. */
  prisesApres?: number;
}

/** Fin de l'ouverture, en nombre de coups joués (les deux camps) : 9 × 9 : 8, 13 × 13 : 14, 19 × 19 : 24. */
export const finOuverture = (size: number) => (size <= 9 ? 8 : size <= 13 ? 14 : 24);

/** Côté d'une « zone de coin » : 9 × 9 : 4 lignes, 13 × 13 : 5, 19 × 19 : 7. */
const coteCoin = (size: number) => (size <= 9 ? 4 : size <= 13 ? 5 : 7);

/** Coin (0 à 3) dont la zone contient `p`, ou -1 (bords et centre). */
function coinDe(p: number, size: number): number {
  const c = coteCoin(size), x = p % size, y = Math.floor(p / size);
  const gx = x < c ? 0 : x >= size - c ? 1 : -1, gy = y < c ? 0 : y >= size - c ? 1 : -1;
  return gx < 0 || gy < 0 ? -1 : gy * 2 + gx;
}

/** Lignes depuis le bord le plus proche, en x et en y (1 = première ligne), la plus petite d'abord. */
function lignes(p: number, size: number): [number, number] {
  const x = p % size, y = Math.floor(p / size);
  const a = Math.min(x, size - 1 - x) + 1, b = Math.min(y, size - 1 - y) + 1;
  return a <= b ? [a, b] : [b, a];
}

/**
 * Coup d'ouverture classique : la raison, ou `undefined`. `avant` : position avant le coup, `p` : le coup.
 * - point de coin dans un coin encore vide : 3-3, 3-4, 4-4, 3-5, 4-5 (en 9 × 9 : 3-3, 3-4, 4-4 et le centre ; en 13 × 13 : sans le 4-5) ;
 * - approche : une seule pierre adverse dans le coin, aucune à toi, et tu joues à 2 à 4 lignes d'elle (jamais collé), sur la 3e ou la 4e ligne d'un côté, au plus la 6e de l'autre ;
 * - fermeture : une seule pierre à toi dans le coin, aucune adverse, et ta 2e pierre à 2 à 4 lignes d'elle.
 */
export function raisonClassique(avant: Position, p: number): Raison | undefined {
  const n = avant.size;
  if (p < 0 || avant.board[p]) return undefined;
  const [a, b] = lignes(p, n);
  if (n <= 9 && a === 5 && b === 5) return 'tengen';
  const coin = coinDe(p, n);
  if (coin < 0) return undefined;
  const moi = avant.toPlay, miennes: number[] = [], siennes: number[] = [];
  for (let q = 0; q < n * n; q++) {
    if (!avant.board[q] || coinDe(q, n) !== coin) continue;
    (avant.board[q] === moi ? miennes : siennes).push(q);
  }
  if (!miennes.length && !siennes.length) {
    if (a === 3 && b === 3) return 'coin33';
    if (a === 3 && b === 4) return 'coin34';
    if (a === 4 && b === 4) return 'coin44';
    if (n >= 13 && a === 3 && b === 5) return 'coin35';
    if (n >= 19 && a === 4 && b === 5) return 'coin45';
    return undefined;
  }
  if (a < 3 || a > 4 || b > 6) return undefined;
  const loin = (q: number) => {
    const dx = Math.abs((q % n) - (p % n)), dy = Math.abs(Math.floor(q / n) - Math.floor(p / n));
    return dx + dy >= 2 && Math.max(dx, dy) >= 2 && Math.max(dx, dy) <= 4;
  };
  if (siennes.length === 1 && !miennes.length && loin(siennes[0])) return 'approche';
  if (miennes.length === 1 && !siennes.length && loin(miennes[0])) return 'fermeture';
  return undefined;
}

/** Chaînes de `couleur` mises en atari par le dernier coup (une liberté après, plus d'une avant). */
function misesEnAtari(avant: Position, apres: Position, couleur: Color): number[][] {
  const n = apres.size, vu = new Uint8Array(n * n), out: number[][] = [];
  for (let p = 0; p < n * n; p++) {
    if (apres.board[p] !== couleur || vu[p]) continue;
    const g = groupAt(apres.board, n, p);
    for (const s of g.stones) vu[s] = 1;
    if (g.liberties.size !== 1) continue;
    const g0 = avant.board[p] === couleur ? groupAt(avant.board, n, p) : null;
    if (!g0 || g0.liberties.size > 1) out.push([...g.stones]);
  }
  return out;
}

/**
 * Réponse forcée : la raison (`sauve` ou `prend`), ou `undefined`. `i` : numéro du coup. Le coup précédent (adverse)
 * a mis une de tes chaînes en atari, et ton coup la sauve (elle a au moins 2 libertés ensuite) en la prolongeant,
 * en la reliant ou en prenant les pierres qui la menaçaient. Une pierre seule ne compte pas : on peut l'abandonner.
 */
export function raisonForcee(positions: Position[], i: number): 'sauve' | 'prend' | undefined {
  if (i < 2) return undefined;
  const avant = positions[i - 1], apres = positions[i], moi = avant.toPlay, p = apres.lastMove ?? -1;
  if (p < 0 || (positions[i - 1].lastMove ?? -1) < 0) return undefined;
  const menacees = misesEnAtari(positions[i - 2], avant, moi).filter(g => g.length >= 2);
  if (!menacees.length) return undefined;
  const n = apres.size;
  const sauvee = menacees.find(g => apres.board[g[0]] === moi && groupAt(apres.board, n, g[0]).liberties.size >= 2);
  if (!sauvee) return undefined;
  return apres.captures[moi] > avant.captures[moi] ? 'prend' : 'sauve';
}

/** Pierres que prendrait le coup `p` joué dans `pos` (0 si illégal). */
export function prisesDuCoup(pos: Position, p: number): number {
  if (p < 0) return 0;
  const r = play(pos, p);
  return typeof r === 'string' ? 0 : r.captures[pos.toPlay] - pos.captures[pos.toPlay];
}

/** Raison d'un Brillant « seul bon coup » : sacrifice (ton coup se met en atari), tesuji (il touche une chaîne adverse à 2 libertés ou moins), sinon point vital. */
function raisonBrillante(avant: Position, apres: Position, p: number): Raison {
  const n = apres.size, moi = avant.toPlay, adv = (3 - moi) as Color;
  if (apres.board[p] === moi && groupAt(apres.board, n, p).liberties.size === 1) return 'sacrifice';
  for (const v of neighbors(n)[p]) if (apres.board[v] === adv && groupAt(apres.board, n, v).liberties.size <= 2) return 'tesuji';
  return 'pointVital';
}

/** Au-delà de cette avance (ramenée au 9 × 9), la partie est jouée : pas de Brillant. */
const PARTIE_JOUEE = 15;

/**
 * Coups candidats au Brillant « seul bon coup » (KataGo seulement) : le coup joué est le premier choix, bien exploré ;
 * le deuxième candidat, lui aussi exploré, perd au moins le seuil d'Erreur ; la partie n'est pas jouée ; et ce n'est
 * pas un coup évident (une prise, une réponse forcée, un coup d'ouverture). À confirmer par `confirmeUnique`.
 */
export function candidatsUniques(positions: Position[], analyses: (AnalyseRevue | null)[]): number[] {
  const out: number[] = [];
  const size = positions[0]?.size ?? 9, T = seuilsKataGo(size), f = facteurTaille(size);
  for (let i = 1; i < positions.length; i++) {
    const a = analyses[i - 1], move = positions[i].lastMove ?? -1;
    if (!a || a.engine !== 'katago' || move < 0) continue;
    const [premier, second] = a.coups ?? [];
    if (!premier || !second || premier.move !== move || premier.visits < VISITES_MIN || second.visits < VISITES_MIN) continue;
    if (premier.lead - second.lead < T.erreur || Math.abs(premier.lead) >= PARTIE_JOUEE * f) continue;
    if (i <= finOuverture(size) || positions[i].captures[positions[i - 1].toPlay] > positions[i - 1].captures[positions[i - 1].toPlay]) continue;
    if (raisonForcee(positions, i)) continue;
    out.push(i);
  }
  return out;
}

/** Vrai si l'analyse longue de la position d'avant garde le coup en tête, avec le même écart sur le deuxième. */
export function confirmeUnique(longue: AnalyseRevue | null | undefined, move: number, size: number): boolean {
  if (!longue || longue.engine !== 'katago') return false;
  const [premier, second] = longue.coups ?? [];
  if (!premier || premier.move !== move || premier.visits < VISITES_MIN) return false;
  return !second || premier.lead - second.lead >= seuilsKataGo(size).erreur;
}

/** Notes qui laissent la place à Classique ou Forcé (le coup ne perd presque rien). */
const BONNES: ReadonlySet<Note> = new Set(['meilleur', 'excellent', 'bon', 'solide']);

/**
 * Notes du go (#405), à partir des notes de base (`noterCoups`, éventuellement accordées au moment clé).
 * `uniques` : coups dont le Brillant « seul bon coup » est confirmé par une analyse longue.
 */
export function classerCoups(positions: Position[], analyses: (AnalyseRevue | null)[], base: (NoteCoup | null)[], uniques: ReadonlySet<number> = new Set()): (CoupNote | null)[] {
  const size = positions[0]?.size ?? 9, T = seuilsKataGo(size), S = seuilsSimple(size);
  const out: (CoupNote | null)[] = [];
  for (let i = 1; i < positions.length; i++) {
    const b = base[i - 1];
    if (!b) { out.push(null); continue; }
    const avant = positions[i - 1], apres = positions[i], move = apres.lastMove ?? -1, moi = avant.toPlay, adv = (3 - moi) as Color;
    const a = analyses[i - 1], katago = a?.engine === 'katago';
    const c: CoupNote = { ...b };
    const premier = katago ? a!.coups?.[0] : undefined;
    if (premier && premier.move >= 0 && premier.move !== move && premier.visits >= VISITES_MIN) c.meilleur = premier.move;
    if (c.note === 'brillant') c.raison = 'mieuxQueKataGo';
    const petite = katago ? T.bon : S.solide, imprecision = katago ? T.imprecision : S.solide;

    if (move < 0) {
      if (c.perte >= imprecision) c.passeTot = true;
      out.push(c);
      continue;
    }
    // Brillant « seul bon coup », confirmé.
    if (katago && uniques.has(i) && c.note === 'meilleur') { c.note = 'brillant'; c.raison = raisonBrillante(avant, apres, move); out.push(c); continue; }
    if (c.note === 'brillant') { out.push(c); continue; }

    // Forcé : réponse obligée à un atari, qui ne perd presque rien.
    const forcee = raisonForcee(positions, i);
    if (forcee && BONNES.has(c.note) && c.perte <= petite) { c.note = 'force'; c.raison = forcee; out.push(c); continue; }

    // Classique : coup d'ouverture connu, qui ne perd presque rien.
    const classique = i <= finOuverture(size) ? raisonClassique(avant, move) : undefined;
    if (classique && BONNES.has(c.note) && c.perte <= petite) { c.note = 'classique'; c.raison = classique; out.push(c); continue; }

    // Gaffe par groupe pris : une Erreur suivie de la prise d'au moins 3 de tes pierres.
    const suite = positions[i + 1];
    const prises = suite && (suite.lastMove ?? -1) >= 0 ? suite.captures[adv] - apres.captures[adv] : 0;
    if (c.note === 'erreur' && prises >= 3) { c.note = 'grosse'; c.raison = 'groupePris'; c.prisesApres = prises; }
    else if (c.note === 'grosse' && prises >= 3) { c.raison = 'groupePris'; c.prisesApres = prises; }

    // Coup manqué (KataGo seulement) : l'adversaire venait de faire une Erreur ou une Gaffe, et ton coup perd encore des points.
    const prec = out[i - 2];
    if (katago && prec && prec.couleur !== c.couleur && (prec.note === 'erreur' || prec.note === 'grosse') && (c.note === 'imprecision' || c.note === 'erreur')) {
      c.note = 'manque';
      if (c.meilleur != null) c.prisesManquees = prisesDuCoup(avant, c.meilleur);
    }
    out.push(c);
  }
  return out;
}

/** Notes qui font un coup clé du parcours. */
const CLES_TOUJOURS: ReadonlySet<Note> = new Set(['brillant', 'erreur', 'manque', 'grosse']);
/** Nombre maximal de coups clés dans le parcours. */
export const MAX_CLES = 12;

/**
 * Coups clés du parcours (#405), dans l'ordre de la partie : Mochi ne commente qu'eux.
 * Pour toi (`joueur` ; les deux camps si `null`) : Brillant, Erreur, Coup manqué, Gaffe, passe trop tôt, tes 2 premiers
 * coups classiques et 3 de tes meilleurs coups ; pour l'adversaire, ses Gaffes (ce qu'il fallait punir) ; et le moment
 * clé. Moins de 3 coups clés : tes imprécisions complètent. Au-delà de 12, on retire d'abord les meilleurs coups, puis
 * les classiques, puis les gaffes de l'adversaire, puis les plus petites pertes.
 */
export function coupsCles(notes: (CoupNote | null)[], joueur: Color | null, cle?: number | null): number[] {
  const miens = (n: CoupNote) => !joueur || n.couleur === joueur;
  type P = { coup: number; rang: number; perte: number };
  const choix = new Map<number, P>();
  const ajoute = (n: CoupNote, rang: number) => { const d = choix.get(n.coup); if (!d || d.rang < rang) choix.set(n.coup, { coup: n.coup, rang, perte: n.perte }); };
  let classiques = 0, meilleurs = 0;
  for (const n of notes) {
    if (!n) continue;
    if (miens(n)) {
      if (CLES_TOUJOURS.has(n.note) || n.passeTot) ajoute(n, 4);
      else if (n.note === 'classique' && classiques < 2) { classiques++; ajoute(n, 1); }
      else if (n.note === 'meilleur' && meilleurs < 3) { meilleurs++; ajoute(n, 0); }
    } else if (n.note === 'grosse') ajoute(n, 2);
  }
  if (cle != null && notes[cle - 1]) ajoute(notes[cle - 1]!, 5);
  if (choix.size < 3) {
    for (const n of notes) if (n && miens(n) && n.note === 'imprecision' && choix.size < 3) ajoute(n, 3);
  }
  let liste = [...choix.values()];
  if (liste.length > MAX_CLES) liste = liste.sort((x, y) => y.rang - x.rang || y.perte - x.perte || x.coup - y.coup).slice(0, MAX_CLES);
  return liste.map(p => p.coup).sort((x, y) => x - y);
}

/** Notes du tableau du bilan, selon le moteur : sans KataGo, ni Brillant, ni Meilleur, ni Excellent, ni Bon, ni Coup manqué. */
export function lignesBilan(avecKataGo: boolean): Note[] {
  return avecKataGo
    ? ['brillant', 'meilleur', 'excellent', 'bon', 'classique', 'force', 'imprecision', 'erreur', 'manque', 'grosse']
    : ['classique', 'solide', 'force', 'imprecision', 'erreur', 'grosse'];
}

/** Notes marquées sur la courbe du bilan (les moments qui comptent). */
export const NOTES_COURBE: ReadonlySet<Note> = new Set(['brillant', 'erreur', 'manque', 'grosse']);
