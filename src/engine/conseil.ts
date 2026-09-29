// Conseil de Mochi (#80) : une seule phrase de stratégie et la zone qu'elle concerne, calculées sur l'appareil,
// sans modèle de langage. Module pur : il ne lance ni KataGo ni Worker (l'écran lui passe l'analyse, voir
// `analyseConseil` dans src/engine/index.ts).
//
// Modèles, du plus sûr au moins sûr (priorité fixe, le premier qui s'applique gagne) :
// 1. atari-joueur    : un groupe du joueur au trait n'a plus qu'une liberté et peut encore être sauvé ;
// 2. atari-adverse   : le joueur peut capturer tout de suite des pierres adverses (coup légal, ko compris) ;
// 3. peu-de-libertes : un groupe du joueur a deux libertés, l'adversaire pourrait le prendre, et une défense existe ;
// 4. un-seul-oeil    : un groupe du joueur n'entoure qu'un seul œil (un ou deux points vides, pas un faux œil),
//                      et il n'est pas déjà sauf (propriété KataGo, ou peu de libertés dehors sans elle) ;
// 5. zone-a-defendre : avec KataGo, une zone au joueur qui passerait à l'adversaire s'il jouait maintenant,
//                      et le meilleur coup de KataGo est dans cette zone ou tout près ;
// 6. coup-a-eviter   : jouer sur une liberté d'un groupe à deux libertés le mettrait en atari (auto-atari),
//                      l'adversaire prendrait au moins deux pierres, sans prise en retour ; jamais un coup de KataGo ;
// 7. grand-coup      : avec KataGo, son meilleur coup est dans un coin ou sur un bord encore vide ;
// 8. coin-libre      : début de partie et un coin entièrement vide ;
// 9. zone-a-prendre  : avec la propriété KataGo, la plus grande zone vide encore neutre.
// Les modèles 1 à 4, 6 et 8 se calculent avec `src/go` seul. Sans modèle applicable : `null` (aucune phrase plutôt qu'une fausse).
import { toLabel } from '../go/coords';
import { groupAt, neighbors, play, playSuperko, type Color, type Position } from '../go/rules';
import { canEscape, captureWorks, defenceFails, hasTwoEyes } from '../go/tactics';
import { langue as langueCourante, traduire, type Langue } from '../content/i18n';

export type ModeleConseil = 'atari-joueur' | 'atari-adverse' | 'peu-de-libertes' | 'un-seul-oeil' | 'zone-a-defendre' | 'coup-a-eviter'
  | 'grand-coup' | 'coin-libre' | 'zone-a-prendre';

/** Ordre de priorité des modèles (le premier applicable est choisi). */
export const MODELES: readonly ModeleConseil[] = ['atari-joueur', 'atari-adverse', 'peu-de-libertes', 'un-seul-oeil', 'zone-a-defendre',
  'coup-a-eviter', 'grand-coup', 'coin-libre', 'zone-a-prendre'];

export interface ConseilMochi {
  modele: ModeleConseil;
  /** Point nommé dans la phrase (index y * N + x), `null` si la phrase n'en nomme pas. */
  point: number | null;
  /** Nombre de pierres concernées (accord de « ses pierres » / « sa pierre »). */
  pierres: number;
  /** Points à entourer sur le plateau, triés. */
  zone: number[];
  /** Grand coup : coin ou bord où se trouve le meilleur coup de KataGo (le point n'est pas nommé : l'indice reste l'indice). */
  cote?: Cote;
}

/** Coin (deux lettres) ou bord (une lettre) : h(aut), b(as), g(auche), d(roite). */
export type Cote = 'hd' | 'hg' | 'bd' | 'bg' | 'h' | 'b' | 'g' | 'd';

