// « Rejouer mes erreurs » : pourquoi le bon coup est le bon (#492). Logique pure, testée dans pourquoi.test.ts.
//
// Règle d'or (Florian) : aucune explication fausse. Chaque motif tactique est un fait calculé sur la position, avec les
// règles seules (src/go/rules.ts) ; rien n'est deviné :
// - prise    : le bon coup enlève des pierres adverses, que ton coup laissait sur le plateau ;
// - sauve    : après ton coup, l'adversaire pouvait prendre des pierres qui étaient déjà en atari ; le bon coup les
//              sort de l'atari (elles forment une seule chaîne d'au moins 2 libertés) et aucun coup adverse ne peut
//              plus les prendre au coup suivant ;
// - protege  : pierres déjà en atari que le bon coup met hors de prise sans en faire une seule chaîne ;
// - risque   : ton coup mettait tes pierres en prise (elles n'étaient pas en atari avant lui) ; après le bon coup,
//              l'adversaire ne peut rien prendre du tout au coup suivant ;
// - coupe    : le bon coup touche deux chaînes adverses distinctes ; après ton coup, l'adversaire les reliait en
//              jouant à cet endroit (vérifié en jouant le coup) ;
// - relie    : le bon coup réunit deux de tes chaînes ; après ton coup, elles restaient séparées et l'adversaire
//              pouvait jouer à cet endroit sans rien prendre ;
// - atari    : le bon coup laisse une seule liberté à des pierres adverses (sa propre chaîne garde au moins 2
//              libertés) ; après ton coup, elles en avaient encore au moins 2.
// Sans motif tactique, des faits de forme (#497), chacun calculé :
// - coupeLaissee : après ton coup, un point vide touche deux de tes chaînes ; l'adversaire peut y jouer sans rien prendre,
//                  sa pierre garde au moins 2 libertés et aucun coup ne relie ensuite tes chaînes ; après le bon coup,
//                  ce n'est plus un point de coupe : chaînes reliées, ou la pierre serait en atari, ou (seulement si
//                  KataGo choisissait d'y couper) il ne touche plus deux de tes chaînes ;
// - pointCommun  : après ton coup, le premier choix de KataGo pour l'adversaire était justement le bon coup ;
// - entree       : avec une zone, la riposte de KataGo pour l'adversaire après ton coup tombe dans cette région ;
// - zone         : la propriété estimée par KataGo après le bon coup et après ton coup, comparée point par point ;
//                  l'écart se fait dans une région (un coin, sinon une moitié stricte du plateau) qui gagne au moins
//                  2 points, au moins 60 % du gain total, et pas plus que le total + 2 (pas de « 10 points en bas »
//                  pour un écart de 2).
// Sinon, la phrase est générale et s'appuie sur l'écart chiffré de KataGo (« environ 6 points »). « Calme »
// n'est dit que si aucune chaîne n'est en atari, ni avant, ni après l'un ou l'autre coup.
import { groupAt, neighbors, play, type Color, type Position } from '../go/rules';
import { toLabel } from '../go/coords';
import { t } from '../content/i18n/secondaires';

export type Motif =
  | { type: 'prise'; pierres: number[] }
  | { type: 'sauve'; pierres: number[]; libertes: number; point: number; menacees: number }
  | { type: 'protege'; pierres: number[]; point: number; menacees: number }
  | { type: 'risque'; pierres: number[]; point: number; menacees: number }
  | { type: 'coupe'; point: number }
  | { type: 'relie'; point: number }
  | { type: 'atari'; pierres: number[]; libertesApresJoue: number };

/** Région du plateau : un coin (quart) ou une moitié stricte (la ligne du milieu n'en fait pas partie) (#497). */
export type Region = 'haut' | 'bas' | 'gauche' | 'droite' | 'hautGauche' | 'hautDroite' | 'basGauche' | 'basDroite';

/** Faits de forme (#497), quand aucun motif tactique n'est sûr. */
export type Forme =
  | { type: 'coupeLaissee'; point: number; parade: 'relie' | 'atari' | 'disparu'; kataGo: boolean }
  | { type: 'pointCommun' }
  | { type: 'zone'; region: Region; gain: number; points: number[] }
  | { type: 'entree'; point: number };

export interface Explication {
  /** Motif vérifié, ou `null` : phrase générale. */
  motif: Motif | null;
  /** Aucune chaîne en atari, avant et après les deux coups (vérifié). */
  calme: boolean;
  /** #497 : faits de forme vérifiés, seulement sans motif tactique (au plus deux phrases). */
  formes?: Forme[];
}

/**
 * Faits de KataGo gardés avec l'erreur (#497), tous relatifs au bon coup (le premier choix de KataGo). Chacun est
 * facultatif : une erreur gardée avant #497, ou venue d'un autre appareil, n'en a pas.
 */
