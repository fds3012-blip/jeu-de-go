// Lot I de l'issue #136 : vie et mort de haut niveau (formes de cinq et six points, bord), 9 × 9, Noir au trait.
// Aucun seki, aucun ko. Même contenu que la migration 20260928000100_lot_i ; chaque position est prouvée par
// src/go/lot-i.test.ts (recherche complète dans l'espace clos, comme le lot C). `setup.refutation` est le texte
// affiché après une erreur.
import type { PuzzleRow } from '../../data/puzzles';

const LOT_I: PuzzleRow[] = [
  {
    id: 'i01', size: 9, difficulty: 1120, answers: ['E2'],
    setup: { rows: ['.........', '.........', '.........', '.........', '.........', '.XXXXXXX.', '.XOOOOOX.', '.XO...OX.', '.XT..OOX.'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue E2, le point qui touche trois des quatre autres : il fait deux yeux, et son groupe est vivant." },
    title: 'Cinq en bloc sur le bord',
    prompt: 'Noir joue et tue. Le groupe blanc a cinq points vides sur le bord : un carré de quatre et un point de plus.',
    explanation: "Bravo ! Cette forme s'appelle le cinq en bloc. Son point vital, E2, touche trois des quatre autres points vides. En le prenant, tu empêches Blanc de faire deux yeux (deux points vides entourés par ses pierres). Quoi qu'il fasse, son groupe finit capturé."
  },
  {
    id: 'i02', size: 9, difficulty: 1150, answers: ['B1'],
    setup: { rows: ['.........', '.........', '.........', '.........', '.........', '.........', 'OOOOOOOOO', 'XXXXSOOOO', '...X.....'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue B1 : dans le coin, tu ne peux plus faire deux yeux (deux points vides entourés par tes pierres). Ton groupe ne peut plus vivre." },
    title: 'Deux yeux dans le coin',
    prompt: 'Noir joue et vit. Ton groupe est sur la deuxième ligne, dans le coin. Un seul coup fait deux yeux.',
    explanation: "Bravo ! B1 fait deux yeux d'un coup : A1 et C1. Un œil est un point vide entouré par tes pierres, où Blanc ne peut pas jouer : ce serait un suicide. Ta pierre D1 ferme le second œil. Avec deux yeux, ton groupe est vivant pour toujours."
  },
  {
    id: 'i03', size: 9, difficulty: 1180, answers: ['B1'],
    setup: { rows: ['.........', '.........', '.........', '.........', '.........', '.........', 'OOOOOOOOO', 'XXXXSOOOO', '..O......'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue B1 et relie sa pierre C1 : tu ne peux plus faire deux yeux (deux points vides entourés par tes pierres). Ton groupe ne peut plus vivre." },
    title: "L'intrus dans le coin",
    prompt: 'Noir joue et vit. Une pierre blanche est entrée dans ton coin, en C1.',
    explanation: "Bravo ! B1 fait un œil en A1 et met la pierre C1 en atari : il ne lui reste qu'une liberté, D1. Si Blanc s'allonge en D1, ses deux pierres n'ont plus qu'une liberté, E1 : tu les captures, et leur place te donne le second œil. Un œil est un point vide entouré par tes pierres, où Blanc ne peut pas jouer."
  },
  {
    id: 'i04', size: 9, difficulty: 1200, answers: ['E1'],
    setup: { rows: ['.........', '.........', '.........', '.........', '.........', '.........', 'OOOOOOOOO', 'XXXXSOOOO', '...O.....'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue E1 et donne une liberté de plus à sa pierre D1 : ton coin devient trop petit pour deux yeux. Ton groupe ne peut plus vivre." },
    title: 'Ferme le bord',
    prompt: 'Noir joue et vit. Une pierre blanche est entrée dans ton espace, en D1.',
    explanation: "Superbe ! E1 met la pierre D1 en atari : il ne lui reste qu'une liberté, C1. Si Blanc s'allonge en C1, B1 capture les deux pierres. Sinon, tu captures D1 en C1. Dans les deux cas, tu gardes assez de place pour deux yeux (deux points vides entourés par tes pierres)."
  },
  {
    id: 'i05', size: 9, difficulty: 1220, answers: ['B1'],
    setup: { rows: ['.........', '.........', '.........', '.........', '.........', '.........', 'OOOOOOOOO', 'OXXXXXSOO', '...X.....'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue B1 : à gauche de D1, tu ne peux plus faire d'œil, et un seul œil à droite ne suffit pas. Ton groupe ne peut plus vivre." },
    title: 'Le bon ordre',
    prompt: "Noir joue et vit. Tu peux faire un œil à gauche de D1 et un autre à droite. Par où commencer ?",
    explanation: "Superbe ! B1 fait tout de suite un œil en C1 : un point vide entouré par tes pierres, où Blanc ne peut pas jouer. À droite, tu as deux façons de faire le second œil : si Blanc joue F1, tu réponds G1 ; s'il joue G1, tu réponds F1. Blanc ne peut pas prendre les deux. Retiens : commence par l'endroit où tu n'as qu'une seule façon de faire un œil."
  },
  {
    id: 'i06', size: 9, difficulty: 1250, answers: ['E1'],
    setup: { rows: ['.........', '.........', '.........', '.........', '.........', '.........', 'XXXXXXXXX', 'OOOOTXXXX', '..O......'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue E1 : D1 devient un œil, et il en fait un second dans le coin. Son groupe est vivant." },
    title: 'Réduis le coin',
    prompt: 'Noir joue et tue. Le groupe blanc est sur la deuxième ligne, dans le coin, avec une pierre en C1.',
    explanation: "Bravo ! E1 empêche l'œil en D1 : ce point touche ta pierre, il n'est plus entouré par Blanc. Pour capturer E1, Blanc devrait remplir D1 lui-même. Il ne lui reste que le coin, A1 et B1 : un seul œil, et il en faut deux (deux points vides entourés par ses pierres). En D1, ta pierre n'aurait eu qu'une liberté : Blanc l'aurait capturée en E1."
  },
  {
    id: 'i07', size: 9, difficulty: 1280, answers: ['B1'],
    setup: { rows: ['.........', '.........', '.........', '.........', '.........', '.........', 'XXXXXXXXX', 'XOOOOOOTX', '...O.....'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue B1 : il fait un œil en C1, et un second à droite de D1. Son groupe est vivant." },
    title: 'Réduis par le bord',
    prompt: 'Noir joue et tue. La pierre blanche D1 partage l’espace de Blanc en deux parties.',
    explanation: "Bravo ! B1 empêche l'œil de gauche : C1 touche ta pierre, ce n'est plus un point entouré par Blanc. À droite, il reste E1, F1, G1 et H1 : si Blanc joue F1, tu joues H1 ; s'il joue H1, tu joues F1. Blanc ne peut plus faire deux yeux (deux points vides entourés par ses pierres) : son groupe finit capturé."
  },
  {
    id: 'i08', size: 9, difficulty: 1350, answers: ['E2'],
    setup: { rows: ['.........', '.........', '.........', '.........', '.XXXXXXX.', '.XXOOOXX.', '.XOO.OOX.', '.XO...OX.', '.XT..OOX.'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue E2, au centre de son espace : il fait deux yeux au moins, et son groupe est vivant." },
    title: 'Le lapin',
    prompt: 'Noir joue et tue. Le groupe blanc a six points vides. Six points, est-ce assez pour vivre ?',
    explanation: "Superbe ! Cette forme de six points s'appelle le lapin (rabbity six) : une croix de cinq, plus un point en diagonale. Son point vital, E2, touche quatre des cinq autres points. En le prenant, tu empêches Blanc de faire deux yeux (deux points vides entourés par ses pierres). Quoi qu'il fasse, son groupe finit capturé. Six points ne suffisent pas toujours : la forme compte plus que la taille."
  },
];

export default LOT_I;
