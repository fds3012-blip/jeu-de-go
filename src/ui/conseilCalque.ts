// Conseil de Mochi (#80) : géométrie du calque posé sur le plateau (fonctions pures, sans React).
import { C, M } from './boardArt';

/** Segments du contour d'une zone : les côtés de cellule qui séparent un point de la zone d'un point hors zone. */
export function contour(zone: readonly number[], size: number): [number, number, number, number][] {
  const dans = new Set(zone), d = C / 2, seg: [number, number, number, number][] = [];
  for (const p of zone) {
    const x = p % size, y = Math.floor(p / size), cx = M + x * C, cy = M + y * C;
    if (!(x > 0 && dans.has(p - 1))) seg.push([cx - d, cy - d, cx - d, cy + d]);
    if (!(x < size - 1 && dans.has(p + 1))) seg.push([cx + d, cy - d, cx + d, cy + d]);
    if (!(y > 0 && dans.has(p - size))) seg.push([cx - d, cy - d, cx + d, cy - d]);
    if (!(y < size - 1 && dans.has(p + size))) seg.push([cx - d, cy + d, cx + d, cy + d]);
  }
  return seg;
}
