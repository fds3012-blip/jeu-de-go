/**
 * Filets de la partie contre l'ordi (#474) : si le moteur échoue (exception, Worker tombé), la partie continue.
 * - Coup de l'ordi : un coup du moteur simple calculé ici, sinon l'ordi passe. Jamais « réfléchit… » sans fin.
 * - Comptage : pas de pierres mortes proposées, le joueur les marque lui-même (comptage manuel).
 * L'erreur part à Sentry (avec accord seulement), étiquetée `origine: ordi` ou `comptage`.
 */
import { chooseMoveDetail, type CoupExplique } from '../engine';
import type { ComptageAuto } from '../engine';
import { play, type Position } from '../go/rules';
import { captureError } from '../data/analytics';

/** Coup du plus doux des moteurs, rapide : le filet ne doit pas figer l'écran. */
const choisirParDefaut = (pos: Position): CoupExplique => chooseMoveDetail(pos, 'caillou', { timeMs: 300 });

export function coupDeSecours(pos: Position, erreur: unknown, choisir: (p: Position) => CoupExplique = choisirParDefaut): CoupExplique {
  captureError(erreur, { categorie: 'rendu', origine: 'ordi' });
  try {
    const c = choisir(pos);
    if (c.move === -1 || typeof play(pos, c.move) !== 'string') return c;
  } catch { /* le moteur simple échoue aussi : l'ordi passe */ }
  return { move: -1, raison: null };
}

/** Comptage sans proposition : `secours` force le comptage manuel, même contre l'ordi. */
export function comptageDeSecours(erreur: unknown): ComptageAuto & { secours: true } {
  captureError(erreur, { categorie: 'rendu', origine: 'comptage' });
  return { dead: [], incertains: [], secours: true };
}
