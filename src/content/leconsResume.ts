/**
 * Leçons et chapitres vus de l'accueil (#16, budget du chargement initial) : titre, description et nombre d'étapes.
 * Le contenu complet des leçons (src/content/lessons.ts, content/lessons.fr.js) n'est chargé qu'avec les écrans qui
 * l'affichent ; l'accueil lit l'index généré src/content/leconsIndex.gen.ts (`npm run index-lecons`).
 *
 * `steps` a la longueur de la leçon complète, sans les étapes elles-mêmes : seul son nombre sert ici (progression,
 * leçon conseillée, « À faire »). Le lecteur de leçon retrouve la leçon complète par son identifiant.
 */
import { anglais } from './anglais';
import { langue, type Langue } from './i18n';
import { CHAPITRES_INDEX, LECONS_INDEX } from './leconsIndex.gen';

/** `taille` (#454) : 13 ou 19 pour une leçon sur un grand plateau ; absente en 9 × 9. */
export interface LeconResume { id: string; title: string; desc: string; taille?: 13 | 19; steps: readonly null[] }
export interface ChapitreResume { id: string; titre: string; intro: string; fin?: string; complet: boolean; lecons: LeconResume[] }

/** Leçons de l'index dans une langue ; une traduction qui n'a pas le même nombre d'étapes est ignorée (comme `localiser`). */
export function leconsResumees(l: Langue): LeconResume[] {
  const tr = l === 'fr' ? undefined : anglais()?.lecons;
  return LECONS_INDEX.map(([id, title, desc, n, taille]) => {
    const t = tr?.[id];
    const ok = t && t.steps.length === n;
    return { id, title: ok ? t.title : title, desc: ok ? t.desc : desc, ...(taille ? { taille } : {}), steps: Array<null>(n).fill(null) };
  });
}

/** Chapitres de l'index dans une langue, avec leurs leçons. */
export function chapitresResumes(l: Langue, lecons: readonly LeconResume[]): ChapitreResume[] {
  const tr = l === 'fr' ? undefined : anglais()?.chapitres;
  return CHAPITRES_INDEX.map(c => ({
    id: c.id, titre: c.titre, intro: c.intro, ...(c.fin ? { fin: c.fin } : {}), complet: c.complet,
    ...(tr?.[c.id] ?? {}),
    lecons: c.lecons.map(id => lecons.find(x => x.id === id)!),
  }));
}

/** Leçons dans la langue de l'interface, choisie une fois au chargement. */
export const LESSONS: LeconResume[] = leconsResumees(langue());
export const CHAPITRES: ChapitreResume[] = chapitresResumes(langue(), LESSONS);
