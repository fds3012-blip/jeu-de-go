// Logique pure de l'écran de partie : barre d'avantage, liste des coups, détection d'atari.
import { groupAt, neighbors, type Color, type Position } from '../go/rules';
import { toLabel } from '../go/coords';

const virgule = (n: number) => String(n).replace('.', ',');

/** Avance arrondie au demi-point (le komi a souvent une demie). */
export function arrondiDemi(n: number): number {
  return Math.round(n * 2) / 2;
}

/** Libellé de la barre d'avantage : « Noir +3,5 », « Blanc +12 » ou « À égalité ». `lead` : avance de Noir. */
export function libelleAvantage(lead: number): string {
  const a = arrondiDemi(lead);
  if (a === 0) return 'À égalité';
  return `${a > 0 ? 'Noir' : 'Blanc'} +${virgule(Math.abs(a))}`;
}

/**
 * Part de la barre occupée par Noir, entre 4 % et 96 % : la barre ne se remplit jamais complètement,
 * et un écart d'un plateau entier (taille × 1,5 points) en occupe environ les trois quarts.
 */
export function partNoir(lead: number, size: number): number {
  const p = 0.5 + 0.5 * Math.tanh(lead / (size * 1.5));
  return Math.min(0.96, Math.max(0.04, p));
}

/** Libellé d'un coup dans la liste : « 8. D6 », « 9. passe ». `numero` commence à 1. */
export function libelleCoup(numero: number, coup: number, size: number): string {
  return `${numero}. ${toLabel(coup, size)}`;
}

/** Coups joués depuis le début (index de plateau, -1 = passe), tirés de l'historique des positions. */
export function coupsJoues(history: Position[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < history.length; i++) out.push(history[i].lastMove ?? -1);
  return out;
}

export interface Atari { pierres: number[]; liberte: number }

/** Groupes de couleur `c` qui n'ont plus qu'une liberté. */
export function groupesEnAtari(board: Int8Array, size: number, c: Color): Atari[] {
  const vu = new Uint8Array(board.length), out: Atari[] = [];
  for (let p = 0; p < board.length; p++) {
    if (board[p] !== c || vu[p]) continue;
    const g = groupAt(board, size, p);
    for (const s of g.stones) vu[s] = 1;
    if (g.liberties.size === 1) out.push({ pierres: g.stones, liberte: [...g.liberties][0] });
  }
  return out;
}

/**
 * Groupes de couleur `c` mis en atari par le dernier coup : en atari dans `apres`,
 * et qui ne l'étaient pas déjà dans `avant` (on ne répète pas l'alerte à chaque coup).
 */
export function nouveauxAtari(avant: Int8Array, apres: Int8Array, size: number, c: Color): Atari[] {
  const deja = new Set<number>();
  for (const g of groupesEnAtari(avant, size, c)) for (const s of g.pierres) deja.add(s);
  return groupesEnAtari(apres, size, c).filter(g => g.pierres.some(s => !deja.has(s)));
}

/** Le coup `m` met-il en atari (une seule liberté) un groupe de l'autre couleur ? */
export function metEnAtari(r: Position, m: number): boolean {
  const c = r.board[m], size = r.size;
  return m >= 0 && neighbors(size)[m].some(q => r.board[q] === 3 - c && groupAt(r.board, size, q).liberties.size === 1);
}

// Aide de Mochi en partie (#35) : alerte d'atari contre les adversaires débutants.

/** Réglage « Aide de Mochi en partie » : `auto` = seulement contre les débutants (Pomme, Caillou). */
export type ReglageAide = 'auto' | 'oui' | 'non';
/** Adversaires contre lesquels l'aide est active par défaut. À partir de Bambou (13 kyu), elle est coupée. */
export const ADVERSAIRES_DEBUTANTS: readonly string[] = ['pomme', 'caillou'];

/** L'aide de Mochi est-elle active contre l'adversaire `id` ? */
export function aideActive(reglage: ReglageAide | undefined, id: string): boolean {
  if (reglage === 'oui') return true;
  if (reglage === 'non') return false;
  return ADVERSAIRES_DEBUTANTS.includes(id);
}

