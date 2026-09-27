// Copie locale de secours des 6 problèmes de base (table `puzzles`, owner_id null).
// Contenu identique à la base de production, relu le 27/09/2026 (SELECT en lecture seule) et à la
// migration 20260926235308_progression_problemes_lecons_badges. Utilisée hors connexion, sans compte
// (la règle RLS ne donne les problèmes qu'aux joueurs connectés) ou si la base ne répond pas.
import type { PuzzleRow } from '../data/puzzles';

export const BASE_PUZZLES: PuzzleRow[] = [
  {
    id: 'b1', size: 9, difficulty: 400, answers: ['E5'], explanation: null,
    setup: { rows: ['.........', '.........', '.........', '...X.....', '..XT.O...', '...X.....', '.........', '.........', '.........'], toPlay: 'B' },
    title: 'Capture la pierre',
    prompt: "La pierre blanche marquée n'a plus qu'une liberté. Capture-la."
  },
  {
    id: 'b2', size: 9, difficulty: 650, answers: ['E3'], explanation: null,
    setup: { rows: ['.........', '.........', '.........', '.........', '.........', '.........', '.........', '...XTX...', '.........'], toPlay: 'B' },
    title: 'Vers le bord',
    prompt: "Mets la pierre marquée en atari du bon côté pour qu'elle ne puisse plus s'échapper."
  },
  {
    id: 'b3', size: 9, difficulty: 500, answers: ['E5'], explanation: null,
    setup: { rows: ['.........', '.........', '.........', '.........', '..XT.TX..', '...X.X...', '.........', '.........', '.........'], toPlay: 'B' },
    title: 'Double atari',
    prompt: 'Un seul coup peut mettre les deux pierres marquées en atari en même temps.'
  },
  {
    id: 'b4', size: 9, difficulty: 400, answers: ['D4'], explanation: null,
    setup: { rows: ['.........', '.........', '.........', '...O.....', '..OSO....', '..O.X....', '.........', '.........', '.........'], toPlay: 'B' },
    title: 'Sauve ta pierre',
    prompt: 'Ta pierre marquée est en atari. Donne-lui des libertés.'
  },
  {
    id: 'b5', size: 9, difficulty: 750, answers: ['F6'], explanation: null,
    setup: { rows: ['.........', '.........', '....O....', '...O.....', '...OSOX..', '....OX...', '.........', '.........', '.........'], toPlay: 'B' },
    title: 'Capturer pour se sauver',
    prompt: "Ta pierre marquée est en atari, et s'allonger ne suffit pas."
  },
  {
    id: 'b6', size: 9, difficulty: 850, answers: ['F5', 'E4'], explanation: null,
    setup: { rows: ['.........', '.........', '.........', '....X....', '...XT....', '.....X...', '.........', '.........', '.........'], toPlay: 'B' },
    title: "L'échelle",
    prompt: "Mets la pierre marquée en atari pour qu'elle ne s'échappe jamais."
  }
];

