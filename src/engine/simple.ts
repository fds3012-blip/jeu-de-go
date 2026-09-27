// Moteur simple : Monte-Carlo « à plat » (UCB1 sur les coups candidats) avec heuristiques de capture.
// Pas de réseau de neurones : il sert d'adversaire débutant en attendant KataGo.
// Synchrone et sans DOM, pour tourner dans un Web Worker comme dans les tests.
import { groupAt, neighbors, play, type Color, type Position } from '../go/rules';
import { score } from '../go/score';
import { coupDeFermeture, frontieresOuvertes, partieAvancee } from '../go/frontieres';
import { deadStones } from './dead';
import { isEye, now, rng, Sim } from './sim';

export { isEye };

export type OpponentId = 'pomme' | 'caillou' | 'bambou' | 'renard' | 'riviere' | 'tigre' | 'montagne' | 'dragon' | 'sensei';

/** Style de jeu des niveaux KataGo : il oriente le choix parmi les coups jugés acceptables. */
export type Style = 'agressif' | 'solide' | 'territorial';

export interface KataGoLevel {
  visits: number; // visites de la recherche PUCT
  tolerance: number; // points de perte acceptés par rapport au meilleur coup
  style: Style;
}

export interface Opponent {
  id: OpponentId;
  nom: string;
  rang: string;
  description: string;
  /** Phrase de personnage, courte et au tutoiement, affichée sous le nom à l'accueil. */
  phrase: string;
  // Moteur simple (Pomme, Caillou, et repli des niveaux KataGo si le réseau ne se charge pas).
  playouts: number; // plafond de simulations par coup
  timeMs: number; // budget de temps par coup
  hasard: number; // probabilité de jouer un candidat au hasard au lieu du meilleur
  heuristiques: boolean; // priorité aux captures et aux sauvetages
  /** Ne passe pas tant qu'une frontière reste ouverte : il la ferme d'abord (#159). */
  fermeFrontieres?: boolean;
  /** Présent : ce niveau joue avec KataGo (réseau g170-b6c96). */
  katago?: KataGoLevel;
}

// Repli commun des niveaux KataGo : le moteur simple à pleine force (niveau Caillou).
const repli = { playouts: 20000, timeMs: 800, hasard: 0, heuristiques: true, fermeFrontieres: true } as const;

/** Échelle des défis, du plus facile au plus fort. */
export const OPPONENTS: Opponent[] = [
  { id: 'pomme', nom: 'Pomme', rang: '20 kyu', phrase: 'Elle apprend comme toi.', description: 'Joue un peu au hasard. Parfait pour ta première partie.', playouts: 250, timeMs: 150, hasard: 0.3, heuristiques: false, fermeFrontieres: true },
  { id: 'caillou', nom: 'Caillou', rang: '16 kyu', phrase: 'Il capture tout ce qui traîne.', description: 'Capture dès que tu le laisses faire. Protège bien tes pierres.', playouts: 20000, timeMs: 600, hasard: 0, heuristiques: true, fermeFrontieres: true },
  { id: 'bambou', nom: 'Bambou', rang: '13 kyu', phrase: 'Il plie, mais ne rompt jamais.', description: 'Joue solide et relie ses pierres. Cherche ses points faibles.', ...repli, katago: { visits: 4, tolerance: 12, style: 'solide' } },
  { id: 'renard', nom: 'Renard', rang: '10 kyu', phrase: "Il coupe dès que tu t'étires trop.", description: 'Aime couper et attaquer. Garde tes groupes bien reliés.', ...repli, katago: { visits: 8, tolerance: 8, style: 'agressif' } },
  { id: 'riviere', nom: 'Rivière', rang: '7 kyu', phrase: 'Elle se faufile le long des bords.', description: 'Prend les coins et les bords. Ne la laisse pas tout entourer.', ...repli, katago: { visits: 16, tolerance: 5, style: 'territorial' } },
  { id: 'tigre', nom: 'Tigre', rang: '5 kyu', phrase: 'Il attaque sans jamais lâcher.', description: 'Attaque sans relâche. Fais vivre tes groupes tôt.', ...repli, katago: { visits: 32, tolerance: 3, style: 'agressif' } },
  { id: 'montagne', nom: 'Montagne', rang: '3 kyu', phrase: 'Elle ne bouge pas, et ne cède rien.', description: 'Très solide, presque sans faute. Il faut la battre aux points.', ...repli, katago: { visits: 64, tolerance: 1.5, style: 'solide' } },
  { id: 'dragon', nom: 'Dragon', rang: '1 kyu', phrase: 'Il compte chaque point, même les tiens.', description: 'Compte très bien son territoire. Chaque point compte.', ...repli, katago: { visits: 128, tolerance: 0.8, style: 'territorial' } },
  { id: 'sensei', nom: 'Sensei', rang: '1 dan', phrase: 'Il a tout vu. Montre-lui ton go.', description: 'Le dernier défi. Joue son meilleur coup à chaque fois.', ...repli, katago: { visits: 200, tolerance: 0, style: 'solide' } },
];

