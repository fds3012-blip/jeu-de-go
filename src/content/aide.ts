// Aide du joueur (issue #362) : les règles en 5 cartes, « Comment on compte ? » et le glossaire du go.
// Ce fichier porte les positions (schémas) et ce qu'elles prouvent ; les textes sont dans le catalogue i18n
// (clés `aide.regle.*`, `aide.compter.*`, `aide.mot.*`). Chaque schéma est vérifié par src/go (src/go/aide.test.ts) :
// une phrase qui dit « ici, Noir capture » n'est publiée que si le moteur capture vraiment.
//
// Schémas : X noir, O blanc, . vide (comme les leçons) ; coordonnées affichées (« C3 » : colonnes A à T sans I,
// lignes depuis le bas). Pas de schéma en 9 × 9 sauf les hoshi : un petit plateau se lit mieux dans une carte.
import type { Rules } from '../go/score';

/** Ce que le schéma affirme. Chaque forme a sa vérification dans src/go/aide.test.ts. */
export type Preuve =
  /** Le groupe de `pierre` a exactement `n` libertés (et ce sont les points verts du schéma, s'il en a). */
  | { libertes: string; n: number }
  /** Le groupe de `pierre` compte `taille` pierres ; `hors` n'en fait pas partie (diagonale). */
  | { groupe: string; taille: number; hors: string }
  /** Le coup `coup` de `par` (1 Noir, 2 Blanc) est permis. */
  | { permis: string; par: 1 | 2 }
  /** Le coup `coup` de `par` capture exactement `n` pierres. */
  | { prend: string; par: 1 | 2; n: number }
  /** Le coup est un suicide (refusé par la règle). */
  | { suicide: string; par: 1 | 2 }
  /** Noir prend en `coup` ; Blanc ne peut pas reprendre en `reprise` tout de suite, mais peut après un échange ailleurs. */
  | { ko: string; reprise: string }
  /** Noir joue `coup` : au moins deux groupes blancs n'ont plus qu'une liberté. */
  | { doubleAtari: string }
  /** Noir au trait capture `cible` par une échelle, qui commence par `coup`. */
  | { echelle: string; coup: string }
  /** Après le coup de Noir en `coup`, `cible` n'est pas en atari mais ne peut plus se sauver (filet). */
  | { filet: string; coup: string }
  /** Noir donne une pierre en `sacrifice`, Blanc la prend en `prise`, Noir reprend aussitôt plusieurs pierres. */
  | { priseEnRetour: string; prise: string }
  /** Le groupe de `groupe` a deux vrais yeux, `yeux` : ce sont ses seules libertés, et Blanc ne peut jouer dans aucun. */
  | { vivant: string; yeux: [string, string] }
  /** `point` semble un œil, mais ses voisins noirs forment au moins deux groupes, dont un n'a que ce point comme liberté. */
  | { fauxOeil: string }
  /** Les groupes de `pierres` sont en seki, et les points `neutres` ne comptent pour personne. */
  | { seki: string[]; neutres: string[] }
  /** Comptage (sans pierres mortes, ou avec `morts`) : totaux de Noir et de Blanc, komi compris. */
  | { score: { regle: Rules; komi: number; noir: number; blanc: number; morts?: string[] } }
  /** `point` est un point neutre (dame) : il ne compte pour personne. */
  | { neutre: string }
  /** Hane : `coup` est en diagonale de la pierre `de`, au contact de la pierre adverse `contre`, elle-même voisine de `de`. */
  | { hane: string; de: string; contre: string }
  /** Les points `points` sont les hoshi, où vont les pierres de handicap (5 pierres sur 9 × 9). */
  | { hoshi: string[] };

export interface Schema {
  rows: string[];
  /** Points verts (libertés, yeux). */
  libs?: string[];
  /** Pierres menacées, cerclées de rouge. */
  cibles?: string[];
  /** Le coup à jouer, cerclé de jade. */
  coup?: string;
  /** Un point interdit ou trompeur, barré de rouge. */
  interdit?: string;
  /** Territoires dessinés (comptage japonais, komi sans effet sur le dessin). */
  territoire?: boolean;
  /** Pierres mortes, grisées et comptées comme prisonniers. */
  morts?: string[];
  preuves: Preuve[];
}

