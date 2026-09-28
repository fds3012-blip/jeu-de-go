// Revue d'une partie terminée (issue #34) : logique pure, testée dans revue.test.ts.
// La partie est gardée en SGF dans localStorage (clé REVUE_KEY) ; l'écran src/app/Revue.tsx la relit,
// estime l'avance de Noir après chaque coup, puis montre les plus grosses erreurs du joueur.
import { groupAt, isLegal, neighbors, newPosition, play, type Color, type Position } from '../go/rules';
import { readSgf, writeSgf } from '../go/sgf';
import { toLabel } from '../go/coords';
import type { AnalyseRevue } from '../engine';

/** Dernière partie terminée, pour la revue (localStorage ; Supabase viendra plus tard). */
export const REVUE_KEY = 'go.revue.v1';

export interface PartieGardee { sgf: string; adversaire?: string; date: string }

/**
 * Résultat au format SGF (propriété RE, #187) : « B+3.5 », « W+R » (abandon), « 0 » (égalité).
 * `marge` : écart en points, komi compris (ignoré en cas d'abandon).
 */
export function resultatSgf(gagnant: 0 | 1 | 2, abandon: boolean, marge: number): string {
  if (gagnant === 0 || (!abandon && marge === 0)) return '0';
  return `${gagnant === 1 ? 'B' : 'W'}+${abandon ? 'R' : String(Math.abs(marge))}`;
}

/** SGF de la partie, tiré de l'historique des positions (Noir commence, `tt` = passe) ; `resultat` : propriété RE. */
export function sgfDepuisHistorique(history: Position[], komi: number, noms: { noir?: string; blanc?: string; resultat?: string } = {}): string {
  const size = history[0].size;
  const moves: { color: Color; p: number }[] = [];
  for (let i = 1; i < history.length; i++) moves.push({ color: history[i - 1].toPlay, p: history[i].lastMove ?? -1 });
  return writeSgf({ size, komi, rules: 'japanese', black: noms.noir, white: noms.blanc, result: noms.resultat, setupBlack: [], setupWhite: [], moves });
}

/** Positions successives rejouées depuis le SGF (index 0 : plateau vide). S'arrête au premier coup illégal. */
export function positionsDepuisSgf(sgf: string): { positions: Position[]; komi: number } {
  const g = readSgf(sgf);
  const positions: Position[] = [newPosition(g.size)];
  for (const m of g.moves) {
    const cur = positions[positions.length - 1];
    const r = play(m.color === cur.toPlay ? cur : { ...cur, toPlay: m.color, ko: -1 }, m.p);
    if (typeof r === 'string') break;
    positions.push(r);
  }
  return { positions, komi: g.komi };
}

export interface Erreur {
  /** Numéro du coup fautif (1 = premier coup) : il mène de la position `coup - 1` à la position `coup`. */
  coup: number;
  /** Points perdus par ce coup (> 0). */
  perte: number;
}

/**
 * Les `n` plus grosses erreurs de `joueur` : les plus fortes chutes de son avance après un de ses coups.
 * `avances[i]` : avance de Noir (points, komi compris) dans la position i ; `null` si inconnue.
 * Une chute de moins de `seuil` points (1 par défaut) n'est pas une erreur : c'est du bruit de l'estimation. Triées de la plus grosse à la plus petite.
 */
export function grossesErreurs(positions: Position[], avances: (number | null)[], joueur: Color | null, n = 3, seuil = 1): Erreur[] {
  const out: Erreur[] = [];
  for (let i = 1; i < positions.length && i < avances.length; i++) {
    const avant = avances[i - 1], apres = avances[i], c = positions[i - 1].toPlay;
    if (avant == null || apres == null || (joueur && c !== joueur)) continue;
    const perte = c === 1 ? avant - apres : apres - avant;
    if (perte >= seuil) out.push({ coup: i, perte });
  }
  return out.sort((a, b) => b.perte - a.perte || a.coup - b.coup).slice(0, n);
}

const pts = (n: number) => { const v = Math.max(1, Math.round(n)); return `${v} point${v > 1 ? 's' : ''}`; };

/** Message de Mochi quand aucune erreur ne dépasse le seuil. */
export const AUCUNE_ERREUR = 'Aucune grosse erreur. Bien joué !';
/** Ligne discrète quand KataGo n'est pas disponible : pas de meilleur coup montré. */
export const SANS_KATAGO = 'Pour voir le meilleur coup, joue contre Bambou ou plus fort.';

