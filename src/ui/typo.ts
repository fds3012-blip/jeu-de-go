// Typographie française de l'interface.

/** Espace fine insécable (U+202F), comme dans l'édition française. */
export const FINE = '\u202F';

// Espace normale, insécable (U+00A0) ou fine insécable (U+202F), écrites en échappements.
const ESP = '[ \\u00A0\\u202F]+';
const AVANT = new RegExp(`${ESP}([?!:;])`, 'g');
const APRES_OUVRANT = new RegExp(`\u00AB${ESP}`, 'g');
const AVANT_FERMANT = new RegExp(`${ESP}\u00BB`, 'g');
// Apostrophe droite entre deux lettres (« qu'une », « l'échelle ») : l'apostrophe typographique (#693, QA bug 11).
const APOSTROPHE = /(?<=\p{L})'(?=\p{L})/gu;

/**
 * Remplace l'espace (normale ou insécable) placée avant `? ! : ;` et à l'intérieur des guillemets « »
 * par une espace fine insécable : la ponctuation ne part plus seule en début de ligne. Les apostrophes droites entre
 * deux lettres deviennent des apostrophes typographiques (’), comme dans le reste de l'interface.
 * N'ajoute pas d'espace là où il n'y en a pas (URL, heures « 10:30 », smileys).
 */
export function fr(text: string): string {
  return text
    .replace(APOSTROPHE, '\u2019')
    .replace(AVANT, `${FINE}$1`)
    .replace(APRES_OUVRANT, `\u00AB${FINE}`)
    .replace(AVANT_FERMANT, `${FINE}\u00BB`);
}