export interface OptionsConseil {
  /** Propriété KataGo, de -1 (Blanc) à +1 (Noir), une valeur par intersection. */
  propriete?: ArrayLike<number> | null;
  /** Dispositions déjà vues (`boardKey`), si la partie joue au superko. */
  dejaVues?: ReadonlySet<string>;
  /** Candidats de KataGo pour le joueur au trait, du meilleur au moins bon (-1 : passer). */
  coups?: readonly number[];
  /** Propriété si l'adversaire jouait maintenant (analyse KataGo, adversaire au trait) : la zone qui basculerait. */
  proprieteSiTuPasses?: ArrayLike<number> | null;
  /** Meilleur coup de l'adversaire s'il jouait maintenant (même analyse). */
  menace?: number;
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

// ---------- Un seul œil ----------

/** Seuils de propriété (du point de vue du joueur) : au-dessus de SUR, KataGo tient le groupe pour vivant ; sous PERDU, pour mort. */
export const OEIL_SUR = 0.6, OEIL_PERDU = -0.5;
/** Sans propriété : au-delà de ce nombre de libertés dehors, le groupe n'est pas dit en danger. */
export const OEIL_LIBERTES_MAX = 4;

interface RegionVide { points: number[]; bords: Set<number>; chaines: Set<number> }

/** Régions vides : leurs points, les couleurs qui les bordent et une pierre repère de chaque chaîne bordante. */
function regionsVides(pos: Position): RegionVide[] {
  const n = pos.size, nb = neighbors(n), vu = new Uint8Array(n * n), res: RegionVide[] = [];
  const repere = new Int32Array(n * n).fill(-1);
  for (let p = 0; p < n * n; p++) {
    if (pos.board[p] === 0 || repere[p] >= 0) continue;
    for (const s of groupAt(pos.board, n, p).stones) repere[s] = p;
  }
  for (let p = 0; p < n * n; p++) {
    if (pos.board[p] !== 0 || vu[p]) continue;
    const r: RegionVide = { points: [], bords: new Set(), chaines: new Set() }, pile = [p];
    vu[p] = 1;
    while (pile.length) {
      const q = pile.pop()!;
      r.points.push(q);
      for (const v of nb[q]) {
        if (pos.board[v] === 0) { if (!vu[v]) { vu[v] = 1; pile.push(v); } }
        else { r.bords.add(pos.board[v]); r.chaines.add(repere[v]); }
      }
    }
    res.push(r);
  }
  return res;
}

/** Vrai œil (pas un faux œil) : sur le bord, aucune diagonale adverse ; au centre, au plus une. */
function vraiOeil(pos: Position, region: number[], moi: Color): boolean {
  const n = pos.size, dans = new Set(region);
  for (const p of region) {
    const x = p % n, y = Math.floor(p / n);
    let adverses = 0, dehors = 0;
    for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const a = x + dx, b = y + dy;
      if (a < 0 || b < 0 || a >= n || b >= n) { dehors++; continue; }
      const q = b * n + a;
      if (!dans.has(q) && pos.board[q] === 3 - moi) adverses++;
    }
    if (dehors > 0 ? adverses > 0 : adverses > 1) return false;
  }
  return true;
}

function unSeulOeil(pos: Position, moi: Color, propriete?: ArrayLike<number> | null): ConseilMochi | null {
  const n = pos.size, regions = regionsVides(pos);
  // Chaînes du joueur réunies par leurs régions fermées (bordées par lui seul) : un « groupe » au sens du joueur.
  const parent = new Map<number, number>();
  const racine = (a: number): number => { let r = a; while (parent.get(r)! !== r) r = parent.get(r)!; return r; };
  const fermees = regions.filter(r => r.bords.size === 1 && r.bords.has(moi));
  for (const r of fermees) {
    const cs = [...r.chaines];
    for (const c of cs) if (!parent.has(c)) parent.set(c, c);
    for (const c of cs.slice(1)) { const a = racine(c), b = racine(cs[0]); if (a !== b) parent.set(a, b); }
  }
  const yeux = new Map<number, RegionVide[]>();
  for (const r of fermees) { const k = racine([...r.chaines][0]); yeux.set(k, [...(yeux.get(k) ?? []), r]); }
  const signe = moi === 1 ? 1 : -1;
  const candidats: { pierres: number[]; oeil: number[] }[] = [];
  for (const [k, rs] of yeux) {
    if (rs.length !== 1) continue;
    const oeil = rs[0].points;
    if (oeil.length > 2 || !vraiOeil(pos, oeil, moi)) continue;
    const pierres: number[] = [], libres = new Set<number>();
    for (const c of parent.keys()) {
      if (racine(c) !== k) continue;
      const g = groupAt(pos.board, n, c);
      pierres.push(...g.stones);
      for (const l of g.liberties) if (!oeil.includes(l)) libres.add(l);
    }
    if (pierres.length < 3 || hasTwoEyes(pos, pierres[0])) continue;
    if (propriete && propriete.length === n * n) {
      const m = pierres.reduce((s, p) => s + signe * propriete[p], 0) / pierres.length;
      if (m >= OEIL_SUR || m <= OEIL_PERDU || libres.size < 1) continue; // déjà sauf (relié ailleurs) ou déjà perdu : conseil vain
    } else if (libres.size < 2 || libres.size > OEIL_LIBERTES_MAX) continue; // sans place pour un deuxième œil, ou pas en danger
    candidats.push({ pierres, oeil });
  }
  if (!candidats.length) return null;
  candidats.sort((a, b) => b.pierres.length - a.pierres.length || Math.min(...a.pierres) - Math.min(...b.pierres));
  const c = candidats[0];
  const pierres = trie(c.pierres), nb = neighbors(n);
  const point = pierres.find(s => nb[s].some(r => c.oeil.includes(r))) ?? pierres[0];
  return { modele: 'un-seul-oeil', point, pierres: pierres.length, zone: trie([...pierres, ...c.oeil]) };
}

