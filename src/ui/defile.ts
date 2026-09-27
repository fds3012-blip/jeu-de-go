// Chiffres qui défilent (cote problèmes) : fonctions pures.

/** Ralenti de fin (cubique) : rapide au départ, se pose doucement. */
export function ralenti(t: number): number {
  const u = Math.min(1, Math.max(0, t));
  return 1 - (1 - u) ** 3;
}

/** Valeur entière affichée au temps `t` (0 à 1) d'un défilement de `de` vers `a`. */
export function valeurDefilee(de: number, a: number, t: number): number {
  return Math.round(de + (a - de) * ralenti(t));
}

/** Écart signé, écrit à la française : « +12 », « −8 » (vrai signe moins), « 0 ». */
export function ecart(de: number, a: number): string {
  const d = a - de;
  return d > 0 ? `+${d}` : d < 0 ? `−${-d}` : '0';
}
