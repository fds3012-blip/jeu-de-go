// Revue d'une partie terminée (issue #34) : logique pure, testée dans revue.test.ts.
// La partie est gardée en SGF dans localStorage (clé REVUE_KEY) ; l'écran src/app/Revue.tsx la relit,
// estime l'avance de Noir après chaque coup, puis montre les plus grosses erreurs du joueur.
import { groupAt, isLegal, neighbors, newPosition, play, type Color, type Position } from '../go/rules';
import { readSgf, writeSgf } from '../go/sgf';
import { toLabel } from '../go/coords';
import { initialPosition } from '../go/replay';
import type { AnalyseRevue } from '../engine';
import { nombre, t } from '../content/i18n';

/** Dernière partie terminée, pour la revue (localStorage ; Supabase viendra plus tard). */
export const REVUE_KEY = 'go.revue.v1';

/**
 * Partie gardée pour la revue. Partie importée (#286) : `importee`, le camp du joueur et le nom de l'adversaire
 * (tiré du SGF, nettoyé) ; elle remplace la dernière partie jouée, comme une partie jouée remplace la précédente.
 */
export interface PartieGardee { sgf: string; adversaire?: string; date: string; importee?: boolean; joueur?: Color }

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

/**
 * Positions successives rejouées depuis le SGF (index 0 : position de départ, pierres de handicap comprises, #286).
 * S'arrête au premier coup illégal.
 */
export function positionsDepuisSgf(sgf: string): { positions: Position[]; komi: number; resultat?: string } {
  const g = readSgf(sgf);
  const positions: Position[] = [initialPosition(g) ?? newPosition(g.size)];
  for (const m of g.moves) {
    const cur = positions[positions.length - 1];
    const r = play(m.color === cur.toPlay ? cur : { ...cur, toPlay: m.color, ko: -1 }, m.p);
    if (typeof r === 'string') break;
    positions.push(r);
  }
  return { positions, komi: g.komi, resultat: g.result };
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

const pts = (n: number) => t('revue.points', { n: Math.max(1, Math.round(n)) });

// Constantes de ce fichier : le texte français d'origine (tests) ; l'écran passe par `t` (#167).
/** Message de Mochi quand aucune erreur ne dépasse le seuil. */
export const AUCUNE_ERREUR = 'Aucune grosse erreur. Bien joué !';
/** Ligne discrète quand KataGo n'est pas disponible : pas de meilleur coup montré. Sans nom d'adversaire inconnu du débutant (#237). */
export const SANS_KATAGO = 'Pour voir le meilleur coup, affronte un adversaire plus fort.';

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
  if (joue < 0) constat = t('revue.passeTot');
  else if (perdues > 0) constat = t('revue.captureApres', { n: perdues, pts: pts(e.perte) });
  else constat = t('revue.perdu', { pts: pts(e.perte) });
  return meilleur != null && meilleur >= 0 ? t('revue.essaie', { constat, point: toLabel(meilleur, size) }) : constat;
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

/**
 * Notes possibles. `solide` : faible perte sans KataGo (on ne sait pas si c'était le meilleur coup).
 * Revue v3 (#405, docs/game-design/notation-go.md) : `classique` (coup d'ouverture connu), `force` (réponse obligée
 * à un atari), `manque` (faute de l'adversaire non punie). `grosse` s'affiche « Gaffe ».
 */
export type Note = 'brillant' | 'meilleur' | 'excellent' | 'bon' | 'classique' | 'solide' | 'force' | 'imprecision' | 'erreur' | 'manque' | 'grosse';

/** Ordre d'affichage, du meilleur au pire. */
export const NOTES: Note[] = ['brillant', 'meilleur', 'excellent', 'bon', 'classique', 'solide', 'force', 'imprecision', 'erreur', 'manque', 'grosse'];

/** Libellé et symbole de chaque note : le symbole double la couleur (accessibilité). Libellé dans la langue de l'interface (#167). */
const info = (note: Note, symbole: string) => ({ get libelle() { return t(`note.${note}`); }, symbole });
export const NOTE_INFO: Record<Note, { readonly libelle: string; symbole: string }> = {
  brillant: info('brillant', '!!'),
  meilleur: info('meilleur', '★'),
  excellent: info('excellent', '!'),
  bon: info('bon', '✓'),
  classique: info('classique', '≡'),
  solide: info('solide', '✓'),
  force: info('force', '→'),
  imprecision: info('imprecision', '?!'),
  erreur: info('erreur', '?'),
  manque: info('manque', '×'),
  grosse: info('grosse', '??'),
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

/**
 * Facteur de taille des seuils (#405) : racine de taille / 9. 9 × 9 : 1 ; 13 × 13 : 1,2 ; 19 × 19 : 1,45.
 * Un coup vaut plus de points sur un grand plateau, mais moins que proportionnellement au côté : la valeur d'un coup
 * d'ouverture passe d'environ 12 points (9 × 9) à environ 20 (19 × 19). Justification : docs/game-design/notation-go.md.
 */
export const facteurTaille = (size: number) => Math.sqrt(Math.max(9, size) / 9);
const fois = <T extends Record<string, number>>(o: T, f: number) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v * f])) as { [K in keyof T]: number };
/** Seuils KataGo pour un plateau de côté `size`. */
export const seuilsKataGo = (size: number) => fois(SEUILS_KATAGO, facteurTaille(size));
/** Seuils du moteur simple pour un plateau de côté `size`. */
export const seuilsSimple = (size: number) => fois(SEUILS_SIMPLE, facteurTaille(size));
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
    case 'brillant': return t('note.phrase.brillant');
    case 'meilleur': return t('note.phrase.meilleur');
    case 'excellent': return t('note.phrase.excellent');
    case 'bon': return t('note.phrase.bon', { pts: n.perte < 1 ? t('revue.unPoint') : pts(n.perte) });
    case 'classique': return t('note.phrase.classique');
    case 'solide': return t('note.phrase.solide');
    case 'force': return t('note.phrase.force');
    case 'manque': return t('note.phrase.manque', { pts: pts(n.perte) });
    case 'imprecision': return t('note.phrase.imprecision', { pts: pts(n.perte) });
    case 'erreur': return t('note.phrase.erreur', { pts: pts(n.perte) });
    case 'grosse': return t('note.phrase.grosse', { pts: pts(n.perte) });
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