export interface FaitsKataGo {
  /** Variante principale de KataGo depuis la position d'avant : commence par le bon coup, coups légaux, sans passe. */
  suite?: number[];
  /** Après ton coup : la variante principale de KataGo pour l'adversaire (son premier choix d'abord), au plus 4 coups. */
  riposte?: number[];
  /**
   * Zone comparée (propriété de KataGo après le bon coup, moins après ton coup, de ton point de vue) : la région où se
   * fait l'écart, son gain et le gain total (en points), et les intersections vides de la région qui gagnent au moins
   * 0,25 (les carrés montrés sur le plateau).
   */
  zone?: ZoneKataGo;
}

const autre = (c: Color) => (3 - c) as Color;
const trie = (xs: Iterable<number>) => [...new Set(xs)].sort((a, b) => a - b);

function jouer(pos: Position, p: number): Position | null {
  const r = play(pos, p);
  return typeof r === 'string' ? null : r;
}

/** Pierres de couleur `c` présentes dans `avant` et absentes de `apres`. */
function disparues(avant: Int8Array, apres: Int8Array, c: Color): number[] {
  const out: number[] = [];
  for (let p = 0; p < avant.length; p++) if (avant[p] === c && apres[p] !== c) out.push(p);
  return out;
}

/** Chaînes d'une couleur (pierres triées). */
function chaines(pos: Position, c: Color): { stones: number[]; liberties: Set<number> }[] {
  const vu = new Uint8Array(pos.board.length), res: { stones: number[]; liberties: Set<number> }[] = [];
  for (let p = 0; p < pos.board.length; p++) {
    if (pos.board[p] !== c || vu[p]) continue;
    const g = groupAt(pos.board, pos.size, p);
    for (const s of g.stones) vu[s] = 1;
    g.stones.sort((a, b) => a - b);
    res.push(g);
  }
  return res;
}

/**
 * Coups qui prennent, pour le camp au trait : point → pierres prises. Seules les libertés des chaînes adverses en
 * atari peuvent prendre ; chaque coup est joué pour de vrai (ko et suicide compris).
 */
export function coupsQuiPrennent(pos: Position): Map<number, number[]> {
  const o = autre(pos.toPlay), res = new Map<number, number[]>();
  for (const g of chaines(pos, o)) {
    if (g.liberties.size !== 1) continue;
    const q = [...g.liberties][0];
    if (res.has(q)) continue;
    const r = jouer(pos, q);
    if (r) res.set(q, disparues(pos.board, r.board, o));
  }
  return res;
}

/** Une chaîne en atari, d'une couleur ou de l'autre. */
function atariQuelquePart(pos: Position): boolean {
  return ([1, 2] as Color[]).some(c => chaines(pos, c).some(g => g.liberties.size === 1));
}

/** Chaînes distinctes de couleur `c` qui touchent `p` : une pierre par chaîne. */
function voisinesDistinctes(pos: Position, p: number, c: Color): number[] {
  const reps: number[] = [], vues = new Set<number>();
  for (const r of neighbors(pos.size)[p]) {
    if (pos.board[r] !== c || vues.has(r)) continue;
    const g = groupAt(pos.board, pos.size, r);
    g.stones.forEach(s => vues.add(s));
    reps.push(r);
  }
  return reps;
}

const memeChaine = (pos: Position, pierres: number[]) => {
  if (pierres.some(s => pos.board[s] !== pos.board[pierres[0]] || pos.board[s] === 0)) return false;
  const g = new Set(groupAt(pos.board, pos.size, pierres[0]).stones);
  return pierres.every(s => g.has(s));
};

/**
 * Pourquoi `bon` est meilleur que `joue` (-1 : passe) dans `avant`, pour le camp au trait. Motifs dans l'ordre :
 * prise, sauve ou protege, coupe, relie, atari. `null` si `bon` n'est pas jouable (on ne dit alors rien de tactique).
 * Sans motif, les faits de forme (#497) : `faits` doit porter sur ce `bon`-là.
 */
export function expliquer(avant: Position, bon: number, joue: number, faits?: FaitsKataGo): Explication {
  const e = expliquerTactique(avant, bon, joue);
  if (e.motif || bon < 0 || bon === joue) return e;
  const pb = jouer(avant, bon), pj = jouer(avant, joue >= 0 ? joue : -1);
  if (!pb || !pj) return e;
  const formes = formesDe(avant, pb, pj, bon, joue, faits);
  return formes.length ? { ...e, formes } : e;
}

