// Huit leçons interactives, positions vérifiées par un lecteur tactique.
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
export const CHAPITRES = [
  { id: 'c1', titre: 'Les bases', intro: 'Sept leçons courtes pour jouer ta première partie.', fin: 'Tu connais les règles du go.', lecons: ['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7'] },
  // Chapitre en cours d'écriture (`complet: false`) : sa dernière leçon ne ferme pas encore le chapitre.
  { id: 'c2', titre: 'Ouverture sur 9\u00A0×\u00A09', intro: 'Où poser tes premières pierres.', lecons: ['l8'], complet: false }
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
  ] }
];