/**
 * Estimation aberrante (#424) : le moteur simple s'écarte de plus d'un tiers du plateau (27 points en 9 × 9) de la
 * médiane des cinq positions qui l'entourent. Un pic d'une ou deux positions (−88,5 et −87,5 entre 0 et +18,6 dans la
 * partie de l'issue) disparaît ; une vraie bascule, qui dure (un groupe pris), garde la médiane de son côté.
 * KataGo n'est jamais écarté : ses écarts d'un coup à l'autre sont mesurés dans sa recherche.
 */
export function aberrante(positions: Position[], analyses: (AnalyseRevue | null)[], i: number): boolean {
  const a = analyses[i];
  if (!a || a.engine !== 'simple' || !positions[i]) return false;
  const voisines: number[] = [];
  for (let j = i - 2; j <= i + 2; j++) { const v = analyses[j]; if (v && v.engine === a.engine) voisines.push(v.lead); }
  if (voisines.length < 3) return false;
  voisines.sort((x, y) => x - y);
  const n = positions[i].size ** 2;
  return Math.abs(a.lead - voisines[Math.floor(voisines.length / 2)]) > n / 3;
}

/** Avances à montrer (courbe, pastille) : sans les estimations aberrantes, remplacées par `null` (#424). */
export function avancesAffichees(positions: Position[], analyses: (AnalyseRevue | null)[]): (number | null)[] {
  return analyses.map((a, i) => (a && !aberrante(positions, analyses, i) ? a.lead : null));
}

/**
 * Saut d'estimation plausible entre les positions `a` et `b` (#424) : aucune des deux n'est aberrante, et l'écart
 * tient dans un tiers du plateau (27 points en 9 × 9), plus deux points par pierre prise entre les deux (la pierre
 * quitte le plateau et compte comme prisonnier). Au-delà, c'est l'estimation qui a basculé, pas la partie : le moteur
 * simple donnait −88,5 puis +74,5 en 9 × 9.
 */
