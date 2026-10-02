// Seize leçons interactives, positions vérifiées par un lecteur tactique.
// rows : plateau 9 × 9 ligne par ligne depuis le haut. X noir, O blanc, T pierre blanche visée, S pierre noire à sauver.
// Coordonnées : lettres A à J sans I, lignes numérotées depuis le bas. accept: 'line3' = tout coup hors des deux premières lignes.
const L_CAP1 = ['.........', '.........', '.........', '...X.....', '..XT.O...', '...X.....', '.........', '.........', '.........'];
// Leçons v2 (issue #101) : `demo` joue la position temps par temps ; une idée par étape, 12 mots au plus.
// #198 : `geste` fait jouer l'élève dans la démonstration (il pose la pierre noire, ou touche le point) ; au plus 35 % d'étapes sans geste.
const V = ['.........', '.........', '.........', '.........', '.........', '.........', '.........', '.........', '.........'];
const L_GROUPE = ['.........', '.........', '.........', '...XX....', '..XTTX...', '...X.....', '....O....', '.........', '.........'];
const L_YEUX = ['.........', '.........', '.........', '.........', '.........', '.........', 'OOOOOO...', 'XXXXXO...', '.X.XXO...'];
const L_FIN = ['...XO....', '...XO....', '...XO....', '...XO....', '...XO....', '...XO....', '...XO....', '...XO....', '...XO....'];
const L_ATARI = ['.........', '.........', '.........', '....X....', '...XO....', '....X....', '.........', '.........', '.........'];
const L_CONTRE = ['.........', '.........', '....O....', '...O.....', '...OXOX..', '....OX...', '.........', '.........', '.........'];
const L_CONTRE_Q = ['.........', '.........', '....O....', '...O.....', '...OSOX..', '....OX...', '.........', '.........', '.........'];
const L_DOUBLE = ['.........', '.........', '.........', '...X.X...', '..XO.OX..', '.........', '.........', '.........', '.........'];
const L_ECHELLE = ['.........', '.........', '.........', '....X....', '....OX...', '...X.....', '.........', '.........', '.........'];
const ECHELLE_1 = [{ pose: 'D5', couleur: 'B' }, { libs: 'E5' }, { pose: 'E4', couleur: 'W' }, { pose: 'E3', couleur: 'B' }, { pose: 'F4', couleur: 'W' }, { pose: 'G4', couleur: 'B' }, { pose: 'F3', couleur: 'W' }];
const ECHELLE_2 = ['F2', 'G3', 'H3', 'G2', 'H2', 'G1', 'F1', 'H1', 'J1'].map((pose, i) => ({ pose, couleur: i % 2 ? 'W' : 'B' }));
const L_KO = ['.........', '.........', '.........', '...OX....', '..O.OX...', '...OX....', '.........', '.........', '.........'];
// Leçon 7 (#177) : partie finie, frontière en E (Noir) et F (Blanc). Chaque chiffre est recalculé par score() (src/go/lessons.test.ts).
const L_COMPTE = Array(9).fill('....XO...');
const ouverte = (y) => L_COMPTE.map((r, i) => (i === y ? '.....O...' : r));
// Leçon 8 (#228, chapitre 2) : bien commencer une partie sur 9 × 9. Chaque ensemble de réponses acceptées
// et chaque ensemble de réfutations est recalculé par src/go/lessons.test.ts à partir d'un critère écrit en clair.
const L_FORMES = ['.........', '.........', '..XX.....', '.X..X..XX', '.X..X.X..', '..XX..X..', 'XX.....XX', '..X......', '.........'];
const L_3_3_5_5 = ['.........', '.........', '.........', '.........', '....O....', '.........', '..X......', '.........', '.........'];
const L_COLLE = ['.........', '.........', '......O..', '.........', '....OX...', '.........', '..X......', '.........', '.........'];
const L_ETENDRE = ['.........', '.........', '......O..', '.........', '.........', '.........', '..X......', '.........', '.........'];
const L_QUATRE_COINS = ['.........', '.........', '..X...O..', '.........', '.........', '.........', '..X...O..', '.........', '.........'];
const COINS_LIBRES = ['C7', 'D7', 'C6', 'G7', 'F7', 'G6', 'G3', 'F3', 'G4'];
const lignes12 = (sauf) => ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J'].flatMap((c, x) => [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => ({ l: `${c}${n}`, x, y: 9 - n })))
  .filter(({ l, x, y }) => Math.min(x, y, 8 - x, 8 - y) <= 1 && !sauf.includes(l)).map(({ l }) => l);
