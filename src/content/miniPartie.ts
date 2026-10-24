// « Ta première partie » (#715) : la mini-partie qui suit les règles. 5 × 5, contre Pomme, « le premier qui capture 3
// pierres gagne » (la variante d'initiation la plus courante) : le go qu'on vient d'apprendre se joue tout de suite, et
// on gagne. La victoire est facile et honnête, jamais truquée :
// - Pomme a laissé des pierres en atari au départ (Mochi le dit) ;
// - Pomme joue au hasard et prend une pierre quand elle en voit une à prendre (elle ne lit pas les ataris) ;
// - l'aide de Mochi montre un coup, annoncée comme telle (« coup de pouce »).
// Preuve (src/content/miniPartie.test.ts) : en suivant l'aide, Noir gagne contre TOUTES les réponses possibles de Pomme
// (parcours exhaustif, passe comprise), sur chacun des départs.
//
// Logique pure, sans écran : l'écran est src/app/MiniPartie.tsx, chargé avec l'introduction (rien dans le JS initial).
import { fromRows } from '../go/position';
import { groupAt, neighbors, play, type Position } from '../go/rules';

/** Taille du plateau de la mini-partie. */
export const MINI_TAILLE = 5;
/** Nombre de pierres à capturer pour gagner (pour Noir comme pour Pomme). Indicateur visé : `mini_partie_finie` gagnée. */
export const MINI_CAPTURES = 3;
/** Coups de Noir sans capture après lesquels l'aide se montre d'elle-même (le lien « Un coup de pouce » est toujours là). */
export const MINI_AIDE_APRES = 2;
/** Pause avant la réponse de Pomme (ms) : assez pour voir son coup arriver, jamais une attente sans retour. */
export const MINI_POMME_MS = 650;

/**
 * Les départs (X noir, O blanc ; de haut en bas, A à E). Chaque pierre blanche de coin n'a plus qu'une liberté et ne peut
 * pas en gagner : ses voisines noires la ferment (A4 et B4 pour A5) ; si Pomme la prolonge, le groupe n'a toujours qu'une
 * liberté et se prend à deux pierres. Quatre coins : 4 captures possibles ; trois coins : 3, juste ce qu'il faut.
 */
export const MINI_DEPARTS: Record<'quatreCoins' | 'troisCoins', string[]> = {
  quatreCoins: ['O...O', 'XX.XX', '.....', 'XX.XX', 'O...O'],
  troisCoins: ['O...O', 'XX.XX', '.....', 'XX...', 'O....'],
};
export const MINI_ORDRE = ['quatreCoins', 'troisCoins'] as const;

/** Départ de la `rang`-ième mini-partie (0 : la première) : les deux départs alternent. */
export function departMini(rang: number): Position {
  return fromRows(MINI_DEPARTS[MINI_ORDRE[Math.abs(Math.floor(rang)) % MINI_ORDRE.length]]).pos;
}

/** Points où la couleur qui joue peut poser une pierre. */
export function coupsLegaux(pos: Position): number[] {
  const r: number[] = [];
  for (let p = 0; p < pos.board.length; p++) if (pos.board[p] === 0 && typeof play(pos, p) !== 'string') r.push(p);
  return r;
}

const jouer = (pos: Position, p: number): Position => play(pos, p) as Position;

/**
 * Le coup de Pomme (`-1` : elle passe, seulement s'il ne lui reste aucun coup). Elle joue au hasard parmi les coups
 * permis, sauf qu'elle prend une pierre quand elle peut : c'est tout. Elle ne lit ni les ataris ni les menaces.
 */
export function pommeJoue(pos: Position, rng: () => number = Math.random): number {
  const legaux = coupsLegaux(pos);
  if (!legaux.length) return -1;
  const prises = legaux.filter(p => jouer(pos, p).captures[pos.toPlay] > pos.captures[pos.toPlay]);
  const liste = prises.length ? prises : legaux;
  return liste[Math.min(liste.length - 1, Math.floor(rng() * liste.length))];
}

/** Ce que l'aide montre : prendre, mettre en atari, sauver une pierre en atari, ou (rarement) un coup voisin. */
export type TypeAide = 'capture' | 'atari' | 'sauve' | 'autre';

/**
 * L'aide de Mochi pour Noir, dans l'ordre : prendre le plus de pierres possible (à égalité, la pierre que Pomme défend) ; sauver un groupe en atari en le
 * prolongeant (s'il y gagne au moins deux libertés) ; mettre un groupe blanc en atari sans se mettre soi-même en
 * danger ; sinon un coup collé aux pierres blanches. Toujours un coup permis. `null` : plus aucun coup.
 */
export function aideMini(pos: Position): { p: number; type: TypeAide } | null {
  const legaux = coupsLegaux(pos), c = pos.toPlay, adv = 3 - c;
  if (!legaux.length) return null;
  const n = neighbors(pos.size);
  // Prendre le plus de pierres ; à égalité, la prise voisine d'une autre pierre blanche (celle que Pomme défend), puis la première.
  const defendue = (p: number) => n[p].filter(q => pos.board[q] === adv).length;
  let meilleur = -1, gain = 0, voisines = -1;
  for (const p of legaux) {
    const g = jouer(pos, p).captures[c] - pos.captures[c];
    if (g > 0 && (g > gain || (g === gain && defendue(p) > voisines))) { gain = g; meilleur = p; voisines = defendue(p); }
  }
  if (meilleur >= 0) return { p: meilleur, type: 'capture' };
  for (let s = 0; s < pos.board.length; s++) {
    if (pos.board[s] !== c) continue;
    const g = groupAt(pos.board, pos.size, s);
    if (g.liberties.size !== 1) continue;
    const [l] = [...g.liberties];
    if (legaux.includes(l) && groupAt(jouer(pos, l).board, pos.size, l).liberties.size >= 2) return { p: l, type: 'sauve' };
  }
  for (const p of legaux) {
    const r = jouer(pos, p);
    if (groupAt(r.board, pos.size, p).liberties.size < 2) continue;
    if (n[p].some(q => r.board[q] === adv && groupAt(r.board, pos.size, q).liberties.size === 1)) return { p, type: 'atari' };
  }
  return { p: legaux.find(p => n[p].some(q => pos.board[q] === adv)) ?? legaux[0], type: 'autre' };
}