export function sautPlausible(positions: Position[], analyses: (AnalyseRevue | null)[], a: number, b: number): boolean {
  const x = analyses[a], y = analyses[b], pa = positions[a], pb = positions[b];
  if (!x || !y || !pa || !pb) return false;
  if (aberrante(positions, analyses, a) || aberrante(positions, analyses, b)) return false;
  const n = pa.size * pa.size;
  const prises = pb.captures[1] - pa.captures[1] + pb.captures[2] - pa.captures[2];
  return Math.abs(y.lead - x.lead) <= n / 3 + 2 * prises;
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
  const size = positions[0]?.size ?? 9, S = seuilsSimple(size), T = seuilsKataGo(size);
  for (let i = 1; i < positions.length; i++) {
    const avant = analyses[i - 1], apres = analyses[i];
    const couleur = positions[i - 1].toPlay, s = couleur === 1 ? 1 : -1, move = positions[i].lastMove ?? -1;
    // Deux moteurs différents ne se comparent pas : pas de note.
    if (!avant || !apres || avant.engine !== apres.engine) { out.push(null); continue; }
    const brute = s * (avant.lead - apres.lead);
    const finale = move < 0 && rienAPrendre(positions[i - 1]);

    if (avant.engine === 'simple') {
      const l0 = lisse[i - 1] ?? avant.lead;
      let b = brute, l1 = lisse[i] ?? apres.lead;
      // Une passe ne change pas le plateau : le moteur simple ne peut juger que le coup gratuit de l'adversaire qui
      // suit (issue #186). Si l'adversaire passe aussi, l'écart entre deux estimations du même plateau n'est que du bruit.
      const suite = analyses[i + 1];
      const repond = (positions[i + 1]?.lastMove ?? -1) >= 0 && !!suite && suite.engine === avant.engine;
      if (move < 0 && repond) {
        b = Math.max(b, s * (avant.lead - suite!.lead));
        l1 = s > 0 ? Math.min(l1, lisse[i + 1] ?? suite!.lead) : Math.max(l1, lisse[i + 1] ?? suite!.lead);
      }
      const lissee = s * (l0 - l1);
      // #424 : mesure douteuse, pas de note. Un saut d'estimation invraisemblable (rien de pris ne l'explique), ou
      // deux mesures (brute et lissée) qui se contredisent : l'une dit « Solide », l'autre dit « Imprécision ».
      if (!finale && !(move < 0 && !repond)) {
        const fin = move < 0 && repond ? i + 1 : i;
        if (!sautPlausible(positions, analyses, i - 1, fin) || (Math.min(b, lissee) <= S.solide && Math.max(b, lissee) > S.imprecision)) { out.push(null); continue; }
      }
      let perte = finale || (move < 0 && !repond) ? 0 : Math.max(0, Math.min(b, lissee));
      // #424 : le moteur simple ne voit souvent la faute qu'après la réponse de l'adversaire (J8, puis Noir prend
      // 8 pierres en E8). Chute nette après la réponse : si elle prend au moins 3 pierres, la perte est vérifiée sur le
      // plateau et compte ; sinon, la mesure d'un coup et celle de deux coups se contredisent, pas de « Solide ».
      if (move >= 0 && repond && sautPlausible(positions, analyses, i - 1, i + 1)) {
        const deux = Math.min(s * (avant.lead - suite!.lead), s * (l0 - (lisse[i + 1] ?? suite!.lead)));
        const adv = (3 - couleur) as Color, prises = positions[i + 1].captures[adv] - positions[i].captures[adv];
        if (deux > S.imprecision) {
          if (prises >= 3) perte = Math.max(perte, deux);
          else if (perte <= S.solide) { out.push(null); continue; }
        }
      }
      const note: Note = perte <= S.solide ? 'solide' : perte <= S.imprecision ? 'imprecision' : perte <= S.erreur ? 'erreur' : 'grosse';
      out.push({ coup: i, couleur, note, perte });
      continue;
    }

    const coups = avant.coups ?? [];
    const premier = coups[0], sur = !!premier && premier.visits >= VISITES_MIN;
    const k = coups.findIndex(c => c.move === move), cand = k >= 0 ? coups[k] : undefined;
    let perte = sur && cand && cand.visits >= VISITES_MIN ? Math.max(0, premier.lead - cand.lead) : Math.max(0, brute);
    if (finale) perte = 0;
    let note: Note = sur && k === 0 ? 'meilleur'
      : perte <= T.excellent ? 'excellent' : perte <= T.bon ? 'bon' : perte <= T.imprecision ? 'imprecision' : perte <= T.erreur ? 'erreur' : 'grosse';
    const conf = confirmations[i];
    if (conf != null && pisteBrillant(positions, analyses, i) && conf >= premier.lead + MARGE_BRILLANT) { note = 'brillant'; perte = 0; }
    out.push({ coup: i, couleur, note, perte });
  }
  return out;
}

