// Lot Y de l'issue #500 : problèmes de fin de partie (yose) pour la série « Fin de partie » (#471), qui attendait
// d'en avoir 8. 9 × 9, Noir au trait, ouverts à un débutant (difficulté 650 à 800 : la série de fin de la leçon 15 garde
// les trois problèmes du lot W, plus faciles). Aucun ko. Même contenu que la migration 20261008235100_lot_y.
// Chaque position est prouvée par src/go/lot-y.test.ts : minimax exact de src/go/preuve-fin-de-partie.ts (alpha-bêta,
// bornes basse et haute égales) sur les endroits encore ouverts, en comptage par surfaces ; la réponse est le seul
// meilleur coup, avec l'écart annoncé. Les chiffres des textes sont recomptés en règle japonaise par score().
import type { PuzzleRow } from '../../data/puzzles';

/** Frontière verticale : Noir en D, Blanc en E. */
const MUR = '...XO....';

const LOT_Y: PuzzleRow[] = [
  {
    id: 'y01', size: 9, difficulty: 650, answers: ['D1'],
    setup: { rows: [MUR, MUR, MUR, MUR, MUR, MUR, MUR, 'XXXXOOOOO', '....O....'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue D1 : il avance sur le premier rang, ta frontière recule en C1, et tu perds au moins un point.' },
    title: 'Bloque au premier rang',
    prompt: 'Blanc est descendu en E1, sur le premier rang. Ferme ta frontière sans perdre de point.',
    explanation: 'Bravo ! D1 bloque au contact de la pierre blanche : A1, B1 et C1 restent à toi. En C1, tu reculais : Blanc avançait en D1, et tu avais un point de moins.'
  },
];

export default LOT_Y;