function expliquerTactique(avant: Position, bon: number, joue: number): Explication {
  const c = avant.toPlay, o = autre(c);
  const pb = bon >= 0 ? jouer(avant, bon) : null;
  const pj = jouer(avant, joue >= 0 ? joue : -1);
  if (!pb || !pj || bon === joue) return { motif: null, calme: false };
  const calme = !atariQuelquePart(avant) && !atariQuelquePart(pb) && !atariQuelquePart(pj);

  // 1. Prise : le bon coup prend, ton coup ne prenait pas ces pierres (elles restaient sur le plateau).
  const prises = disparues(avant.board, pb.board, o);
  if (prises.length && prises.every(s => pj.board[s] === o)) return { motif: { type: 'prise', pierres: prises }, calme };

  // 2. Protection : après ton coup, l'adversaire pouvait prendre de tes pierres ; après le bon coup, plus aucune d'elles.
  const capB = new Set([...coupsQuiPrennent(pb).values()].flat());
  let meilleure: { point: number; menacees: number; pierres: number[] } | null = null;
  for (const [q, g] of coupsQuiPrennent(pj)) {
    const pierres = g.filter(s => avant.board[s] === c);
    if (!pierres.length || pierres.some(s => capB.has(s) || pb.board[s] !== c)) continue;
    if (!meilleure || pierres.length > meilleure.pierres.length || (pierres.length === meilleure.pierres.length && q < meilleure.point)) {
      meilleure = { point: q, menacees: g.length, pierres: trie(pierres) };
    }
  }
  if (meilleure) {
    const enAtari = meilleure.pierres.every(s => groupAt(avant.board, avant.size, s).liberties.size === 1);
    const apres = groupAt(pb.board, pb.size, meilleure.pierres[0]);
    const ensemble = new Set(apres.stones);
    if (!enAtari) {
      // Ton coup créait la faiblesse : on le dit seulement si, après le bon coup, l'adversaire ne peut rien prendre.
      if (!capB.size) return { motif: { type: 'risque', ...meilleure }, calme };
    } else if (meilleure.pierres.every(s => ensemble.has(s)) && apres.liberties.size >= 2) {
      return { motif: { type: 'sauve', ...meilleure, libertes: apres.liberties.size }, calme };
    } else return { motif: { type: 'protege', ...meilleure }, calme };
  }

  // 3. Coupe : deux chaînes adverses touchent le bon coup ; après ton coup, l'adversaire les reliait en y jouant.
  const adverses = voisinesDistinctes(avant, bon, o);
  if (adverses.length >= 2 && pj.board[bon] === 0 && adverses.every(s => pj.board[s] === o) && !memeChaine(pj, adverses)) {
    const r = jouer(pj, bon);
    if (r && memeChaine(r, adverses)) return { motif: { type: 'coupe', point: bon }, calme };
  }

  // 4. Relie : deux de tes chaînes touchent le bon coup ; après ton coup, elles restaient séparées et l'adversaire
  //    pouvait jouer là sans rien prendre.
  const miennes = voisinesDistinctes(avant, bon, c);
  if (miennes.length >= 2 && pj.board[bon] === 0 && miennes.every(s => pj.board[s] === c) && !memeChaine(pj, miennes)) {
    const r = jouer(pj, bon);
    if (r && miennes.every(s => r.board[s] === c) && !memeChaine(r, miennes)) return { motif: { type: 'relie', point: bon }, calme };
  }

  // 5. Atari : des pierres adverses n'ont plus qu'une liberté ; la pierre jouée en garde au moins 2 ; après ton coup,
  //    ces pierres en avaient au moins 2.
  if (groupAt(pb.board, pb.size, bon).liberties.size >= 2) {
    for (const r of voisinesDistinctes(pb, bon, o)) {
      const g = groupAt(pb.board, pb.size, r);
      if (g.liberties.size !== 1 || groupAt(avant.board, avant.size, r).liberties.size < 2) continue;
      if (g.stones.some(s => pj.board[s] !== o) || !memeChaine(pj, g.stones)) continue;
      const libs = groupAt(pj.board, pj.size, r).liberties.size;
      if (libs >= 2) return { motif: { type: 'atari', pierres: trie(g.stones), libertesApresJoue: libs }, calme };
    }
  }
  return { motif: null, calme };
}

// ---------- Formes (#497) ----------

/** Gain minimal (points) d'une région pour parler de zone, part minimale du gain total, et marge au-delà du total. */
export const ZONE_MIN = 2;
export const ZONE_PART = 0.6;
export const ZONE_MARGE = 2;
/** Gain d'une intersection (propriété, de ton point de vue) à partir duquel elle est marquée d'un carré. */
export const ZONE_CARRE = 0.25;

export interface ZoneKataGo { region: Region; gain: number; total: number; points: number[] }

export const REGIONS: Region[] = ['hautGauche', 'hautDroite', 'basGauche', 'basDroite', 'haut', 'bas', 'gauche', 'droite'];

