// Issue #673 : dans la revue, pourquoi ton coup est une erreur et pourquoi le bon coup est meilleur.
// Logique pure, sans texte (les phrases : src/app/analyseExpliquee.ts). Tests : explication.test.ts (positions
// construites, vérité connue) et explication-katago.test.ts (analyses du vrai KataGo figées).
//
// Règle d'or (Florian) : aucun conseil de go faux. On compare deux suites, jouées coup par coup avec les règles
// (src/go/rules.ts) : ton coup suivi de la variante principale de KataGo pour l'adversaire, et le bon coup suivi de sa
// variante principale. On compare aussi la propriété estimée par KataGo après chacun des deux coups. Un fait n'est
// gardé que si deux sources s'accordent (les règles et la suite, ou la suite et la propriété), au-dessus des seuils de
// SEUILS. Sans fait sûr, l'explication le dit (`positionnel`) et n'invente rien.
//
// Faits gérés (voir docs/produit/analyse-expliquee-2026-10.md) :
// - pierresPerdues : dans ta suite, l'adversaire prend des pierres à toi (atari ignoré : une liberté avant et après ton
//   coup ; coup qui se met en atari ; ou
//   prise plus loin dans la suite) ; avec le bon coup, elles ne sont pas prises et restent à toi ;
// - priseManquee   : dans la suite du bon coup, tu prends des pierres adverses ; dans ta suite, elles restent à lui ;
// - groupe         : un groupe à toi, vivant après le bon coup, est mort (ou n'est plus sûr de vivre) après ton coup ;
// - groupeTue      : un groupe adverse, mort après le bon coup, peut vivre après ton coup ;
// - coupe          : la réponse de l'adversaire coupe tes pierres (séparation vérifiée par les règles), ce qui leur
//                    coûte de la propriété ; le bon coup empêche cette coupe ;
// - territoire     : l'écart de propriété se concentre dans une zone (coin, bord, centre, sinon un quart ou une moitié) ;
//                    la zone porte au moins la moitié des points perdus, sans les dépasser (moins 2 points par pierre
//                    déjà dite par une autre raison) ;
// - initiative     : selon la suite de KataGo, après le bon coup l'adversaire répond sur place puis tu joues ailleurs
//                    (sente), alors qu'après ton coup il joue ailleurs tout de suite (ton coup était gote).
import { groupAt, neighbors, play, type Color, type Position } from './rules';

/** Seuils de confiance. Tous documentés dans docs/produit/analyse-expliquee-2026-10.md. */
export const SEUILS = {
  /** Points perdus en dessous desquels on n'explique pas (la revue ne parle pas d'erreur). */
  perteMin: 1,
  /** Visites minimales du premier coup d'une suite pour lire la suite de KataGo au-delà de ce coup. */
  visitesSuite: 16,
  /** Coups lus et montrés dans chaque suite, le premier compris. Au-delà, la suite de KataGo est trop peu explorée. */
  longueurSuite: 5,
  /** Propriété (de ton point de vue, de -1 à +1) à partir de laquelle une pierre est dite vivante (ou morte, en négatif). */
  sure: 0.6,
  /** Propriété moyenne qui confirme une prise de la suite (pierres prises : au plus -0,3 ; sauvées : au moins +0,3). */
  confirme: 0.3,
  /** Au-dessus de cette propriété moyenne, un groupe est encore « sûr » : en dessous, il n'est plus sûr de vivre. */
  incertain: 0.2,
  /** Groupe : écart moyen minimal de propriété entre les deux suites, par pierre du groupe. */
  ecartGroupe: 0.8,
  /** Coupe : perte moyenne de propriété des pierres coupées pour dire que la coupe compte. */
  ecartCoupe: 0.4,
  /** Zone : gain minimal (points), part minimale du gain total et des points perdus, et marge au-delà des points perdus. */
  zoneMin: 2,
  zonePart: 0.5,
  zonePartPrecise: 0.7,
  zoneMarge: 2,
  /** Sans raison sûre, au-delà de cette perte on renvoie aux deux suites sans chiffrer la comparaison (sauf calme vérifié). */
  positionnelMax: 5,
  /** Gain d'une intersection à partir duquel elle est marquée d'un carré sur le plateau. */
  carre: 0.25,
  /** Initiative : réponse « sur place » à au plus 2 intersections, coup « ailleurs » à au moins 4. */
  local: 2,
  ailleurs: 4,
} as const;

