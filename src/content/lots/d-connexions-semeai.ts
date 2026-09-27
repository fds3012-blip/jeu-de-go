// Lot D de l'issue #91 : connexions, pierres de coupe et courses aux libertés (semeai), 9 × 9, Noir au trait.
// Aucun seki, aucun ko. Même contenu que la migration 20260927170400_lot_d_connexions_semeai ; chaque position
// est prouvée par src/go/lot-d.test.ts. `setup.refutation` est le texte affiché après une erreur.
import type { PuzzleRow } from '../../data/puzzles';

const LOT_D: PuzzleRow[] = [
  {
    id: 'd01', size: 9, difficulty: 600, answers: ['D4'],
    setup: { rows: ['.........', '.........', '.........', '.........', '.OOXXX...', '.OS.XX...', '.OS.O....', '..OO.....', '.........'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc joue D4 : tes deux pierres n'ont plus qu'une liberté, D3. Si tu prends la pierre D4 en jouant D3, Blanc rejoue en D4 et capture tes trois pierres. Relie-toi du côté de tes pierres fortes." },
    title: 'Relie-toi au groupe fort',
    prompt: 'Tes deux pierres marquées n’ont que deux libertés. Relie-les à ton groupe.',
    explanation: "Bravo ! En D4, tes pierres marquées rejoignent ton grand groupe et partagent toutes ses libertés (les points vides à côté d'un groupe). Si tu avais joué D3, elles n'auraient eu qu'une liberté, D4 : Blanc les capturait."
  },
  {
    id: 'd02', size: 9, difficulty: 650, answers: ['E3'],
    setup: { rows: ['.........', '.........', '.........', '....O....', '...OSO...', '...OSO...', '.........', '.........', '.........'], toPlay: 'B',
      refutation: "Pas encore. Tes pierres n'ont qu'une liberté, E3 : Blanc y joue et les capture : ses deux groupes ne sont plus coupés. Occupe ce point toi-même." },
    title: 'Sauve les pierres qui coupent',
    prompt: 'Tes deux pierres marquées coupent Blanc en deux. Elles sont en atari : sauve-les.',
    explanation: "Exact ! Tes deux pierres sont des pierres de coupe : elles séparent Blanc en deux groupes. Elles étaient en atari (une seule liberté). En E3, elles ont 3 libertés : D3, E2 et F3. Les deux groupes blancs restent séparés, et c'est Blanc qui doit se défendre."
  },
  {
    id: 'd03', size: 9, difficulty: 700, answers: ['E2'],
    setup: { rows: ['.........', '.........', '.........', '.........', '.........', '.....O...', '.XXX.O...', '.XTT.O...', '..X..O...'], toPlay: 'B',
      refutation: "Pas tout à fait. Après ce coup, Blanc joue E2 et relie ses pierres marquées à son groupe de droite : elles sont sauvées. Coupe au point de liaison." },
    title: 'Le bon point de coupe',
    prompt: 'Les deux pierres blanches marquées veulent se relier au groupe blanc de droite. Coupe-les et capture-les.',
    explanation: "Bravo ! Couper, c'est jouer entre deux groupes adverses pour les empêcher de se relier. E2 est le point de coupe : les pierres marquées n'ont plus qu'une liberté, D1. Si Blanc s'allonge en D1, tu joues E1 et tu captures trois pierres."
  },
  {
    id: 'd04', size: 9, difficulty: 720, answers: ['F8'],
    setup: { rows: ['..XX..O..', '.XTTT.O..', '.XXXX.O..', '......O..', '.........', '.........', '.........', '.........', '.........'], toPlay: 'B',
      refutation: "Pas tout à fait. Après ce coup, Blanc joue F8 et relie ses pierres marquées au mur blanc : elles sont sauvées. Coupe au point de liaison." },
    title: 'Coupe sur le bord',
    prompt: 'Les trois pierres blanches marquées veulent rejoindre le mur blanc à droite. Coupe-les et capture-les.',
    explanation: "Bien joué ! Couper, c'est jouer entre deux groupes adverses pour les séparer. F8 coupe les pierres marquées du mur blanc : il ne leur reste qu'une liberté, E9. Si Blanc s'allonge en E9, tu joues F9 et tu captures quatre pierres."
  },
  {
    id: 'd05', size: 9, difficulty: 750, answers: ['A2', 'A1'],
    setup: { rows: ['.XO......', 'XXO......', '.XO......', 'XXO......', 'XXOO.....', 'XTXO.....', 'XOXO.....', '.OX......', '.OX......'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc prend une de tes libertés en D2 : ton groupe C1-C4 n'en a plus qu'une, D1, et Blanc le capture avant que tu prennes le sien. Attaque d'abord les libertés de Blanc." },
    title: 'Premier arrivé',
    prompt: 'Ton groupe C1-C4 et le groupe blanc marqué s’entourent. Compte leurs libertés et gagne la course.',
    explanation: "Bien vu ! C'est une course aux libertés (semeai en japonais) : deux groupes s'entourent, aucun ne peut vivre seul, et le premier qui prend toutes les libertés de l'autre gagne. Ici, 2 contre 2 : celui qui joue d'abord gagne. En A2, Blanc n'a plus que A1 et tu le captures au coup suivant. A1 marche aussi : si Blanc prend ta pierre en A2, son groupe n'a toujours qu'une liberté, A1, et tu le prends."
  },
  {
    id: 'd06', size: 9, difficulty: 800, answers: ['G4'],
    setup: { rows: ['.........', '.........', '.........', '....X....', '...XT.X..', '....XT...', '.....XO..', '.........', '.........'], toPlay: 'B',
      refutation: "Pas tout à fait. Si tu prends E5 en F5, la pierre F4 n'a plus qu'une liberté, G4 : Blanc y joue, se relie à G3 et s'échappe. Coupe d'abord F4 de G3." },
    title: 'Coupe avant de prendre',
    prompt: 'Noir joue et capture les deux pierres blanches marquées. Prendre tout de suite n’est pas le mieux.',
    explanation: "Superbe ! G4 coupe F4 de la pierre blanche G3 : couper, c'est jouer entre deux pierres adverses pour les séparer. Les deux pierres marquées n'ont plus qu'une liberté chacune, F5. Si Blanc les relie en F5, ses trois pierres n'ont qu'une liberté, F6, et tu les captures. Sinon, tu joues F5 et tu prends les deux."
  },
  {
    id: 'd07', size: 9, difficulty: 850, answers: ['A3', 'A2', 'A1'],
    setup: { rows: ['.XO......', 'XXO......', '.XO......', 'XXO......', 'XXOO.....', 'XTXO.....', '.OX......', '.OX......', '.OX......'], toPlay: 'B',
      refutation: "Pas tout à fait. Ton groupe C1-C4 et le groupe blanc ont chacun 3 libertés. Si tu ne réduis pas celles de Blanc tout de suite, Blanc prend les tiennes (D3, D2, D1) et gagne d'un coup." },
    title: 'Trois contre trois',
    prompt: 'Course aux libertés : ton groupe C1-C4 contre le groupe blanc marqué. Qui gagne ? Joue le coup qui te fait gagner.',
    explanation: "Exact ! Dans une course aux libertés (semeai), on compte : 3 libertés pour Blanc (A3, A2, A1), 3 pour toi (D3, D2, D1). À égalité, celui qui joue d'abord gagne. Chaque coup en A3, A2 ou A1 enlève une liberté à Blanc. Ensuite, à chaque coup blanc sur tes libertés, tu réponds sur les siennes, et tu le captures un coup avant qu'il te capture."
  },
  {
    id: 'd08', size: 9, difficulty: 900, answers: ['J9', 'J8', 'J7', 'J6'],
    setup: { rows: ['......XO.', '......XO.', '......XO.', '....O.XT.', '....OOOXX', '......OXX', '......OX.', '......OXX', '......OX.'], toPlay: 'B',
      refutation: "Pas tout à fait. Chaque groupe a 4 libertés. Si tu ne réduis pas tout de suite celles de Blanc, il prend les tiennes (F9, F8, F7, F6) et gagne d'un coup." },
    title: 'La course dans le coin',
    prompt: 'Course aux libertés : ton groupe G6-G9 contre le groupe blanc marqué. Compte, puis joue le coup qui gagne.',
    explanation: "Exact ! Dans une course aux libertés (semeai), on compte : Blanc a 4 libertés (J9, J8, J7, J6), toi aussi (F9, F8, F7, F6), et aucune n'est commune aux deux groupes. À égalité, celui qui joue d'abord gagne : chacun des quatre points marche. Ensuite, réponds à chaque coup blanc sur tes libertés par un coup sur les siennes."
  },
  {
    id: 'd09', size: 9, difficulty: 950, answers: ['J1'],
    setup: { rows: ['......OX.', '......OXX', '......OX.', '......OXX', '....OOOXX', '....OOXTX', '...OOOXOX', '...OOXXOX', '...O.X.O.'], toPlay: 'B',
      refutation: "Pas tout à fait. Si tu joues G1, tu remplis aussi ta propre liberté : ton groupe n'a plus que E1, et Blanc le capture. Joue d'abord sur la liberté extérieure de Blanc." },
    title: 'Une liberté de chaque côté',
    prompt: 'Course aux libertés : chaque groupe a une liberté à lui et partage G1 avec l’autre. Joue le bon coup.',
    explanation: "Bravo ! Blanc a deux libertés : J1, sa liberté extérieure (elle n'appartient qu'à lui), et G1, la liberté commune aux deux groupes. En J1, tu le mets en atari (une seule liberté). S'il remplit ta liberté extérieure E1, tu le captures en G1. Dans une course aux libertés (semeai), la liberté commune se remplit en dernier."
  },
  {
    id: 'd10', size: 9, difficulty: 1000, answers: ['A2', 'A1'],
    setup: { rows: ['.XO......', 'XXO......', '.XO......', 'XXO......', 'XXOOO....', 'XTXOO....', 'XOXOOO...', '.OXX.O...', '.O.X.O...'], toPlay: 'B',
      refutation: "Pas tout à fait. C1 est une liberté commune aux deux groupes : la remplir t'enlève aussi une liberté. Après C1, il reste 2 libertés de chaque côté et c'est à Blanc : il joue E2, puis E1, et capture ton groupe en premier." },
    title: "Dehors d'abord",
    prompt: 'Course aux libertés entre ton groupe et le groupe blanc marqué. C1 touche les deux groupes. Par où commencer ?',
    explanation: "Bravo ! Dans une course aux libertés (semeai), on remplit d'abord les libertés extérieures : celles qui n'appartiennent qu'au groupe adverse, ici A2 et A1. C1 est une liberté commune, partagée par les deux groupes : on la remplit en dernier. Après A2, Blanc a 2 libertés (A1, C1) et toi 3 (C1, E2, E1) : tu captures Blanc un coup avant lui. A1 marche aussi : si Blanc prend ta pierre en A2, il n'a toujours que deux libertés."
  },
  {
    id: 'd11', size: 9, difficulty: 1100, answers: ['A3', 'A2', 'A1'],
    setup: { rows: ['.XO......', 'XXO......', '.XO......', 'XXO......', 'XXOOO....', 'XTXOO....', '.OX.OO...', '.OXX.O...', '.O.X.O...'], toPlay: 'B',
      refutation: "Pas tout à fait. C1 est la liberté commune : la remplir t'enlève aussi une liberté. Il reste alors 3 libertés de chaque côté et c'est à Blanc : il gagne la course d'un coup." },
    title: 'Quatre contre quatre',
    prompt: 'Course aux libertés entre ton groupe et le groupe blanc marqué. Compte bien, puis joue le coup qui gagne.',
    explanation: "Parfait ! Chaque groupe a 4 libertés : 3 libertés extérieures (celles qui n'appartiennent qu'à lui) et C1, la liberté commune. Dans une course aux libertés (semeai), tu remplis d'abord les libertés extérieures de Blanc : A3, A2 ou A1. À chaque coup blanc sur tes libertés, tu réponds sur les siennes. À la fin, il ne reste que C1 aux deux groupes, c'est à toi, et tu captures Blanc en C1."
  },
  {
    id: 'd12', size: 9, difficulty: 1250, answers: ['A2'],
    setup: { rows: ['.XO......', 'XXO......', '.XO......', 'XXO......', 'XXOOO....', 'XTXOO....', 'XOXOOOO..', '.OXXXXO..', '.O.X.XO..'], toPlay: 'B',
      refutation: "Pas tout à fait. Si tu remplis C1, ton groupe n'a plus que son œil E1 : Blanc y joue et le capture. Et A1 vient trop tôt : Blanc prend ta pierre en A2, et tu ne peux plus rejouer en A1." },
    title: "L'œil qui gagne",
    prompt: 'Course aux libertés : ton groupe a un œil en E1, le groupe blanc marqué n’en a pas. Gagne la course.',
    explanation: "Excellent ! Ton groupe a un œil en E1 : un point vide entouré par tes pierres, où Blanc ne peut jouer qu'en dernier. Dans une course aux libertés (semeai), tu as 2 libertés, C1 et l'œil E1 ; Blanc en a 3, A2, A1 et C1, la liberté commune aux deux groupes. Après A2, Blanc ne peut ni jouer dans ton œil (ce serait un suicide) ni jouer C1 sans se mettre en atari. Tu joues ensuite A1, puis C1, et tu le captures. L'œil t'a fait gagner une course où tu avais moins de libertés."
  },
  {
    id: 'd13', size: 9, difficulty: 1300, answers: ['J8', 'J7'],
    setup: { rows: ['.OOX.X.O.', '.O.XXXXO.', '..OOOOXO.', '....OOXTX', '....OOOXX', '......OXX', '......OX.', '......OXX', '......OX.'], toPlay: 'B',
      refutation: "Pas tout à fait. Blanc a une liberté de plus que toi : chaque coup compte. Réduis ses libertés extérieures (celles qui n'appartiennent qu'à lui) et garde G9, la liberté commune, pour la fin." },
    title: "L'œil contre quatre libertés",
    prompt: 'Course aux libertés : ton groupe a un œil en E9, le groupe blanc marqué a une liberté de plus. Gagne quand même.',
    explanation: "Magnifique ! Tu as 3 libertés : l'œil E9, C8 et G9, la liberté commune aux deux groupes. Blanc en a 4 : J9, J8, J7 et G9. Mais Blanc ne peut pas jouer dans ton œil (ce serait un suicide), et s'il joue G9, il s'enlève aussi une liberté. Après J8, tu joues J7 puis J9, et tu captures Blanc en G9."
  }
];

export default LOT_D;
