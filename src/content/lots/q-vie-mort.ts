// Lot Q de l'issue #136 : vie et mort, difficulté 600 à 850. Œil vrai et faux œil, espace ouvert sur le bord.
// 9 × 9, Noir au trait. Aucun seki, aucun ko.
// Même contenu que la migration 20260928210100_lot_q ; chaque position est prouvée par src/go/lot-q.test.ts
// (outil src/go/preuve-vie-mort.ts : recherche complète dans la zone, un ko compte comme non résolu).
// Vivre : la réponse donne deux vrais yeux contre toute défense, et tout autre coup laisse Blanc tuer.
// Tuer : la réponse capture le groupe marqué contre toute défense, et après tout autre coup Blanc vit.
import type { PuzzleRow } from '../../data/puzzles';

const E = '.........';

const LOT_Q: PuzzleRow[] = [
  {
    id: 'q01', size: 9, difficulty: 600, answers: ['D2'],
    setup: { rows: [E, E, E, E, E, E, 'OOOOOO...', 'XSX.OO...', '.X.XXO...'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue D2 : tes pierres D1 et E1 n'ont plus qu'une liberté, C1. Blanc peut les prendre, donc C1 est un faux œil. Avec un seul vrai œil, ton groupe finit capturé." },
    title: 'Rends ton œil vrai',
    prompt: 'Noir joue et vit. Tu as deux yeux, A1 et C1. Mais C1 est-il un vrai œil ?',
    explanation: "Bravo ! D2 relie D1 et E1 au reste de ton groupe. A1 et C1 sont alors deux vrais yeux : deux points vides entourés par tes pierres, où Blanc ne peut pas jouer. Avec deux vrais yeux, ton groupe est vivant : il ne peut plus être capturé."
  },
  {
    id: 'q02', size: 9, difficulty: 700, answers: ['F2'],
    setup: { rows: [E, E, E, E, E, E, 'XXXXXXXX.', 'XTOOO.XX.', 'XO.O.OOX.'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue F2 et relie F1 et G1 à son groupe. C1 et E1 sont alors deux vrais yeux : le groupe blanc est vivant, il ne peut plus être capturé." },
    title: 'Rends l’œil faux',
    prompt: 'Noir joue et tue. Blanc a deux yeux, C1 et E1. Regarde les coins de E1.',
    explanation: "Bravo ! F2 touche E1 par le coin. Les pierres F1 et G1 n'ont plus qu'une liberté, E1 : tu peux les prendre. E1 est donc un faux œil, il ne compte pas. Blanc n'a qu'un vrai œil, C1 (un point vide entouré par ses pierres), et son groupe finit capturé."
  },
  {
    id: 'q03', size: 9, difficulty: 850, answers: ['D1', 'G1'],
    setup: { rows: [E, E, E, E, E, E, 'XXXXXXXXX', 'XTOOOOOOX', 'XO.....XX'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue G1, ou D1 si tu as joué E1. Il garde assez de place pour deux yeux : son groupe est vivant. Joue en G1 ou en D1 avant lui." },
    title: 'Cinq points sur le bord',
    prompt: 'Noir joue et tue. Blanc a cinq points vides, de C1 à G1. Ta pierre H1 touche G1.',
    explanation: "Superbe ! Deux coups marchent. En G1, tu réduis l'espace à quatre points, et F1 touche ta pierre : Blanc n'a plus la place pour deux yeux (deux points vides entourés par ses pierres). En D1, tu joues à l'intérieur de son espace et tu l'empêches de le couper en deux yeux. Dans les deux cas, son groupe finit capturé."
  },
];

export default LOT_Q;
