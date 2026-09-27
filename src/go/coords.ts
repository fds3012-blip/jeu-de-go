// Coordonnées affichées : lettres A à T sans I, lignes numérotées depuis le bas. SGF : deux lettres depuis le haut à gauche.
export const LETTERS = 'ABCDEFGHJKLMNOPQRST';

export function toLabel(p: number, size: number): string {
  if (p < 0) return 'passe';
  return LETTERS[p % size] + String(size - Math.floor(p / size));
}

export function fromLabel(label: string, size: number): number {
  const x = LETTERS.indexOf(label[0].toUpperCase()), y = size - Number(label.slice(1));
  if (x < 0 || x >= size || !(y >= 0 && y < size)) throw new Error(`Coordonnée invalide : ${label}`);
  return y * size + x;
}

export function toSgf(p: number, size: number): string {
  if (p < 0) return 'tt';
  return String.fromCharCode(97 + (p % size)) + String.fromCharCode(97 + Math.floor(p / size));
}

export function fromSgf(s: string, size: number): number {
  if (!s || s === 'tt') return -1;
  const x = s.charCodeAt(0) - 97, y = s.charCodeAt(1) - 97;
  if (x < 0 || y < 0 || x >= size || y >= size) return -1;
  return y * size + x;
}
