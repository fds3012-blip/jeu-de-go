// Moteur simple : Monte-Carlo « à plat » (UCB1 sur les coups candidats) avec heuristiques de capture.
// Pas de réseau de neurones : il sert d'adversaire débutant en attendant KataGo.
// Synchrone et sans DOM, pour tourner dans un Web Worker comme dans les tests.
import { groupAt, neighbors, play, type Color, type Position } from '../go/rules';
import { score } from '../go/score';
import { brecheAFermer, coupDeFermeture, frontieresOuvertes, partieAvancee } from '../go/frontieres';
import { toLabel } from '../go/coords';
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
  /**
   * Température du tirage au hasard (champ `hasard` du niveau) : le coup est tiré selon la politique du réseau
   * élevée à la puissance 1 / température. 1 = la politique telle quelle ; plus haut, des coups moins probables.
   */
  temperature?: number;
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
  /**
   * Probabilité de jouer un coup au hasard au lieu du meilleur. Moteur simple : un candidat uniforme.
   * Niveaux KataGo : un coup tiré selon la politique du réseau (voir `KataGoLevel.temperature`), jamais dans
   * ses propres yeux ni en auto-atari.
   */
  hasard: number;
  heuristiques: boolean; // priorité aux captures et aux sauvetages
  /** Ne passe pas tant qu'une frontière reste ouverte : il la ferme d'abord (#159). */
  fermeFrontieres?: boolean;
  /** Présent : ce niveau joue avec KataGo (réseau g170-b6c96). */
  katago?: KataGoLevel;
}

// Repli commun des niveaux KataGo : le moteur simple à pleine force (niveau Caillou).
const repli = { playouts: 20000, timeMs: 800, hasard: 0, heuristiques: true, fermeFrontieres: true } as const;

/**
 * Échelle des défis, du plus facile au plus fort. Bambou et Renard jouent une partie de leurs coups selon la
 * politique du réseau (`hasard`, `temperature`, #179) : sans ça, Bambou écrase Caillou de 71 points sur 81.
 * Mesures : docs/game-design/equilibrage.md.
 */
export const OPPONENTS: Opponent[] = [
  { id: 'pomme', nom: 'Pomme', rang: '20 kyu', phrase: 'Elle apprend comme toi.', description: 'Joue un peu au hasard. Parfait pour ta première partie.', playouts: 250, timeMs: 150, hasard: 0.3, heuristiques: false, fermeFrontieres: true },
  { id: 'caillou', nom: 'Caillou', rang: '16 kyu', phrase: 'Il capture tout ce qui traîne.', description: 'Capture dès que tu le laisses faire. Protège bien tes pierres.', playouts: 20000, timeMs: 600, hasard: 0, heuristiques: true, fermeFrontieres: true },
  { id: 'bambou', nom: 'Bambou', rang: '13 kyu', phrase: 'Il plie, mais ne rompt jamais.', description: 'Joue solide et relie ses pierres. Cherche ses points faibles.', ...repli, hasard: 0.7, katago: { visits: 4, tolerance: 12, style: 'solide', temperature: 1.5 } },
  { id: 'renard', nom: 'Renard', rang: '10 kyu', phrase: "Il coupe dès que tu t'étires trop.", description: 'Aime couper et attaquer. Garde tes groupes bien reliés.', ...repli, hasard: 0.35, katago: { visits: 8, tolerance: 8, style: 'agressif', temperature: 1.5 } },
  { id: 'riviere', nom: 'Rivière', rang: '7 kyu', phrase: 'Elle se faufile le long des bords.', description: 'Prend les coins et les bords. Ne la laisse pas tout entourer.', ...repli, katago: { visits: 16, tolerance: 5, style: 'territorial' } },
  { id: 'tigre', nom: 'Tigre', rang: '5 kyu', phrase: 'Il attaque sans jamais lâcher.', description: 'Attaque sans relâche. Fais vivre tes groupes tôt.', ...repli, katago: { visits: 32, tolerance: 3, style: 'agressif' } },
  { id: 'montagne', nom: 'Montagne', rang: '3 kyu', phrase: 'Elle ne bouge pas, et ne cède rien.', description: 'Très solide, presque sans faute. Il faut la battre aux points.', ...repli, katago: { visits: 64, tolerance: 1.5, style: 'solide' } },
  { id: 'dragon', nom: 'Dragon', rang: '1 kyu', phrase: 'Il compte chaque point, même les tiens.', description: 'Compte très bien son territoire. Chaque point compte.', ...repli, katago: { visits: 128, tolerance: 0.8, style: 'territorial' } },
  { id: 'sensei', nom: 'Sensei', rang: '1 dan', phrase: 'Il a tout vu. Montre-lui ton go.', description: 'Le dernier défi. Joue son meilleur coup à chaque fois.', ...repli, katago: { visits: 200, tolerance: 0, style: 'solide' } },
];