/** Notes qui disent « pas de perte » (ou presque) : elles ne doivent jamais côtoyer une avance qui s'effondre. */
const SANS_PERTE: ReadonlySet<Note> = new Set(['brillant', 'meilleur', 'excellent', 'bon', 'classique', 'solide', 'force']);

/**
 * Accord des notes et de la pastille d'avance (#424). La pastille du parcours montre l'avance après le coup
 * (`analyses[coup].lead`) : si elle chute, pour le joueur qui vient de jouer, de plus que le seuil d'Imprécision par
 * rapport au coup d'avant, une note « Solide », « Bon » ou « Classique » la contredirait. Les deux mesures ne
 * s'accordent pas : on ne note pas ce coup (règle d'or, aucune note fausse). Les notes de perte ne changent pas.
 */
export function notesCoherentes<T extends NoteCoup>(notes: (T | null)[], analyses: (AnalyseRevue | null)[], size = 9): (T | null)[] {
  const S = seuilsSimple(size), K = seuilsKataGo(size);
  return notes.map(n => {
    if (!n || !SANS_PERTE.has(n.note)) return n;
    const a = analyses[n.coup - 1], b = analyses[n.coup];
    if (!a || !b) return n;
    const chute = (n.couleur === 1 ? 1 : -1) * (a.lead - b.lead);
    return chute > (b.engine === 'katago' ? K : S).imprecision ? null : n;
  });
}

/** Perte plafonnée pour la précision : une seule catastrophe ne doit pas écraser toute la partie. */
export const PERTE_MAX = 12;

/**
 * Précision d'un joueur, en % : 100 / (1 + m / 4), où m est sa perte moyenne par coup noté (plafonnée à 12 points
 * par coup). Perte moyenne 0 → 100 %, 1 point → 80 %, 2 → 67 %, 4 → 50 %, 8 → 33 %. `null` si aucun coup noté.
 */
export function precision(notes: (NoteCoup | null)[], couleur: Color, size = 9): number | null {
  // #405 : sur un grand plateau, les pertes sont ramenées au 9 × 9 (même facteur que les seuils des notes).
  const f = facteurTaille(size);
  const pertes = notes.filter((n): n is NoteCoup => !!n && n.couleur === couleur).map(n => Math.min(PERTE_MAX, n.perte / f));
  if (!pertes.length) return null;
  const m = pertes.reduce((a, b) => a + b, 0) / pertes.length;
  return Math.round(100 / (1 + m / 4));
}

// ---------- Revue honnête (issue #186) ----------
// Constat de l'analyse UX du 28/09 : « Précision 97 % » et « Aucune erreur » après une défaite de 20,5 points.
// Sans KataGo, le moteur simple ne voit que les pertes sûres, coup par coup : la somme des petites pertes et les
// passes qui offrent des coups gratuits lui échappent. Le score final, lui, ne ment pas : la précision affichée
// ne doit jamais le contredire. Règle expliquée dans docs/game-design/revue-honnete.md.

/**
 * Plafonds de précision après une défaite, en points ramenés au 9 × 9 (voir `defaiteRamenee`).
 * Défaite de moins de 3 points : partie serrée, pas de plafond. 3 à 10 : 80 % au plus. 10 à 20 : 65 %. 20 et plus : 50 %.
 * Une victoire n'est jamais plafonnée. Exemples de l'analyse : défaite de 20,5 → 50 % au plus (et non 97 %) ;
 * défaite de 61,5 → 50 % (et non 99 %) ; victoire de 1,5 → la précision calculée (91 %).
 */
export const DEFAITE_SERREE = 3;
export const PLAFONDS_DEFAITE: readonly { des: number; max: number }[] = [
  { des: 20, max: 50 },
  { des: 10, max: 65 },
  { des: DEFAITE_SERREE, max: 80 },
];

/** Avance finale de `couleur` (points, komi compris) à partir de l'avance de Noir. */
export function avanceDe(avanceNoir: number | null | undefined, couleur: Color): number | null {
  if (avanceNoir == null || !Number.isFinite(avanceNoir)) return null;
  return couleur === 1 ? avanceNoir : -avanceNoir;
}