/** Vrai si `p` est dans la région (moitiés strictes : la ligne du milieu d'un plateau impair n'en fait pas partie). */
export function dansRegion(p: number, size: number, r: Region): boolean {
  const m = (size - 1) / 2, x = p % size, y = Math.floor(p / size);
  const haut = y < m, bas = y > m, gauche = x < m, droite = x > m;
  switch (r) {
    case 'haut': return haut;
    case 'bas': return bas;
    case 'gauche': return gauche;
    case 'droite': return droite;
    case 'hautGauche': return haut && gauche;
    case 'hautDroite': return haut && droite;
    case 'basGauche': return bas && gauche;
    case 'basDroite': return bas && droite;
  }
}

/** Le fait de zone se dit-il ? Gain de la région ≥ 2, ≥ 60 % du total, ≤ total + 2 ; total positif. */
export const zoneDicible = (z: Pick<ZoneKataGo, 'gain' | 'total'>) =>
  Number.isFinite(z.gain) && Number.isFinite(z.total) && z.total > 0 && z.gain >= ZONE_MIN && z.gain >= ZONE_PART * z.total && z.gain <= z.total + ZONE_MARGE;

/**
 * Zone selon la propriété de KataGo (#497) : `ownBon` après le bon coup, `ownJoue` après ton coup (de -1 Blanc à +1
 * Noir). Écart de chaque intersection, de ton point de vue, hors des deux points joués ; la région retenue est un coin
 * si l'un d'eux suffit (le meilleur), sinon une moitié. `null` si aucune région ne porte l'écart (zoneDicible).
 */
export function zoneKataGo(avant: Position, bon: number, joue: number, ownBon: ArrayLike<number>, ownJoue: ArrayLike<number>): ZoneKataGo | null {
  const n = avant.board.length, size = avant.size;
  if (ownBon.length !== n || ownJoue.length !== n) return null;
  const s = avant.toPlay === 1 ? 1 : -1, d = new Float64Array(n);
  let total = 0;
  for (let p = 0; p < n; p++) {
    if (p === bon || p === joue) continue;
    if (!Number.isFinite(ownBon[p]) || !Number.isFinite(ownJoue[p])) return null;
    d[p] = s * (ownBon[p] - ownJoue[p]);
    total += d[p];
  }
  let choix: ZoneKataGo | null = null;
  for (const [debut, fin] of [[0, 4], [4, 8]]) {
    for (const region of REGIONS.slice(debut, fin)) {
      let gain = 0;
      for (let p = 0; p < n; p++) if (dansRegion(p, size, region)) gain += d[p];
      const z = { region, gain: Math.round(gain * 10) / 10, total: Math.round(total * 10) / 10, points: [] as number[] };
      if (zoneDicible(z) && (!choix || z.gain > choix.gain)) choix = z;
    }
    if (choix) break;
  }
  if (!choix) return null;
  for (let p = 0; p < n; p++) if (avant.board[p] === 0 && p !== bon && p !== joue && dansRegion(p, size, choix.region) && d[p] >= ZONE_CARRE) choix.points.push(p);
  return choix;
}

/**
 * Point de coupe de `c` en `x` dans `pos` (l'adversaire au trait) : `x` est vide et touche au moins deux chaînes de `c` ;
 * l'adversaire peut y jouer sans rien prendre, sa pierre garde au moins 2 libertés, et aucun coup de `c` ne relie
 * ensuite toutes ces chaînes (une diagonale qu'on relie de l'autre côté n'est pas une coupe). Renvoie une pierre par
 * chaîne touchée, ou `null`.
 */
function pointDeCoupe(pos: Position, x: number, c: Color): number[] | null {
  if (pos.board[x] !== 0 || pos.toPlay === c) return null;
  const reps = voisinesDistinctes(pos, x, c);
  if (reps.length < 2) return null;
  const r = jouer(pos, x);
  if (!r || disparues(pos.board, r.board, c).length || groupAt(r.board, r.size, x).liberties.size < 2) return null;
  // Peut-on relier en un coup ? On essaie chaque liberté des chaînes coupées (r : `c` au trait).
  const libs = new Set(reps.flatMap(s => [...groupAt(r.board, r.size, s).liberties]));
  for (const q of libs) {
    const k = jouer(r, q);
    if (k && reps.every(s => k.board[s] === c) && memeChaine(k, reps)) return null;
  }
  return reps;
}

/** Après le bon coup, pourquoi `x` n'est plus un point de coupe (`null` : il l'est encore, ou le cas n'est pas sûr). */
function parade(pb: Position, x: number, c: Color, reps: number[]): 'relie' | 'atari' | 'disparu' | null {
  if (pb.board[x] !== 0) return null;
  if (reps.every(s => pb.board[s] === c) && memeChaine(pb, reps)) return 'relie';
  if (voisinesDistinctes(pb, x, c).length < 2) return 'disparu';
  const r = jouer(pb, x);
  if (r && !disparues(pb.board, r.board, c).length && groupAt(r.board, r.size, x).liberties.size === 1) return 'atari';
  return null;
}