// --- Les règles en 5 cartes -------------------------------------------------------------------------------

export const IDS_REGLES = ['poser', 'capturer', 'suicide', 'ko', 'fin'] as const;
export type IdRegle = (typeof IDS_REGLES)[number];

export interface Carte<I extends string> { id: I; schema?: Schema; lecon?: string }

const CAPTURE: Schema = {
  rows: ['.....', '..X..', '.XO..', '..X..', '.....'],
  libs: ['D3'], coup: 'D3',
  preuves: [{ libertes: 'C3', n: 1 }, { prend: 'D3', par: 1, n: 1 }],
};

const KO: Schema = {
  rows: ['.....', '.XO..', 'XO.O.', '.XO..', '.....'],
  coup: 'C3', cibles: ['B3'],
  preuves: [{ ko: 'C3', reprise: 'B3' }],
};

const SUICIDE: Schema = {
  rows: ['.....', '..O..', '.O.O.', '..O..', '.....'],
  interdit: 'C3',
  preuves: [{ suicide: 'C3', par: 1 }],
};

/** Fin de partie : Noir 10 points de territoire, Blanc 5 plus 6,5 de komi. */
const FIN: Schema = {
  rows: ['..XO.', '..XO.', '..XO.', '..XO.', '..XO.'],
  territoire: true,
  preuves: [
    { score: { regle: 'japanese', komi: 6.5, noir: 10, blanc: 11.5 } },
    { score: { regle: 'chinese', komi: 7.5, noir: 15, blanc: 17.5 } },
  ],
};

export const REGLES: Carte<IdRegle>[] = [
  { id: 'poser', lecon: 'l1', schema: { rows: ['.....', '.X...', '..O..', '...X.', '.....'], coup: 'B2', preuves: [{ permis: 'B2', par: 2 }] } },
  { id: 'capturer', lecon: 'l1', schema: CAPTURE },
  { id: 'suicide', schema: SUICIDE },
  { id: 'ko', lecon: 'l4', schema: KO },
  { id: 'fin', lecon: 'l7', schema: FIN },
];

// --- Comment on compte ? ----------------------------------------------------------------------------------

export const IDS_COMPTER = ['territoire', 'prisonniers', 'morts', 'komi', 'regles'] as const;
export type IdCompter = (typeof IDS_COMPTER)[number];

/** Un point neutre (C3) entre les deux murs. */
const NEUTRE: Schema = {
  rows: ['.XO..', '.XO..', '.X.O.', '.XO..', '.XO..'],
  territoire: true, interdit: 'C3',
  preuves: [{ neutre: 'C3' }, { score: { regle: 'japanese', komi: 0, noir: 5, blanc: 9 } }],
};

/** Une pierre blanche morte chez Noir : retirée, elle compte comme un prisonnier. */
const MORTS: Schema = {
  rows: ['..XO.', '..XO.', 'O.XO.', '..XO.', '..XO.'],
  territoire: true, morts: ['A3'],
  preuves: [{ score: { regle: 'japanese', komi: 6.5, noir: 11, blanc: 11.5, morts: ['A3'] } }],
};

export const COMPTER: Carte<IdCompter>[] = [
  { id: 'territoire', lecon: 'l6', schema: NEUTRE },
  { id: 'prisonniers', lecon: 'l1', schema: CAPTURE },
  { id: 'morts', lecon: 'l15', schema: MORTS },
  { id: 'komi', lecon: 'l16' },
  { id: 'regles', lecon: 'l16', schema: FIN },
];

// --- Glossaire ----------------------------------------------------------------------------------------------

