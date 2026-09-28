// Conseil de Mochi (#80), première étape : une seule phrase de stratégie et la zone qu'elle concerne,
// calculées sur l'appareil, sans modèle de langage. Module pur : il ne lance ni KataGo ni Worker.
//
// Modèles, du plus sûr au moins sûr (priorité fixe, le premier qui s'applique gagne) :
// 1. atari-joueur    : un groupe du joueur au trait n'a plus qu'une liberté et peut encore être sauvé ;
// 2. atari-adverse   : le joueur peut capturer tout de suite des pierres adverses (coup légal, ko compris) ;
// 3. peu-de-libertes : un groupe du joueur a deux libertés, l'adversaire pourrait le prendre, et une défense existe ;
// 4. coin-libre      : début de partie et un coin entièrement vide ;
// 5. zone-a-prendre  : avec la propriété KataGo, la plus grande zone vide encore neutre.
// Les modèles 1 à 4 se calculent avec `src/go` seul. Sans modèle applicable : `null` (aucune phrase plutôt qu'une fausse).
import { toLabel } from '../go/coords';
import { groupAt, neighbors, play, playSuperko, type Color, type Position } from '../go/rules';
import { canEscape, captureWorks, defenceFails } from '../go/tactics';
import { langue as langueCourante, traduire, type Langue } from '../content/i18n';

export type ModeleConseil = 'atari-joueur' | 'atari-adverse' | 'peu-de-libertes' | 'coin-libre' | 'zone-a-prendre';

/** Ordre de priorité des modèles (le premier applicable est choisi). */
export const MODELES: readonly ModeleConseil[] = ['atari-joueur', 'atari-adverse', 'peu-de-libertes', 'coin-libre', 'zone-a-prendre'];

export interface ConseilMochi {
  modele: ModeleConseil;
  /** Point nommé dans la phrase (index y * N + x), `null` si la phrase n'en nomme pas. */
  point: number | null;
  /** Nombre de pierres concernées (accord de « ses pierres » / « sa pierre »). */
  pierres: number;
  /** Points à entourer sur le plateau, triés. */
  zone: number[];
}

export interface OptionsConseil {
  /** Propriété KataGo, de -1 (Blanc) à +1 (Noir), une valeur par intersection. */
  propriete?: ArrayLike<number> | null;
  /** Dispositions déjà vues (`boardKey`), si la partie joue au superko. */
  dejaVues?: ReadonlySet<string>;
}

/** Profondeur de lecture des captures (coups) : assez pour les filets et les échelles courtes, rapide en 19 × 19. */
const PROFONDEUR = 8;
/** Seuil de neutralité de la propriété : |valeur| en dessous, le point n'appartient encore à personne. */
export const SEUIL_NEUTRE = 0.3;
/** Taille minimale d'une zone neutre pour mériter une phrase. */
export const ZONE_MIN = 4;

interface Chaine { stones: number[]; liberties: Set<number> }

function chaines(pos: Position, couleur: Color): Chaine[] {
  const vu = new Uint8Array(pos.board.length), res: Chaine[] = [];
  for (let p = 0; p < pos.board.length; p++) {
    if (pos.board[p] !== couleur || vu[p]) continue;
    const g = groupAt(pos.board, pos.size, p);
    for (const s of g.stones) vu[s] = 1;
    g.stones.sort((a, b) => a - b);
    res.push(g);
  }
  // Le plus gros groupe d'abord ; à taille égale, le plus haut à gauche.
  return res.sort((a, b) => b.stones.length - a.stones.length || a.stones[0] - b.stones[0]);
}

const trie = (xs: Iterable<number>) => [...new Set(xs)].sort((a, b) => a - b);

/** Pierre qui nomme le groupe : la première (ordre de lecture) qui touche une de ses libertés. */
function pierreRepere(pos: Position, g: Chaine): number {
  const nb = neighbors(pos.size);
  return g.stones.find(s => nb[s].some(r => g.liberties.has(r))) ?? g.stones[0];
}

function atariJoueur(pos: Position, moi: Color): ConseilMochi | null {
  for (const g of chaines(pos, moi)) {
    if (g.liberties.size !== 1) continue;
    const t = g.stones[0];
    // « Sauve-le » n'est vrai que s'il existe un sauvetage : s'allonger ou capturer, sans être pris en échelle.
    if (!canEscape(pos, t)) continue;
    return { modele: 'atari-joueur', point: pierreRepere(pos, g), pierres: g.stones.length, zone: trie([...g.stones, ...g.liberties]) };
  }
  return null;
}

function atariAdverse(pos: Position, moi: Color, dejaVues?: ReadonlySet<string>): ConseilMochi | null {
  for (const g of chaines(pos, (3 - moi) as Color)) {
    if (g.liberties.size !== 1) continue;
    const m = [...g.liberties][0];
    const r = dejaVues ? playSuperko(pos, m, dejaVues) : play(pos, m);
    if (typeof r === 'string' || r.board[g.stones[0]] !== 0) continue; // ko, suicide ou superko : pas de prise possible
    return { modele: 'atari-adverse', point: m, pierres: g.stones.length, zone: trie([...g.stones, m]) };
  }
  return null;
}

