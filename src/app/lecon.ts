// Lecteur de leçon v3 (recette du 30/09, R2) : logique pure de la zone de Mochi (humeur, guidage) et des points d'étapes.
import type { LessonStep } from '../content/lessons';
import { fromLabel } from '../go/coords';
import type { HumeurMochi } from '../ui/Portrait';

/** Ce que Mochi est en train de dire : la consigne, un bravo, une erreur douce, ou la fin de la leçon. */
export type Moment = 'consigne' | 'juste' | 'revoir' | 'fin';

/** Expression de Mochi selon le moment : il réfléchit avec l'élève après une erreur, il est content d'un bon coup. */
export function humeurMochi(moment: Moment): HumeurMochi {
  switch (moment) {
    case 'juste': return 'content';
    case 'revoir': return 'pensif';
    case 'fin': return 'fier';
    default: return 'neutre';
  }
}

/** Clé locale : le halo de guidage a déjà été montré une fois sur cet appareil. */
export const GUIDE_KEY = 'go.lecons.guide.v1';

/**
 * Points à entourer d'un halo pour la toute première étape interactive : là où il faut toucher.
 * Démonstration qui attend un geste : le point à poser, ou les pierres à toucher. Étape « on fait ensemble » :
 * les points d'aide déjà verts. Jamais la réponse d'un exercice (quiz, coup sans aide), ni une étape sans geste.
 */
export function pointsGuide(step: LessonStep, attenteGeste: boolean, size = 9): number[] {
  if (step.kind === 'info') {
    if (!attenteGeste || !step.geste) return [];
    return ('pose' in step.geste ? [step.geste.pose] : step.geste.touche).map(a => fromLabel(a, size));
  }
  if (step.kind === 'move') return (step.libs ?? step.aide ?? []).map(a => fromLabel(a, size));
  return [];
}

/** Le halo ne se montre qu'une fois : jamais si la clé est déjà posée, jamais sans point à montrer. */
export function doitGuider(dejaVu: string | null, points: number[]): boolean {
  return dejaVu === null && points.length > 0;
}

/** État de chaque point d'étapes : faite, en cours (la prochaine à faire), ou à venir. */
export function etatsPoints(total: number, faites: number): ('faite' | 'encours' | 'avenir')[] {
  return Array.from({ length: total }, (_, i) => (i < faites ? 'faite' : i === faites ? 'encours' : 'avenir'));
}
