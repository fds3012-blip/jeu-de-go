// Lot AA de l'issue #548 : approfondir les problèmes entre 15 et 5 kyu (difficulté 850 à 1250), là où la banque
// en manquait (voir docs/pedagogie/inventaire-problemes-2026-10.md) : ko, seki, prise en retour, fin de partie, et vie
// et mort qui se lit en 3 à 5 coups. 9 × 9, Noir au trait. Chaque problème est prouvé par src/go/lot-aa.test.ts :
// - vie et mort (« Noir joue et vit. », « Noir joue et tue. ») : recherche exhaustive de src/go/preuve-vie-mort.ts en
//   zone fermée ; chaque erreur est prouvée par src/go/preuve-ko.ts (même si l'adversaire gagne tous les ko) ;
// - ko (« Obtiens au moins un ko ») : src/go/preuve-ko.ts, le camp qui gagne tous les ko obtient ce qu'il veut, et la
//   recherche sans ko ne tranche pas ; après une erreur, même tous les ko gagnés ne suffisent pas ;
// - seki (« Sauve ton groupe marqué par un seki ») : le groupe ne peut plus être pris, même si Blanc gagne tous les ko ;
//   après une erreur, il meurt même si Noir les gagne tous ;
// - prise en retour (« Capture les pierres marquées en deux coups au plus. ») : lecteur exact du lot N, avec et sans ko ;
// - fin de partie : minimax exact de src/go/preuve-fin-de-partie.ts, compté par surfaces ; les chiffres des textes sont
//   recomptés en règle japonaise.
// Les réponses acceptées sont exactement les coups qui atteignent le but ; la réplique citée par chaque réfutation est
// rejouée. Même contenu que la migration 20261014160000_lot_aa.
import type { PuzzleRow } from '../../data/puzzles';

