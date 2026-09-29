// Conseil de Mochi (#80) : chaque position fixe donne la phrase et la zone attendues, et aucune phrase fausse.
import { conseil, MODELES, phraseConseil, reglesCoin, type ConseilMochi, type ModeleConseil, type OptionsConseil } from './conseil';
import { fromRows } from '../go/position';
import { fromLabel, toLabel } from '../go/coords';
import { boardKey, groupAt, newPosition, play, type Color, type Position } from '../go/rules';
import { hasTwoEyes } from '../go/tactics';
import { traduire } from '../content/i18n';

/** Plateau `n` × `n` avec des pierres données en coordonnées affichées. */
function plateau(n: number, noirs: string[], blancs: string[], trait: Color = 1): Position {
  const pos = newPosition(n);
  for (const l of noirs) pos.board[fromLabel(l, n)] = 1;
  for (const l of blancs) pos.board[fromLabel(l, n)] = 2;
  pos.toPlay = trait;
  return pos;
}
const labels = (c: ConseilMochi | null, n: number) => (c ? c.zone.map(p => toLabel(p, n)).sort() : []);

interface Fixture {
  nom: string;
  pos: Position;
  options?: OptionsConseil;
  attendu: null | { modele: ModeleConseil; point: string | null; zone: string[]; fr: string };
  /** Modèles qui seraient faux ici (vérifié en plus de l'attendu). */
  jamais?: ModeleConseil[];
}

/** Propriété 9 × 9 : colonne E neutre, Noir à gauche, Blanc à droite. */
const proprieteColonneE = Float32Array.from({ length: 81 }, (_, p) => (p % 9 < 4 ? 0.9 : p % 9 > 4 ? -0.9 : 0));
const huitPierresHorsE = { noirs: ['C3', 'C5', 'C7', 'B4'], blancs: ['G3', 'G5', 'G7', 'H4'] };

const koE5 = () => { const p = plateau(9, ['C5', 'D6', 'D4'], ['D5', 'E6', 'F5', 'E4']); p.ko = fromLabel('E5', 9); return p; };
const atariBlancE5 = () => plateau(9, ['D5', 'F5', 'E6'], ['E5']);

