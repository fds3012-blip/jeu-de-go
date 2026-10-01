// Types des leçons. Le contenu vit dans content/lessons.fr.js, vérifié par src/go/lessons.test.ts.
import { CHAPITRES as RAW_CHAPITRES, LESSONS as RAW } from '../../content/lessons.fr.js';
import { anglais } from './anglais';
import { langue, type Langue } from './i18n';
import type { DemoTemps, Geste } from './demo';
export type { DemoTemps, Geste } from './demo';

export type LessonStep =
  /** `demo` (issue #101) : temps joués un par un, animés, depuis `rows`. Sans ce champ, l'image est immobile. */
  /** `avant` : temps déjà vus à l'étape précédente, rejoués sans image (pour garder par exemple le point de ko). */
  /** `geste` (#198) : la démonstration attend que l'élève pose la pierre ou touche le point, puis se joue. */
  | { kind: 'info'; rows: string[]; libs?: string[]; demo?: DemoTemps[]; avant?: DemoTemps[]; geste?: Geste; text: string }
  /** `libs` : aide de l'étape « on fait ensemble », les libertés de la pierre marquée sont montrées. */
  /** `aide` (#177) : points verts de l'étape « on fait ensemble » qui ne sont pas des libertés (ex. le trou d'une frontière). */
  /** `refus` (#228) : réfutations des erreurs courantes ; le premier ensemble qui contient le coup donne son explication. */
  | { kind: 'move'; rows: string[]; accept: string[] | 'line3' | 'terrB'; libs?: string[]; aide?: string[]; text: string; ok: string; no: string; refus?: Refus[] }
  /** Question sur le goban sans poser de pierre : l'élève touche un point (« Où Blanc ne peut-il pas reprendre ? »). */
  | { kind: 'touche'; rows: string[]; accept: string[]; text: string; ok: string; no: string }
  /**
   * Question à choix. `compte` (#177) : « combien de points pour Noir / Blanc ? » ; la bonne réponse est le score
   * de src/go (règle japonaise) avec ce komi et ces prisonniers (Noir, Blanc), vérifié par src/go/lessons.test.ts.
   */
  | { kind: 'quiz'; rows: string[]; terr?: boolean; compte?: Compte; text: string; choices: string[]; answer: number; ok: string; no: string };
export interface Refus { points: string[]; no: string }
export interface Compte { pour: 'B' | 'W'; komi: number; prises?: [number, number] }
export interface Lesson { id: string; title: string; desc: string; steps: LessonStep[] }

/** Leçons d'origine, en français : positions, réponses, démonstrations et gestes font foi. */
export const LESSONS_FR = RAW as unknown as Lesson[];

/** Textes traduits d'une étape (#167), dans l'ordre des étapes françaises. Le reste de l'étape ne change jamais. */
export interface TexteEtape { text: string; ok?: string; no?: string; choices?: string[]; geste?: { no: string }; refus?: string[] }
export interface TexteLecon { title: string; desc: string; steps: TexteEtape[] }
export interface TexteChapitre { titre: string; intro: string; fin?: string }
// L'anglais n'est téléchargé que si l'interface est en anglais (#325, src/content/anglais.ts) ; sinon, aucune traduction.
export const TRADUCTIONS: Record<Exclude<Langue, 'fr'>, { lecons: Record<string, TexteLecon>; chapitres: Record<string, TexteChapitre> }> = {
  get en() { const a = anglais(); return { lecons: a?.lecons ?? {}, chapitres: a?.chapitres ?? {} }; },
};

/**
 * Leçon dans une langue : les textes traduits remplacent ceux du français, champ par champ ; une leçon non traduite
 * reste en français. Une traduction qui n'a pas le même nombre d'étapes est ignorée (vérifié par src/content/lessons.en.test.ts).
 */
export function localiser(lecon: Lesson, l: Langue): Lesson {
  const tr = l === 'fr' ? undefined : TRADUCTIONS[l].lecons[lecon.id];
  if (!tr || tr.steps.length !== lecon.steps.length) return lecon;
  return {
    ...lecon, title: tr.title, desc: tr.desc,
    steps: lecon.steps.map((s, i) => {
      const e = tr.steps[i];
      const r = { ...s, text: e.text } as LessonStep & Record<string, unknown>;
      if ('ok' in s && e.ok) r.ok = e.ok;
      if ('no' in s && e.no) r.no = e.no;
      if (s.kind === 'quiz' && e.choices?.length === s.choices.length) r.choices = e.choices;
      if (s.kind === 'info' && s.geste && 'no' in s.geste && e.geste) r.geste = { ...s.geste, no: e.geste.no };
      if (s.kind === 'move' && s.refus && e.refus?.length === s.refus.length) r.refus = s.refus.map((x, j) => ({ ...x, no: e.refus![j] }));
      return r;
    }),
  };
}

/** Leçons dans la langue de l'interface, choisie une fois au chargement (`?lang=en`). */
export const LESSONS: Lesson[] = LESSONS_FR.map(x => localiser(x, langue()));

/** Chapitre du chemin (#228). `complet: false` : chapitre en cours d'écriture, sa dernière leçon ne le ferme pas encore. */
export interface Chapitre { id: string; titre: string; intro: string; fin?: string; complet: boolean; lecons: Lesson[] }

export const CHAPITRES: Chapitre[] = (RAW_CHAPITRES as { id: string; titre: string; intro: string; fin?: string; complet?: boolean; lecons: string[] }[])
  .map(c => ({ ...c, ...(langue() === 'fr' ? {} : TRADUCTIONS[langue() as Exclude<Langue, 'fr'>].chapitres[c.id]),
    complet: c.complet !== false, lecons: c.lecons.map(id => LESSONS.find(l => l.id === id)!) }));

/** Chapitre d'une leçon ; le premier par défaut. */
export function chapitreDe(id: string): Chapitre {
  return CHAPITRES.find(c => c.lecons.some(l => l.id === id)) ?? CHAPITRES[0];
}

/** Explication d'un coup refusé : la réfutation qui le contient, sinon l'aide générale de l'étape. */
export function explicationRefus(step: Extract<LessonStep, { kind: 'move' }>, label: string): string {
  return step.refus?.find(r => r.points.includes(label))?.no ?? step.no;
}
