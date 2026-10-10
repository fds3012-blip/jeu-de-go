// Nombres entiers lisibles (#509, L2, constat 23) : « 1 284 » en français (espace fine insécable), « 1,284 » en anglais.
// Jamais de coupure de ligne au milieu d'un nombre.
import { langue, type Langue } from '../content/i18n/secondaires';

const formats = new Map<Langue, Intl.NumberFormat>();

export function entier(n: number, l: Langue = langue()): string {
  let f = formats.get(l);
  if (!f) { f = new Intl.NumberFormat(l === 'fr' ? 'fr-FR' : 'en-GB', { maximumFractionDigits: 0 }); formats.set(l, f); }
  return f.format(n);
}
