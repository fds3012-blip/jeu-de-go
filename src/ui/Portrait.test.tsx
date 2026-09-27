// Portraits illustrés (issue #102) : les 9 se rendent, ont un titre accessible, et l'humeur change le dessin.
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NOMS, PORTRAITS, Portrait } from './Portrait';

const rendu = (el: React.ReactElement) => renderToStaticMarkup(el);

describe('Portrait', () => {
  it('dessine les 9 adversaires', () => {
    expect(PORTRAITS).toHaveLength(9);
    for (const id of PORTRAITS) expect(rendu(<Portrait id={id} taille={160} />)).toContain('<path');
  });

  it('chaque portrait a un titre accessible à son nom', () => {
    for (const id of PORTRAITS) {
      const html = rendu(<Portrait id={id} />);
      expect(html).toContain('role="img"');
      expect(html).toContain(`<title>${NOMS[id]}</title>`);
    }
  });

  it("l'humeur change le rendu et le titre", () => {
    for (const id of PORTRAITS) {
      const [n, c, s] = (['neutre', 'content', 'surpris'] as const).map(h => rendu(<Portrait id={id} humeur={h} />));
      expect(new Set([n, c, s]).size).toBe(3);
      expect(s).toContain('surpris');
    }
  });

  it('décoratif : masqué aux lecteurs d’écran, sans titre', () => {
    const html = rendu(<Portrait id="pomme" decoratif />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('<title>');
  });

  it('le sceau signe les grands portraits seulement', () => {
    expect(rendu(<Portrait id="tigre" taille={160} />)).toContain('portrait-signature');
    expect(rendu(<Portrait id="tigre" taille={44} />)).not.toContain('portrait-signature');
  });
});