const fixtures: Fixture[] = [
  // 1. Atari du joueur
  { nom: 'pierre noire en atari au centre, qui peut s’allonger', pos: plateau(9, ['E5'], ['E6', 'D5', 'F5']),
    attendu: { modele: 'atari-joueur', point: 'E5', zone: ['E4', 'E5'], fr: "Ton groupe en E5 n'a plus qu'une liberté : sauve-le." } },
  { nom: 'deux pierres noires en atari au bord', pos: plateau(9, ['C1', 'D1'], ['B1', 'E1', 'C2']),
    attendu: { modele: 'atari-joueur', point: 'D1', zone: ['C1', 'D1', 'D2'], fr: "Ton groupe en D1 n'a plus qu'une liberté : sauve-le." } },
  { nom: 'le plus gros groupe en atari est nommé', pos: plateau(9, ['C1', 'D1', 'B8'], ['B1', 'E1', 'C2', 'A8', 'C8', 'B9']),
    attendu: { modele: 'atari-joueur', point: 'D1', zone: ['C1', 'D1', 'D2'], fr: "Ton groupe en D1 n'a plus qu'une liberté : sauve-le." } },
  { nom: 'sauvetage par capture : s’allonger serait un suicide', pos: plateau(9, ['E5', 'D6', 'F6'], ['E6', 'D5', 'F5', 'D4', 'F4', 'E3']),
    attendu: { modele: 'atari-joueur', point: 'E5', zone: ['E4', 'E5'], fr: "Ton groupe en E5 n'a plus qu'une liberté : sauve-le." } },
  { nom: 'atari du joueur avant atari adverse (priorité fixe)', pos: plateau(9, ['E5', 'A8', 'C8', 'B9'], ['E6', 'D5', 'F5', 'B8']),
    attendu: { modele: 'atari-joueur', point: 'E5', zone: ['E4', 'E5'], fr: "Ton groupe en E5 n'a plus qu'une liberté : sauve-le." } },
  { nom: 'Blanc au trait : sa pierre en atari', pos: plateau(9, ['E6', 'D5', 'F5'], ['E5'], 2),
    attendu: { modele: 'atari-joueur', point: 'E5', zone: ['E4', 'E5'], fr: "Ton groupe en E5 n'a plus qu'une liberté : sauve-le." } },
  { nom: 'atari du joueur sans sauvetage (coin) : pas de « sauve-le »', pos: plateau(9, ['A1', 'C5', 'D5', 'E5', 'F5'], ['B1', 'B2', 'G5']),
    attendu: null, jamais: ['atari-joueur'] },
  { nom: 'atari du joueur sans sauvetage, avec un coin libre : on passe au modèle suivant', pos: plateau(9, ['A1'], ['B1', 'B2']),
    attendu: { modele: 'coin-libre', point: null, zone: ['F6', 'F7', 'G6', 'G7'], fr: "Un coin est encore libre : les coins d'abord." }, jamais: ['atari-joueur'] },
  { nom: 'atari du joueur, échelle perdue : pas de « sauve-le »',
    pos: plateau(9, ['C7', 'B5', 'H2', 'H3', 'J4'], ['C8', 'B7', 'D7', 'C6', 'D5']), // Noir C7 entouré, la seule sortie est prise
    attendu: null, jamais: ['atari-joueur'] },

  // 2. Atari de l'adversaire
  { nom: 'pierre blanche à prendre', pos: atariBlancE5(),
    attendu: { modele: 'atari-adverse', point: 'E4', zone: ['E4', 'E5'], fr: "Tu peux prendre en E4 : sa pierre n'a plus qu'une liberté." } },
  { nom: 'deux pierres blanches à prendre', pos: plateau(9, ['C5', 'D6', 'E6', 'D4', 'E4'], ['D5', 'E5']),
    attendu: { modele: 'atari-adverse', point: 'F5', zone: ['D5', 'E5', 'F5'], fr: "Tu peux prendre en F5 : ses pierres n'ont plus qu'une liberté." } },
  { nom: 'le plus gros groupe à prendre est choisi', pos: plateau(9, ['C5', 'D6', 'E6', 'D4', 'E4', 'A8', 'C8', 'B9'], ['D5', 'E5', 'B8']),
    attendu: { modele: 'atari-adverse', point: 'F5', zone: ['D5', 'E5', 'F5'], fr: "Tu peux prendre en F5 : ses pierres n'ont plus qu'une liberté." } },
  { nom: 'prise interdite par le ko : pas de « tu peux prendre »', pos: koE5(), attendu: null, jamais: ['atari-adverse'] },
  { nom: 'même forme sans ko : la prise est permise', pos: { ...koE5(), ko: -1 },
    attendu: { modele: 'atari-adverse', point: 'E5', zone: ['D5', 'E5'], fr: "Tu peux prendre en E5 : sa pierre n'a plus qu'une liberté." } },
  { nom: 'prise interdite par le superko : on passe au modèle suivant', pos: atariBlancE5(),
    options: { dejaVues: new Set([boardKey((play(atariBlancE5(), fromLabel('E4', 9)) as Position).board)]) },
    attendu: { modele: 'coin-libre', point: null, zone: ['F6', 'F7', 'G6', 'G7'], fr: "Un coin est encore libre : les coins d'abord." }, jamais: ['atari-adverse'] },
  { nom: 'deux groupes blancs en atari : le plus gros, dans un point entouré', pos: plateau(9, ['B1', 'A3', 'B2', 'C1', 'D2', 'D3', 'C4'], ['A1', 'C2', 'C3']),
    attendu: { modele: 'atari-adverse', point: 'B3', zone: ['B3', 'C2', 'C3'], fr: "Tu peux prendre en B3 : ses pierres n'ont plus qu'une liberté." } },
  { nom: 'Noir au trait : Blanc a un groupe en atari, Blanc au trait ne le « prend » pas', pos: plateau(9, ['D5', 'F5', 'E6'], ['E5'], 2),
    attendu: { modele: 'atari-joueur', point: 'E5', zone: ['E4', 'E5'], fr: "Ton groupe en E5 n'a plus qu'une liberté : sauve-le." }, jamais: ['atari-adverse'] },
  { nom: 'Blanc au trait peut prendre une pierre noire', pos: plateau(9, ['E5'], ['E6', 'D5', 'F5'], 2),
    attendu: { modele: 'atari-adverse', point: 'E4', zone: ['E4', 'E5'], fr: "Tu peux prendre en E4 : sa pierre n'a plus qu'une liberté." } },

  // 3. Peu de libertés
  { nom: 'pierre au bord à deux libertés, menacée', pos: plateau(9, ['B1'], ['B2']),
    attendu: { modele: 'peu-de-libertes', point: 'B1', zone: ['A1', 'B1', 'C1'], fr: "Ton groupe en B1 a peu de libertés : donne-lui de l'air." } },
  { nom: 'même forme en 19 × 19', pos: plateau(19, ['B1'], ['B2']),
    attendu: { modele: 'peu-de-libertes', point: 'B1', zone: ['A1', 'B1', 'C1'], fr: "Ton groupe en B1 a peu de libertés : donne-lui de l'air." } },
  { nom: 'deux libertés mais deux yeux : aucune menace (seulement : ne remplis pas ton œil)', pos: plateau(9, ['A2', 'B2', 'C2', 'D2', 'B1', 'D1'], ['A3', 'B3', 'C3', 'D3', 'E2', 'E1']),
    attendu: { modele: 'coup-a-eviter', point: 'A1', zone: ['A1', 'A2', 'B1', 'B2', 'C2', 'D1', 'D2'], fr: 'Ne joue pas en A1 : tes pierres seraient en atari, prêtes à être prises.' }, jamais: ['atari-joueur', 'peu-de-libertes'] },
  { nom: 'deux libertés mais déjà perdu : pas de « donne-lui de l’air »', pos: plateau(9, ['B1'], ['A2', 'B2', 'C2']),
    attendu: { modele: 'coin-libre', point: null, zone: ['F6', 'F7', 'G6', 'G7'], fr: "Un coin est encore libre : les coins d'abord." }, jamais: ['atari-joueur', 'peu-de-libertes'] },
  { nom: 'deux libertés vers le large : pas menacé', pos: plateau(9, ['E5', 'B2', 'H2', 'H8', 'B7'], ['E6', 'D5', 'C7']),
    attendu: null, jamais: ['atari-joueur', 'peu-de-libertes'] },
  { nom: 'trois libertés : ni atari ni « peu de libertés »', pos: plateau(9, ['E5', 'B2', 'H2', 'H8', 'B7'], ['E6', 'D8']),
    attendu: null, jamais: ['atari-joueur', 'peu-de-libertes'] },

  // 4. Coins libres
  { nom: '9 × 9 vide : coin en haut à droite', pos: newPosition(9),
    attendu: { modele: 'coin-libre', point: null, zone: ['F6', 'F7', 'G6', 'G7'], fr: "Un coin est encore libre : les coins d'abord." } },
  { nom: '13 × 13 vide', pos: newPosition(13),
    attendu: { modele: 'coin-libre', point: null, zone: ['K10', 'K11', 'L10', 'L11'], fr: "Un coin est encore libre : les coins d'abord." } },
  { nom: '19 × 19 vide', pos: newPosition(19),
    attendu: { modele: 'coin-libre', point: null, zone: ['Q16', 'Q17', 'R16', 'R17'], fr: "Un coin est encore libre : les coins d'abord." } },
  { nom: '19 × 19 : coin en haut à droite pris, on montre celui en bas à gauche', pos: plateau(19, ['Q16'], [], 2),
    attendu: { modele: 'coin-libre', point: null, zone: ['C3', 'C4', 'D3', 'D4'], fr: "Un coin est encore libre : les coins d'abord." } },
  { nom: '19 × 19 : puis en bas à droite', pos: plateau(19, ['Q16'], ['D4']),
    attendu: { modele: 'coin-libre', point: null, zone: ['Q3', 'Q4', 'R3', 'R4'], fr: "Un coin est encore libre : les coins d'abord." } },
  { nom: '19 × 19 : les quatre coins pris, aucun conseil sans propriété', pos: plateau(19, ['Q16', 'D4'], ['D16', 'Q4']),
    attendu: null, jamais: ['coin-libre'] },
  { nom: '9 × 9 : une pierre sur le 3-3 suffit à occuper le coin', pos: plateau(9, ['G7'], [], 2),
    attendu: { modele: 'coin-libre', point: null, zone: ['C3', 'C4', 'D3', 'D4'], fr: "Un coin est encore libre : les coins d'abord." } },
  { nom: '9 × 9 : trop de pierres, ce n’est plus le début', pos: plateau(9, ['C3', 'C5', 'C7', 'E5'], ['G3', 'G5', 'E7']),
    attendu: null, jamais: ['coin-libre'] },
  { nom: '7 × 7 : pas de modèle de coin', pos: newPosition(7), attendu: null, jamais: ['coin-libre'] },

  // 5. Zone à prendre (propriété KataGo)
  { nom: 'colonne E neutre', pos: plateau(9, huitPierresHorsE.noirs, huitPierresHorsE.blancs), options: { propriete: proprieteColonneE },
    attendu: { modele: 'zone-a-prendre', point: 'E5', zone: ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9'], fr: 'La zone en E5 est encore à prendre.' } },
  { nom: 'la plus grande des deux zones neutres', pos: plateau(9, huitPierresHorsE.noirs, huitPierresHorsE.blancs),
    options: { propriete: Float32Array.from({ length: 81 }, (_, p) => ((p % 9 === 0 && p < 45) || (p % 9 === 8 && p < 27) ? 0.1 : 0.95)) },
    attendu: { modele: 'zone-a-prendre', point: 'A7', zone: ['A5', 'A6', 'A7', 'A8', 'A9'], fr: 'La zone en A7 est encore à prendre.' } },
  { nom: 'zone neutre trop petite (3 points)', pos: plateau(9, huitPierresHorsE.noirs, huitPierresHorsE.blancs),
    options: { propriete: Float32Array.from({ length: 81 }, (_, p) => (p === 0 || p === 1 || p === 2 ? 0 : -0.8)) }, attendu: null, jamais: ['zone-a-prendre'] },
  { nom: 'points neutres tous occupés : pas de zone', pos: plateau(9, huitPierresHorsE.noirs, huitPierresHorsE.blancs),
    options: { propriete: Float32Array.from({ length: 81 }, (_, p) => (['C3', 'C5', 'C7', 'B4', 'G3'].map(l => fromLabel(l, 9)).includes(p) ? 0 : 0.9)) },
    attendu: null, jamais: ['zone-a-prendre'] },
  { nom: 'propriété de mauvaise taille ignorée', pos: plateau(9, huitPierresHorsE.noirs, huitPierresHorsE.blancs), options: { propriete: new Float32Array(361) },
    attendu: null },
  { nom: 'l’atari passe avant la propriété', pos: plateau(9, ['E5', ...huitPierresHorsE.noirs], ['E6', 'D5', 'F5', ...huitPierresHorsE.blancs]),
    options: { propriete: proprieteColonneE },
    attendu: { modele: 'atari-joueur', point: 'E5', zone: ['E4', 'E5'], fr: "Ton groupe en E5 n'a plus qu'une liberté : sauve-le." } },
  { nom: 'le coin libre passe avant la propriété', pos: newPosition(9), options: { propriete: new Float32Array(81) },
    attendu: { modele: 'coin-libre', point: null, zone: ['F6', 'F7', 'G6', 'G7'], fr: "Un coin est encore libre : les coins d'abord." } },
];

// Positions tirées de l'ascii (lecture directe d'un diagramme), pour vérifier fromRows et l'ordre des coordonnées.
fixtures.push({
  nom: 'diagramme : groupe noir en atari au bord droit, déjà perdu',
  pos: fromRows([
    '.........',
    '.........',
    '.......O.',
    '......OX.',
    '......OXO',
    '.......O.',
    '.........',
    '.........',
    '.........',
  ]).pos,
  attendu: null, jamais: ['atari-joueur'],
});

// ---------- Modèles ajoutés (#80, suite) : au moins 5 positions positives par modèle, et des positions pièges ----------

/** Propriété `n` × `n` donnée par une fonction de (x, y), y depuis le haut. */
const propriete = (n: number, f: (x: number, y: number) => number) => Float32Array.from({ length: n * n }, (_, p) => f(p % n, Math.floor(p / n)));
const coups = (n: number, ...ls: string[]) => ls.map(l => fromLabel(l, n));
const lettres = (xs: string, lignes: number[]) => [...xs].flatMap(c => lignes.map(l => `${c}${l}`));

const UN_OEIL = "Ton groupe en B3 n'a qu'un œil (un trou fermé) : il en faut deux pour vivre.";
const oeilCoin = ['.........', '.........', '.........', '.........', '.........', 'OOOO.....', 'XXXO.....', 'X.X......', 'XXX......'];
const oeil13 = ['.............', '.............', '.............', '.............', '.............', '.............', '.............', '.............', '.............', '.....XXXX....', '.....OOOX....', '.....O.O.....', '.....OOO.....'];
const oeilHaut = ['....XXX..', '....X.X..', '....XXX..', '....OOO..', '.........', '.........', '.........', '.........', '.........'];
const deuxYeux = () => plateau(9, ['A2', 'B2', 'C2', 'D2', 'B1', 'D1'], ['A3', 'B3', 'C3', 'D3', 'E2', 'E1']);
const deuxYeuxBord = (n: number, trait: Color = 1) => {
  const [a, b] = trait === 1 ? [['E1', 'G1', 'J1', 'E2', 'F2', 'G2', 'H2', 'J2'], ['D1', 'D2', 'E3', 'F3', 'G3', 'H3', 'J3', 'K2', 'K1']] : [['D1', 'D2', 'E3', 'F3', 'G3', 'H3', 'J3', 'K2', 'K1'], ['E1', 'G1', 'J1', 'E2', 'F2', 'G2', 'H2', 'J2']];
  return plateau(n, a, b, trait);
};
const EVITER = (p: string) => `Ne joue pas en ${p} : tes pierres seraient en atari, prêtes à être prises.`;

// Zone à défendre : Noir tient la gauche, Blanc la droite ; si Blanc jouait, le bas à gauche basculerait.
const gaucheDroite = propriete(9, x => (x < 4 ? 0.9 : x > 4 ? -0.9 : 0));
const basGaucheBascule = propriete(9, (x, y) => (x < 4 && y >= 6 ? -0.6 : x < 4 ? 0.9 : x > 4 ? -0.9 : 0));
const basDroiteBascule = propriete(9, (x, y) => (x > 4 && y >= 6 ? 0.6 : x < 4 ? 0.9 : x > 4 ? -0.9 : 0));
const huit = () => plateau(9, huitPierresHorsE.noirs, huitPierresHorsE.blancs);
const ZONE_BG = lettres('ABCD', [1, 2, 3]);
const ZONE_BD = lettres('FGHJ', [1, 2, 3]);
const DEFENDRE = (p: string) => `Protège ta zone vers ${p} : ton adversaire pourrait la prendre.`;
const quatreCoins19 = () => plateau(19, ['D4', 'Q16'], ['D16', 'Q4']);

fixtures.push(
  // 4. Un seul œil
  { nom: 'un seul œil dans le coin, deux libertés dehors', pos: fromRows(oeilCoin).pos,
    attendu: { modele: 'un-seul-oeil', point: 'B3', zone: ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3'], fr: UN_OEIL } },
  { nom: 'un seul œil de deux points', pos: fromRows(['.........', '.........', '.........', '.........', '.........', 'OOOOO....', 'XXXXO....', 'X..X.....', 'XXXX.....']).pos,
    attendu: { modele: 'un-seul-oeil', point: 'B3', zone: ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3', 'D1', 'D2', 'D3'], fr: UN_OEIL } },
  { nom: 'un seul œil, Blanc au trait', pos: fromRows(oeilCoin.map(r => r.replace(/[XO]/g, c => (c === 'X' ? 'O' : 'X'))), 2).pos,
    attendu: { modele: 'un-seul-oeil', point: 'B3', zone: ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3'], fr: UN_OEIL } },
  { nom: 'un seul œil en 13 × 13, propriété incertaine', pos: fromRows(oeil13, 2).pos, options: { propriete: new Float32Array(169) },
    attendu: { modele: 'un-seul-oeil', point: 'G3', zone: ['F1', 'F2', 'F3', 'G1', 'G2', 'G3', 'H1', 'H2', 'H3'], fr: "Ton groupe en G3 n'a qu'un œil (un trou fermé) : il en faut deux pour vivre." } },
  { nom: 'un seul œil en haut, propriété incertaine', pos: fromRows(oeilHaut).pos, options: { propriete: new Float32Array(81).fill(0.2) },
    attendu: { modele: 'un-seul-oeil', point: 'F9', zone: ['E7', 'E8', 'E9', 'F7', 'F8', 'F9', 'G7', 'G8', 'G9'], fr: "Ton groupe en F9 n'a qu'un œil (un trou fermé) : il en faut deux pour vivre." } },
  { nom: 'un seul œil mais au large, sans propriété : pas « en danger »', pos: fromRows(oeilHaut).pos, attendu: null, jamais: ['un-seul-oeil'] },
  { nom: 'un seul œil, KataGo le dit vivant (relié ailleurs)', pos: fromRows(oeil13, 2).pos, options: { propriete: new Float32Array(169).fill(-0.9) },
    attendu: null, jamais: ['un-seul-oeil'] },
  { nom: 'un seul œil, KataGo le dit déjà mort', pos: fromRows(oeil13, 2).pos, options: { propriete: new Float32Array(169).fill(0.9) },
    attendu: null, jamais: ['un-seul-oeil'] },
  { nom: 'faux œil au bord : ce n’est pas un œil', pos: fromRows(['.........', '.........', '.........', '.........', '.........', '.........', 'XX.......', 'XXO......', 'X.X......']).pos,
    jamais: ['un-seul-oeil'], attendu: null },
  { nom: 'deux yeux : jamais « un seul œil »', pos: deuxYeux(), jamais: ['un-seul-oeil'],
    attendu: { modele: 'coup-a-eviter', point: 'A1', zone: ['A1', 'A2', 'B1', 'B2', 'C2', 'D1', 'D2'], fr: EVITER('A1') } },
  { nom: 'une seule liberté dehors : plus la place pour un deuxième œil', pos: fromRows(['.........', '.........', '.........', '.........', '.........', '.OOOO....', 'OXXXXO...', 'OX..XO...', '.XXXXO...']).pos,
    attendu: null, jamais: ['un-seul-oeil'] },

  // 5. Zone à défendre (propriété avant et après un coup de l'adversaire)
  { nom: 'le bas à gauche basculerait : défendre vers la menace', pos: huit(),
    options: { propriete: gaucheDroite, proprieteSiTuPasses: basGaucheBascule, coups: coups(9, 'D2'), menace: fromLabel('D2', 9) },
    attendu: { modele: 'zone-a-defendre', point: 'D2', zone: ZONE_BG, fr: DEFENDRE('D2') } },
  { nom: 'menace loin de la zone : on nomme le centre de la zone', pos: huit(),
    options: { propriete: gaucheDroite, proprieteSiTuPasses: basGaucheBascule, coups: coups(9, 'C2'), menace: fromLabel('H8', 9) },
    attendu: { modele: 'zone-a-defendre', point: 'B2', zone: ZONE_BG, fr: DEFENDRE('B2') } },
  { nom: 'Blanc au trait : le bas à droite basculerait', pos: { ...huit(), toPlay: 2 },
    options: { propriete: gaucheDroite, proprieteSiTuPasses: basDroiteBascule, coups: coups(9, 'G2'), menace: fromLabel('G2', 9) },
    attendu: { modele: 'zone-a-defendre', point: 'G2', zone: ZONE_BD, fr: DEFENDRE('G2') } },
  { nom: '19 × 19 : le coin en bas à gauche basculerait', pos: quatreCoins19(),
    options: { propriete: propriete(19, x => (x < 9 ? 0.8 : -0.8)), proprieteSiTuPasses: propriete(19, (x, y) => (x < 9 && y >= 14 ? -0.5 : x < 9 ? 0.8 : -0.8)),
      coups: coups(19, 'C6'), menace: fromLabel('C3', 19) },
    attendu: { modele: 'zone-a-defendre', point: 'C3', zone: lettres('ABCDEFGHJ', [1, 2, 3, 4, 5]), fr: DEFENDRE('C3') } },
  { nom: '13 × 13 : le haut à gauche basculerait', pos: plateau(13, ['D10', 'D4'], ['K10', 'K4']),
    options: { propriete: propriete(13, x => (x < 6 ? 0.7 : x > 6 ? -0.7 : 0)), proprieteSiTuPasses: propriete(13, (x, y) => (x < 6 && y < 3 ? -0.4 : x < 6 ? 0.7 : x > 6 ? -0.7 : 0)),
      coups: coups(13, 'C12'), menace: fromLabel('C11', 13) },
    attendu: { modele: 'zone-a-defendre', point: 'C11', zone: lettres('ABCDEF', [11, 12, 13]), fr: DEFENDRE('C11') } },
  { nom: 'KataGo joue ailleurs : pas de « protège »', pos: huit(),
    options: { propriete: gaucheDroite, proprieteSiTuPasses: basGaucheBascule, coups: coups(9, 'H8'), menace: fromLabel('D2', 9) },
    attendu: { modele: 'zone-a-prendre', point: 'E5', zone: lettres('E', [1, 2, 3, 4, 5, 6, 7, 8, 9]), fr: 'La zone en E5 est encore à prendre.' }, jamais: ['zone-a-defendre'] },
  { nom: 'zone qui bascule trop petite (2 points)', pos: huit(),
    options: { propriete: gaucheDroite, proprieteSiTuPasses: propriete(9, (x, y) => (x === 3 && y >= 7 ? -0.6 : x < 4 ? 0.9 : x > 4 ? -0.9 : 0)), coups: coups(9, 'D2') },
    attendu: { modele: 'zone-a-prendre', point: 'E5', zone: lettres('E', [1, 2, 3, 4, 5, 6, 7, 8, 9]), fr: 'La zone en E5 est encore à prendre.' }, jamais: ['zone-a-defendre'] },
  { nom: 'sans l’analyse « si tu passes » : pas de zone à défendre', pos: huit(), options: { propriete: gaucheDroite, coups: coups(9, 'D2') },
    attendu: { modele: 'zone-a-prendre', point: 'E5', zone: lettres('E', [1, 2, 3, 4, 5, 6, 7, 8, 9]), fr: 'La zone en E5 est encore à prendre.' }, jamais: ['zone-a-defendre'] },
  { nom: 'le bord basculerait mais ce sont les pierres adverses : rien à défendre', pos: huit(),
    options: { propriete: propriete(9, () => -0.9), proprieteSiTuPasses: propriete(9, () => -0.9), coups: coups(9, 'D2') }, attendu: null, jamais: ['zone-a-defendre'] },

  // 6. Coup à éviter (auto-atari)
  { nom: 'remplir son propre œil (coin)', pos: deuxYeux(),
    attendu: { modele: 'coup-a-eviter', point: 'A1', zone: ['A1', 'A2', 'B1', 'B2', 'C2', 'D1', 'D2'], fr: EVITER('A1') } },
  { nom: 'A1 est un coup de KataGo : on montre l’autre œil', pos: deuxYeux(), options: { coups: coups(9, 'A1') },
    attendu: { modele: 'coup-a-eviter', point: 'C1', zone: ['A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2'], fr: EVITER('C1') } },
  { nom: 'les deux yeux sont des coups de KataGo : aucun « ne joue pas »', pos: deuxYeux(), options: { coups: coups(9, 'A1', 'C1') },
    attendu: null, jamais: ['coup-a-eviter'] },
  { nom: 'remplir son œil sur le bord, 13 × 13', pos: deuxYeuxBord(13),
    attendu: { modele: 'coup-a-eviter', point: 'F1', zone: ['E1', 'E2', 'F1', 'F2', 'G1', 'G2', 'H2', 'J1', 'J2'], fr: EVITER('F1') } },
  { nom: 'remplir son œil sur le bord, 19 × 19', pos: deuxYeuxBord(19),
    attendu: { modele: 'coup-a-eviter', point: 'F1', zone: ['E1', 'E2', 'F1', 'F2', 'G1', 'G2', 'H2', 'J1', 'J2'], fr: EVITER('F1') } },
  { nom: 'remplir son œil, Blanc au trait', pos: deuxYeuxBord(13, 2),
    attendu: { modele: 'coup-a-eviter', point: 'F1', zone: ['E1', 'E2', 'F1', 'F2', 'G1', 'G2', 'H2', 'J1', 'J2'], fr: EVITER('F1') } },
  { nom: 'une seule pierre en atari après le coup : pas de « ne joue pas » (moins de deux pierres)', pos: plateau(9, ['E5'], ['E6', 'D5']),
    attendu: { modele: 'coin-libre', point: null, zone: ['F6', 'F7', 'G6', 'G7'], fr: "Un coin est encore libre : les coins d'abord." }, jamais: ['coup-a-eviter'] },

  // 7. Grand coup (meilleur coup de KataGo dans un coin ou sur un bord encore vide)
  { nom: '9 × 9 vide, KataGo joue C3 : coin en bas à gauche', pos: newPosition(9), options: { coups: coups(9, 'C3') },
    attendu: { modele: 'grand-coup', point: null, zone: lettres('ABCDE', [1, 2, 3, 4, 5]), fr: 'Le plus grand coup est dans le coin en bas à gauche, encore vide.' } },
  { nom: '19 × 19, KataGo joue Q16 : coin en haut à droite', pos: plateau(19, ['D4'], ['D16']), options: { coups: coups(19, 'Q16') },
    attendu: { modele: 'grand-coup', point: null, zone: lettres('OPQRS', [14, 15, 16, 17, 18]), fr: 'Le plus grand coup est dans le coin en haut à droite, encore vide.' } },
  { nom: '19 × 19, quatre coins pris, KataGo joue K4 : bord du bas', pos: quatreCoins19(), options: { coups: coups(19, 'K4') },
    attendu: { modele: 'grand-coup', point: null, zone: lettres('HJKLM', [2, 3, 4, 5, 6]), fr: 'Le plus grand coup est sur le bord du bas, encore vide.' } },
  { nom: '19 × 19, KataGo joue C10 : bord de gauche', pos: quatreCoins19(), options: { coups: coups(19, 'C10') },
    attendu: { modele: 'grand-coup', point: null, zone: lettres('ABCDE', [8, 9, 10, 11, 12]), fr: 'Le plus grand coup est sur le bord de gauche, encore vide.' } },
  { nom: '13 × 13, KataGo joue K10 : coin en haut à droite', pos: plateau(13, ['D4'], ['D10']), options: { coups: coups(13, 'K10') },
    attendu: { modele: 'grand-coup', point: null, zone: lettres('HJKLM', [8, 9, 10, 11, 12]), fr: 'Le plus grand coup est dans le coin en haut à droite, encore vide.' } },
  { nom: 'KataGo joue au centre : pas de « coin », on retombe sur le coin libre', pos: newPosition(9), options: { coups: coups(9, 'E5') },
    attendu: { modele: 'coin-libre', point: null, zone: ['F6', 'F7', 'G6', 'G7'], fr: "Un coin est encore libre : les coins d'abord." }, jamais: ['grand-coup'] },
  { nom: 'KataGo passe : pas de grand coup', pos: newPosition(9), options: { coups: [-1] },
    attendu: { modele: 'coin-libre', point: null, zone: ['F6', 'F7', 'G6', 'G7'], fr: "Un coin est encore libre : les coins d'abord." }, jamais: ['grand-coup'] },
  { nom: 'coin pas vide autour du coup : pas « encore vide »', pos: plateau(9, ['C3'], [], 1), options: { coups: coups(9, 'B4') },
    attendu: { modele: 'coin-libre', point: null, zone: ['F6', 'F7', 'G6', 'G7'], fr: "Un coin est encore libre : les coins d'abord." }, jamais: ['grand-coup'] },

  // Compléments : au moins 5 positions positives pour « peu de libertés » et « zone à prendre »
  { nom: 'peu de libertés : Blanc au trait', pos: plateau(9, ['B2'], ['B1'], 2),
    attendu: { modele: 'peu-de-libertes', point: 'B1', zone: ['A1', 'B1', 'C1'], fr: "Ton groupe en B1 a peu de libertés : donne-lui de l'air." } },
  { nom: 'peu de libertés : 13 × 13', pos: plateau(13, ['B1'], ['B2']),
    attendu: { modele: 'peu-de-libertes', point: 'B1', zone: ['A1', 'B1', 'C1'], fr: "Ton groupe en B1 a peu de libertés : donne-lui de l'air." } },
  { nom: 'peu de libertés : deux pierres au bord', pos: plateau(9, ['B1', 'C1'], ['B2', 'C2']),
    attendu: { modele: 'peu-de-libertes', point: 'B1', zone: ['A1', 'B1', 'C1', 'D1'], fr: "Ton groupe en B1 a peu de libertés : donne-lui de l'air." } },
  { nom: 'zone à prendre : ligne 6 neutre', pos: huit(), options: { propriete: propriete(9, (_, y) => (y === 3 ? 0 : y < 3 ? -0.9 : 0.9)) },
    attendu: { modele: 'zone-a-prendre', point: 'E6', zone: lettres('ABCDEFGHJ', [6]), fr: 'La zone en E6 est encore à prendre.' } },
  { nom: 'zone à prendre : Blanc au trait', pos: { ...huit(), toPlay: 2 }, options: { propriete: proprieteColonneE },
    attendu: { modele: 'zone-a-prendre', point: 'E5', zone: lettres('E', [1, 2, 3, 4, 5, 6, 7, 8, 9]), fr: 'La zone en E5 est encore à prendre.' } },
  { nom: 'zone à prendre : 19 × 19, quatre coins pris, centre neutre', pos: quatreCoins19(),
    options: { propriete: propriete(19, (x, y) => (Math.abs(x - 9) <= 1 && Math.abs(y - 9) <= 1 ? 0 : 0.8)) },
    attendu: { modele: 'zone-a-prendre', point: 'K10', zone: lettres('JKL', [9, 10, 11]), fr: 'La zone en K10 est encore à prendre.' } },
);

describe('Conseil de Mochi : positions fixes', () => {
  it('au moins 30 positions', () => expect(fixtures.length).toBeGreaterThanOrEqual(30));

  it('au moins 5 positions positives par modèle', () => {
    for (const m of MODELES) expect(fixtures.filter(f => f.attendu?.modele === m).length, m).toBeGreaterThanOrEqual(5);
  });

  it.each(fixtures.map(f => [f.nom, f] as const))('%s', (_, f) => {
    const c = conseil(f.pos, f.options);
    const n = f.pos.size;
    if (!f.attendu) expect(c).toBeNull();
    else {
      expect(c?.modele).toBe(f.attendu.modele);
      expect(c && c.point !== null ? toLabel(c.point, n) : null).toBe(f.attendu.point);
      expect(labels(c, n)).toEqual([...f.attendu.zone].sort());
      expect(phraseConseil(c!, n, 'fr')).toBe(f.attendu.fr);
    }
    for (const m of f.jamais ?? []) expect(c?.modele).not.toBe(m);
  });
});

const voisins = (p: number, n: number) => [p % n > 0 ? p - 1 : -1, p % n < n - 1 ? p + 1 : -1, p >= n ? p - n : -1, p < n * n - n ? p + n : -1].filter(q => q >= 0);

/** Vérifie qu'une phrase est vraie sur la position (indépendamment du code qui l'a choisie). */
function verifier(pos: Position, c: ConseilMochi) {
  const moi = pos.toPlay, n = pos.size;
  switch (c.modele) {
    case 'atari-joueur': {
      expect(pos.board[c.point!]).toBe(moi);
      const g = groupAt(pos.board, n, c.point!);
      expect(g.liberties.size).toBe(1);
      expect(c.zone).toEqual([...g.stones, ...g.liberties].sort((a, b) => a - b));
      break;
    }
    case 'atari-adverse': {
      const r = play(pos, c.point!);
      expect(typeof r).not.toBe('string');
      const pris = c.zone.filter(p => p !== c.point);
      expect(pris.length).toBe(c.pierres);
      for (const p of pris) { expect(pos.board[p]).toBe(3 - moi); expect((r as Position).board[p]).toBe(0); }
      break;
    }
    case 'peu-de-libertes': {
      expect(pos.board[c.point!]).toBe(moi);
      expect(groupAt(pos.board, n, c.point!).liberties.size).toBe(2);
      break;
    }
    case 'coin-libre': {
      for (const p of c.zone) expect(pos.board[p]).toBe(0);
      expect(pos.board.filter(v => v !== 0).length).toBeLessThanOrEqual(reglesCoin(n)!.maxPierres);
      break;
    }
    case 'zone-a-prendre':
      for (const p of c.zone) expect(pos.board[p]).toBe(0);
      break;
    case 'un-seul-oeil': {
      // « Un seul œil » : le groupe nommé borde exactement une région vide fermée par lui seul, d'un ou deux points,
      // et il n'a pas deux yeux (Benson).
      expect(pos.board[c.point!]).toBe(moi);
      const pierres = c.zone.filter(p => pos.board[p] === moi), oeil = c.zone.filter(p => pos.board[p] === 0);
      expect(oeil.length).toBeGreaterThanOrEqual(1);
      expect(oeil.length).toBeLessThanOrEqual(2);
      for (const p of oeil) for (const r of voisins(p, n)) expect(pos.board[r] === moi || oeil.includes(r)).toBe(true);
      expect(pierres).toContain(c.point!);
      expect(hasTwoEyes(pos, c.point!)).toBe(false);
      break;
    }
    case 'zone-a-defendre':
      for (const p of c.zone) expect(pos.board[p]).not.toBe(3 - moi);
      break;
    case 'coup-a-eviter': {
      // Le coup est légal, met le groupe en atari, et l'adversaire prend au moins deux pierres sans prise en retour.
      expect(pos.board[c.point!]).toBe(0);
      const r = play(pos, c.point!) as Position;
      expect(typeof r).not.toBe('string');
      const g = groupAt(r.board, n, c.point!);
      expect(g.liberties.size).toBe(1);
      expect(g.stones.length).toBeGreaterThanOrEqual(2);
      expect([...g.stones].sort((a, b) => a - b)).toEqual(c.zone);
      const r2 = play(r, [...g.liberties][0]) as Position;
      expect(typeof r2).not.toBe('string');
      for (const p of g.stones) expect(r2.board[p]).toBe(0);
      break;
    }
    case 'grand-coup':
      for (const p of c.zone) expect(pos.board[p]).toBe(0);
      break;
  }
}

describe('Conseil de Mochi : aucune phrase fausse', () => {
  it('les positions fixes', () => {
    for (const f of fixtures) { const c = conseil(f.pos, f.options); if (c) verifier(f.pos, c); }
  });

  it('300 positions de parties au hasard (9 × 9 et 13 × 13)', () => {
    let graine = 12345;
    const hasard = () => ((graine = (graine * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);
    const vus = new Set<ModeleConseil>();
    for (let k = 0; k < 300; k++) {
      const n = k % 3 === 0 ? 13 : 9;
      let pos = newPosition(n);
      const coups = Math.floor(hasard() * n * n * 0.7);
      for (let i = 0; i < coups; i++) {
        for (let essai = 0; essai < 20; essai++) {
          const r = play(pos, Math.floor(hasard() * n * n));
          if (typeof r !== 'string') { pos = r; break; }
        }
      }
      const c = conseil(pos);
      if (c) { vus.add(c.modele); verifier(pos, c); }
    }
    // Les modèles sans KataGo apparaissent dans de vraies suites de coups.
    for (const m of ['atari-adverse', 'atari-joueur', 'coin-libre', 'peu-de-libertes'] as const) expect(vus).toContain(m);
    for (const m of vus) expect(['atari-adverse', 'atari-joueur', 'coin-libre', 'peu-de-libertes', 'coup-a-eviter', 'un-seul-oeil']).toContain(m);
  });

  it('300 positions au hasard avec une analyse KataGo factice (propriété, candidats, menace) : phrases vraies, calcul rapide', () => {
    let graine = 777;
    const hasard = () => ((graine = (graine * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);
    const vus = new Set<ModeleConseil>();
    let pire = 0;
    for (let k = 0; k < 300; k++) {
      const n = [9, 13, 19][k % 3];
      let pos = newPosition(n);
      const nCoups = Math.floor(hasard() * n * n * 0.5);
      for (let i = 0; i < nCoups; i++) {
        for (let essai = 0; essai < 20; essai++) {
          const r = play(pos, Math.floor(hasard() * n * n));
          if (typeof r !== 'string') { pos = r; break; }
        }
      }
      // Propriété lisse : un plan incliné (Noir d'un côté, Blanc de l'autre), et sa bascule si l'adversaire jouait.
      const a = hasard() * 2 - 1, b = hasard() * 2 - 1, d = hasard() * 0.6;
      const own = Float32Array.from({ length: n * n }, (_, p) => Math.max(-1, Math.min(1, a * ((p % n) / n - 0.5) * 3 + b * (Math.floor(p / n) / n - 0.5) * 3)));
      const apres = own.map(v => v - (pos.toPlay === 1 ? d * 2 : -d * 2));
      const vides = [...pos.board.keys()].filter(p => pos.board[p] === 0);
      const coupsK = Array.from({ length: 3 }, () => vides[Math.floor(hasard() * vides.length)] ?? -1);
      const t0 = performance.now();
      const c = conseil(pos, { propriete: own, proprieteSiTuPasses: apres, coups: coupsK, menace: coupsK[1] });
      pire = Math.max(pire, performance.now() - t0);
      if (c) {
        vus.add(c.modele);
        verifier(pos, c);
        if (c.modele === 'coup-a-eviter') expect(coupsK).not.toContain(c.point);
        if (c.modele === 'grand-coup') expect(c.zone).toContain(coupsK[0]);
        if (c.modele === 'zone-a-defendre') for (const p of c.zone) {
          const s = pos.toPlay === 1 ? 1 : -1;
          expect(s * own[p]).toBeGreaterThanOrEqual(0.4);
          expect(s * apres[p]).toBeLessThanOrEqual(-0.2);
        }
        expect(phraseConseil(c, n, 'fr')).not.toMatch(/\{|undefined/);
        expect(phraseConseil(c, n, 'en')).not.toMatch(/\{|undefined/);
      }
    }
    for (const m of ['zone-a-defendre', 'grand-coup'] as const) expect(vus).toContain(m);
    // Le calcul sur l'appareil reste instantané à côté de l'analyse KataGo (moins de 2 s en tout sur 9 × 9).
    expect(pire).toBeLessThan(300);
  });

  it('jamais d’« atari » sur un groupe à deux libertés', () => {
    // Pierre noire à deux libertés, rien d'autre en atari : la phrase d'atari ne sort pas.
    for (const pos of [plateau(9, ['E5'], ['E6', 'D5']), plateau(9, ['A1'], ['B1']), plateau(19, ['K10', 'K11'], ['J10', 'L10', 'J11', 'L11'])]) {
      expect(conseil(pos)?.modele).not.toBe('atari-joueur');
      expect(conseil(pos)?.modele).not.toBe('atari-adverse');
    }
  });
});

describe('Conseil de Mochi : textes', () => {
  const cles = ['conseil.atariJoueur', 'conseil.atariAdverse', 'conseil.peuDeLibertes', 'conseil.coinLibre', 'conseil.zoneAPrendre',
    'conseil.unSeulOeil', 'conseil.zoneADefendre', 'conseil.coupAEviter', 'conseil.grandCoupCoin', 'conseil.grandCoupBord'] as const;
  const mots = (s: string) => s.replace(/[:!.,?]/g, ' ').split(/\s+/).filter(Boolean).length;

  it('16 mots au plus (une phrase de bulle), en français et en anglais, au singulier et au pluriel', () => {
    for (const l of ['fr', 'en'] as const) for (const cle of cles) for (const n of [1, 3]) {
      const s = traduire(l, cle, { point: 'Q16', n, ou: traduire(l, 'conseil.cote.hd') } as never);
      expect(s).not.toMatch(/\{/);
      expect(mots(s)).toBeLessThanOrEqual(16);
    }
  });

  it('tutoiement en français', () => {
    for (const cle of cles) expect(traduire('fr', cle, { point: 'E5', n: 2 } as never)).not.toMatch(/\bvous\b|\bvotre\b/i);
  });

  it('un modèle par phrase, dans l’ordre de priorité', () => {
    expect(MODELES).toEqual(['atari-joueur', 'atari-adverse', 'peu-de-libertes', 'un-seul-oeil', 'zone-a-defendre', 'coup-a-eviter', 'grand-coup', 'coin-libre', 'zone-a-prendre']);
  });

  it('phrase anglaise', () => {
    const c = conseil(atariBlancE5())!;
    expect(phraseConseil(c, 9, 'en')).toBe('You can capture at E4: that stone has one liberty left.');
    expect(phraseConseil(conseil(newPosition(9))!, 9, 'en')).toBe('A corner is still free: corners first.');
  });
});
