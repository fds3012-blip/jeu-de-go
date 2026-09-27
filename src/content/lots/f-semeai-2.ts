// Lot F de l'issue #91 : courses aux libertés (semeai), coupes et connexions, 9 × 9, Noir au trait.
// Aucun seki, aucun ko. Même contenu que la migration 20260927190600_lot_f_semeai ; chaque position
// est prouvée par src/go/lot-f.test.ts. `setup.refutation` est le texte affiché après une erreur.
import type { PuzzleRow } from '../../data/puzzles';

const LOT_F: PuzzleRow[] = [
  {
    id: 'f01', size: 9, difficulty: 700, answers: ['D4', 'B5'],
    setup: { rows: ['.........', '.........', '..OX.....', '.OSOX....', '..SOX....', '..O.X....', '.........', '.........', '.........'], toPlay: 'B',
      refutation: "Pas tout à fait. Tes pierres marquées n'ont qu'une liberté, B5 : Blanc y joue et les capture. Regarde aussi les pierres blanches qui les touchent : elles sont en atari, elles aussi." },
    title: 'Sauve tes pierres de coupe',
    prompt: 'Tes deux pierres marquées coupent Blanc, mais elles sont en atari. Sauve-les.',
    explanation: "Bravo ! Tes pierres marquées sont des pierres de coupe : elles séparent les pierres blanches. Elles sont en atari (une seule liberté, B5), mais les deux pierres blanches D6-D5 aussi : leur seule liberté est D4. En D4, tu les captures, et tes pierres retrouvent des libertés. B5 marche aussi : tes pierres ont alors deux libertés, et si Blanc les attaque, tu prends D6-D5 en D4."
  },
  {
    id: 'f02', size: 9, difficulty: 720, answers: ['H5'],
    setup: { rows: ['....OOXO.', '....OOXOX', '....O.XOX', '....O.XTX', '....OOO.X', '......OXX', '......OX.', '......OXX', '......OX.'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue H5 et relie son groupe au mur blanc G5 : il sort de la course aux libertés. Bloque d'abord la sortie." },
    title: 'Deux contre deux, une sortie',
    prompt: 'Course aux libertés : ton groupe G6-G9 contre le groupe blanc marqué. Chacun a 2 libertés.',
    explanation: "Exact ! Dans une course aux libertés (semeai), deux groupes s'entourent et le premier qui prend toutes les libertés de l'autre gagne. Blanc a 2 libertés, J9 et H5 ; toi aussi, F7 et F6. Mais H5 est une sortie : en y jouant, Blanc se relierait au mur blanc G5. Après H5, Blanc est en atari (une seule liberté) et tu le captures en J9 au coup suivant."
  },
  {
    id: 'f03', size: 9, difficulty: 750, answers: ['C2'],
    setup: { rows: ['.........', '.........', '.........', '.........', '....X....', '.OO......', '...XX....', 'XO.T.X...', '.XXOX....'], toPlay: 'B',
      refutation: "Pas tout à fait. Après E2, Blanc s'allonge en C2 : il se relie à sa pierre B2 et met en plus tes pierres B1-C1 en atari. Mets-le en atari de l'autre côté." },
    title: 'Le bon côté',
    prompt: 'Noir joue et capture les pierres blanches marquées. Elles ont deux libertés : laquelle prendre ?',
    explanation: "Bien vu ! C2 coupe les pierres marquées de la pierre blanche B2 et les met en atari (une seule liberté). Leur dernière liberté, E2, est entourée par tes pierres E3, F2 et E1 : Blanc ne peut pas s'y allonger, ce serait un suicide. En plus, C2 relie tes pierres B1-C1 et met B2 en atari."
  },
  {
    id: 'f04', size: 9, difficulty: 780, answers: ['E9'],
    setup: { rows: ['..XT.OO..', '..XTXO...', '..X.X....', '...X.....', '.........', '.........', '.........', '.........', '.........'], toPlay: 'B',
      refutation: "Pas tout à fait. Après ce coup, Blanc joue E9 et relie ses pierres marquées à son groupe de droite : elles sont sauvées. Coupe au point de liaison." },
    title: 'Coupe au bord',
    prompt: 'Noir joue et capture les deux pierres blanches marquées. Elles ont deux libertés : E9 et D7.',
    explanation: "Bravo ! E9 coupe les pierres marquées du groupe blanc de droite : couper, c'est jouer entre deux groupes adverses pour les séparer. Il leur reste une liberté, D7, entourée par tes pierres C7, E7 et D6 : Blanc ne peut pas s'y allonger, ce serait un suicide. Tu les captures au coup suivant."
  },
  {
    id: 'f05', size: 9, difficulty: 800, answers: ['B5'],
    setup: { rows: ['.XO......', 'XXO......', '.XO......', 'XXO......', 'X.OOO....', 'XTX.O....', 'XOX.O....', '.OX.O....', '.OXOO....'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue B5 et relie son groupe au mur blanc C5 : il sort de la course aux libertés et ne peut plus être capturé." },
    title: 'Trois contre trois, une sortie',
    prompt: 'Course aux libertés : ton groupe C1-C4 et le groupe blanc marqué ont chacun 3 libertés. Joue le coup qui gagne.',
    explanation: "Exact ! Dans une course aux libertés (semeai), deux groupes s'entourent et le premier qui prend toutes les libertés de l'autre gagne. Blanc a 3 libertés : A2, A1 et B5. Toi aussi : D4, D3 et D2. Mais en B5, Blanc se relierait au mur blanc C5. Bloque cette sortie d'abord : Blanc n'a plus que 2 libertés contre 3 pour toi, et tu le captures un coup avant lui."
  },
  {
    id: 'f06', size: 9, difficulty: 900, answers: ['B5'],
    setup: { rows: ['.XO......', 'XXO......', '.XO......', 'XXO......', 'X.OO.....', 'XTX.O....', '.OX......', '.OX......', '.OX......'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue B5 et relie son groupe au mur blanc C5 : il sort de la course et ne peut plus être capturé. Bloque d'abord la sortie." },
    title: 'Bloque la sortie',
    prompt: 'Course aux libertés : ton groupe C1-C4 contre le groupe blanc marqué. Attention, Blanc peut rejoindre son mur.',
    explanation: "Bravo ! Le groupe blanc a 4 libertés : A3, A2, A1 et B5. Mais B5 n'est pas une liberté comme les autres : en y jouant, Blanc se relierait au mur blanc C5. Dans une course aux libertés (semeai), où deux groupes s'entourent et où le premier qui prend toutes les libertés de l'autre gagne, on bloque d'abord la sortie. Après B5, Blanc a 3 libertés et toi 4 (D4, D3, D2, D1) : tu gagnes la course."
  }
];

export default LOT_F;
