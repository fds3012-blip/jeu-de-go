// Lot I de l'issue #136, seconde partie : captures en trois coups (échelle, filet), 9 × 9, Noir au trait.
// Même contenu que la migration 20260928000100_lot_i ; chaque position est prouvée par src/go/lot-i.test.ts
// (lecteur exact du lot A : Noir capture la pierre marquée en au plus trois coups, quelle que soit la défense).
import type { PuzzleRow } from '../../data/puzzles';

const E = '.........';

const LOT_I_CAPTURES: PuzzleRow[] = [
  {
    id: 'i09', size: 9, difficulty: 450, answers: ['D2'],
    setup: { rows: [E, E, E, E, E, E, '..X......', '.XT......', E], toPlay: 'B',
      refutation: "Pas tout à fait. Si tu mets la pierre en atari en C1, Blanc s'allonge en D2 et a trois libertés : elle s'échappe. Mets-la en atari de l'autre côté, pour la pousser vers le bord." },
    title: "L'échelle vers le bord",
    prompt: 'Capture la pierre marquée en trois coups au plus.',
    explanation: "Bravo ! D2 met la pierre en atari (il ne lui reste qu'une liberté, C1) et la pousse vers le bord. Si Blanc s'allonge en C1, tu joues D1 : ses deux pierres n'ont de nouveau qu'une liberté. S'il s'allonge en B1, A1 capture les trois pierres. C'est une échelle : chaque atari pousse Blanc, jusqu'au bord."
  },
  {
    id: 'i10', size: 9, difficulty: 580, answers: ['D4'],
    setup: { rows: [E, E, E, E, E, '.X.......', '.XT......', '..XX.....', E], toPlay: 'B',
      refutation: "Pas tout à fait. Si tu mets la pierre en atari directement, Blanc s'allonge de l'autre côté et retrouve deux libertés. Ferme plutôt ses deux sorties d'un seul coup." },
    title: 'Ferme les deux sorties',
    prompt: 'Capture la pierre marquée en trois coups au plus.',
    explanation: "Superbe ! D4 ne touche pas la pierre, mais ferme ses deux sorties, C4 et D3 : c'est un filet (geta en japonais). Si Blanc sort en C4, tu joues C5 ; s'il sort en D3, tu joues E3. Chaque fois, ses pierres n'ont plus qu'une liberté, et tu les captures au coup suivant."
  },
];

export default LOT_I_CAPTURES;