/**
 * Vrai si on peut montrer `move` comme meilleur coup à un débutant. On ne montre rien plutôt qu'un conseil douteux :
 * pas de passe, pas de coup illégal, pas de première ligne tant que le plateau est encore ouvert (moins d'un tiers
 * des intersections occupées), et le coup doit gagner au moins `seuil` point par rapport au coup joué.
 * `gain` : avance du joueur après le coup conseillé moins son avance après le coup joué.
 */
export function conseilFiable(pos: Position, move: number | null | undefined, gain: number, seuil = 1): boolean {
  if (move == null || move < 0 || move >= pos.size * pos.size || !isLegal(pos, move)) return false;
  if (!(gain >= seuil)) return false;
  const n = pos.size, x = move % n, y = Math.floor(move / n);
  let pierres = 0;
  for (const c of pos.board) if (c) pierres++;
  const bord = x === 0 || y === 0 || x === n - 1 || y === n - 1;
  return !(bord && pierres < (n * n) / 3);
}

/**
 * Phrase de Mochi pour une erreur : courte, au tutoiement, sans jargon. Elle décrit l'erreur, sans coordonnée ;
 * `meilleur` (coup conseillé, déjà validé par conseilFiable) ajoute « Essaie plutôt D4, la pierre verte. ».
 */
export function phraseErreur(e: Erreur, positions: Position[], meilleur: number | null): string {
  const avant = positions[e.coup - 1], apres = positions[e.coup], size = avant.size;
  const joue = apres.lastMove ?? -1, adv = (3 - avant.toPlay) as Color;
  const perdues = positions[e.coup + 1] ? positions[e.coup + 1].captures[adv] - apres.captures[adv] : 0;
  let constat: string;
  if (joue < 0) constat = 'Tu as passé trop tôt : il restait des points à prendre.';
  else if (perdues > 0) constat = `Après ce coup, l'adversaire capture ${perdues > 1 ? `${perdues} pierres` : 'une pierre'}. Tu perds environ ${pts(e.perte)}.`;
  else constat = `Ici tu as perdu environ ${pts(e.perte)}.`;
  return meilleur != null && meilleur >= 0 ? `${constat} Essaie plutôt ${toLabel(meilleur, size)}, la pierre verte.` : constat;
}

/**
 * Historique pour « Rejouer d'ici » : on reprend juste avant le coup `coup`, à un moment où `joueur` a le trait
 * (contre l'ordi, tu rejoues toujours Noir). Renvoie au moins le plateau de départ.
 */
export function rejouerDici(positions: Position[], coup: number, joueur: Color | null): Position[] {
  let i = Math.max(0, Math.min(coup - 1, positions.length - 1));
  if (joueur) while (i > 0 && positions[i].toPlay !== joueur) i--;
  return positions.slice(0, i + 1);
}

/** Hauteur de la courbe pour une avance de Noir `v` (0 en haut du repère). */
export function courbeY(v: number, hauteur: number, size: number): number {
  return hauteur / 2 - (hauteur / 2) * Math.tanh(v / (size * 1.5)) * 0.94;
}

/** Tracé SVG de la courbe d'avantage : Noir en bas, Blanc en haut. Une avance de Noir fait monter la courbe. */
export function courbe(avances: (number | null)[], largeur: number, hauteur: number, size: number): { ligne: string; aire: string } {
  const n = avances.length;
  if (n === 0) return { ligne: '', aire: '' };
  const y = (v: number) => courbeY(v, hauteur, size);
  const x = (i: number) => (n === 1 ? largeur / 2 : (i * largeur) / (n - 1));
  let dernier = 0;
  const pts: string[] = [];
  avances.forEach((v, i) => { if (v != null) dernier = v; pts.push(`${x(i).toFixed(1)} ${y(dernier).toFixed(1)}`); });
  const ligne = `M${pts.join('L')}`;
  return { ligne, aire: `${ligne}L${x(n - 1).toFixed(1)} ${hauteur}L${x(0).toFixed(1)} ${hauteur}Z` };
}

// ---------- Note de chaque coup (issue #71) ----------
// Comme la « Game Review » de chess.com, mais en points de go : chaque coup est noté selon les points qu'il perd
// par rapport au meilleur coup du moteur. Règle d'or : aucune note fausse. Dans le doute, on ne note pas (`null`)
// ou on donne la note la plus prudente.