/** Points de coupe laissés par ton coup et parés par le bon : le plus proche du bon coup d'abord. */
function coupeLaissee(pb: Position, pj: Position, bon: number, c: Color, riposte?: number): Forme | null {
  const n = pj.size, dist = (p: number) => Math.abs((p % n) - (bon % n)) + Math.abs(Math.floor(p / n) - Math.floor(bon / n));
  const candidats: { point: number; parade: 'relie' | 'atari' | 'disparu'; kataGo: boolean }[] = [];
  for (let x = 0; x < pj.board.length; x++) {
    if (x === bon || pj.board[x] !== 0) continue;
    const kataGo = riposte === x;
    const reps = pointDeCoupe(pj, x, c);
    if (!reps) continue;
    const p = parade(pb, x, c, reps);
    // « Il n'y a plus de point de coupe » parce que ta pierre n'y est pas : seulement si KataGo y coupait vraiment.
    if (p && (p !== 'disparu' || kataGo)) candidats.push({ point: x, parade: p, kataGo });
  }
  candidats.sort((a, b) => Number(b.kataGo) - Number(a.kataGo) || dist(a.point) - dist(b.point) || a.point - b.point);
  return candidats.length ? { type: 'coupeLaissee', ...candidats[0] } : null;
}

function formesDe(avant: Position, pb: Position, pj: Position, bon: number, joue: number, f?: FaitsKataGo): Forme[] {
  const c = avant.toPlay;
  const riposte = f?.riposte?.[0];
  const coupe = coupeLaissee(pb, pj, bon, c, riposte);
  if (coupe) return [coupe];
  const out: Forme[] = [];
  if (riposte === bon && joue !== bon) out.push({ type: 'pointCommun' });
  const z = f?.zone;
  if (z && zoneDicible(z)) {
    out.push({ type: 'zone', region: z.region, gain: z.gain, points: trie(z.points.filter(p => avant.board[p] === 0 && p !== bon && p !== joue)) });
    // La riposte de KataGo pour l'adversaire tombe dans cette région : il y entrait.
    if (riposte != null && riposte !== bon && dansRegion(riposte, avant.size, z.region)) out.push({ type: 'entree', point: riposte });
  }
  return out;
}

// ---------- Phrases ----------

/** Points lisibles : « 6 points » (au moins 1), arrondis. */
const pts = (n: number) => t('revue.points', { n: Math.max(1, Math.round(n)) });

export interface Contexte {
  avant: Position;
  bon: number;
  /** Coup joué dans la partie (-1 : passe). */
  joue: number;
  /** Points perdus par le coup joué, selon KataGo (absent : erreur gardée avant #492). */
  perte?: number | null;
  /** #497 : faits de KataGo sur le bon coup (variante principale, riposte, zone). */
  kataGo?: FaitsKataGo;
}

/** Phrase du motif, côté bon coup (une phrase). */
function phraseBon(m: Motif, ctx: Contexte): string {
  const size = ctx.avant.size, c = ctx.avant.toPlay, o = autre(c);
  const bon = toLabel(ctx.bon, size), adv = t(o === 1 ? 'camp.noir' : 'camp.blanc');
  switch (m.type) {
    case 'prise': return t(o === 1 ? 'pq.prise.1' : 'pq.prise.2', { bon, n: m.pierres.length });
    case 'sauve': return t('pq.sauve', { bon, n: m.pierres.length, l: m.libertes });
    case 'protege': return t('pq.protege', { bon, n: m.pierres.length, adv });
    case 'risque': return t('pq.risqueBon', { bon, adv });
    case 'coupe': return t(o === 1 ? 'pq.coupe.1' : 'pq.coupe.2', { bon });
    case 'relie': return t('pq.relie', { bon });
    case 'atari': return t(o === 1 ? 'pq.atari.1' : 'pq.atari.2', { bon, n: m.pierres.length });
  }
}

/** Phrase du motif, côté coup joué : ce qu'il ratait (une phrase). */
function phraseJoue(m: Motif, ctx: Contexte): string {
  const size = ctx.avant.size, o = autre(ctx.avant.toPlay);
  const apres = ctx.joue >= 0 ? t('pq.apresCoup', { joue: toLabel(ctx.joue, size) }) : t('pq.apresPasse');
  const adv = t(o === 1 ? 'camp.noir' : 'camp.blanc'), bon = toLabel(ctx.bon, size);
  switch (m.type) {
    case 'prise': return t('pq.priseRatee', { apres, n: m.pierres.length });
    case 'sauve':
    case 'protege':
    case 'risque': return t('pq.menace', { apres, adv, n: m.menacees, point: toLabel(m.point, size) });
    case 'coupe': return t('pq.coupeRatee', { apres, adv });
    case 'relie': return t('pq.relieRate', { apres, adv, bon });
    case 'atari': return t('pq.atariRate', { apres, n: m.pierres.length, l: m.libertesApresJoue });
  }
}

