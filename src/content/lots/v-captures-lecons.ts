// Lot V de l'issue #16 : 16 problèmes qui prolongent les leçons 9 à 12 (filet, prise en retour, course aux libertés,
// faux œil). Faciles (400 à 680) : capture, atari, sauver une pierre, échelle courte, double atari. Moyens (740 à
// 1050) : échelle, filet (geta), prise en retour (snapback), double atari. Plus durs (1150 à 1380) : course aux
// libertés, faux œil, point vital.
// 9 × 9, Noir au trait. Aucun ko, aucun seki. Même contenu que la migration 20260930210100_lot_v ; chaque position est
// prouvée par src/go/lot-v.test.ts :
// - capture (lecteur exact src/go/lecteurs-lot-n.ts, avec et sans ko) : la réponse prend une pierre marquée dans le
//   nombre de coups annoncé, contre toute défense, et aucun autre coup noir n'y arrive ;
// - sauver (même lecteur) : après la réponse, Blanc ne prend pas la pierre marquée en quatre coups ; après tout autre
//   coup, il la prend aussitôt ;
// - vivre, tuer (outil src/go/preuve-vie-mort.ts, recherche complète dans une zone fermée, un ko compte comme non
//   résolu) : comme les lots Q, R, T et U.
import type { PuzzleRow } from '../../data/puzzles';

const E = '.........';

