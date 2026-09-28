// Lot O de l'issue #136 : milieu de courbe, difficulté 650 à 940. Filet (geta), prise en retour, échelle (pierre
// relais, échelle cassée) et course aux libertés simple. 9 × 9, Noir au trait. Aucun ko.
// Même contenu que la migration 20260928060100_lot_o ; chaque position est prouvée par src/go/lot-o.test.ts
// (lecteur exact src/go/lecteurs-lot-n.ts, tous les coups légaux et la passe, avec et sans ko).
// Capturer : la réponse prend une pierre marquée (T) dans le nombre de coups annoncé, contre toute défense, et aucun
// autre coup noir n'y arrive.
import type { PuzzleRow } from '../../data/puzzles';

const E = '.........';

const LOT_O: PuzzleRow[] = [
  {
    id: 'o01', size: 9, difficulty: 650, answers: ['E6'],
    setup: { rows: [E, E, '...X.....', '......O..', '..XT.X...', '...X.....', E, E, E], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc s'allonge en E5, ou en D6 si tu as joué E5 ou E4, et garde assez de libertés pour s'échapper. Ne touche pas la pierre : ferme ses deux sorties." },
    title: 'Le filet',
    prompt: 'Capture la pierre marquée en trois coups au plus.',
    explanation: "Bravo ! E6 ne touche pas la pierre, mais ferme ses deux sorties, D6 et E5 : c'est un filet (geta en japonais). Si Blanc sort en D6, tu joues C6 : il est en atari (une seule liberté). S'il s'allonge en E5, il l'est encore, et tu le prends en E4. S'il sort d'abord en E5, tu joues E4, puis C6."
  },
  {
    id: 'o02', size: 9, difficulty: 680, answers: ['E1'],
    setup: { rows: [E, E, E, E, E, E, '..XXX....', '..XT.X...', '..XT.OOO.'], toPlay: 'B',
      refutation: "Pas tout à fait. En E2, tu mets les pierres en atari, mais Blanc joue E1 : il les relie à ses pierres F1, G1 et H1, et le groupe respire. Joue plutôt en E1, même si Blanc peut prendre ta pierre." },
    title: 'Donne une pierre, prends-en trois',
    prompt: 'Capture les pierres marquées en deux coups au plus.',
    explanation: "Bravo ! En E1, ta pierre n'a qu'une liberté, E2 : Blanc peut la prendre. Mais ses pierres D2 et D1 n'ont plus qu'une liberté elles aussi, E2 : elles sont en atari. S'il prend en E2, ses trois pierres n'ont plus qu'une liberté, E1. Tu rejoues en E1 et tu les captures. C'est la prise en retour : tu donnes une pierre pour en prendre trois."
  },
  {
    id: 'o03', size: 9, difficulty: 700, answers: ['D1', 'E1', 'F1'],
    setup: { rows: [E, E, E, E, E, 'OOOO.....', 'OOOXXXX..', 'XXXTTTX..', '......X..'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue C1, ou B1 si tu as joué C1, et remplit une de tes libertés. Tu as alors moins de libertés que lui, et c'est lui qui gagne la course. Remplis les libertés de Blanc, pas les tiennes." },
    title: 'Compte les libertés',
    prompt: 'Capture les pierres marquées en trois coups au plus.',
    explanation: "Bravo ! Tes pierres A2, B2 et C2 et les pierres marquées sont enfermées côte à côte. Chaque groupe a trois libertés : A1, B1 et C1 pour toi, D1, E1 et F1 pour Blanc. Le premier qui remplit toutes les libertés de l'autre gagne : c'est une course aux libertés (semeai en japonais). Tu joues en premier : tu gagnes d'un coup, si tu remplis les libertés de Blanc et jamais les tiennes."
  },
  {
    id: 'o04', size: 9, difficulty: 710, answers: ['D5'],
    setup: { rows: [E, E, E, '....X....', '.O.......', '..X.TX...', '....X....', E, E], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc s'allonge en E5, ou en D4 si tu as joué E5 ou F5, et garde assez de libertés pour s'échapper. Ferme d'abord ses deux sorties, sans toucher la pierre." },
    title: 'Ferme les deux sorties',
    prompt: 'Capture la pierre marquée en trois coups au plus.',
    explanation: "Bravo ! D5 ferme les deux sorties de la pierre, D4 et E5, sans la toucher : c'est un filet (geta). Si Blanc sort en D4, tu joues D3 : il est en atari, et s'il s'allonge en E5, tu le prends en F5. S'il sort en E5, tu joues F5, puis D3."
  },
  {
    id: 'o05', size: 9, difficulty: 740, answers: ['A5'],
    setup: { rows: [E, 'O........', 'O........', 'OX.......', '..X......', 'TTX......', 'XX.......', E, E], toPlay: 'B',
      refutation: "Pas tout à fait. En B5, tu mets les pierres en atari, mais Blanc joue A5 : il les relie à ses pierres du haut, et le groupe a trois libertés. Joue plutôt en A5, même si Blanc peut prendre ta pierre." },
    title: 'Prise en retour sur le bord',
    prompt: 'Capture les pierres marquées en deux coups au plus.',
    explanation: "Superbe ! En A5, ta pierre n'a qu'une liberté, B5. Blanc peut la prendre, mais ses deux pierres marquées sont en atari. S'il prend en B5, ses trois pierres n'ont plus qu'une liberté, A5. Tu rejoues en A5 et tu les captures. C'est une prise en retour."
  },
  {
    id: 'o06', size: 9, difficulty: 770, answers: ['G5'],
    setup: { rows: [E, E, E, '.....X...', E, '....XT..O', '.....XX..', E, E], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc s'allonge en G4, ou en F5 si tu as joué G4 ou H4, et garde assez de libertés pour s'échapper. Ne touche pas la pierre : ferme ses deux sorties." },
    title: 'Le filet sans toucher',
    prompt: 'Capture la pierre marquée en trois coups au plus.',
    explanation: "Bravo ! G5 ferme les deux sorties de la pierre, F5 et G4 : c'est un filet. Si Blanc sort en F5, tu joues E5 : il est en atari, et s'il s'allonge en G4, tu le prends en H4. S'il sort en G4, tu joues H4, puis E5."
  },
  {
    id: 'o07', size: 9, difficulty: 800, answers: ['G9'],
    setup: { rows: ['....XT.OO', '....XT.XO', '.....XX.O', E, E, E, E, E, E], toPlay: 'B',
      refutation: "Pas tout à fait. En G8, tu mets les pierres en atari, mais Blanc joue G9 : il les relie à ses pierres de droite, et le groupe a deux libertés, H7 et J6. Joue plutôt en G9, même si Blanc peut prendre ta pierre." },
    title: 'Prise en retour en haut',
    prompt: 'Capture les pierres marquées en deux coups au plus.',
    explanation: "Superbe ! En G9, ta pierre n'a qu'une liberté, G8. Mais les pierres marquées sont en atari aussi. Si Blanc prend en G8, ses trois pierres n'ont plus qu'une liberté, G9 : tu rejoues en G9 et tu les captures. Tu donnes une pierre pour en prendre trois : c'est une prise en retour."
  },
  {
    id: 'o08', size: 9, difficulty: 830, answers: ['E4'],
    setup: { rows: [E, E, E, E, '.....X...', '.....TX..', '....X....', '.......X.', E], toPlay: 'B',
      refutation: "Pas tout à fait. En F3, Blanc s'allonge en E4, vers le haut, loin de ta pierre H2 : il a deux libertés, D4 et E5, et tu ne le prends plus en quatre coups. Ailleurs, il s'allonge aussi en E4. Pousse-le plutôt vers H2." },
    title: 'Vers ta pierre H2',
    prompt: 'Capture la pierre marquée en quatre coups au plus.',
    explanation: "Bravo ! E4 met la pierre en atari et la pousse vers le bas. Si elle s'allonge en F3, tu joues F2 ; si elle s'allonge ensuite en G3, tu joues H3. Blanc n'a plus qu'une liberté, G2. S'il s'y allonge, ta pierre H2 lui ferme la route : il reste en atari, et tu le prends en G1. Remettre en atari à chaque coup une pierre qui fuit, c'est une échelle. Ta pierre H2 l'aide : on l'appelle une pierre relais."
  },
  {
    id: 'o09', size: 9, difficulty: 860, answers: ['D5'],
    setup: { rows: [E, E, '...XX....', '....TX...', E, '....X....', '...O.....', E, E], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc s'allonge en E5, ou en D6 si tu as joué E5 ou F5, et garde assez de libertés pour s'échapper. Ne touche pas la pierre : ferme ses deux sorties." },
    title: 'Le filet sous le mur',
    prompt: 'Capture la pierre marquée en trois coups au plus.',
    explanation: "Bravo ! D5 ferme les deux sorties de la pierre, D6 et E5 : c'est un filet. Si Blanc sort en D6, tu joues C6 : il est en atari, et s'il s'allonge en E5, tu le prends en F5. S'il sort en E5, tu joues F5, puis C6."
  },
  {
    id: 'o10', size: 9, difficulty: 880, answers: ['D1', 'F1'],
    setup: { rows: [E, E, E, E, E, 'OOOO.....', 'OOOXXXX..', 'XXXTTTX..', E], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue C1, ou F1 si tu as joué E1 ou C1, et gagne la course aux libertés. Au milieu, en E1, ta pierre est trop faible : F1 la met en atari et donne à Blanc une liberté de plus, G1. Commence par un bout, D1 ou F1." },
    title: 'Par un bout',
    prompt: 'Capture les pierres marquées en trois coups au plus.',
    explanation: "Superbe ! Chaque groupe a trois libertés : c'est une course aux libertés. Remplis celles de Blanc par un bout, D1 ou F1. Si tu joues D1 et que Blanc joue C1, ta pierre D1 est en atari, mais tu joues F1 : ses pierres le sont aussi. S'il prend D1 en jouant E1, ses quatre pierres n'ont plus qu'une liberté, D1, et tu les prends toutes. Au milieu, en E1, ta pierre serait trop faible."
  },
  {
    id: 'o11', size: 9, difficulty: 900, answers: ['D3'],
    setup: { rows: [E, E, E, E, E, '...X.....', '.XT......', '..X.O....', E], toPlay: 'B',
      refutation: "Pas tout à fait. En C4, Blanc s'allonge en D3, vers sa pierre E2 : l'échelle est cassée, il s'y relie et s'échappe. Ailleurs, il s'allonge aussi en D3. Pousse-le plutôt vers le bord de gauche, où rien ne l'attend." },
    title: 'Choisis le bon côté',
    prompt: 'Capture la pierre marquée en cinq coups au plus.',
    explanation: "Superbe ! D3 met la pierre en atari et la pousse vers le bord de gauche. Chaque fois qu'elle s'allonge, tu la remets en atari : C5, puis B5, puis A5. Elle zigzague jusqu'au bord, et tu la prends en A2. C'est une échelle. En C4, tu la poussais vers la pierre blanche E2 : Blanc s'y relie, l'échelle est cassée."
  },
  {
    id: 'o12', size: 9, difficulty: 940, answers: ['E3'],
    setup: { rows: [E, E, E, E, '....XX...', '.....TX..', '......X..', E, '....O....'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc s'allonge en F3, ou en E4 si tu as joué F3 ou F2, et garde assez de libertés pour s'échapper. Ne touche pas la pierre : ferme ses deux sorties." },
    title: 'Le filet au bon endroit',
    prompt: 'Capture la pierre marquée en trois coups au plus.',
    explanation: "Bravo ! E3 ne touche pas la pierre, mais ferme ses deux sorties, E4 et F3 : c'est un filet. Si Blanc sort en E4, tu joues D4 : il est en atari, et s'il s'allonge en F3, tu le prends en F2. S'il sort en F3, tu joues F2, puis D4."
  },
];

export default LOT_O;
