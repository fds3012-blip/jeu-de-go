// Lot W de l'issue #16 : 9 problèmes d'entraînement pour les leçons 14 à 16, trois par leçon.
// - Seki (l14), w01 à w03 : sauver ses pierres par un seki (vie commune).
// - Finir la partie (l15), w04 à w06 : fermer une frontière au contact, laisser la dame pour la fin, ne pas capturer
//   une pierre déjà morte.
// - Compter (l16), w07 à w09 : remplir la dame avant de compter, compter avec le komi et les prisonniers, compter un
//   seki (ses points ne sont à personne).
// 9 × 9, Noir au trait, tous ouverts à un débutant (difficulté 400 à 800). Aucun ko. Même contenu que la migration
// 20261002120100_lot_w ; chaque position est prouvée par src/go/lot-w.test.ts :
// - seki : outil src/go/preuve-vie-mort.ts, recherche complète dans une zone fermée ; la réponse donne un seki pur
//   (chaque point vide, rempli par Noir, fait vivre Blanc ; rempli par Blanc, le fait mourir), tout autre coup
//   (et la passe) laisse Blanc vivre ;
// - fin de partie et comptage : score() en règle japonaise (territoire + prisonniers, komi à Blanc, les points d'un
//   seki ne comptent pas) et recherche complète des coups de frontière ; la réponse est le seul meilleur coup.
import type { PuzzleRow } from '../../data/puzzles';

const E = '.........';
/** Coin du bas à gauche : mur noir, groupe blanc sans œil autour d'un espace 2 × 3 (problèmes w02 et w03). */
const COIN = [E, E, E, E, E, 'XXXXX....', 'OOOOX....'];

