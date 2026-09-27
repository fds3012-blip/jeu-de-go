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
    id: 'f02', size: 9, difficulty: 800, answers: ['B5'],
    setup: { rows: ['.XO......', 'XXO......', '.XO......', 'XXO......', 'X.OOO....', 'XTX.O....', 'XOX.O....', '.OX.O....', '.OXOO....'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue B5 et relie son groupe au mur blanc C5 : il sort de la course aux libertés et ne peut plus être capturé." },
    title: 'Trois contre trois, une sortie',
    prompt: 'Course aux libertés : ton groupe C1-C4 et le groupe blanc marqué ont chacun 3 libertés. Joue le coup qui gagne.',
    explanation: "Exact ! Dans une course aux libertés (semeai), deux groupes s'entourent et le premier qui prend toutes les libertés de l'autre gagne. Blanc a 3 libertés : A2, A1 et B5. Toi aussi : D4, D3 et D2. Mais en B5, Blanc se relierait au mur blanc C5. Bloque cette sortie d'abord : Blanc n'a plus que 2 libertés contre 3 pour toi, et tu le captures un coup avant lui."
  },
  {
    id: 'f03', size: 9, difficulty: 900, answers: ['B5'],
    setup: { rows: ['.XO......', 'XXO......', '.XO......', 'XXO......', 'X.OO.....', 'XTX.O....', '.OX......', '.OX......', '.OX......'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue B5 et relie son groupe au mur blanc C5 : il sort de la course et ne peut plus être capturé. Bloque d'abord la sortie." },
    title: 'Bloque la sortie',
    prompt: 'Course aux libertés : ton groupe C1-C4 contre le groupe blanc marqué. Attention, Blanc peut rejoindre son mur.',
    explanation: "Bravo ! Le groupe blanc a 4 libertés : A3, A2, A1 et B5. Mais B5 n'est pas une liberté comme les autres : en y jouant, Blanc se relierait au mur blanc C5. Dans une course aux libertés (semeai), où deux groupes s'entourent et où le premier qui prend toutes les libertés de l'autre gagne, on bloque d'abord la sortie. Après B5, Blanc a 3 libertés et toi 4 (D4, D3, D2, D1) : tu gagnes la course."
  }
];

export default LOT_F;
