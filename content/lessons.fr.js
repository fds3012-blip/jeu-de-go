// Six leçons interactives, positions vérifiées par un lecteur tactique.
// rows : plateau 9 × 9 ligne par ligne depuis le haut. X noir, O blanc, T pierre blanche visée, S pierre noire à sauver.
// Coordonnées : lettres A à J sans I, lignes numérotées depuis le bas. accept: 'line3' = tout coup hors des deux premières lignes.
const L_CAP1 = ['.........', '.........', '.........', '...X.....', '..XT.O...', '...X.....', '.........', '.........', '.........'];
export const LESSONS = [
  { id: 'l1', title: 'Libertés et capture', desc: 'La règle qui fait tout le jeu', steps: [
    { kind: 'info', rows: ['.........', '.........', '.........', '.........', '....O....', '.........', '.........', '.........', 'O........'], libs: ['E6', 'D5', 'F5', 'E4', 'A2', 'B1'],
      text: "Les pierres se posent sur les intersections et ne bougent plus. Les intersections vides juste à côté d'une pierre sont ses libertés (points verts) : quatre au centre, deux seulement dans un coin." },
    { kind: 'move', rows: L_CAP1, accept: ['E5'], text: "La pierre blanche marquée n'a plus qu'une liberté. Joue dessus pour la capturer.",
      ok: "Capturée ! Une pierre qui perd sa dernière liberté est retirée du plateau et compte comme prisonnier.", no: "Pas là : cherche la seule intersection vide à côté de la pierre marquée." },
    { kind: 'move', rows: ['.........', '.........', '.........', '...XX....', '..XTTX...', '...X.....', '....O....', '.........', '.........'], accept: ['E4'],
      text: "Des pierres collées forment un groupe : elles partagent leurs libertés. Capture les deux pierres blanches d'un coup.",
      ok: "Deux prisonniers d'un coup. Un groupe vit ou meurt ensemble.", no: "Le groupe blanc n'a qu'une liberté : trouve-la. Si tu attends, Blanc se relie à sa pierre en E3." }
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
    { kind: 'info', rows: ['.........', '.........', '.........', '.........', '.........', '.........', 'OOOOOO...', 'XXXXXO...', '.X.XXO...'], libs: ['A1', 'C1'],
      text: "Ce groupe noir a deux yeux, en A1 et C1. Blanc ne peut jouer dans aucun des deux : ce serait se suicider. Un groupe avec deux vrais yeux est vivant pour toujours." },
    { kind: 'move', rows: ['.........', '.........', '.........', '.........', '.........', '.........', 'OOOOO....', 'SXXXO....', '...XO....'], accept: ['B1'],
      text: 'Ton groupe marqué est entouré. Fais-lui deux yeux en un seul coup.',
      ok: 'En B1, tu coupes ton espace en deux yeux séparés, A1 et C1 : ton groupe est vivant.', no: "Avec un seul œil, ton groupe mourrait. Joue au milieu de l'espace libre." },
    { kind: 'move', rows: ['.........', '.........', '.........', '.........', '.........', '.........', 'XXXXX....', 'TOOOX....', '...OX....'], accept: ['B1'],
      text: "À l'inverse, empêche le groupe blanc de faire deux yeux.",
      ok: "C'est le point vital : Blanc ne peut plus faire qu'un œil, son groupe est mort.", no: 'Blanc jouerait au milieu et vivrait. Prends ce point avant lui.' }
  ] },
  { id: 'l6', title: 'Territoire et ouverture', desc: 'Compter et bien commencer', steps: [
    { kind: 'quiz', rows: ['...XO....', '...XO....', '...XO....', '...XO....', '...XO....', '...XO....', '...XO....', '...XO....', '...XO....'], terr: true,
      text: 'La partie est finie. Combien de points de territoire pour Noir (les intersections vides entourées par Noir) ?',
      choices: ['18', '27', '36'], answer: 1, ok: "27 : trois colonnes de neuf. Blanc en a 36, plus le komi : il gagne largement.", no: 'Compte les intersections vides du côté noir : trois colonnes de neuf.' },
    { kind: 'info', rows: ['.........', '.........', '..X...O..', '.........', '.........', '.........', '..O...X..', '.........', '.........'],
      text: "En ouverture, on joue d'abord dans les coins, puis sur les bords, et enfin au centre : les bords et les coins aident à entourer du territoire avec moins de pierres." },
    { kind: 'move', rows: ['.........', '.........', '.........', '.........', '.........', '.........', '.........', '.........', '.........'], accept: 'line3',
      text: 'À toi de jouer le premier coup de la partie. Évite les deux lignes du bord.',
      ok: 'Bon premier coup : assez loin du bord pour construire, assez proche pour entourer du territoire.', no: 'Trop près du bord : une pierre sur les deux premières lignes entoure très peu. Rapproche-toi du centre.' }
  ] }
];
