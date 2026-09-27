// Lot A (issue #91) : capture et atari, niveau débutant, difficulté 300 à 650.
// Même contenu que la migration 20260927170100_lot_a_capture ; chaque position est prouvée par src/go/lot-a.test.ts.
// `setup.refutation` est le texte affiché après une erreur.
import type { PuzzleRow } from '../../data/puzzles';

const E = '.........';

const LOT_A: PuzzleRow[] = [
  {
    id: 'a01', size: 9, difficulty: 300, answers: ['E4'],
    setup: { rows: [E, E, E, '....X....', '...XTX...', E, E, E, E], toPlay: 'B',
      refutation: "Pas encore. La pierre blanche a toujours un point vide à côté d'elle, en E4. Tant que ce point est libre, elle reste sur le plateau." },
    title: 'Première capture',
    prompt: 'Capture tout de suite la pierre blanche marquée.',
    explanation: "Bravo ! Les points vides juste à côté d'une pierre sont ses libertés. La pierre blanche n'en avait plus qu'une, E4 : elle était en atari. En occupant E4, tu lui retires sa dernière liberté et tu la captures."
  },
  {
    id: 'a02', size: 9, difficulty: 320, answers: ['E2'],
    setup: { rows: [E, E, E, E, E, E, E, E, '...XTX...'], toPlay: 'B',
      refutation: "Pas encore. Sur le bord, une pierre a moins de libertés. Celle-ci n'en a plus qu'une : cherche le point vide juste au-dessus d'elle." },
    title: 'Capture au bord',
    prompt: 'Capture tout de suite la pierre blanche marquée, sur le bord.',
    explanation: "Exact ! Les libertés d'une pierre sont les points vides juste à côté d'elle. Au bord, il n'y en a que trois au départ. Ici, il n'en restait qu'une, E2 : la pierre était en atari, et E2 la capture."
  },
  {
    id: 'a03', size: 9, difficulty: 340, answers: ['A2'],
    setup: { rows: [E, E, E, E, E, E, E, E, 'TX.......'], toPlay: 'B',
      refutation: "Pas encore. Dans le coin, une pierre n'a que deux libertés au départ. Ta pierre B1 en occupe déjà une : il reste l'autre." },
    title: 'Capture dans le coin',
    prompt: 'Capture tout de suite la pierre blanche marquée, dans le coin.',
    explanation: "Bien joué ! Les libertés d'une pierre sont les points vides juste à côté d'elle. Dans le coin, il n'y en a que deux. Ta pierre B1 en prenait une ; la pierre blanche était donc en atari (une seule liberté), et A2 la capture."
  },
  {
    id: 'a04', size: 9, difficulty: 380, answers: ['E2'],
    setup: { rows: [E, E, E, E, E, E, E, '...X.....', '..XTOX...'], toPlay: 'B',
      refutation: "Pas encore. Les deux pierres blanches se touchent : elles forment un seul groupe et partagent leurs libertés. Il ne leur en reste qu'une." },
    title: 'Deux pierres au bord',
    prompt: 'Capture tout de suite les deux pierres blanches, sur le bord.',
    explanation: "Parfait ! Deux pierres qui se touchent par un côté forment un groupe : elles vivent et meurent ensemble. Ce groupe n'avait plus qu'une liberté (un point vide à côté de lui), E2. Il était en atari : E2 prend les deux pierres d'un coup."
  },
  {
    id: 'a05', size: 9, difficulty: 400, answers: ['A3'],
    setup: { rows: [E, E, E, E, E, E, E, 'TX.......', 'OX.......'], toPlay: 'B',
      refutation: "Pas encore. Les deux pierres blanches du coin forment un seul groupe. Compte ses libertés : il ne lui reste qu'un point vide, au-dessus." },
    title: 'Deux pierres dans le coin',
    prompt: 'Capture tout de suite les deux pierres blanches du coin.',
    explanation: "Très bien ! Les pierres A1 et A2 se touchent : c'est un groupe. Ses libertés, les points vides à côté de lui, se réduisaient à A3. Il était en atari ; A3 capture les deux pierres."
  },
  {
    id: 'a06', size: 9, difficulty: 420, answers: ['E4'],
    setup: { rows: [E, E, E, '...XXX...', '..XOTOX..', '...X.X...', E, E, E], toPlay: 'B',
      refutation: "Pas encore. Les trois pierres blanches forment un seul groupe. Regarde tout autour : un seul point vide le touche encore." },
    title: 'Un groupe de trois',
    prompt: 'Capture tout de suite le groupe de trois pierres blanches.',
    explanation: "Bravo ! Un groupe se capture comme une pierre seule : on occupe toutes ses libertés, les points vides qui le touchent. Il ne lui restait que E4 : il était en atari. Tu prends trois pierres d'un coup."
  },
  {
    id: 'a07', size: 9, difficulty: 450, answers: ['A2'],
    setup: { rows: [E, E, E, E, E, E, '.O.......', '.SO......', 'TX.O.....'], toPlay: 'B',
      refutation: "Pas tout à fait. Tes deux pierres n'ont que deux libertés. Si tu t'allonges en C1, elles n'en ont plus qu'une et Blanc les capture en A2. Regarde plutôt la pierre blanche du coin : elle est en atari." },
    title: 'Capture pour te sauver',
    prompt: 'Tes pierres sont menacées. Capture tout de suite la pierre blanche marquée pour les sauver.',
    explanation: "Exact ! La pierre A1 n'avait qu'une liberté (un point vide à côté d'elle), A2 : elle était en atari. En la capturant, tes pierres gagnent de l'air : elles ont maintenant trois libertés, A1, A3 et C1. Capturer une pierre qui te serre, c'est souvent la meilleure défense."
  },
  {
    id: 'a08', size: 9, difficulty: 460, answers: ['D8'],
    setup: { rows: ['..XTS.O..', '....OO...', E, E, E, E, E, E, E], toPlay: 'B',
      refutation: "Pas tout à fait. Ta pierre marquée n'a qu'une liberté, F9, et s'y allonger serait un suicide : ta pierre n'aurait plus aucun point vide. La pierre blanche D9, elle, est en atari." },
    title: 'Sors de la boîte',
    prompt: "Ta pierre marquée ne peut pas s'allonger. Capture tout de suite la pierre blanche marquée pour la sauver.",
    explanation: "Bravo ! Les libertés sont les points vides à côté d'une pierre. La pierre blanche D9 n'en avait qu'une, D8 : elle était en atari, et tu la captures. Ta pierre E9 gagne une liberté en D9 et garde F9. En F9, elle n'en aurait eu aucune : un coup interdit, le suicide."
  },
  {
    id: 'a09', size: 9, difficulty: 480, answers: ['F2'],
    setup: { rows: [E, E, E, E, E, E, '....X....', '...XT....', E], toPlay: 'B',
      refutation: "Pas celle-là. Après E1, Blanc s'allonge en F2, vers le centre : il a trois libertés et s'échappe. Mets-le en atari de l'autre côté, pour le pousser vers le bord." },
    title: 'Pousse vers le bord',
    prompt: "Mets la pierre marquée en atari du bon côté, puis capture-la.",
    explanation: "Bien vu ! Mettre en atari, c'est laisser une seule liberté (un point vide à côté) à une pierre. Après F2, Blanc s'allonge en E1, mais sur le bord il n'a que deux libertés, D1 et F1. Tu joues D1 : atari. Il s'allonge en F1, et tu le captures en G1. Le bord est un mur : pousse l'adversaire contre lui."
  },
  {
    id: 'a10', size: 9, difficulty: 520, answers: ['E4'],
    setup: { rows: [E, E, E, '....XX...', '...XT.X..', E, E, E, E], toPlay: 'B',
      refutation: "Pas celle-là. Après F5, Blanc s'allonge en E4, vers le bas : il a trois libertés et s'échappe. Pousse-le plutôt vers tes pierres F6 et G5." },
    title: 'Vers tes pierres',
    prompt: "Mets la pierre marquée en atari en la poussant vers tes pierres, et capture-la.",
    explanation: "Excellent ! La pierre avait deux libertés (points vides à côté d'elle), E4 et F5. Après E4, elle est en atari : il ne lui reste que F5. Si Blanc s'allonge en F5, tes pierres F6 et G5 l'attendent : il n'a toujours qu'une liberté, F4, et tu le captures."
  },
  {
    id: 'a11', size: 9, difficulty: 540, answers: ['D2'],
    setup: { rows: [E, E, E, E, E, E, '..X.X....', '.XT.TX...', E], toPlay: 'B',
      refutation: "Pas tout à fait. Si tu mets une seule pierre en atari, Blanc joue D2 : il relie ses deux pierres et s'échappe. Cherche le point qui touche les deux." },
    title: 'Double atari au bord',
    prompt: 'Un seul coup menace les deux pierres marquées. Trouve-le, puis capture.',
    explanation: "Bravo ! En D2, tu mets les deux pierres en atari à la fois : il ne reste à chacune qu'une liberté (un point vide à côté d'elle), C1 pour l'une, E1 pour l'autre. C'est un double atari. Blanc ne peut en sauver qu'une ; tu captures l'autre au coup suivant."
  },
  {
    id: 'a12', size: 9, difficulty: 560, answers: ['B2'],
    setup: { rows: [E, E, E, E, E, E, '..X......', '..TX.....', E], toPlay: 'B',
      refutation: "Pas celle-là. Après C1, Blanc s'allonge en B2, vers l'extérieur : il a trois libertés et s'échappe. Pousse-le vers le coin." },
    title: 'Pousse vers le coin',
    prompt: 'Mets la pierre marquée en atari du bon côté, puis capture-la.',
    explanation: "Exact ! Après B2, la pierre est en atari : une seule liberté (point vide à côté), C1. Si Blanc s'allonge en C1, il n'a que deux libertés, B1 et D1. Tu joues D1, il s'allonge en B1, et tu le captures en A1. Le coin est l'endroit où l'on a le moins de libertés."
  },
  {
    id: 'a13', size: 9, difficulty: 600, answers: ['C3'],
    setup: { rows: [E, E, E, E, E, '.X.X.....', 'XT.TX....', E, E], toPlay: 'B',
      refutation: "Pas tout à fait. Si tu ne menaces qu'une pierre, Blanc joue C3 : il relie ses deux pierres et leur donne assez de libertés. Cherche le point commun." },
    title: 'Le point commun',
    prompt: 'Les deux pierres marquées ont un point vide en commun. Joue le double atari, puis capture.',
    explanation: "Bien joué ! Chaque pierre avait deux libertés (points vides à côté d'elle), dont C3 en commun. En C3, tu mets les deux en atari à la fois : c'est un double atari. Blanc en sauve une, tu prends l'autre."
  },
  {
    id: 'a14', size: 9, difficulty: 650, answers: ['C7'],
    setup: { rows: ['XOOXX....', 'SXTOX....', '....X....', E, E, E, E, E, E], toPlay: 'B',
      refutation: "Pas le plus rapide. Compte les libertés : ton groupe marqué en a deux, A7 et B7, et le groupe blanc aussi, C7 et D7. Celui qui joue le premier gagne : retire une liberté au groupe blanc tout de suite." },
    title: 'Qui a le plus de libertés ?',
    prompt: 'Ton groupe marqué et le groupe blanc marqué se serrent. Capture le groupe blanc en deux coups.',
    explanation: "Bravo ! Les libertés sont les points vides à côté d'un groupe. Ton groupe en avait deux, le groupe blanc aussi : le premier qui joue gagne. Après C7, le groupe blanc est en atari (une seule liberté, D7). S'il s'allonge en D7, il reste en atari ; s'il attaque ton groupe, tu le captures en D7 avant."
  },
  // a15 à a17 : ajoutés ensuite pour combler les trous de la courbe (l'appli trie tout par difficulté).
  {
    id: 'a15', size: 9, difficulty: 360, answers: ['A4'],
    setup: { rows: [E, E, E, 'X........', 'TX.......', E, E, E, E], toPlay: 'B',
      refutation: "Pas encore. Sur le bord, la pierre blanche n'a que trois points vides autour d'elle au départ. Tes pierres en occupent deux : il reste le dernier, juste en dessous." },
    title: 'Capture sur le côté',
    prompt: 'Capture tout de suite la pierre blanche marquée, sur le bord gauche.',
    explanation: "Exact ! Les libertés d'une pierre sont les points vides juste à côté d'elle. Sur le bord, elle n'en a que trois. Tes pierres A6 et B5 en prenaient deux : la pierre était en atari (une seule liberté), et A4 la capture."
  },
  {
    id: 'a16', size: 9, difficulty: 440, answers: ['C1'],
    setup: { rows: [E, E, E, E, E, E, 'XX.......', 'OOX......', 'TO.......'], toPlay: 'B',
      refutation: "Pas encore. Les quatre pierres blanches du coin se touchent : c'est un seul groupe. Fais le tour : un seul point vide le touche encore." },
    title: 'Quatre pierres dans le coin',
    prompt: 'Capture tout de suite le groupe blanc du coin.',
    explanation: "Bravo ! Les pierres qui se touchent forment un groupe, et il partage ses libertés, les points vides à côté de lui. Celui-ci n'en avait plus qu'une, C1 : il était en atari. Tu captures quatre pierres d'un coup."
  },
  {
    id: 'a17', size: 9, difficulty: 470, answers: ['B6'],
    setup: { rows: [E, E, 'X........', 'T........', 'S.O......', 'O........', E, E, E], toPlay: 'B',
      refutation: "Pas tout à fait. Ta pierre marquée n'a qu'une liberté, B5. La pierre blanche A6, juste au-dessus, n'en a qu'une aussi : prends-la avant que Blanc ne prenne la tienne." },
    title: 'Sauve-toi sur le bord',
    prompt: 'Ta pierre marquée est en atari. Capture tout de suite la pierre blanche marquée pour la sauver.',
    explanation: "Bien joué ! Les libertés sont les points vides à côté d'une pierre. La pierre blanche A6 n'en avait qu'une, B6 : elle était en atari, et tu la captures. Ta pierre A5 respire : elle a maintenant deux libertés, A6 et B5."
  },
  {
    id: 'a18', size: 9, difficulty: 500, answers: ['E5'],
    setup: { rows: [E, E, '....X....', '...XTX...', '...X.X...', '...XOX...', '....X....', E, E], toPlay: 'B',
      refutation: "Pas encore. Regarde le point vide au milieu : les deux pierres blanches n'ont plus que lui comme liberté, et tes pierres D5 et F5 s'y relient." },
    title: 'Relie et capture',
    prompt: 'Un seul coup relie tes pierres et capture tout de suite.',
    explanation: "Superbe ! Les libertés sont les points vides à côté d'une pierre. Les pierres blanches E6 et E4 n'en avaient qu'une chacune, la même : E5. Elles étaient en atari. En E5, tu les captures toutes les deux et tu relies tes pierres D5 et F5."
  },
  {
    id: 'a19', size: 9, difficulty: 530, answers: ['G8'],
    setup: { rows: ['.....XTSX', '.......O.', E, E, E, E, E, E, E], toPlay: 'B',
      refutation: "Pas tout à fait. Tes deux pierres du coin n'ont qu'une liberté, J8. Si tu t'y allonges, elles n'en ont toujours qu'une, J7, et Blanc les capture. La pierre blanche G9, elle, est en atari." },
    title: 'Sors du coin',
    prompt: "Tes pierres du coin sont en atari. Capture tout de suite la pierre blanche marquée pour les sauver.",
    explanation: "Bravo ! Les libertés sont les points vides à côté d'un groupe. La pierre blanche G9 n'en avait qu'une, G8 : elle était en atari, et tu la captures. Tes pierres du coin gagnent une liberté en G9 et gardent J8 : elles en ont deux. En J8, elles seraient restées en atari."
  },
  {
    id: 'a20', size: 9, difficulty: 490, answers: ['D3'],
    setup: { rows: [E, E, E, E, E, E, '..X.X....', '..XOX....', '..XTX....'], toPlay: 'B',
      refutation: "Pas encore. Les deux pierres blanches coupent tes pierres en deux. Elles forment un seul groupe, et il ne lui reste qu'un point vide, au-dessus." },
    title: 'Enlève la coupe',
    prompt: 'Les pierres blanches coupent tes pierres. Capture-les tout de suite.',
    explanation: "Exact ! Les deux pierres blanches se touchent : c'est un groupe, avec une seule liberté (point vide à côté de lui), D3. Il était en atari. En D3, tu le captures, et tes pierres de gauche et de droite ne sont plus coupées."
  }
];

export default LOT_A;