export const IDS_MOTS = [
  'liberte', 'atari', 'groupe', 'prisonnier', 'suicide', 'ko', 'superko', 'oeil', 'fauxOeil', 'pointVital', 'seki',
  'territoire', 'dame', 'pierresMortes', 'komi', 'passe', 'handicap', 'hoshi', 'kyuDan',
  'doubleAtari', 'echelle', 'filet', 'priseEnRetour', 'semeai', 'hane', 'senteGote', 'tesuji', 'joseki',
  'sanSan', 'komoku', 'kakari', 'tsuke', 'kosumi', 'watari',
] as const;
export type IdMot = (typeof IDS_MOTS)[number];

export interface Mot { id: IdMot; schema?: Schema; lecon?: string }

export const MOTS: Mot[] = [
  { id: 'liberte', lecon: 'l1', schema: { rows: ['.....', '.....', '..X..', '.....', '.....'], libs: ['C4', 'B3', 'D3', 'C2'], preuves: [{ libertes: 'C3', n: 4 }] } },
  { id: 'atari', lecon: 'l2', schema: { rows: ['.....', '..XX.', '.XOO.', '..XX.', '.....'], libs: ['E3'], cibles: ['C3', 'D3'], preuves: [{ libertes: 'C3', n: 1 }, { prend: 'E3', par: 1, n: 2 }] } },
  { id: 'groupe', lecon: 'l1', schema: { rows: ['.....', '.XX..', '..X..', '...X.', '.....'], preuves: [{ groupe: 'B4', taille: 3, hors: 'D2' }, { libertes: 'B4', n: 7 }] } },
  { id: 'prisonnier', lecon: 'l1', schema: CAPTURE },
  { id: 'suicide', schema: SUICIDE },
  { id: 'ko', lecon: 'l4', schema: KO },
  { id: 'superko', lecon: 'l4' },
  { id: 'oeil', lecon: 'l5', schema: { rows: ['.....', 'OOOOO', 'XXXXO', 'X.X.X', 'XXXXX'], libs: ['B2', 'D2'], preuves: [{ vivant: 'A1', yeux: ['B2', 'D2'] }] } },
  { id: 'fauxOeil', lecon: 'l12', schema: { rows: ['.....', 'OOOOO', 'XXXXO', 'X.XOO', 'XX.XO'], interdit: 'C1', cibles: ['D1'], preuves: [{ fauxOeil: 'C1' }] } },
  { id: 'pointVital', lecon: 'l13' },
  { id: 'seki', lecon: 'l14', schema: { rows: ['.OX.OX.', '.OX.OX.', ...Array<string>(5).fill('.OXXOX.')], interdit: 'D7', preuves: [{ seki: ['C1', 'E1'], neutres: ['D7', 'D6'] }] } },
  { id: 'territoire', lecon: 'l6', schema: FIN },
  { id: 'dame', lecon: 'l15', schema: NEUTRE },
  { id: 'pierresMortes', lecon: 'l15', schema: MORTS },
  { id: 'komi', lecon: 'l7' },
  { id: 'passe', lecon: 'l7' },
  { id: 'handicap', schema: { rows: ['.........', '.........', '..X...X..', '.........', '....X....', '.........', '..X...X..', '.........', '.........'], preuves: [{ hoshi: ['C3', 'G3', 'C7', 'G7', 'E5'] }] } },
  { id: 'hoshi', schema: { rows: Array<string>(9).fill('.........'), libs: ['C3', 'G3', 'C7', 'G7', 'E5'], preuves: [{ hoshi: ['C3', 'G3', 'C7', 'G7', 'E5'] }] } },
  { id: 'kyuDan' },
  { id: 'doubleAtari', lecon: 'l3', schema: { rows: ['.....', '.XOX.', '...OX', '.....', '.....'], coup: 'C3', preuves: [{ doubleAtari: 'C3' }] } },
  { id: 'echelle', lecon: 'l3', schema: { rows: ['.....X.', '....XO.', '......X', '.......', '.......', '.......', '.......'], coup: 'G6', cibles: ['F6'], preuves: [{ echelle: 'F6', coup: 'G6' }] } },
  { id: 'filet', lecon: 'l9', schema: { rows: ['.......', '...X...', '.......', '.X.OX..', '...X...', '.......', '.......'], coup: 'C5', cibles: ['D4'], preuves: [{ filet: 'D4', coup: 'C5' }] } },
  { id: 'priseEnRetour', lecon: 'l10', schema: { rows: ['.....', '.....', 'XXXX.', 'OOOX.', '..OX.'], coup: 'B1', cibles: ['A2', 'B2', 'C2', 'C1'], preuves: [{ priseEnRetour: 'B1', prise: 'A1' }] } },
  { id: 'semeai', lecon: 'l11' },
  { id: 'hane', lecon: 'l23', schema: { rows: ['.....', '.....', '..XO.', '.....', '.....'], coup: 'D4', preuves: [{ hane: 'D4', de: 'C3', contre: 'D3' }, { permis: 'D4', par: 1 }] } },
  { id: 'senteGote', lecon: 'l22' },
  { id: 'tesuji', lecon: 'l10' },
  { id: 'joseki' },
  // #16 : vocabulaire des leçons de joseki (l30, l31).
  { id: 'sanSan', lecon: 'l30' },
  { id: 'komoku', lecon: 'l31' },
  { id: 'kakari', lecon: 'l31' },
  { id: 'tsuke', lecon: 'l31' },
  { id: 'kosumi', lecon: 'l31' },
  // #16 : relier par en dessous (l33).
  { id: 'watari', lecon: 'l33' },
];

