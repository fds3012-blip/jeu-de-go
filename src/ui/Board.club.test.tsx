import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { fromLabel } from '../go/coords';
import { Board } from './Board';

// #365 : options du goban partagé, désactivées par défaut (coordonnées affichées, aucun numéro).
const N = 9;
const b = new Int8Array(N * N);
b[fromLabel('D4', N)] = 1;
b[fromLabel('E5', N)] = 2;

describe('options du goban (#365)', () => {
  it('par défaut : coordonnées A à J sans I, lignes depuis le bas, pas de numéro', () => {
    const html = renderToStaticMarkup(<Board size={N} board={b} />);
    expect(html).toContain('class="coord"');
    expect(html).toMatch(/>J<\/text>/);
    expect(html).not.toMatch(/>I<\/text>/);
    expect(html).not.toContain('data-numero');
  });
  it('coordonnées masquées', () => {
    expect(renderToStaticMarkup(<Board size={N} board={b} coordonnees={false} />)).not.toContain('class="coord"');
  });
  it('numéros sur les pierres présentes seulement ; le dernier coup cerclé autour', () => {
    const numeros = new Map([[fromLabel('D4', N), 1], [fromLabel('E5', N), 2], [fromLabel('A1', N), 3]]);
    const html = renderToStaticMarkup(<Board size={N} board={b} numeros={numeros} marks={{ last: fromLabel('E5', N) }} />);
    expect(html).toContain('data-numero="1"');
    expect(html).toContain('data-numero="2"');
    expect(html).not.toContain('data-numero="3"');
    expect(html).toContain('data-dernier');
  });
});
