// Introduction interactive des règles (#523, v2 #710) : 8 écrans très courts sur un petit plateau (7 × 7), un geste et une phrase
// chacun (l'écran se décrit toujours tel qu'il est : avant, à toi, après). Même format d'étapes que les leçons (content/lessons.fr.js), joué par le même lecteur (src/app/Lecon.tsx) :
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
const LETTRES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
type Lettre = typeof LETTRES[number];

/** Texte d'une clé `intro.*` (toutes sans variable). */
const texte = (cle: string) => (t as unknown as (c: string) => string)(cle);

/** Le mot du go que chaque écran enseigne (#710), en étiquette au-dessus de Mochi : `intro.<lettre>.mot`. */
export const motsIntro = (): string[] => LETTRES.map(l => texte(`intro.${l}.mot`));

/**
 * Étapes de l'introduction. Version express (« Un peu ») : mêmes positions et mêmes gestes, phrases plus courtes ;
 * chaque écran se passe aussi d'un toucher « Je sais » (src/app/IntroRegles.tsx).
 *
 * Principe (#710) : expliquer, puis faire, et la bulle décrit toujours l'écran tel qu'il est.
 * - `text` : avant le geste ; `demande` (geste `apres`) : une fois la démonstration finie, la demande ; `fait` : une fois
 *   le geste réussi. Un `fait` ne reprend jamais la consigne d'avant (src/go/introRegles.test.ts).
 * - `confirmer` : « Confirmer au doigt » est actif, la pose se fait en deux touches ; l'écran de la pose le dit.
 */
export function etapesIntro(version: VersionIntro, confirmer = true): LessonStep[] {
  const express = version === 'express';
  /** `texte` / `court`, `fait` / `faitCourt`, `demande` / `demandeCourt`. */
  const dit = (l: Lettre, champ: 'texte' | 'fait' | 'demande') =>
    texte(`intro.${l}.${express ? (champ === 'texte' ? 'court' : `${champ}Court`) : champ}`);
  const pose = texte(`intro.a.${express ? 'court' : 'texte'}${confirmer ? '' : 'Direct'}`);
  return [
    { kind: 'info', rows: POSITIONS.poser, demo: [{ pose: 'D4', couleur: 'B' }, { pose: 'E5', couleur: 'W' }], geste: { pose: 'D4' }, text: pose, fait: dit('a', 'fait') },
    { kind: 'info', rows: POSITIONS.libertes, demo: [{ libs: 'D4' }],
      geste: { touche: LIBERTES_D4, no: texte('intro.b.no'), apres: true, demande: dit('b', 'demande') }, text: dit('b', 'texte'), fait: dit('b', 'fait') },
    { kind: 'move', rows: POSITIONS.capturer, accept: ['D3'], libs: ['D3'], text: dit('c', 'texte'), ok: texte('intro.c.ok'), no: texte('intro.c.no') },
    { kind: 'move', rows: POSITIONS.atari, accept: ['D3'], text: dit('d', 'texte'), ok: texte('intro.d.ok'), no: texte('intro.d.no') },
    { kind: 'move', rows: POSITIONS.suicide, accept: ['G5'], text: dit('e', 'texte'), ok: texte('intro.e.ok'), no: texte('intro.e.no'),
      refus: [{ points: ['A1'], no: texte('intro.e.refus') }] },
    { kind: 'info', rows: POSITIONS.ko, demo: [{ pose: 'C4', couleur: 'B' }, { interdit: 'D4', couleur: 'W' }], geste: { pose: 'C4' }, text: dit('f', 'texte'), fait: dit('f', 'fait') },
    { kind: 'info', rows: POSITIONS.fin, demo: [{ terr: 'B' }],
      geste: { touche: TERRITOIRE_NOIR, no: texte('intro.g.no'), apres: true, demande: dit('g', 'demande') }, text: dit('g', 'texte'), fait: dit('g', 'fait') },
    { kind: 'quiz', rows: POSITIONS.fin, terr: true, choices: [texte('intro.h.noir'), texte('intro.h.blanc')], answer: 0,
      text: dit('h', 'texte'), ok: texte('intro.h.ok'), no: texte('intro.h.no') },
  ];
}

/** L'introduction, sous forme de leçon hors du chemin (jouée par le lecteur des leçons). */
export function leconIntro(version: VersionIntro, confirmer = true): Lesson {
  return {
    id: version === 'express' ? 'intro-express' : 'intro-regles',
    title: texte(version === 'express' ? 'intro.titreExpress' : 'intro.titre'),
    desc: '',
    steps: etapesIntro(version, confirmer),
  };
}
