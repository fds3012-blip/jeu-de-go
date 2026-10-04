// Problèmes locaux complets, dans la langue de l'interface (#433) : hors du JS initial. L'accueil n'en lit que le
// Go du jour, par sa version légère (src/app/goDuJour.ts, problemeDuJour) ; le placement et la série de fin de
// leçon chargent cette liste avec leur écran.
import { ALL_PUZZLES } from './puzzles';
import { parsePuzzles } from '../data/puzzles';

export const PROBLEMES_LOCAUX = parsePuzzles(ALL_PUZZLES);
