// Lot AB de l'issue #557 : problèmes du joueur de club, de 5 kyu vers le dan (difficulté 1250 à 1700), lecture de 5 à
// 8 coups : tesuji (jeté, relier et mourir, coupe par en dessous), vie et mort avancée (placement après réduction,
// point vital en plusieurs coups), ko et seki décisifs, prise en retour, fin de partie. 9 × 9, Noir au trait : le dépôt
// n'a pas de problèmes cadrés sur un coin de 13 × 13 ou 19 × 19 (seul le lot X, ouverture, est en 13 × 13 entier).
// Chaque problème est prouvé par src/go/lot-ab.test.ts, avec les outils du lot AA :
// - vie et mort (« Noir joue et vit. », « Noir joue et tue. ») : recherche exhaustive de src/go/preuve-vie-mort.ts en
//   zone fermée ; chaque erreur est prouvée par src/go/preuve-ko.ts (même si l'adversaire gagne tous les ko) ;
// - ko (« Obtiens au moins un ko ») : src/go/preuve-ko.ts, le camp qui gagne tous les ko obtient ce qu'il veut, et la
//   recherche sans ko ne tranche pas ; après une erreur, même tous les ko gagnés ne suffisent pas ;
// - seki : le groupe ne peut plus être pris, même si Blanc gagne tous les ko ; après une erreur, il meurt même si Noir
//   les gagne tous ;
// - capture en deux ou trois coups : lecteur exact du lot N, avec et sans ko ;
// - fin de partie : minimax exact de src/go/preuve-fin-de-partie.ts, compté par surfaces.
// Les réponses acceptées sont exactement les coups qui atteignent le but ; la réplique citée par chaque réfutation est
// rejouée ; chaque suite citée par une explication est rejouée. Même contenu que la migration 20261016090000_lot_ab.
import type { PuzzleRow } from '../../data/puzzles';

const E = '.........';
const M = '...XO....';