/** Notes possibles. `solide` : faible perte sans KataGo (on ne sait pas si c'était le meilleur coup). */
export type Note = 'brillant' | 'meilleur' | 'excellent' | 'bon' | 'solide' | 'imprecision' | 'erreur' | 'grosse';

/** Ordre d'affichage, du meilleur au pire. */
export const NOTES: Note[] = ['brillant', 'meilleur', 'excellent', 'bon', 'solide', 'imprecision', 'erreur', 'grosse'];

/** Libellé et symbole de chaque note : le symbole double la couleur (accessibilité). */
export const NOTE_INFO: Record<Note, { libelle: string; symbole: string }> = {
  brillant: { libelle: 'Brillant', symbole: '!!' },
  meilleur: { libelle: 'Meilleur coup', symbole: '★' },
  excellent: { libelle: 'Excellent', symbole: '!' },
  bon: { libelle: 'Bon', symbole: '✓' },
  solide: { libelle: 'Solide', symbole: '✓' },
  imprecision: { libelle: 'Imprécision', symbole: '?!' },
  erreur: { libelle: 'Erreur', symbole: '?' },
  grosse: { libelle: 'Grosse erreur', symbole: '??' },
};

/**
 * Seuils de perte, en points, calibrés pour le 9 × 9.
 * - Avec KataGo (réseau b6c96, 32 visites) : on garde les seuils de départ de l'issue, 0,5 / 1,5 / 3 / 6.
 *   Sur 9 × 9 une partie se joue à quelques points près (komi 6,5 pour 81 intersections) : 6 points perdus,
 *   c'est déjà la partie qui bascule. Un candidat bien exploré prend sa perte dans l'arbre de recherche même,
 *   bien moins bruité qu'une différence entre deux analyses.
 * - Sans KataGo (moteur simple : propriété par simulations en 150 ms), le bruit mesuré sur une même position de
 *   milieu de partie est d'environ 1,4 point d'écart-type (scripts : 12 tirages), soit environ 2 sur la
 *   différence de deux positions. On lisse la courbe (médiane sur 3 positions), on garde la plus petite perte
 *   (brute ou lissée) et on élargit les seuils : jusqu'à 2,5 points le coup est « Solide », une « Erreur » demande
 *   plus de 4 points (2 écarts-types) et une « Grosse erreur » plus de 8.
 */
export const SEUILS_KATAGO = { excellent: 0.5, bon: 1.5, imprecision: 3, erreur: 6 } as const;
export const SEUILS_SIMPLE = { solide: 2.5, imprecision: 4, erreur: 8 } as const;
/** Brillant : le coup doit dépasser le premier choix de KataGo d'au moins ce nombre de points, confirmé par une analyse longue. */
export const MARGE_BRILLANT = 1;
/** Visites minimales pour croire l'ordre des candidats de KataGo. */
export const VISITES_MIN = 8;
/** Au-delà de cette avance, la partie est jouée : pas de Brillant (tout coup « gagne »). */
const PARTIE_JOUEE = 15;

/** Analyse d'une position pour la revue (moteur : `analyseRevue`). `lead` : avance de Noir, komi compris. */
export type { AnalyseRevue };

/** Ce que dit Mochi de la note du coup affiché, après « Tu joues E5. ». */
export function phraseNote(n: NoteCoup): string {
  switch (n.note) {
    case 'brillant': return 'Brillant ! Tu as trouvé mieux que le premier choix de KataGo.';
    case 'meilleur': return 'Meilleur coup !';
    case 'excellent': return 'Excellent coup.';
    case 'bon': return `Bon coup, à peine ${n.perte < 1 ? 'un point' : pts(n.perte)} de moins que le meilleur.`;
    case 'solide': return 'Coup solide.';
    case 'imprecision': return `Imprécision : environ ${pts(n.perte)} de perdus.`;
    case 'erreur': return `Erreur : environ ${pts(n.perte)} de perdus.`;
    case 'grosse': return `Grosse erreur : environ ${pts(n.perte)} de perdus.`;
  }
}

export interface NoteCoup {
  /** Numéro du coup (1 = premier coup). */
  coup: number;
  couleur: Color;
  note: Note;
  /** Points perdus par rapport au meilleur coup (≥ 0). */
  perte: number;
}

