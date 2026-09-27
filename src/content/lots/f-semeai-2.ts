// Lot F de l'issue #91 : courses aux libertés (semeai), coupes et connexions, 9 × 9, Noir au trait.
// Aucun seki, aucun ko. Même contenu que la migration 20260927190600_lot_f_semeai ; chaque position
// est prouvée par src/go/lot-f.test.ts. `setup.refutation` est le texte affiché après une erreur.
import type { PuzzleRow } from '../../data/puzzles';

const LOT_F: PuzzleRow[] = [
  {
    id: 'f01', size: 9, difficulty: 900, answers: ['B5'],
    setup: { rows: ['.XO......', 'XXO......', '.XO......', 'XXO......', 'X.OO.....', 'XTX.O....', '.OX......', '.OX......', '.OX......'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue B5 et relie son groupe au mur blanc C5 : il sort de la course et ne peut plus être capturé. Bloque d'abord la sortie." },
    title: 'Bloque la sortie',
    prompt: 'Course aux libertés : ton groupe C1-C4 contre le groupe blanc marqué. Attention, Blanc peut rejoindre son mur.',
    explanation: "Bravo ! Le groupe blanc a 4 libertés : A3, A2, A1 et B5. Mais B5 n'est pas une liberté comme les autres : en y jouant, Blanc se relierait au mur blanc C5. Dans une course aux libertés (semeai), où deux groupes s'entourent et où le premier qui prend toutes les libertés de l'autre gagne, on bloque d'abord la sortie. Après B5, Blanc a 3 libertés et toi 4 (D4, D3, D2, D1) : tu gagnes la course."
  }
];

export default LOT_F;
