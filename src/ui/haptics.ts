// Vibrations : navigator.vibrate quand il existe (Android). Safari iOS ne l'a pas : on ignore sans bruit
// (avec Capacitor, on passera par le plugin Haptics).

type Pattern = number | number[];

export function vibrate(pattern: Pattern): boolean {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false;
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}

export const VIBRATIONS = { pose: 12, capture: [20, 40, 20], interdit: 30, victoire: [30, 60, 30] } as const satisfies Record<string, Pattern>;

export const hapticStone = () => vibrate(VIBRATIONS.pose);
export const hapticCapture = () => vibrate([...VIBRATIONS.capture]);
export const hapticIllegal = () => vibrate(VIBRATIONS.interdit);
export const hapticVictory = () => vibrate([...VIBRATIONS.victoire]);