// ---------- Zone à défendre ----------

/** Propriété du joueur au-dessus de ce seuil : la zone est à lui. */
export const DEFENDRE_A_MOI = 0.4;
/** Propriété du joueur sous ce seuil si l'adversaire jouait : la zone lui échapperait. */
export const DEFENDRE_PERDUE = -0.2;
/** Taille minimale d'une zone à défendre. */
export const DEFENDRE_MIN = 3;

const distance = (a: number, b: number, n: number) => Math.max(Math.abs((a % n) - (b % n)), Math.abs(Math.floor(a / n) - Math.floor(b / n)));

function centre(zone: number[], n: number): number {
  const cx = zone.reduce((s, p) => s + (p % n), 0) / zone.length;
  const cy = zone.reduce((s, p) => s + Math.floor(p / n), 0) / zone.length;
  const d = (p: number) => (p % n - cx) ** 2 + (Math.floor(p / n) - cy) ** 2;
  return zone.reduce((a, b) => (d(b) < d(a) ? b : a));
}

function zoneADefendre(pos: Position, moi: Color, o: OptionsConseil): ConseilMochi | null {
  const n = pos.size, nb = neighbors(n), avant = o.propriete, apres = o.proprieteSiTuPasses;
  if (!avant || !apres || avant.length !== n * n || apres.length !== n * n || !o.coups?.length) return null;
  const s = moi === 1 ? 1 : -1;
  const bascule = (p: number) => pos.board[p] !== 3 - moi && s * avant[p] >= DEFENDRE_A_MOI && s * apres[p] <= DEFENDRE_PERDUE;
  const vu = new Uint8Array(n * n);
  let meilleure: number[] = [];
  for (let p = 0; p < n * n; p++) {
    if (vu[p] || !bascule(p)) continue;
    const comp: number[] = [], pile = [p];
    vu[p] = 1;
    while (pile.length) {
      const q = pile.pop()!;
      comp.push(q);
      for (const r of nb[q]) if (!vu[r] && bascule(r)) { vu[r] = 1; pile.push(r); }
    }
    if (comp.length > meilleure.length) meilleure = comp;
  }
  if (meilleure.length < DEFENDRE_MIN) return null;
  // KataGo doit lui-même défendre là : son meilleur coup est dans la zone ou à deux lignes au plus.
  const b = o.coups[0];
  if (b < 0 || !meilleure.some(p => distance(p, b, n) <= 2)) return null;
  const zone = trie(meilleure);
  const m = o.menace ?? -1;
  const point = m >= 0 && pos.board[m] === 0 && zone.some(p => distance(p, m, n) <= 1) ? m : centre(zone, n);
  return { modele: 'zone-a-defendre', point, pierres: 0, zone };
}

// ---------- Coup à éviter (auto-atari) ----------

/** Nombre de meilleurs coups de KataGo jamais présentés comme « à éviter ». */
export const EVITER_SAUF_TOP = 3;

function coupAEviter(pos: Position, moi: Color, o: OptionsConseil): ConseilMochi | null {
  const n = pos.size, eux = (3 - moi) as Color, top = new Set((o.coups ?? []).slice(0, EVITER_SAUF_TOP));
  const adverses = (b: Int8Array) => b.reduce((s, v) => s + (v === eux ? 1 : 0), 0);
  const avant = adverses(pos.board), tourAdverse: Position = { ...pos, toPlay: eux, ko: -1 };
  for (const g of chaines(pos, moi)) {
    if (g.liberties.size !== 2) continue;
    // Seulement un groupe aujourd'hui hors de prise : c'est le coup lui-même qui le perdrait.
    if (captureWorks(tourAdverse, g.stones[0], PROFONDEUR)) continue;
    for (const l of trie(g.liberties)) {
      if (top.has(l)) continue;
      const r = o.dejaVues ? playSuperko(pos, l, o.dejaVues) : play(pos, l);
      if (typeof r === 'string' || adverses(r.board) !== avant) continue; // illégal, ou le coup prend : autre situation
      const moiApres = groupAt(r.board, n, l);
      if (moiApres.liberties.size !== 1 || moiApres.stones.length < 2) continue;
      const c = [...moiApres.liberties][0];
      const r2 = play(r, c); // l'adversaire est au trait dans `r`
      if (typeof r2 === 'string' || r2.board[l] !== 0) continue;
      // Pas de prise en retour (snapback) ni de ko : la pierre qui prend garde au moins deux libertés.
      if (groupAt(r2.board, n, c).liberties.size < 2) continue;
      return { modele: 'coup-a-eviter', point: l, pierres: moiApres.stones.length, zone: trie(moiApres.stones) };
    }
  }
  return null;
}