const LOT_AB: PuzzleRow[] = [
  {
    id: 'ab01', size: 9, difficulty: 1250, answers: ['C1'],
    setup: { rows: ['..X..O...', M, M, M, M, M, 'XXXXOOOO.', '.X..O..O.', '...O.....'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc garde l’avantage au premier rang : tu perds au moins un point par rapport au bon coup.' },
    title: 'Bloque la glissade',
    prompt: 'Blanc vient de glisser en D1, au premier rang, sous ton territoire. Il reste aussi deux points ouverts en haut. Joue le coup qui rapporte le plus.',
    explanation: 'Bravo ! C1 bloque la pierre D1 au contact : elle ne va pas plus loin. Bloquer en C2 laissait Blanc avancer en C1, et la place entre D9 et E9 vaut moins que cette glissade. Après C1, si Blanc prend D9, tu prends E9 ; s’il prend E9, tu prends D9.'
  },
  {
    id: 'ab02', size: 9, difficulty: 1250, answers: ['B1'],
    setup: { rows: [E, E, E, E, E, 'OOOOO....', 'XXXSO....', 'X...O....', '....O....'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue B1 : A1 n’est plus un œil, et tu ne fais plus deux yeux.' },
    title: 'L’œil du coin d’abord',
    prompt: 'Noir joue et vit. Ton espace fait sept points, en forme de L.',
    explanation: 'Bravo ! B1 fait de A1 ton premier œil, et laisse le deuxième à faire en C2 ou en D2 : si Blanc joue C2, tu réponds D2 ; s’il joue D2, tu réponds C2. Partout ailleurs, Blanc jouait B1 lui-même et il ne te restait qu’un œil.'
  },
  {
    id: 'ab03', size: 9, difficulty: 1300, answers: ['B1'],
    setup: { rows: [E, E, E, E, E, 'XXXXX....', 'OOT.X....', 'O.O.X....', '....X....'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue B1 : il se fait deux yeux, et tu ne peux plus prendre son groupe.' },
    title: 'Le placement au premier rang',
    prompt: 'Noir joue et tue. L’espace blanc va de D3 à A1, autour de la pierre C2.',
    explanation: 'Bravo ! B1 est le point clé : il touche A1, B2 et C1, les trois points où Blanc voulait faire ses yeux. Si Blanc joue D2, tu réponds D3 ; s’il joue D3, tu réponds D2. Il ne fait jamais deux yeux.'
  },
  {
    id: 'ab04', size: 9, difficulty: 1300, answers: ['D5', 'E5'],
    setup: { rows: [E, E, '..XXXX...', '.XTTTTX..', '.XT..TX..', '..XOOX...', '...XX....', E, E], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc n’a même pas besoin de répondre : l’anneau garde ses deux libertés, et tu n’as plus le temps de le prendre en deux coups.' },
    title: 'Deux jetés pour un anneau',
    prompt: 'Capture les pierres marquées en deux coups au plus.',
    explanation: 'Bravo ! D5 se jette dans l’anneau et se met en atari exprès. Si Blanc la prend en E5, toutes ses pierres n’ont plus qu’une liberté, D5 : tu y rejoues et tu en prends 9. C’est une prise en retour. E5 marchait de la même façon.'
  },
  {
    id: 'ab05', size: 9, difficulty: 1300, answers: ['D2'],
    setup: { rows: ['.XX.O....', '.XX.O....', M, M, M, M, 'XXXXOOOO.', '....O..O.', '..XO.....'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc garde sa pierre D1 dans ton coin : tu perds au moins un point par rapport au bon coup.' },
    title: 'L’atari qui bloque',
    prompt: 'Blanc vient de jouer D1, en hane sous ta pierre C1. Il reste aussi deux points ouverts en haut. Joue le coup qui rapporte le plus.',
    explanation: 'Bravo ! D2 met D1 en atari au contact : Blanc doit la sauver, et rien n’entre dans ton coin. Bloquer plus loin, en B2 ou en C2, laissait Blanc avancer et rapportait moins. En haut, si Blanc prend D9, tu prends D8 ; s’il prend D8, tu prends D9.'
  },
  {
    id: 'ab06', size: 9, difficulty: 1350, answers: ['A2'],
    setup: { rows: [E, E, E, E, E, 'XXXXX....', '.OT.X....', '..O.X....', '.OO.X....'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue A2 : il se fait deux yeux, et tu ne peux plus prendre son groupe.' },
    title: 'Le point du bord',
    prompt: 'Noir joue et tue. Les pierres blanches ont de la place des deux côtés, en A et en D.',
    explanation: 'Bravo ! A2 est le point vital : il touche A3, A1 et B2, et laisse Blanc sans deuxième œil. Si Blanc joue B2, tu réponds A3 ; s’il joue A3, tu réponds B2. Du côté de la colonne D, il n’a la place que pour un œil.'
  },
  {
    id: 'ab07', size: 9, difficulty: 1350, answers: ['C2'],
    setup: { rows: [E, E, E, E, E, 'OOOOOO...', 'XXXXSO...', 'XO..XO...', '.O...O...'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue C2, et ton groupe finit pris.' },
    title: 'Seki contre deux pierres',
    prompt: 'Sauve ton groupe marqué par un seki (vie commune) : il ne peut plus faire deux yeux.',
    explanation: 'Bravo ! C2 enferme les pierres B2 et B1 sans les prendre. Ni toi ni Blanc ne pouvez plus remplir les libertés restantes sans vous mettre en atari : c’est seki, et ton groupe vit avec. Si Blanc joue C2 le premier, il prend tout ton groupe.'
  },
  {
    id: 'ab08', size: 9, difficulty: 1400, answers: ['B1'],
    setup: { rows: [E, E, E, E, E, 'OOOOOO...', 'XXXXSO...', 'XOO.XO...', '.....O...'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue B1, et ton groupe meurt, même si tu gagnes tous les ko.' },
    title: 'Deux pierres dedans, un ko',
    prompt: 'Noir joue : vivre sans ko est impossible ici. Obtiens au moins un ko (une prise qu’on ne peut pas reprendre tout de suite).',
    explanation: 'Bravo ! B1 passe sous les deux pierres blanches : Blanc ne peut plus te tuer sans gagner un ko. Si Blanc joue D1, tu réponds D2. Si c’est toi qui gagnes le ko, tu vis. Après tout autre coup, ton groupe mourait, ko ou pas.'
  },
  {
    id: 'ab09', size: 9, difficulty: 1400, answers: ['E3'],
    setup: { rows: [E, E, E, E, '..XXXX...', '.XTTTTX..', '.XT..TX..', '..XO.X...', '...X.X...'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue E3 : il relie l’anneau à sa pierre D2, et le tout respire. Si tu as joué E2, il n’a même pas besoin de répondre.' },
    title: 'Relier et mourir',
    prompt: 'Capture les pierres marquées en deux coups au plus. Blanc voudrait les relier à D2.',
    explanation: 'Bravo ! E3 laisse une liberté à ta pierre, en E2, et une seule à l’anneau, D3. Si Blanc relie en D3, tout son groupe n’a plus qu’une liberté, E2 : tu y joues et tu prends tout. En D3, c’était ta pierre qui n’avait qu’une liberté : Blanc la prenait en E3 et respirait.'
  },
  {
    id: 'ab10', size: 9, difficulty: 1400, answers: ['B1'],
    setup: { rows: [E, E, E, E, E, 'OOOOO....', 'XXXSO....', '..XXO....', '....O....'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue B1 : il ne te reste la place que d’un œil, et ton groupe finit pris.' },
    title: 'Un œil de chaque côté',
    prompt: 'Noir joue et vit. Ton espace fait six points, trois de chaque côté de ta pierre C2.',
    explanation: 'Bravo ! B1 prépare un œil de chaque côté : A2 ou A1 à gauche, D1 à droite. Si Blanc joue A2, tu réponds D1 ; s’il joue D1, tu réponds A2. Si Blanc joue B1 le premier, un seul côté peut encore faire un œil.'
  },
  {
    id: 'ab11', size: 9, difficulty: 1450, answers: ['A1'],
    setup: { rows: [E, E, E, E, E, 'XXXXX....', 'OT..X....', '.OO.X....', '..O.X....'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue A1 : il se fait deux yeux, et tu ne peux plus prendre son groupe.' },
    title: 'Le coin lui-même',
    prompt: 'Noir joue et tue. L’espace blanc contourne ses pierres B2, C2 et C1.',
    explanation: 'Bravo ! A1, le point du coin, est le point vital : il casse l’œil de A2 et celui de B1 en même temps. Si Blanc joue D2, tu réponds D3 ; s’il joue D3, tu réponds D2. Il ne fait jamais deux yeux.'
  },
  {
    id: 'ab12', size: 9, difficulty: 1450, answers: ['D1'],
    setup: { rows: [E, E, E, E, E, 'OOOOOOO..', 'OXXXS.O..', 'O...XXO..', 'O....XO..'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue D1 : ton espace se coupe mal, et tu ne fais plus deux yeux.' },
    title: 'Élargis au premier rang',
    prompt: 'Noir joue et vit. Ton espace va de F3 à B1.',
    explanation: 'Bravo ! D1 fait de E1 un œil et garde assez de place à gauche pour le deuxième : si Blanc joue B2, tu réponds C2 ; s’il joue C2, tu réponds B2. Si Blanc joue D1 le premier, il ne te reste pas deux yeux.'
  },
  {
    id: 'ab13', size: 9, difficulty: 1500, answers: ['E1'],
    setup: { rows: [E, E, E, E, E, 'OOOOOO...', 'XXXXSO...', 'X.O.XO...', '.OO..O...'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue E1, et ton groupe finit pris.' },
    title: 'Trois pierres dedans',
    prompt: 'Sauve ton groupe marqué par un seki (vie commune) : il ne peut plus faire deux yeux.',
    explanation: 'Bravo ! E1 enlève une liberté aux trois pierres blanches sans te mettre en atari. Ensuite, celui qui remplit une liberté partagée se fait prendre : personne n’y joue, c’est seki. Si Blanc joue E1 le premier, c’est ton groupe qui n’a plus assez de libertés.'
  },
  {
    id: 'ab14', size: 9, difficulty: 1500, answers: ['C2'],
    setup: { rows: [E, E, E, E, E, 'XXXXXX...', 'OOOOTX...', 'OX..OX...', '.....X...'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue C2, et son groupe vit, même si tu gagnes tous les ko.' },
    title: 'Ta pierre dedans, un ko',
    prompt: 'Noir joue : tuer sans ko est impossible ici. Obtiens au moins un ko (une prise qu’on ne peut pas reprendre tout de suite). Ta pierre B2 est déjà dans l’espace blanc.',
    explanation: 'Bravo ! C2 prolonge ta pierre B2 : Blanc ne peut plus vivre sans gagner un ko. Si Blanc joue B1, tu réponds C1 ; s’il joue D2, tu réponds B1. Si c’est toi qui gagnes le ko, son groupe meurt. Après tout autre coup, Blanc vivait, ko ou pas.'
  },
  {
    id: 'ab15', size: 9, difficulty: 1500, answers: ['E1'],
    setup: { rows: [E, E, E, E, E, '..XX.....', '.XTTX....', E, '.XOO.....'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue C2 (ou D2 si tu as joué B2 ou C2) : il relie ses pierres vers le bas, et tu ne les prends plus en trois coups.' },
    title: 'Coupe par en dessous',
    prompt: 'Capture les pierres marquées en trois coups au plus. Blanc veut les relier à C1 et D1.',
    explanation: 'Bravo ! E1 enlève d’avance la liberté dont Blanc aurait besoin pour relier. S’il relie en D2, tu joues E2 ; s’il joue C2, tu joues B2 : chaque fois, ses pierres n’ont plus assez de libertés et tu les prends. En C2 ou D2 tout de suite, Blanc reliait de l’autre côté et respirait.'
  },
  {
    id: 'ab16', size: 9, difficulty: 1550, answers: ['C1'],
    setup: { rows: [E, E, E, E, E, 'XXXXXXX..', 'XOOT..X..', 'XO.OO.X..', 'X...O.X..'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue C1 : il se fait deux yeux, et tu ne peux plus prendre son groupe.' },
    title: 'Sous les deux pierres',
    prompt: 'Noir joue et tue. L’espace blanc se partage entre la gauche et la droite.',
    explanation: 'Bravo ! C1 se glisse sous les pierres B2 et D2 : à gauche, il ne reste plus la place d’un œil entier. Si Blanc joue D1, tu réponds B1 ; s’il joue B1, tu réponds D1. À droite, E3, F3 et F2 ne lui donnent qu’un œil.'
  },
  {
    id: 'ab17', size: 9, difficulty: 1600, answers: ['C1'],
    setup: { rows: [E, E, E, E, E, 'OOOOOOO..', 'OXXS..O..', 'OX.XXXO..', 'O.....O..'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue C1 : C2 n’est plus un œil, et tu ne fais plus deux yeux.' },
    title: 'Deux yeux à la fois',
    prompt: 'Noir joue et vit. Ton espace a deux parties : C2 avec le bas, et E3-F3 en haut.',
    explanation: 'Bravo ! C1 fait de C2 un vrai œil, et garde la place du deuxième à droite : si Blanc joue E1, tu réponds F1 ; s’il joue F1, tu réponds E1. Si Blanc joue C1 le premier, il ne te reste qu’un œil.'
  },
  {
    id: 'ab18', size: 9, difficulty: 1600, answers: ['C2'],
    setup: { rows: [E, E, E, E, E, 'OOOOOO...', 'XXXXSO...', 'XO..XO...', 'X.O..O...'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue C2, et ton groupe meurt, même si tu gagnes tous les ko.' },
    title: 'Sépare les deux pierres',
    prompt: 'Noir joue : vivre sans ko est impossible ici. Obtiens au moins un ko (une prise qu’on ne peut pas reprendre tout de suite).',
    explanation: 'Bravo ! C2 sépare les pierres B2 et C1 : Blanc ne peut plus te tuer sans gagner un ko. Si c’est toi qui le gagnes, tu vis. Après tout autre coup, ton groupe mourait, ko ou pas.'
  },
  {
    id: 'ab19', size: 9, difficulty: 1650, answers: ['E1'],
    setup: { rows: [E, E, E, E, E, 'XXXXXXX..', 'X..OOTX..', 'X.OO.OX..', 'X.O...X..'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue E1 : il se fait deux yeux, et tu ne peux plus prendre son groupe.' },
    title: 'Le point entre les deux',
    prompt: 'Noir joue et tue. L’espace blanc a une partie à gauche et une autre en bas.',
    explanation: 'Bravo ! E1 est le point vital du bas : il touche D1, F1 et E2, et Blanc n’y fait plus d’œil entier. Si Blanc joue B2, tu réponds B3 ; s’il joue B3, tu réponds B2. Il ne fait jamais deux yeux.'
  },
  {
    id: 'ab20', size: 9, difficulty: 1650, answers: ['D1'],
    setup: { rows: [E, E, E, E, E, 'XXXXXXX..', 'X.OOT.X..', 'XOO.O.X..', 'XO....X..'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue D1 : il se fait deux yeux, et tu ne peux plus prendre son groupe.' },
    title: 'Le point du milieu',
    prompt: 'Noir joue et tue. L’espace blanc se partage entre la gauche, la droite et le bas.',
    explanation: 'Bravo ! D1 est le point vital : il touche C1, E1 et D2, les points qui reliaient les trois parties de l’espace. Si Blanc joue F2, tu réponds F1 ; s’il joue F1, tu réponds F2. Il ne fait jamais deux yeux.'
  },
  {
    id: 'ab21', size: 9, difficulty: 1700, answers: ['C1'],
    setup: { rows: [E, E, E, E, E, 'XXXXXX...', 'OOOOTX...', '.O...X...', '.....X...'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue C1 : il se fait deux yeux, et tu ne peux plus prendre son groupe.' },
    title: 'Neuf points, un seul coup',
    prompt: 'Noir joue et tue. L’espace blanc fait neuf points sur deux rangs, avec la pierre B2 dedans.',
    explanation: 'Bravo ! C1 est le seul point qui tue : il empêche à la fois l’œil du coin et ceux de la droite. Si Blanc joue D2, tu réponds D1 ; s’il joue E2, tu réponds E1. Il ne fait jamais deux yeux.'
  },
];

export default LOT_AB;
