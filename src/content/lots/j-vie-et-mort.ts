// Lot J de l'issue #136, seconde partie : vie et mort de 800 à 1000 (points vitaux, quatre en ligne sur le bord,
// trois en L dans le coin), 9 × 9, Noir au trait. Aucun seki, aucun ko. Même contenu que la migration
// 20260928020100_lot_j ; chaque position est prouvée par src/go/lot-j.test.ts (recherche complète dans l'espace
// clos, comme le lot C). `setup.refutation` est le texte affiché après une erreur.
import type { PuzzleRow } from '../../data/puzzles';

const E = '.........';

const LOT_J_VIE_ET_MORT: PuzzleRow[] = [
  {
    id: 'j05', size: 9, difficulty: 800, answers: ['G1'],
    setup: { rows: [E, E, E, E, E, E, 'XXXXXXXX.', 'XTOOOOOX.', 'XO..O..X.'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue G1 : F1 devient un œil, et C1-D1 en donne un second. Son groupe est vivant." },
    title: "Ferme depuis l'extérieur",
    prompt: 'Noir joue et tue. Le groupe blanc a deux espaces sur le bord : C1-D1 et F1-G1.',
    explanation: "Bravo ! G1 s'appuie sur ta pierre H1 et touche F1 : F1 n'est plus un œil (un point vide entouré par Blanc). Il reste à Blanc l'espace C1-D1, qui ne fait qu'un œil. Avec un seul œil, son groupe finit capturé. En F1, ta pierre n'aurait eu qu'une liberté : Blanc l'aurait prise en G1."
  },
  {
    id: 'j06', size: 9, difficulty: 830, answers: ['D3'],
    setup: { rows: [E, E, E, E, E, 'XXXXXX...', 'XTO.OX...', 'O.O.OX...', 'OOOOOX...'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue D3 et a deux yeux, B2 et D2. Si tu entres en D2, ta pierre n'a qu'une liberté : Blanc la prend en D3." },
    title: "L'œil touché par le haut",
    prompt: 'Noir joue et tue. Blanc a un œil en B2. Peut-il en faire un second ?',
    explanation: "Bravo ! D3 s'appuie sur ton mur et touche D2 : D2 n'est plus un œil (un point vide entouré par Blanc). Il ne reste à Blanc qu'un œil, en B2. S'il remplit D2, il n'a toujours qu'un œil, et son groupe finit capturé."
  },
  {
    id: 'j07', size: 9, difficulty: 860, answers: ['B1', 'E1'],
    setup: { rows: [E, E, E, E, E, E, 'OOOOOOO..', 'XSXXXXO..', '.....OO..'], toPlay: 'B',
      refutation: "Pas tout à fait. Si tu joues A1 ou C1, Blanc joue E1 : ton espace devient trop petit pour deux yeux. Si tu joues D1, Blanc joue B1, et c'est pareil." },
    title: 'Quatre en ligne sur le bord',
    prompt: 'Noir joue et vit. Tu as cinq points vides sur la première ligne, de A1 à E1.',
    explanation: "Bravo ! E1 bloque Blanc et te laisse quatre points en ligne, de A1 à D1. Quatre points en ligne sur le bord font deux yeux : si Blanc joue B1, tu réponds C1, et inversement. B1 marche aussi : il fait un œil dans le coin, en A1. Si Blanc joue ensuite D1, tu réponds E1, et inversement."
  },
  {
    id: 'j08', size: 9, difficulty: 880, answers: ['G1'],
    setup: { rows: [E, E, E, E, E, E, 'XXXXXXXX.', 'XTOOOOOX.', 'XO.O.X.X.'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue G1 : ta pierre F1 est en atari (une seule liberté, E1). Blanc la prendra, et sa place lui donnera un second œil." },
    title: 'Garde ta pierre dedans',
    prompt: 'Noir joue et tue. Ta pierre F1 est entrée dans le camp blanc.',
    explanation: "Bravo ! Ta pierre F1 n'avait que deux libertés, E1 et G1. G1 la relie à H1 : elle est sauvée. E1 touche F1, ce n'est donc pas un œil pour Blanc. Il ne lui reste qu'un œil, en C1, et son groupe finit capturé."
  },
  {
    id: 'j09', size: 9, difficulty: 920, answers: ['B1'],
    setup: { rows: [E, E, E, E, E, 'XXXXXX...', 'TOOOOX...', 'O.OO.X...', '.....X...'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue B1 et a deux yeux : B2 et le coin, A1." },
    title: 'Le point qui gâche deux yeux',
    prompt: 'Noir joue et tue. Blanc a un trou en B2 et toute la première ligne.',
    explanation: "Superbe ! B1 touche B2 et A1 en même temps : aucun des deux n'est plus un œil (un point vide entouré par Blanc). À droite, E1 et E2 touchent ton mur : Blanc n'y fait pas deux yeux. Un point qui gâche deux yeux à la fois, c'est un point vital."
  },
  {
    id: 'j10', size: 9, difficulty: 950, answers: ['E1'],
    setup: { rows: [E, E, E, E, E, 'XXXXXX...', 'TOO.OX...', 'OOOOOX...', 'X.O..X...'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue E1 : D1 devient un œil, et il peut prendre A1 en B1 pour en faire un second dans le coin." },
    title: 'Les faux espoirs de Blanc',
    prompt: 'Noir joue et tue. Blanc a trois espaces : D3, le coin et D1-E1.',
    explanation: "Bravo ! D3 n'est pas un œil : ta pierre D4 le touche. Blanc peut prendre A1 en B1 pour faire un œil dans le coin. Il lui en faut donc un autre : E1 le lui enlève, car D1 touche maintenant ta pierre. Un seul œil : son groupe finit capturé."
  },
  {
    id: 'j11', size: 9, difficulty: 980, answers: ['A1'],
    setup: { rows: [E, E, E, E, E, 'XXXXXX...', 'TO.O.X...', '.OOOOX...', '..OOOX...'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue A1 et a deux yeux, A2 et B1." },
    title: 'Trois en L dans le coin',
    prompt: 'Noir joue et tue. Les points vides A2, A1 et B1 forment un L.',
    explanation: "Bravo ! Le point vital d'un L de trois points est le coin du L, ici A1. C3 et E3 ne sont pas des yeux : ils touchent ton mur. Après A1, Blanc ne peut faire qu'un œil dans le coin, même s'il prend ta pierre. Si Blanc jouait A1 le premier, il aurait deux yeux, A2 et B1."
  },
];

export default LOT_J_VIE_ET_MORT;
