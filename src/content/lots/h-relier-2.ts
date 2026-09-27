// Lot H de l'issue #136 : relier pour sauver une pierre en atari, 9 × 9, Noir au trait.
// Aucun seki, aucun ko. Même contenu que la migration 20260927231100_lot_h ; chaque position
// est prouvée par src/go/lot-h.test.ts. `setup.refutation` est le texte affiché après une erreur.
import type { PuzzleRow } from '../../data/puzzles';

const LOT_H: PuzzleRow[] = [
  {
    id: 'h01', size: 9, difficulty: 720, answers: ['E2'],
    setup: { rows: ['.........', '.........', '.........', '.........', '.........', 'OOOOO....', 'XSXOSO...', '.X.X.O...', '....O....'], toPlay: 'B',
      refutation: "Pas tout à fait. Ta pierre E3 est en atari : sa seule liberté est E2. Si tu joues ailleurs, Blanc y joue et la capture. Relie-la d'abord." },
    title: 'Sauve en reliant',
    prompt: 'Ta pierre E3 est en atari. Sauve-la en la reliant à tes pierres.',
    explanation: "Bravo ! E3 n'a qu'une liberté, E2. En E2, tu la relies à D2 : le groupe gagne des libertés en C2 et D1. Si Blanc coupe en C2, sa pierre n'a plus qu'une liberté, C1 : tu la captures et tout reste relié. Une pierre en atari se sauve souvent en la reliant."
  },
];

export default LOT_H;