const BAS = { no: 'Sur les deux premières lignes, au début, ta pierre entoure peu.' };
// Leçons 9 à 12 (#16) : filet, prise en retour, course aux libertés, faux œil. Chaque position, chaque réponse acceptée
// et chaque réfutation est prouvée par src/go/lecons-16.test.ts (lecteur exact de capture, preuve de vie et mort).
// Filet : trois pierres blanches (C7, G7, C3) cassent toutes les échelles ; seul un filet prend la pierre.
const L_FILET = ['.........', '.........', '..O.X.O..', '.........', '..X.TX...', '....X....', '..O......', '.........', '.........'];
const L_FILET_Q = ['.........', '.........', '......O..', '....X....', '...XT.X..', '.........', '..O.X.O..', '.........', '.........'];
// Prise en retour : si Noir met en atari du mauvais côté, Blanc relie ses pierres marquées à son groupe du bas.
const L_RETOUR = ['.........', '.........', '......XXX', '......XTT', '......X..', '.......XO', '.......OO', '.......OO', '.........'];
const L_RETOUR_Q = ['.OOO.TX..', '.OOX.TX..', '....XXX..', '.........', '.........', '.........', '.........', '.........', '.........'];
// Course aux libertés : deux groupes sans œil, aucune liberté commune. Démo 3 contre 3, question 2 contre 2.
const L_COURSE = ['.........', '.........', '.........', '.........', '.........', '.....OOOO', '..XXXXOOO', '..XTTTXXX', '..X......'];
const L_COURSE_Q = ['.........', '.........', '.........', '.........', 'OOO......', '..O......', 'SSO......', 'TTXX.....', '..X......'];
// Faux œil : D1 et E1 ne tiennent au groupe que par C1, et le coin D2 de C1 est blanc. Deux pierres séparées :
// Blanc les prend sans ko.
const L_FAUX = ['.........', '.........', '.........', '.........', '.........', '.........', 'OOOOOOO..', 'XXXOOOO..', '.X.XX.O..'];
const L_FAUX_D2 = ['.........', '.........', '.........', '.........', '.........', '.........', 'OOOOOO...', 'XXXOXO...', '.X.XXO...'];
const L_FAUX_VIS = ['.........', '.........', '.........', '.........', '.........', '.........', 'OOOOOO...', 'SXX.XO...', '.X.XXO...'];
const L_FAUX_TUE = ['...XOO.O.', '...XO.OOT', '...XXXXXX', '.........', '.........', '.........', '.........', '.........', '.........'];
// Leçons 13 à 16 (#16) : le point vital, le seki, finir la partie, compter une partie. Chaque position, chaque réponse
// acceptée, chaque réfutation et chaque chiffre est prouvé par src/go/lecons-13-16.test.ts (preuve de vie et mort en zone
// fermée, score() du moteur en règle japonaise).
// Point vital : trois points en ligne, le milieu décide ; quatre en ligne vivent même si Blanc entre ; deux meurent.
const L_TROIS = ['.........', '.........', '.........', '.........', '.........', '.........', 'OOOOOOO..', 'OXXXXXO..', 'OX...XO..'];
const L_TROIS_TUE = ['XT...OX..', 'XOOOOOX..', 'XXXXXXX..', '.........', '.........', '.........', '.........', '.........', '.........'];
const L_TROIS_VIS = ['.........', '.........', '.........', '.......OO', '......OSX', '......OX.', '......OX.', '......OX.', '......OXX'];
const L_QUATRE = ['.........', '.........', '.........', '.........', '.........', '.........', 'OOOOOOOO.', 'OXXXXXXO.', 'OX....XO.'];
const L_DEUX = ['.........', '.........', '.........', '.........', '.........', '.........', '...OOOOO.', '...OSXXO.', '...OX..O.'];
// Seki : la chaîne noire C2-E2 et les chaînes blanches qui l'entourent n'ont aucun œil et partagent C1 et E1. Qui en
// remplit une se met en atari et se fait prendre. Question : E2 vide ; seul E2 garde deux libertés partagées.
const L_SEKI = ['.........', '.........', '.........', '.........', '.........', 'XXXXXXX..', 'XOOOOOX..', 'XOXXXOX..', 'XO.O.OX..'];
const L_SEKI_Q = ['.........', '.........', '.........', '.........', '.........', 'XXXXXXX..', 'XOOOOOX..', 'XOSX.OX..', 'XO.O.OX..'];
// Finir la partie : dame en E7 (touche Noir et Blanc), pierre blanche morte en B2 dans le coin noir (A1, A2, B1).
// `TROU` : la frontière est encore ouverte en E8 ; `SANS` : B2 retirée, comptée prisonnière.
const L_FIN_P = ['....XO...', '....XO...', '...X.O...', '...XO....', '...XO....', '...XXO...', 'XXXXXO...', '.OX.XO...', '..X.XO...'];
const L_FIN_TROU = L_FIN_P.map((r, i) => (i === 1 ? '.....O...' : r));
const L_FIN_SANS = L_FIN_P.map((r, i) => (i === 7 ? '..X.XO...' : r));
// Compter une partie : une morte de chaque côté (B2 blanche, H8 noire), une dame en E5. `SANS` : mortes retirées.
const L_COMPTE_P = ['...XO.O..', '...XO.OX.', '...XO.OOO', '...XO....', '...X.O...', '....XO...', 'XXX.XO...', '.OX.XO...', '..X.XO...'];
const L_COMPTE_SANS = L_COMPTE_P.map((r, i) => (i === 1 ? '...XO.O..' : i === 7 ? '..X.XO...' : r));
export const CHAPITRES = [
  { id: 'c1', titre: 'Les bases', intro: 'Sept leçons courtes pour jouer ta première partie.', fin: 'Tu connais les règles du go.', lecons: ['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7'] },
  // Chapitre en cours d'écriture (`complet: false`) : sa dernière leçon ne ferme pas encore le chapitre.
  { id: 'c2', titre: 'Ouverture sur 9\u00A0×\u00A09', intro: 'Où poser tes premières pierres.', lecons: ['l8'], complet: false },
  { id: 'c3', titre: 'Capturer et sauver', intro: 'Des pièges pour prendre plus de pierres.', lecons: ['l9', 'l10', 'l11'], complet: false },
  { id: 'c4', titre: 'Vie et mort', intro: 'Quand un groupe vit, quand il meurt.', lecons: ['l12', 'l13', 'l14'], complet: false },
  { id: 'c5', titre: 'Fin de partie et comptage', intro: 'Finir proprement, puis compter juste.', lecons: ['l15', 'l16'], complet: false }
];
export const LESSONS = [
  { id: 'l1', title: 'Libertés et capture', desc: 'La règle qui fait tout le jeu', steps: [
    { kind: 'info', rows: V, demo: [{ pose: 'E5', couleur: 'B' }, { libs: 'E5' }], geste: { pose: 'E5' },
      text: 'Pose ta pierre au point vert. Les points vides autour : ses libertés.' },
    { kind: 'info', rows: ['.........', '.........', '.........', '.........', '....X....', '.........', '.........', '.........', '.........'], demo: [{ pose: 'A1', couleur: 'B' }, { libs: 'A1' }], geste: { pose: 'A1' },
      text: 'Pose une pierre dans le coin, au point vert : deux libertés seulement.' },
    { kind: 'info', rows: ['.........', '.........', '.........', '.........', '...O.O...', '.........', '.........', '.........', '.........'],
      demo: [{ libs: 'D5' }, { pose: 'D6', couleur: 'B' }, { pose: 'C5', couleur: 'B' }, { pose: 'D4', couleur: 'B' }], geste: { pose: 'D6' },
      text: "Bouche ses libertés, en commençant par le point vert. Plus qu'une : l'atari." },
    { kind: 'move', rows: L_CAP1, accept: ['E5'], text: 'Joue sur la dernière liberté pour capturer.',
      ok: 'Capturée ! Sans liberté, la pierre quitte le plateau.', no: 'Cherche le seul point vide à côté de la pierre marquée.' },
    { kind: 'info', rows: L_GROUPE, demo: [{ libs: 'D5' }], geste: { touche: ['D5', 'E5'], no: 'Touche une des deux pierres blanches collées.' },
      text: 'Pierres collées : un groupe, aux libertés partagées. Touche-le.' },
    { kind: 'move', rows: L_GROUPE, accept: ['E4'], text: "Capture les deux pierres d'un coup.",
      ok: 'Deux prisonniers ! Un groupe vit ou meurt ensemble.', no: "Le groupe n'a qu'une liberté : trouve-la." }
  ] },
  { id: 'l2', title: 'Atari : attaquer et se sauver', desc: "Quand il ne reste qu'une liberté", steps: [
    { kind: 'info', rows: ['.........', '.........', '.........', '....X....', '...XO....', '.........', '.........', '.........', '.........'], demo: [{ libs: 'E5' }, { pose: 'E4', couleur: 'B' }], geste: { pose: 'E4' },
      text: "Pose au point vert. Plus qu'une liberté : la pierre est en atari." },
    { kind: 'info', rows: L_ATARI, demo: [{ pose: 'F5', couleur: 'B' }], geste: { pose: 'F5' },
      text: 'Si Blanc ne fait rien, capture-la au point vert.' },
    { kind: 'info', rows: ['.........', '.........', '.........', '.....O...', '....OXO..', '....X.O..', '.........', '.........', '.........'], demo: [{ libs: 'F5' }, { pose: 'F4', couleur: 'B' }], geste: { pose: 'F4' },
      text: 'En atari ? Allonge-toi au point vert : tes libertés remontent.' },
    { kind: 'move', rows: ['.........', '.........', '.........', '...O.....', '..OSO....', '..O.X....', '.........', '.........', '.........'], accept: ['D4'], libs: ['D4'],
      text: 'À toi. Allonge ta pierre marquée sur sa liberté.',
      ok: 'Trois libertés : ta pierre est sauvée.', no: 'Joue sur le point vert, à côté de ta pierre.' },
    { kind: 'info', rows: L_CONTRE, demo: [{ libs: 'E5' }, { pose: 'E6', couleur: 'B' }], geste: { pose: 'E6' },
      text: 'Allonge-toi au point vert. Ici, ça ne suffit pas : toujours une liberté.' },
    { kind: 'move', rows: L_CONTRE_Q, accept: ['F6'],
      text: 'Sauve ta pierre autrement : une pierre blanche est en atari.',
      ok: 'Capturer F5 libère ta pierre. Attaquer, c’est aussi défendre.', no: "Cherche la pierre blanche qui n'a qu'une liberté." }
  ] },
  { id: 'l3', title: 'Techniques de capture', desc: 'Double atari, bord et échelle', steps: [
    { kind: 'info', rows: L_DOUBLE, demo: [{ pose: 'E5', couleur: 'B' }, { atari: ['D5', 'F5'] }], geste: { pose: 'E5' },
      text: "Pose au point vert : deux pierres en atari, c'est le double atari." },
    { kind: 'info', rows: L_DOUBLE, avant: [{ pose: 'E5', couleur: 'B' }], demo: [{ pose: 'D4', couleur: 'W' }, { pose: 'F4', couleur: 'B' }], geste: { pose: 'F4' },
      text: "Blanc en sauve une. Prends l'autre au point vert." },
    { kind: 'move', rows: ['.........', '.........', '.........', '.........', '..XT.TX..', '...X.X...', '.........', '.........', '.........'], accept: ['E5'], libs: ['D6', 'E5', 'F6'],
      text: 'À toi : trouve le double atari.',
      ok: "Blanc ne peut en sauver qu'une : tu prends l'autre.", no: 'Cherche le point vert commun aux deux pierres.' },
    { kind: 'info', rows: ['.........', '.........', '.........', '.........', '.........', '.........', '.........', '.XOX.....', '.........'],
      demo: [{ pose: 'C3', couleur: 'B' }, { libs: 'C2' }, { pose: 'C1', couleur: 'W' }, { pose: 'B1', couleur: 'B' }, { pose: 'D1', couleur: 'W' }, { pose: 'E1', couleur: 'B' }], geste: { pose: 'C3' },
      text: 'Atari vers le bord, au point vert : elle fuit et meurt.' },
    { kind: 'move', rows: ['.........', '.........', '.........', '.........', '.........', '.........', '.........', '...XTX...', '.........'], accept: ['E3'],
      text: 'À toi : pousse la pierre marquée vers le bord.',
      ok: "Contre le bord, elle n'a plus d'issue.", no: "De ce côté, elle s'échappe vers le centre." },
    { kind: 'info', rows: L_ECHELLE, demo: ECHELLE_1, geste: { pose: 'D5' },
      text: "L'échelle : atari au point vert. Elle fuit, jamais plus de deux libertés." },
    { kind: 'info', rows: L_ECHELLE, avant: ECHELLE_1, demo: ECHELLE_2,
      text: "Elle fuit en zigzag jusqu'au bord, puis tombe." },
    { kind: 'move', rows: ['.........', '.........', '.........', '....X....', '...XT....', '.....X...', '.........', '.........', '.........'], accept: ['F5', 'E4'],
      text: "À toi : lance l'échelle sur la pierre marquée.",
      ok: "Elle fuira en zigzag jusqu'au bord. Une pierre blanche sur le chemin la sauverait.", no: 'Joue du côté où ta pierre F4 bloque la fuite.' }
  ] },
  { id: 'l4', title: 'Le ko', desc: 'La règle qui empêche de tourner en rond', steps: [
    { kind: 'info', rows: L_KO, demo: [{ pose: 'D5', couleur: 'B' }, { libs: 'D5' }], geste: { pose: 'D5' },
      text: 'Capture au point vert. Ta pierre est aussitôt en atari.' },
    { kind: 'info', rows: L_KO, avant: [{ pose: 'D5', couleur: 'B' }], demo: [{ interdit: 'E5', couleur: 'W' }],
      text: "Reprendre tout de suite est interdit : c'est le ko." },
    { kind: 'info', rows: L_KO, avant: [{ pose: 'D5', couleur: 'B' }], demo: [{ pose: 'H8', couleur: 'W' }, { pose: 'B2', couleur: 'B' }, { pose: 'E5', couleur: 'W' }],
      text: 'Blanc joue ailleurs, Noir aussi. Maintenant, Blanc peut reprendre.' },
    { kind: 'move', rows: ['.........', '.........', '.........', '....XO...', '...XT.O..', '....XO...', '.........', '.........', '.........'], accept: ['F5'], libs: ['F5'],
      text: 'À toi : capture la pierre marquée.',
      ok: "Ta pierre F5 est à son tour en atari : c'est un ko.", no: "La pierre marquée n'a qu'une liberté : le point vert." },
    { kind: 'touche', rows: ['.........', '.........', '.........', '....XO...', '...X.XO..', '....XO...', '.........', '.........', '.........'], accept: ['E5'],
      text: 'Touche le point où Blanc ne peut pas reprendre.',
      ok: "Oui, E5 : Blanc doit d'abord jouer ailleurs.", no: 'Cherche où Blanc reprendrait ta pierre F5.' }
  ] },
  { id: 'l5', title: 'Vivre et mourir', desc: 'Les deux yeux', steps: [
    { kind: 'info', rows: L_YEUX, demo: [{ yeux: ['A1'] }, { yeux: ['C1'] }], geste: { touche: ['A1', 'C1'], no: 'Cherche un point vide entouré de pierres noires.' },
      text: 'Un œil : un point vide entouré par un seul groupe. Touches-en un.' },
    { kind: 'info', rows: L_YEUX, demo: [{ interdit: 'A1', couleur: 'W' }, { interdit: 'C1', couleur: 'W' }],
      text: "Dans un œil, Blanc n'aurait aucune liberté : interdit." },
    { kind: 'info', rows: L_YEUX, demo: [{ yeux: ['A1', 'C1'] }],
      text: 'Deux vrais yeux : ce groupe vit pour toujours.' },
    { kind: 'move', rows: ['.........', '.........', '.........', '.........', '.........', '.........', 'OOOOO....', 'SXXXO....', '...XO....'], accept: ['B1'],
      text: "Ton groupe est entouré. Fais deux yeux d'un coup.",
      ok: 'B1 sépare deux yeux, A1 et C1 : ton groupe vit.', no: "Un seul œil ne suffit pas. Joue au milieu de l'espace." },
    { kind: 'move', rows: ['.........', '.........', '.........', '.........', '.........', '.........', 'XXXXX....', 'TOOOX....', '...OX....'], accept: ['B1'],
      text: "À l'inverse : empêche Blanc de faire deux yeux.",
      ok: 'Point vital (celui qui décide) pris : un seul œil, Blanc est mort.', no: 'Au milieu, Blanc ferait deux yeux. Prends ce point avant lui.' }
  ] },
  { id: 'l6', title: 'Territoire et ouverture', desc: 'Compter et bien commencer', steps: [
    { kind: 'move', rows: L_FIN, accept: 'terrB',
      text: 'Territoire : les points vides entourés. Touche celui de Noir.',
      ok: 'Oui ! Ces points vides sont entourés par Noir.', no: 'Cherche un point vide du côté des pierres noires.' },
    { kind: 'info', rows: L_FIN, demo: [{ terr: 'B' }], text: 'Compte avec moi : trois colonnes de neuf.' },
    { kind: 'info', rows: L_FIN, demo: [{ terr: 'W' }], text: 'Blanc a plus de points, plus le komi (points offerts à Blanc) : il gagne.' },
    { kind: 'info', rows: ['.........', '.........', '..X...O..', '.........', '.........', '.........', '..O...X..', '.........', '.........'],
      text: "En ouverture : les coins d'abord, puis les bords, puis le centre." },
    { kind: 'info', rows: ['.........', '.........', '..X...O..', '.........', '.........', '.........', '..O...X..', '.........', '.........'],
      text: 'Coins et bords entourent du territoire avec moins de pierres.' },
    { kind: 'move', rows: ['.........', '.........', '.........', '.........', '.........', '.........', '.........', '.........', '.........'], accept: 'line3',
      text: 'Joue le premier coup. Évite les deux lignes du bord.',
      ok: 'Bon premier coup : assez loin du bord pour construire, assez proche pour entourer du territoire.', no: 'Trop près du bord : une pierre sur les deux premières lignes entoure très peu. Rapproche-toi du centre.' }
  ] },
  { id: 'l7', title: 'Compter les points', desc: 'Fermer, passer, compter', steps: [
    { kind: 'info', rows: L_COMPTE, demo: [{ terr: 'B' }, { terr: 'W' }],
      text: 'On compte territoire + prisonniers. Blanc reçoit aussi le komi (6,5 points, car Noir commence).' },
    { kind: 'quiz', rows: L_COMPTE, terr: true, compte: { pour: 'W', komi: 6.5 },
      text: 'Territoire colorié. Avec le komi, combien de points pour Blanc ?', choices: ['27', '33,5', '36'], answer: 1,
      ok: '27 + 6,5 = 33,5. Noir a 36 : il gagne de 2,5 points.', no: 'Compte les points de Blanc, puis ajoute le komi.' },
    { kind: 'info', rows: ouverte(2), demo: [{ pose: 'E7', couleur: 'B' }, { terr: 'B' }], geste: { pose: 'E7' },
      text: 'Trou en E7 : ton territoire ne compte pas. Ferme-le au point vert.' },
    { kind: 'move', rows: ouverte(6), accept: ['E3'], aide: ['E3'],
      text: 'À toi : ferme la frontière sur le point vert.',
      ok: 'Fermée : tes 36 points comptent enfin.', no: 'Tant que ce trou reste ouvert, Blanc peut entrer chez toi.' },
    { kind: 'quiz', rows: L_COMPTE,
      text: 'Toutes les frontières sont fermées. Que fais-tu ?', choices: ['Je passe', 'Chez moi', 'Chez Blanc'], answer: 0,
      ok: 'Oui. Après deux passes de suite, la partie s’arrête : on compte.', no: 'Chez toi, tu perds un point. Chez Blanc, ta pierre serait prise.' },
    { kind: 'quiz', rows: L_COMPTE, compte: { pour: 'B', komi: 6.5, prises: [3, 5] },
      text: 'Noir a 3 prisonniers, Blanc 5. Combien de points pour Noir ?', choices: ['36', '39', '42,5'], answer: 1,
      ok: '36 + 3 = 39. Blanc : 27 + 5 + 6,5 = 38,5. Noir gagne d’un demi-point.', no: 'Territoire plus prisonniers. Le komi, lui, va à Blanc.' }
  ] },
  { id: 'l8', title: 'Les premiers coups', desc: 'Coins, puis bords, puis centre', steps: [
    { kind: 'info', rows: L_FORMES, geste: { pose: 'C1' },
      demo: [{ pose: 'C1', couleur: 'B' }, { zone: ['A1', 'A2', 'B1', 'B2'] }, { zone: ['H4', 'H5', 'J4', 'J5'] }, { zone: ['C5', 'C6', 'D5', 'D6'] }],
      text: 'Ferme le coin au point vert : 4 pierres (pour 4 points). Bord : 6, centre : 8.' },
    { kind: 'info', rows: V, geste: { pose: 'C3' }, demo: [{ pose: 'C3', couleur: 'B' }, { pose: 'E5', couleur: 'W' }],
      text: 'Pose le 3-3 (3e ligne depuis deux bords) au point vert. Blanc prend le 5-5 (le centre, proche des quatre coins).' },
    { kind: 'move', rows: L_3_3_5_5, accept: COINS_LIBRES, aide: COINS_LIBRES,
      text: 'Prends un coin libre : au 3-3, ou au 3-4 (un cran plus loin).',
      ok: 'Bien : le 3-3 garde le coin, le 3-4 regarde aussi un bord.', no: 'Choisis un point vert, dans un coin sans pierre.',
      refus: [
        { points: ['D5', 'F5', 'E4', 'E6'], no: 'Collée à Blanc, ta pierre le renforce. Laisse de l’espace.' },
        { points: lignes12([]), ...BAS }
      ] },
    { kind: 'info', rows: L_COLLE, geste: { touche: ['F5'], no: 'Cherche la pierre noire qui touche une pierre blanche.' },
      demo: [{ libs: 'F5' }, { pose: 'F6', couleur: 'W' }],
      text: 'Touche la pierre collée à Blanc : 3 libertés. Blanc la presse aussitôt.' },
    { kind: 'info', rows: L_ETENDRE, geste: { pose: 'E3' }, demo: [{ pose: 'E3', couleur: 'B' }, { zone: ['C1', 'C2', 'D1', 'D2', 'E1', 'E2'] }],
      text: 'Étends-toi au point vert : un point libre entre tes deux pierres.' },
    { kind: 'move', rows: L_QUATRE_COINS, accept: ['C5', 'E3', 'E7'],
      text: 'À toi : étends-toi depuis une de tes pierres, le long du bord.',
      ok: 'Bien étendu : sur la 3e ligne, sans toucher aucune pierre.', no: 'Reste sur la 3e ligne, à deux ou trois points d’une de tes pierres.',
      refus: [
        { points: ['F3', 'G2', 'G4', 'H3', 'F7', 'G6', 'G8', 'H7'], no: 'Collée à Blanc, ta pierre le renforce. Laisse de l’espace.' },
        { points: ['B3', 'C2', 'C4', 'D3', 'B7', 'C6', 'C8', 'D7'], no: 'Trop serrée : laisse un point libre entre tes pierres.' },
        { points: lignes12(['F3', 'G2', 'G4', 'H3', 'F7', 'G6', 'G8', 'H7', 'B3', 'C2', 'C4', 'D3', 'B7', 'C6', 'C8', 'D7']), ...BAS }
      ] }
  ] },
  { id: 'l9', title: 'Le filet', desc: 'Enfermer une pierre sans la toucher', steps: [
    { kind: 'info', rows: L_FILET, geste: { pose: 'E6' },
      demo: [{ pose: 'E6', couleur: 'B' }, { libs: 'E5' }, { pose: 'D5', couleur: 'W' }, { pose: 'D4', couleur: 'B' }, { pose: 'D6', couleur: 'W' }, { pose: 'C6', couleur: 'B' }, { pose: 'D7', couleur: 'W' }],
      text: 'Atari au point vert ? Elle fuit vers une pierre blanche : sauvée.' },
    { kind: 'info', rows: L_FILET, geste: { pose: 'D6' },
      demo: [{ pose: 'D6', couleur: 'B' }, { libs: 'E5' }, { pose: 'D5', couleur: 'W' }, { pose: 'D4', couleur: 'B' }, { pose: 'E6', couleur: 'W' }, { pose: 'F6', couleur: 'B' }],
      text: 'Filet (geta) : ferme ses sorties au point vert, sans la toucher.' },
    { kind: 'move', rows: L_FILET_Q, accept: ['F4', 'G4', 'F3'],
      text: 'À toi : prends la pierre marquée dans un filet.',
      ok: 'Filet ! Elle a encore deux libertés, mais plus aucune sortie.', no: 'Ne la touche pas : ferme de loin ses deux sorties.',
      refus: [{ points: ['F5', 'E4'], no: 'En atari, elle s’allonge et l’échelle casse : elle s’échappe.' }] }
  ] },
  { id: 'l10', title: 'La prise en retour', desc: 'Donner une pierre pour en prendre trois', steps: [
    { kind: 'info', rows: L_RETOUR, geste: { pose: 'J5' },
      demo: [{ pose: 'J5', couleur: 'B' }, { libs: 'J5' }, { pose: 'H5', couleur: 'W' }],
      text: 'Pose au point vert. Ta pierre est en atari : c’est voulu.' },
    { kind: 'info', rows: L_RETOUR, avant: [{ pose: 'J5', couleur: 'B' }, { pose: 'H5', couleur: 'W' }], geste: { pose: 'J5' },
      demo: [{ libs: 'H5' }, { pose: 'J5', couleur: 'B' }],
      text: 'Blanc a pris, mais il est en atari. Reprends au point vert.' },
    { kind: 'move', rows: L_RETOUR_Q, accept: ['E9'],
      text: 'À toi : donne une pierre, puis prends-en trois.',
      ok: 'Prise en retour (snapback) ! Pas un ko : tu en prends trois.', no: 'Joue là où Blanc voudrait se relier, même si ta pierre est prise.',
      refus: [{ points: ['E8'], no: 'Atari du mauvais côté : Blanc joue E9 et se relie.' }] }
  ] },
  { id: 'l11', title: 'La course aux libertés', desc: 'Qui prend l’autre en premier', steps: [
    { kind: 'info', rows: L_COURSE, geste: { touche: ['D2', 'E2', 'F2'], no: 'Touche une des trois pierres blanches collées.' },
      demo: [{ libs: 'E2' }, { libs: 'H2' }],
      text: 'Course aux libertés (semeai) : groupes sans œil. Touche le blanc, on compte.' },
    { kind: 'info', rows: L_COURSE, geste: { pose: 'D1' },
      demo: [{ pose: 'D1', couleur: 'B' }, { libs: 'E2' }, { pose: 'H1', couleur: 'W' }, { pose: 'E1', couleur: 'B' }, { pose: 'G1', couleur: 'W' }, { pose: 'F1', couleur: 'B' }],
      text: 'Trois contre trois. Tu joues d’abord : bouche le point vert.' },
    { kind: 'move', rows: L_COURSE_Q, accept: ['A1', 'B1'],
      text: 'À toi : bouche les libertés blanches, pas les tiennes.',
      ok: 'Blanc n’a plus qu’une liberté : tu gagnes la course.', no: 'Compte : il faut boucher une liberté de Blanc.',
      refus: [{ points: ['A4', 'B4'], no: 'Tu bouches ta propre liberté : Blanc gagne la course.' }] }
  ] },
  { id: 'l12', title: 'Le faux œil', desc: 'Un œil qui ne compte pas', steps: [
    { kind: 'info', rows: L_FAUX, geste: { touche: ['D1', 'E1'], no: 'Touche une des deux pierres noires de droite.' },
      demo: [{ yeux: ['A1', 'C1'] }, { libs: 'D1' }],
      text: 'Deux yeux ? Touche D1 : elle n’est pas reliée au reste.' },
    { kind: 'info', rows: L_FAUX, geste: { pose: 'C1' },
      demo: [{ libs: 'D1' }, { pose: 'F1', couleur: 'W' }, { pose: 'C1', couleur: 'B' }, { pose: 'A1', couleur: 'W' }],
      text: 'D1 est en atari. Relie au point vert : un seul œil reste.' },
    { kind: 'touche', rows: L_FAUX_D2, accept: ['C1'],
      text: 'Touche le faux œil (un œil que Blanc peut détruire).',
      ok: 'Oui, C1 : son coin D2 est blanc. Au bord, un seul coin suffit.', no: 'Regarde les coins (diagonales) de chaque œil.' },
    { kind: 'move', rows: L_FAUX_VIS, accept: ['D2'],
      text: 'À toi : fais deux vrais yeux avant Blanc.',
      ok: 'D2 relie tout : A1 et C1 sont deux vrais yeux. Tu vis.', no: 'Protège le coin de C1 avant que Blanc le prenne.',
      refus: [{ points: ['A1', 'C1'], no: 'Tu bouches un de tes yeux : il n’en reste qu’un.' }] },
    { kind: 'move', rows: L_FAUX_TUE, accept: ['F8'],
      text: 'À l’inverse : rends un œil blanc faux.',
      ok: 'Blanc n’a plus qu’un vrai œil : il est mort.', no: 'Prends le coin de l’œil blanc, là où ses pierres se séparent.' }
  ] },
  { id: 'l13', title: 'Le point vital', desc: 'Trois points en ligne : le milieu décide', steps: [
    { kind: 'info', rows: L_TROIS, geste: { pose: 'D1' }, demo: [{ pose: 'D1', couleur: 'B' }, { yeux: ['C1', 'E1'] }],
      text: 'Trois points en ligne : le milieu, au point vert, fait deux yeux.' },
    { kind: 'info', rows: L_TROIS, geste: { touche: ['D1'], no: 'Touche le point du milieu, entre les deux autres.' },
      demo: [{ pose: 'D1', couleur: 'W' }, { libs: 'D1' }],
      text: 'Touche le point vital. Si Blanc le prend, ton groupe meurt.' },
    { kind: 'move', rows: L_TROIS_TUE, accept: ['D9'],
      text: 'À toi : tue le groupe blanc marqué.',
      ok: 'Point vital ! Blanc ne fera qu’un œil : il est mort.', no: 'Joue au milieu de l’espace blanc.',
      refus: [{ points: ['C9', 'E9'], no: 'À côté du milieu : Blanc y joue et fait deux yeux.' }] },
    { kind: 'move', rows: L_TROIS_VIS, accept: ['J3'],
      text: 'À toi : fais vivre ton groupe marqué.',
      ok: 'Deux yeux, J4 et J2 : ton groupe vit.', no: 'Prends le point du milieu avant Blanc.',
      refus: [{ points: ['J4', 'J2'], no: 'Au bout de l’espace : Blanc prend le milieu, tu meurs.' }] },
    { kind: 'info', rows: L_QUATRE, geste: { pose: 'E1' }, demo: [{ pose: 'D1', couleur: 'W' }, { pose: 'E1', couleur: 'B' }, { libs: 'D1' }],
      text: 'Quatre en ligne : si Blanc entre, réponds au point vert. Tu vis.' },
    { kind: 'quiz', rows: L_DEUX,
      text: 'Deux points seulement. Ce groupe noir peut-il vivre ?', choices: ['Oui, toujours', 'Oui, s’il joue', 'Non, jamais'], answer: 2,
      ok: 'Deux points ne font qu’un œil : ce groupe est mort.', no: 'Même si Noir joue le premier, il ne fait qu’un œil.' }
  ] },
  { id: 'l14', title: 'Le seki', desc: 'Vivre ensemble, sans yeux', steps: [
    { kind: 'info', rows: L_SEKI, geste: { touche: ['C1', 'E1'], no: 'Touche un point vide entre les pierres.' },
      demo: [{ libs: 'C2' }, { libs: 'B2' }],
      text: 'Seki (vie commune) : aucun œil, deux libertés partagées. Touches-en une.' },
    { kind: 'info', rows: L_SEKI, geste: { pose: 'C1' }, demo: [{ pose: 'C1', couleur: 'B' }, { pose: 'E1', couleur: 'W' }],
      text: 'Remplis au point vert : tu te mets en atari. Blanc prend tout.' },
    { kind: 'info', rows: L_SEKI, geste: { pose: 'E1' }, demo: [{ pose: 'C1', couleur: 'W' }, { pose: 'E1', couleur: 'B' }],
      text: 'Si Blanc remplit C1, c’est lui qui meurt. Prends au point vert.' },
    { kind: 'quiz', rows: L_SEKI,
      text: 'Personne ne joue ici. À qui sont C1 et E1 ?', choices: ['À Noir', 'À Blanc', 'À personne'], answer: 2,
      ok: 'À personne : en seki, ces points ne comptent pas.', no: 'Ni Noir ni Blanc ne peut les remplir sans mourir.' },
    { kind: 'move', rows: L_SEKI_Q, accept: ['E2'],
      text: 'À toi : sauve tes pierres marquées par un seki.',
      ok: 'Deux libertés partagées : personne ne peut attaquer. C’est seki.', no: 'Garde deux libertés partagées avec Blanc.',
      refus: [{ points: ['C1', 'E1'], no: 'Là, tu te mets en atari : Blanc prend.' }] }
  ] },
  { id: 'l15', title: 'Finir la partie', desc: 'Dame, frontières, pierres mortes', steps: [
    { kind: 'info', rows: L_FIN_P, geste: { touche: ['E7'], no: 'Cherche le point vide entre Noir et Blanc.' }, demo: [{ zone: ['E7'] }],
      text: 'Dame (point neutre) : il touche Noir et Blanc. Touche-le.' },
    { kind: 'info', rows: L_FIN_P, geste: { pose: 'E7' }, demo: [{ pose: 'E7', couleur: 'B' }],
      text: 'Remplis-la au point vert : aucun point gagné, aucun perdu.' },
    { kind: 'move', rows: L_FIN_TROU, accept: ['E8'],
      text: 'Avant de passer : une frontière est ouverte. Ferme-la.',
      ok: 'Fermée au contact de Blanc : tous tes points comptent.', no: 'Cherche le trou entre ton territoire et Blanc.',
      refus: [{ points: ['D8'], no: 'Fermée, mais tu perds D8 : ferme au contact de Blanc.' }] },
    { kind: 'info', rows: L_FIN_P, geste: { touche: ['B2'], no: 'Cherche la pierre blanche, en bas à gauche.' }, demo: [{ libs: 'B2' }],
      text: 'Pierre morte : elle ne peut plus vivre. Touche-la, chez toi.' },
    { kind: 'quiz', rows: L_FIN_P,
      text: 'Faut-il capturer B2 avant de passer ?', choices: ['Oui', 'Non, je passe'], answer: 1,
      ok: 'Elle est morte : on la retire à la fin, comme un prisonnier.', no: 'Chaque coup chez toi coûte un point. Elle est déjà morte.' },
    { kind: 'quiz', rows: L_FIN_SANS, terr: true, compte: { pour: 'B', komi: 6.5, prises: [1, 0] },
      text: 'B2 retirée devient prisonnière. Combien de points pour Noir ?', choices: ['26', '27', '28'], answer: 1,
      ok: '26 de territoire + 1 prisonnier = 27.', no: 'Compte le territoire colorié, puis ajoute la prisonnière.' }
  ] },
  { id: 'l16', title: 'Compter une partie', desc: 'Mortes, territoire, prisonniers, komi', steps: [
    { kind: 'info', rows: L_COMPTE_P, geste: { touche: ['H8'], no: 'Cherche une pierre noire seule chez Blanc.' }, demo: [{ libs: 'H8' }],
      text: 'Fin de partie. Touche ta pierre morte, chez Blanc.' },
    { kind: 'touche', rows: L_COMPTE_P, accept: ['B2'],
      text: 'À toi : touche la pierre blanche morte.',
      ok: 'Oui : on retire les deux mortes. Chacune devient prisonnière.', no: 'Cherche une pierre blanche seule chez Noir.' },
    { kind: 'info', rows: L_COMPTE_SANS, demo: [{ terr: 'B' }, { terr: 'W' }],
      text: 'Mortes retirées. Compte avec moi : 26 points chacun.' },
    { kind: 'quiz', rows: L_COMPTE_SANS, terr: true, compte: { pour: 'B', komi: 6.5, prises: [8, 2] },
      text: 'Noir a 7 prisonniers, plus la morte. Combien de points ?', choices: ['33', '34', '40,5'], answer: 1,
      ok: '26 + 7 + 1 = 34.', no: 'Territoire plus prisonniers, morte comprise. Le komi va à Blanc.' },
    { kind: 'quiz', rows: L_COMPTE_SANS, terr: true, compte: { pour: 'W', komi: 6.5, prises: [8, 2] },
      text: 'Blanc a 1 prisonnier, plus la morte. Avec le komi ?', choices: ['28', '32,5', '34,5'], answer: 2,
      ok: '26 + 1 + 1 + 6,5 = 34,5.', no: 'Territoire, prisonniers, morte, puis le komi (6,5).' },
    { kind: 'quiz', rows: L_COMPTE_SANS,
      text: 'Noir 34, Blanc 34,5. Qui gagne ?', choices: ['Noir', 'Blanc', 'Égalité'], answer: 1,
      ok: 'Blanc, d’un demi-point. Le demi-point du komi évite les égalités.', no: '34,5 est plus grand que 34.' }
  ] }
];
