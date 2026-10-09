// Recherche PUCT (type AlphaZero / KataGo) guidée par un réseau, volontairement compacte :
// une évaluation par visite, pas de lots ni de symétries. Suffisant pour quelques dizaines à
// quelques centaines de visites en 9 × 9 ou 13 × 13 dans le navigateur.
import { play, type Position } from '../../go/rules';
import { score } from '../../go/score';
import { features, type Regles } from './features';
import { postprocess, type Evaluator } from './net';

export interface AnalyzeOptions {
  komi?: number;
  regles?: Regles;
  visits?: number;
  /** Budget de temps en ms : la recherche s'arrête au premier des deux plafonds. */
  timeMs?: number;
  history?: number[];
  /** Nombre maximal de coups renvoyés. */
  maxMoves?: number;
}

export interface MoveInfo {
  move: number; // index y * N + x, -1 = passe
  visits: number;
  prior: number; // probabilité de la politique du réseau
  winrate: number; // pour le joueur au trait
  lead: number; // avance en points pour le joueur au trait
  scoreLoss: number; // points perdus par rapport au meilleur coup (>= 0)
  /**
   * #497 : variante principale (PV), qui commence par ce coup : à chaque niveau, le coup le plus visité de l'arbre.
   * Absente si le coup n'a pas été visité. Au plus `PV_MAX` coups (-1 : passe).
   */
  pv?: number[];
}

export interface Analysis {
  moves: MoveInfo[]; // triés du meilleur au moins bon
  winrate: number;
  lead: number;
  ownership: Float32Array; // de -1 (Blanc) à +1 (Noir), par intersection
  visits: number;
  ms: number;
  engine: string;
  /**
   * Politique brute du réseau à la racine, pour chaque intersection (index y * N + x), puis la passe (index N * N).
   * 0 pour une intersection occupée ou en ko. Sert au tirage « humain » des niveaux faibles (`hasard`).
   */
  policy?: Float32Array;
  /**
   * #497 : propriété estimée par le réseau dans la position après le meilleur coup (`moves[0]`), de -1 (Blanc) à +1
   * (Noir), par intersection. Absente si ce coup n'a pas été visité.
   */
  ownershipApres?: Float32Array;
}

/** Longueur maximale d'une variante principale (#497). */
export const PV_MAX = 10;

interface Edge { move: number; prior: number; n: number; w: number; lead: number; child: Node | null; pos: Position | null }
interface Node { pos: Position; edges: Edge[]; history: number[]; value: number; lead: number; terminal: boolean; own?: Float32Array }

const CPUCT = 1.1;
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** Utilité d'une évaluation : victoire surtout, un peu d'avance au score pour départager. */
const utility = (winrate: number, lead: number) => 2 * winrate - 1 + 0.15 * Math.tanh(lead / 10);

async function expand(ev: Evaluator, pos: Position, history: number[], komi: number, regles: Regles) {
  const { spatial, global } = features(pos, { komi, regles, history });
  const out = await ev.evaluate(spatial, global, pos.size);
  const post = postprocess(out, ev.post);
  const n = pos.size * pos.size, legal: number[] = [];
  for (let p = 0; p < n; p++) if (!pos.board[p] && p !== pos.ko) legal.push(p);
  legal.push(-1);
  let max = -Infinity;
  for (const m of legal) max = Math.max(max, out.policy[m < 0 ? n : m]);
  const edges: Edge[] = [];
  let sum = 0;
  for (const m of legal) {
    const e = Math.exp(out.policy[m < 0 ? n : m] - max);
    sum += e;
    edges.push({ move: m, prior: e, n: 0, w: 0, lead: 0, child: null, pos: null });
  }
  for (const e of edges) e.prior /= sum;
  edges.sort((a, b) => b.prior - a.prior);
  return { edges, winrate: post.winrate, lead: post.lead, ownership: out.ownership };
}

function terminalValue(pos: Position, komi: number, regles: Regles): { value: number; lead: number } {
  const s = score(pos, komi, regles);
  const blackLead = s.black - s.white, lead = pos.toPlay === 1 ? blackLead : -blackLead;
  return { value: lead > 0 ? 1 : lead < 0 ? -1 : 0, lead };
}

