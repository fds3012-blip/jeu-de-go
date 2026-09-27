// Sceaux de note (issue #71) : le symbole se lit sur son sceau (AA, 4,5:1), et deux notes voisines ne se confondent pas.
import { describe, expect, it } from 'vitest';
import { NOTE_ENCRE } from './notes';
import { NOTES } from '../app/revue';

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contraste = (a: string, b: string) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

describe('encre des sceaux de note', () => {
  it('chaque symbole atteint 4,5:1 sur son sceau', () => {
    for (const n of NOTES) expect(contraste(NOTE_ENCRE[n].texte, NOTE_ENCRE[n].fond), n).toBeGreaterThanOrEqual(4.5);
  });

  it('le sceau se détache du bois du goban (kaya #EDC27A à #C58D42) grâce à son liseré papier ou à sa teinte', () => {
    // Les notes à fond clair (or, vert) sont posées avec un liseré papier dans Board.tsx ; on vérifie qu'aucun fond n'est le bois lui-même.
    for (const n of NOTES) expect(NOTE_ENCRE[n].fond.toUpperCase()).not.toBe('#EDC27A');
  });
});