/** Phrases d'un fait de forme (#497) : ton coup d'abord, puis le bon coup. */
function phrasesForme(f: Forme, ctx: Contexte): string[] {
  const size = ctx.avant.size, o = autre(ctx.avant.toPlay);
  const apres = ctx.joue >= 0 ? t('pq.apresCoup', { joue: toLabel(ctx.joue, size) }) : t('pq.apresPasse');
  const adv = t(o === 1 ? 'camp.noir' : 'camp.blanc'), bon = toLabel(ctx.bon, size);
  switch (f.type) {
    case 'coupeLaissee': {
      const point = toLabel(f.point, size);
      const a = t(f.kataGo ? 'pq.coupeLaisseeKataGo' : 'pq.coupeLaissee', { apres, adv, point });
      const b = f.parade === 'relie' ? t('pq.parade.relie', { bon, point })
        : f.parade === 'atari' ? t(o === 1 ? 'pq.parade.atari.1' : 'pq.parade.atari.2', { bon, point })
        : t('pq.parade.disparu', { bon, point });
      return [a, b];
    }
    case 'pointCommun': return [t('pq.pointCommun', { apres, adv, bon })];
    case 'zone': return [t('pq.zone', { bon, pts: pts(f.gain), region: t(`pq.region.${f.region}`) })];
    case 'entree': return [t('pq.entree', { apres, adv, point: toLabel(f.point, size) })];
  }
}

/** Texte des faits de forme : au plus deux phrases (une idée à la fois). */
const texteFormes = (formes: Forme[], ctx: Contexte) => formes.flatMap(f => phrasesForme(f, ctx)).slice(0, 2).join(' ');

const lieu = (ctx: Contexte) => (ctx.joue >= 0 ? t('pq.tonCoup', { joue: toLabel(ctx.joue, ctx.avant.size) }) : t('pq.taPasse'));
const avecPerte = (ctx: Contexte) => ctx.perte != null && Number.isFinite(ctx.perte) && ctx.perte > 0;

export interface TextePourquoi {
  /** Une ou deux phrases : ce que fait le bon coup, ce que ratait le tien. */
  texte: string;
  /** « Écart : environ 6 points selon KataGo. », quand le texte ne le dit pas déjà. */
  ecart: string | null;
}

/** Explication après un échec (la réponse est montrée). */
export function textePourquoi(ctx: Contexte, e: Explication = expliquer(ctx.avant, ctx.bon, ctx.joue, ctx.kataGo)): TextePourquoi {
  const ecart = avecPerte(ctx) ? t('pq.ecart', { pts: pts(ctx.perte!) }) : null;
  if (e.motif) {
    const [a, b] = [phraseBon(e.motif, ctx), phraseJoue(e.motif, ctx)];
    return { texte: e.motif.type === 'risque' ? `${b} ${a}` : `${a} ${b}`, ecart };
  }
  if (e.formes?.length) return { texte: texteFormes(e.formes, ctx), ecart };
  const bon = toLabel(ctx.bon, ctx.avant.size);
  const premiere = avecPerte(ctx) ? t('pq.general', { bon, pts: pts(ctx.perte!), lieu: lieu(ctx) }) : t('pq.generalSans', { lieu: lieu(ctx) });
  return { texte: `${premiere} ${t(e.calme ? 'pq.calme' : 'pq.compare')}`, ecart: null };
}

/**
 * Courte confirmation après une réussite avec le coup `p` (le meilleur, ou un coup équivalent) : le motif du coup
 * trouvé s'il y en a un sûr ; sinon, pour le meilleur coup seulement, l'écart chiffré. `null` : rien de plus à dire.
 */
export function confirmationPourquoi(ctx: Contexte, p: number): string | null {
  const e = expliquer(ctx.avant, p, ctx.joue, p === ctx.bon ? ctx.kataGo : undefined);
  if (e.motif) return phraseBon(e.motif, { ...ctx, bon: p });
  // Fait de forme : la phrase du bon coup seulement (la parade, le point commun, ou la zone).
  const f = e.formes?.[0];
  if (f) { const ph = phrasesForme(f, { ...ctx, bon: p }); return ph[ph.length - 1]; }
  if (p === ctx.bon && avecPerte(ctx)) return t('pq.gain', { pts: pts(ctx.perte!), lieu: lieu(ctx) });
  return null;
}

// ---------- Problèmes classiques (#497) ----------

/** Fait tactique d'un coup seul (problème classique, sans coup joué à comparer). */
export type MotifSeul =
  | { type: 'prise'; pierres: number[] }
  | { type: 'sauve'; pierres: number[]; libertes: number }
  | { type: 'doubleAtari'; pierres: number[] }
  | { type: 'atari'; pierres: number[] }
  | { type: 'coupe' }
  | { type: 'relie' };

