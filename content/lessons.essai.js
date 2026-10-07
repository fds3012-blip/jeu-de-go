// Leçons d'essai des grands plateaux (#454) : internes, hors du chemin des leçons et de l'index.
// Elles ne s'ouvrent que dans un build de test ou de développement, par `?lecon-essai=13` ou `?lecon-essai=19`
// (src/app/App.tsx), et servent à vérifier le lecteur sur 13 × 13 (plateau entier et coin cadré) et sur 19 × 19 cadré.
// Positions et réponses vérifiées par src/content/grandsPlateaux.test.ts. Format : docs/architecture/lecons-grands-plateaux.md.
import { plateau } from './plateau.js';

const AUTRES_COINS_19 = ['Q16', 'Q4', 'D16'];

export const LECONS_ESSAI = [
  {
    id: 'essai-13', title: 'Essai : le 13 × 13', desc: 'Leçon interne du lecteur', taille: 13,
    steps: [
      { kind: 'info', rows: plateau(13), demo: [{ pose: 'D4', couleur: 'B' }, { pose: 'K10', couleur: 'W' }], geste: { pose: 'D4' },
        text: 'Sur 13 × 13, on commence par un coin. Pose ta pierre au point vert.' },
      { kind: 'move', rows: plateau(13, { X: ['D4'], O: ['K10'] }), accept: ['C11', 'D11', 'C10', 'D10', 'L3', 'K3', 'L4', 'K4'],
        text: 'À toi : prends un autre coin libre.', ok: 'Oui : un coin se garde avec peu de pierres.',
        no: 'Vise un coin vide, sur la 3e ou la 4e ligne.' },
      { kind: 'touche', rows: plateau(13, { O: ['K10'] }), cadre: 'bas-gauche', accept: ['D4'],
        text: 'Touche le point étoile (hoshi) de ce coin.', ok: 'Oui : D4. Le hoshi sert de repère.',
        no: 'Cherche le petit point noir dessiné sur le bois.' },
    ],
  },
  {
    id: 'essai-19', title: 'Essai : un coin du 19 × 19', desc: 'Leçon interne du lecteur', taille: 19,
    steps: [
      { kind: 'info', rows: plateau(19, { O: AUTRES_COINS_19 }), cadre: 'bas-gauche', demo: [{ pose: 'D4', couleur: 'B' }], geste: { pose: 'D4' },
        text: 'Sur 19 × 19, on regarde un coin. Pose ta pierre au point vert.' },
      { kind: 'touche', rows: plateau(19, { X: ['D4'], O: AUTRES_COINS_19 }), cadre: 'bas-gauche', accept: ['C3'],
        text: 'Touche le point 3-3 : 3e ligne depuis chaque bord.', ok: 'Oui : le 3-3 prend le coin tout de suite.',
        no: 'Compte trois lignes depuis chaque bord.' },
      { kind: 'move', rows: plateau(19, { O: AUTRES_COINS_19 }), cadre: { coin: 'bas-gauche', cote: 9 }, accept: ['C4', 'D3'],
        text: 'Pose une pierre au 3-4 : 3e ligne d’un bord, 4e de l’autre.', ok: 'Oui : le 3-4 vise un côté.',
        no: 'Le 3-4 : 3e ligne d’un bord, 4e ligne de l’autre.' },
      { kind: 'quiz', rows: plateau(19, { O: ['Q16'] }), cadre: 'bas-gauche',
        text: 'Combien de points étoiles (hoshi) vois-tu ici ?', choices: ['2', '4', '9'], answer: 1,
        ok: 'Oui : quatre repères dans ce coin.', no: 'Compte les petits points noirs du bois.' },
      { kind: 'info', rows: plateau(19, { O: ['Q16'] }), cadre: 'haut-droite', demo: [{ libs: 'Q16' }],
        text: 'Même sur 19 × 19, une pierre seule a 4 libertés.' },
      { kind: 'info', rows: plateau(19, { X: ['D4', 'Q16'], O: ['Q4', 'D16'] }),
        text: 'Le plateau entier : les coins d’abord, puis les bords.' },
    ],
  },
];