/**
 * Défaite en points ramenée au 9 × 9 (0 pour une victoire ou un écart inconnu). Un grand plateau donne de plus
 * grands écarts : on divise par taille / 9 (13 × 13 : 1,44 ; 19 × 19 : 2,11). Perdre de 38 points en 19 × 19 vaut 18 en 9 × 9.
 */
export function defaiteRamenee(avance: number | null, size: number): number {
  if (avance == null || avance >= 0) return 0;
  return -avance / (Math.max(9, size) / 9);
}

/** Précision maximale compatible avec l'avance finale du joueur ; `null` : pas de plafond. */
export function plafondPrecision(avance: number | null, size: number): number | null {
  const d = defaiteRamenee(avance, size);
  for (const p of PLAFONDS_DEFAITE) if (d >= p.des) return p.max;
  return null;
}

/** Précision affichée : celle des notes, plafonnée par le score final (`avanceNoir` : avance finale de Noir, komi compris). */
export function precisionHonnete(notes: (NoteCoup | null)[], couleur: Color, avanceNoir: number | null | undefined, size: number): number | null {
  const p = precision(notes, couleur, size);
  if (p == null) return null;
  const max = plafondPrecision(avanceDe(avanceNoir, couleur), size);
  return max == null ? p : Math.min(p, max);
}

/** Vrai si la partie est une défaite nette pour `couleur` (au moins 3 points ramenés au 9 × 9). */
export function defaiteNette(avanceNoir: number | null | undefined, couleur: Color, size: number): boolean {
  return defaiteRamenee(avanceDe(avanceNoir, couleur), size) >= DEFAITE_SERREE;
}

/**
 * Avance finale de Noir : le résultat du SGF (`RE[B+20.5]`, `RE[W+3]`, `RE[0]`) s'il est chiffré, sinon l'estimation
 * du moteur sur la dernière position. Un abandon (`B+R`) garde l'estimation, mais jamais avec le mauvais signe.
 */
export function avanceFinale(resultat: string | undefined, estimation: number | null | undefined): number | null {
  const est = estimation != null && Number.isFinite(estimation) ? estimation : null;
  const r = (resultat ?? '').trim().toUpperCase();
  if (r === '0' || r === 'DRAW' || r === 'JIGO') return 0;
  const m = /^([BW])\+(.*)$/.exec(r);
  if (!m) return est;
  const s = m[1] === 'B' ? 1 : -1, v = Number(m[2].replace(',', '.'));
  if (m[2] !== '' && Number.isFinite(v)) return s * v;
  return est != null && Math.sign(est) === s ? est : null;
}

export interface MomentCle {
  /** Numéro du coup (1 = premier coup) : on rejoue depuis la position `coup - 1`. */
  coup: number;
  /** Points perdus entre la position avant ce coup et la réponse de l'adversaire. */
  perte: number;
  passe: boolean;
  /** Pierres prises par l'adversaire dans sa réponse. */
  prises: number;
  /** Camp qui a joué ce coup (#424 : sert à le noter quand la note de base manquait). */
  couleur?: Color;
}

/** Sous ces pertes, c'est du bruit : mêmes seuils que la note « Imprécision » de chaque moteur. */
export const SEUIL_CLE = { katago: SEUILS_KATAGO.imprecision, simple: SEUILS_SIMPLE.imprecision } as const;

/**
 * Moment clé de `joueur` (issue #186) : son coup, passes comprises, où il a perdu le plus de points.
 * Un coup se juge avec la réponse de l'adversaire : une passe ne change pas le plateau, c'est le coup gratuit
 * qui suit qui coûte (« tu as passé, Pomme a pris 6 pierres »). Perte : chute de l'avance du joueur entre la
 * position avant son coup et la position après la réponse ; on garde la plus petite des deux mesures (brute et
 * lissée) pour écarter le bruit. Ignorés : le premier coup (« Rejouer d'ici » y relancerait une partie vide) et
 * la passe de fin de partie quand il ne reste rien à prendre. `null` si aucune perte n'atteint le seuil.
 */
