import { useEffect, useState } from 'react';
import { valeurDefilee } from './defile';

function mouvementsReduits(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Nombre qui défile de `de` vers `a` en `duree` ms (600 ms : durée des récompenses, direction.md section 5).
 * Mouvements réduits : la valeur finale s'affiche directement.
 */
export function Defile({ de, a, duree = 600 }: { de: number; a: number; duree?: number }) {
  const [v, setV] = useState(() => (mouvementsReduits() ? a : de));
  useEffect(() => {
    if (mouvementsReduits() || de === a) { setV(a); return; }
    let raf = 0;
    const t0 = performance.now();
    const pas = (t: number) => {
      const u = (t - t0) / duree;
      setV(valeurDefilee(de, a, u));
      if (u < 1) raf = requestAnimationFrame(pas);
    };
    raf = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(raf);
  }, [de, a, duree]);
  return <span className="defile">{v}</span>;
}
