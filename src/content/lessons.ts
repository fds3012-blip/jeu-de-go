// Types des leçons. Le contenu vit dans content/lessons.fr.js, vérifié par src/go/lessons.test.ts.
import { LESSONS as RAW } from '../../content/lessons.fr.js';
import type { DemoTemps } from './demo';
export type { DemoTemps } from './demo';

export type LessonStep =
  /** `demo` (issue #101) : temps joués un par un, animés, depuis `rows`. Sans ce champ, l'image est immobile. */
  | { kind: 'info'; rows: string[]; libs?: string[]; demo?: DemoTemps[]; text: string }
  | { kind: 'move'; rows: string[]; accept: string[] | 'line3' | 'terrB'; text: string; ok: string; no: string }
  | { kind: 'quiz'; rows: string[]; terr?: boolean; text: string; choices: string[]; answer: number; ok: string; no: string };
export interface Lesson { id: string; title: string; desc: string; steps: LessonStep[] }

export const LESSONS = RAW as unknown as Lesson[];
