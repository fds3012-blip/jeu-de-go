// Lot B (issue #91) : techniques de capture, niveau intermédiaire (difficulté 600 à 1100), 9 × 9, Noir au trait.
// Même contenu que la migration 20260927170200_lot_b_techniques ; chaque position est prouvée par src/go/lot-b.test.ts
// (réponses acceptées = exactement les coups gagnants). `setup.refutation` est le texte affiché après une erreur.
import type { PuzzleRow } from '../../data/puzzles';

const LOT_B: PuzzleRow[] = [
  {
    id: 'k01', size: 9, difficulty: 600, answers: ['E2'],
    setup: { rows: ['.........', '.........', '.........', '.........', '.........', '.........', '.........', '...X.....', '..XTO....'], toPlay: 'B',
      refutation: "Pas tout à fait. Après F1, Blanc s'allonge en E2, vers le centre, et ses pierres s'échappent. Bloque plutôt le côté du centre." },
    title: 'Le long du bord',
    prompt: 'Noir joue et capture les pierres blanches marquées. Garde-les collées au bord.',
    explanation: "Bravo ! Après E2, les pierres blanches sont en atari : il ne leur reste qu'une liberté (un point vide à côté d'elles), F1. Si Blanc s'allonge en F1, tu joues F2 et il est de nouveau en atari, et ainsi de suite jusqu'au coin. Remettre en atari à chaque coup une pierre qui fuit, c'est une échelle. Ici, aucune pierre blanche ne bloque le chemin jusqu'au coin : l'échelle finit par capturer."
  },
  {
    id: 'k02', size: 9, difficulty: 650, answers: ['F2'],
    setup: { rows: ['.........', '.........', '.........', '.........', '.........', '.........', '....X....', '...XT....', '....O....'], toPlay: 'B',
      refutation: "Pas tout à fait. Si tu bloques du côté gauche, Blanc s'allonge en F2, vers le large, et ses pierres s'échappent. Ferme d'abord le côté ouvert." },
    title: 'Ferme le côté ouvert',
    prompt: 'Noir joue et capture les deux pierres blanches marquées, collées au bord.',
    explanation: "Bien joué ! Les pierres blanches ont trois libertés (les points vides à côté d'elles) : D1, F1 et F2. En F2, tu fermes le seul côté qui mène au large. Il ne leur reste que deux libertés sur la première ligne, et chaque fois que Blanc s'allonge le long du bord, tu le remets en atari (une seule liberté) jusqu'à la capture."
  },
  {
    id: 'k03', size: 9, difficulty: 700, answers: ['E6', 'D5'],
    setup: { rows: ['.........', '.........', '...X.....', '..XT.....', '....X....', '.........', '.........', '.........', '.........'], toPlay: 'B',
      refutation: "Pas encore. La pierre marquée a deux libertés, E6 et D5. Si tu ne la mets pas en atari tout de suite, Blanc joue sur l'une d'elles et s'échappe vers le centre." },
    title: "L'échelle",
    prompt: 'Noir joue et capture la pierre marquée. Aucune pierre blanche ne peut venir l’aider.',
    explanation: "Exact ! Tu mets la pierre en atari (une seule liberté). Chaque fois qu'elle s'allonge, tu la remets en atari du même côté : elle zigzague en diagonale jusqu'au bord, où elle est capturée. C'est une échelle. Ici, les deux mises en atari marchent, car aucune pierre blanche n'attend sur le chemin."
  },
  {
    id: 'k04', size: 9, difficulty: 750, answers: ['B1'],
    setup: { rows: ['.........', '.........', '.........', '.........', '.........', '.........', 'XXXXX....', 'OOTOX....', '...OX....'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue B1 et fait deux yeux, A1 et C1 : son groupe est vivant. Le point clé est le même pour les deux joueurs." },
    title: 'Le manque de libertés',
    prompt: 'Noir joue et capture le groupe blanc. Blanc voudrait faire deux yeux sur le bord.',
    explanation: "Bravo ! En B1, tu empêches Blanc de faire deux yeux (deux points vides entourés par ses pierres). Et Blanc ne peut pas prendre ta pierre : pour la mettre en atari en A1 ou en C1, il bouche l'une de ses deux dernières libertés et se met lui-même en atari. Tu captures alors tout le groupe. Ne pas pouvoir attaquer sans se priver de libertés, c'est un manque de libertés (damezumari en japonais)."
  },
  {
    id: 'k05', size: 9, difficulty: 800, answers: ['D5'],
    setup: { rows: ['.........', '.........', '...X.....', '..XT.....', '....X....', '.........', '.O.......', '.........', '.........'], toPlay: 'B',
      refutation: "Pas celle-là. Après E6, Blanc s'allonge en D5 et l'échelle part vers le bas à gauche : elle bute sur la pierre blanche B3, Blanc s'y relie et s'échappe. Pousse-le dans l'autre direction." },
    title: "L'échelle cassée",
    prompt: 'Noir joue et capture la pierre marquée. Regarde où mène chaque échelle avant de jouer.',
    explanation: "Bien vu ! Une échelle (une suite de mises en atari qui zigzague en diagonale) est cassée quand une pierre adverse se trouve sur son chemin : la pierre qui fuit s'y relie et retrouve des libertés. La pierre blanche B3 casse l'échelle vers le bas à gauche. Avec D5, Blanc s'allonge en E6 et fuit vers le haut à droite, où rien ne l'attend : il est capturé contre le bord."
  },
  {
    id: 'k06', size: 9, difficulty: 850, answers: ['E4'],
    setup: { rows: ['.........', '.........', '.........', '...OXX...', '...XT....', '.........', '.........', '.........', '.........'], toPlay: 'B',
      refutation: "Pas celle-là. Après F5, la pierre qui coupe s'allonge en E4, vers le centre : elle a trois libertés et s'échappe. Pousse-la plutôt vers ta pierre F6." },
    title: 'Prends la pierre qui coupe',
    prompt: 'La pierre blanche marquée coupe tes pierres D5 et E6. Noir joue et la capture.',
    explanation: "Bravo ! E4 met la pierre qui coupe en atari (une seule liberté). Si elle s'allonge en F5, tu la remets en atari à chaque coup, en zigzag vers le bas à droite : c'est une échelle, et aucune pierre blanche ne l'attend sur ce chemin. Une fois la pierre qui coupe capturée, tes pierres D5 et E6 sont solidement reliées."
  },
  {
    id: 'k07', size: 9, difficulty: 900, answers: ['D5'],
    setup: { rows: ['.........', '......O..', '...X..X..', '..XT.....', '....X....', '.........', '.O.......', '.........', '.........'], toPlay: 'B',
      refutation: "Pas tout à fait. Après E6, Blanc s'allonge en D5 et l'échelle part vers le bas à gauche, droit sur la pierre blanche B3 : elle est cassée. Vers le haut à droite, ta pierre G7 te protège de G8." },
    title: 'La pierre relais',
    prompt: 'Noir joue et capture. Deux pierres blanches guettent tes échelles, mais une pierre noire t’aide.',
    explanation: "Superbe ! Avec D5, Blanc fuit vers le haut à droite. Sans ta pierre G7, l'échelle (une suite de mises en atari en zigzag) buterait sur la pierre blanche G8 et Blanc s'échapperait. Mais G7 se trouve sur le chemin : elle ferme la route et prend la place d'une mise en atari. On l'appelle une pierre relais. Vers le bas à gauche, en revanche, B3 casse l'échelle."
  },
  {
    id: 'k08', size: 9, difficulty: 950, answers: ['E4'],
    setup: { rows: ['.........', '.........', '.........', '..X......', '..XT.X...', '..XT.T...', '...XX....', '.........', '.........'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue E4 et relie toutes ses pierres en un seul groupe, qui a assez de libertés pour s'échapper. Le point de coupe est aussi son point de liaison." },
    title: 'Coupe et double menace',
    prompt: 'Noir joue et capture des pierres blanches. Un seul coup menace deux groupes à la fois.',
    explanation: "Exact ! E4 coupe les pierres blanches en deux groupes. Chacun n'a plus que deux libertés (les points vides à côté de lui) : D6 et E5 pour l'un, F3 et G4 pour l'autre. C'est une double menace : Blanc ne peut sauver qu'un groupe, et tu captures l'autre."
  },
  {
    id: 'k09', size: 9, difficulty: 1000, answers: ['D6'],
    setup: { rows: ['.........', '..O......', '..O......', '.....X...', '....TX...', '...XX....', '.........', '.........', '.........'], toPlay: 'B',
      refutation: "Pas tout à fait. Une mise en atari directe lance une échelle que les pierres blanches C7 et C8 cassent, et un filet plus large laisse Blanc se glisser vers elles. Serre au plus près." },
    title: 'Le filet serré',
    prompt: 'Noir joue et capture la pierre marquée. L’échelle ne marche pas : enferme-la.',
    explanation: "Bravo ! D6 ne touche pas la pierre, mais lui ferme les deux sorties : c'est un filet (geta en japonais). Si Blanc sort en E6, tu joues E7 ; s'il sort en D5, tu joues C5. Chaque fois, il est en atari (une seule liberté) et tu le captures. Un filet plus large, en C6 ou en D7, laisse trop de place : avec l'aide de C7 et C8, Blanc s'échappe."
  },
  {
    id: 'k10', size: 9, difficulty: 1050, answers: ['E3'],
    setup: { rows: ['.........', '.........', '.........', '.........', '.........', '.........', '..X...X..', '.XTTXTTX.', '.X.....X.'], toPlay: 'B',
      refutation: "Pas tout à fait. Ta pierre E2 n'a que deux libertés, E1 et E3. Si tu joues ailleurs, Blanc joue E3 et la met en atari : tu dois la défendre, et Blanc a le temps de sauver ses deux groupes." },
    title: 'Renforce la pierre qui coupe',
    prompt: 'Ta pierre E2 coupe deux groupes blancs. Noir joue et capture l’un d’eux.',
    explanation: "Superbe ! E3 renforce ta pierre qui coupe, puis menace deux choses à la fois : jouer en D3 pour enfermer le groupe de gauche, ou en F3 pour enfermer celui de droite. C'est une double menace. Si Blanc sort d'un côté, tu fermes l'autre : ce groupe, collé au bord, n'a plus que deux libertés (les points vides à côté de lui) et tu le captures."
  }
];

export default LOT_B;
