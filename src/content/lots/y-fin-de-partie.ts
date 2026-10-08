// Lot Y de l'issue #500 : problèmes de fin de partie (yose) pour la série « Fin de partie » (#471), qui attendait
// d'en avoir 8. 9 × 9, Noir au trait, ouverts à un débutant (difficulté 650 à 800 : la série de fin de la leçon 15 garde
// les trois problèmes du lot W, plus faciles). Aucun ko. Même contenu que la migration 20261008235100_lot_y.
// Chaque position est prouvée par src/go/lot-y.test.ts : minimax exact de src/go/preuve-fin-de-partie.ts (alpha-bêta,
// bornes basse et haute égales) sur les endroits encore ouverts, en comptage par surfaces ; la réponse est le seul
// meilleur coup, avec l'écart annoncé. Les chiffres des textes sont recomptés en règle japonaise par score().
import type { PuzzleRow } from '../../data/puzzles';

/** Frontière verticale : Noir en D, Blanc en E. */
const MUR = '...XO....';
/** Frontière verticale : Noir en C, Blanc en D. */
const MUR_C = '..XO.....';

const LOT_Y: PuzzleRow[] = [
  {
    id: 'y01', size: 9, difficulty: 650, answers: ['D1'],
    setup: { rows: [MUR, MUR, MUR, MUR, MUR, MUR, MUR, 'XXXXOOOOO', '....O....'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue D1 : il avance sur le premier rang, ta frontière recule en C1, et tu perds au moins un point.' },
    title: 'Bloque au premier rang',
    prompt: 'Blanc est descendu en E1, sur le premier rang. Ferme ta frontière sans perdre de point.',
    explanation: 'Bravo ! D1 bloque au contact de la pierre blanche : A1, B1 et C1 restent à toi. En C1, tu reculais : Blanc avançait en D1, et tu avais un point de moins.'
  },
  {
    id: 'y02', size: 9, difficulty: 700, answers: ['E9'],
    setup: { rows: ['.XOO.O...', '.XXX.O...', '..XOOO...', MUR_C, MUR_C, MUR_C, MUR_C, 'XXXOOOOOO', '...O.....'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue E9 : il relie ses deux pierres, et tu ne gagnes rien en haut. Les prendre valait 4 points, bloquer en bas un seul.' },
    title: 'Le plus gros d’abord',
    prompt: 'Il reste deux endroits ouverts, en haut et en bas. Joue le plus gros.',
    explanation: 'Bravo ! E9 prend C9 et D9 : 2 prisonniers, et ces deux points deviennent ton territoire. Ça fait 4 points. En bas, si Blanc avance en C1 et que tu bloques en B1, tu ne perds qu’un point.'
  },
];

export default LOT_Y;
