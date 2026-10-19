// #673 : positions d'erreur dont la bonne explication est connue, et vraies parties, pour éprouver le générateur
// (src/go/explication.ts) avec le vrai KataGo. Les analyses sont figées dans src/go/explications-katago.json par
// outils/explicationsKataGo.ts et relues sans le réseau par src/go/explication-katago.test.ts.
import type { Fait } from './explication';

export interface CasConnu {
  id: string;
  /** Ce que montre la position, en une phrase (pour le relecteur). */
  titre: string;
  /** Plateau, de la ligne du haut (9) à celle du bas (1) : X noir, O blanc. */
  rows: string[];
  trait: 1 | 2;
  /** Le coup d'erreur (étiquette), -1 : passe. */
  joue: string;
  /** Raisons acceptées en premier : la vraie raison, dite d'une ou l'autre façon. Vide : position ambiguë. */
  attendu: Fait['type'][];
  /** Raisons interdites : elles seraient fausses ici. */
  interdit?: Fait['type'][];
}

export const CAS_CONNUS: CasConnu[] = [
  {
    id: 'atari-ignore',
    titre: 'Noir D6-D5 en atari (seule liberté D4) ; Noir joue ailleurs en G7, Blanc prend 2 pierres en D4.',
    rows: [
      '.........',
      '.........',
      '...O.....',
      '..OXO....',
      '..OXO....',
      '.........',
      '..X...X..',
      '.........',
      '.........',
    ],
    trait: 1, joue: 'G7', attendu: ['pierresPerdues'],
  },
  {
    id: 'capture-ratee',
    titre: 'Blanc D5 coupe les pierres noires mais n’a qu’une liberté (D4) ; Noir joue H2 au lieu de le prendre en D4.',
    rows: [
      '.........',
      '.........',
      '......O..',
      '...X.....',
      '..XOX....',
      '..O.O....',
      '......X..',
      '.........',
      '.........',
    ],
    trait: 1, joue: 'H2', attendu: ['priseManquee'],
  },
  {
    id: 'territoire',
    titre: 'Ouverture : le coin en bas à gauche est libre ; Noir joue A9, un coup du premier rang sans valeur.',
    rows: [
      '.........',
      '.........',
      '..X...X..',
      '.........',
      '....O....',
      '.........',
      '......O..',
      '.........',
      '.........',
    ],
    trait: 1, joue: 'A9', attendu: ['territoire'], interdit: ['pierresPerdues', 'priseManquee', 'groupe', 'groupeTue', 'coupe'],
  },
  {
    id: 'coupe',
    titre: 'Noir C5 et D4 se touchent en diagonale, Blanc D5 est déjà là : C4 coupe (et met C5 en atari). Noir joue ailleurs (H8) ; Blanc coupe en C4.',
    rows: [
      '.........',
      '.........',
      '......X..',
      '..O.O....',
      '..XO.....',
      '...X.O...',
      '......X..',
      '.........',
      '.........',
    ],
    trait: 1, joue: 'H8', attendu: ['coupe', 'groupe', 'pierresPerdues'], interdit: ['priseManquee'],
  },
  {
    id: 'ouverture-ambigue',
    titre: 'Ouverture équilibrée : Noir joue C7, un coup raisonnable mais un peu moins bon que celui de KataGo.',
    rows: [
      '.........',
      '.........',
      '.........',
      '.........',
      '....X....',
      '.........',
      '..O......',
      '.........',
      '.........',
    ],
    trait: 1, joue: 'C7', attendu: [], interdit: ['pierresPerdues', 'priseManquee', 'groupe', 'groupeTue', 'coupe'],
  },
];

/** Vraies parties de la relecture (#673). */
export const PARTIES_RELUES = {
  /** Partie entre amis de Florian (#424), 9 × 9, komi 6,5 : src/app/partie424.fixture.ts. */
  'florian-424': null,
  /** Partie en ligne de Florian (florian_go contre Takumi88), reprise de e2e/audit-visuel.spec.ts. */
  'florian-takumi': '(;GM[1]FF[4]SZ[9]KM[6.5]PB[florian_go]PW[Takumi88]RE[B+R];B[ee];W[cc];B[gc];W[ce];B[eg];W[cg];B[gg];W[dd];B[ed];W[ec];B[fc];W[eb];B[fb];W[dc];B[de];W[cd];B[df];W[cf];B[dg];W[dh];B[eh];W[ch])',
} as const;
