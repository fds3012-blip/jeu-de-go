// Types des leçons. Le contenu vit dans content/lessons.fr.js, vérifié par src/go/lessons.test.ts.
import { LESSONS as RAW } from '../../content/lessons.fr.js';
import type { DemoTemps } from './demo';
export type { DemoTemps } from './demo';

export type LessonStep =
  /** `demo` (issue #101) : temps joués un par un, animés, depuis `rows`. Sans ce champ, l'image est immobile. */
  /** `avant` : temps déjà vus à l'étape précédente, rejoués sans image (pour garder par exemple le point de ko). */
  | { kind: 'info'; rows: string[]; libs?: string[]; demo?: DemoTemps[]; avant?: DemoTemps[]; text: string }
  /** `libs` : aide de l'étape « on fait ensemble », les libertés de la pierre marquée sont montrées. */
  | { kind: 'move'; rows: string[]; accept: string[] | 'line3' | 'terrB'; libs?: string[]; text: string; ok: string; no: string }
  /** Question sur le goban sans poser de pierre : l'élève touche un point (« Où Blanc ne peut-il pas reprendre ? »). */
  | { kind: 'touche'; rows: string[]; accept: string[]; text: string; ok: string; no: string }
  | { kind: 'quiz'; rows: string[]; terr?: boolean; text: string; choices: string[]; answer: number; ok: string; no: string };
export interface Lesson { id: string; title: string; desc: string; steps: LessonStep[] }

export const LESSONS = RAW as unknown as Lesson[];
