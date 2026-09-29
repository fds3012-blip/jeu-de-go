// Lot U de l'issue #136 : relier deux groupes et couper (800 à 1050), puis vie et mort de haut de courbe (1150 à 1500).
// 9 × 9, Noir au trait. Aucun ko, aucun seki. Même contenu que la migration 20260929234100_lot_u ; chaque position est
// prouvée par src/go/lot-u.test.ts :
// - relier, couper, vivre, tuer (outil src/go/preuve-vie-mort.ts, recherche complète dans une zone fermée, un ko compte
//   comme non résolu). Relier : ta pierre marquée qui ne vit pas seule finit avec deux vrais yeux (reliée au groupe
//   vivant) contre toute défense. Couper : la pierre blanche marquée qui ne vit pas seule finit capturée. Vivre et
//   tuer : comme les lots Q, R et T. Après tout autre coup, Blanc obtient l'issue inverse ;
// - capture (lecteur exact src/go/lecteurs-lot-n.ts, avec et sans ko) : la réponse prend la pierre marquée dans le
//   nombre de coups annoncé, contre toute défense, et aucun autre coup noir n'y arrive.
import type { PuzzleRow } from '../../data/puzzles';

const E = '.........';

const LOT_U: PuzzleRow[] = [
  {
    id: 'u01', size: 9, difficulty: 800, answers: ['E1'],
    setup: { rows: [E, E, E, E, E, 'XXXXXXXX.', 'OOOOX..X.', '.T.OXOTX.', 'OOOO.O.X.'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue E1 : il relie F1 à D1. Toutes ses pierres profitent alors des deux yeux A2 et C2, et rien n'est capturé." },
    title: 'Ferme le passage',
    prompt: 'Coupe les deux groupes blancs. Celui de gauche est vivant : ne laisse pas G2 le rejoindre.',
    explanation: "Bravo ! E1 ferme le passage du premier rang. Les pierres F1, F2 et G2 ne peuvent plus rejoindre le groupe vivant. Seules, elles n'ont pas la place pour deux yeux : elles finissent capturées. Couper, c'est jouer entre deux groupes pour les séparer."
  },
  {
    id: 'u02', size: 9, difficulty: 850, answers: ['F2'],
    setup: { rows: [E, E, E, E, E, 'OOOOOOOO.', 'XXXXXOOO.', '.S.X..SO.', 'XXXX...O.'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue F2 : G2 est en atari, avec une seule liberté, G1. Elle ne peut plus se relier, et Blanc la capture." },
    title: 'Rejoins la pierre seule',
    prompt: 'Relie tes deux groupes. Ta pierre G2, seule, ne peut pas vivre.',
    explanation: "Bravo ! F2 rejoint G2 et lui donne deux façons de se relier : E2 et E1. Si Blanc joue E2, sa pierre est en atari (une seule liberté) : tu la prends en E1. S'il joue E1 ou F1, tu relies en E2. Tes deux groupes n'en font plus qu'un, vivant."
  },
  {
    id: 'u03', size: 9, difficulty: 900, answers: ['C4'],
    setup: { rows: [E, E, E, E, '..O.O....', E, '..TX.....', 'XXX......', E], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue C4 : sa pierre se relie à C5 et s'échappe vers le haut. Mets-la en atari de ce côté-là." },
    title: 'Coupe-la de ses amies',
    prompt: 'Capture la pierre marquée en trois coups au plus.',
    explanation: "Bien vu ! C4 met C3 en atari du côté de ses amies C5 et E5 : tu la coupes d'elles. Si Blanc s'allonge en B3, B4 le remet en atari, et tu le prends au troisième coup contre le bord. Mets en atari du côté où l'adversaire veut se relier."
  },
  {
    id: 'u04', size: 9, difficulty: 920, answers: ['E8'],
    setup: { rows: ['OOOO..XX.', '.T.O.OTX.', 'OOOOX..X.', 'XXXXXXXX.', E, E, E, E, E], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue E8 : il relie F8 et G8 au groupe vivant, qui a déjà deux yeux, A8 et C8." },
    title: 'Coupe près du bord',
    prompt: 'Coupe les deux groupes blancs. Celui de gauche est vivant : isole F8 et G8.',
    explanation: "Bravo ! E8 coupe F8 et G8 du groupe vivant. Blanc peut encore essayer de passer par le bord. S'il joue E9, tu bloques en F9 ; s'il joue F9, tu bloques en E9. Seules, ses deux pierres n'ont pas la place pour deux yeux, et elles finissent capturées."
  },
  {
    id: 'u05', size: 9, difficulty: 950, answers: ['F2'],
    setup: { rows: [E, E, E, E, E, 'XXXXXXXX.', 'OOOO.X.X.', '.T.OO.TX.', 'OOOOO..X.'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue F2 : il relie G2 à E2, et toutes ses pierres profitent des yeux A2 et C2." },
    title: 'Le blocage',
    prompt: 'Coupe la pierre G2 du groupe blanc vivant.',
    explanation: "Exact ! F2 coupe G2 de la pierre E2. Si Blanc tente le premier rang en F1, tu réponds G1 ; s'il joue G1, tu réponds F1. G2 reste seule, sans place pour deux yeux, et elle finit capturée."
  },
  {
    id: 'u06', size: 9, difficulty: 1000, answers: ['E1'],
    setup: { rows: [E, E, E, E, E, '.OOOOOOOO', '.OX.OXXXX', '.OS.OX.S.', '.OX..XXXX'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue E1 : il ferme le premier rang. Tes pierres C3, C2 et C1 restent seules, sans place pour deux yeux, et elles finissent capturées." },
    title: 'Descends sur le premier rang',
    prompt: 'Relie tes deux groupes. À gauche, C3, C2 et C1 ne peuvent pas vivre seules.',
    explanation: "Bravo ! E1 descend sur le premier rang, à côté de F1 : ton groupe de droite touche maintenant D1. Si Blanc joue D1, sa pierre est en atari et tu la prends en D2. Sinon, tu relies en D1. Passer sous les pierres adverses, par le premier rang, marche souvent."
  },
  {
    id: 'u07', size: 9, difficulty: 1050, answers: ['G2'],
    setup: { rows: [E, E, E, E, E, 'OOOOOOOO.', 'XXXXO.SO.', '.S.X...O.', 'XXXX..XO.'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue G2 : il sépare G3 et G1. G3 n'a plus qu'une liberté, F3, et tes pierres ne peuvent plus toutes se relier." },
    title: 'Deux chemins',
    prompt: 'Relie G3 et G1 à ton groupe vivant, à gauche.',
    explanation: "Superbe ! G2 relie G3 et G1. Tes trois pierres ont alors deux chemins vers la gauche : F2 et F1. Si Blanc bloque en F2, tu passes en F1 ; s'il bloque en F1, tu passes en F2. Un seul coup marche chaque fois."
  },
  {
    id: 'u08', size: 9, difficulty: 1150, answers: ['D2'],
    setup: { rows: [E, E, E, E, E, 'XXXXXX...', 'XOOXXXX..', 'OO..O.X..', 'T.OO..X..'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue D2 : il relie ses pierres, et C2 et B1 deviennent deux yeux. Son groupe est vivant." },
    title: 'Le point qui relie tout',
    prompt: 'Noir joue et tue. Les pierres blanches ne sont pas encore reliées.',
    explanation: "Bravo ! D2 est le point vital. Si Blanc y jouait, C2 et B1 deviendraient deux yeux. Ta pierre D2 touche C2 : ce point ne sera jamais un œil. Blanc n'a plus la place pour deux yeux, et son groupe finit capturé."
  },
  {
    id: 'u09', size: 9, difficulty: 1200, answers: ['H2'],
    setup: { rows: [E, E, E, E, E, '...XXXXXX', '..XXOO.X.', '..X.O.O.O', '..X.OO.OT'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue H2 : il relie G2 au coin, et F2 et G1 deviennent deux yeux. Son groupe est vivant." },
    title: 'Coupe dans le coin',
    prompt: 'Noir joue et tue. Regarde les pierres G2 et J2 : elles ne sont pas reliées.',
    explanation: "Superbe ! H2 sépare G2 du coin H1-J1-J2. Si Blanc y jouait, F2 et G1 deviendraient deux yeux. Maintenant, J3 menace de mettre le coin en atari : pour le sauver, Blanc devra remplir G1, son propre œil. Il n'a plus la place pour deux yeux, et son groupe finit capturé."
  },
  {
    id: 'u10', size: 9, difficulty: 1220, answers: ['H8'],
    setup: { rows: ['..X..OO.T', '..XO.OO..', '..XXXO.OO', '...XXXXXX', E, E, E, E, E], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue H8 : il relie ses pierres du coin, et J8 et H9 deviennent deux yeux. Son groupe est vivant." },
    title: 'Entre les pierres du coin',
    prompt: 'Noir joue et tue. J8 et H9 pourraient devenir deux yeux.',
    explanation: "Bravo ! H8 se place entre les pierres blanches. J8 et H9 touchent ta pierre : aucun des deux ne peut devenir un œil. Blanc n'a plus la place pour deux yeux, et son groupe finit capturé."
  },
  {
    id: 'u11', size: 9, difficulty: 1250, answers: ['J6'],
    setup: { rows: ['.....X.OT', '.....X.OO', '.....XOO.', '.....XO..', '.....X.OO', '.....XXO.', '......XXX', E, E], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue J6 : il relie ses pierres, et J7 et H6 deviennent deux yeux. Son groupe est vivant." },
    title: 'Un point pour deux yeux',
    prompt: 'Noir joue et tue. Blanc peut faire des yeux en J7 et en H6. Un seul point touche les deux.',
    explanation: "Bravo ! J6 touche J7 et H6 : aucun des deux ne peut plus devenir un œil. Ta pierre coupe aussi H5, J5 et H4 du reste. Blanc n'a plus la place pour deux yeux, et son groupe finit capturé."
  },
  {
    id: 'u12', size: 9, difficulty: 1300, answers: ['B2'],
    setup: { rows: [E, E, E, E, E, 'OOOOOO...', '.XX.XOO..', '....X.O..', 'S.XXX.O..'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue B2 : sa pierre s'installe au milieu de ton coin. Tu ne peux plus faire deux yeux, et ton groupe finit capturé." },
    title: 'Au cœur du coin',
    prompt: 'Noir joue et vit. Ton espace est grand, mais il a un point faible.',
    explanation: "Superbe ! B2 est le point vital : il prend le centre de ton coin, là où Blanc voulait jouer. Si Blanc joue A2, tu réponds A3 ; s'il joue A3, tu réponds A2. Un seul coup marche chaque fois, et ton groupe fait deux yeux."
  },
  {
    id: 'u13', size: 9, difficulty: 1350, answers: ['C2'],
    setup: { rows: [E, E, E, E, E, 'OOOOOO...', '..OXXOO..', 'XX..X.O..', 'S..X..O..'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue C2 : sa pierre C3 s'allonge et coupe ton espace en deux. Tu ne peux plus faire deux yeux, et ton groupe finit capturé." },
    title: 'Ferme la porte',
    prompt: 'Noir joue et vit. La pierre blanche C3 veut entrer dans ton espace.',
    explanation: "Bravo ! C2 bloque la pierre C3 et fait de D2 un œil. Il te faut le deuxième, à droite : si Blanc entre en F2, tu réponds E1 ; s'il joue E1, tu réponds F1. Un seul coup marche chaque fois, et ton groupe vit."
  },
  {
    id: 'u14', size: 9, difficulty: 1450, answers: ['E8'],
    setup: { rows: ['TO.OOXX..', '.OO...X..', '.OOO.XX..', 'XXXXXX...', E, E, E, E, E], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue E8 : il garde assez de place pour deux yeux, et son groupe est vivant." },
    title: 'Un seul coup à chaque fois',
    prompt: 'Noir joue et tue. Les pierres D9 et E9 ne sont pas encore reliées au groupe.',
    explanation: "Superbe ! E8 réduit l'espace et menace D9-E9. Si Blanc les relie en D8, A7 empêche l'œil A8 : il ne reste que C9. S'il joue A7, D8 met D9-E9 en atari, et pour les sauver Blanc doit remplir C9, son propre œil. Un seul coup marche chaque fois."
  },
  {
    id: 'u15', size: 9, difficulty: 1500, answers: ['D2'],
    setup: { rows: [E, E, E, E, E, 'OOOOOO...', 'XXX..OO..', '.....XO..', 'SX..XXO..'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue D2 (ou D1 si tu as joué C2, ou C2 si tu as joué D1) : ton espace est coupé en morceaux trop petits. Tu ne peux plus faire deux yeux, et ton groupe finit capturé." },
    title: "Le centre de l'espace",
    prompt: 'Noir joue et vit. Ton espace est grand, mais tes pierres sont en trois morceaux.',
    explanation: "Superbe ! D2 prend le centre de ton espace : Blanc ne peut plus le couper en morceaux. Si Blanc entre en E2, tu réponds D1, et c'est le seul coup. S'il joue D1, tu réponds E2 ou C1. Il faut lire chaque réponse, et ton groupe fait deux yeux."
  },
];

export default LOT_U;
