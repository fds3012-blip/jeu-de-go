// Vibrations : navigator.vibrate quand il existe (Android). Safari iOS ne l'a pas : on ignore sans bruit
// (avec Capacitor, on passera par le plugin Haptics).

type Pattern = number | number[];

let actif = true;
/** Réglage « Vibrations » du Profil, séparé du son (#165). */
export function setHapticsEnabled(on: boolean): void { actif = on; }
export function hapticsEnabled(): boolean { return actif; }

export function vibrate(pattern: Pattern): boolean {
  if (!actif) return false;
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false;
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}

// Un motif par événement : toujours bref (moins d'un quart de seconde), jamais en continu, plus discret que le son.
export const VIBRATIONS = {
  pose: 12,
  capture: [20, 40, 20],
  atari: [10, 60, 10],
  interdit: 30,
  victoire: [30, 60, 30],
  defaite: 20,
  niveau: [15, 50, 15, 50, 30],
  badge: [25, 70, 15],
  reussite: [10, 50, 15],
  echec: 18,
} as const satisfies Record<string, Pattern>;

const motif = (p: number | readonly number[]): Pattern => (typeof p === 'number' ? p : [...p]);

export const hapticStone = () => vibrate(VIBRATIONS.pose);
export const hapticCapture = () => vibrate(motif(VIBRATIONS.capture));
export const hapticAtari = () => vibrate(motif(VIBRATIONS.atari));
export const hapticIllegal = () => vibrate(VIBRATIONS.interdit);
export const hapticVictory = () => vibrate(motif(VIBRATIONS.victoire));
export const hapticDefeat = () => vibrate(VIBRATIONS.defaite);
export const hapticLevel = () => vibrate(motif(VIBRATIONS.niveau));
export const hapticBadge = () => vibrate(motif(VIBRATIONS.badge));
export const hapticSuccess = () => vibrate(motif(VIBRATIONS.reussite));
export const hapticFail = () => vibrate(VIBRATIONS.echec);
