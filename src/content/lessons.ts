// Types des leçons. Le contenu vit dans content/lessons.fr.js, vérifié par src/go/lessons.test.ts.
import { LESSONS as RAW } from '../../content/lessons.fr.js';
import type { DemoTemps } from './demo';
export type { DemoTemps } from './demo';

export type LessonStep =
  /** `demo` (issue #101) : temps joués un par un, animés, depuis `rows`. Sans ce champ, l'image est immobile. */
  /** `avant` : temps déjà vus à l'étape précédente, rejoués sans image (pour garder par exemple le point de ko). */
  | { kind: 'info'; rows: string[]; libs?: string[]; demo?: DemoTemps[]; avant?: DemoTemps[]; text: string }
  /** `libs` : aide de l'étape « on fait ensemble », les libertés de la pierre marquée sont montrées. */
  /** `aide` (#177) : points verts de l'étape « on fait ensemble » qui ne sont pas des libertés (ex. le trou d'une frontière). */
  | { kind: 'move'; rows: string[]; accept: string[] | 'line3' | 'terrB'; libs?: string[]; aide?: string[]; text: string; ok: string; no: string }
  /** Question sur le goban sans poser de pierre : l'élève touche un point (« Où Blanc ne peut-il pas reprendre ? »). */
  | { kind: 'touche'; rows: string[]; accept: string[]; text: string; ok: string; no: string }
  /**
   * Question à choix. `compte` (#177) : « combien de points pour Noir / Blanc ? » ; la bonne réponse est le score
   * de src/go (règle japonaise) avec ce komi et ces prisonniers (Noir, Blanc), vérifié par src/go/lessons.test.ts.
   */
  | { kind: 'quiz'; rows: string[]; terr?: boolean; compte?: Compte; text: string; choices: string[]; answer: number; ok: string; no: string };
export interface Compte { pour: 'B' | 'W'; komi: number; prises?: [number, number] }
export interface Lesson { id: string; title: string; desc: string; steps: LessonStep[] }

export const LESSONS = RAW as unknown as Lesson[];
