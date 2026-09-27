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
  },
  {
    id: 'g03', size: 9, difficulty: 750, answers: ['D1'],
    setup: { rows: ['.........', '.........', '.........', '.........', '.........', '...X.....', '.OOXOO...', 'OSSOSSO..', '.O....O..'], toPlay: 'B',
      refutation: "Pas tout à fait. Ton groupe de gauche est en atari : sa seule liberté est C1. Si tu ne règles pas tout de suite, Blanc y joue et le capture. Cherche le coup qui sauve les deux groupes." },
    title: 'Une pierre sauve tout',
    prompt: 'Ton groupe de gauche est en atari et celui de droite est faible. Un seul coup sauve les deux.',
    explanation: "Superbe ! Ton groupe de gauche est en atari : il n'a qu'une liberté, C1. Mais la pierre blanche D2, qui sépare tes deux groupes, est en atari elle aussi : sa seule liberté est D1. En D1, tu la captures. Ton groupe de gauche retrouve une liberté en D2, Blanc ne peut plus y jouer, et tes deux groupes sont reliés. Capturer la pierre de coupe sauve tout d'un coup."
  },
  {
    id: 'g04', size: 9, difficulty: 780, answers: ['D3'],
    setup: { rows: ['.........', '.........', '.........', '.........', '.........', '.OOOOO...', 'OSX.SO...', '.X.OXO...', '.....O...'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue D3 et coupe : ton groupe E3-E2 n'a plus qu'une liberté, E1. Il est en atari et ne peut pas s'échapper. Relie-le d'abord." },
    title: 'Le point de coupe',
    prompt: 'Ton petit groupe de droite est faible. Relie-le à ton groupe de gauche.',
    explanation: "Bravo ! D3 relie tes deux groupes. Si Blanc y jouait, il couperait : ton groupe E3-E2 n'aurait plus qu'une liberté, E1, et serait en atari. Couper, c'est jouer entre deux groupes adverses pour les séparer. Relié, ton groupe a assez de libertés pour tenir."
  },
  {
    id: 'g05', size: 9, difficulty: 820, answers: ['C3'],
    setup: { rows: ['.........', '.........', '.........', '.........', '.........', 'OOOOOO...', 'XS.XSO...', '.XXO.XO..', '....OXO..'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue C3 et coupe : ton groupe D3-E3 n'a plus qu'une liberté, E2, et Blanc le capture au coup suivant. Relie-le d'abord." },
    title: 'Relie avant tout',
    prompt: 'Blanc menace de couper tes pierres marquées. Relie-les.',
    explanation: "Exact ! C3 relie D3-E3 à ton groupe de gauche. Si Blanc y jouait, il couperait : D3-E3 n'aurait plus qu'une liberté, E2, et serait en atari. Ne te laisse pas distraire par tes pierres F2-F1 : elles sont en atari, mais les sauver en E2 ne fait qu'ajouter des pierres à un groupe qui n'a qu'une liberté, C3."
  }
];

export default LOT_G;