/** Ligne comparée : ta suite (ton coup, puis la réponse de KataGo) ou celle du bon coup. */
export type Ligne = 'joue' | 'bon';

/** Zone du plateau : coin, bord ou centre (tiers du plateau), sinon un quart, sinon une moitié. */
export type Lieu =
  | 'coinHautGauche' | 'coinHautDroite' | 'coinBasGauche' | 'coinBasDroite'
  | 'bordHaut' | 'bordBas' | 'bordGauche' | 'bordDroite' | 'centre'
  | 'hautGauche' | 'hautDroite' | 'basGauche' | 'basDroite'
  | 'haut' | 'bas' | 'gauche' | 'droite';

/** Ce que le plateau montre pour une raison : la suite, jusqu'à quelle étape, et les pierres ou la zone concernées. */
export interface Visuel { ligne: Ligne; etape: number; pierres: number[]; zone?: number[] }

interface Base { poids: number; visuel: Visuel }
export type Fait = Base & (
  | { type: 'pierresPerdues'; pierres: number[]; point: number; etape: number; cause: 'atari' | 'autoAtari' | 'suite' }
  | { type: 'priseManquee'; pierres: number[]; point: number; etape: number; cause: 'atari' | 'immediate' | 'suite' }
  | { type: 'groupe'; pierres: number[]; etat: 'mort' | 'faible' }
  | { type: 'groupeTue'; pierres: number[]; apresJoue: 'vit' | 'incertain' }
  | { type: 'coupe'; point: number; pierres: number[]; parade: 'occupe' | 'relie' | 'atari' }
  | { type: 'territoire'; lieu: Lieu; gain: number; points: number[] }
  | { type: 'initiative'; reponse: number; ailleurs: number; ailleursLui: number }
);

/** Une suite jouée : les coups, et la position après chacun (`positions[i]` après `coups[i]`). */
export interface Suite { coups: number[]; positions: Position[] }

export interface Entree {
  /** Position juste avant ton coup. */
  avant: Position;
  /** Ton coup (-1 : passe). */
  joue: number;
  /** Le meilleur coup de KataGo. */
  bon: number;
  /** Points perdus par ton coup (ceux que la revue affiche). */
  perte: number;
  /** Variante principale de KataGo depuis `avant`, qui commence par `bon`, et les visites de `bon`. */
  pvBon?: readonly number[];
  visitesBon?: number;
  /** Propriété estimée après le bon coup, de -1 (Blanc) à +1 (Noir). */
  ownBon?: ArrayLike<number> | null;
  /** Variante principale de KataGo pour l'adversaire après ton coup, et les visites de son premier coup. */
  pvRiposte?: readonly number[];
  visitesRiposte?: number;
  /** Propriété estimée après ton coup, de -1 (Blanc) à +1 (Noir). */
  ownJoue?: ArrayLike<number> | null;
}

export interface Explication {
  joue: number;
  bon: number;
  perte: number;
  /** Ta suite : ton coup, puis la variante de KataGo pour l'adversaire (si elle est assez explorée). */
  suiteJoue: Suite;
  /** La suite du bon coup : le bon coup, puis sa variante principale (si elle est assez explorée). */
  suiteBon: Suite;
  /** Réponse de l'adversaire à ton coup, selon KataGo (`null` : inconnue ou trop peu explorée). */
  riposte: number | null;
  /** Une ou deux raisons, la plus forte d'abord. Vide : aucune raison sûre. */
  faits: Fait[];
  /** Aucune raison sûre : on dit seulement que KataGo préfère le bon coup, et de combien. */
  positionnel: boolean;
  /**
   * Vérifié : aucune pierre n'est prise dans les deux suites, et aucune pierre ne change de camp selon la propriété
   * (écart d'au moins `SEUILS.sure`). Permet de dire « rien n'est pris, aucun groupe ne change de sort ».
   */
  calme: boolean;
}

