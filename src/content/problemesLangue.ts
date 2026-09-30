// Problèmes dans la langue de l'interface (#167) : un catalogue local par langue, indexé par id de problème,
// remplace les textes français champ par champ, que le problème vienne de Supabase ou des lots locaux.
// Pas de migration : la table `puzzles` reste en français. Un problème non traduit reste en français.
import { anglais } from './anglais';
import type { TexteProbleme } from './problemes.en';
import type { Langue } from './i18n';

export type { TexteProbleme } from './problemes.en';

// L'anglais n'est téléchargé que si l'interface est en anglais (#325, src/content/anglais.ts).
export const TRADUCTIONS_PROBLEMES: Record<Exclude<Langue, 'fr'>, Record<string, TexteProbleme>> = {
  get en() { return anglais()?.problemes ?? {}; },
};

interface Textes { id: string; title: string; prompt: string; explanation: string | null; refutation: string | null }

/**
 * Problème dans une langue. `title` et `prompt` sont remplacés ; `explanation` et `refutation` seulement si le
 * français en a une et la traduction aussi (sinon on garde le texte français, ou l'absence de texte).
 */
export function localiserProbleme<T extends Textes>(p: T, l: Langue): T {
  const tr = l === 'fr' ? undefined : TRADUCTIONS_PROBLEMES[l][p.id];
  if (!tr) return p;
  return {
    ...p, title: tr.title, prompt: tr.prompt,
    explanation: p.explanation && tr.explanation ? tr.explanation : p.explanation,
    refutation: p.refutation && tr.refutation ? tr.refutation : p.refutation,
  };
}