/**
 * Ce que fait le coup `bon` dans `avant`, vérifié par les règles, dans l'ordre :
 * - prise : des pierres adverses disparaissent ;
 * - sauve : des pierres à toi en atari touchent le coup ; après lui, elles forment une seule chaîne d'au moins
 *   2 libertés, et l'adversaire ne peut plus prendre aucune d'elles au coup suivant ;
 * - doubleAtari / atari : des chaînes adverses voisines passent d'au moins 2 libertés à une seule (deux chaînes au
 *   moins : double atari) ; la chaîne du coup garde au moins 2 libertés ;
 * - coupe : le coup touche deux chaînes adverses que l'adversaire reliait en y jouant ;
 * - relie : le coup réunit deux de tes chaînes, que l'adversaire pouvait séparer en y jouant sans rien prendre.
 * `null` : aucun fait sûr.
 */
export function motifSeul(avant: Position, bon: number): MotifSeul | null {
  const c = avant.toPlay, o = autre(c), pb = bon >= 0 ? jouer(avant, bon) : null;
  if (!pb) return null;
  const prises = disparues(avant.board, pb.board, o);
  if (prises.length) return { type: 'prise', pierres: prises };
  const menacees = voisinesDistinctes(avant, bon, c).filter(r => groupAt(avant.board, avant.size, r).liberties.size === 1);
  if (menacees.length) {
    const pierres = trie(menacees.flatMap(r => groupAt(avant.board, avant.size, r).stones));
    const g = groupAt(pb.board, pb.size, bon), capB = new Set([...coupsQuiPrennent(pb).values()].flat());
    if (g.liberties.size >= 2 && pierres.every(s => g.stones.includes(s) && !capB.has(s))) return { type: 'sauve', pierres, libertes: g.liberties.size };
  }
  if (groupAt(pb.board, pb.size, bon).liberties.size >= 2) {
    const enAtari = voisinesDistinctes(pb, bon, o).filter(r => groupAt(pb.board, pb.size, r).liberties.size === 1 && groupAt(avant.board, avant.size, r).liberties.size >= 2);
    if (enAtari.length) {
      const pierres = trie(enAtari.flatMap(r => groupAt(pb.board, pb.size, r).stones));
      return { type: enAtari.length >= 2 ? 'doubleAtari' : 'atari', pierres };
    }
  }
  // Coupe et connexion : l'adversaire joue au même point, à la place (même position, l'autre camp au trait).
  const lui = jouer({ ...avant, toPlay: o, ko: -1 }, bon);
  const adverses = voisinesDistinctes(avant, bon, o);
  if (adverses.length >= 2 && lui && memeChaine(lui, adverses)) return { type: 'coupe' };
  const miennes = voisinesDistinctes(avant, bon, c);
  if (miennes.length >= 2 && memeChaine(pb, miennes) && lui && !disparues(avant.board, lui.board, c).length) return { type: 'relie' };
  return null;
}

/** Phrase d'un fait tactique seul (une phrase), pour la réponse d'un problème classique. */
export function phraseMotifSeul(m: MotifSeul, avant: Position, bon: number): string {
  const o = autre(avant.toPlay), point = toLabel(bon, avant.size), b = { bon: point };
  switch (m.type) {
    case 'prise': return t(o === 1 ? 'pq.prise.1' : 'pq.prise.2', { ...b, n: m.pierres.length });
    case 'sauve': return t('pq.sauve', { ...b, n: m.pierres.length, l: m.libertes });
    case 'doubleAtari': return t(o === 1 ? 'pq.doubleAtari.1' : 'pq.doubleAtari.2', { ...b, n: m.pierres.length });
    case 'atari': return t(o === 1 ? 'pq.atari.1' : 'pq.atari.2', { ...b, n: m.pierres.length });
    case 'coupe': return t(o === 1 ? 'pq.coupe.1' : 'pq.coupe.2', b);
    case 'relie': return t('pq.relie', b);
  }
}

// ---------- Suite illustrée (« Revoir la suite ») ----------

export interface Cadre {
  pos: Position;
  legende: string;
  /** Croix sur le coup joué dans la partie (sur les plateaux du bon coup et de sa suite, s'il est encore vide). */
  croix?: number;
  /** #497 : intersections de la zone gagnée selon KataGo (dernier plateau seulement, vides). */
  zone?: number[];
}

/** Au plus 3 coups de la variante principale après le bon coup, et 3 coups de riposte : une suite courte. */
export const SUITE_MAX = 3;
export const RIPOSTE_MAX = 3;

