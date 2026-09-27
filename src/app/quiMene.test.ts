import { describe, expect, it } from 'vitest';
import { carteTerritoire, descriptionQuiMene, DUREE_QUI_MENE, phraseQuiMene, QUI_MENE_PAR_PARTIE, quiMeneDisponible, quiMeneRestants, SERRE } from './partie';

// « Qui mène ? » (#94) : phrase, compteur, réglage de l'aide et carte des territoires.
describe('phraseQuiMene', () => {
  it('annonce le camp qui mène et un écart arrondi, avec KataGo', () => {
    expect(phraseQuiMene(4.2, 'katago')).toBe("Noir mène d'environ 4 points.");
    expect(phraseQuiMene(-12.6, 'katago')).toBe("Blanc mène d'environ 13 points.");
    expect(phraseQuiMene(2, 'katago')).toBe("Noir mène d'environ 2 points.");
  });
  it("dit « C'est serré » sous 2 points avec KataGo", () => {
    for (const l of [0, 1.9, -1.5, 0.4]) expect(phraseQuiMene(l, 'katago')).toBe(SERRE);
  });
  it("est plus prudent avec l'estimation simple : jamais un chiffre sous 5 points", () => {
    for (const l of [0, 2, -3, 4.9, -4.9]) expect(phraseQuiMene(l, 'simple')).toBe(SERRE);
    expect(phraseQuiMene(8.4, 'simple')).toBe("Noir mène d'environ 8 points.");
    expect(phraseQuiMene(-6, 'simple')).toBe("Blanc mène d'environ 6 points.");
  });
  it("dit « C'est serré » pour une valeur absurde", () => {
    expect(phraseQuiMene(Number.NaN, 'katago')).toBe(SERRE);
    expect(phraseQuiMene(Number.POSITIVE_INFINITY, 'katago')).toBe(SERRE);
  });
  it('phrase courte, sans « 1 point » au singulier', () => {
    expect(phraseQuiMene(1.6, 'katago')).toBe(SERRE);
    expect(phraseQuiMene(40, 'katago').length).toBeLessThan(40);
  });
});

describe('compteur « Qui mène ? »', () => {
  it("3 fois par partie contre l'ordi, jamais négatif", () => {
    expect(QUI_MENE_PAR_PARTIE).toBe(3);
    expect([0, 1, 2, 3, 4, -1].map(quiMeneRestants)).toEqual([3, 2, 1, 0, 0, 3]);
  });
  it("décrit ce qui reste au lecteur d'écran", () => {
    expect(descriptionQuiMene(3)).toBe('Encore 3 fois dans cette partie');
    expect(descriptionQuiMene(1)).toBe('Encore 1 fois dans cette partie');
    expect(descriptionQuiMene(0)).toBe('Plus disponible pour cette partie');
  });
  it('reste affiché 3 secondes', () => { expect(DUREE_QUI_MENE).toBe(3000); });
});

describe('réglage « Aide de Mochi en partie »', () => {
  it("contre l'ordi, l'action suit l'aide ; à deux, elle est toujours là", () => {
    expect(quiMeneDisponible(true, true)).toBe(true);
    expect(quiMeneDisponible(true, false)).toBe(false);
    expect(quiMeneDisponible(false, false)).toBe(true);
    expect(quiMeneDisponible(false, true)).toBe(true);
  });
});

describe('carteTerritoire', () => {
  it('code 1 pour Noir, 2 pour Blanc, 0 sous le seuil', () => {
    expect([...carteTerritoire([0.9, -0.8, 0.2, -0.39, 0.4, -0.4])]).toEqual([1, 2, 0, 0, 1, 2]);
  });
  it('accepte un Float32Array de la taille du plateau', () => {
    const own = new Float32Array(81).fill(-1);
    own[0] = 1;
    const c = carteTerritoire(own);
    expect(c.length).toBe(81);
    expect(c[0]).toBe(1);
    expect(c[80]).toBe(2);
  });
});
