// Lot T de l'issue #136 : problèmes difficiles, 1100 à 1500. Filet contre le bord, vie par un coup au bord,
// placements (oki) sur le premier rang, point de coupe. 9 × 9, Noir au trait. Aucun ko, aucun seki.
// Même contenu que la migration 20260929010100_lot_t ; chaque position est prouvée par src/go/lot-t.test.ts :
// - capture (lecteur exact src/go/lecteurs-lot-n.ts, avec et sans ko) : la réponse prend une pierre marquée (T)
//   dans le nombre de coups annoncé, contre toute défense, et aucun autre coup noir n'y arrive ;
// - vie et mort (outil src/go/preuve-vie-mort.ts, recherche complète dans la zone, un ko compte comme non résolu) :
//   vivre, la réponse donne deux vrais yeux contre toute défense ; tuer, elle capture le groupe marqué contre toute
//   défense. Après tout autre coup, Blanc obtient l'issue inverse.
import type { PuzzleRow } from '../../data/puzzles';

const E = '.........';

const LOT_T: PuzzleRow[] = [
  {
    id: 't01', size: 9, difficulty: 1100, answers: ['B2'],
    setup: { rows: [E, E, E, E, 'XX.......', 'T........', 'T........', E, E], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue B2 : cette pierre lui ouvre la route du bas, et il garde trop de libertés pour être pris en quatre coups. Prends ce point le premier, sans toucher ses pierres." },
    title: 'Le filet contre le bord',
    prompt: 'Capture les pierres marquées en quatre coups au plus.',
    explanation: "Bravo ! Les deux pierres ont trois libertés : B4, B3 et A2. B2 ne les touche pas : il ferme la sortie du bas, de loin. C'est un filet. Si Blanc s'allonge en B4, tu joues C4 ; s'il s'allonge en B3, tu joues C3. Il reste collé au bord, à court de libertés, et tu le prends au quatrième coup."
  },
  {
    id: 't02', size: 9, difficulty: 1150, answers: ['E1'],
    setup: { rows: [E, E, E, E, E, 'OOOOO....', '.X.XOOO..', '.XXXXOO..', '.S.O..O..'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue E1 : il relie sa pierre D1 et entre dans ton espace par la droite. Il ne te reste pas la place pour deux yeux, et ton groupe finit capturé." },
    title: 'Ferme par le bord',
    prompt: 'Noir joue et vit. Une pierre blanche est entrée en D1, dans ton espace.',
    explanation: "Bravo ! E1, sur le premier rang, ferme ton espace à droite et met D1 en atari : il ne lui reste qu'une liberté, C1. Si Blanc joue F1, tu prends D1 en C1. La pierre D1 ne peut plus sortir, et ton coin garde la place pour deux yeux : ton groupe est vivant."
  },
  {
    id: 't03', size: 9, difficulty: 1200, answers: ['B1'],
    setup: { rows: [E, E, E, E, E, 'OOOOO....', 'XX..OOO..', 'SX.XXOO..', '..O.XXO..'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue B1 et se glisse sous tes pierres : A1 n'est plus un œil. Il ne te reste pas la place pour deux yeux, et ton groupe finit capturé." },
    title: 'L’œil du coin',
    prompt: 'Noir joue et vit. La pierre blanche C1 veut entrer dans ton coin.',
    explanation: "Superbe ! B1 garde A1, ton premier œil, et bloque la pierre C1 contre le bord. Si Blanc s'allonge en C2, tu joues C3 : ses deux pierres sont en atari. S'il joue C3, tu joues C2. Chaque fois, ses pierres restent enfermées, et ton groupe est vivant."
  },
  {
    id: 't04', size: 9, difficulty: 1250, answers: ['E2'],
    setup: { rows: [E, E, E, E, E, 'XXXXX....', '...OXXX..', 'OOOO.OX..', 'T.OO.OX..'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue E2 : il relie F1 et F2 au reste du groupe, et E1 devient un deuxième œil, à côté de B1. Avec deux yeux, son groupe est vivant." },
    title: 'Le point de coupe',
    prompt: 'Noir joue et tue. Regarde les pierres blanches F1 et F2.',
    explanation: "Bravo ! E2 coupe F1 et F2 du reste du groupe et les met en atari. Si Blanc les relie en E1, E1 ne sera jamais un œil. A3, B3 et C3 touchent tes pierres : ce n'est pas un œil non plus. Blanc n'a qu'un œil, en B1, et son groupe finit capturé."
  },
  {
    id: 't05', size: 9, difficulty: 1350, answers: ['A2'],
    setup: { rows: [E, E, E, E, E, 'XXXXX....', '.X.XXXX..', '.OOO.OX..', '.T.OO.X..'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue A2 : A1 devient un œil, et il garde la place pour un deuxième. Son groupe est vivant." },
    title: 'Glisse-toi au bord',
    prompt: 'Noir joue et tue. Ta pierre B3 est déjà contre le groupe blanc.',
    explanation: "Superbe ! A2 se glisse sous ta pierre B3, sur le bord : A1 ne peut plus devenir un œil. Si Blanc joue A1 pour mettre A2 en atari, tu te relies en A3. Le coin blanc n'a plus la place pour deux yeux, et son groupe finit capturé."
  },
  {
    id: 't06', size: 9, difficulty: 1500, answers: ['C1'],
    setup: { rows: [E, E, E, E, E, 'XXXXX....', 'OOOOXXX..', 'OO.O..X..', 'T....OX..'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue C1 : son espace reste d'un seul tenant, assez grand pour deux yeux. Son groupe est vivant." },
    title: 'Le point vital du premier rang',
    prompt: "Noir joue et tue. L'espace blanc paraît grand : où est son point faible ?",
    explanation: "Superbe ! C1, sur le premier rang, est le point vital : il coupe l'espace blanc en morceaux. Si Blanc joue D1, tu joues E2 ; s'il joue E2, tu joues D1. Chaque fois, un seul coup marche : il faut lire la suite. Blanc ne peut plus faire deux yeux, et son groupe finit capturé."
  },
];

export default LOT_T;
