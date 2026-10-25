// Lot AC de l’issue #733 (chantier C4) : cinq problèmes de comptage pour le joueur de club, de 850 à 1050. Le thème
// « Compter » n’avait que w07, w08 et w09. Ici, on compte une partie finie au demi-point près (komi 6,5, règle japonaise :
// territoire + prisonniers, pierres mortes retirées) : Noir est devant d’un demi-point, et un seul coup l’empêche de le
// perdre.
// - ac01 (850) : le point de la frontière que Blanc prendrait, et sa voisine qui devient une dame ;
// - ac02 (900) : une pierre blanche morte dans le territoire de Noir, un prisonnier pour lui ;
// - ac03 (950) : une pierre noire morte dans le territoire de Blanc, un prisonnier pour lui ;
// - ac04 (1000) : trois points ouverts de plus, dont deux dames qui ne changent aucun compte ;
// - ac05 (1050) : une pierre morte de chaque couleur.
// 9 × 9, Noir au trait, positions construites pour l’exercice (aucune position copiée). Aucun ko. Même contenu que la
// migration 20261025140000_lot_ac ; chaque position est prouvée par src/go/lot-ac.test.ts :
// - chaque territoire est une salle fermée où une pierre jetée meurt (src/go/preuve-vie-mort.ts), chaque camp a au moins
//   deux salles et une seule chaîne vivante ; aucune chaîne en atari ;
// - la réponse est le seul coup qui fait gagner Noir : minimax exact en règle japonaise (src/go/refutation-fin.ts), dans
//   les trois modèles de ko ; tout autre coup légal, et la passe, laisse Blanc gagner ;
// - aucun ko dans l’arbre de la fin, aucune prise ni atari après la bonne réponse ;
// - les chiffres des textes viennent de score() ; chaque erreur est réfutée par la réplique citée.
import type { PuzzleRow } from '../../data/puzzles';

const LOT_AC: PuzzleRow[] = [
  {
    id: 'ac01', size: 9, difficulty: 850, answers: ['E8'],
    setup: { rows: ['...XXOO..', '...X..O..', '..XXOOOOO', 'XXXOO....', '..XOOOOOO', '..XXOO...', 'XXXXXOO..', '....XXOOO', '.....XXO.'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue E8 : F8 devient son territoire, et il gagne.' },
    title: 'Le demi-point à défendre',
    prompt: 'Komi : 6,5 points pour Blanc. Compte les deux camps : tu es devant d’un demi-point, mais Blanc peut te le reprendre en un coup. Joue ce coup avant lui.',
    explanation: 'Bravo ! Tu as 21 points de territoire, Blanc 14 + 6,5 = 20,5 : tu gagnes d’un demi-point. Si Blanc jouait E8, F8 deviendrait son territoire : 15 + 6,5 = 21,5, et il gagnerait. En E8, F8 n’est plus à personne : c’est une dame (point neutre).'
  },
  {
    id: 'ac02', size: 9, difficulty: 900, answers: ['E1'],
    setup: { rows: ['...OX....', 'OOOOXX...', '...OOX...', '..OOXXXXX', '..OXXT...', '..OOXXXXX', '...OXX...', 'OOOOOX...', '..O..X...'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue E1 : D1 devient son territoire, et il gagne. La pierre morte n’a pas besoin d’être prise : elle est retirée au compte.' },
    title: 'Un prisonnier de plus',
    prompt: 'Komi : 6,5 points pour Blanc. La pierre blanche marquée est morte : c’est un prisonnier pour toi (il te rapporte 1 point). Tu es devant d’un demi-point : empêche Blanc de te le reprendre.',
    explanation: 'Bravo ! Tu as 23 points de territoire (avec le point de la pierre morte, une fois retirée) + 1 prisonnier = 24. Blanc a 17 + 6,5 = 23,5 : tu gagnes d’un demi-point. Si Blanc jouait E1, D1 deviendrait son territoire, et il gagnerait. En E1, D1 n’est plus à personne : c’est une dame (point neutre).'
  },
  {
    id: 'ac03', size: 9, difficulty: 950, answers: ['F5'],
    setup: { rows: ['...XX....', '...XX....', '...XX....', '..XXXXXXX', 'XXX.O.OOX', 'OO.OO.OOO', '.OOOOOO..', '.O..O.O..', 'SO..O.O..'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue F5 : F4 devient son territoire, et il gagne. C4 et D5 sont des dames (points neutres) : les remplir ne change rien.' },
    title: 'La pierre morte de Noir',
    prompt: 'Komi : 6,5 points pour Blanc. Ta pierre marquée est morte : c’est un prisonnier pour Blanc. Tu es devant d’un demi-point : empêche Blanc de te le reprendre.',
    explanation: 'Bravo ! Tu as 23 points de territoire. Blanc a 15 points de territoire (le point A1 compris, une fois ta pierre retirée) + 1 prisonnier + 6,5 = 22,5 : tu gagnes d’un demi-point. Si Blanc jouait F5, F4 deviendrait son territoire, et il gagnerait. C4 et D5 sont des dames (points neutres) : les remplir ne change rien.'
  },
  {
    id: 'ac04', size: 9, difficulty: 1000, answers: ['E1'],
    setup: { rows: ['....XO...', 'XXXXXOO..', '....XXO..', '....X.OOO', '...XXOO..', 'XXXX.O...', '...XOO...', '...XOOOOO', '...X..O..'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue E1 : F1 devient son territoire, et il gagne. Remplir une dame (point neutre) ne change rien au compte.' },
    title: 'Quel point compte vraiment ?',
    prompt: 'Komi : 6,5 points pour Blanc. Plusieurs points sont encore ouverts, mais un seul change le compte. Tu es devant d’un demi-point : garde-le.',
    explanation: 'Bravo ! E4 et F6 sont des dames (points neutres) : les remplir ne change aucun compte. Le point qui compte est E1. Si Blanc jouait E1, F1 deviendrait son territoire, et il gagnerait. Avec E1, tu as 24 points, Blanc 17 + 6,5 = 23,5 : tu gagnes d’un demi-point.'
  },
  {
    id: 'ac05', size: 9, difficulty: 1050, answers: ['F5'],
    setup: { rows: ['....XXOS.', 'XXXXX.OOO', '....XOOO.', '....XX.O.', 'XXXXX.OOO', '..XXO.O..', 'T.XOOOOOO', '..XXO....', '...XO....'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue F5 : F4 devient son territoire, et il gagne. Les pierres mortes n’ont pas besoin d’être prises : elles sont retirées au compte.' },
    title: 'Deux pierres mortes',
    prompt: 'Komi : 6,5 points pour Blanc. Les deux pierres marquées sont mortes, une de chaque couleur. Tu es devant d’un demi-point : garde-le.',
    explanation: 'Bravo ! Tu as 21 points de territoire (le point A3 compris, une fois la pierre blanche retirée) + 1 prisonnier = 22. Blanc a 14 points de territoire (le point H9 compris, une fois ta pierre retirée) + 1 prisonnier + 6,5 = 21,5 : tu gagnes d’un demi-point. Si Blanc jouait F5, F4 deviendrait son territoire, et il gagnerait. F8 et G6 sont des dames (points neutres).'
  }
];

export default LOT_AC;
