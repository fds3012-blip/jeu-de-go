// Lot G de l'issue #136 : relier deux groupes (menace de coupe, relier en capturant), 9 × 9, Noir au trait.
// Aucun seki, aucun ko. Même contenu que la migration 20260927220100_lot_g_relier ; chaque position
// est prouvée par src/go/lot-g.test.ts. `setup.refutation` est le texte affiché après une erreur.
import type { PuzzleRow } from '../../data/puzzles';

const LOT_G: PuzzleRow[] = [
  {
    id: 'g01', size: 9, difficulty: 660, answers: ['D3'],
    setup: { rows: ['.........', '.........', '.........', '.........', '.........', 'OOOOOO...', 'XSX.XSO..', '.X.O.XO..', '.....O...'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue D3 et coupe tes deux groupes : chacun, seul, n'a plus assez de libertés. Relie-les d'abord." },
    title: 'Ferme la coupe',
    prompt: 'Blanc menace de couper tes deux groupes. Relie-les.',
    explanation: "Bravo ! D3 est le point de coupe : si Blanc y joue, il sépare tes deux groupes. Couper, c'est jouer entre deux groupes adverses pour les séparer. En D3, tes pierres ne forment plus qu'un groupe, avec assez de libertés pour tenir. Quand l'adversaire menace de couper, relie d'abord."
  },
  {
    id: 'g02', size: 9, difficulty: 700, answers: ['D1', 'C1', 'E1'],
    setup: { rows: ['.........', '.........', '.........', '.........', '.........', '...X.....', '.OOXOO...', 'OSSOSSO..', '.........'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc s'allonge en D1 : sa pierre de coupe retrouve des libertés, et tes deux groupes du bas restent séparés et en danger. Occupe-toi de la pierre D2." },
    title: 'Relie en capturant',
    prompt: 'La pierre blanche D2 sépare tes deux groupes. Relie-les.',
    explanation: "Exact ! La pierre D2 coupe tes deux groupes, mais elle est en atari : il ne lui reste qu'une liberté, D1. En D1, tu la captures : le point D2 devient à toi, Blanc ne peut plus y jouer, et tes groupes sont reliés. C1 et E1 marchent aussi : si Blanc s'allonge en D1, il reste en atari et tu le prends au coup suivant. Mais D1 est le plus simple."
  }
];

export default LOT_G;
