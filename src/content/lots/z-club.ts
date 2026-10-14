// Lot Z de l'issue #539 : problèmes du joueur de club, vers 5 kyu (difficulté 1200 à 1600), pour pratiquer les leçons 37
// à 39 et le reste du programme. 9 × 9, Noir au trait. Trois familles, chacune prouvée par src/go/lot-z.test.ts :
// - vie et mort (points miai, grappe de cinq, six en rectangle du coin) : preuve exhaustive de src/go/preuve-vie-mort.ts
//   en zone fermée ; un ko ou un seki ne compte jamais comme une preuve ;
// - course aux libertés (libertés communes, yeux) : recherche exacte de src/go/preuve-course.ts en zone fermée ;
// - fin de partie (jouer ailleurs) : minimax exact de src/go/preuve-fin-de-partie.ts, compté par surfaces ; les chiffres
//   des textes sont recomptés en règle japonaise.
// Les réponses acceptées sont exactement les coups qui atteignent le but ; la réplique citée par chaque réfutation est
// rejouée. Même contenu que la migration 20261014120000_lot_z.
import type { PuzzleRow } from '../../data/puzzles';

const E = '.........';
const M = '...XO....';

const LOT_Z: PuzzleRow[] = [
  {
    id: 'z01', size: 9, difficulty: 1200, answers: ['B1'],
    setup: { rows: [E, E, E, E, E, E, 'OOOOOOO..', 'XSXXXXO..', '...X.OO..'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue B1, le point vital de A1-B1-C1 : il ne te reste qu’un œil, en E1, et ton groupe finit capturé.' },
    title: 'Blanc a pris un des deux',
    prompt: 'Noir joue et vit. Blanc vient de jouer F1. Ton deuxième œil se faisait en B1 ou en F1.',
    explanation: 'Bravo ! B1 et F1 étaient miai : deux points qui se valent. Blanc a pris F1, tu prends B1. A1 et C1 deviennent deux vrais yeux, et ton groupe est vivant. Si tu réponds à côté de F1, Blanc joue B1 et tu n’as plus qu’un œil.'
  },
  {
    id: 'z02', size: 9, difficulty: 1200, answers: ['J2', 'J1'],
    setup: { rows: [E, E, E, E, E, E, 'OOOOOXXXX', '.XSXXOTO.', '.XXXX.OO.'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue A2 (ou F1 si tu as joué A2) : c’est lui qui gagne la course et prend tes pierres.' },
    title: 'Le dehors d’abord',
    prompt: 'Noir joue et gagne la course aux libertés : prends les pierres blanches marquées avant qu’elles prennent les tiennes.',
    explanation: 'Bravo ! Chaque groupe a deux libertés dehors et une liberté commune, F1. Tu bouches d’abord le dehors de Blanc, J2 ou J1. F1 en premier t’enlevait aussi une liberté, et A1 ou A2 sont tes propres libertés : Blanc gagnait.'
  },
  {
    id: 'z03', size: 9, difficulty: 1250, answers: ['J5'],
    setup: { rows: ['......OX.', '......OS.', '......OXX', '......OX.', '......OX.', '......OXO', '......OOO', E, E], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue J5 : J6 n’est plus un œil, il ne te reste que celui du coin, et ton groupe finit capturé.' },
    title: 'L’autre point',
    prompt: 'Noir joue et vit. Blanc vient de jouer J4. En haut, J8-J9 fait déjà un œil.',
    explanation: 'Bravo ! Blanc a pris J4, tu prends J5 : J6 devient ton deuxième œil, à côté de celui du coin. J4 et J5 étaient miai : deux points qui se valent. Quand Blanc en prend un, tu prends l’autre.'
  },
  {
    id: 'z04', size: 9, difficulty: 1250, answers: ['E9'],
    setup: { rows: ['.XOO.O...', '.XXXXO...', M, M, M, M, M, 'XXXXOOOOO', '...OO....'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue E9 : il relie ses deux pierres, et la prise est perdue. Elle valait plus que de répondre en bas.' },
    title: 'Réponds, ou joue ailleurs ?',
    prompt: 'Blanc vient de jouer D1, au premier rang. Il reste deux endroits ouverts. Joue le plus gros.',
    explanation: 'Bravo ! E9 prend C9 et D9 : 2 prisonniers et 2 points de territoire. En bas, Blanc avance en C1 et tu bloques en B1 : tu n’y perds qu’un point. C’est le tenuki : jouer ailleurs quand la menace est plus petite que ton coup.'
  },
  {
    id: 'z05', size: 9, difficulty: 1300, answers: ['B1'],
    setup: { rows: [E, E, E, E, E, 'XXX......', 'TOOX.....', '..OOX....', '...OX....'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue B1 : son espace se coupe en deux yeux, et son groupe est vivant.' },
    title: 'La grappe du coin',
    prompt: 'Noir joue et tue. L’espace blanc a cinq points : A1, B1, C1, A2 et B2.',
    explanation: 'Bravo ! Ces cinq points forment une grappe : un carré, plus un point. B1 touche trois des autres : c’est le point vital. Ta pierre l’occupe, et Blanc ne peut plus faire deux yeux. S’il joue B1 le premier, il vit.'
  },
  {
    id: 'z06', size: 9, difficulty: 1300, answers: ['J2', 'J1'],
    setup: { rows: [E, E, E, E, E, E, 'OOOOXXXXX', '.XSXOTOO.', 'X.XXOOOO.'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue A2 (ou B1 si tu as joué A2) : il gagne la course et prend tes pierres.' },
    title: 'Ton œil compte',
    prompt: 'Noir joue et gagne la course aux libertés contre les pierres blanches marquées.',
    explanation: 'Bravo ! Ton œil B1 vaut une liberté que Blanc ne peut boucher qu’en dernier. Avec A2, tu as deux libertés, Blanc aussi : J1 et J2. Tu joues le premier, donc tu bouches les siennes, et tu gagnes. Boucher B1 ou A2 t’enlevait une liberté.'
  },
  {
    id: 'z07', size: 9, difficulty: 1350, answers: ['J2'],
    setup: { rows: [E, E, E, E, E, E, 'OOOOXXXXX', '.XSXOTOO.', 'X.XXOO.OO'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue A2 (ou B1 si tu as joué A2) : c’est lui qui gagne la course.' },
    title: 'Un œil chacun',
    prompt: 'Noir joue et gagne la course aux libertés. Chaque groupe a un œil.',
    explanation: 'Bravo ! Chaque groupe a un œil et une liberté dehors : A2 pour toi, J2 pour Blanc. Un œil se bouche en dernier, donc le premier qui bouche le dehors de l’autre gagne. Après J2, Blanc n’a plus que son œil G1.'
  },
  {
    id: 'z08', size: 9, difficulty: 1350, answers: ['F9'],
    setup: { rows: ['.XOOO.O..', '.XXXXXO..', '....XO...', M, M, M, M, 'XXXXOOOOO', '....O....'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue F9 : il relie ses trois pierres. La prise valait bien plus que ton coup en bas.' },
    title: 'Trois pierres en jeu',
    prompt: 'Blanc vient de descendre en E1. Il reste deux endroits ouverts. Où joues-tu ?',
    explanation: 'Bravo ! F9 prend C9, D9 et E9 : 3 prisonniers et 3 points de territoire. En bas, Blanc avance en D1 et tu bloques en C1 : un seul point. Ne suis pas Blanc : joue ailleurs, là où c’est plus gros.'
  },
  {
    id: 'z09', size: 9, difficulty: 1400, answers: ['B1'],
    setup: { rows: [E, E, E, E, E, 'XXXX.....', 'TOOOX....', 'O..OX....', '...OX....'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue B1 : son espace se coupe en deux yeux, et son groupe est vivant.' },
    title: 'Le point qui touche tout',
    prompt: 'Noir joue et tue. L’espace blanc a cinq points : B2, C2, A1, B1 et C1.',
    explanation: 'Bravo ! Ces cinq points forment une grappe : le carré B1-C1-B2-C2, plus A1. B1 touche trois des autres : c’est le point vital. Ta pierre l’occupe, et Blanc ne peut plus faire deux yeux. Blanc en B1 vivait.'
  },
  {
    id: 'z10', size: 9, difficulty: 1400, answers: ['D1'],
    setup: { rows: [E, E, E, E, E, E, 'OOOOOO...', 'XSXXXO...', '.X..OO...'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue D1 : il ne te reste que l’œil du coin, A1, et ton groupe finit capturé.' },
    title: 'Le deuxième œil',
    prompt: 'Noir joue et vit. Blanc vient de jouer E1. A1 est déjà un œil.',
    explanation: 'Bravo ! D1 fait de C1 ton deuxième œil, à côté de A1. D1 et E1 étaient miai : si Blanc prend l’un, tu prends l’autre. Blanc a pris E1, et sa pierre ne sert plus à rien.'
  },
  {
    id: 'z11', size: 9, difficulty: 1450, answers: ['E1'],
    setup: { rows: [E, E, E, E, E, E, 'OOOOXXXXX', '.XSXOTOOO', '.XXX.O.OO'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue A2 et gagne la course. Si tu as joué A2, il n’a même pas besoin de répondre : personne ne prend plus personne.' },
    title: 'Contre un œil',
    prompt: 'Noir joue et gagne la course aux libertés. Blanc a un œil en G1, toi aucun.',
    explanation: 'Bravo ! E1 est votre liberté commune. Contre un œil, il faut la boucher tout de suite : Blanc n’a plus que G1, il est en atari (une seule liberté). Toi, tu gardes A1 et A2, et tu le prends en G1. Sans E1, Blanc gagnait.'
  },
  {
    id: 'z12', size: 9, difficulty: 1450, answers: ['E9'],
    setup: { rows: ['XOOO.O...', 'XXXXXO...', M, M, M, M, M, 'XXXX.OOOO', '....O....'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue E9 : il relie ses trois pierres, et tu perds au moins quatre points.' },
    title: 'Le coin d’abord',
    prompt: 'En bas, Blanc menace d’avancer en E2 ou en D1. En haut, trois pierres blanches sont en atari. Joue le plus gros.',
    explanation: 'Bravo ! E9 prend B9, C9 et D9 : 3 prisonniers et 3 points de territoire. En bas, Blanc peut avancer d’un pas, mais tu bloques ensuite : sa menace vaut bien moins que ta prise.'
  },
  {
    id: 'z13', size: 9, difficulty: 1500, answers: ['J2'],
    setup: { rows: [E, E, E, E, E, E, 'OOOOOXXXX', 'XXSXXOTO.', 'X.XXX.OO.'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue J2 (ou B1 si tu as joué F1) : tu ne gagnes plus la course.' },
    title: 'Le bon côté',
    prompt: 'Noir joue et gagne la course aux libertés. Blanc a deux libertés dehors, J1 et J2.',
    explanation: 'Bravo ! Avec ton œil B1 et la liberté commune F1, tu bouches J2 puis J1, et Blanc est pris. J1 d’abord ne marche pas : ta pierre n’y a qu’une liberté, et Blanc la prend en J2. Boucher F1 t’enlevait aussi une liberté.'
  },
  {
    id: 'z14', size: 9, difficulty: 1550, answers: ['J2'],
    setup: { rows: [E, E, E, E, E, E, 'OOOOXXXXX', '.XSXOTOO.', '.X.XOO.O.'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue A2 (ou J2 si tu as joué A2 ou J1) : tu ne gagnes plus la course.' },
    title: 'Œil contre œil',
    prompt: 'Noir joue et gagne la course aux libertés. Chaque groupe a un œil et deux libertés dehors.',
    explanation: 'Bravo ! Les deux yeux se bouchent en dernier : la course se joue dehors, et tu joues le premier. Commence par J2 : J1 d’abord te laissait une pierre à une liberté, que Blanc prenait en J2. Ensuite J1, puis l’œil G1.'
  },
  {
    id: 'z15', size: 9, difficulty: 1600, answers: ['B2'],
    setup: { rows: [E, E, E, E, 'XX.......', 'TOXX.....', 'OOOOX....', '...OX....', '...OX....'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue B2 (ou B1 si tu as joué C1) et vit. Après A2 ou B1, tu ne peux plus le prendre sans ko.' },
    title: 'Le six du coin',
    prompt: 'Noir joue et tue. L’espace blanc fait six points en rectangle, dans le coin, sans liberté dehors.',
    explanation: 'Bravo ! B2 est le point vital du six du coin. Blanc n’a plus de liberté dehors, et le coin réduit son espace : quoi qu’il joue, il ne fait pas deux yeux, et tu le prends sans ko. Ailleurs, Blanc vivait, ou la suite finissait en ko.'
  },
];

export default LOT_Z;
