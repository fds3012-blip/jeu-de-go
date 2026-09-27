import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { fromLabel } from '../go/coords';
import { fromRows } from '../go/position';
import { Board, annonceAtari, annonceCoup, deplacerCurseur, nomIntersection } from './Board';

// Issue #116 : le goban se joue au clavier et se lit au lecteur d'écran.
const N = 9;
const at = (l: string) => fromLabel(l, N);

describe('curseur clavier', () => {
  it('les flèches déplacent le curseur et bloquent aux bords', () => {
    expect(deplacerCurseur(at('E5'), 'ArrowUp', N)).toBe(at('E6'));
    expect(deplacerCurseur(at('E5'), 'ArrowDown', N)).toBe(at('E4'));
    expect(deplacerCurseur(at('E5'), 'ArrowLeft', N)).toBe(at('D5'));
    expect(deplacerCurseur(at('E5'), 'ArrowRight', N)).toBe(at('F5'));
    expect(deplacerCurseur(at('A1'), 'ArrowLeft', N)).toBe(at('A1'));
    expect(deplacerCurseur(at('A1'), 'ArrowDown', N)).toBe(at('A1'));
    expect(deplacerCurseur(at('J9'), 'ArrowUp', N)).toBe(at('J9'));
  });

  it('Home, End, PageUp et PageDown vont aux bords', () => {
    expect(deplacerCurseur(at('E5'), 'Home', N)).toBe(at('A5'));
    expect(deplacerCurseur(at('E5'), 'End', N)).toBe(at('J5'));
    expect(deplacerCurseur(at('E5'), 'PageUp', N)).toBe(at('E9'));
    expect(deplacerCurseur(at('E5'), 'PageDown', N)).toBe(at('E1'));
    expect(deplacerCurseur(fromLabel('K10', 19), 'End', 19)).toBe(fromLabel('T10', 19));
  });

  it('les autres touches ne déplacent rien', () => {
    expect(deplacerCurseur(at('E5'), 'Enter', N)).toBeNull();
    expect(deplacerCurseur(at('E5'), ' ', N)).toBeNull();
    expect(deplacerCurseur(at('E5'), 'Tab', N)).toBeNull();
  });
});

describe('noms lus', () => {
  const b = new Int8Array(N * N);
  b[at('D4')] = 1;
  b[at('C3')] = 2;

  it('nomme chaque intersection', () => {
    expect(nomIntersection(at('E5'), b, N)).toBe('E5, vide');
    expect(nomIntersection(at('D4'), b, N)).toBe('D4, pierre noire');
    expect(nomIntersection(at('C3'), b, N, at('C3'))).toBe('C3, pierre blanche, dernier coup');
  });

  it('annonce le coup joué et les prises', () => {
    expect(annonceCoup(1, at('D4'), 0, N)).toBe('Noir joue D4');
    expect(annonceCoup(2, at('C3'), 1, N)).toBe('Blanc joue C3 et prend 1 pierre');
    expect(annonceCoup(2, at('C3'), 3, N)).toBe('Blanc joue C3 et prend 3 pierres');
  });

  it("l'annonce cite le nom de l'adversaire", () => {
    expect(annonceCoup(2, at('C3'), 0, N, { 2: 'Pomme' })).toBe('Pomme a joué C3');
    expect(annonceCoup(1, at('D4'), 0, N, { 2: 'Pomme' })).toBe('Noir joue D4');
  });

  it("annonce l'atari des pierres voisines du coup", () => {
    // Blanc joue D5 : la pierre noire D4 n'a plus qu'une liberté, en D3.
    const b1 = fromRows(['.........', '.........', '.........', '.........', '...O.....', '..OXO....', '.........', '.........', '.........']).pos.board;
    expect(annonceAtari(b1, at('D5'), N)).toBe("Atari : ta pierre D4 n'a plus qu'une liberté, en D3.");
    // Noir met en atari deux pierres de Pomme.
    const b3 = fromRows(['.........', '.........', '.........', '...X.....', '..XOOX...', '...XX....', '.........', '.........', '.........']).pos.board;
    expect(annonceAtari(b3, at('F5'), N, { 2: 'Pomme' })).toBe("Atari : les pierres D5, E5 de Pomme n'ont plus qu'une liberté, en E6.");
    // Intersection vide, ou groupe voisin avec deux libertés : chaîne vide.
    expect(annonceAtari(b1, at('A1'), N)).toBe('');
    expect(annonceAtari(b3, at('C6'), N)).toBe('');
  });

  it('un plateau jouable est une grille à un seul arrêt de tabulation', () => {
    const html = renderToStaticMarkup(<Board size={N} board={b} marks={{ last: at('D4') }} interactive onPlay={() => {}} />);
    expect(html).toContain('role="grid"');
    expect(html.match(/tabindex="0"/g)).toHaveLength(1);
    expect(html.match(/role="row"/g)).toHaveLength(N);
    expect(html.match(/role="gridcell"/g)).toHaveLength(N * N);
    expect(html).toContain('aria-label="D4, pierre noire, dernier coup"');
    expect(html).toContain('aria-live="polite"');
    // Le curseur part du centre (tengen) et est désigné par aria-activedescendant.
    const actif = /aria-activedescendant="([^"]+)"/.exec(html)![1];
    const cellule = html.slice(html.indexOf(`id="${actif}"`));
    expect(cellule).toMatch(/^id="[^"]+" role="gridcell" aria-label="E5, vide"/);
  });

  it("un plateau d'affichage reste une image, hors de la tabulation", () => {
    const html = renderToStaticMarkup(<Board size={N} board={b} />);
    expect(html).toContain('role="img"');
    expect(html).not.toContain('tabindex');
    expect(html).not.toContain('gridcell');
  });
});