const LOT_AA: PuzzleRow[] = [
  {
    id: 'aa01', size: 9, difficulty: 850, answers: ['E3'],
    setup: { rows: ['...X.O...', '...XO....', '...XO....', '...XO....', '...XO....', '...XXO...', '...X.XO..', '....XO...', '....XO...'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue E3 : il prend F3, et c’est un ko. Tu ne peux pas reprendre tout de suite, et Blanc relie ensuite en F3.' },
    title: 'Ferme le ko',
    prompt: 'Ta pierre F3 est en atari (une seule liberté). Il reste aussi un point neutre, E9. Joue le bon coup.',
    explanation: 'Bravo ! E3 relie F3 : Blanc ne peut plus la prendre. Si tu joues E9 d’abord, Blanc prend F3 en E3. C’est un ko : une prise d’une pierre qu’on ne peut pas reprendre tout de suite. Blanc relie ensuite en F3, et tu perds 1 point. E9, une dame, ne rapporte rien.'
  },
  {
    id: 'aa02', size: 9, difficulty: 900, answers: ['C1'],
    setup: { rows: ['.........', '.........', '.........', '.........', '.........', '.........', '.XXXXXX..', '.XTTTTX..', '.O..TXX..'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue C1, et tu ne peux plus prendre ses pierres tout de suite. Si tu as joué A1, il n’a même pas besoin de répondre.' },
    title: 'Une pierre pour six',
    prompt: 'Capture les pierres marquées en deux coups au plus.',
    explanation: 'Bravo ! C1 se met en atari (une seule liberté) exprès. Si Blanc la prend en D1, ses pierres n’ont plus qu’une liberté, C1 : tu y rejoues et tu en prends 6. C’est une prise en retour. Sinon, tu prends en D1. D1 d’abord ne marchait pas : Blanc prenait en C1 et se reliait à B1.'
  },
  {
    id: 'aa03', size: 9, difficulty: 900, answers: ['E1'],
    setup: { rows: ['..XX.O...', '..X.OO...', '...XO....', '...XO....', '...XO....', '...XO....', 'XXXXOOOOO', 'XXXXOOOOO', 'XX.....OO'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue D1 (ou E1 si tu as joué C1 ou D1) : c’est lui qui avance au premier rang.' },
    title: 'Le hane avant les dames',
    prompt: 'Il reste des points ouverts en haut et en bas. Joue le coup qui rapporte le plus.',
    explanation: 'Bravo ! E1 se glisse sous la pierre blanche E2, au premier rang : c’est un hane. Blanc bloque en F1, tu relies en D1. Bloquer en D1 rapportait 1 point de moins. En haut, E9 et D8 sont des dames, des points neutres : ils ne rapportent rien.'
  },
  {
    id: 'aa04', size: 9, difficulty: 950, answers: ['J7'],
    setup: { rows: ['.....OS.O', '.....OXO.', '.....OXO.', '.....OXXX', '.....OOOO', '.........', '.........', '.........', '.........'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue J7, et ton groupe finit pris.' },
    title: 'Partager les libertés',
    prompt: 'Sauve ton groupe marqué par un seki (vie commune) : il ne peut plus faire deux yeux.',
    explanation: 'Bravo ! Après J7, ton groupe et les pierres blanches partagent deux libertés, H9 et J8. Celui qui en remplit une se met en atari et se fait prendre : personne n’y joue. C’est seki, et ton groupe vit avec. Si Blanc joue J7 le premier, il prend ton groupe.'
  },
  {
    id: 'aa05', size: 9, difficulty: 950, answers: ['J5'],
    setup: { rows: ['......OS.', '......OX.', '......OXX', '......OX.', '......OX.', '......OO.', '......O.O', '.........', '.........'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue J5 : ton espace rétrécit, et tu ne fais plus deux yeux.' },
    title: 'Agrandis ton espace',
    prompt: 'Noir joue et vit. Ta pierre J7 est déjà au premier rang.',
    explanation: 'Bravo ! J5 agrandit ton espace. J6, entre J7 et J5, devient un œil, et J8-J9 en fait un autre : tu as deux yeux. Si Blanc joue J5 le premier, ton espace est trop petit.'
  },
  {
    id: 'aa06', size: 9, difficulty: 950, answers: ['H1'],
    setup: { rows: ['.........', '.........', '.........', '.........', '.........', '....OOOOO', '....OXXXS', '....OX...', '....O....'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue H1 (ou G1 si tu as joué H2, ou H2 si tu as joué G1) : tu ne fais plus deux yeux.' },
    title: 'Le point du coin',
    prompt: 'Noir joue et vit. Ton espace fait sept points, dans le coin.',
    explanation: 'Bravo ! H1 est le point clé. Si Blanc joue H2, tu réponds J2 ; s’il joue J2, tu réponds H2 : tu fais toujours deux yeux. En H2, Blanc répondait G1, et tu n’avais plus qu’un ko.'
  },
  {
    id: 'aa07', size: 9, difficulty: 1000, answers: ['H3'],
    setup: { rows: ['.........', '.........', '.........', '.........', '.....XXXX', '.....XTTT', '.....XT..', '.....XXOX', '.....X.O.'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue H3 : il relie ses pierres à H2 et H1, et tu ne peux plus les prendre tout de suite.' },
    title: 'Jette-toi dedans',
    prompt: 'Capture les pierres marquées en deux coups au plus.',
    explanation: 'Bravo ! H3 se jette entre les pierres blanches : elles n’ont plus qu’une liberté, J3. Si Blanc joue J3 et prend ta pierre H3, il ne lui reste que H3 : tu y rejoues et tu prends 5 pierres. C’est une prise en retour. En J3 d’abord, Blanc reliait tout en H3.'
  },
  {
    id: 'aa08', size: 9, difficulty: 1000, answers: ['C9'],
    setup: { rows: ['....O....', 'X.OXO....', 'OSXXO....', 'OOOOO....', '.........', '.........', '.........', '.........', '.........'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue C9 : sa pierre C8 a de nouveau deux libertés au moins, et tu ne fais plus deux yeux.' },
    title: 'Atari pour un œil',
    prompt: 'Noir joue et vit. Blanc a joué C8, au milieu de ton espace.',
    explanation: 'Bravo ! C9 met la pierre C8 en atari (une seule liberté). Si Blanc la prolonge en B8, tu prends les deux pierres en B9 ; s’il joue B9, tu prends C8 en B8. Tu fais deux yeux.'
  },
  {
    id: 'aa09', size: 9, difficulty: 1050, answers: ['B3'],
    setup: { rows: ['.........', '.........', '.........', 'OOOO.....', 'XXXO.....', '..XO.....', 'O.XO.....', 'O.XO.....', 'XXSO.....'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue B3, et ton groupe finit pris.' },
    title: 'Seki au bord',
    prompt: 'Sauve ton groupe marqué par un seki (vie commune) : il ne peut plus faire deux yeux.',
    explanation: 'Bravo ! Si Blanc ne répond pas, A4 met A2 et A3 en atari, et ton groupe vit. Blanc doit donc jouer A4 lui-même. Ton groupe et ses pierres partagent alors deux libertés, B2 et B4 : celui qui en remplit une se fait prendre. C’est seki.'
  },
  {
    id: 'aa10', size: 9, difficulty: 1050, answers: ['A3'],
    setup: { rows: ['.........', '.........', '.........', '.........', 'XXXX.....', '.OOX.....', '..OX.....', '.OTX.....', '.OXX.....'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue A3, et tu ne peux plus prendre son groupe.' },
    title: 'Au milieu du bord',
    prompt: 'Noir joue et tue.',
    explanation: 'Bravo ! A3 est le point vital : il touche B3, A2 et A4. Si Blanc joue A2, tu joues A4 ; s’il joue A4, tu joues A2. Il ne fait jamais deux yeux.'
  },
  {
    id: 'aa11', size: 9, difficulty: 1100, answers: ['B2'],
    setup: { rows: ['.........', '.........', '.........', '.........', '.........', 'XXXXX....', 'TOOOX....', '...OX....', '..O.X....'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue B2, et tu ne peux plus prendre son groupe.' },
    title: 'Au cœur de l’espace',
    prompt: 'Noir joue et tue. Blanc vient de jouer C1.',
    explanation: 'Bravo ! B2 est le point vital de l’espace blanc. Si Blanc joue A2, tu réponds B1 ; s’il joue B1, tu réponds A2. Il ne fait jamais deux yeux.'
  },
  {
    id: 'aa12', size: 9, difficulty: 1100, answers: ['B2'],
    setup: { rows: ['.........', '.........', '.........', '.........', '.........', 'OOOOO....', 'SXXXO....', 'O..XO....', '....O....'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue B2, et ton groupe meurt, même si tu gagnes tous les ko.' },
    title: 'Un ko pour vivre',
    prompt: 'Noir joue : vivre sans ko est impossible ici. Obtiens au moins un ko (une prise qu’on ne peut pas reprendre tout de suite).',
    explanation: 'Bravo ! B2 met la pierre A2 en atari. Blanc ne peut plus te tuer sans gagner un ko : si c’est toi qui le gagnes, tu vis. Après tout autre coup, ton groupe mourait, ko ou pas.'
  },
  {
    id: 'aa13', size: 9, difficulty: 1100, answers: ['H9'],
    setup: { rows: ['....X....', '....XO..O', '....XOOOT', '....XXXXX', '.........', '.........', '.........', '.........', '.........'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue H9, et tu ne peux plus prendre son groupe.' },
    title: 'Le point vital du coin',
    prompt: 'Noir joue et tue.',
    explanation: 'Bravo ! H9 touche J9, G9 et H8 : c’est le point vital. Si Blanc joue H8, tu réponds G9 ; s’il joue G9, tu réponds H8. Il ne fait jamais deux yeux.'
  },
  {
    id: 'aa14', size: 9, difficulty: 1150, answers: ['J2'],
    setup: { rows: ['.........', '.........', '.........', '.........', '.........', '...OOOOOO', '...OXXXXS', '...OX.OO.', '...OX.OO.'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue J2 : le carré a alors plus de libertés que ton groupe, et il le prend.' },
    title: 'Le carré blanc',
    prompt: 'Sauve ton groupe marqué par un seki (vie commune) : il ne peut plus faire deux yeux.',
    explanation: 'Bravo ! J2 enlève une liberté au carré blanc. Ton groupe et le carré partagent alors toutes leurs libertés : J1, F1 et F2. Personne ne peut plus prendre l’autre : c’est seki. Si Blanc joue J2 le premier, il a plus de libertés que toi et prend ton groupe.'
  },
  {
    id: 'aa15', size: 9, difficulty: 1150, answers: ['G8'],
    setup: { rows: ['...OX....', '...OX..O.', '...OXXXXS', '...OOOOOO', '.........', '.........', '.........', '.........', '.........'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue G8 : sa pierre H8 s’agrandit, et tu ne fais plus deux yeux.' },
    title: 'Enferme la pierre blanche',
    prompt: 'Noir joue et vit. Blanc vient de jouer H8, dans ton espace.',
    explanation: 'Bravo ! G8 enferme la pierre H8 : elle n’a plus que deux libertés, J8 et H9. Quoi que Blanc joue ensuite, tu fais deux yeux. Si Blanc joue G8 le premier, tu ne fais plus deux yeux.'
  },
  {
    id: 'aa16', size: 9, difficulty: 1200, answers: ['D2'],
    setup: { rows: ['.........', '.........', '.........', '.........', '.........', 'OOOOOOO..', 'OSXXXXO..', 'OXO..XO..', 'O.....O..'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue D2, et tu ne fais plus deux yeux.' },
    title: 'Deux paires miai',
    prompt: 'Noir joue et vit. Blanc a joué C2, dans ton espace.',
    explanation: 'Bravo ! Après D2, B1 et C1 sont miai : deux points qui se valent. Si Blanc prend l’un, tu prends l’autre. E1 et F1 aussi. Quoi que Blanc joue, tu fais deux yeux.'
  },
  {
    id: 'aa17', size: 9, difficulty: 1200, answers: ['J7'],
    setup: { rows: ['.....XT..', '.....XOO.', '.....XO..', '.....XOO.', '.....XXXX', '.........', '.........', '.........', '.........'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue J7, et son groupe vit, même si tu gagnes tous les ko.' },
    title: 'Un ko pour tuer',
    prompt: 'Noir joue : tuer sans ko est impossible ici. Obtiens au moins un ko (une prise qu’on ne peut pas reprendre tout de suite).',
    explanation: 'Bravo ! Après J7, Blanc ne peut plus vivre sans gagner un ko : si c’est toi qui le gagnes, son groupe meurt. Après tout autre coup, Blanc vivait, ko ou pas.'
  },
  {
    id: 'aa18', size: 9, difficulty: 1200, answers: ['B9'],
    setup: { rows: ['..X...X..', 'TOOOOX...', 'XXXXXXX..', '.........', '.........', '.........', '.........', '.........', '.........'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue B9 : ta pierre C9 est en atari, et tu ne peux plus prendre son groupe.' },
    title: 'Cinq pierres au bord',
    prompt: 'Noir joue et tue. Ta pierre C9 est déjà dans l’espace blanc.',
    explanation: 'Bravo ! B9 se relie à ta pierre C9. Si Blanc joue D9, tu réponds F9 ; s’il joue F9, tu réponds D9. Il ne fait jamais deux yeux.'
  },
  {
    id: 'aa19', size: 9, difficulty: 1250, answers: ['D9'],
    setup: { rows: ['XO....X..', 'XOO..OX..', 'XXTOOOX..', '.XXXXXX..', '.........', '.........', '.........', '.........', '.........'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue D9, et tu ne peux plus prendre son groupe.' },
    title: 'Le point sous le bord',
    prompt: 'Noir joue et tue.',
    explanation: 'Bravo ! D9 est le point vital. Si Blanc joue D8, tu réponds E9 ; s’il joue E9, tu réponds D8. Il ne fait jamais deux yeux.'
  },
  {
    id: 'aa20', size: 9, difficulty: 1250, answers: ['J2'],
    setup: { rows: ['.........', '.........', '.........', '.........', '.....XXXX', '.....XOOT', '.....XOO.', '.....XOO.', '.....XO..'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue J2, et son groupe vit, même si tu gagnes tous les ko.' },
    title: 'Le ko du coin',
    prompt: 'Noir joue : tuer sans ko est impossible ici. Obtiens au moins un ko (une prise qu’on ne peut pas reprendre tout de suite).',
    explanation: 'Bravo ! J2 se place au milieu de l’espace blanc. Si Blanc joue J1, tu prends en H1 : c’est un ko. Si c’est toi qui le gagnes, son groupe meurt. Après tout autre coup, Blanc vivait, ko ou pas.'
  },
];

export default LOT_AA;
