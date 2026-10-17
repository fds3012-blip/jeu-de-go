import { renderToStaticMarkup } from 'react-dom/server';
import { PastilleXp } from './PastilleXp';
import { texteXp } from './gainXp';

// Issue #162 : pastille « +N XP ». Rendu statique (node, sans DOM) : `window` minimal pour `matchMedia`.
function avecMouvements(reduit: boolean) {
  vi.stubGlobal('window', { matchMedia: (q: string) => ({ matches: reduit && q.includes('prefers-reduced-motion: reduce') }) });
}
afterEach(() => { vi.unstubAllGlobals(); });

describe('PastilleXp', () => {
  it('affiche « +N XP » avec une espace insécable et la part du bonus', () => {
    avecMouvements(false);
    expect(texteXp(45)).toBe('+45\u00A0XP');
    const html = renderToStaticMarkup(<PastilleXp points={45} bonus={30} anime />);
    expect(html).toContain('+45\u00A0XP');
    expect(html).toContain('dont +30 première fois');
    expect(html).toContain('pastille-xp anime');
  });

  it('sans bonus, une seule ligne', () => {
    avecMouvements(false);
    expect(renderToStaticMarkup(<PastilleXp points={10} />)).not.toContain('première fois');
  });

  it('aucune animation avec les mouvements réduits', () => {
    avecMouvements(true);
    expect(renderToStaticMarkup(<PastilleXp points={10} anime />)).not.toContain('anime');
  });
});
