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
// Sans motif sûr, la phrase est générale et s'appuie sur l'écart chiffré de KataGo (« environ 6 points »). « Calme »
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

export interface Explication {
  /** Motif vérifié, ou `null` : phrase générale. */
  motif: Motif | null;
  /** Aucune chaîne en atari, avant et après les deux coups (vérifié). */
  calme: boolean;
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
 */
export function expliquer(avant: Position, bon: number, joue: number): Explication {
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

const lieu = (ctx: Contexte) => (ctx.joue >= 0 ? t('pq.tonCoup', { joue: toLabel(ctx.joue, ctx.avant.size) }) : t('pq.taPasse'));
const avecPerte = (ctx: Contexte) => ctx.perte != null && Number.isFinite(ctx.perte) && ctx.perte > 0;

export interface TextePourquoi {
  /** Une ou deux phrases : ce que fait le bon coup, ce que ratait le tien. */
  texte: string;
  /** « Écart : environ 6 points selon KataGo. », quand le texte ne le dit pas déjà. */
  ecart: string | null;
}

/** Explication après un échec (la réponse est montrée). */
export function textePourquoi(ctx: Contexte, e: Explication = expliquer(ctx.avant, ctx.bon, ctx.joue)): TextePourquoi {
  if (e.motif) {
    const [a, b] = [phraseBon(e.motif, ctx), phraseJoue(e.motif, ctx)];
    return { texte: e.motif.type === 'risque' ? `${b} ${a}` : `${a} ${b}`, ecart: avecPerte(ctx) ? t('pq.ecart', { pts: pts(ctx.perte!) }) : null };
  }
  const bon = toLabel(ctx.bon, ctx.avant.size);
  const premiere = avecPerte(ctx) ? t('pq.general', { bon, pts: pts(ctx.perte!), lieu: lieu(ctx) }) : t('pq.generalSans', { lieu: lieu(ctx) });
  return { texte: `${premiere} ${t(e.calme ? 'pq.calme' : 'pq.compare')}`, ecart: null };
}

/**
 * Courte confirmation après une réussite avec le coup `p` (le meilleur, ou un coup équivalent) : le motif du coup
 * trouvé s'il y en a un sûr ; sinon, pour le meilleur coup seulement, l'écart chiffré. `null` : rien de plus à dire.
 */
export function confirmationPourquoi(ctx: Contexte, p: number): string | null {
  const e = expliquer(ctx.avant, p, ctx.joue);
  if (e.motif) return phraseBon(e.motif, { ...ctx, bon: p });
  if (p === ctx.bon && avecPerte(ctx)) return t('pq.gain', { pts: pts(ctx.perte!), lieu: lieu(ctx) });
  return null;
}

// ---------- Suite illustrée (« Revoir la suite ») ----------

export interface Cadre {
  pos: Position;
  legende: string;
  /** Croix sur le coup joué dans la partie (seulement sur le plateau du bon coup). */
  croix?: number;
}

/**
 * Suite qui illustre l'explication, depuis la position de départ :
 * - sauve, protege, risque : ton coup, puis l'adversaire prend (« Blanc prend 2 pierres en D3 ») ; puis le bon coup ;
 * - coupe, relie : ton coup, puis l'adversaire joue au point du bon coup ; puis le bon coup ;
 * - sinon : le bon coup (« Il prend 2 pierres » quand il prend).
 * Chaque légende est recalculée en jouant les coups : une prise annoncée est une prise jouée.
 */
export function cadresPourquoi(ctx: Contexte, e: Explication = expliquer(ctx.avant, ctx.bon, ctx.joue)): Cadre[] {
  const { avant } = ctx, size = avant.size, c = avant.toPlay, o = autre(c), adv = t(o === 1 ? 'camp.noir' : 'camp.blanc');
  const cadres: Cadre[] = [{ pos: avant, legende: t('pq.cadre.depart') }];
  const m = e.motif;
  const reponse = m && m.type !== 'prise' && m.type !== 'atari' ? m.point : null;
  if (m && reponse != null) {
    const pj = jouer(avant, ctx.joue >= 0 ? ctx.joue : -1);
    const r = pj && jouer(pj, reponse);
    if (pj && r) {
      cadres.push({ pos: pj, legende: ctx.joue >= 0 ? t('pq.cadre.tonCoup', { joue: toLabel(ctx.joue, size) }) : t('pq.cadre.taPasse') });
      const prises = disparues(pj.board, r.board, c).length, point = toLabel(reponse, size);
      cadres.push({
        pos: r,
        legende: prises ? t('pq.cadre.prend', { adv, n: prises, point }) : t(m.type === 'coupe' ? 'pq.cadre.relie' : 'pq.cadre.coupe', { adv, point }),
      });
      cadres.push({ pos: avant, legende: t('pq.cadre.retour') });
    }
  }
  const pb = jouer(avant, ctx.bon);
  if (pb) {
    const prises = disparues(avant.board, pb.board, o).length, bon = toLabel(ctx.bon, size);
    cadres.push({
      pos: pb,
      legende: prises ? t('pq.cadre.bonPrend', { bon, n: prises }) : t('pq.cadre.bon', { bon }),
      croix: ctx.joue >= 0 && pb.board[ctx.joue] === 0 ? ctx.joue : undefined,
    });
  }
  return cadres;
}
