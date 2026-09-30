// Tous les textes anglais (#167) réunis dans un seul morceau JS, chargé à la demande par src/content/anglais.ts (#325).
// Aucun autre module de l'app ne doit les importer directement (vérifié par src/content/anglais.test.ts).
import { CHAPITRES_EN, LESSONS_EN } from '../../content/lessons.en.js';
import { en } from './i18n/en';
import type { Catalogue } from './i18n/types';
import type { TexteChapitre, TexteLecon } from './lessons';
import { PROBLEMES_EN, type TexteProbleme } from './problemes.en';

export interface ContenuAnglais {
  ui: Catalogue;
  lecons: Record<string, TexteLecon>;
  chapitres: Record<string, TexteChapitre>;
  problemes: Record<string, TexteProbleme>;
}

export const ANGLAIS: ContenuAnglais = {
  ui: en,
  lecons: LESSONS_EN as Record<string, TexteLecon>,
  chapitres: CHAPITRES_EN as Record<string, TexteChapitre>,
  problemes: PROBLEMES_EN,
};
