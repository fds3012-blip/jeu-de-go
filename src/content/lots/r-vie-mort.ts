// Lot R de l'issue #136 : vie et mort, difficulté 700 à 1050. Point vital du coin, placement (oki), réduction par
// l'extérieur, formes du bord à six points. 9 × 9, Noir au trait. Aucun seki, aucun ko.
// Même contenu que la migration 20260928223100_lot_r ; chaque position est prouvée par src/go/lot-r.test.ts
// (outil src/go/preuve-vie-mort.ts : recherche complète dans la zone, un ko compte comme non résolu).
// Vivre : la réponse donne deux vrais yeux contre toute défense, et tout autre coup laisse Blanc tuer.
// Tuer : la réponse capture le groupe marqué contre toute défense, et après tout autre coup Blanc vit.
import type { PuzzleRow } from '../../data/puzzles';

const E = '.........';

const LOT_R: PuzzleRow[] = [
  {
    id: 'r01', size: 9, difficulty: 700, answers: ['B2', 'B1'],
    setup: { rows: [E, E, E, E, E, 'OOOO.....', 'XSXXO....', '...XO....', '...XO....'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue B2 (ou B1 si tu as joué A2 ou C2). Il prend le point vital : ton espace ne peut plus faire deux yeux, et ton groupe finit capturé." },
    title: 'Six points dans le coin',
    prompt: "Noir joue et vit. Ton groupe entoure six points, de A1 à C2, et n'a aucune liberté dehors.",
    explanation: "Bravo ! B2 est le point vital : le point qui décide si ton espace fera deux yeux. Un œil est un point vide entouré par tes pierres, où Blanc ne peut pas jouer. Après B2, quoi que Blanc joue, tu gardes deux yeux : ton groupe est vivant, il ne peut plus être capturé. B1 marche aussi."
  },
  {
    id: 'r02', size: 9, difficulty: 750, answers: ['B1'],
    setup: { rows: [E, E, E, E, E, E, 'XXXXXXXXX', 'XOOTOOOX.', '...O..OX.'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue B1 : C1 devient un deuxième œil, à côté de celui de E1-F1. Avec deux yeux, son groupe est vivant." },
    title: 'Deux espaces sur le bord',
    prompt: 'Noir joue et tue. Blanc a deux espaces : A1-B1-C1 et E1-F1. Un seul peut encore changer.',
    explanation: "Bravo ! À droite, E1-F1 ne fait qu'un œil (un point vide entouré par ses pierres). À gauche, B1 est le point vital : si Blanc y jouait, C1 deviendrait un deuxième œil. Ta pierre en B1 l'en empêche. Blanc n'a qu'un œil, et son groupe finit capturé."
  },
  {
    id: 'r03', size: 9, difficulty: 800, answers: ['B1'],
    setup: { rows: [E, E, E, E, E, E, 'OOOOOOOOO', 'OXXSXXXO.', '...X...O.'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue B1 (ou F1 si tu as joué C1) et t'enlève un œil. Avec un seul œil, ton groupe finit capturé." },
    title: 'Le côté qui a besoin de toi',
    prompt: 'Noir joue et vit. Tu as deux espaces : A1-B1-C1 et E1-F1-G1. Lequel a besoin de toi ?',
    explanation: "Bravo ! B1 fait de C1 un vrai œil. Sans lui, Blanc jouerait B1, puis A1 pour se relier à A2 : plus d'œil à gauche. À droite, tu peux toujours répondre et garder un œil. Avec deux yeux, ton groupe est vivant."
  },
  {
    id: 'r04', size: 9, difficulty: 900, answers: ['A2', 'C2'],
    setup: { rows: [E, E, E, E, E, 'OOOO.....', 'XSXXO....', '.O.XO....', '.X.XO....'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue A2 (ou C2 si tu as joué A1). Ses pierres tiennent au point vital, et ton coin ne peut plus faire deux yeux. Ton groupe finit capturé." },
    title: 'La pierre au point vital',
    prompt: 'Noir joue et vit. Blanc a placé une pierre en B2, au point vital de ton coin. Chasse-la.',
    explanation: "Bravo ! Ton coup met B2 en atari : il ne lui reste qu'une liberté. Si Blanc s'allonge, tu prends ses deux pierres. Après A2, A1 est d'abord un faux œil : il ressemble à un œil, mais le point en diagonale B2 est à Blanc. Quand tu prends B2, A1 devient un vrai œil, et ton groupe est vivant. C2 marche aussi."
  },
  {
    id: 'r05', size: 9, difficulty: 950, answers: ['E1'],
    setup: { rows: [E, E, E, E, E, E, 'XXXXXXX..', 'OOTOOOX..', '..O..XX..'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue E1 : D1 devient un deuxième œil, à côté de A1-B1. Avec deux yeux, son groupe est vivant." },
    title: 'Réduis par le bout',
    prompt: 'Noir joue et tue. Blanc a deux espaces : A1-B1 et D1-E1. Ta pierre F1 touche E1.',
    explanation: "Bravo ! E1 réduit l'espace de droite par l'extérieur, en s'appuyant sur F1. D1 touche ta pierre : il ne peut plus devenir un œil. Blanc n'a qu'un œil, A1-B1, et son groupe finit capturé."
  },
  {
    id: 'r06', size: 9, difficulty: 1050, answers: ['B2'],
    setup: { rows: [E, E, E, E, 'XXXXX....', 'OTOOX....', '..OOX....', '...OX....', 'X..OX....'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue B2 et prend le point vital. Il garde alors la place pour deux yeux : son groupe est vivant." },
    title: 'Le point vital du coin',
    prompt: 'Noir joue et tue. Ta pierre A1 est déjà dans le coin blanc. Trouve le point qui l’aide.',
    explanation: "Superbe ! B2 est le point vital du coin. Il soutient ta pierre A1 et coupe l'espace blanc en morceaux trop petits. Blanc ne peut plus faire deux yeux, et son groupe finit capturé."
  },
];

export default LOT_R;
