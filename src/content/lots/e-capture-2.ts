// Lot E (issue #91) : variantes de capture et d'atari, difficulté 350 à 750.
// Même contenu que la migration 20260927190500_lot_e_capture ; chaque position est prouvée par src/go/lot-e.test.ts.
// `setup.refutation` est le texte affiché après une erreur.
import type { PuzzleRow } from '../../data/puzzles';

const E = '.........';

const LOT_E: PuzzleRow[] = [
  {
    id: 'e01', size: 9, difficulty: 350, answers: ['E4'],
    setup: { rows: [E, E, E, '...XX....', '..XOTX...', '...X.....', E, E, E], toPlay: 'B',
      refutation: "Pas encore. Les deux pierres blanches se touchent : elles forment un groupe et partagent leurs libertés. Un seul point vide les touche encore." },
    title: 'Deux pierres au centre',
    prompt: 'Capture tout de suite les deux pierres blanches.',
    explanation: "Bravo ! Les libertés d'un groupe sont les points vides qui le touchent. Ces deux pierres n'en avaient plus qu'une, E4 : elles étaient en atari. En E4, tu les captures toutes les deux."
  },
  {
    id: 'e02', size: 9, difficulty: 380, answers: ['E2'],
    setup: { rows: [E, E, E, E, E, E, E, '..XX.....', '.XOTOX...'], toPlay: 'B',
      refutation: "Pas encore. Les trois pierres blanches du bord forment un seul groupe. Fais-en le tour : il ne lui reste qu'un point vide." },
    title: 'Trois pierres au bord',
    prompt: 'Capture tout de suite les trois pierres blanches du bord.',
    explanation: "Exact ! Les pierres qui se touchent forment un groupe, et ses libertés sont les points vides qui le touchent. Ici, il n'en restait qu'une, E2 : le groupe était en atari. Tu prends trois pierres d'un coup."
  },
  {
    id: 'e03', size: 9, difficulty: 420, answers: ['E8'],
    setup: { rows: [E, E, '...XTX...', '...OSO...', E, E, E, E, E], toPlay: 'B',
      refutation: "Pas celle-là. Ta pierre marquée est en atari, mais la pierre blanche qui la serre par le haut l'est aussi : elle n'a plus qu'un point vide, au-dessus d'elle." },
    title: 'Prends celle qui te serre',
    prompt: 'Ta pierre marquée est en atari. Capture tout de suite la pierre blanche marquée.',
    explanation: "Bien joué ! Les libertés sont les points vides à côté d'une pierre. La pierre blanche E7 n'en avait qu'une, E8 : elle était en atari. En la capturant, ta pierre E6 retrouve de l'air : deux libertés, E7 et E5."
  },
  {
    id: 'e04', size: 9, difficulty: 480, answers: ['B1'],
    setup: { rows: [E, E, E, E, E, E, E, '..XOO....', '..TSS.O..'], toPlay: 'B',
      refutation: "Pas tout à fait. Tes deux pierres marquées n'ont qu'une liberté, F1. Si tu t'y allonges, il ne leur reste que F2 : toujours en atari. La pierre blanche C1, elle, n'a plus qu'un point vide." },
    title: 'Sauve-toi par la gauche',
    prompt: 'Tes pierres marquées sont en atari. Capture tout de suite la pierre blanche marquée pour les sauver.',
    explanation: "Excellent ! Les libertés sont les points vides à côté d'un groupe. La pierre blanche C1 n'en avait qu'une, B1 : elle était en atari, et tu la captures. Tes pierres D1 et E1 ont maintenant deux libertés, C1 et F1. En F1, elles seraient restées en atari."
  },
  {
    id: 'e05', size: 9, difficulty: 520, answers: ['E3'],
    setup: { rows: [E, E, E, E, '....X....', '...XT.X..', '.....X...', E, E], toPlay: 'B',
      refutation: "Pas celle-là. Après F4, Blanc s'allonge en E3, vers le bas : il retrouve deux libertés, D3 et E2, et tu ne peux plus le capturer à temps. Pousse-le vers tes pierres F3 et G4." },
    title: 'Vers tes deux pierres',
    prompt: 'Mets la pierre marquée en atari en la poussant vers tes pierres, puis capture-la.',
    explanation: "Bravo ! Mettre en atari, c'est ne laisser qu'une liberté (un point vide à côté) à une pierre. Après E3, il ne lui reste que F4. Si Blanc s'y allonge, tes pierres F3 et G4 l'attendent : son groupe n'a toujours qu'une liberté, F5, et tu le captures."
  },
  {
    id: 'e06', size: 9, difficulty: 560, answers: ['E2', 'F1'],
    setup: { rows: [E, E, E, E, E, E, E, '...X.X...', '..XTO....'], toPlay: 'B',
      refutation: "Pas encore. Le groupe blanc a deux libertés, E2 et F1. Retire-lui-en une tout de suite : tes pierres D2 et F2 font le reste." },
    title: 'Deux libertés sur le bord',
    prompt: 'Capture les deux pierres blanches du bord en deux coups.',
    explanation: "Exact ! Le groupe avait deux libertés (points vides à côté de lui), E2 et F1. Tu en prends une : il est en atari. S'il s'allonge, tes pierres D2 et F2 lui bouchent la route : il reste en atari et tu le captures. Les deux mises en atari marchent."
  },
  {
    id: 'e07', size: 9, difficulty: 600, answers: ['D6'],
    setup: { rows: [E, E, '.XX.X....', '.XT.TX...', E, E, E, E, E], toPlay: 'B',
      refutation: "Pas tout à fait. Si tu ne menaces qu'une pierre, Blanc joue D6 : il relie ses deux pierres et leur donne assez de libertés. Joue ce point avant lui." },
    title: 'Double atari au centre',
    prompt: 'Un seul coup met les deux pierres marquées en atari. Joue-le, puis capture.',
    explanation: "Bravo ! Chaque pierre blanche avait deux libertés (points vides à côté d'elle), dont D6 en commun. En D6, il ne leur en reste qu'une chacune, C5 et E5 : c'est un double atari. Blanc en sauve une, tu prends l'autre."
  },
  {
    id: 'e08', size: 9, difficulty: 630, answers: ['B3'],
    setup: { rows: [E, E, E, E, '.X.......', '.TX......', E, E, E], toPlay: 'B',
      refutation: "Pas celle-là. Après A4, Blanc s'allonge en B3, vers l'intérieur : il a trois libertés et s'échappe. Pousse-le plutôt contre le bord." },
    title: 'Contre le bord gauche',
    prompt: 'Mets la pierre marquée en atari du bon côté, puis capture-la.',
    explanation: "Exact ! Après B3, la pierre n'a plus qu'une liberté (un point vide à côté), A4 : elle est en atari. Si Blanc s'allonge en A4, son groupe n'a que deux libertés sur le bord, A3 et A5. Tu en prends une, il s'allonge, et tu le captures au coup suivant. Le bord ne laisse pas de place pour fuir."
  },
  {
    id: 'e09', size: 9, difficulty: 680, answers: ['F2'],
    setup: { rows: [E, E, E, E, E, E, '...XX....', '..XTO....', E], toPlay: 'B',
      refutation: "Pas encore. Le groupe blanc a trois libertés : D1, E1 et F2. Seule F2 mène vers le centre : ferme-la d'abord, le bord fera le reste." },
    title: 'Ferme la sortie',
    prompt: 'Capture les deux pierres blanches en trois coups au plus.',
    explanation: "Superbe ! Le groupe avait trois libertés (points vides à côté de lui), D1, E1 et F2. En F2, tu fermes la seule sortie vers le centre. Il ne lui reste que D1 et E1, sur le bord : s'il s'allonge, chaque fois tu le remets en atari (une seule liberté), jusqu'à le capturer."
  }
];

export default LOT_E;