/**
 * Autres façons de chercher un mot (synonymes, mot japonais ou anglais). Ce sont des données du glossaire,
 * pas des textes affichés : la recherche les lit, l'écran ne les montre pas.
 */
export const AUSSI: Record<'fr' | 'en', Partial<Record<IdMot, string[]>>> = {
  fr: {
    liberte: ['libertés'], groupe: ['chaîne', 'chaine'], prisonnier: ['capture', 'capturer', 'prendre'],
    oeil: ['yeux', 'vivant', 'vie'], fauxOeil: ['faux yeux'], pointVital: ['vital', 'oki'], dame: ['point neutre', 'neutre'],
    pierresMortes: ['mort', 'morte'], passe: ['passer'], kyuDan: ['kyu', 'dan', 'grade', 'niveau', 'rang'],
    echelle: ['shicho'], filet: ['geta'], priseEnRetour: ['snapback'], semeai: ['course aux libertés'],
    senteGote: ['sente', 'gote', 'initiative'], territoire: ['points', 'compter'], komi: ['points'],
    sanSan: ['3-3', 'san san', 'invasion'], komoku: ['3-4'], kakari: ['approche'], tsuke: ['contact', 'coller'], kosumi: ['diagonale'],
    watari: ['relier par en dessous', 'premier rang'],
  },
  en: {
    liberte: ['liberties'], groupe: ['chain', 'string'], prisonnier: ['capture', 'captures'],
    oeil: ['eyes', 'alive', 'life'], fauxOeil: ['false eyes'], pointVital: ['vital', 'oki'], dame: ['neutral point'],
    pierresMortes: ['dead'], passe: ['passing'], kyuDan: ['kyu', 'dan', 'rank', 'grade'],
    echelle: ['shicho'], filet: ['geta'], priseEnRetour: ['snapback'], semeai: ['capturing race'],
    senteGote: ['sente', 'gote', 'initiative'], territoire: ['points', 'scoring'], komi: ['points'],
    sanSan: ['3-3', 'san san', 'invasion'], komoku: ['3-4'], kakari: ['approach'], tsuke: ['contact', 'attach'], kosumi: ['diagonal'],
    watari: ['connect underneath', 'bridge', 'first line'],
  },
};

// --- Questions fréquentes -------------------------------------------------------------------------------------

/** Questions sur l'appli (pas sur le go) : compte, série, gel, hors ligne, suppression du compte. Textes seuls. */
export const IDS_QUESTIONS = ['compte', 'serie', 'gel', 'horsLigne', 'supprimer'] as const;
export type IdQuestion = (typeof IDS_QUESTIONS)[number];

export type Fiche = 'regles' | 'compter' | 'mots' | 'questions';
