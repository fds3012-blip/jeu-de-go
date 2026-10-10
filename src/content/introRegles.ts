// Introduction interactive des règles (#523) : 8 écrans très courts sur un petit plateau (7 × 7), un geste et une phrase
// chacun. Même format d'étapes que les leçons (content/lessons.fr.js), joué par le même lecteur (src/app/Lecon.tsx) :
// pas de nouveau moteur. Textes : clés `intro.*` de src/content/i18n (français et anglais).
//
// RÈGLE D'OR : chaque position, chaque geste accepté, chaque refus et chaque chiffre des phrases est rejoué avec le moteur
// de règles (src/go) par src/go/introRegles.test.ts : libertés, captures, suicide interdit, ko interdit, score.
//
// Coordonnées : lettres A à G, lignes numérotées depuis le bas (A1 en bas à gauche). `rows` : de haut en bas.
// X noir, O blanc, T pierre blanche visée, S pierre noire à sauver (même légende que les leçons).
import type { Lesson, LessonStep } from './lessons';
import type { VersionIntro } from '../app/connaitGo';
import { t } from './i18n/secondaires';

const VIDE = Array<string>(7).fill('.......');

/** Positions de l'introduction, une par écran (la dernière sert au territoire et au compte). */
export const POSITIONS = {
  poser: VIDE,
  libertes: ['.......', '.......', '.......', '...X...', '.......', '.......', '.......'],
  capturer: ['.......', '.......', '...X...', '..XTX..', '.......', '.......', '.......'],
  atari: ['.......', '.......', '...O...', '..OSO..', '.......', '.......', '.......'],
  // A1 : suicide (ni liberté ni capture). G5 : sans liberté non plus, mais il capture G6 et G4 : permis.
  suicide: ['......X', '.....XT', '.....O.', '.....XT', '......X', 'O......', '.O.....'],
  // C4 prend D4 ; Blanc ne peut pas reprendre en D4 tout de suite (ko).
  ko: ['.......', '.......', '..OX...', '.O.TX..', '..OX...', '.......', '.......'],
  // Partie finie : mur noir en D, mur blanc en E. Territoire noir A à C (21 points), blanc F et G (14 points).
  fin: Array<string>(7).fill('...XO..'),
};

/** Les quatre libertés de la pierre D4 (écran « libertés »). */
export const LIBERTES_D4 = ['D5', 'C4', 'E4', 'D3'];
/** Le territoire noir de la position finale : colonnes A, B et C. */
export const TERRITOIRE_NOIR = ['A', 'B', 'C'].flatMap(c => [1, 2, 3, 4, 5, 6, 7].map(n => `${c}${n}`));
/** Prisonniers de la position finale, et komi (le même que dans une partie normale). */
export const PRISONNIERS = { noir: 2, blanc: 1 };
export const KOMI_INTRO = 6.5;

/** Notions, dans l'ordre des écrans : leur clé de texte est `intro.<lettre>.*`. */
export const NOTIONS = ['poser', 'libertes', 'capturer', 'atari', 'suicide', 'ko', 'territoire', 'fin'] as const;
type Lettre = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h';

/** Texte d'une clé `intro.*` (toutes sans variable). */
const texte = (cle: string) => (t as unknown as (c: string) => string)(cle);

/**
 * Étapes de l'introduction. Version express (« Un peu ») : mêmes positions et mêmes gestes, consignes plus courtes ;
 * chaque écran se passe aussi d'un toucher « Je sais » (src/app/IntroRegles.tsx).
 */
export function etapesIntro(version: VersionIntro): LessonStep[] {
  const consigne = (l: Lettre) => texte(`intro.${l}.${version === 'express' ? 'court' : 'texte'}`);
  return [
    { kind: 'info', rows: POSITIONS.poser, demo: [{ pose: 'D4', couleur: 'B' }, { pose: 'E5', couleur: 'W' }], geste: { pose: 'D4' }, text: consigne('a') },
    { kind: 'info', rows: POSITIONS.libertes, demo: [{ libs: 'D4' }], geste: { touche: LIBERTES_D4, no: texte('intro.b.no') }, text: consigne('b') },
    { kind: 'move', rows: POSITIONS.capturer, accept: ['D3'], text: consigne('c'), ok: texte('intro.c.ok'), no: texte('intro.c.no') },
    { kind: 'move', rows: POSITIONS.atari, accept: ['D3'], text: consigne('d'), ok: texte('intro.d.ok'), no: texte('intro.d.no') },
    { kind: 'move', rows: POSITIONS.suicide, accept: ['G5'], text: consigne('e'), ok: texte('intro.e.ok'), no: texte('intro.e.no'),
      refus: [{ points: ['A1'], no: texte('intro.e.refus') }] },
    { kind: 'info', rows: POSITIONS.ko, demo: [{ pose: 'C4', couleur: 'B' }, { interdit: 'D4', couleur: 'W' }], geste: { pose: 'C4' }, text: consigne('f') },
    { kind: 'info', rows: POSITIONS.fin, demo: [{ terr: 'B' }], geste: { touche: TERRITOIRE_NOIR, no: texte('intro.g.no') }, text: consigne('g') },
    { kind: 'quiz', rows: POSITIONS.fin, terr: true, choices: [texte('intro.h.noir'), texte('intro.h.blanc')], answer: 0,
      text: consigne('h'), ok: texte('intro.h.ok'), no: texte('intro.h.no') },
  ];
}

/** L'introduction, sous forme de leçon hors du chemin (jouée par le lecteur des leçons). */
export function leconIntro(version: VersionIntro): Lesson {
  return {
    id: version === 'express' ? 'intro-express' : 'intro-regles',
    title: texte(version === 'express' ? 'intro.titreExpress' : 'intro.titre'),
    desc: '',
    steps: etapesIntro(version),
  };
}
