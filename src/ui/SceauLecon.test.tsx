import { renderToStaticMarkup } from 'react-dom/server';
import { LESSONS } from '../content/lessons';
import { SceauLecon } from './SceauLecon';

// Issue #16 : chaque leçon a son propre sceau (les leçons 8 à 16 n'avaient que le rond par défaut).
// Rendu statique (environnement node, sans DOM).

const rendu = (id: string) => renderToStaticMarkup(<SceauLecon id={id} />);
/** Le motif seul : ce qui suit le cadre, sans l'identifiant du filtre (propre à chaque rendu). */
const motif = (id: string) => rendu(id).split('opacity=".85"></rect>')[1].replace(/sceau-lecon-[\w-]+/g, '');

describe('SceauLecon', () => {
  it('chaque leçon a un dessin à elle, différent du rond par défaut et des autres', () => {
    const defaut = motif('inconnue');
    const vus = new Map<string, string>();
    expect(LESSONS.map(l => l.id)).toContain('l16');
    for (const l of LESSONS) {
      const m = motif(l.id);
      expect(m, l.id).not.toBe(defaut);
      expect(vus.get(m), `${l.id} dessiné comme ${vus.get(m)}`).toBeUndefined();
      vus.set(m, l.id);
    }
  });

  it('décoratif, encre et jade seulement : les mêmes couleurs que les sceaux 1 à 7, lisibles en clair et en sombre', () => {
    for (const l of LESSONS) {
      const html = rendu(l.id);
      expect(html, l.id).toContain('aria-hidden="true"');
      expect(html, l.id).toContain(`data-lecon="${l.id}"`);
      const couleurs = new Set(html.match(/#[0-9A-Fa-f]{6}\b/g));
      for (const c of couleurs) expect(['#3CC48E', '#1E8A5F', '#F7E9DA'], `${l.id} ${c}`).toContain(c);
    }
  });

  it('le dessin reste dans le cadre intérieur du sceau (12 à 88), avec une marge', () => {
    for (const l of LESSONS) {
      for (const [, cx, cy, r] of motif(l.id).matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/g)) {
        expect(Number(cx) - Number(r), `${l.id} ${cx},${cy}`).toBeGreaterThanOrEqual(14);
        expect(Number(cx) + Number(r), `${l.id} ${cx},${cy}`).toBeLessThanOrEqual(86);
        expect(Number(cy) - Number(r), `${l.id} ${cx},${cy}`).toBeGreaterThanOrEqual(14);
        expect(Number(cy) + Number(r), `${l.id} ${cx},${cy}`).toBeLessThanOrEqual(86);
      }
    }
  });
});