const autre = (c: Color) => (3 - c) as Color;
const trie = (xs: Iterable<number>) => [...new Set(xs)].sort((a, b) => a - b);

function jouer(pos: Position, p: number): Position | null {
  const r = play(pos, p);
  return typeof r === 'string' ? null : r;
}

/** Distance de Tchebychev (en intersections) entre deux points. */
export function distance(a: number, b: number, size: number): number {
  return Math.max(Math.abs((a % size) - (b % size)), Math.abs(Math.floor(a / size) - Math.floor(b / size)));
}

/**
 * Suite jouée depuis `depart` : les coups légaux l'un après l'autre, au plus `max`. Seul le premier coup peut être
 * une passe (ton coup) ; la suite s'arrête à la première passe ou au premier coup illégal qui suit.
 */
export function suiteJouee(depart: Position, coups: readonly number[], max: number = SEUILS.longueurSuite): Suite {
  const out: Suite = { coups: [], positions: [] };
  let pos = depart;
  for (const p of coups) {
    if (out.coups.length >= max || !Number.isInteger(p)) break;
    if (p < 0 && out.coups.length > 0) break;
    const r = jouer(pos, p < 0 ? -1 : p);
    if (!r) break;
    out.coups.push(p < 0 ? -1 : p);
    out.positions.push(r);
    pos = r;
  }
  return out;
}

/** Prises le long d'une suite : à l'étape `etape` (0 : premier coup), `camp` prend `pierres` en jouant `point`. */
interface Prise { etape: number; point: number; camp: Color; pierres: number[] }
function prisesDe(depart: Position, s: Suite): Prise[] {
  const out: Prise[] = [];
  let pos = depart;
  s.positions.forEach((r, etape) => {
    const camp = pos.toPlay, o = autre(camp), pierres: number[] = [];
    for (let p = 0; p < r.board.length; p++) if (pos.board[p] === o && r.board[p] !== o) pierres.push(p);
    if (pierres.length) out.push({ etape, point: s.coups[etape], camp, pierres });
    pos = r;
  });
  return out;
}

const moyenne = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const proprieteValide = (o: ArrayLike<number> | null | undefined, n: number): o is ArrayLike<number> => {
  if (!o || o.length !== n) return false;
  for (let p = 0; p < n; p++) if (!Number.isFinite(o[p])) return false;
  return true;
};

/** Chaînes distinctes de couleur `c` qui touchent `p` : une pierre par chaîne. */
function voisinesDistinctes(pos: Position, p: number, c: Color): number[] {
  const reps: number[] = [], vues = new Set<number>();
  for (const r of neighbors(pos.size)[p]) {
    if (pos.board[r] !== c || vues.has(r)) continue;
    groupAt(pos.board, pos.size, r).stones.forEach(s => vues.add(s));
    reps.push(r);
  }
  return reps;
}

const memeChaine = (pos: Position, pierres: number[]) => {
  const c = pos.board[pierres[0]];
  if (!c || pierres.some(s => pos.board[s] !== c)) return false;
  const g = new Set(groupAt(pos.board, pos.size, pierres[0]).stones);
  return pierres.every(s => g.has(s));
};

/**
 * Regroupe des pierres proches de même couleur : côte à côte, en diagonale (sauf si l'adversaire occupe les deux
 * points qui les séparent : c'est une coupe), ou à un saut sur une ligne avec un point vide entre deux. Un « groupe »
 * au sens du joueur, pas seulement une chaîne. Groupes triés du plus grand au plus petit.
 */