export const ALERTE_ATARI = "Atari ! Ton groupe n'a plus qu'une liberté. Sauve-le ou contre-attaque.";
export const EXPLICATION_ATARI = "Atari : il ne reste qu'une liberté, la pierre peut être prise au prochain coup.";

/** Message du coach quand un de tes groupes est mis en atari ; la première fois, le mot est expliqué. */
export function messageAtari(premiereFois: boolean): string {
  return premiereFois ? `${ALERTE_ATARI} ${EXPLICATION_ATARI}` : ALERTE_ATARI;
}

// Comment finir la partie (#120) : quand le plateau est presque plein, ou dès que l'ordi passe,
// Mochi explique une seule fois qu'on passe, et que deux passes lancent le comptage.

/** Vrai une fois que Mochi a expliqué le mot « passer » (comme l'atari, on ne l'explique qu'une fois). */
export const PASSER_KEY = 'go.passer-explique.v1';
/** Part du plateau occupée à partir de laquelle on le dit « presque plein ». */
export const SEUIL_PRESQUE_PLEIN = 0.6;
export const EXPLICATION_PASSER = "Passer, c'est laisser ton tour sans poser de pierre.";

/** Le plateau est-il presque plein (pierres sur au moins SEUIL_PRESQUE_PLEIN des intersections) ? */
export function presquePlein(board: Int8Array): boolean {
  let n = 0;
  for (let p = 0; p < board.length; p++) if (board[p]) n++;
  return n >= board.length * SEUIL_PRESQUE_PLEIN;
}

/** Message de Mochi : l'adversaire `nom` vient de passer (`ilPasse`), ou le plateau est presque plein. Le mot est expliqué. */
export function messagePasser(nom: string, ilPasse: boolean): string {
  const conseil = ilPasse
    ? `${nom} passe. Plus rien à gagner ? Passe aussi, et on compte.`
    : `Plus rien à gagner ? Passe. Si ${nom} passe aussi, on compte.`;
  return `${conseil} ${EXPLICATION_PASSER}`;
}

/**
 * Conseil « passer », une seule fois pour toujours (mémorisé dans localStorage) : rend le message, ou null
 * s'il a déjà été donné, si l'aide est coupée, ou si ni l'adversaire ne passe ni le plateau n'est presque plein.
 */
export function conseilPasser(nom: string, aide: boolean, ilPasse: boolean, board: Int8Array, stockage: Pick<Storage, 'getItem' | 'setItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): string | null {
  if (!aide || (!ilPasse && !presquePlein(board))) return null;
  try {
    if (stockage?.getItem(PASSER_KEY)) return null;
    stockage?.setItem(PASSER_KEY, 'true');
  } catch { /* stockage indisponible : on explique quand même */ }
  return messagePasser(nom, ilPasse);
}

// Indices limités contre l'ordi (#35) : 3 par partie, pour que le joueur cherche d'abord seul.

/** Nombre d'indices par partie contre l'ordi. */
export const INDICES_PAR_PARTIE = 3;
export const PLUS_D_INDICE = "Plus d'indice pour cette partie. À toi de jouer !";
const REGARDE = 'Regarde dans le cercle vert : il y a un bon coup.';

/** Indices restants après `utilises` indices (jamais négatif). */
export function indicesRestants(utilises: number): number {
  return Math.max(0, INDICES_PAR_PARTIE - Math.max(0, utilises));
}

/** Message du coach après un indice réussi ; le dernier annonce, une seule fois, qu'il n'y en a plus. */
export function messageIndice(restantsApres: number): string {
  return restantsApres > 0 ? REGARDE : `${REGARDE} ${PLUS_D_INDICE}`;
}

/** Description accessible du bouton « Indice » (le libellé reste « Indice »). */
export function descriptionIndices(restants: number): string {
  if (restants <= 0) return "Plus d'indice pour cette partie";
  return `${restants} indice${restants > 1 ? 's' : ''} restant${restants > 1 ? 's' : ''}`;
}

// « Qui mène ? » (#94) : la carte des territoires estimés et une phrase, 3 fois par partie contre l'ordi.

