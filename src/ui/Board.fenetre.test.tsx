// #454 : plateau cadré sur une zone (option du Board, absente par défaut).
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { fromLabel } from '../go/coords';
import { fromRows } from '../go/position';
import { Board } from './Board';
import { deplacerCurseur } from './boardA11y';
import { coordBand, vueDe } from './boardArt';

const vide = (n: number) => fromRows(Array.from({ length: n }, () => '.'.repeat(n))).pos.board;
const textes = (html: string) => [...html.matchAll(/<text[^>]*>([^<]+)<\/text>/g)].map(m => m[1]);

describe('Board cadré (#454)', () => {
  const f = { x: 0, y: 9, k: 10 }; // coin bas gauche d'un 19 × 19 : A à K, lignes 1 à 10
  const html = renderToStaticMarkup(<Board size={19} board={vide(19)} fenetre={f} interactive onPlay={() => {}} />);

  it('viewBox sur la zone, bande des coordonnées comprise ; repère data-fenetre', () => {
    const v = vueDe(19, f);
    expect(html).toContain(`viewBox="${v.x} ${v.y} ${v.span} ${v.span}"`);
    expect(html).toContain('data-fenetre="A10:K1"');
    expect(html).toContain('data-cadre=""');
  });
  it('coordonnées du vrai plateau, seulement celles de la zone', () => {
    const t = textes(html);
    expect(t.filter(x => /^[A-T]$/.test(x))).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K']);
    expect(t.filter(x => /^\d+$/.test(x)).map(Number)).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
  });
  it('grille accessible réduite à la zone : 10 × 10 cases', () => {
    expect(html.match(/role="gridcell"/g)).toHaveLength(100);
    expect(html).toContain('aria-rowcount="10"');
  });
  it('sans fenêtre : plateau entier, aucune marque de cadrage', () => {
    const plein = renderToStaticMarkup(<Board size={19} board={vide(19)} />);
    expect(plein).toContain(`viewBox="${-coordBand(19)} ${-coordBand(19)}`);
    expect(plein).not.toContain('data-fenetre');
    expect(plein).not.toContain('data-cadre');
    expect(textes(plein).filter(x => /^[A-T]$/.test(x))).toHaveLength(19);
  });
  it('le curseur clavier reste dans la zone', () => {
    const at = (l: string) => fromLabel(l, 19);
    expect(deplacerCurseur(at('K5'), 'ArrowRight', 19, f)).toBe(at('K5'));
    expect(deplacerCurseur(at('E10'), 'ArrowUp', 19, f)).toBe(at('E10'));
    expect(deplacerCurseur(at('E5'), 'End', 19, f)).toBe(at('K5'));
    expect(deplacerCurseur(at('E5'), 'PageUp', 19, f)).toBe(at('E10'));
    expect(deplacerCurseur(at('E5'), 'Home', 19, f)).toBe(at('A5'));
    // Sans fenêtre, inchangé.
    expect(deplacerCurseur(at('E5'), 'End', 19)).toBe(at('T5'));
  });
});
