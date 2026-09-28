// Démonstrations des leçons (issue #101) : l'image montre, temps par temps, avant que le texte n'explique.
// Logique pure : d'une position de départ et d'une liste de temps, on tire la suite des images à afficher.
import { fromRows } from '../go/position';
import { groupAt, play, type Position } from '../go/rules';
import { fromLabel } from '../go/coords';
import { score } from '../go/score';

/**
 * Un temps de démonstration (environ 600 ms chacun).
 * - `pose` : une pierre se pose (B noir, W blanc), avec l'animation de capture si elle prend ;
 * - `libs` : les libertés du groupe s'allument une à une avec un compteur ; ensuite ce groupe est suivi
 *   (le compteur baisse quand une liberté est bouchée, l'atari clignote à une liberté) ;
 * - `yeux` : des yeux se marquent en jade ;
 * - `interdit` : un coup illégal (suicide, ko) est barré.
 */
export type DemoTemps =
  | { pose: string; couleur: 'B' | 'W' }
  | { libs: string }
  | { yeux: string[] }
  | { interdit: string; couleur: 'B' | 'W' }
  /** Plusieurs groupes en atari à la fois (double atari) : ils clignotent sur cette image. */
  | { atari: string[] }
  | { terr: 'B' | 'W' };

/** Délai entre deux cases de territoire qui se colorent (ms). */
export const CASE_MS = 70;

export interface DemoImage {
  board: Int8Array;
  /** Libertés allumées. */
  libs: number[];
  /** Compteur de libertés posé sur la pierre `p`. */
  compteur?: { p: number; n: number };
  /** Pierres en atari : elles clignotent. */
  atari: number[];
  yeux: number[];
  interdit?: number;
  derniere?: number;
  /** Territoire compté par le moteur (règle japonaise), dans l'ordre où il se colore : colonne par colonne. */
  terr?: { couleur: 1 | 2; points: number[] };
}

const N = 9;
const at = (l: string) => fromLabel(l, N);
const couleur = (c: 'B' | 'W') => (c === 'B' ? 1 : 2) as 1 | 2;

/**
 * Geste de l'élève dans une démonstration (#198) : l'image attend qu'il agisse, puis la suite se joue.
 * - `pose` : l'élève pose lui-même la pierre de ce temps de la démonstration (toujours une pierre noire) ;
 * - `touche` : l'élève touche l'un de ces points (une pierre, un œil…) avant que la démonstration commence ; `no` l'aide s'il se trompe.
 */
export type Geste = { pose: string } | { touche: string[]; no: string };

/** Suite des images d'une démonstration. L'image 0 est la position de départ. Lève une erreur sur un coup illégal. */
export function imagesDemo(rows: string[], demo: DemoTemps[], avant: DemoTemps[] = []): DemoImage[] {
  return suiteDemo(rows, demo, avant).images;
}

/**
 * Image où la démonstration attend le geste de l'élève (#198) : celle d'avant le temps `pose`, ou la première pour `touche`.
 * Lève une erreur si la pierre à poser n'est pas un temps noir de la démonstration.
 */
export function imageDuGeste(rows: string[], demo: DemoTemps[], avant: DemoTemps[] = [], geste: Geste): number {
  if ('touche' in geste) return 0;
  const k = demo.findIndex(t => 'pose' in t && t.pose === geste.pose);
  const t = demo[k];
  if (k < 0 || !('pose' in t) || t.couleur !== 'B') throw new Error(`${geste.pose} : pas une pierre noire de la démonstration`);
  return suiteDemo(rows, demo, avant).debuts[k];
}

function suiteDemo(rows: string[], demo: DemoTemps[], avant: DemoTemps[]): { images: DemoImage[]; debuts: number[] } {
  let pos: Position = fromRows(rows).pos;
  let suivi = -1, derniere: number | undefined;
  let yeux: number[] = [];
  const photo = (extra: Partial<DemoImage> = {}): DemoImage => {
    const g = suivi >= 0 && pos.board[suivi] ? groupAt(pos.board, N, suivi) : null;
    const libs = g ? [...g.liberties].sort((a, b) => a - b) : [];
    return {
      board: pos.board.slice(), libs, yeux, derniere,
      compteur: g ? { p: suivi, n: libs.length } : undefined,
      atari: g && libs.length === 1 ? g.stones : [],
      ...extra
    };
  };
  const images: DemoImage[] = [photo()];
  // `avant` : la suite d'une démonstration précédente, rejouée sans image (le ko garde ainsi son point interdit).
  let debut = 0;
  const debuts: number[] = [];
  for (const [i, t] of [...avant, ...demo].entries()) {
    if (i === avant.length) debut = images.length - 1;
    if (i >= avant.length) debuts.push(images.length - 1);
    if ('pose' in t) {
      const p = at(t.pose);
      const r = play({ ...pos, toPlay: couleur(t.couleur) }, p);
      if (typeof r === 'string') throw new Error(`${t.pose} : ${r}`);
      pos = r; derniere = p;
      images.push(photo());
    } else if ('libs' in t) {
      const p = at(t.libs);
      if (!pos.board[p]) throw new Error(`${t.libs} : pas de pierre`);
      const l = [...groupAt(pos.board, N, p).liberties].sort((a, b) => a - b);
      // Une à une, avec le compteur qui suit ; la dernière image suit le groupe.
      for (let i = 1; i < l.length; i++) images.push(photo({ libs: l.slice(0, i), compteur: { p, n: i }, atari: [] }));
      suivi = p;
      images.push(photo());
    } else if ('yeux' in t) {
      yeux = [...yeux, ...t.yeux.map(at)];
      images.push(photo());
    } else if ('atari' in t) {
      const pierres = t.atari.flatMap(l => {
        const g = groupAt(pos.board, N, at(l));
        if (!pos.board[at(l)] || g.liberties.size !== 1) throw new Error(`${l} : pas en atari`);
        return g.stones;
      });
      images.push(photo({ atari: pierres }));
    } else if ('terr' in t) {
      const c = couleur(t.terr), owner = score(pos, 0, 'japanese').owner;
      const points = [...owner.keys()].filter(p => owner[p] === c && !pos.board[p]).sort((a, b) => (a % N) - (b % N) || a - b);
      images.push(photo({ terr: { couleur: c, points } }));
    } else {
      const p = at(t.interdit);
      if (typeof play({ ...pos, toPlay: couleur(t.couleur) }, p) !== 'string') throw new Error(`${t.interdit} : coup légal`);
      images.push(photo({ interdit: p }));
    }
  }
  const d = avant.length ? debut : 0;
  return { images: images.slice(d), debuts: debuts.map(x => x - d) };
}

/** Rythme : un temps toutes les 600 ms. */
export const TEMPS_MS = 600;

/** Mots d'un texte d'étape, hors vocabulaire entre parenthèses et ponctuation seule. */
export function mots(texte: string): number {
  return texte.replace(/\([^)]*\)/g, ' ').split(/\s+/).filter(m => /[\p{L}\p{N}]/u.test(m)).length;
}