export function opponent(id: OpponentId): Opponent {
  return OPPONENTS.find(o => o.id === id) ?? OPPONENTS[0];
}

export interface EngineOptions {
  komi?: number; seed?: number; timeMs?: number; playouts?: number;
  /**
   * Premières parties (#185, voir `accommodant` dans src/app/equilibrage.ts) : quand le joueur passe, l'ordi passe aussi,
   * même s'il pourrait encore grappiller quelques points. Seule exception (#235) : une brèche dans **sa** frontière
   * (`brecheAFermer`), qu'il ferme d'abord, une seule fois : dès la deuxième passe du joueur (`passesJoueur`), il passe.
   * Il ne joue jamais chez le joueur, même si tout le plateau est encore ouvert (débutant qui passe tôt).
   */
  accommodant?: boolean;
  /** Passes du joueur depuis le début de la partie, celle-ci comprise (parties accommodantes). Par défaut 1. */
  passesJoueur?: number;
}

// ---------- Réponse à la passe du joueur (#185) ----------
/**
 * Gain minimal, en points, pour que l'ordi continue après la passe du joueur (hors parties accommodantes).
 * Gain = avance comptée si l'ordi joue ce coup (pierres mortes réestimées, le joueur au trait) moins avance comptée
 * s'il passe maintenant (la partie s'arrête), en points de surface : une pierre vivante prise vaut sa pierre et son point.
 * Sous 2 points, ce n'est que du bruit d'estimation ou une pierre déjà morte qu'on retire ; à partir de 2,
 * l'ordi prend vraiment quelque chose (au moins une pierre vivante), et on peut dire où.
 */
export const SEUIL_POINTS = 2;

/** Pourquoi l'ordi joue au lieu de passer, en une phrase courte que l'écran peut afficher (« Pomme continue : … »). */
export interface Raison {
  motif: 'frontiere' | 'points';
  /** Point joué (index y * N + x). */
  point: number;
  /** Gain estimé en points (motif « points »). */
  gain?: number;
  /** Par exemple « il reste une frontière à fermer en E4 » ou « il reste 3 points à prendre en E4 ». */
  texte: string;
}

/** Coup de l'ordi (-1 = passe) et, s'il répond à une passe du joueur sans passer, la raison (sinon `null`). */
export interface CoupExplique { move: number; raison: Raison | null }

export function raisonFrontiere(point: number, size: number): Raison {
  return { motif: 'frontiere', point, texte: `il reste une frontière à fermer en ${toLabel(point, size)}` };
}

/** Brèche dans la frontière de l'ordi (parties accommodantes, #235) : il ferme sa porte, puis il passe. */
export function raisonBreche(point: number, size: number): Raison {
  return { motif: 'frontiere', point, texte: `il reste un trou dans sa frontière en ${toLabel(point, size)}` };
}

/**
 * Réponse accommodante à la passe du joueur (#235) : passe, sauf une brèche dans sa propre frontière à la première passe.
 * Début de partie ou niveau qui ne ferme pas ses frontières : passe tout de suite.
 */