/** Plateaux d'une suite de coups depuis `depart`, légende recalculée en jouant chaque coup. S'arrête au premier coup illégal. */
function suiteJouee(depart: Position, coups: number[], legende: (camp: string, point: string, prises: number, i: number) => string): Cadre[] {
  const out: Cadre[] = [];
  let pos = depart;
  for (let i = 0; i < coups.length; i++) {
    if (coups[i] < 0) break;
    const r = jouer(pos, coups[i]);
    if (!r) break;
    const camp = t(pos.toPlay === 1 ? 'camp.noir' : 'camp.blanc');
    out.push({ pos: r, legende: legende(camp, toLabel(coups[i], pos.size), disparues(pos.board, r.board, autre(pos.toPlay)).length, i) });
    pos = r;
  }
  return out;
}

/**
 * Suite qui illustre l'explication, depuis la position de départ :
 * - sauve, protege, risque : ton coup, puis l'adversaire prend (« Blanc prend 2 pierres en D3 ») ; puis le bon coup ;
 * - coupe, relie : ton coup, puis l'adversaire joue au point du bon coup ; puis le bon coup ;
 * - #497, sans motif tactique : ton coup, puis la riposte de KataGo pour l'adversaire quand elle est connue (sinon la
 *   coupe laissée par ton coup) ; puis le bon coup ;
 * - sinon : le bon coup (« Il prend 2 pierres » quand il prend).
 * #497 : après le bon coup, la variante principale de KataGo quand elle est connue (« Suite de KataGo : Blanc E3. »).
 * Chaque légende est recalculée en jouant les coups : une prise annoncée est une prise jouée.
 */
export function cadresPourquoi(ctx: Contexte, e: Explication = expliquer(ctx.avant, ctx.bon, ctx.joue, ctx.kataGo)): Cadre[] {
  const { avant } = ctx, size = avant.size, c = avant.toPlay, o = autre(c), adv = t(o === 1 ? 'camp.noir' : 'camp.blanc');
  const cadres: Cadre[] = [{ pos: avant, legende: t('pq.cadre.depart') }];
  const m = e.motif;
  const pj = jouer(avant, ctx.joue >= 0 ? ctx.joue : -1);
  const tonCoup = () => ({ pos: pj!, legende: ctx.joue >= 0 ? t('pq.cadre.tonCoup', { joue: toLabel(ctx.joue, size) }) : t('pq.cadre.taPasse') });
  const reponse = m && m.type !== 'prise' && m.type !== 'atari' ? m.point : null;
  const coupe = e.formes?.find(f => f.type === 'coupeLaissee');
  const riposte = !m ? ctx.kataGo?.riposte?.slice(0, RIPOSTE_MAX) : undefined;
  if (m && reponse != null) {
    const r = pj && jouer(pj, reponse);
    if (pj && r) {
      cadres.push(tonCoup());
      const prises = disparues(pj.board, r.board, c).length, point = toLabel(reponse, size);
      cadres.push({
        pos: r,
        legende: prises ? t('pq.cadre.prend', { adv, n: prises, point }) : t(m.type === 'coupe' ? 'pq.cadre.relie' : 'pq.cadre.coupe', { adv, point }),
      });
      cadres.push({ pos: avant, legende: t('pq.cadre.retour') });
    }
  } else if (pj && riposte?.length) {
    const suite = suiteJouee(pj, riposte, (camp, point, prises, i) => i === 0
      ? t('pq.cadre.riposte', { adv, point })
      : prises ? t('pq.cadre.suitePrend', { camp, point, n: prises }) : t('pq.cadre.suite', { camp, point }));
    if (suite.length) cadres.push(tonCoup(), ...suite, { pos: avant, legende: t('pq.cadre.retour') });
  } else if (pj && coupe?.type === 'coupeLaissee') {
    const r = jouer(pj, coupe.point);
    if (r) cadres.push(tonCoup(), { pos: r, legende: t('pq.cadre.coupe', { adv, point: toLabel(coupe.point, size) }) }, { pos: avant, legende: t('pq.cadre.retour') });
  }
  const pb = jouer(avant, ctx.bon);
  if (pb) {
    const prises = disparues(avant.board, pb.board, o).length, bon = toLabel(ctx.bon, size);
    const debut = cadres.length;
    cadres.push({ pos: pb, legende: prises ? t('pq.cadre.bonPrend', { bon, n: prises }) : t('pq.cadre.bon', { bon }) });
    const pv = ctx.kataGo?.suite;
    if (pv && pv[0] === ctx.bon) {
      cadres.push(...suiteJouee(pb, pv.slice(1, 1 + SUITE_MAX), (camp, point, n) => (n ? t('pq.cadre.suitePrend', { camp, point, n }) : t('pq.cadre.suite', { camp, point }))));
    }
    for (let i = debut; i < cadres.length; i++) if (ctx.joue >= 0 && cadres[i].pos.board[ctx.joue] === 0) cadres[i].croix = ctx.joue;
    const zone = e.formes?.find(f => f.type === 'zone');
    const dernier = cadres[cadres.length - 1];
    if (zone?.type === 'zone') dernier.zone = zone.points.filter(p => dernier.pos.board[p] === 0);
  }
  return cadres;
}