// Douze problèmes 9 × 9 de l'issue #16 : capture (c), sauvetage (s), vie et mort (v).
// Même contenu que la migration 20260927160000_problemes_capture_sauvetage_vie_mort ; chaque position est
// prouvée par src/go/problemes16.test.ts. `setup.refutation` est le texte affiché après une erreur.
export const PUZZLES_16: PuzzleRow[] = [
  {
    id: 'c1', size: 9, difficulty: 450, answers: ['E5'],
    setup: { rows: ['.........', '....O....', '.........', '...XTX...', '.........', '...XTX...', '.........', '....O....', '.........'], toPlay: 'B',
      refutation: "Pas tout à fait. Si tu mets une seule pierre en atari, Blanc joue E5 : il relie ses deux pierres et s'échappe. Cherche le point qui touche les deux." },
    title: 'Double atari',
    prompt: 'Noir joue et capture. Un seul coup menace les deux pierres marquées à la fois.',
    explanation: "Bravo ! En E5, tu mets les deux pierres en atari : il ne leur reste qu'une liberté, un seul point vide à côté d'elles. C'est un double atari. Blanc ne peut en sauver qu'une, et tu prends l'autre au coup suivant."
  },
  {
    id: 'c2', size: 9, difficulty: 850, answers: ['E4'],
    setup: { rows: ['.........', '.........', '.........', '....X....', '...XT....', '.....X...', '.........', '..O......', '.........'], toPlay: 'B',
      refutation: "Pas celle-là. Après F5, Blanc s'allonge en E4 et fuit vers le bas à gauche : la pierre blanche en C2 casse l'échelle, Blanc s'y relie et s'échappe. Pousse-le de l'autre côté." },
    title: "L'échelle cassée",
    prompt: 'Noir joue et capture. Attention à la pierre blanche en C2 : une seule des deux mises en atari marche.',
    explanation: "Exact ! Blanc s'allonge en F5, et tu le remets en atari (une seule liberté) à chaque coup, en zigzag vers le haut à droite : c'est une échelle. Aucune pierre blanche ne l'attend sur ce chemin, il finit capturé contre le bord."
  },
  {
    id: 'c3', size: 9, difficulty: 800, answers: ['F4', 'G4', 'F3'],
    setup: { rows: ['.........', '.........', '.........', '....XX...', '...XT....', '...X.....', '.........', '......O..', '.........'], toPlay: 'B',
      refutation: "Pas tout à fait. Si tu mets en atari tout de suite, Blanc s'allonge et l'échelle qui suit bute sur la pierre blanche G2 : Blanc s'y relie et s'échappe. Joue un pas plus loin, en diagonale, pour l'enfermer." },
    title: 'Le filet',
    prompt: 'Noir joue et capture. Mettre en atari tout de suite ne suffit pas.',
    explanation: "Bien vu ! Ton coup ne touche pas la pierre, mais lui ferme la route : c'est un filet (geta en japonais). Le filet le plus serré est F4 ; G4 et F3, un peu plus larges, marchent aussi. Après F4, si Blanc sort en F5, tu joues G5 ; s'il sort en E4, tu joues E3. Chaque fois, il est en atari (une seule liberté) et tu le captures."
  },
  {
    id: 'c4', size: 9, difficulty: 750, answers: ['C1'],
    setup: { rows: ['.........', '.........', '.........', '.........', '.........', '.........', 'XXXX.....', 'OOTXOO...', 'O..OO....'], toPlay: 'B',
      refutation: "Pas tout à fait. Après B1, Blanc prend ta pierre en C1 et se relie à ses pierres D1 et E1 : il s'échappe. Sacrifie plutôt ta pierre au point qui touche aussi ces pierres-là." },
    title: 'Le retour de capture',
    prompt: 'Noir joue et capture. Le groupe marqué n’a que deux libertés, et Blanc menace de se relier en C1.',
    explanation: "Superbe ! Ta pierre en C1 peut être prise, mais si Blanc la capture en B1, son groupe n'a plus qu'une liberté : C1. Tu y rejoues aussitôt et prends 5 pierres. C'est un retour de capture (snapback) : on sacrifie une pierre pour en prendre plus. Ce n'est pas un ko, car tu reprends plusieurs pierres, pas une seule."
  },
  {
    id: 's1', size: 9, difficulty: 400, answers: ['E2'],
    setup: { rows: ['.........', '.........', '.........', '.........', '.........', '.........', '.........', '.........', '...OSO...'], toPlay: 'B',
      refutation: "Pas encore. Ta pierre n'a qu'une liberté, en E2 : si Blanc y joue, il la capture. Occupe ce point toi-même." },
    title: 'Remonte vers le centre',
    prompt: "Ta pierre marquée est en atari : il ne lui reste qu'une liberté. Sauve-la.",
    explanation: "Oui ! En t'allongeant en E2, tes pierres ont 3 libertés : D2, F2 et E3. Une pierre en atari (une seule liberté) se sauve souvent en s'allongeant vers le centre, là où il y a de la place."
  },
  {
    id: 's2', size: 9, difficulty: 500, answers: ['E5'],
    setup: { rows: ['.........', '.........', '.........', '...OOO...', '..OS.SO..', '.........', '.........', '.........', '.........'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc peut couper en E5 : tes deux pierres sont séparées et doivent se défendre chacune de son côté. Le bon point, c'est celui que Blanc veut prendre." },
    title: 'Relie tes pierres',
    prompt: 'Blanc menace de couper en E5 et de mettre tes deux pierres en atari d’un coup. Relie-les.',
    explanation: "C'est ça ! En E5, tes trois pierres ne forment plus qu'un groupe, avec 3 libertés : D4, E4 et F4. Sinon, Blanc coupait en E5 et faisait un double atari : deux pierres en atari (une seule liberté) en même temps."
  },
  {
    id: 's3', size: 9, difficulty: 650, answers: ['E6'],
    setup: { rows: ['.........', '.........', '...O.....', '.........', '..OSOX...', '...OX....', '.........', '.........', '.........'], toPlay: 'B',
      refutation: "Pas tout à fait. Si tu t'allonges en D6, Blanc répond E6 : sa pierre qui coupe est sauvée et la tienne reste en danger. Capture d'abord la pierre qui coupe." },
    title: 'Prends la pierre qui coupe',
    prompt: 'Ta pierre marquée est en atari. La pierre blanche qui la coupe est en atari, elle aussi.',
    explanation: "Bravo ! En E6, tu captures la pierre blanche E5. Ta pierre retrouve des libertés (les points vides à côté d'elle) et, si Blanc la remet en atari en D6, tu te relies en E5. Capturer la pierre qui coupe, c'est souvent la meilleure façon de se sauver."
  },
  {
    id: 's4', size: 9, difficulty: 600, answers: ['D2'],
    setup: { rows: ['.........', '.........', '.........', '.........', '.........', '.........', '..OOO....', '.OS.S.O..', '.........'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc peut couper tes pierres, et ta pierre C2, qui n'a que peu de libertés, finit capturée. Le point de coupe est aussi ton point de liaison." },
    title: 'Relie sur le bord',
    prompt: 'Blanc menace de couper tes deux pierres marquées en D2. Relie-les.',
    explanation: "Exact ! En D2, tes pierres forment un seul groupe avec 4 libertés : C1, D1, E1 et F2. Seule, la pierre C2 n'en avait que deux (les points vides à côté d'elle) : coupée, elle aurait été capturée."
  },
  {
    id: 'v1', size: 9, difficulty: 550, answers: ['B1'],
    setup: { rows: ['.........', '.........', '.........', '.........', '.........', '.........', 'OOOOO....', 'SXXXO....', '...XO....'], toPlay: 'B',
      refutation: "Pas tout à fait. Après ce coup, Blanc peut jouer B1, au milieu de ton espace : il ne te reste qu'un œil, et ton groupe finit capturé. Le point clé est le même pour les deux joueurs." },
    title: 'Deux yeux',
    prompt: 'Noir joue et vit. Ton groupe doit former deux yeux.',
    explanation: "Parfait ! B1 coupe ton espace en deux yeux, A1 et C1. Un œil est un point vide entouré par tes pierres. Blanc ne peut jouer dans aucun des deux : ce serait un suicide. Ton groupe ne peut plus être capturé, il est vivant."
  },
  {
    id: 'v2', size: 9, difficulty: 700, answers: ['A1'],
    setup: { rows: ['.........', '.........', '.........', '.........', '.........', 'OOO......', 'SXO......', '.XXO.....', '..XO.....'], toPlay: 'B',
      refutation: "Pas tout à fait. Après ce coup, Blanc peut t'empêcher de faire deux yeux et ton groupe finit capturé. Cherche le point qui sépare l'espace en deux." },
    title: 'Le coin en coude',
    prompt: 'Noir joue et vit. Trois points vides en forme de coude : où est le point clé ?',
    explanation: "Bien joué ! En A1, tu obtiens deux yeux, A2 et B1. Un œil est un point vide entouré par tes pierres. Blanc ne peut jouer dans aucun des deux : ce serait un suicide. Ton groupe est vivant."
  },
  {
    id: 'v3', size: 9, difficulty: 600, answers: ['E9'],
    setup: { rows: ['.XO...OX.', '.XTOOOOX.', '.XXXXXXX.', '.........', '.........', '.........', '.........', '.........', '.........'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue E9 et fait deux yeux, D9 et F9 : son groupe est vivant pour toujours.' },
    title: 'Un seul œil',
    prompt: 'Noir joue et tue. Empêche le groupe blanc de faire deux yeux.',
    explanation: "Exact ! En E9, au milieu, tu empêches Blanc de faire deux yeux (deux points vides entourés par ses pierres). Avec un seul œil, son groupe ne peut pas vivre : quoi qu'il fasse, il finit capturé."
  },
  {
    id: 'v4', size: 9, difficulty: 800, answers: ['J9'],
    setup: { rows: ['.....XO..', '.....XOO.', '......XOT', '......XXX', '.........', '.........', '.........', '.........', '.........'], toPlay: 'B',
      refutation: 'Pas tout à fait. Blanc joue J9 et fait deux yeux, H9 et J8 : son groupe est vivant.' },
    title: 'Tue dans le coin',
    prompt: 'Noir joue et tue. Le groupe blanc a trois points vides en forme de coude.',
    explanation: "Bravo ! J9 est le point clé du coude. Blanc ne peut plus faire deux yeux (deux points vides entourés par ses pierres) : quoi qu'il fasse, son groupe finit capturé."
  }
];

/** Tous les problèmes communs, dans l'ordre de la base (`order by id`). */
// Lots de problèmes supplémentaires (issue #91) : un fichier par lot dans `lots/`, chacun avec
// `export default` un tableau de PuzzleRow. Chargés automatiquement : ajouter un lot ne touche pas ce fichier.
const LOTS = import.meta.glob<{ default: PuzzleRow[] }>('./lots/*.ts', { eager: true });
export const LOT_PUZZLES: PuzzleRow[] = Object.keys(LOTS)
  .filter(k => !k.endsWith('.test.ts'))
  .sort()
  .flatMap(k => LOTS[k].default);

/**
 * Ordre du Go du jour (#75) : ordre d'arrivée, en ajout seulement. Un nouveau lot s'ajoute à la fin
 * et ne change donc pas les problèmes des jours déjà prévus (contrairement à un tri par id ou par difficulté).
 */
export const CALENDRIER_GO_DU_JOUR: readonly string[] = [...BASE_PUZZLES, ...PUZZLES_16, ...LOT_PUZZLES].map(p => p.id);

/** Tous les problèmes, du plus facile au plus difficile (à difficulté égale, ordre d'identifiant). */
export const ALL_PUZZLES: PuzzleRow[] = [...BASE_PUZZLES, ...PUZZLES_16, ...LOT_PUZZLES]
  .sort((a, b) => a.difficulty - b.difficulty || a.id.localeCompare(b.id));
