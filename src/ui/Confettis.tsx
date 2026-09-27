// Confettis de victoire (docs/design/v2/direction.md, section 5) : canvas maison, sans dépendance.
// Petites pierres (ardoise et coquillage) et éclats jade, or, hanko et papier, pendant 1,5 s.
// Le parent ne le monte que si les célébrations sont activées et que les mouvements ne sont pas réduits.
import { useEffect, useRef } from 'react';

const COULEURS = ['#3CC48E', '#EFB84A', '#D2432C', '#F3EDE3'];
const GRAVITE = 1100; // px/s²

type Forme = 'noire' | 'blanche' | 'eclat' | 'rond';
interface Particule { x: number; y: number; vx: number; vy: number; a: number; va: number; f: Forme; c: string; t: number; phase: number }

/** Graine pseudo-aléatoire (mulberry32) : même gerbe à chaque fois, utile pour les captures. */
function hasard(graine: number): () => number {
  let s = graine >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Gerbe initiale : une moitié jaillit du sceau vers le haut, l'autre tombe du haut de l'écran. */
function gerbe(largeur: number, hauteur: number, origine: { x: number; y: number }, n = 72, graine = 7): Particule[] {
  const r = hasard(graine), out: Particule[] = [];
  for (let i = 0; i < n; i++) {
    const f: Forme = i % 9 === 0 ? 'noire' : i % 9 === 4 ? 'blanche' : i % 3 === 0 ? 'rond' : 'eclat';
    const c = COULEURS[i % COULEURS.length];
    if (i % 2 === 0) {
      const ang = (-90 + (r() - 0.5) * 120) * (Math.PI / 180), v = 420 + r() * 520;
      out.push({ x: origine.x + (r() - 0.5) * 30, y: origine.y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, a: r() * 6.28, va: (r() - 0.5) * 14, f, c, t: 6 + r() * 5, phase: r() * 6.28 });
    } else {
      out.push({ x: r() * largeur, y: -20 - r() * hauteur * 0.25, vx: (r() - 0.5) * 80, vy: 80 + r() * 160, a: r() * 6.28, va: (r() - 0.5) * 10, f, c, t: 5 + r() * 5, phase: r() * 6.28 });
    }
  }
  return out;
}

/** Sprite d'une pierre (rendu une fois : le dégradé ne se recalcule pas à chaque image). */
function sprite(noire: boolean, taille: number, dpr: number): HTMLCanvasElement {
  const cv = document.createElement('canvas'), px = Math.ceil(taille * dpr);
  cv.width = cv.height = px;
  const g = cv.getContext('2d');
  if (!g) return cv;
  const r = px / 2, grad = g.createRadialGradient(r * 0.72, r * 0.6, r * 0.1, r, r, r);
  if (noire) { grad.addColorStop(0, '#6a6e6c'); grad.addColorStop(0.5, '#151716'); grad.addColorStop(1, '#050606'); }
  else { grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.6, '#EDE6D8'); grad.addColorStop(1, '#BDB3A0'); }
  g.fillStyle = grad;
  g.beginPath(); g.arc(r, r, r - 0.5, 0, Math.PI * 2); g.fill();
  return cv;
}

interface Props {
  /** Point de départ de la gerbe (coordonnées de la fenêtre), par défaut le tiers haut de l'écran. */
  origine?: { x: number; y: number } | null;
  /** Durée totale en millisecondes. */
  duree?: number;
  onFin?: () => void;
}

export function Confettis({ origine, duree = 1500, onFin }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const fin = useRef(onFin);
  useEffect(() => { fin.current = onFin; });
  useEffect(() => {
    const cv = ref.current, g = cv?.getContext('2d');
    if (!cv || !g) { fin.current?.(); return; }
    const L = window.innerWidth, H = window.innerHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(L * dpr); cv.height = Math.round(H * dpr);
    g.scale(dpr, dpr);
    const parts = gerbe(L, H, origine ?? { x: L / 2, y: H * 0.35 });
    const noire = sprite(true, 11, dpr), blanche = sprite(false, 11, dpr);
    let raf = 0, t0 = 0, prec = 0;
    const image = (now: number) => {
      if (!t0) { t0 = now; prec = now; }
      const ecoule = now - t0, dt = Math.min(0.033, (now - prec) / 1000);
      prec = now;
      g.clearRect(0, 0, L, H);
      // Les 350 dernières ms : tout s'efface doucement.
      g.globalAlpha = Math.max(0, Math.min(1, (duree - ecoule) / 350));
      for (const p of parts) {
        p.vy += GRAVITE * dt * (p.f === 'eclat' ? 0.55 : 1);
        p.vx *= 1 - 1.6 * dt; p.vy *= p.f === 'eclat' ? 1 - 1.8 * dt : 1 - 0.6 * dt; // les éclats de papier flottent
        p.x += p.vx * dt; p.y += p.vy * dt; p.a += p.va * dt;
        if (p.y > H + 20) continue;
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.a);
        if (p.f === 'noire' || p.f === 'blanche') g.drawImage(p.f === 'noire' ? noire : blanche, -5.5, -5.5, 11, 11);
        else if (p.f === 'rond') { g.fillStyle = p.c; g.beginPath(); g.arc(0, 0, 3.4, 0, Math.PI * 2); g.fill(); }
        else {
          // Éclat qui tourne sur lui-même : sa largeur apparente oscille.
          g.scale(Math.cos(ecoule / 1000 * p.t + p.phase), 1);
          g.fillStyle = p.c; g.fillRect(-3.5, -6, 7, 12);
        }
        g.restore();
      }
      if (ecoule < duree) raf = requestAnimationFrame(image);
      else { g.clearRect(0, 0, L, H); fin.current?.(); }
    };
    raf = requestAnimationFrame(image);
    return () => cancelAnimationFrame(raf);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <canvas ref={ref} className="confettis" aria-hidden="true" data-testid="confettis" />;
}
