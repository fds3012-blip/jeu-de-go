// Score affiché (passe design #509, point 19) : virgule décimale en français, et signe moins typographique (U+2212)
// pour un score négatif (« Pomme −100 », pas « Pomme -100 »), comme le récit du score (src/ui/RecitScore.tsx).
import { nombre } from '../content/i18n/secondaires';
import type { Langue } from '../content/i18n/types';

export const MOINS = '−';

/** Score lisible : « 6,5 », « −100 » (français) ; « 6.5 », « −100 » (anglais). */
export function score(n: number, l?: Langue): string {
  const texte = l ? nombre(n, l) : nombre(n);
  return texte.replace(/^-/, MOINS);
}
