// Six leçons interactives, positions vérifiées par un lecteur tactique.
// rows : plateau 9 × 9 ligne par ligne depuis le haut. X noir, O blanc, T pierre blanche visée, S pierre noire à sauver.
// Coordonnées : lettres A à J sans I, lignes numérotées depuis le bas. accept: 'line3' = tout coup hors des deux premières lignes.
const L_CAP1 = ['.........', '.........', '.........', '...X.....', '..XT.O...', '...X.....', '.........', '.........', '.........'];
// Leçons v2 (issue #101) : `demo` joue la position temps par temps ; une idée par étape, 12 mots au plus.
const V = ['.........', '.........', '.........', '.........', '.........', '.........', '.........', '.........', '.........'];
const L_GROUPE = ['.........', '.........', '.........', '...XX....', '..XTTX...', '...X.....', '....O....', '.........', '.........'];
const L_YEUX = ['.........', '.........', '.........', '.........', '.........', '.........', 'OOOOOO...', 'XXXXXO...', '.X.XXO...'];
const L_FIN = ['...XO....', '...XO....', '...XO....', '...XO....', '...XO....', '...XO....', '...XO....', '...XO....', '...XO....'];
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
    { kind: 'info', rows: ['.........', '.........', '.........', '....X....', '...XO....', '....X....', '.........', '.........', '.........'], libs: ['F5'],
      text: "Une pierre qui n'a plus qu'une liberté est « en atari » : au prochain coup, elle peut être capturée. Ici, la pierre blanche est en atari, sa dernière liberté est en F5." },
    { kind: 'move', rows: ['.........', '.........', '.........', '...O.....', '..OSO....', '..O.X....', '.........', '.........', '.........'], accept: ['D4'],
      text: 'Ta pierre marquée est en atari. Sauve-la en lui donnant des libertés.',
      ok: 'En D4, ta pierre rejoint E4 : le groupe a de nouveau plusieurs libertés.', no: "Ta pierre n'a qu'une liberté : c'est là qu'il faut s'allonger." },
    { kind: 'move', rows: ['.........', '.........', '....O....', '...O.....', '...OSOX..', '....OX...', '.........', '.........', '.........'], accept: ['F6'],
      text: "Encore en atari, mais s'allonger vers le haut ne suffit pas. Regarde les pierres blanches autour : l'une d'elles est-elle elle-même en danger ?",
      ok: "La pierre blanche en F5 était en atari : la capturer libère ta pierre. Attaquer est parfois la meilleure défense.", no: "S'allonger en E6 laisse ta pierre en atari. Cherche une pierre blanche à capturer." }
  ] },
  { id: 'l3', title: 'Techniques de capture', desc: 'Double atari, bord et échelle', steps: [
    { kind: 'move', rows: ['.........', '.........', '.........', '.........', '..XT.TX..', '...X.X...', '.........', '.........', '.........'], accept: ['E5'],
      text: 'Double atari : un seul coup peut menacer deux pierres à la fois. Trouve-le.',
      ok: "Blanc ne peut sauver qu'une pierre, tu captures l'autre.", no: 'Cherche la liberté que les deux pierres marquées ont en commun.' },
    { kind: 'move', rows: ['.........', '.........', '.........', '.........', '.........', '.........', '.........', '...XTX...', '.........'], accept: ['E3'],
      text: 'Mets la pierre marquée en atari du bon côté : pousse-la vers le bord.',
      ok: "Coincée contre le bord, elle n'a plus d'issue : si elle s'allonge en E1, tu la captures sur la première ligne.", no: "De ce côté, elle s'échappe vers le centre. Pousse-la plutôt vers le bord." },
    { kind: 'move', rows: ['.........', '.........', '.........', '....X....', '...XT....', '.....X...', '.........', '.........', '.........'], accept: ['F5', 'E4'],
      text: "L'échelle : mets la pierre marquée en atari de façon qu'après chaque fuite, il ne lui reste que deux libertés.",
      ok: "C'est l'échelle : elle fuit en zigzag jusqu'au bord et finit capturée. Attention, une pierre blanche sur son chemin la sauverait.", no: 'Joue sur une de ses deux libertés, du côté où ta pierre en F4 bloque la fuite.' }
  ] },
  { id: 'l4', title: 'Le ko', desc: 'La règle qui empêche de tourner en rond', steps: [
    { kind: 'move', rows: ['.........', '.........', '.........', '....XO...', '...XT.O..', '....XO...', '.........', '.........', '.........'], accept: ['F5'],
      text: 'Capture la pierre blanche marquée.',
      ok: "Bien joué. Mais regarde ta pierre en F5 : elle aussi n'a plus qu'une liberté, en E5.", no: "La pierre marquée n'a qu'une liberté : c'est là." },
    { kind: 'info', rows: ['.........', '.........', '.........', '....XO...', '...X.XO..', '....XO...', '.........', '.........', '.........'], libs: ['E5'],
      text: "C'est un ko : si Blanc reprenait tout de suite en E5, la position se répéterait à l'infini. La règle l'interdit : Blanc doit d'abord jouer ailleurs, souvent une menace qui t'oblige à répondre, avant de pouvoir reprendre." }
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