export function momentCle(positions: Position[], analyses: (AnalyseRevue | null)[], joueur: Color | null): MomentCle | null {
  const lisse = lisser(analyses);
  let best: MomentCle | null = null;
  for (let i = 2; i < positions.length; i++) {
    const avant = positions[i - 1], c = avant.toPlay;
    if (joueur && c !== joueur) continue;
    const a0 = analyses[i - 1], a1 = analyses[i];
    if (!a0 || !a1 || a0.engine !== a1.engine) continue;
    const passe = (positions[i].lastMove ?? -1) < 0;
    // Une passe ne coûte que par le coup gratuit qui suit : si l'adversaire passe aussi (fin de partie), le plateau
    // n'a pas bougé et tout écart d'estimation n'est que du bruit.
    if (passe && (rienAPrendre(positions[i - 1]) || !((positions[i + 1]?.lastMove ?? -1) >= 0))) continue;
    const a2 = analyses[i + 1];
    const bout = a2 && a2.engine === a0.engine && positions[i + 1] ? i + 1 : i;
    // #424 : un saut d'estimation invraisemblable n'est pas un moment clé.
    if (a0.engine === 'simple' && !sautPlausible(positions, analyses, i - 1, bout)) continue;
    const fin = analyses[bout]!, s = c === 1 ? 1 : -1, adv = (3 - c) as Color;
    const perte = Math.min(s * (a0.lead - fin.lead), s * ((lisse[i - 1] ?? a0.lead) - (lisse[bout] ?? fin.lead)));
    if (!(perte >= SEUIL_CLE[a0.engine] * facteurTaille(avant.size)) || (best && perte <= best.perte)) continue;
    best = { coup: i, perte, passe, prises: positions[bout].captures[adv] - positions[i].captures[adv], couleur: c };
  }
  return best;
}

/**
 * Notes accordées au moment clé (défaut relevé sur la fiche des stores, 28/09) : la note juge le coup seul, le moment clé
 * compte aussi la réponse de l'adversaire. Sans cet accord, la puce du coup clé portait « Solide » et la précision
 * affichait 100 % pendant que Mochi comptait des points perdus. Le coup clé prend la perte du moment clé (si elle est
 * plus forte) et la note qui va avec ; la précision et le résumé suivent. Les autres coups ne changent pas.
 */
export function notesAvecCle(notes: (NoteCoup | null)[], cle: MomentCle | null, analyses: (AnalyseRevue | null)[], size = 9): (NoteCoup | null)[] {
  const k = cle ? cle.coup - 1 : -1;
  // #424 : sans note de base (les mesures d'un coup et de deux coups se contredisaient), le moment clé la donne.
  const n: NoteCoup | null = notes[k] ?? (cle?.couleur && analyses[k] ? { coup: cle.coup, couleur: cle.couleur, note: 'solide', perte: 0 } : null);
  if (!cle || !n || n.perte >= cle.perte) return notes;
  const perte = cle.perte;
  let note: Note;
  if (analyses[k]?.engine === 'katago') {
    const T = seuilsKataGo(size);
    note = perte <= T.imprecision ? 'imprecision' : perte <= T.erreur ? 'erreur' : 'grosse';
  } else {
    const S = seuilsSimple(size);
    note = perte <= S.imprecision ? 'imprecision' : perte <= S.erreur ? 'erreur' : 'grosse';
  }
  const out = notes.slice();
  out[k] = { ...n, note, perte };
  return out;
}

/** Phrase de Mochi sur le moment clé, au tutoiement. `adversaire` : nom de l'ordi ; sans lui, partie à deux. */
export function phraseMomentCle(cle: MomentCle, positions: Position[], adversaire?: string): string {
  const avant = positions[cle.coup - 1], c = avant.toPlay, joue = positions[cle.coup].lastMove ?? -1;
  const lui = adversaire ?? t(c === 1 ? 'camp.blanc' : 'camp.noir');
  const qui = adversaire ? t('cle.quiToi') : t('cle.quiCamp', { camp: t(c === 1 ? 'camp.noir' : 'camp.blanc') });
  const prises = t('cle.prises', { n: cle.prises });
  const fin = adversaire ? ` ${t('cle.rejoue')}` : '';
  if (cle.passe && cle.prises > 0) return t('cle.passePrise', { qui, lui, prises, fin });
  if (cle.passe) return t('cle.passeTot', { qui, lui, pts: pts(cle.perte), fin });
  const lieu = toLabel(joue, avant.size);
  if (cle.prises > 0) return t('cle.jouePrise', { qui, lieu, lui, prises, pts: pts(cle.perte), fin });
  return t('cle.joue', { qui, lieu, pts: pts(cle.perte), fin });
}

