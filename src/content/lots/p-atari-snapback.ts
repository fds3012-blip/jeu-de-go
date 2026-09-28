// Lot P de l'issue #136 : difficulté 660 à 800. Atari contre un mur, double atari, prise en retour sur le bord.
// 9 × 9, Noir au trait. Aucun ko.
// Même contenu que la migration 20260928070100_lot_p ; chaque position est prouvée par src/go/lot-p.test.ts
// (lecteur exact src/go/lecteurs-lot-n.ts, tous les coups légaux et la passe, avec et sans ko).
// Capturer : la réponse prend une pierre marquée (T) dans le nombre de coups annoncé, contre toute défense, et aucun
// autre coup noir n'y arrive.
import type { PuzzleRow } from '../../data/puzzles';

const E = '.........';

const LOT_P: PuzzleRow[] = [
  {
    id: 'p01', size: 9, difficulty: 660, answers: ['E5', 'F4'],
    setup: { rows: [E, E, E, E, '..XX.X...', '..XTT.X..', '...XX....', E, E], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc s'allonge en E5, ou en F4 si tu as joué E6, et garde deux libertés. Mets-le en atari tout de suite, du côté de tes pierres." },
    title: 'Contre ton mur',
    prompt: 'Capture les pierres marquées en deux coups au plus.',
    explanation: "Bravo ! Les pierres marquées ont deux libertés, E5 et F4. Joue sur l'une d'elles : les pierres sont en atari (une seule liberté). Si Blanc s'allonge sur l'autre, il bute sur tes pierres F5 et G4 : il est encore en atari, et tu le prends."
  },
  {
    id: 'p02', size: 9, difficulty: 720, answers: ['E2'],
    setup: { rows: [E, E, E, E, E, E, '...X.X...', '..XT.TX..', E], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue E2 : il relie ses deux pierres, et le groupe a quatre libertés. Joue le point qui touche les deux pierres à la fois." },
    title: 'Deux atari d’un coup',
    prompt: 'Capture une pierre marquée en deux coups au plus.',
    explanation: "Bravo ! E2 se place entre les deux pierres et les met toutes les deux en atari : c'est un double atari. Blanc ne peut en sauver qu'une. S'il s'allonge en D1, tu prends F2 en F1. S'il s'allonge en F1, tu prends D2 en D1."
  },
  {
    id: 'p03', size: 9, difficulty: 800, answers: ['E1'],
    setup: { rows: [E, E, E, E, E, E, '..XXXX...', '.XOO.X...', '.XTT.OOO.'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue E1 : il relie ses quatre pierres à F1, G1 et H1, et le groupe respire. Joue plutôt en E1, même si Blanc peut prendre ta pierre." },
    title: 'Donne une pierre, prends-en cinq',
    prompt: 'Capture les pierres marquées en deux coups au plus.',
    explanation: "Superbe ! En E1, ta pierre n'a qu'une liberté, E2. Mais les quatre pierres blanches n'ont plus qu'une liberté elles aussi, E2 : elles sont en atari. Si Blanc prend en E2, ses cinq pierres n'ont qu'une liberté, E1. Tu rejoues en E1 et tu les captures toutes. C'est une prise en retour : tu donnes une pierre pour en prendre cinq."
  },
];

export default LOT_P;