export function regrouper(pos: Position, pierres: readonly number[]): number[][] {
  const size = pos.size, reste = new Set(pierres), out: number[][] = [];
  const proches = (a: number, b: number) => {
    const ax = a % size, ay = Math.floor(a / size), bx = b % size, by = Math.floor(b / size);
    const dx = Math.abs(ax - bx), dy = Math.abs(ay - by);
    if (dx + dy === 1) return true;
    if (dx === 1 && dy === 1) {
      const c = pos.board[a], o = c === 1 ? 2 : 1;
      return !(pos.board[ay * size + bx] === o && pos.board[by * size + ax] === o);
    }
    if ((dx === 2 && dy === 0) || (dx === 0 && dy === 2)) return pos.board[(a + b) / 2] === 0;
    return false;
  };
  for (const depart of pierres) {
    if (!reste.has(depart)) continue;
    reste.delete(depart);
    const g = [depart], file = [depart];
    while (file.length) {
      const a = file.pop()!;
      for (const b of [...reste]) if (proches(a, b)) { reste.delete(b); g.push(b); file.push(b); }
    }
    out.push(trie(g));
  }
  return out.sort((a, b) => b.length - a.length || a[0] - b[0]);
}

// ---------- Zones ----------

const LIEUX_PRECIS: Lieu[] = ['coinHautGauche', 'coinHautDroite', 'coinBasGauche', 'coinBasDroite', 'bordHaut', 'bordBas', 'bordGauche', 'bordDroite', 'centre'];
const LIEUX_QUARTS: Lieu[] = ['hautGauche', 'hautDroite', 'basGauche', 'basDroite'];
const LIEUX_MOITIES: Lieu[] = ['haut', 'bas', 'gauche', 'droite'];
export const LIEUX: readonly Lieu[] = [...LIEUX_PRECIS, ...LIEUX_QUARTS, ...LIEUX_MOITIES];

/** Largeur d'une bande de bord (coin et bord) : un tiers du plateau (3 en 9 × 9, 4 en 13 × 13, 6 en 19 × 19). */
export const bande = (size: number) => Math.round(size / 3);

/** Vrai si `p` est dans le lieu `l`. Coins, bords et centre partagent le plateau en 9 cases ; quarts et moitiés sont stricts. */
export function dansLieu(p: number, size: number, l: Lieu): boolean {
  const x = p % size, y = Math.floor(p / size), b = bande(size), m = (size - 1) / 2;
  const h = y < b, ba = y >= size - b, g = x < b, d = x >= size - b, mh = !h && !ba, mv = !g && !d;
  switch (l) {
    case 'coinHautGauche': return h && g;
    case 'coinHautDroite': return h && d;
    case 'coinBasGauche': return ba && g;
    case 'coinBasDroite': return ba && d;
    case 'bordHaut': return h && mv;
    case 'bordBas': return ba && mv;
    case 'bordGauche': return g && mh;
    case 'bordDroite': return d && mh;
    case 'centre': return mh && mv;
    case 'hautGauche': return y < m && x < m;
    case 'hautDroite': return y < m && x > m;
    case 'basGauche': return y > m && x < m;
    case 'basDroite': return y > m && x > m;
    case 'haut': return y < m;
    case 'bas': return y > m;
    case 'gauche': return x < m;
    case 'droite': return x > m;
  }
}

/**
 * Zone où se fait l'écart de propriété sur les intersections vides (gain de ton point de vue, `d[p]`). Le lieu le plus
 * précis d'abord (coin, bord, centre), puis un quart, puis une moitié : on garde le premier niveau où un lieu porte au
 * moins 70 % du gain total, sinon le premier où il en porte au moins 50 %. Toujours : gain ≥ 2 points, et entre
 * `bornes.min` et `bornes.max` (la zone explique une bonne part de la perte, sans jamais la dépasser de beaucoup :
 * ni « 10 points dans le coin » pour une erreur de 3 points, ni « 2 points » pour une erreur de 10).
 */
