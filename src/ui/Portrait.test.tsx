// Portraits illustrés (issue #102) : les 9 se rendent, ont un titre accessible, et l'humeur change le dessin.
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NOMS, PORTRAITS, Portrait, PortraitMochi } from './Portrait';

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

  it('charte personnages-go : 4 couleurs au plus, fond compris (le blanc du reflet à part)', () => {
    const couleurs = (html: string) => new Set([...html.matchAll(/(?:fill|stroke)="(#[0-9A-Fa-f]{3,6})"/g)].map(m => m[1].toUpperCase()).filter(c => c !== '#FFF'));
    for (const id of PORTRAITS) for (const h of ['neutre', 'content', 'surpris'] as const) {
      expect(couleurs(rendu(<Portrait id={id} humeur={h} signature={false} />)).size, `${id} ${h}`).toBeLessThanOrEqual(4);
    }
    for (const h of ['neutre', 'content', 'fier', 'pensif'] as const) expect(couleurs(rendu(<PortraitMochi humeur={h} />)).size).toBeLessThanOrEqual(4);
  });

  it('Mochi : 4 humeurs distinctes, titre accessible', () => {
    const rendus = (['neutre', 'content', 'fier', 'pensif'] as const).map(h => rendu(<PortraitMochi humeur={h} />));
    expect(new Set(rendus).size).toBe(4);
    expect(rendus[0]).toContain('<title>Mochi</title>');
    expect(rendus[2]).toContain('<title>Mochi, fier</title>');
  });

  it('le sceau signe les grands portraits seulement', () => {
    expect(rendu(<Portrait id="tigre" taille={160} />)).toContain('portrait-signature');
    expect(rendu(<Portrait id="tigre" taille={44} />)).not.toContain('portrait-signature');
  });
});