/**
 * Vrai si rien ne reste à prendre : aucune chaîne en atari (rien à capturer ni à sauver) et aucune zone vide
 * encore ouverte entre les deux couleurs (au plus 2 points neutres, les « dame », qui ne valent rien), sur un
 * plateau déjà bien rempli (au moins 30 % de pierres : avant, les zones « à une seule couleur » sont encore à conquérir).
 * Sert à ne jamais noter comme une erreur la passe de fin de partie.
 */
export function rienAPrendre(pos: Position): boolean {
  const n = pos.size, N = n * n, voisins = neighbors(n), vu = new Uint8Array(N);
  let pierres = 0;
  for (let p = 0; p < N; p++) if (pos.board[p]) pierres++;
  if (pierres < N * 0.3) return false;
  for (let p = 0; p < N; p++) {
    if (!pos.board[p] || vu[p]) continue;
    const g = groupAt(pos.board, n, p);
    for (const s of g.stones) vu[s] = 1;
    if (g.liberties.size <= 1) return false;
  }
  const zone = new Uint8Array(N);
  for (let p = 0; p < N; p++) {
    if (pos.board[p] || zone[p]) continue;
    const pile = [p];
    let bords = 0, taille = 0;
    zone[p] = 1;
    while (pile.length) {
      const q = pile.pop()!;
      taille++;
      for (const v of voisins[q]) {
        const c = pos.board[v];
        if (c) bords |= c;
        else if (!zone[v]) { zone[v] = 1; pile.push(v); }
      }
    }
    if (bords === 0 || (bords === 3 && taille > 2)) return false;
  }
  return true;
}

/** Médiane de trois nombres. */
const mediane = (a: number, b: number, c: number) => Math.max(Math.min(a, b), Math.min(Math.max(a, b), c));

/**
 * Avance de Noir lissée : médiane de la position et de ses deux voisines (même moteur).
 * Un pic isolé (bruit) disparaît ; une vraie chute, qui dure, reste au bon coup.
 */
export function lisser(analyses: (AnalyseRevue | null)[]): (number | null)[] {
  return analyses.map((a, i) => {
    if (!a) return null;
    const g = analyses[i - 1], d = analyses[i + 1];
    if (!g || !d || g.engine !== a.engine || d.engine !== a.engine) return a.lead;
    return mediane(g.lead, a.lead, d.lead);
  });
}

/** Vrai si le coup `i` (hors du top 3 de KataGo) fait nettement mieux que son premier choix, selon l'analyse courte. */
function pisteBrillant(positions: Position[], analyses: (AnalyseRevue | null)[], i: number): boolean {
  const avant = analyses[i - 1], apres = analyses[i], move = positions[i].lastMove ?? -1;
  if (!avant || !apres || avant.engine !== 'katago' || apres.engine !== 'katago' || move < 0) return false;
  const coups = avant.coups ?? [], premier = coups[0];
  if (!premier || premier.visits < VISITES_MIN || Math.abs(premier.lead) >= PARTIE_JOUEE) return false;
  if (coups.slice(0, 3).some(c => c.move === move)) return false;
  const s = positions[i - 1].toPlay === 1 ? 1 : -1;
  return s * apres.lead >= premier.lead + MARGE_BRILLANT;
}

/** Coups candidats au Brillant : à confirmer par une analyse longue avant de les noter. */
export function candidatsBrillant(positions: Position[], analyses: (AnalyseRevue | null)[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < positions.length; i++) if (pisteBrillant(positions, analyses, i)) out.push(i);
  return out;
}

/**
 * Note de chaque coup. `analyses[i]` : analyse de la position i (0 = plateau vide), `null` si inconnue.
 * `confirmations[coup]` : avance du joueur qui a joué `coup`, tirée d'une analyse longue de la position d'après ;
 * seule une confirmation peut donner « Brillant ». Renvoie un tableau aligné sur les coups (index 0 = coup 1),
 * avec `null` quand on ne peut pas noter sans risque de se tromper (position non analysée, moteurs différents).
 */