/** Après une défaite nette sans erreur isolée notée : jamais « aucune erreur ». */
export const PERTES_DIFFUSES = 'Pas de grosse erreur isolée : les points se sont perdus petit à petit.';

/** Nombre de coups par note pour un joueur. */
export function compteNotes(notes: (NoteCoup | null)[], couleur: Color): Record<Note, number> {
  const c = Object.fromEntries(NOTES.map(n => [n, 0])) as Record<Note, number>;
  for (const n of notes) if (n && n.couleur === couleur) c[n.note]++;
  return c;
}

/** Contexte du bilan (issue #186) : avance finale de Noir (komi compris), taille du plateau, moment clé du joueur. */
export interface ContexteBilan {
  avanceNoir?: number | null; size?: number; cle?: MomentCle | null;
  /** Revue faite avec le moteur simple (#424) : il ne voit pas les coups qui manquent le point chaud, pas de « Très belle partie ». */
  sansKataGo?: boolean;
}

/** Écart final lisible : « 20,5 points ». */
// Accord de « point » : pluriel au-delà de 1 (« 1,5 points »), comme le texte d'origine ; en anglais, l'écart d'une défaite nette dépasse toujours 1.
const ecart = (v: number) => { const r = Math.round(Math.abs(v) * 2) / 2; return t('revue.ecart', { n: r > 1 ? 2 : 1, v: nombre(r) }); };
const citeCle = (cle: MomentCle) => t(cle.passe ? 'revue.citePasse' : 'revue.citeCoup', { coup: cle.coup, pts: pts(cle.perte) });

/**
 * Phrase de Mochi qui résume la partie, au tutoiement. `adversaire` : nom de l'ordi (sinon Blanc).
 * Elle cite la plus grosse erreur du joueur s'il y en a une, sinon elle félicite. Après une défaite nette
 * (issue #186), jamais de félicitations ni d'« aucune erreur » : elle dit l'écart et renvoie au moment clé.
 */
export function phraseBilan(notes: (NoteCoup | null)[], joueur: Color, adversaire?: string, ctx: ContexteBilan = {}): string {
  const size = ctx.size ?? 9;
  const moi = precisionHonnete(notes, joueur, ctx.avanceNoir, size), lui = precisionHonnete(notes, (3 - joueur) as Color, ctx.avanceNoir, size);
  if (moi == null) return t('revue.bilan.pasAssez');
  const miens = notes.filter((n): n is NoteCoup => !!n && n.couleur === joueur);
  const pire = miens.filter(n => n.note === 'erreur' || n.note === 'manque' || n.note === 'grosse').sort((a, b) => b.perte - a.perte || a.coup - b.coup)[0];
  const brillant = miens.some(n => n.note === 'brillant') ? `${t('revue.bilan.brillant')} ` : '';
  const cle = ctx.cle ?? null;
  const revoirPire = (p: NoteCoup) => t('revue.bilan.vaRevoir', { cite: t('revue.citeCoup', { coup: p.coup, pts: pts(p.perte) }) });
  if (defaiteNette(ctx.avanceNoir, joueur, size)) {
    const debut = `${brillant}${t('revue.bilan.tuPerds', { ecart: ecart(ctx.avanceNoir!) })} `;
    if (cle && (!pire || cle.perte >= pire.perte)) return `${debut}${t('revue.bilan.rejoueLe', { cite: citeCle(cle) })}`;
    if (pire) return `${debut}${revoirPire(pire)}`;
    return `${debut}${t('revue.pertesDiffuses')}`;
  }
  const debut = brillant || `${moi >= 85 && !ctx.sansKataGo ? t('revue.bilan.tresBelle')
    : lui != null && moi > lui ? t('revue.bilan.plusJuste', { nom: adversaire ?? t('camp.blanc') })
    : moi >= 60 ? t('revue.bilan.correcte') : t('revue.bilan.difficile')} `;
  if (pire) return `${debut}${revoirPire(pire)}`;
  if (cle) return `${debut}${t('revue.bilan.vaRevoir', { cite: citeCle(cle) })}`;
  return `${debut}${t('revue.bilan.aucuneErreur')}`;
}
