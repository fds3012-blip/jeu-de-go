// Types des leçons. Le contenu vit dans content/lessons.fr.js, vérifié par src/go/lessons.test.ts.
import { LESSONS as RAW } from '../../content/lessons.fr.js';

export type LessonStep =
  | { kind: 'info'; rows: string[]; libs?: string[]; text: string }
  | { kind: 'move'; rows: string[]; accept: string[] | 'line3'; text: string; ok: string; no: string }
  | { kind: 'quiz'; rows: string[]; terr?: boolean; text: string; choices: string[]; answer: number; ok: string; no: string };
export interface Lesson { id: string; title: string; desc: string; steps: LessonStep[] }

export const LESSONS = RAW as unknown as Lesson[];