export function reponseAccommodante(pos: Position, lvl: Opponent, opts: EngineOptions, mortes: () => Iterable<number>, prefer: readonly number[] = []): CoupExplique {
  if (!lvl.fermeFrontieres || !partieAvancee(pos.board) || (opts.passesJoueur ?? 1) >= 2) return { move: -1, raison: null };
  const b = brecheAFermer(pos, mortes(), prefer);
  return b < 0 ? { move: -1, raison: null } : { move: b, raison: raisonBreche(b, pos.size) };
}

export function raisonPoints(point: number, gain: number, size: number): Raison {
  const n = Math.max(1, Math.round(gain));
  return { motif: 'points', point, gain, texte: `il reste ${n === 1 ? 'un point' : `${n} points`} à prendre en ${toLabel(point, size)}` };
}

/**
 * Simulations des pierres mortes pour mesurer un gain : nombre fixe (le résultat ne dépend pas de la vitesse de l'appareil,
 * sinon un seki mal estimé sur un téléphone lent ferait jouer l'ordi pour rien), avec un plafond de temps large.
 */
const ESTIMATION_GAIN = { playouts: 400, timeMs: 1500 } as const;

/** Position telle qu'elle serait comptée si le joueur au trait passait : l'adversaire au trait, plus de ko. */
function apresPasse(pos: Position): Position {
  return { ...pos, toPlay: (3 - pos.toPlay) as Color, ko: -1, lastMove: -1 };
}

/** Avance de `c` au comptage par surface, pierres `dead` retirées. */
function avanceSurface(pos: Position, c: Color, dead: readonly number[]): number {
  const s = score(pos, 0, 'chinese', new Set(dead));
  return c === 1 ? s.black - s.white : s.white - s.black;
}

/**
 * Points que rapporte le coup `m` au joueur au trait, par rapport à une passe qui finit la partie (voir SEUIL_POINTS).
 * `mortesSiPasse` : pierres mortes si la partie s'arrête maintenant (par défaut, estimées). Estimation par simulations,
 * l'adversaire au trait après le coup : une pierre posée chez lui est jugée morte (gain nul ou négatif), une vraie prise rapporte.
 */
export function gainDuCoup(pos: Position, m: number, opts: { seed?: number; timeMs?: number; mortesSiPasse?: readonly number[] } = {}): number {
  const r = play(pos, m);
  if (typeof r === 'string') return -Infinity;
  const c = pos.toPlay, dOpts = { seed: opts.seed, ...ESTIMATION_GAIN, ...(opts.timeMs ? { timeMs: opts.timeMs } : {}) };
  const avant = opts.mortesSiPasse ?? deadStones(apresPasse(pos), dOpts);
  return avanceSurface(r, c, deadStones(r, dOpts)) - avanceSurface(pos, c, avant);
}

/**
 * Après une passe du joueur, frontières fermées : le coup qui rapporte le plus s'il atteint SEUIL_POINTS, sinon la passe.
 * On évalue les 3 coups préférés du moteur (`ordre`) et les prises immédiates, 5 coups au plus : la réponse reste rapide.
 */
export function coupQuiRapporte(pos: Position, ordre: readonly number[], seed?: number): CoupExplique {
  const c = pos.toPlay, essais: number[] = [];
  for (const m of ordre) {
    if (essais.length >= 5) break;
    if (essais.length < 3) { essais.push(m); continue; }
    const r = play(pos, m);
    if (typeof r !== 'string' && r.captures[c] > pos.captures[c]) essais.push(m);
  }
  const mortesSiPasse = deadStones(apresPasse(pos), { seed, ...ESTIMATION_GAIN });
  let best = -1, gain = -Infinity;
  for (const m of essais) {
    const g = gainDuCoup(pos, m, { seed, mortesSiPasse });
    if (g > gain) { gain = g; best = m; }
  }
  return best >= 0 && gain >= SEUIL_POINTS ? { move: best, raison: raisonPoints(best, gain, pos.size) } : { move: -1, raison: null };
}

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
  return chooseMoveDetail(pos, niveau, opts).move;
}