export function zoneDe(avant: Position, d: Float64Array, bornes: { min: number; max: number }, exclus: ReadonlySet<number>): { lieu: Lieu; gain: number; total: number; points: number[] } | null {
  const n = avant.board.length, size = avant.size;
  let total = 0;
  for (let p = 0; p < n; p++) if (avant.board[p] === 0 && !exclus.has(p)) total += d[p];
  if (!(total > 0)) return null;
  const gainDe = (l: Lieu) => {
    let g = 0;
    for (let p = 0; p < n; p++) if (avant.board[p] === 0 && !exclus.has(p) && dansLieu(p, size, l)) g += d[p];
    return g;
  };
  const dicible = (g: number, part: number) => g >= SEUILS.zoneMin && g >= part * total && g >= bornes.min && g <= bornes.max;
  for (const part of [SEUILS.zonePartPrecise, SEUILS.zonePart]) {
    for (const niveau of [LIEUX_PRECIS, LIEUX_QUARTS, LIEUX_MOITIES]) {
      let choix: { lieu: Lieu; gain: number } | null = null;
      for (const lieu of niveau) {
        const g = gainDe(lieu);
        if (dicible(g, part) && (!choix || g > choix.gain)) choix = { lieu, gain: g };
      }
      if (choix) {
        const points: number[] = [];
        for (let p = 0; p < n; p++) if (avant.board[p] === 0 && !exclus.has(p) && dansLieu(p, size, choix.lieu) && d[p] >= SEUILS.carre) points.push(p);
        return { lieu: choix.lieu, gain: Math.round(choix.gain * 10) / 10, total: Math.round(total * 10) / 10, points };
      }
    }
  }
  return null;
}

// ---------- Coupe ----------

/**
 * La réponse `r` de l'adversaire (dans `pj`, après ton coup) coupe-t-elle tes pierres ? `r` touche au moins deux de
 * tes chaînes (pierres déjà là avant ton coup), ne prend rien, garde au moins 2 libertés, et aucun coup à toi ne
 * relie ensuite toutes ces chaînes. Renvoie une pierre par chaîne coupée, ou `null`.
 */
function coupeDe(avant: Position, pj: Position, r: number, c: Color): number[] | null {
  if (r < 0 || pj.board[r] !== 0) return null;
  const reps = voisinesDistinctes(pj, r, c).map(s => groupAt(pj.board, pj.size, s).stones.find(x => avant.board[x] === c)).filter((s): s is number => s != null);
  if (reps.length < 2) return null;
  const q = jouer(pj, r);
  if (!q || reps.some(s => q.board[s] !== c) || groupAt(q.board, q.size, r).liberties.size < 2) return null;
  const libs = new Set(reps.flatMap(s => [...groupAt(q.board, q.size, s).liberties]));
  for (const x of libs) {
    const k = jouer(q, x);
    if (k && reps.every(s => k.board[s] === c) && memeChaine(k, reps)) return null;
  }
  return reps;
}

/** Après le bon coup, pourquoi `r` n'est plus une coupe (`null` : elle l'est encore, ou ce n'est pas sûr). */
function paradeDe(pb: Position, bon: number, r: number, c: Color, reps: number[]): 'occupe' | 'relie' | 'atari' | null {
  if (bon === r) return 'occupe';
  if (pb.board[r] !== 0) return null;
  if (reps.every(s => pb.board[s] === c) && memeChaine(pb, reps)) return 'relie';
  const q = jouer(pb, r);
  if (q && reps.every(s => q.board[s] === c) && groupAt(q.board, q.size, r).liberties.size === 1) return 'atari';
  return null;
}

// ---------- Le générateur ----------