const LOT_V: PuzzleRow[] = [
  {
    id: 'v01', size: 9, difficulty: 400, answers: ['D4'],
    setup: { rows: [E, E, E, '...XX....', '..XTTX...', '....X....', E, E, E], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue D4 et s'allonge : tu ne peux plus prendre ses pierres en un coup." },
    title: 'La dernière liberté',
    prompt: 'Capture les pierres marquées en un coup.',
    explanation: "Bravo ! Les deux pierres blanches n'avaient plus qu'une liberté, D4 : elles étaient en atari. Tu joues sur cette dernière liberté et tu les captures toutes les deux."
  },
  {
    id: 'v02', size: 9, difficulty: 450, answers: ['E4'],
    setup: { rows: [E, E, E, '....O....', '...OSO...', E, '....X....', E, E], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue E4 : ta pierre E5 n'a plus de liberté, elle est capturée." },
    title: 'Rejoins tes amies',
    prompt: 'Ta pierre marquée est en atari (une seule liberté). Sauve-la.',
    explanation: "Bravo ! E4 relie ta pierre à E3. Ensemble, elles ont maintenant plusieurs libertés : Blanc ne peut plus les prendre. Pour sauver une pierre en atari, allonge-la vers tes pierres."
  },
  {
    id: 'v03', size: 9, difficulty: 500, answers: ['C5'],
    setup: { rows: [E, E, '..X......', '.XT.X....', '...X.....', E, E, E, E], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue C5 : sa pierre s'allonge vers le bas et garde assez de libertés. Mets-la en atari de l'autre côté." },
    title: 'Pousse-la vers ton mur',
    prompt: 'Capture la pierre marquée en deux coups au plus.',
    explanation: "Bravo ! C5 met C6 en atari : il ne lui reste que D6. Si Blanc s'allonge en D6, il bute sur tes pierres E6 et D5 : il est encore en atari, et tu le prends en D7. Mets en atari du côté qui pousse vers tes pierres."
  },
  {
    id: 'v04', size: 9, difficulty: 560, answers: ['D1'],
    setup: { rows: [E, E, E, E, E, E, '...XO....', '..XOSO...', '.....O...'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue E1 (ou D1 si tu as joué E1) : ta pierre n'a plus de liberté, elle est capturée." },
    title: 'Prends la pierre qui serre',
    prompt: 'Ta pierre marquée est en atari (une seule liberté). Sauve-la.',
    explanation: "Bravo ! La pierre blanche D2 était en atari elle aussi : D1 la capture. Ta pierre E2 gagne une liberté en D2, et Blanc ne peut plus la prendre. En E1, elle serait restée en atari."
  },
  {
    id: 'v05', size: 9, difficulty: 620, answers: ['E3'],
    setup: { rows: [E, E, E, E, E, '...X.....', '..XT.....', '....X....', E], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue E3 : sa pierre s'allonge vers le haut et s'échappe." },
    title: 'Petite échelle',
    prompt: 'Capture la pierre marquée en quatre coups au plus.',
    explanation: "Bravo ! E3 met D3 en atari et la pousse vers le bord. Si Blanc s'allonge en D2, C2 le remet en atari ; en D1, E1 recommence. Au bord, il n'a plus de place : tu le prends en B1. C'est une échelle, une suite d'atari en zigzag."
  },
  {
    id: 'v06', size: 9, difficulty: 680, answers: ['E5'],
    setup: { rows: [E, E, E, '...X.....', '...T.....', '...XTX...', E, E, E], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue E5 : il relie ses deux pierres, qui ont alors assez de libertés." },
    title: 'Deux atari à la fois',
    prompt: 'Capture une des pierres marquées en deux coups au plus.',
    explanation: "Bravo ! E5 met les deux pierres en atari à la fois : c'est un double atari. Blanc ne peut en sauver qu'une. S'il s'allonge en C5, tu prends E4 en E3. S'il s'allonge en E3, tu prends D5 en C5."
  },
  {
    id: 'v07', size: 9, difficulty: 740, answers: ['E4'],
    setup: { rows: [E, E, E, E, '.....X...', '.....TX..', '....X....', E, '.......X.'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue E4 : sa pierre s'allonge vers la gauche et s'échappe." },
    title: "L'échelle jusqu'au bout",
    prompt: 'Capture la pierre marquée en cinq coups au plus.',
    explanation: "Superbe ! E4 met F4 en atari du côté du centre. S'il s'allonge en F3, F2 le remet en atari. Puis G3 appelle H3, et G2 appelle H2. Ta pierre H1 ferme la dernière porte : tu le prends en F1. Avant de lancer une échelle, suis-la jusqu'au bout."
  },
  {
    id: 'v08', size: 9, difficulty: 800, answers: ['E5'],
    setup: { rows: [E, E, E, E, '..X......', '..XT.X...', '...X.....', E, E], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue E4 (ou D5 si tu as joué E4 ou E3) : sa pierre s'allonge et s'échappe." },
    title: 'Le filet',
    prompt: 'Capture la pierre marquée en trois coups au plus.',
    explanation: "Bravo ! E5 est un filet (geta) : tu ne touches pas la pierre, tu fermes ses sorties. Si Blanc sort en D5, D6 le remet en atari ; s'il sort en E4, E3 le remet en atari. Il bute chaque fois sur tes pierres, et tu le prends au coup suivant."
  },
  {
    id: 'v09', size: 9, difficulty: 850, answers: ['D1'],
    setup: { rows: [E, E, E, E, E, E, '.O.XXX...', '.OX.TX...', '.OO.TX...'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue D1 : il relie E1 et E2 à son groupe de gauche, et elles respirent." },
    title: 'Donne une pierre',
    prompt: 'Capture les pierres marquées en deux coups au plus.',
    explanation: "Superbe ! D1 donne une pierre : Blanc peut la prendre en D2. Mais alors ses trois pierres n'ont plus qu'une liberté, D1. Tu rejoues en D1 et tu les prends toutes. C'est une prise en retour (snapback)."
  },
  {
    id: 'v10', size: 9, difficulty: 900, answers: ['C3'],
    setup: { rows: [E, E, E, '..X......', '.XTX.....', '..TX.....', '...T.....', '...XX....', E], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue C3 : il relie toutes ses pierres, qui ont alors assez de libertés." },
    title: 'Le point de coupe',
    prompt: 'Capture une des pierres marquées en deux coups au plus.',
    explanation: "Bravo ! C3 coupe et met les deux groupes blancs en atari : C5-C4 n'a plus que B4, D3 n'a plus que E3. Blanc ne peut en sauver qu'un : tu prends l'autre au coup suivant."
  },
  {
    id: 'v11', size: 9, difficulty: 980, answers: ['F4'],
    setup: { rows: [E, E, E, E, E, '...X.....', '...XT....', '....XX...', E], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue F3 (ou E4 si tu as joué F3 ou G3) : sa pierre s'allonge et s'échappe." },
    title: 'Ferme les deux portes',
    prompt: 'Capture la pierre marquée en trois coups au plus.',
    explanation: "Bravo ! F4 est un filet : il ferme les deux sorties sans toucher la pierre. Si Blanc sort en E4, E5 le remet en atari ; s'il sort en F3, G3 le remet en atari. Tu le prends au coup suivant."
  },
  {
    id: 'v12', size: 9, difficulty: 1050, answers: ['D9'],
    setup: { rows: ['.OO.TX...', '.OX.TX...', '...XTX...', '....X....', E, E, E, E, E], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue D9 : il relie ses pierres à son groupe de gauche." },
    title: 'Prends-en quatre',
    prompt: 'Capture les pierres marquées en deux coups au plus.',
    explanation: "Superbe ! D9 donne une pierre. Si Blanc la prend en D8, ses quatre pierres n'ont plus qu'une liberté, D9 : tu reprends là et tu les captures toutes. En D8, tu l'aurais laissé se relier en D9 à ses pierres de gauche."
  },
  {
    id: 'v13', size: 9, difficulty: 1150, answers: ['B1', 'D1'],
    setup: { rows: [E, E, E, E, E, E, 'XXXXOOOOO', 'XTTTXXXOO', E], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue F1 (ou E1 si tu as joué F1, ou D1 si tu as joué C1) : il bouche tes libertés plus vite que toi, et il gagne la course." },
    title: 'Par un bout',
    prompt: 'Course aux libertés : tes pierres E2, F2 et G2 sont enfermées elles aussi. Capture les pierres marquées en trois coups au plus.',
    explanation: "Superbe ! Compte : Blanc a trois libertés, B1, C1 et D1 ; toi aussi, E1, F1 et G1. Tu joues d'abord : bouche une liberté blanche par un bout, B1 ou D1. Ensuite, chaque fois que Blanc bouche une des tiennes, bouches-en une des siennes. En C1, au milieu, ta pierre serait mise en atari par B1 ou D1."
  },
  {
    id: 'v14', size: 9, difficulty: 1220, answers: ['C2'],
    setup: { rows: [E, E, E, E, E, E, 'OOOOOO...', 'SX.XXO...', '.X.X.O...'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue C2 : il coupe ton groupe en deux. C1 devient un faux œil, et ton groupe finit capturé." },
    title: 'Un œil à deux maîtres',
    prompt: 'Noir joue et vit. Regarde C1 : est-ce un vrai œil ?',
    explanation: "Bravo ! C2 relie tes deux morceaux : A1 et C1 deviennent deux vrais yeux, et ton groupe vit. Si Blanc jouait C2, D1, D2 et E2 ne tiendraient au reste que par C1 : C1 ne serait plus qu'un faux œil, et ton groupe finirait capturé."
  },
  {
    id: 'v15', size: 9, difficulty: 1300, answers: ['D2'],
    setup: { rows: [E, E, E, E, E, E, 'XXXXXXXX.', 'XOO.OOOX.', 'XT.O..OX.'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue D2 : il relie toutes ses pierres, et C1 et E1-F1 lui font deux yeux. Son groupe est vivant." },
    title: 'Le coin de l’œil',
    prompt: 'Noir joue et tue. Regarde l’œil blanc C1 et ses coins.',
    explanation: "Superbe ! D2 prend le coin de l'œil C1. La pierre D1 ne tient plus au reste que par C1 : C1 est un faux œil. À droite, E1 et F1 ne font qu'un œil. Blanc ne peut plus faire deux vrais yeux, et son groupe finit capturé."
  },
  {
    id: 'v16', size: 9, difficulty: 1380, answers: ['A3'],
    setup: { rows: [E, E, E, E, E, 'XXXXXX...', '.T..OX...', '.OOO.X...', 'O.OOOX...'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue A3 : A2 et B1 deviennent deux yeux. Son groupe est vivant." },
    title: 'Le point du bord',
    prompt: 'Noir joue et tue. Blanc a de la place dans le coin : où est son point faible ?',
    explanation: "Superbe ! A3, sur le bord, est le point vital : A2 ne peut plus devenir un œil, et il ne reste que B1. Si tu jouais A2 tout de suite, Blanc prendrait ta pierre en A3, et A2 redeviendrait un œil."
  },
];

export default LOT_V;
