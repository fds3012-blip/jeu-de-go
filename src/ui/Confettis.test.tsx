import { renderToStaticMarkup } from 'react-dom/server';
import { Confettis } from './Confettis';

// Issue #62 : avec les mouvements réduits, les confettis ne montent rien (pas de canvas, pas de boucle).
// Rendu statique (environnement node, sans DOM) : on simule `matchMedia` sur un `window` minimal.

function avecMouvements(reduit: boolean) {
  vi.stubGlobal('window', {
    matchMedia: (q: string) => ({ matches: reduit && q.includes('prefers-reduced-motion: reduce') }),
    innerWidth: 390, innerHeight: 844, devicePixelRatio: 2,
  });
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('Confettis', () => {
  it('ne rend rien quand les mouvements sont réduits', () => {
    avecMouvements(true);
    expect(renderToStaticMarkup(<Confettis origine={{ x: 10, y: 10 }} onFin={() => {}} />)).toBe('');
  });

  it('rend le canvas décoratif sinon', () => {
    avecMouvements(false);
    const html = renderToStaticMarkup(<Confettis origine={{ x: 10, y: 10 }} />);
    expect(html).toContain('<canvas');
    expect(html).toContain('aria-hidden="true"');
  });
});
