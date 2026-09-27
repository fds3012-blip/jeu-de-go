import { renderToStaticMarkup } from 'react-dom/server';
import { PastilleXp } from './PastilleXp';
import { cumuler, texteXp } from './gainXp';
import type { Gain } from '../app/xp';

// Issue #162 : pastille « +N XP ». Rendu statique (node, sans DOM) : `window` minimal pour `matchMedia`.
function avecMouvements(reduit: boolean) {
  vi.stubGlobal('window', { matchMedia: (q: string) => ({ matches: reduit && q.includes('prefers-reduced-motion: reduce') }) });
}
afterEach(() => { vi.unstubAllGlobals(); });

const gain = (p: Partial<Gain>): Gain => ({ source: 'probleme', points: 10, bonus: 0, avant: 0, apres: 10, niveauAvant: 1, niveauApres: 1, ...p });

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

  it('cumule deux gains rapprochés et retient un niveau franchi', () => {
    const a = cumuler(null, gain({ points: 30, bonus: 20 }));
    const b = cumuler(a, gain({ points: 10, niveauAvant: 1, niveauApres: 2 }));
    expect(b).toEqual({ points: 40, bonus: 20, niveauFranchi: true });
  });
});
