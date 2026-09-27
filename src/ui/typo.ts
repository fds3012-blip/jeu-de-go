// Typographie française de l'interface.

/** Espace fine insécable (U+202F), comme dans l'édition française. */
export const FINE = '\u202F';

// Espace normale, insécable (U+00A0) ou fine insécable (U+202F), écrites en échappements.
const ESP = '[ \\u00A0\\u202F]+';
const AVANT = new RegExp(`${ESP}([?!:;])`, 'g');
const APRES_OUVRANT = new RegExp(`\u00AB${ESP}`, 'g');
const AVANT_FERMANT = new RegExp(`${ESP}\u00BB`, 'g');

/**
 * Remplace l'espace (normale ou insécable) placée avant `? ! : ;` et à l'intérieur des guillemets « »
 * par une espace fine insécable : la ponctuation ne part plus seule en début de ligne.
 * N'ajoute pas d'espace là où il n'y en a pas (URL, heures « 10:30 », smileys).
 */
export function fr(text: string): string {
  return text
    .replace(AVANT, `${FINE}$1`)
    .replace(APRES_OUVRANT, `\u00AB${FINE}`)
    .replace(AVANT_FERMANT, `${FINE}\u00BB`);
}
