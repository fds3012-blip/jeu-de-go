// Lot C de l'issue #91 : vie et mort, du débutant au confirmé (m01 à m13), 9 × 9, Noir au trait.
// Même contenu que la migration 20260927170300_lot_c_vie_mort ; chaque position est prouvée par
// src/go/lot-c.test.ts (recherche complète dans l'espace clos, sans seki ni ko).
import type { PuzzleRow } from '../../data/puzzles';

const lot: PuzzleRow[] = [
  {
    id: 'm01', size: 9, difficulty: 500, answers: ['E1'],
    setup: { rows: ['.........', '.........', '.........', '.........', '.........', '.........', '.OOOOOOO.', '.OSXXXXO.', '.OX...XO.'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue E1, au milieu de ton espace : il ne te reste plus qu'un œil, et ton groupe finit capturé." },
    title: 'Trois en ligne',
    prompt: 'Noir joue et vit. Ton groupe a trois points vides en ligne sur le bord.',
    explanation: "Bravo ! E1 coupe ton espace en deux yeux, D1 et F1. Un œil est un point vide entouré par tes pierres, où Blanc ne peut pas jouer : ce serait un suicide. Avec deux yeux, ton groupe est vivant pour toujours. Retiens : trois en ligne, on joue au milieu."
  },
  {
    id: 'm02', size: 9, difficulty: 550, answers: ['A5'],
    setup: { rows: ['.........', 'XXX......', 'OOX......', '.TX......', '.OX......', '.OX......', 'OOX......', 'XXX......', '.........'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue A5, au milieu : il fait deux yeux, A6 et A4, et son groupe est vivant." },
    title: 'Le milieu des trois',
    prompt: 'Noir joue et tue. Le groupe blanc a trois points vides en ligne sur le bord gauche.',
    explanation: "Exact ! En A5, tu empêches Blanc de faire deux yeux (deux points vides entourés par ses pierres). Il ne lui reste qu'un espace trop petit pour vivre : quoi qu'il fasse, son groupe finit capturé. Le point du milieu est le point vital : le point clé pour les deux joueurs."
  },
  {
    id: 'm03', size: 9, difficulty: 650, answers: ['E1'],
    setup: { rows: ['.........', '.........', '.........', '.........', '.........', '.OOOOOO..', '.OSXXXO..', '.OXX.XO..', '.OX..XO..'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue E1, le point qui touche les deux autres : il ne te reste qu'un œil et ton groupe finit capturé." },
    title: 'Le coude sur le bord',
    prompt: 'Noir joue et vit. Trois points vides en forme de coude : trouve le point vital.',
    explanation: "Bien joué ! E1 touche les deux autres points vides : c'est le point vital, le point clé pour les deux joueurs. Il te laisse deux yeux, D1 et E2. Un œil est un point vide entouré par tes pierres, où Blanc ne peut pas jouer. Ton groupe est vivant."
  },
  {
    id: 'm04', size: 9, difficulty: 700, answers: ['F9'],
    setup: { rows: ['..XO..OX.', '..XOT.OX.', '..XOOOOX.', '..XXXXXX.', '.........', '.........', '.........', '.........', '.........'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue F9, le coin du coude : il fait deux yeux, E9 et F8, et son groupe est vivant." },
    title: 'Tue le coude',
    prompt: 'Noir joue et tue. Le groupe blanc a trois points vides en forme de coude.',
    explanation: "Bravo ! F9 est le point vital du coude : le point qui touche les deux autres. Blanc ne peut plus faire deux yeux (deux points vides entourés par ses pierres). Quoi qu'il fasse, son groupe finit capturé."
  },
  {
    id: 'm05', size: 9, difficulty: 750, answers: ['A1'],
    setup: { rows: ['.........', '.........', '.........', '.........', '.........', 'XXXX.....', 'OOOX.....', '.TOX.....', '..OX.....'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue A1, le coin : il fait deux yeux, A2 et B1, et son groupe est vivant." },
    title: 'Le coude dans le coin',
    prompt: 'Noir joue et tue. Le groupe blanc a trois points vides en coude, dans le coin.',
    explanation: "Exact ! A1 touche les deux autres points vides : c'est le point vital, le point clé pour les deux joueurs. Blanc ne peut plus faire deux yeux (deux points vides entourés par ses pierres). Quoi qu'il fasse, son groupe finit capturé."
  },
  {
    id: 'm06', size: 9, difficulty: 800, answers: ['E1'],
    setup: { rows: ['.........', '.........', '.........', '.........', '.........', '.........', 'OOOOOOOO.', 'OSXXXXXO.', 'OX.O..XO.'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue E1 et relie sa pierre D1 : ton espace devient trop petit, il ne te reste qu'un œil et ton groupe finit capturé. Le bon point est collé à la pierre blanche." },
    title: 'La pierre dans ton camp',
    prompt: 'Noir joue et vit. Une pierre blanche est entrée dans ton espace.',
    explanation: "Parfait ! E1 met la pierre blanche D1 en atari : il ne lui reste qu'une liberté, C1, et Blanc ne peut pas y jouer, ce serait un suicide. F1 est déjà un œil (un point vide entouré par tes pierres). Tu captures D1 quand tu veux, et son point devient ton deuxième œil. Ton groupe est vivant."
  },
  {
    id: 'm07', size: 9, difficulty: 900, answers: ['B1'],
    setup: { rows: ['.........', '.........', '.........', '.........', '.........', 'XXXXX....', 'OOOOX....', '..TOX....', '...OX....'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue B1, le point central : C1 devient un œil, et il en fait un second dans le coin. Son groupe est vivant." },
    title: 'Le cinq en bloc',
    prompt: 'Noir joue et tue. Le groupe blanc a cinq points vides dans le coin : un carré de quatre et un point de plus.',
    explanation: "Superbe ! Cette forme s'appelle le cinq en bloc (bulky five). Son point vital, B1, touche trois des quatre autres points. Si Blanc y jouait, il ferait deux yeux ; en le prenant, tu lui laisses un seul espace. Blanc ne peut plus faire deux yeux (deux points vides entourés par ses pierres) : son groupe finit capturé."
  },
  {
    id: 'm08', size: 9, difficulty: 1000, answers: ['C8'],
    setup: { rows: ['.OO.OX...', 'OO.OTX...', 'XXXOOX...', 'XXXXXX...', '.........', '.........', '.........', '.........', '.........'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue C8 : toutes ses pierres sont reliées, avec deux vrais yeux, A9 et D9. Son groupe est vivant." },
    title: 'Le faux œil',
    prompt: 'Noir joue et tue. Blanc semble avoir deux yeux, A9 et D9. Regarde les points en diagonale.',
    explanation: "Bien vu ! C8 coupe les pierres blanches en deux groupes. D9 n'est plus qu'un faux œil : un point vide entouré de pierres blanches qui ne sont pas reliées entre elles. Les pierres de droite n'ont plus que D9 comme liberté. Si Blanc se relie en D9, tout son groupe n'a plus qu'une liberté, A9, et tu le captures. Un seul vrai œil ne suffit pas pour vivre."
  },
  {
    id: 'm09', size: 9, difficulty: 1050, answers: ['D8'],
    setup: { rows: ['XO.OO.OX.', 'XOO.OTOX.', 'XXXXXXXX.', '.........', '.........', '.........', '.........', '.........', '.........'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue D8 : toutes ses pierres sont reliées, avec deux vrais yeux, C9 et F9. Son groupe est vivant." },
    title: 'Faux œil sur le bord',
    prompt: 'Noir joue et tue. Blanc a deux yeux, C9 et F9 : l’un d’eux peut devenir faux.',
    explanation: "Superbe ! D8 sépare les pierres blanches de gauche de celles de droite. C9 devient un faux œil : un point vide entouré de pierres qui ne sont pas reliées entre elles. Les trois pierres de gauche n'ont plus que C9 comme liberté. Si Blanc se relie en C9, tout son groupe n'a plus qu'une liberté, F9, et tu le captures. Un seul vrai œil ne suffit pas pour vivre."
  },
  {
    id: 'm10', size: 9, difficulty: 1100, answers: ['E1'],
    setup: { rows: ['.........', '.........', '.........', '.........', '.........', '.OOOOOOO.', '.OXXXXXO.', '.OXX.XXO.', '.OS...XO.'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue E1, le point qui touche les trois autres : il ne te reste qu'un œil et ton groupe finit capturé." },
    title: 'Le chapeau',
    prompt: 'Noir joue et vit. Quatre points vides en forme de chapeau : un seul point les touche tous.',
    explanation: "Parfait ! Cette forme de quatre points s'appelle le chapeau (ou pyramide). Son point vital, E1, touche les trois autres : c'est le point clé pour les deux joueurs. En le prenant, tu fais trois yeux, D1, F1 et E2. Un œil est un point vide entouré par tes pierres, où Blanc ne peut pas jouer. Deux suffisent : ton groupe est vivant."
  },
  {
    id: 'm11', size: 9, difficulty: 1150, answers: ['E1'],
    setup: { rows: ['.........', '.........', '.........', '.........', '.........', '.XXXXXXX.', '.XOOOOOX.', '.XOO.OOX.', '.XT...OX.'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue E1, le point qui touche les trois autres : il fait deux yeux au moins, et son groupe est vivant." },
    title: 'Tue le chapeau',
    prompt: 'Noir joue et tue. Le groupe blanc a quatre points vides en forme de chapeau.',
    explanation: "Bravo ! E1 est le point vital du chapeau : il touche les trois autres points vides. Blanc ne peut plus faire deux yeux (deux points vides entourés par ses pierres). Quoi qu'il fasse, son groupe finit capturé. Même forme que pour vivre : le point vital est le même pour les deux joueurs."
  },
  {
    id: 'm12', size: 9, difficulty: 1200, answers: ['E2'],
    setup: { rows: ['.........', '.........', '.........', '.........', '.OOOOOOO.', '.OXXXXXO.', '.OXX.XXO.', '.OX...XO.', '.OSX.XXO.'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue E2, au centre de la croix : il ne te reste qu'un œil et ton groupe finit capturé." },
    title: 'Cinq en croix',
    prompt: 'Noir joue et vit. Cinq points vides en forme de croix : où est le point vital ?',
    explanation: "Superbe ! Le point vital d'une croix de cinq points est son centre, E2 : il touche les quatre autres. En le prenant, tu fais quatre yeux, D2, F2, E3 et E1. Un œil est un point vide entouré par tes pierres, où Blanc ne peut pas jouer. Deux suffisent : ton groupe est vivant."
  },
  {
    id: 'm13', size: 9, difficulty: 1250, answers: ['E2'],
    setup: { rows: ['.........', '.........', '.........', '.........', '.XXXXXXX.', '.XOOOOOX.', '.XOO.OOX.', '.XO...OX.', '.XTO.OOX.'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue E2, au centre de la croix : il fait plusieurs yeux, et son groupe est vivant." },
    title: 'Tue la croix',
    prompt: 'Noir joue et tue. Le groupe blanc a cinq points vides en forme de croix.',
    explanation: "Bravo ! E2, le centre de la croix, touche les quatre autres points vides : c'est le point vital. Blanc ne peut plus faire deux yeux (deux points vides entourés par ses pierres). Quoi qu'il fasse, son groupe finit capturé."
  }
];

export default lot;