const LOT_W: PuzzleRow[] = [
  {
    id: 'w01', size: 9, difficulty: 500, answers: ['F9'],
    setup: { rows: ['.XO.S.S.O', '.XOOOOOOO', '.XXXXXXXX', E, E, E, E, E, E], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue F9 : tes pierres restent coupées en deux, et Blanc les capture.' },
    title: 'Relie au milieu',
    prompt: 'Sauve tes pierres marquées par un seki (vie commune).',
    explanation: "Bravo ! F9 relie tes trois pierres. Elles partagent deux libertés avec Blanc, D9 et H9 : qui en remplit une se met en atari et se fait prendre. Personne ne joue là : c'est seki, tout le monde vit."
  },
  {
    id: 'w02', size: 9, difficulty: 600, answers: ['B1'],
    setup: { rows: [...COIN, 'O.SOX....', 'S..OX....'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue B1 : il prend A1, et son groupe vit.' },
    title: 'Seki dans le coin',
    prompt: 'Sauve tes pierres marquées par un seki (vie commune).',
    explanation: "Bravo ! B1 sauve A1. Tes pierres et le groupe blanc partagent deux libertés, B2 et C1 : qui en remplit une se met en atari. Personne ne joue là : c'est seki."
  },
  {
    id: 'w03', size: 9, difficulty: 700, answers: ['B2'],
    setup: { rows: [...COIN, '..SOX....', 'S.OOX....'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue B2 : il prend C2, et son groupe vit.' },
    title: 'Deux libertés partagées',
    prompt: 'Sauve tes pierres marquées par un seki (vie commune).',
    explanation: "Bravo ! B2 sauve C2. Tes pierres et le groupe blanc partagent deux libertés, A2 et B1 : qui en remplit une se met en atari. Personne ne joue là : c'est seki."
  },
  {
    id: 'w04', size: 9, difficulty: 450, answers: ['E5'],
    setup: { rows: [E, E, E, 'OOOOOO...', 'XXXX.OOOO', '...X.XXXX', E, E, E], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue E5, au contact de tes pierres : ta frontière se ferme en E4, et tu perds au moins un point.' },
    title: 'Ferme au contact',
    prompt: 'Avant de passer : ta frontière est encore ouverte. Ferme-la sans perdre de point.',
    explanation: 'Bravo ! E5 ferme ta frontière au contact de Blanc : E4 reste dans ton territoire. En E4, tu fermais aussi, mais E5 devenait un point neutre (dame) : un point de moins.'
  },
  {
    id: 'w05', size: 9, difficulty: 550, answers: ['E3'],
    setup: { rows: ['...XO....', '...XO....', '...X.O...', '...XXO...', '...XO....', '...XO....', '.....O...', '...XXO...', '....XO...'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue E3, au contact de tes pierres : ta frontière se ferme en D3, et tu perds au moins un point. La dame E7, elle, ne vaut rien.' },
    title: 'Dame ou frontière ?',
    prompt: 'Il reste une dame (point neutre) et une frontière ouverte. Joue le coup qui compte.',
    explanation: 'Bravo ! E3 ferme ta frontière au contact de Blanc : D3 reste à toi. La dame E7 ne rapporte rien à personne : on la remplit à la fin.'
  },
  {
    id: 'w06', size: 9, difficulty: 650, answers: ['F4'],
    setup: { rows: ['TX.......', '.X.......', 'X........', E, 'XXXXX.XXX', 'OOOOX.OOO', '....OO...', E, E], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue F4, au contact de tes pierres : ta frontière se ferme en F5, et tu perds au moins un point. A9 est déjà morte : inutile de la prendre.' },
    title: 'Elle est déjà morte',
    prompt: 'La pierre blanche marquée est morte. Une frontière est encore ouverte : joue le coup qui rapporte le plus.',
    explanation: 'Bravo ! F4 ferme ta frontière au contact de Blanc : F5 reste à toi. A9 ne peut plus vivre : à la fin, on la retire et elle devient prisonnière, sans dépenser de coup.'
  },
  {
    id: 'w07', size: 9, difficulty: 400, answers: ['E5'],
    setup: { rows: ['.....XO..', '.....XO..', '....XO...', '....XO...', '...X.O...', '...XO....', '...XO....', '..XO.....', '..XO.....'], toPlay: 'B',
      refutation: "Pas tout à fait. Ce point n'est entouré que par une couleur : c'est du territoire. La dame touche des pierres noires et blanches." },
    title: 'Le point neutre',
    prompt: 'La partie est finie. Avant de compter, remplis le seul point neutre (dame).',
    explanation: "Bravo ! E5 touche Noir et Blanc : il n'est à personne. On le remplit, et le compte ne change pas : 31 points de territoire chacun, plus le komi pour Blanc."
  },
  {
    id: 'w08', size: 9, difficulty: 700, answers: ['E6'],
    setup: { rows: ['...OX..XT', '...OX..X.', '...OX...X', '...O.....', '...OX....', '...OX....', '...OX....', '...OX....', '...OX....'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue E6 : ta frontière se ferme en F6, et tu as 33 points au plus. Blanc a 27 + 6,5 = 33,5 : il gagne.' },
    title: 'Le demi-point',
    prompt: 'Komi : 6,5 points pour Blanc. Compte bien : un seul coup te fait gagner.',
    explanation: "Bravo ! Après E6, tu as 33 points de territoire (J9 comprise, une fois retirée) + 1 prisonnier = 34. Blanc a 27 + 6,5 = 33,5. Tu gagnes d'un demi-point. En F6, tu n'en avais que 33 : Blanc gagnait."
  },
  {
    id: 'w09', size: 9, difficulty: 800, answers: ['G7'],
    setup: { rows: ['....XOOO.', '.....XXO.', '.......O.', '.....XO..', '.....XO..', 'XXXXXXO..', 'OOOOXO...', 'O.XOXO...', 'XX.OXO...'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue G7 : ta frontière se ferme en F7, et Blanc gagne. Ne remplis jamais B2 ou C1 : dans le seki, tu te mettrais en atari.' },
    title: 'Le seki ne compte pas',
    prompt: 'Komi : 6,5 points pour Blanc. Compte, seki compris : un seul coup te fait gagner.',
    explanation: "Bravo ! G7 ferme au contact : tu as 25 points. B2 et C1, dans le seki, ne sont à personne. Blanc a 18 + 6,5 = 24,5. Tu gagnes d'un demi-point. En F7, tu n'en avais que 24."
  },
];

export default LOT_W;