export function opponent(id: OpponentId): Opponent {
  return OPPONENTS.find(o => o.id === id) ?? OPPONENTS[0];
}

export interface EngineOptions { komi?: number; seed?: number; timeMs?: number; playouts?: number }

interface Candidate { move: number; prior: number; wins: number; visits: number }

/** Coups candidats à la racine, avec un bonus pour les captures et les sauvetages. */
export function candidates(pos: Position, heuristiques = true): Candidate[] {
  const { size, board } = pos, c = pos.toPlay, o = 3 - c, nb = neighbors(size);
  const out: Candidate[] = [];
  // Groupes en atari des deux couleurs.
  const seen = new Uint8Array(board.length), captureAt = new Map<number, number>(), saveAt = new Set<number>();
  for (let p = 0; p < board.length; p++) {
    if (!board[p] || seen[p]) continue;
    const g = groupAt(board, size, p);
    for (const s of g.stones) seen[s] = 1;
    if (g.liberties.size !== 1) continue;
    const l = [...g.liberties][0];
    if (board[p] === o) captureAt.set(l, (captureAt.get(l) ?? 0) + g.stones.length);
    else saveAt.add(l);
  }
  for (let p = 0; p < board.length; p++) {
    if (board[p] || isEye(board, size, p, c)) continue;
    const r = play(pos, p);
    if (typeof r === 'string') continue;
    const captured = r.captures[c] - pos.captures[c];
    const own = groupAt(r.board, size, p);
    // Éviter l'auto-atari (sauf si le coup capture).
    if (!captured && own.liberties.size === 1) continue;
    let prior = 0;
    if (heuristiques) {
      if (captured) prior += 4 + 2 * Math.min(captured, 5);
      if (saveAt.has(p) && own.liberties.size >= 2) prior += 6;
      // Petit bonus pour rester au contact (joue « quelque part d'utile »).
      if (nb[p].some(q => board[q] === o) && own.liberties.size >= 3) prior += 0.5;
    }
    out.push({ move: p, prior, wins: 0, visits: 0 });
  }
  return out;
}

/**
 * Plateau réglé : chaque point vide est entouré d'une seule couleur (et le reste dans les simulations), aucun groupe n'est en atari
 * et aucune pierre n'est jugée morte par les simulations (propriété moyenne du mauvais côté).
 */
function settled(pos: Position, own: Int32Array, playouts: number): boolean {
  const { board, size } = pos, owner = score(pos, 0, 'chinese').owner, seen = new Uint8Array(board.length);
  for (let p = 0; p < board.length; p++) {
    const v = board[p];
    if (!v) { if (!owner[p] || (owner[p] === 1 ? own[p] : -own[p]) < 0.6 * playouts) return false; continue; }
    if ((v === 1 ? own[p] : -own[p]) < -0.3 * playouts) return false;
    if (seen[p]) continue;
    const g = groupAt(board, size, p);
    for (const s of g.stones) seen[s] = 1;
    if (g.liberties.size < 2) return false;
  }
  return true;
}

