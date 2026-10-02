// Lot X de l'issue #16 : les séries de fin des leçons 4 (le ko), 6 (territoire et ouverture) et 8 (les premiers coups).
// La leçon 7 (compter les points) n'a pas besoin de nouveaux problèmes : elle reprend ceux du lot W (fin de partie,
// comptage), voir src/content/themes.ts.
// - Ko (l4), x01 à x03 : prendre un ko, fermer un ko (relier), prendre un ko pour sauver sa pierre. 9 × 9, prouvés par
//   src/go/lot-x.test.ts (règles de src/go : capture, ko simple, recherche de toutes les réponses).
// - Ouverture (l6 et l8), x04 à x08 : prendre le coin libre, en 13 × 13. En 9 × 9, KataGo ne donne pas le coin comme
//   meilleur coup (le centre et les approches y valent autant) : le principe des leçons ne s'y vérifie pas. En 13 × 13,
//   il se vérifie. Les réponses acceptées sont les points du coin libre sur la 3e et la 4e ligne (3-3, 3-4, 4-4) ;
//   src/go/lot-x.test.ts vérifie la géométrie, et KataGo (réseau g170 b6c96) chaque réponse : voir l'en-tête du test.
// Noir au trait, tous ouverts à un débutant (difficulté 350 à 550). Même contenu que la migration
// 20261002121100_lot_x.
import type { PuzzleRow } from '../../data/puzzles';

const E = '.........';
/** Ligne vide du 13 × 13. */
const T = '.............';

const LOT_X: PuzzleRow[] = [
  {
    id: 'x01', size: 9, difficulty: 350, answers: ['C1'],
    setup: { rows: [E, E, E, E, E, E, E, 'XXO......', 'XT.O.....'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue C1 : il relie la pierre marquée à ses pierres, et elle est sauvée.' },
    title: 'Prends le ko',
    prompt: 'La pierre blanche marquée n’a plus qu’une liberté. Capture-la.',
    explanation: 'Bravo ! C1 prend B1. Ta pierre C1 n’a plus qu’une liberté, B1 : c’est un ko. Blanc ne peut pas reprendre tout de suite. Il doit d’abord jouer ailleurs.'
  },
  {
    id: 'x02', size: 9, difficulty: 450, answers: ['E9'],
    setup: { rows: ['..OS.X...', '..OOX....', E, E, E, E, E, E, E], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue E9 : il prend ta pierre, et c’est un ko. Ferme-le avant.' },
    title: 'Ferme le ko',
    prompt: 'Ta pierre marquée est en atari. Blanc peut la prendre et lancer un ko. Empêche-le.',
    explanation: 'Bravo ! E9 relie ta pierre à tes autres pierres : elles ont trois libertés, et il n’y a plus de ko. On dit que tu as fermé le ko.'
  },
  {
    id: 'x03', size: 9, difficulty: 550, answers: ['F5'],
    setup: { rows: [E, '....O....', '...O.O...', '...OSO...', '...XO.O..', '....XO...', E, E, E], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue F5 : il relie E5, et ta pierre marquée reste en atari. En E7, tu n’aurais aucune liberté : c’est interdit.' },
    title: 'Le ko qui sauve',
    prompt: 'Ta pierre marquée est en atari, et tu ne peux pas t’allonger. Sauve-la.',
    explanation: 'Bravo ! F5 prend E5 : ta pierre retrouve une liberté. C’est un ko : Blanc ne peut pas reprendre en E5 tout de suite. S’il joue ailleurs, relie-toi en E5 : le ko est fini.'
  },
  {
    id: 'x04', size: 13, difficulty: 350, answers: ['D10', 'C10', 'D11', 'C11'],
    setup: { rows: [T, T, T, '.........O...', T, T, T, T, T, '...X.....O...', T, T, T], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc prend alors le coin en haut à gauche, le plus grand point. Joue d’abord dans le coin libre, sur la 3e ou la 4e ligne.' },
    title: 'Le coin libre',
    prompt: 'Début de partie. Un coin est encore vide. Prends-le.',
    explanation: 'Bravo ! Le coin en haut à gauche était libre : c’est le plus grand point. Dans un coin, peu de pierres entourent beaucoup de points. Le 3-3, le 3-4 et le 4-4 (3e ou 4e ligne depuis chaque bord) y sont tous bons.'
  },
  {
    id: 'x05', size: 13, difficulty: 400, answers: ['D4', 'D3', 'C4', 'C3'],
    setup: { rows: [T, T, T, '...O.....X...', T, T, T, T, T, '.........O...', T, T, T], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc prend alors le coin en bas à gauche, le plus grand point. Joue d’abord dans le coin libre, sur la 3e ou la 4e ligne.' },
    title: 'Coins d’abord',
    prompt: 'Blanc a deux coins, toi un seul. Où joues-tu ?',
    explanation: 'Bravo ! Le coin en bas à gauche était libre : c’est le plus grand point. Le 3-3, le 3-4 et le 4-4 (3e ou 4e ligne depuis chaque bord) y sont tous bons.'
  },
  {
    id: 'x06', size: 13, difficulty: 450, answers: ['K4', 'K3', 'L4', 'L3'],
    setup: { rows: [T, T, T, '...O.....X...', T, T, T, T, T, '..X..........', '......O......', T, T], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc prend alors le coin en bas à droite, à côté de sa pierre G3 : le plus grand point. Joue d’abord dans le coin libre, sur la 3e ou la 4e ligne.' },
    title: 'Avant le bord',
    prompt: 'Blanc vient de jouer sur le bord, en G3. Le plus grand point est ailleurs. Joue-le.',
    explanation: 'Bravo ! Le coin en bas à droite était encore libre : il vaut plus qu’un point du bord. Coins, puis bords, puis centre. Le 3-3, le 3-4 et le 4-4 y sont tous bons.'
  },
  {
    id: 'x07', size: 13, difficulty: 500, answers: ['D4', 'D3', 'C4', 'C3'],
    setup: { rows: [T, T, T, '...X.....O...', T, T, '......O......', T, T, '.........X...', T, T, T], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc prend alors le coin en bas à gauche, le plus grand point. Le centre attendra : joue d’abord dans le coin libre, sur la 3e ou la 4e ligne.' },
    title: 'Le centre attendra',
    prompt: 'Blanc a pris le centre. Que joues-tu ?',
    explanation: 'Bravo ! Le coin en bas à gauche vaut plus que le centre : au centre, il faut beaucoup de pierres pour entourer un point. Le 3-3, le 3-4 et le 4-4 y sont tous bons.'
  },
  {
    id: 'x08', size: 13, difficulty: 550, answers: ['D4', 'C4', 'D3', 'C3'],
    setup: { rows: [T, T, T, '...X.....O...', T, T, T, T, T, '......X..O...', T, T, T], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc prend alors le coin en bas à gauche, le plus grand point, et ta pierre G4 reste seule. Joue d’abord dans le coin libre, sur la 3e ou la 4e ligne.' },
    title: 'Le plus grand point',
    prompt: 'Chacun a joué deux pierres. Quel est le plus grand point ?',
    explanation: 'Bravo ! Le coin en bas à gauche était libre : c’est le plus grand point. Avec ta pierre G4, tu commences à entourer le bas. Le 3-3, le 3-4 et le 4-4 y sont tous bons.'
  },
];

export default LOT_X;
