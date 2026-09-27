// Chiffres qui défilent (écran de fin : l'écart en points monte en 600 ms) et préférence de mouvements réduits.
import { useEffect, useState } from 'react';

/** Valeur affichée pendant le défilement : entière pendant la course, exacte à l'arrivée. `t` va de 0 à 1. */
export function valeurDefilee(cible: number, t: number): number {
  if (t >= 1) return cible;
  const e = 1 - Math.pow(1 - Math.max(0, t), 3); // décélération : les chiffres ralentissent en arrivant
  return Math.floor(cible * e);
}

/** Vrai si le système demande de réduire les animations. */
export function mouvementsReduits(): boolean {
  try { return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

/** Fait défiler un nombre de 0 à `cible` en `duree` ms ; affiche directement `cible` si `actif` est faux. */
export function useDefilement(cible: number, duree: number, actif: boolean): number {
  const [v, setV] = useState(() => (actif ? 0 : cible));
  useEffect(() => {
    if (!actif) return;
    let raf = 0;
    const t0 = performance.now();
    const pas = (now: number) => {
      const t = (now - t0) / duree;
      setV(valeurDefilee(cible, t));
      if (t < 1) raf = requestAnimationFrame(pas);
    };
    raf = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(raf);
  }, [cible, duree, actif]);
  return actif ? v : cible;
}
