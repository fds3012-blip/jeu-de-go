// Lot S de l'issue #136 : tesuji de capture, difficulté 900 à 1250. Fermer le côté ouvert contre le bord, filet,
// couper avant l'atari, échelle cassée par une pierre blanche, pierre relais contre le bord, filet à distance.
// 9 × 9, Noir au trait. Aucun ko.
// Même contenu que la migration 20260929000100_lot_s ; chaque position est prouvée par src/go/lot-s.test.ts
// (lecteur exact src/go/lecteurs-lot-n.ts, tous les coups légaux et la passe, avec et sans ko).
// Capturer : la réponse prend une pierre marquée (T) dans le nombre de coups annoncé, contre toute défense, et aucun
// autre coup noir n'y arrive.
import type { PuzzleRow } from '../../data/puzzles';

const E = '.........';

const LOT_S: PuzzleRow[] = [
  {
    id: 's01', size: 9, difficulty: 900, answers: ['E2'],
    setup: { rows: [E, E, E, E, E, '..XXXX...', '.XOTTX...', '.X.......', E], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue E2, du côté ouvert, et garde trop de libertés pour être pris en trois coups. Ta pierre B2 ferme déjà la gauche : ferme la droite." },
    title: 'Contre le bord',
    prompt: 'Capture les pierres marquées en trois coups au plus.',
    explanation: "Bravo ! Les trois pierres blanches ont trois libertés : C2, D2 et E2. À gauche, ta pierre B2 ferme déjà la route. E2 ferme la droite. S'il s'allonge en D2, tu joues D1 ; s'il joue C2, tu joues C1. Il bute sur le bord et sur tes pierres : il reste en atari (une seule liberté), et tu le prends."
  },
  {
    id: 's02', size: 9, difficulty: 950, answers: ['F6'],
    setup: { rows: [E, E, E, '...X...X.', '...XT.X..', '....X....', E, '.....O...', E], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc s'allonge en F5, ou en E6 si tu as joué F5 ou F4, et garde assez de libertés pour s'échapper. Ne touche pas la pierre : ferme ses deux sorties." },
    title: 'Le filet entre tes pierres',
    prompt: 'Capture la pierre marquée en trois coups au plus.',
    explanation: "Bravo ! F6 ne touche pas la pierre, mais ferme ses deux sorties, E6 et F5 : c'est un filet (geta en japonais). Si Blanc sort en E6, tu joues E7 : il est en atari, et s'il s'allonge en F5, tu le prends en F4. S'il sort en F5, tu joues F4, puis E7."
  },
  {
    id: 's03', size: 9, difficulty: 1000, answers: ['D3'],
    setup: { rows: [E, E, E, '...O.....', E, '...OXX...', '....T....', '....X....', E], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue D3 : il relie E3 à sa pierre D4 et s'échappe. Joue d'abord en D3 : tu coupes et tu mets en atari d'un seul coup." },
    title: 'Coupe d’abord',
    prompt: 'Capture la pierre marquée en cinq coups au plus.',
    explanation: "Superbe ! D3 coupe E3 de sa pierre D4 et le met en atari d'un seul coup. Il s'allonge en F3 : tu joues G3. Il descend en F2 : tu joues G2. Il s'allonge en F1 : il a deux libertés, E1 et G1, contre le bord. Tu joues E1, il s'allonge en G1, et tu le prends en H1. Remettre en atari une pierre qui fuit, c'est une échelle."
  },
  {
    id: 's04', size: 9, difficulty: 1050, answers: ['F3'],
    setup: { rows: [E, E, E, E, E, '...XX....', '....T....', '....X.O..', E], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc s'allonge en F3, du côté de sa pierre G2, et s'échappe : l'échelle ne marche pas de ce côté. Pousse-le plutôt vers la gauche, où rien ne l'attend." },
    title: 'La pierre qui casse l’échelle',
    prompt: 'Capture la pierre marquée en cinq coups au plus.',
    explanation: "Superbe ! F3 met la pierre en atari et la pousse vers la gauche, loin de la pierre blanche G2. Il s'allonge en D3 : tu joues C3. Il descend en D2 : tu joues C2. Il s'allonge en D1 : tu joues E1, puis il s'allonge en C1 et tu le prends en B1. C'est une échelle. Si tu joues D3, Blanc s'allonge en F3, vers G2 : il a trois libertés et s'échappe."
  },
  {
    id: 's05', size: 9, difficulty: 1150, answers: ['D3'],
    setup: { rows: [E, E, E, E, E, '....XX...', '....T....', '.....X...', E], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc s'allonge en D3, vers le centre, et s'échappe. Ferme d'abord cette sortie, sans mettre en atari : ta pierre F2 garde l'autre côté." },
    title: 'Ta pierre relais',
    prompt: 'Capture la pierre marquée en cinq coups au plus.',
    explanation: "Superbe ! D3 ferme la sortie vers le centre, sans mettre en atari. Si Blanc s'allonge en F3, tu joues G3 : ta pierre F2 le bloque, il est en atari. S'il descend en E2, tu joues D2. Chaque fois, il bute sur le bord et sur ta pierre F2, qui sert de relais : il ne sort plus, et tu le prends."
  },
  {
    id: 's06', size: 9, difficulty: 1250, answers: ['G5'],
    setup: { rows: [E, E, '....X....', '.......X.', '...XT....', '....X....', E, '....O....', E], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc s'allonge en F5, ou en E6 si tu as joué F5 ou F4, et trouve une sortie. Ferme la route de droite de loin, sans coller à la pierre." },
    title: 'Le filet à distance',
    prompt: 'Capture la pierre marquée en cinq coups au plus.',
    explanation: "Superbe ! G5 ne touche pas la pierre : il ferme la route de droite de loin. C'est un filet à distance. Si Blanc sort en E6, tu joues D6 ; s'il continue en F6, tu joues F7, puis G7 s'il s'allonge en G6. S'il sort en F5, tu joues F4. Tes pierres E7 et H6 ferment le haut : il reste enfermé, et tu le prends."
  },
];

export default LOT_S;
