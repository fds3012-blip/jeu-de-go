// Partie guidée (#79) : Mochi ajuste sa force pour garder la partie serrée.
// Tous les 10 coups, l'écart estimé (KataGo, sinon le moteur simple) règle son « cran » de force :
// il mène de plus de 15 points, il joue plus doux ; il est mené de plus de 15 points, il se renforce.
// Logique pure, sans moteur : testée par simulation dans guidee.test.ts.
import { OPPONENTS, type Opponent } from './simple';

/** Coups (des deux joueurs) entre deux réglages de force. */
export const PERIODE_GUIDEE = 10;
/** Écart, en points, au-delà duquel Mochi change de force. */
export const SEUIL_GUIDEE = 15;
/**
 * Pas du réglage : un cran au-delà de 15 points, un de plus par tranche de PAS_POINTS (plus de 25 : deux, plus de 35 :
 * trois), PAS_MAX au plus. En 9 × 9, il n'y a que 5 ou 6 réglages par partie : un cran à la fois ne rattrape rien.
 */
export const PAS_POINTS = 10;
export const PAS_MAX = 4;
/** Dérive (écart creusé depuis le réglage précédent) qui ajoute un cran au pas : la partie s'emballe. */
export const SEUIL_DERIVE = 10;
/** Zone calme : un écart sous ce seuil permet à nouveau de changer de sens (hystérésis). */
export const ZONE_CALME = 5;
/** Réglages sans changement exigés avant de repartir dans l'autre sens, si la zone calme n'a pas été vue. */
export const PAUSE_INVERSION = 1;
/**
 * Crans de force de Mochi, du plus doux au plus fort. Les deux premiers sont plus doux que Pomme (plus de coups au
 * hasard) : pour ramener une partie qu'il mène, Mochi doit pouvoir jouer moins bien que le joueur le plus faible,
 * pas seulement aussi mal. Ensuite, les 9 niveaux de l'échelle, de Pomme (20 kyu) à Sensei (1 dan).
 * #488 : avec le filtre des coups plausibles, 0,9 et 0,8 jouent comme les anciens 0,7 et 0,5 (21 / 40 chacun,
 * docs/game-design/ouverture-pomme-2026-10-08.md).
 */
export const CRANS: readonly Opponent[] = [
  { ...OPPONENTS[0], hasard: 0.9 },
  { ...OPPONENTS[0], hasard: 0.8 },
  ...OPPONENTS,
];
export const CRAN_MIN = 0;
export const CRAN_MAX = CRANS.length - 1;
/** Cran de départ par défaut : force de Caillou (16 kyu). L'écran peut partir du niveau du joueur dans l'échelle. */
export const CRAN_DEPART = 3;
/** Cran de même force qu'un adversaire de l'échelle (index 0 à 8). */
export function cranDuNiveau(indexEchelle: number): number {
  return borne(Math.round(indexEchelle) + CRANS.length - OPPONENTS.length);
}

/** Réglage de force de Mochi, conservé d'un réglage à l'autre. */
export interface ForceGuidee {
  /** Index dans CRANS (CRAN_MIN à CRAN_MAX) : Mochi emprunte les réglages du moteur de ce cran. */
  cran: number;
  /** Sens du dernier changement : -1 plus doux, +1 plus fort, 0 aucun encore. */
  sens: -1 | 0 | 1;
  /** Réglages passés depuis le dernier changement. */
  depuis: number;
  /** Vrai si un écart sous ZONE_CALME a été vu depuis le dernier changement. */
  calme: boolean;
  /** Écart estimé au réglage précédent (0 au début de la partie) : sert à mesurer la dérive. */
  ecart: number;
}

/** Ce que le joueur apprend du réglage : rien, ou une phrase (« Mochi joue un peu plus doux. »). */
export type AnnonceGuidee = 'plus-doux' | 'plus-fort' | null;

export function forceInitiale(cran = CRAN_DEPART): ForceGuidee {
  return { cran: borne(Math.round(cran)), sens: 0, depuis: 0, calme: true, ecart: 0 };
}

function borne(c: number): number {
  return Math.max(CRAN_MIN, Math.min(CRAN_MAX, c));
}

/** Vrai si un réglage de force a lieu après `coups` coups joués (10, 20, 30…). */
export function momentDeReglage(coups: number): boolean {
  return coups > 0 && coups % PERIODE_GUIDEE === 0;
}

/**
 * Nouveau réglage de force. `ecart` : avance estimée de Mochi en points (négative s'il est mené).
 * - |écart| ≤ 15 : rien ne change ;
 * - Mochi mène de plus de 15 points : il joue plus doux ; mené de plus de 15 points, il se renforce. Un cran, plus un
 *   par tranche de PAS_POINTS, plus un si l'écart s'est creusé d'au moins SEUIL_DERIVE depuis le réglage précédent ;
 * - bornes CRAN_MIN et CRAN_MAX : à la borne, rien ne change et rien n'est annoncé ;
 * - hystérésis : après un changement, repartir dans l'autre sens demande d'avoir vu l'écart revenir sous
 *   ZONE_CALME, ou PAUSE_INVERSION réglages sans changement. Sans ça, l'estimation bruitée ferait osciller Mochi.
 * Un écart non fini (estimation indisponible) ne change rien.
 */
export function reglerForce(ecart: number, f: ForceGuidee): { force: ForceGuidee; annonce: AnnonceGuidee } {
  if (!Number.isFinite(ecart)) return { force: f, annonce: null };
  const calme = f.calme || Math.abs(ecart) < ZONE_CALME;
  const garder = { force: { ...f, depuis: f.depuis + 1, calme, ecart }, annonce: null };
  if (Math.abs(ecart) <= SEUIL_GUIDEE) return garder;
  const sens: -1 | 1 = ecart > 0 ? -1 : 1;
  const inversion = f.sens !== 0 && sens !== f.sens;
  if (inversion && !calme && f.depuis < PAUSE_INVERSION) return garder;
  // Dérive : de combien l'écart s'est creusé depuis le réglage précédent. Forte, la force actuelle est loin du compte.
  const derive = (ecart - f.ecart) * -sens;
  const pas = Math.min(PAS_MAX, 1 + Math.floor((Math.abs(ecart) - SEUIL_GUIDEE) / PAS_POINTS) + (derive >= SEUIL_DERIVE ? 1 : 0));
  const cran = borne(f.cran + sens * pas);
  if (cran === f.cran) return garder;
  return { force: { cran, sens, depuis: 0, calme: false, ecart }, annonce: sens < 0 ? 'plus-doux' : 'plus-fort' };
}

/**
 * Cran de départ de la partie guidée suivante : celui où Mochi a fini. Le joueur retrouve un Mochi à sa mesure dès
 * le premier coup, au lieu de revivre à chaque partie les 10 à 30 premiers coups de réglage.
 */
export function cranSuivant(f: ForceGuidee): number {
  return borne(f.cran);
}

/** Réglages du moteur pour Mochi au cran donné, sous le nom de Mochi. À passer à `bestMove`. */
export function niveauGuide(cran: number): Opponent {
  return { ...CRANS[borne(Math.round(cran))], nom: 'Mochi' };
}