/**
 * Comme `chooseMove`, avec la raison quand l'ordi ne passe pas juste après une passe du joueur (#185) :
 * - partie avancée et frontière ouverte : il la ferme (« il reste une frontière à fermer en E4 ») ;
 * - frontières fermées, partie accommodante : il passe ;
 * - frontières fermées sinon : il ne joue que si un coup rapporte au moins SEUIL_POINTS (« il reste 3 points à prendre en E4 »).
 * Début de partie (moins d'un quart du plateau couvert) : accommodant, il passe ; sinon il passe s'il se croit gagnant.
 */
export function chooseMoveDetail(pos: Position, niveau: OpponentId | Opponent, opts: EngineOptions = {}): CoupExplique {
  const lvl = typeof niveau === 'string' ? opponent(niveau) : niveau;
  const komi = opts.komi ?? 6.5, rand = rng(opts.seed), c = pos.toPlay;
  const PASSE: CoupExplique = { move: -1, raison: null };
  // Avant de passer, un niveau qui ferme ses frontières joue un coup de fermeture s'il en reste un (#159).
  // `prefer` : coups du moteur, du meilleur au moins bon. Pierres mortes calculées seulement s'il y a une frontière.
  let morts: number[] | null = null;
  const mortes = () => (morts ??= deadStones(pos, { seed: opts.seed, timeMs: Math.min(150, opts.timeMs ?? 150) }));
  const passer = (prefer: number[] = []): CoupExplique => {
    if (!lvl.fermeFrontieres || !partieAvancee(pos.board) || !frontieresOuvertes(pos.board, pos.size).length) return PASSE;
    const f = coupDeFermeture(pos, mortes(), prefer);
    return f < 0 ? PASSE : { move: f, raison: raisonFrontiere(f, pos.size) };
  };

  // Le joueur vient de passer (#185).
  let viserGain = false;
  if (pos.lastMove === -1 && opts.accommodant) return reponseAccommodante(pos, lvl, opts, mortes);
  if (pos.lastMove === -1) {
    if (partieAvancee(pos.board)) {
      const f = passer();
      if (f.move >= 0 || opts.accommodant) return f;
      viserGain = true; // frontières fermées : on ne continue que si un coup rapporte vraiment (voir après la recherche)
    } else {
      if (opts.accommodant) return PASSE;
      const sc = score(pos, komi, 'chinese', new Set(mortes()));
      if (sc.winner === c) return PASSE;
    }
  }

  const cands = candidates(pos, lvl.heuristiques);
  if (!cands.length) return passer();

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
  if (viserGain) return coupQuiRapporte(pos, cands.map(a => a.move), opts.seed);
  const top = cands[0], coup = (move: number): CoupExplique => ({ move, raison: null });
  // Partie terminée : plus rien d'utile à jouer, on passe.
  if (done >= 20 && settled(pos, own, done)) return passer(cands.map(a => a.move));
  // Part de hasard des niveaux faibles.
  if (lvl.hasard > 0 && rand() < lvl.hasard) return coup(cands[Math.floor(rand() * cands.length)].move);
  // Coups urgents (capture, sauvetage) : joués sauf si les simulations les jugent nettement moins bons.
  let urgent: Candidate | null = null;
  for (const a of cands) if (a.prior >= 4 && (!urgent || a.prior > urgent.prior)) urgent = a;
  if (urgent && rate(urgent) >= rate(top) - 0.15) return coup(urgent.move);
  return coup(top.move);
}

/** Vrai si le coup (ou la passe) est légal dans la position. */
export function isLegalMove(pos: Position, p: number): boolean {
  return p === -1 || typeof play(pos, p) !== 'string';
}