function peuDeLibertes(pos: Position, moi: Color): ConseilMochi | null {
  const tourAdverse: Position = { ...pos, toPlay: (3 - moi) as Color, ko: -1 };
  for (const g of chaines(pos, moi)) {
    if (g.liberties.size !== 2) continue;
    const t = g.stones[0];
    // Menacé : si l'adversaire jouait maintenant, il prendrait le groupe.
    if (!captureWorks(tourAdverse, t, PROFONDEUR)) continue;
    // Et une défense existe : sinon « donne-lui de l'air » serait un conseil vain.
    if (defenceFails(pos, t, PROFONDEUR)) continue;
    return { modele: 'peu-de-libertes', point: pierreRepere(pos, g), pierres: g.stones.length, zone: trie([...g.stones, ...g.liberties]) };
  }
  return null;
}

/** Côté du carré d'un coin, et nombre maximal de pierres pour parler encore de début de partie. */
export function reglesCoin(size: number): { cote: number; maxPierres: number } | null {
  if (size < 9) return null;
  if (size < 13) return { cote: 4, maxPierres: 6 };
  if (size < 19) return { cote: 5, maxPierres: 10 };
  return { cote: 6, maxPierres: 16 };
}

function coinLibre(pos: Position): ConseilMochi | null {
  const r = reglesCoin(pos.size);
  if (!r) return null;
  const n = pos.size, pierres = pos.board.reduce((s, v) => s + (v ? 1 : 0), 0);
  if (pierres > r.maxPierres) return null;
  // Ordre habituel : en haut à droite, en bas à gauche, en bas à droite, en haut à gauche.
  const coins: [boolean, boolean][] = [[true, false], [false, true], [true, true], [false, false]];
  for (const [droite, bas] of coins) {
    const xs = Array.from({ length: r.cote }, (_, i) => (droite ? n - 1 - i : i));
    const ys = Array.from({ length: r.cote }, (_, i) => (bas ? n - 1 - i : i));
    if (!ys.every(y => xs.every(x => pos.board[y * n + x] === 0))) continue;
    // Zone : les quatre points 3-3, 3-4, 4-3 et 4-4 du coin, là où l'on joue d'habitude.
    const zone = [2, 3].flatMap(i => [2, 3].map(j => ys[i] * n + xs[j]));
    return { modele: 'coin-libre', point: null, pierres: 0, zone: trie(zone) };
  }
  return null;
}

function zoneAPrendre(pos: Position, propriete: ArrayLike<number>): ConseilMochi | null {
  const n = pos.size, nb = neighbors(n);
  if (propriete.length !== n * n) return null;
  const neutre = (p: number) => pos.board[p] === 0 && Math.abs(propriete[p]) < SEUIL_NEUTRE;
  const vu = new Uint8Array(n * n);
  let meilleure: number[] = [];
  for (let p = 0; p < n * n; p++) {
    if (vu[p] || !neutre(p)) continue;
    const comp: number[] = [], pile = [p];
    vu[p] = 1;
    while (pile.length) {
      const q = pile.pop()!;
      comp.push(q);
      for (const r of nb[q]) if (!vu[r] && neutre(r)) { vu[r] = 1; pile.push(r); }
    }
    if (comp.length > meilleure.length) meilleure = comp;
  }
  if (meilleure.length < ZONE_MIN) return null;
  // Point nommé : celui de la zone le plus proche de son centre.
  const cx = meilleure.reduce((s, p) => s + (p % n), 0) / meilleure.length;
  const cy = meilleure.reduce((s, p) => s + Math.floor(p / n), 0) / meilleure.length;
  const d = (p: number) => (p % n - cx) ** 2 + (Math.floor(p / n) - cy) ** 2;
  const zone = trie(meilleure);
  const point = zone.reduce((a, b) => (d(b) < d(a) ? b : a));
  return { modele: 'zone-a-prendre', point, pierres: 0, zone };
}

/** Conseil pour le joueur au trait, ou `null` si aucun modèle ne s'applique sans risque d'erreur. */
export function conseil(pos: Position, options: OptionsConseil = {}): ConseilMochi | null {
  const moi = pos.toPlay;
  return atariJoueur(pos, moi)
    ?? atariAdverse(pos, moi, options.dejaVues)
    ?? peuDeLibertes(pos, moi)
    ?? coinLibre(pos)
    ?? (options.propriete ? zoneAPrendre(pos, options.propriete) : null);
}

/** Phrase du conseil, dans la langue demandée (par défaut celle de l'interface). */
export function phraseConseil(c: ConseilMochi, size: number, l: Langue = langueCourante()): string {
  const point = c.point === null ? '' : toLabel(c.point, size);
  switch (c.modele) {
    case 'atari-joueur': return traduire(l, 'conseil.atariJoueur', { point });
    case 'atari-adverse': return traduire(l, 'conseil.atariAdverse', { point, n: c.pierres });
    case 'peu-de-libertes': return traduire(l, 'conseil.peuDeLibertes', { point });
    case 'coin-libre': return traduire(l, 'conseil.coinLibre');
    case 'zone-a-prendre': return traduire(l, 'conseil.zoneAPrendre', { point });
  }
}
