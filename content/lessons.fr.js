// Six leçons interactives, positions vérifiées par un lecteur tactique.
// rows : plateau 9 × 9 ligne par ligne depuis le haut. X noir, O blanc, T pierre blanche visée, S pierre noire à sauver.
// Coordonnées : lettres A à J sans I, lignes numérotées depuis le bas. accept: 'line3' = tout coup hors des deux premières lignes.
const L_CAP1 = ['.........', '.........', '.........', '...X.....', '..XT.O...', '...X.....', '.........', '.........', '.........'];
// Leçons v2 (issue #101) : `demo` joue la position temps par temps ; une idée par étape, 12 mots au plus.
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
export const LESSONS = [
  { id: 'l1', title: 'Libertés et capture', desc: 'La règle qui fait tout le jeu', steps: [
    { kind: 'info', rows: V, demo: [{ pose: 'E5', couleur: 'W' }, { libs: 'E5' }],
      text: "Les points vides autour d'une pierre : ses libertés." },
    { kind: 'info', rows: ['.........', '.........', '.........', '.........', '....O....', '.........', '.........', '.........', '.........'], demo: [{ pose: 'A1', couleur: 'W' }, { libs: 'A1' }],
      text: 'Dans le coin, deux libertés seulement.' },
    { kind: 'info', rows: ['.........', '.........', '.........', '.........', '...O.O...', '.........', '.........', '.........', '.........'],
      demo: [{ libs: 'D5' }, { pose: 'D6', couleur: 'B' }, { pose: 'C5', couleur: 'B' }, { pose: 'D4', couleur: 'B' }],
      text: "Noir bouche les libertés. Plus qu'une : c'est l'atari." },
    { kind: 'move', rows: L_CAP1, accept: ['E5'], text: 'Joue sur la dernière liberté pour capturer.',
      ok: 'Capturée ! Sans liberté, la pierre quitte le plateau.', no: 'Cherche le seul point vide à côté de la pierre marquée.' },
    { kind: 'info', rows: L_GROUPE, demo: [{ libs: 'D5' }],
      text: 'Des pierres collées forment un groupe : libertés partagées.' },
    { kind: 'move', rows: L_GROUPE, accept: ['E4'], text: "Capture les deux pierres d'un coup.",
      ok: 'Deux prisonniers ! Un groupe vit ou meurt ensemble.', no: "Le groupe n'a qu'une liberté : trouve-la." }
  ] },
  { id: 'l2', title: 'Atari : attaquer et se sauver', desc: "Quand il ne reste qu'une liberté", steps: [
    { kind: 'info', rows: ['.........', '.........', '.........', '....X....', '...XO....', '.........', '.........', '.........', '.........'], demo: [{ libs: 'E5' }, { pose: 'E4', couleur: 'B' }],
      text: "Plus qu'une liberté : la pierre est en atari." },
    { kind: 'info', rows: L_ATARI, demo: [{ pose: 'F5', couleur: 'B' }],
      text: 'Si Blanc ne fait rien, Noir la capture.' },
    { kind: 'info', rows: ['.........', '.........', '.........', '.....O...', '....OXO..', '....X.O..', '.........', '.........', '.........'], demo: [{ libs: 'F5' }, { pose: 'F4', couleur: 'B' }],
      text: 'En atari ? Allonge-toi : tes libertés remontent.' },
    { kind: 'move', rows: ['.........', '.........', '.........', '...O.....', '..OSO....', '..O.X....', '.........', '.........', '.........'], accept: ['D4'], libs: ['D4'],
      text: 'À toi. Allonge ta pierre marquée sur sa liberté.',
      ok: 'Trois libertés : ta pierre est sauvée.', no: 'Joue sur le point vert, à côté de ta pierre.' },
    { kind: 'info', rows: L_CONTRE, demo: [{ libs: 'E5' }, { pose: 'E6', couleur: 'B' }],
      text: "Ici, s'allonger ne suffit pas : toujours une liberté." },
    { kind: 'move', rows: L_CONTRE_Q, accept: ['F6'],
      text: 'Sauve ta pierre autrement : une pierre blanche est en atari.',
      ok: 'Capturer F5 libère ta pierre. Attaquer, c’est aussi défendre.', no: "Cherche la pierre blanche qui n'a qu'une liberté." }
  ] },
  { id: 'l3', title: 'Techniques de capture', desc: 'Double atari, bord et échelle', steps: [
    { kind: 'info', rows: L_DOUBLE, demo: [{ pose: 'E5', couleur: 'B' }, { atari: ['D5', 'F5'] }],
      text: 'Un coup, deux pierres en atari : le double atari.' },
    { kind: 'info', rows: L_DOUBLE, avant: [{ pose: 'E5', couleur: 'B' }], demo: [{ pose: 'D4', couleur: 'W' }, { pose: 'F4', couleur: 'B' }],
      text: "Blanc en sauve une, Noir prend l'autre." },
    { kind: 'move', rows: ['.........', '.........', '.........', '.........', '..XT.TX..', '...X.X...', '.........', '.........', '.........'], accept: ['E5'], libs: ['D6', 'E5', 'F6'],
      text: 'À toi : trouve le double atari.',
      ok: "Blanc ne peut en sauver qu'une : tu prends l'autre.", no: 'Cherche le point vert commun aux deux pierres.' },
    { kind: 'info', rows: ['.........', '.........', '.........', '.........', '.........', '.........', '.........', '.XOX.....', '.........'],
      demo: [{ pose: 'C3', couleur: 'B' }, { libs: 'C2' }, { pose: 'C1', couleur: 'W' }, { pose: 'B1', couleur: 'B' }, { pose: 'D1', couleur: 'W' }, { pose: 'E1', couleur: 'B' }],
      text: 'Atari vers le bord : elle fuit, et meurt quand même.' },
    { kind: 'move', rows: ['.........', '.........', '.........', '.........', '.........', '.........', '.........', '...XTX...', '.........'], accept: ['E3'],
      text: 'À toi : pousse la pierre marquée vers le bord.',
      ok: "Contre le bord, elle n'a plus d'issue.", no: "De ce côté, elle s'échappe vers le centre." },
    { kind: 'info', rows: L_ECHELLE, demo: ECHELLE_1,
      text: "L'échelle : atari, fuite, atari. Jamais plus de deux libertés." },
    { kind: 'info', rows: L_ECHELLE, avant: ECHELLE_1, demo: ECHELLE_2,
      text: "Elle fuit en zigzag jusqu'au bord, puis tombe." },
    { kind: 'move', rows: ['.........', '.........', '.........', '....X....', '...XT....', '.....X...', '.........', '.........', '.........'], accept: ['F5', 'E4'],
      text: "À toi : lance l'échelle sur la pierre marquée.",
      ok: "Elle fuira en zigzag jusqu'au bord. Une pierre blanche sur le chemin la sauverait.", no: 'Joue du côté où ta pierre F4 bloque la fuite.' }
  ] },
  { id: 'l4', title: 'Le ko', desc: 'La règle qui empêche de tourner en rond', steps: [
    { kind: 'info', rows: L_KO, demo: [{ pose: 'D5', couleur: 'B' }, { libs: 'D5' }],
      text: 'Noir capture. Sa pierre est aussitôt en atari.' },
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
    { kind: 'info', rows: L_YEUX, demo: [{ yeux: ['A1'] }, { yeux: ['C1'] }],
      text: 'Un œil : un point vide entouré par un seul groupe.' },
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
  ] }
];
