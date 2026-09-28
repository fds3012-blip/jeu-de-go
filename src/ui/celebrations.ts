// Issue #236 (N2) : magasin de la file des célébrations (logique pure dans fileFetes.ts).
// Les gains d'XP (xp.ts) y entrent d'eux-mêmes ; les écrans d'exercice se déclarent avec `useExercice`,
// les célébrations lisent leur tour avec `useFile` ou `useTour`.
import { useEffect, useSyncExternalStore } from 'react';
import { abonnerXp } from '../app/xp';
import { ajouter, avancer, exercice, FILE_VIDE, marquerVue, retirer, terminer, type EtatFile, type Fete, type Genre } from './fileFetes';

/** Pause entre la fin d'un exercice et la première fête : l'écran suivant se pose d'abord. */
export const PAUSE_APRES_EXERCICE_MS = 350;

let etat: EtatFile = FILE_VIDE;
let exercices = 0;
let pause: ReturnType<typeof setTimeout> | undefined;
const abonnes = new Set<() => void>();

function poser(e: EtatFile) {
  if (e === etat) return;
  etat = e;
  abonnes.forEach(f => f());
}

function changer(f: (e: EtatFile) => EtatFile) {
  const e = f(etat);
  // Pendant la pause d'après exercice, rien ne se pose : la pause relance `avancer` elle-même.
  poser(pause === undefined ? avancer(e) : e);
}

export function lireFile(): EtatFile { return etat; }
export function abonnerFile(f: () => void): () => void {
  abonnes.add(f);
  return () => { abonnes.delete(f); };
}

export const demanderFete = (f: Fete) => changer(e => ajouter(e, f));
export const terminerFete = (genre?: Genre) => changer(e => terminer(e, genre));
export const retirerFete = (genre: Genre) => changer(e => retirer(e, genre));
export const marquerXpVue = () => poser(marquerVue(etat));

/** Début (+1) ou fin (−1) d'un écran d'exercice. Plusieurs écrans peuvent se passer le relais dans le même rendu. */
export function compterExercice(delta: 1 | -1) {
  exercices = Math.max(0, exercices + delta);
  const enCours = exercices > 0;
  if (enCours) {
    clearTimeout(pause); pause = undefined;
    poser(exercice(etat, true));
    return;
  }
  poser(exercice(etat, false));
  clearTimeout(pause);
  pause = setTimeout(() => { pause = undefined; poser(avancer(etat)); }, PAUSE_APRES_EXERCICE_MS);
}

/** Pour les tests : file vide, aucun exercice. */
export function _reinitialiserFile() {
  clearTimeout(pause); pause = undefined; exercices = 0; poser(FILE_VIDE);
}

// Les gains entrent dans la file : l'XP d'abord, puis le niveau franchi.
if (typeof window !== 'undefined') {
  abonnerXp(g => {
    demanderFete({ genre: 'xp', points: g.points, bonus: g.bonus });
    if (g.niveauApres > g.niveauAvant) demanderFete({ genre: 'niveau', niveau: g.niveauApres });
  });
}

export function useFile(): EtatFile {
  return useSyncExternalStore(abonnerFile, lireFile, lireFile);
}

/** L'écran est un exercice tant que `enCours` : aucune fête ne se pose sur sa consigne. */
export function useExercice(enCours = true) {
  useEffect(() => {
    if (!enCours) return;
    compterExercice(1);
    return () => compterExercice(-1);
  }, [enCours]);
}

/** Demande un tour dans la file tant que `voulu` ; vrai quand c'est son tour. Retiré en quittant l'écran. */
export function useTour(genre: 'installation', voulu: boolean): boolean {
  const file = useFile();
  useEffect(() => {
    if (!voulu) return;
    demanderFete({ genre });
    return () => retirerFete(genre);
  }, [genre, voulu]);
  return voulu && file.actif?.genre === genre;
}