/** Choisit un coup (index y * N + x, -1 = passe) pour le joueur au trait. Synchrone. */
export function chooseMove(pos: Position, niveau: OpponentId | Opponent, opts: EngineOptions = {}): number {
  const lvl = typeof niveau === 'string' ? opponent(niveau) : niveau;
  const komi = opts.komi ?? 6.5, rand = rng(opts.seed), c = pos.toPlay;
  // Avant de passer, un niveau qui ferme ses frontières joue un coup de fermeture s'il en reste un (#159).
  // `prefer` : coups du moteur, du meilleur au moins bon. Pierres mortes calculées seulement s'il y a une frontière.
  let morts: number[] | null = null;
  const mortes = () => (morts ??= deadStones(pos, { seed: opts.seed, timeMs: Math.min(150, opts.timeMs ?? 150) }));
  const passer = (prefer: number[] = []): number => {
    if (!lvl.fermeFrontieres || !partieAvancee(pos.board) || !frontieresOuvertes(pos.board, pos.size).length) return -1;
    return coupDeFermeture(pos, mortes(), prefer);
  };
  const cands = candidates(pos, lvl.heuristiques);
  if (!cands.length) return passer();

  // L'adversaire vient de passer : si le compte, pierres mortes estimées retirées, nous donne gagnant, on passe aussi.
  if (pos.lastMove === -1) {
    const sc = score(pos, komi, 'chinese', new Set(mortes()));
    if (sc.winner === c) return passer();
  }

  const size = pos.size, sim = new Sim(size), empties = new Int32Array(size * size);
  const budget = opts.timeMs ?? lvl.timeMs, maxPlayouts = opts.playouts ?? lvl.playouts, t0 = now();
  const own = new Int32Array(size * size), arms = cands;
  // Les bonus heuristiques comptent comme des victoires virtuelles.
  for (const a of arms) { a.visits = 1 + a.prior; a.wins = 0.5 + a.prior; }
  let total = arms.reduce((s, a) => s + a.visits, 0), done = 0;
  while (done < maxPlayouts) {
    if ((done & 15) === 0 && now() - t0 > budget) break;
    const logT = Math.log(total);
    let best = arms[0], bestU = -Infinity;
    for (const a of arms) {
      const u = a.wins / a.visits + Math.sqrt((1.2 * logT) / a.visits);
      if (u > bestU) { bestU = u; best = a; }
    }
    sim.load(pos.board, pos.ko);
    sim.play(best.move, c);
    const w = sim.playout((3 - c) as Color, best.move, komi, rand, empties, own);
    best.visits++; total++; done++;
    if (w === c) best.wins++;
  }

  const rate = (a: Candidate) => a.wins / a.visits;
  cands.sort((a, b) => b.visits - a.visits || rate(b) - rate(a));
  const top = cands[0];
  // Partie terminée : plus rien d'utile à jouer, on passe.
  if (done >= 20 && settled(pos, own, done)) return passer(cands.map(a => a.move));
  // Part de hasard des niveaux faibles.
  if (lvl.hasard > 0 && rand() < lvl.hasard) return cands[Math.floor(rand() * cands.length)].move;
  // Coups urgents (capture, sauvetage) : joués sauf si les simulations les jugent nettement moins bons.
  let urgent: Candidate | null = null;
  for (const a of cands) if (a.prior >= 4 && (!urgent || a.prior > urgent.prior)) urgent = a;
  if (urgent && rate(urgent) >= rate(top) - 0.15) return urgent.move;
  return top.move;
}

/** Vrai si le coup (ou la passe) est légal dans la position. */
export function isLegalMove(pos: Position, p: number): boolean {
  return p === -1 || typeof play(pos, p) !== 'string';
}