/** Nombre de « Qui mène ? » par partie contre l'ordi (illimité à deux). */
export const QUI_MENE_PAR_PARTIE = 3;
/** Durée d'affichage de la carte, en millisecondes. */
export const DUREE_QUI_MENE = 3000;
export const SERRE = "C'est serré.";
/** Écart sous lequel on dit « C'est serré » : 2 points avec KataGo, 5 avec l'estimation simple, moins sûre. */
export const SEUIL_SERRE = { katago: 2, simple: 5 } as const;

/** L'action « Qui mène ? » est-elle proposée ? Contre l'ordi, elle suit le réglage « Aide de Mochi en partie ». */
export function quiMeneDisponible(contreOrdi: boolean, aide: boolean): boolean {
  return !contreOrdi || aide;
}

/** « Qui mène ? » restants après `utilises` (jamais négatif). */
export function quiMeneRestants(utilises: number): number {
  return Math.max(0, QUI_MENE_PAR_PARTIE - Math.max(0, utilises));
}

/** Description accessible du bouton « Qui mène ? » contre l'ordi. */
export function descriptionQuiMene(restants: number): string {
  if (restants <= 0) return 'Plus disponible pour cette partie';
  return `Encore ${restants} fois dans cette partie`;
}

/**
 * Phrase affichée au-dessus du goban. `lead` : avance de Noir, komi compris. Quand l'écart est sous le seuil
 * du moteur (ou n'est pas un nombre), on dit « C'est serré » : jamais un chiffre trompeur.
 */
export function phraseQuiMene(lead: number, engine: 'katago' | 'simple'): string {
  const n = Math.round(Math.abs(lead));
  if (!Number.isFinite(lead) || Math.abs(lead) < SEUIL_SERRE[engine] || n < 2) return SERRE;
  return `${lead > 0 ? 'Noir' : 'Blanc'} mène d'environ ${n} points.`;
}

/**
 * Carte des territoires pour le goban (même codage que le score : 1 Noir, 2 Blanc, 0 personne) à partir
 * d'une propriété de -1 (Blanc) à +1 (Noir). Sous `seuil`, l'intersection reste neutre.
 */
export function carteTerritoire(own: ArrayLike<number>, seuil = 0.4): Int8Array {
  const out = new Int8Array(own.length);
  for (let p = 0; p < own.length; p++) out[p] = own[p] >= seuil ? 1 : own[p] <= -seuil ? 2 : 0;
  return out;
}

// Comptage automatique contre l'ordi (#117) : le débutant n'a pas à retirer lui-même les groupes morts.

export const EXPLICATION_MORTES = 'Les pierres grisées sont mortes : elles ne peuvent plus vivre, elles comptent comme prisonniers.';
export const CORRIGER_MORTES = 'Corriger les pierres mortes';
export const DOUTE_MORTES = "Je ne suis pas sûr pour certains groupes. Touche un groupe s'il est mort, touche-le encore s'il est vivant.";

/**
 * Après deux passes : `auto` = on va droit au récit du score avec les pierres mortes marquées ; `manuel` = phase
 * de comptage à la main. À deux sur un appareil, toujours à la main (les deux joueurs doivent s'accorder).
 * Contre l'ordi, à la main dès qu'un groupe est incertain : on ne compte jamais faux sans le dire.
 */
export function modeComptage(contreOrdi: boolean, incertains: readonly number[]): 'auto' | 'manuel' {
  return contreOrdi && incertains.length === 0 ? 'auto' : 'manuel';
}

/** Message de Mochi à l'entrée du comptage manuel. `fin` : phrase de fin de partie (« Deux passes… »). */
export function messageComptage(fin: string, morts: number, incertain: boolean): string {
  if (incertain) return `${EXPLICATION_MORTES} ${DOUTE_MORTES}`;
  if (morts) return `${EXPLICATION_MORTES} Touche un groupe pour corriger.`;
  return `${fin} Aucune pierre morte. Si un groupe ne peut plus vivre, touche-le pour le compter comme prisonnier.`;
}