/** Familles de raisons, de la plus concrète à la moins concrète. */
const RANG: Record<Fait['type'], number> = { pierresPerdues: 0, priseManquee: 0, coupe: 1, groupe: 1, groupeTue: 1, territoire: 2, initiative: 3 };

/**
 * Explique l'erreur `joue` face au bon coup `bon` (voir l'en-tête du fichier). `null` si rien n'est à expliquer :
 * moins de `SEUILS.perteMin` points perdus, bon coup injouable, ou bon coup égal au coup joué.
 */
export function expliquerErreur(e: Entree): Explication | null {
  const { avant, joue, bon } = e;
  const n = avant.board.length, size = avant.size, c = avant.toPlay, o = autre(c), s = c === 1 ? 1 : -1;
  if (!(e.perte >= SEUILS.perteMin) || bon < 0 || bon === joue || !jouer(avant, bon)) return null;
  const pj = jouer(avant, joue >= 0 ? joue : -1);
  if (!pj) return null;

  const fiable = (v: number | undefined) => (v ?? 0) >= SEUILS.visitesSuite;
  const pvBon = e.pvBon && e.pvBon[0] === bon && fiable(e.visitesBon) ? e.pvBon : [bon];
  const riposte = e.pvRiposte && fiable(e.visitesRiposte) && (e.pvRiposte[0] ?? -1) >= 0 ? e.pvRiposte : [];
  const suiteBon = suiteJouee(avant, pvBon);
  const suiteJoue = suiteJouee(avant, [joue, ...riposte]);
  const pb = suiteBon.positions[0];
  const ownBon = proprieteValide(e.ownBon, n) ? e.ownBon : null;
  const ownJoue = proprieteValide(e.ownJoue, n) ? e.ownJoue : null;
  const avecPropriete = !!ownBon && !!ownJoue;
  const b = (p: number) => s * ownBon![p], j = (p: number) => s * ownJoue![p];

  const prisesJoue = prisesDe(avant, suiteJoue), prisesBon = prisesDe(avant, suiteBon);
  const prisesPar = (l: Prise[], camp: Color) => new Set(l.filter(x => x.camp === camp).flatMap(x => x.pierres));
  const tiennesPrisesBon = prisesPar(prisesBon, o), siennesPrisesJoue = prisesPar(prisesJoue, c);
  const faits: Fait[] = [];
  const dejaDites = new Set<number>();

  // 1. Pierres perdues : l'adversaire prend des pierres à toi dans ta suite ; avec le bon coup, elles restent à toi.
  for (const x of prisesJoue.filter(x => x.camp === o).sort((a, b) => b.pierres.length - a.pierres.length || a.etape - b.etape)) {
    const anciennes = x.pierres.filter(p => avant.board[p] === c);
    if (anciennes.some(p => tiennesPrisesBon.has(p))) continue;
    // Confirmation : la propriété après ton coup les donne à l'adversaire ; sinon, seulement une prise immédiate.
    if (ownJoue ? moyenne(x.pierres.map(j)) > -SEUILS.confirme : x.etape !== 1) continue;
    // Avec le bon coup, ces pierres restent à toi (propriété), quand elles étaient déjà là.
    if (anciennes.length && ownBon && moyenne(anciennes.map(b)) < SEUILS.confirme) continue;
    // Atari ignoré : une seule liberté avant ton coup ET encore une seule après (ton coup ne les touche pas, et ne prend
    // pas une pierre voisine qui leur redonnerait des libertés).
    const enAtari = anciennes.length === x.pierres.length && anciennes.every(p => groupAt(avant.board, size, p).liberties.size === 1)
      && x.pierres.every(p => pj.board[p] === c && groupAt(pj.board, size, p).liberties.size === 1)
      && (joue < 0 || !x.pierres.some(p => groupAt(pj.board, size, p).stones.includes(joue)));
    const auto = joue >= 0 && x.pierres.includes(joue) && groupAt(pj.board, size, joue).liberties.size === 1;
    const cause = enAtari ? 'atari' : auto ? 'autoAtari' : 'suite';
    faits.push({ type: 'pierresPerdues', pierres: trie(x.pierres), point: x.point, etape: x.etape, cause, poids: 2 * x.pierres.length,
      visuel: { ligne: 'joue', etape: x.etape, pierres: trie(x.pierres) } });
    x.pierres.forEach(p => dejaDites.add(p));
    break;
  }

  // 2. Prise manquée : dans la suite du bon coup, tu prends des pierres adverses ; dans ta suite, elles restent à lui.
  for (const x of prisesBon.filter(x => x.camp === c).sort((a, b) => b.pierres.length - a.pierres.length || a.etape - b.etape)) {
    if (x.pierres.some(p => siennesPrisesJoue.has(p))) continue;
    if (ownBon ? moyenne(x.pierres.map(b)) < SEUILS.confirme : x.etape !== 0) continue;
    if (ownJoue && moyenne(x.pierres.map(j)) > 0) continue;
    const enAtari = x.pierres.every(p => groupAt(avant.board, size, p).liberties.size === 1);
    const cause = x.etape === 0 && enAtari ? 'atari' : x.etape === 0 ? 'immediate' : 'suite';
    faits.push({ type: 'priseManquee', pierres: trie(x.pierres), point: x.point, etape: x.etape, cause, poids: 2 * x.pierres.length,
      visuel: { ligne: 'bon', etape: x.etape, pierres: trie(x.pierres) } });
    x.pierres.forEach(p => dejaDites.add(p));
    break;
  }

  // 3. Groupes : un groupe à toi (au moins 2 pierres), vivant après le bon coup, mort ou incertain après ton coup ; et
  //    l'inverse chez lui. Moyennes sur tout le groupe : on parle du groupe entier, jamais d'une partie choisie.
  if (avecPropriete) {
    const groupesDe = (camp: Color) => {
      const pierres: number[] = [];
      for (let p = 0; p < n; p++) if (avant.board[p] === camp) pierres.push(p);
      return regrouper(avant, pierres).filter(g => g.length >= 2 && !g.some(p => dejaDites.has(p)));
    };
    const bascule = (g: number[]) => {
      const mb = moyenne(g.map(b)), mj = moyenne(g.map(j));
      return mb >= SEUILS.sure && mj <= SEUILS.incertain && mb - mj >= SEUILS.ecartGroupe ? { mj, poids: g.reduce((a, p) => a + b(p) - j(p), 0) } : null;
    };
    const meilleur = (camp: Color) => groupesDe(camp).map(g => ({ g, x: bascule(g) })).filter(v => v.x).sort((u, v) => v.x!.poids - u.x!.poids)[0];
    const g = meilleur(c);
    if (g) {
      faits.push({ type: 'groupe', pierres: g.g, etat: g.x!.mj <= -SEUILS.sure ? 'mort' : 'faible', poids: g.x!.poids, visuel: { ligne: 'joue', etape: suiteJoue.coups.length - 1, pierres: g.g } });
      g.g.forEach(p => dejaDites.add(p));
    }
    const h = meilleur(o);
    if (h) {
      faits.push({ type: 'groupeTue', pierres: h.g, apresJoue: h.x!.mj <= -SEUILS.sure ? 'vit' : 'incertain', poids: h.x!.poids, visuel: { ligne: 'bon', etape: suiteBon.coups.length - 1, pierres: h.g } });
      h.g.forEach(p => dejaDites.add(p));
    }
  }

  // 4. Coupe : la réponse de l'adversaire sépare tes pierres, et ça leur coûte (propriété ou prise) ; le bon coup la pare.
  const r1 = suiteJoue.coups.length >= 2 ? suiteJoue.coups[1] : null;
  if (r1 != null && pb) {
    const reps = coupeDe(avant, pj, r1, c);
    if (reps) {
      const coupees = trie(reps.flatMap(x => groupAt(pj.board, size, x).stones.filter(p => avant.board[p] === c)));
      const cout = avecPropriete ? moyenne(coupees.map(p => b(p) - j(p))) : 0;
      const prises = coupees.filter(p => prisesPar(prisesJoue, o).has(p)).length;
      const parade = paradeDe(pb, bon, r1, c, reps);
      if (parade && (cout >= SEUILS.ecartCoupe || prises > 0)) {
        faits.push({ type: 'coupe', point: r1, pierres: coupees, parade, poids: avecPropriete ? coupees.reduce((a, p) => a + Math.max(0, b(p) - j(p)), 0) : 2 * prises,
          visuel: { ligne: 'joue', etape: 1, pierres: coupees } });
      }
    }
  }

  // 5. Territoire : l'écart de propriété sur les points vides, concentré dans une zone. Les pierres déjà dites
  //    (prises, groupes, coupe) comptent 2 points chacune dans la perte : la zone ne peut dire que le reste.
  if (avecPropriete) {
    const d = new Float64Array(n);
    for (let p = 0; p < n; p++) d[p] = b(p) - j(p);
    const pierresDites = new Set(faits.flatMap(f => ('pierres' in f ? f.pierres : [])));
    // Avec d'autres raisons, pas de marge : la zone et les pierres ensemble ne dépassent pas les points perdus. La zone
    // porte au moins la moitié de ce qui reste à expliquer.
    const reste = e.perte - 2 * pierresDites.size;
    const bornes = pierresDites.size ? { min: SEUILS.zonePart * reste, max: reste } : { min: SEUILS.zonePart * e.perte, max: e.perte + SEUILS.zoneMarge };
    const z = zoneDe(avant, d, bornes, new Set([bon, joue, ...dejaDites, ...pierresDites]));
    if (z) faits.push({ type: 'territoire', lieu: z.lieu, gain: z.gain, points: z.points, poids: z.gain, visuel: { ligne: 'bon', etape: 0, pierres: [], zone: z.points } });
  }

  // 6. Initiative : après le bon coup, il répond sur place et tu joues ailleurs ; après ton coup, il joue ailleurs.
  const B = suiteBon.coups, J = suiteJoue.coups;
  let initiative: Fait | null = null;
  if (joue >= 0 && B.length >= 3 && J.length >= 2) {
    const d = (a: number, x: number) => distance(a, x, size);
    const sente = d(bon, B[1]) <= SEUILS.local && d(B[2], bon) >= SEUILS.ailleurs && d(B[2], B[1]) >= SEUILS.ailleurs;
    const gote = d(J[1], joue) >= SEUILS.ailleurs;
    if (sente && gote) initiative = { type: 'initiative', reponse: B[1], ailleurs: B[2], ailleursLui: J[1], poids: 0, visuel: { ligne: 'bon', etape: 2, pierres: [] } };
  }

  // Deux raisons au plus : les plus concrètes d'abord (prises, puis coupe et groupes, puis zone), les plus lourdes
  // d'abord dans chaque famille ; l'initiative en appoint.
  faits.sort((x, y) => RANG[x.type] - RANG[y.type] || y.poids - x.poids);
  const gardes = faits.slice(0, 2);
  if (initiative && gardes.length < 2) gardes.push(initiative);

  // « Calme » vérifié : aucune prise dans les deux suites, aucune pierre qui change de camp.
  let calme = !prisesJoue.length && !prisesBon.length && avecPropriete;
  if (calme) for (let p = 0; p < n; p++) if (avant.board[p] && Math.abs(b(p) - j(p)) >= SEUILS.sure) { calme = false; break; }

  return {
    joue, bon, perte: e.perte, suiteJoue, suiteBon,
    riposte: J.length >= 2 ? J[1] : null,
    faits: gardes,
    positionnel: gardes.length === 0,
    calme,
  };
}