export function noterCoups(positions: Position[], analyses: (AnalyseRevue | null)[], confirmations: Record<number, number> = {}): (NoteCoup | null)[] {
  const lisse = lisser(analyses);
  const out: (NoteCoup | null)[] = [];
  for (let i = 1; i < positions.length; i++) {
    const avant = analyses[i - 1], apres = analyses[i];
    const couleur = positions[i - 1].toPlay, s = couleur === 1 ? 1 : -1, move = positions[i].lastMove ?? -1;
    // Deux moteurs différents ne se comparent pas : pas de note.
    if (!avant || !apres || avant.engine !== apres.engine) { out.push(null); continue; }
    const brute = s * (avant.lead - apres.lead);
    const finale = move < 0 && rienAPrendre(positions[i - 1]);

    if (avant.engine === 'simple') {
      const l0 = lisse[i - 1] ?? avant.lead, l1 = lisse[i] ?? apres.lead;
      const perte = finale ? 0 : Math.max(0, Math.min(brute, s * (l0 - l1)));
      const S = SEUILS_SIMPLE;
      const note: Note = perte <= S.solide ? 'solide' : perte <= S.imprecision ? 'imprecision' : perte <= S.erreur ? 'erreur' : 'grosse';
      out.push({ coup: i, couleur, note, perte });
      continue;
    }

    const coups = avant.coups ?? [];
    const premier = coups[0], sur = !!premier && premier.visits >= VISITES_MIN;
    const k = coups.findIndex(c => c.move === move), cand = k >= 0 ? coups[k] : undefined;
    let perte = sur && cand && cand.visits >= VISITES_MIN ? Math.max(0, premier.lead - cand.lead) : Math.max(0, brute);
    if (finale) perte = 0;
    const T = SEUILS_KATAGO;
    let note: Note = sur && k === 0 ? 'meilleur'
      : perte <= T.excellent ? 'excellent' : perte <= T.bon ? 'bon' : perte <= T.imprecision ? 'imprecision' : perte <= T.erreur ? 'erreur' : 'grosse';
    const conf = confirmations[i];
    if (conf != null && pisteBrillant(positions, analyses, i) && conf >= premier.lead + MARGE_BRILLANT) { note = 'brillant'; perte = 0; }
    out.push({ coup: i, couleur, note, perte });
  }
  return out;
}

/** Perte plafonnée pour la précision : une seule catastrophe ne doit pas écraser toute la partie. */
export const PERTE_MAX = 12;

/**
 * Précision d'un joueur, en % : 100 / (1 + m / 4), où m est sa perte moyenne par coup noté (plafonnée à 12 points
 * par coup). Perte moyenne 0 → 100 %, 1 point → 80 %, 2 → 67 %, 4 → 50 %, 8 → 33 %. `null` si aucun coup noté.
 */
export function precision(notes: (NoteCoup | null)[], couleur: Color): number | null {
  const pertes = notes.filter((n): n is NoteCoup => !!n && n.couleur === couleur).map(n => Math.min(PERTE_MAX, n.perte));
  if (!pertes.length) return null;
  const m = pertes.reduce((a, b) => a + b, 0) / pertes.length;
  return Math.round(100 / (1 + m / 4));
}

/** Nombre de coups par note pour un joueur. */
export function compteNotes(notes: (NoteCoup | null)[], couleur: Color): Record<Note, number> {
  const c = Object.fromEntries(NOTES.map(n => [n, 0])) as Record<Note, number>;
  for (const n of notes) if (n && n.couleur === couleur) c[n.note]++;
  return c;
}

/**
 * Phrase de Mochi qui résume la partie, au tutoiement. `adversaire` : nom de l'ordi (sinon Blanc).
 * Elle cite la plus grosse erreur du joueur s'il y en a une, sinon elle félicite.
 */
export function phraseBilan(notes: (NoteCoup | null)[], joueur: Color, adversaire?: string): string {
  const moi = precision(notes, joueur), lui = precision(notes, (3 - joueur) as Color);
  if (moi == null) return 'Pas assez de coups pour faire le bilan.';
  const miens = notes.filter((n): n is NoteCoup => !!n && n.couleur === joueur);
  const pire = miens.filter(n => n.note === 'erreur' || n.note === 'grosse').sort((a, b) => b.perte - a.perte || a.coup - b.coup)[0];
  const debut = miens.some(n => n.note === 'brillant') ? 'Un coup brillant, bravo ! '
    : moi >= 85 ? 'Très belle partie, tu as joué juste. '
    : lui != null && moi > lui ? `Tu as joué plus juste que ${adversaire ?? 'Blanc'}. `
    : moi >= 60 ? 'Partie correcte. ' : 'Partie difficile, ça arrive. ';
  if (pire) return `${debut}Ton coup ${pire.coup} t'a coûté ${pts(pire.perte)} : va le revoir.`;
  return `${debut}Aucune erreur, continue comme ça !`;
}
