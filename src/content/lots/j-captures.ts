// Lot J de l'issue #136, première partie : captures en deux ou trois coups (double atari par la coupe, prise en
// retour, capturer pour relier),
// 9 × 9, Noir au trait. Aucun ko. Même contenu que la migration 20260928020100_lot_j ; chaque position est prouvée
// par src/go/lot-j.test.ts (lecteur exact, tous les coups légaux de Blanc et la passe, avec et sans ko).
import type { PuzzleRow } from '../../data/puzzles';

const E = '.........';

const LOT_J_CAPTURES: PuzzleRow[] = [
  {
    id: 'j01', size: 9, difficulty: 620, answers: ['C2'],
    setup: { rows: [E, E, E, E, E, E, 'XXXXXXX..', 'XT.T..X..', '...XX.X..'], toPlay: 'B',
      refutation: "Pas tout à fait. Si tu mets une seule pierre en atari, Blanc relie ses deux pierres en C2 et retrouve deux libertés. Joue plutôt au point qui les sépare." },
    title: 'La coupe qui menace deux fois',
    prompt: 'Capture une des pierres marquées en deux coups au plus.',
    explanation: "Bravo ! C2 coupe les deux pierres blanches. Chacune n'a plus qu'une liberté : B1 pour B2, E2 pour D2. Elles sont toutes les deux en atari (une seule liberté). C'est un double atari : Blanc n'en sauve qu'une, tu prends l'autre."
  },
  {
    id: 'j02', size: 9, difficulty: 660, answers: ['B1'],
    setup: { rows: [E, E, E, E, E, E, 'XXXXXXX..', 'T.X...X..', 'O.OOO.X..'], toPlay: 'B',
      refutation: "Pas tout à fait. En B2, tu mets les pierres en atari, mais Blanc joue B1 : il les relie à ses pierres du bas et retrouve trois libertés. Joue plutôt en B1, même si Blanc peut prendre ta pierre." },
    title: 'Prise en retour dans le coin',
    prompt: 'Capture la pierre marquée en deux coups au plus.',
    explanation: "Superbe ! En B1, ta pierre n'a qu'une liberté, B2 : Blanc peut la prendre. Mais A2 et A1 sont en atari (une seule liberté). Si Blanc prend en B2, ses trois pierres n'ont plus qu'une liberté, B1. Tu rejoues en B1 et tu les captures toutes. C'est la prise en retour : tu donnes une pierre pour en prendre trois."
  },
  {
    id: 'j03', size: 9, difficulty: 700, answers: ['E1'],
    setup: { rows: [E, E, E, E, E, E, 'XXXXXXX..', '.X.XTOX..', 'X.OO..X..'], toPlay: 'B',
      refutation: "Pas tout à fait. En F1, Blanc joue E1 : il relie ses pierres à C1 et D1, et le groupe a deux libertés, B1 et C2. Joue plutôt en E1, même si Blanc peut prendre ta pierre." },
    title: 'Le piège sur le bord',
    prompt: 'Capture la pierre marquée en deux coups au plus.',
    explanation: "Bravo ! En E1, ta pierre n'a qu'une liberté, F1, et Blanc peut la prendre. Mais E2 et F2 sont en atari (une seule liberté). Si Blanc prend en F1, ses trois pierres n'ont plus qu'une liberté, E1 : tu rejoues en E1 et tu les captures. C'est une prise en retour. Et E1 empêche Blanc de se relier à C1 et D1."
  },
  {
    id: 'j04', size: 9, difficulty: 760, answers: ['D2'],
    setup: { rows: [E, E, E, E, E, E, 'XXXXXXX..', 'XTO.TOX..', '.OX..OX..'], toPlay: 'B',
      refutation: "Pas tout à fait. Si tu mets un seul groupe en atari, Blanc joue D2 : il relie ses deux groupes, et ils respirent. Coupe d'abord en D2." },
    title: 'Coupe malgré la menace',
    prompt: 'Capture une des pierres marquées en deux coups au plus.',
    explanation: "Superbe ! D2 coupe et met les deux groupes en atari (une seule liberté) : A1 pour celui de gauche, E1 pour celui de droite. Ta pierre C1 est en atari aussi. Mais si Blanc la prend en D1, le groupe de droite reste en atari : tu le captures en E1."
  },
  {
    id: 'j12', size: 9, difficulty: 780, answers: ['E3'],
    setup: { rows: [E, E, E, E, E, E, '.O.....O.', '..XXTXX..', E], toPlay: 'B',
      refutation: "Pas tout à fait. En E1, Blanc s'allonge en E3 et a trois libertés : sa pierre s'échappe, et tes pierres restent coupées. Mets-la en atari par le haut, pour la pousser vers le bord." },
    title: 'Capture pour relier',
    prompt: 'Capture la pierre marquée en trois coups au plus. Elle coupe tes pierres en deux.',
    explanation: "Bravo ! E3 met la pierre en atari (il ne lui reste qu'une liberté, E1) et la pousse vers le bord. Si Blanc s'allonge en E1, ses deux pierres ont deux libertés, D1 et F1. Tu en prends une, par exemple D1 : Blanc s'allonge en F1 et n'a plus que G1. Tu captures en G1. Tes deux groupes sont reliés."
  },
];

export default LOT_J_CAPTURES;