/** Analyse la position : coups candidats avec visites, taux de victoire, perte en points, et carte de propriété. */
export async function search(ev: Evaluator, root: Position, o: AnalyzeOptions = {}): Promise<Analysis> {
  const t0 = now(), komi = o.komi ?? 6.5, regles = o.regles ?? 'chinese';
  const maxVisits = Math.max(1, o.visits ?? 64), budget = o.timeMs ?? Infinity;
  const history = o.history ?? (root.lastMove !== null ? [root.lastMove] : []);
  const first = await expand(ev, root, history, komi, regles);
  const rootNode: Node = { pos: root, edges: first.edges, history, value: utility(first.winrate, first.lead), lead: first.lead, terminal: false };
  const n = root.size * root.size;
  const ownership = new Float32Array(n);
  for (let p = 0; p < n; p++) ownership[p] = Math.tanh(first.ownership[p]) * (root.toPlay === 1 ? 1 : -1);

  let visits = 1;
  while (visits < maxVisits && now() - t0 < budget) {
    // Sélection.
    const path: Edge[] = [];
    let node = rootNode;
    let leafValue: number, leafLead = 0;
    for (;;) {
      const parentN = node.edges.reduce((s, e) => s + Math.max(0, e.n), 0) + 1, sq = Math.sqrt(parentN);
      // Valeur par défaut des coups non visités : un peu en dessous de celle du nœud (« first play urgency »).
      const fpu = node.value - 0.2;
      let best: Edge | null = null, bestU = -Infinity;
      for (const e of node.edges) {
        if (e.pos === null && e.n < 0) continue; // coup illégal déjà repéré
        const q = e.n ? e.w / e.n : fpu;
        const u = q + CPUCT * e.prior * sq / (1 + e.n);
        if (u > bestU) { bestU = u; best = e; }
      }
      if (!best) { leafValue = -1; break; }
      if (!best.pos) {
        const r = best.move < 0 ? { ...node.pos, ko: -1, toPlay: (3 - node.pos.toPlay) as 1 | 2, lastMove: -1 } : play(node.pos, best.move);
        if (typeof r === 'string') { best.n = -1; best.prior = 0; continue; }
        best.pos = r;
      }
      path.push(best);
      const hist = [...node.history, best.move].slice(-5);
      if (best.child) {
        node = best.child;
        if (node.terminal) { leafValue = node.value; leafLead = node.lead; break; }
        continue;
      }
      // Deux passes de suite : fin de partie, on compte.
      if (best.move < 0 && node.history[node.history.length - 1] === -1) {
        const t = terminalValue(best.pos, komi, regles);
        best.child = { pos: best.pos, edges: [], history: hist, value: t.value, lead: t.lead, terminal: true };
        leafValue = t.value; leafLead = t.lead;
        break;
      }
      const ex = await expand(ev, best.pos, hist, komi, regles);
      const v = utility(ex.winrate, ex.lead);
      best.child = { pos: best.pos, edges: ex.edges, history: hist, value: v, lead: ex.lead, terminal: false, own: ex.ownership };
      leafValue = v; leafLead = ex.lead;
      break;
    }
    // Rétropropagation : la valeur change de signe à chaque niveau.
    for (let i = path.length - 1; i >= 0; i--) {
      leafValue = -leafValue; leafLead = -leafLead;
      path[i].n++; path[i].w += leafValue; path[i].lead += leafLead;
    }
    visits++;
  }

  // Coups visités, plus les coups non visités que la politique juge plausibles (utile aux niveaux faibles).
  const shown = rootNode.edges.filter(e => e.n > 0 || (e.n === 0 && e.prior >= 0.03));
  const aretes = new Map<number, Edge>();
  const list: MoveInfo[] = (shown.length ? shown : rootNode.edges.filter(e => e.n >= 0).slice(0, 1)).map(e => {
    aretes.set(e.move, e);
    const pv = e.n > 0 ? variante(e) : null;
    return {
      move: e.move,
      visits: Math.max(0, e.n),
      prior: e.prior,
      winrate: e.n > 0 ? Math.min(1, Math.max(0, (e.w / e.n + 1) / 2)) : first.winrate,
      lead: e.n > 0 ? e.lead / e.n : first.lead,
      scoreLoss: 0,
      ...(pv ? { pv } : {}),
    };
  });
  list.sort((a, b) => b.visits - a.visits || b.prior - a.prior);
  const bestLead = list.length ? list[0].lead : 0;
  for (const m of list) m.scoreLoss = Math.max(0, bestLead - m.lead);
  const top = list[0];
  const policy = new Float32Array(n + 1);
  for (const e of first.edges) policy[e.move < 0 ? n : e.move] = e.n < 0 ? 0 : e.prior;
  // #497 : propriété après le meilleur coup, ramenée au point de vue de Noir (le réseau parle pour le joueur au trait).
  const enfant = top ? aretes.get(top.move)?.child : undefined;
  let ownershipApres: Float32Array | undefined;
  if (enfant?.own) {
    const s = enfant.pos.toPlay === 1 ? 1 : -1;
    ownershipApres = new Float32Array(n);
    for (let p = 0; p < n; p++) ownershipApres[p] = Math.tanh(enfant.own[p]) * s;
  }
  return {
    moves: list.slice(0, o.maxMoves ?? 20),
    winrate: top?.winrate ?? first.winrate,
    lead: top?.lead ?? first.lead,
    ownership,
    visits,
    ms: now() - t0,
    engine: ev.name,
    policy,
    ...(ownershipApres ? { ownershipApres } : {}),
  };
}

/** Variante principale depuis une arête visitée : le coup, puis à chaque niveau le coup le plus visité (#497). */
function variante(e: Edge): number[] {
  const pv = [e.move];
  let node = e.child;
  while (node && !node.terminal && pv.length < PV_MAX) {
    let best: Edge | null = null;
    for (const x of node.edges) if (x.n > 0 && (!best || x.n > best.n)) best = x;
    if (!best) break;
    pv.push(best.move);
    node = best.child;
  }
  return pv;
}