// ---------- Grand coup (coin ou bord encore vide) ----------

/** Lignes comptées comme « coin » ou « bord » depuis chaque côté, selon la taille du plateau. */
export function lignesBord(size: number): number { return size <= 9 ? 3 : size <= 13 ? 4 : 5; }
/** Rayon (en lignes) autour du meilleur coup qui doit être vide pour parler d'un coin ou d'un bord « encore vide ». */
export const RAYON_VIDE = 2;

function grandCoup(pos: Position, o: OptionsConseil): ConseilMochi | null {
  const n = pos.size, b = o.coups?.[0];
  if (b === undefined || b < 0 || b >= n * n || pos.board[b] !== 0 || n < 9) return null;
  const x = b % n, y = Math.floor(b / n), L = lignesBord(n);
  const g = x < L, d = n - 1 - x < L, h = y < L, bas = n - 1 - y < L;
  const cote: Cote | null = h && d ? 'hd' : h && g ? 'hg' : bas && d ? 'bd' : bas && g ? 'bg' : h ? 'h' : bas ? 'b' : g ? 'g' : d ? 'd' : null;
  if (!cote) return null;
  const zone: number[] = [];
  for (let j = Math.max(0, y - RAYON_VIDE); j <= Math.min(n - 1, y + RAYON_VIDE); j++)
    for (let i = Math.max(0, x - RAYON_VIDE); i <= Math.min(n - 1, x + RAYON_VIDE); i++) {
      if (pos.board[j * n + i] !== 0) return null; // pas « encore vide »
      zone.push(j * n + i);
    }
  return { modele: 'grand-coup', point: null, pierres: 0, zone: trie(zone), cote };
}

/** Conseil pour le joueur au trait, ou `null` si aucun modèle ne s'applique sans risque d'erreur. */
export function conseil(pos: Position, options: OptionsConseil = {}): ConseilMochi | null {
  const moi = pos.toPlay;
  return atariJoueur(pos, moi)
    ?? atariAdverse(pos, moi, options.dejaVues)
    ?? peuDeLibertes(pos, moi)
    ?? unSeulOeil(pos, moi, options.propriete)
    ?? zoneADefendre(pos, moi, options)
    ?? coupAEviter(pos, moi, options)
    ?? grandCoup(pos, options)
    ?? coinLibre(pos)
    ?? (options.propriete ? zoneAPrendre(pos, options.propriete) : null);
}

const CLE_COTE = {
  hd: 'conseil.cote.hd', hg: 'conseil.cote.hg', bd: 'conseil.cote.bd', bg: 'conseil.cote.bg',
  h: 'conseil.cote.h', b: 'conseil.cote.b', g: 'conseil.cote.g', d: 'conseil.cote.d',
} as const;

/** Phrase du conseil, dans la langue demandée (par défaut celle de l'interface). */
export function phraseConseil(c: ConseilMochi, size: number, l: Langue = langueCourante()): string {
  const point = c.point === null ? '' : toLabel(c.point, size);
  switch (c.modele) {
    case 'atari-joueur': return traduire(l, 'conseil.atariJoueur', { point });
    case 'atari-adverse': return traduire(l, 'conseil.atariAdverse', { point, n: c.pierres });
    case 'peu-de-libertes': return traduire(l, 'conseil.peuDeLibertes', { point });
    case 'un-seul-oeil': return traduire(l, 'conseil.unSeulOeil', { point });
    case 'zone-a-defendre': return traduire(l, 'conseil.zoneADefendre', { point });
    case 'coup-a-eviter': return traduire(l, 'conseil.coupAEviter', { point });
    case 'grand-coup': return traduire(l, c.cote!.length === 2 ? 'conseil.grandCoupCoin' : 'conseil.grandCoupBord', { ou: traduire(l, CLE_COTE[c.cote!]) });
    case 'coin-libre': return traduire(l, 'conseil.coinLibre');
    case 'zone-a-prendre': return traduire(l, 'conseil.zoneAPrendre', { point });
  }
}
