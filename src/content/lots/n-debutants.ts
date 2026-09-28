// Lot N de l'issue #136 : problèmes pour débutants, difficulté 300 à 700. Capturer en un ou deux coups (bord, coin,
// centre, plusieurs groupes), sauver une pierre en atari (s'allonger ou capturer), ne pas se mettre soi-même en atari,
// choisir la bonne pierre à capturer. 9 × 9, Noir au trait. Aucun ko.
// Même contenu que la migration 20260928040100_lot_n ; chaque position est prouvée par src/go/lot-n.test.ts
// (lecteur exact src/go/lecteurs-lot-n.ts, tous les coups légaux et la passe, avec et sans ko).
// Capturer : la réponse prend une pierre marquée (T) dans le nombre de coups annoncé, contre toute défense.
// Sauver : après la réponse, Blanc ne peut prendre aucune pierre marquée (S) en quatre coups, contre toute défense.
import type { PuzzleRow } from '../../data/puzzles';

const E = '.........';

const LOT_N: PuzzleRow[] = [
  {
    id: 'n01', size: 9, difficulty: 300, answers: ['E3'],
    setup: { rows: [E, E, '..X...O..', '....X....', '...XTX...', '...XOX...', '..O......', E, E], toPlay: 'B',
      refutation: "Pas tout à fait. Les deux pierres blanches n'ont qu'une liberté, E3. Si tu joues ailleurs, Blanc s'allonge en E3 et retrouve trois libertés." },
    title: 'Deux pierres d’un coup',
    prompt: 'Capture la pierre marquée en un coup.',
    explanation: "Bravo ! Les pierres E5 et E4 se touchent : elles forment une chaîne. Une chaîne partage ses libertés, les points vides juste à côté. Il n'en reste qu'une, E3 : la chaîne est en atari. Tu la remplis et tu captures les deux pierres."
  },
  {
    id: 'n02', size: 9, difficulty: 330, answers: ['F1'],
    setup: { rows: [E, E, E, '..X......', '.XOX.....', E, E, '......XXX', '......TTT'], toPlay: 'B',
      refutation: "Pas tout à fait. En C4, tu prends une pierre, mais Blanc joue F1 : ses trois pierres du bas ont de nouveau deux libertés, E1 et F2." },
    title: 'Le plus gros d’abord',
    prompt: 'Deux groupes blancs sont en atari (une seule liberté). Capture le plus gros, marqué, en un coup.',
    explanation: "Bravo ! F1 remplit la dernière liberté des trois pierres du bas : tu les captures toutes. Quand deux groupes sont en atari, prends d'abord le plus gros."
  },
  {
    id: 'n03', size: 9, difficulty: 360, answers: ['E4'],
    setup: { rows: ['.X.......', 'XOX......', E, '....O....', '...OSO...', E, E, E, E], toPlay: 'B',
      refutation: "Pas tout à fait. Tu prends B8, mais Blanc joue E4 et capture ta pierre. Quand une de tes pierres est en atari, sauve-la d'abord." },
    title: 'Sauve avant de prendre',
    prompt: 'Ta pierre marquée est en atari : il ne lui reste qu’une liberté. Sauve-la.',
    explanation: "Bravo ! En E4, ta pierre s'allonge : tes deux pierres forment une chaîne avec trois libertés, D4, F4 et E3. Elle est hors de danger. Prendre B8 était tentant, mais Blanc aurait pris ta pierre en E4."
  },
  {
    id: 'n04', size: 9, difficulty: 380, answers: ['C7'],
    setup: { rows: ['..O......', '.OSO.....', E, E, E, '.......X.', '......XOX', E, E], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue C7 et capture ta pierre. Sa seule liberté était C7 : c'est là qu'il fallait jouer." },
    title: 'Vers le centre',
    prompt: 'Ta pierre marquée est en atari. Sauve-la.',
    explanation: "Bravo ! C7 allonge ta pierre vers le centre. Tes deux pierres ont trois libertés, B7, D7 et C6 : elles respirent. La pierre blanche H3 est en atari aussi, mais elle peut attendre."
  },
  {
    id: 'n05', size: 9, difficulty: 420, answers: ['D4'],
    setup: { rows: [E, E, '...O.....', '..OSO....', '..OSO....', E, E, '.....OXO.', '......O..'], toPlay: 'B',
      refutation: "Pas tout à fait. Tu sauves G2, mais Blanc joue D4 et capture tes deux pierres marquées. Sauve d'abord le groupe le plus gros." },
    title: 'Sauve le plus gros',
    prompt: 'Deux de tes groupes sont en atari. Tu ne peux en sauver qu’un : sauve les pierres marquées, le plus gros.',
    explanation: "Bravo ! D4 allonge tes deux pierres : la chaîne a trois libertés, C4, E4 et D3. Blanc prendra peut-être G2, mais c'est une seule pierre. Tu as gardé les deux autres."
  },
  {
    id: 'n06', size: 9, difficulty: 440, answers: ['A2', 'B1'],
    setup: { rows: [E, E, E, E, E, E, 'XX.......', '.TX......', '..X......'], toPlay: 'B',
      refutation: "Pas tout à fait. La pierre a deux libertés, A2 et B1. Si tu ne la mets pas en atari, Blanc s'allonge en B1 et garde deux libertés." },
    title: 'Deux chemins dans le coin',
    prompt: 'Capture la pierre marquée en deux coups au plus.',
    explanation: "Bravo ! Il y avait deux bonnes réponses. En A2, la pierre n'a plus qu'une liberté, B1 : si elle s'y allonge, ses deux pierres n'ont plus que A1, et tu les prends. En B1, c'est la même chose de l'autre côté. Dans le coin, une pierre a peu de libertés."
  },
  {
    id: 'n07', size: 9, difficulty: 460, answers: ['F2'],
    setup: { rows: [E, E, E, E, E, E, '....X....', '...XT....', '...X.....'], toPlay: 'B',
      refutation: "Pas tout à fait. En E1, Blanc s'allonge en F2, vers le centre, et a trois libertés. Mets-le en atari de l'autre côté, pour le pousser vers le bord." },
    title: 'Vers le bord',
    prompt: 'Capture la pierre marquée en deux coups au plus.',
    explanation: "Bravo ! F2 met la pierre en atari : sa seule liberté est E1, sur le bord. Si Blanc s'y allonge, ses deux pierres n'ont qu'une liberté, F1, car ta pierre D1 bloque l'autre côté. Tu les captures en F1."
  },
  {
    id: 'n08', size: 9, difficulty: 480, answers: ['E4'],
    setup: { rows: [E, E, E, '....X....', '...XT.X..', '.....X...', E, E, E], toPlay: 'B',
      refutation: "Pas tout à fait. En F5, Blanc s'allonge en E4 et a deux libertés, D4 et E3 : il s'échappe vers le bas. Pousse-le plutôt vers tes pierres." },
    title: 'Vers tes pierres',
    prompt: 'Capture la pierre marquée en deux coups au plus.',
    explanation: "Bravo ! E4 met la pierre en atari et la pousse vers tes pierres F4 et G5. Si Blanc s'allonge en F5, ses deux pierres n'ont plus qu'une liberté, F6. Tu les captures en F6."
  },
  {
    id: 'n09', size: 9, difficulty: 500, answers: ['F5'],
    setup: { rows: [E, E, E, '....X....', '...XT.O..', '...X.....', '....X....', E, E], toPlay: 'B',
      refutation: "Pas tout à fait. En E4, Blanc joue F5 : sa pierre rejoint G5, et le groupe a cinq libertés. Coupe d'abord le chemin vers G5." },
    title: 'Sépare-la de son amie',
    prompt: 'Capture la pierre marquée en deux coups au plus.',
    explanation: "Bravo ! F5 met la pierre en atari et la sépare de G5. Sa seule liberté est E4. Si Blanc s'y allonge, ses deux pierres n'ont qu'une liberté, F4 : tes pierres D4 et E3 ferment le reste. Tu les captures en F4."
  },
  {
    id: 'n10', size: 9, difficulty: 520, answers: ['J8'],
    setup: { rows: ['......X..', '......XT.', '.......X.', E, E, E, E, E, E], toPlay: 'B',
      refutation: "Pas tout à fait. En H9, Blanc s'allonge en J8 et a deux libertés, J9 et J7. Mets-le en atari par le bord de droite." },
    title: 'Le coin se referme',
    prompt: 'Capture la pierre marquée en deux coups au plus.',
    explanation: "Bravo ! J8 met la pierre en atari : sa seule liberté est H9. Si Blanc s'y allonge, ses deux pierres n'ont plus que J9, dans le coin. Tu les captures en J9."
  },
  {
    id: 'n11', size: 9, difficulty: 540, answers: ['H3'],
    setup: { rows: [E, E, E, '.......X.', '......XTX', '......XT.', E, E, E], toPlay: 'B',
      refutation: "Pas tout à fait. En J4, Blanc s'allonge en H3 et a trois libertés, G3, H2 et J3. Mets-le en atari par le bas, pour le pousser vers le bord." },
    title: 'Deux pierres contre le bord',
    prompt: 'Capture les pierres marquées en deux coups au plus.',
    explanation: "Bravo ! H3 met les deux pierres en atari : leur seule liberté est J4, sur le bord. Si Blanc s'y allonge, ses trois pierres n'ont plus qu'une liberté, J3. Tu les captures en J3."
  },
  {
    id: 'n12', size: 9, difficulty: 560, answers: ['B9'],
    setup: { rows: ['..OS.....', '..XOO....', E, E, E, E, E, E, E], toPlay: 'B',
      refutation: "Pas tout à fait. Si tu t'allonges en E9, tes deux pierres n'ont qu'une liberté, F9 : tu te mets toi-même en atari, et Blanc les prend. Ailleurs, Blanc prend ta pierre en E9. Regarde plutôt la pierre C9." },
    title: 'Ne te mets pas en atari',
    prompt: 'Ta pierre marquée est en atari. Sauve-la.',
    explanation: "Bravo ! La pierre blanche C9 est en atari aussi : B9 la capture. Ta pierre a maintenant deux libertés, C9 et E9. Blanc ne peut pas jouer en C9 : sa pierre n'y aurait aucune liberté. Et s'il joue E9, tu relies en C9. En E9, tu te serais mis toi-même en atari."
  },
  {
    id: 'n13', size: 9, difficulty: 580, answers: ['B4'],
    setup: { rows: [E, E, 'O........', 'OX.......', 'SOX......', E, E, E, E], toPlay: 'B',
      refutation: "Pas tout à fait. En A4, tes deux pierres n'ont que deux libertés : Blanc joue B4 et elles sont de nouveau en atari, contre le bord. Ailleurs, Blanc prend ta pierre en A4. Regarde plutôt la pierre B5." },
    title: 'Capture pour sauver',
    prompt: 'Ta pierre marquée est en atari. Sauve-la.',
    explanation: "Bravo ! La pierre blanche B5 est en atari : B4 la capture. Ta pierre a maintenant deux libertés, A4 et B5, et Blanc ne peut pas jouer en B5 : il n'y aurait aucune liberté. S'il joue A4, tu relies en B5. S'allonger en A4, le long du bord, ne donnait que deux libertés."
  },
  {
    id: 'n14', size: 9, difficulty: 600, answers: ['E5'],
    setup: { rows: [E, E, E, '...X.....', '..XT.TX..', '.....X...', E, E, E], toPlay: 'B',
      refutation: "Pas tout à fait. Si tu mets une seule pierre en atari, Blanc joue E5 : il relie ses deux pierres et le groupe a trois libertés. Joue le point entre elles." },
    title: 'Double atari',
    prompt: 'Capture une des pierres marquées en deux coups au plus.',
    explanation: "Bravo ! E5 met les deux pierres en atari en même temps : D5 n'a plus que D4, F5 n'a plus que F6. C'est un double atari. Blanc n'en sauve qu'une, tu captures l'autre."
  },
  {
    id: 'n15', size: 9, difficulty: 630, answers: ['E3'],
    setup: { rows: [E, E, E, E, E, E, E, '...XTX...', '..XO.....'], toPlay: 'B',
      refutation: "Pas tout à fait. En E1, tu prends D1, mais Blanc s'allonge en E3, vers le centre, et a trois libertés. La pierre qui compte, c'est E2." },
    title: 'Pas la plus facile',
    prompt: 'Capture la pierre marquée en deux coups au plus.',
    explanation: "Bravo ! E3 met E2 en atari par le haut : sa seule liberté est E1. Si Blanc s'y allonge, il se relie à D1, mais ses trois pierres n'ont qu'une liberté, F1. Tu les captures en F1. Prendre D1 en E1 était plus facile, mais E2 s'échappait."
  },
  {
    id: 'n16', size: 9, difficulty: 660, answers: ['E1', 'F1'],
    setup: { rows: ['.X.......', 'OOX......', 'XX.......', E, E, E, '....OX...', '...OSOX..', E], toPlay: 'B',
      refutation: "Pas tout à fait. Tu prends deux pierres en A9, mais Blanc joue E1 et capture ta pierre. La pierre à prendre, c'est celle qui te met en atari." },
    title: 'La bonne pierre à prendre',
    prompt: 'Ta pierre marquée est en atari. Sauve-la.',
    explanation: "Bravo ! La pierre blanche F2 est en atari : F1 la capture, et ta pierre respire. E1 marche aussi : tes deux pierres ont deux libertés, D1 et F1, et F2 reste en atari. Si Blanc joue D1, tu prends F2 en F1. Les deux pierres de A8 et B8 valent moins que ta pierre."
  },
];

export default LOT_N;
