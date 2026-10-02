import { describe, expect, it } from 'vitest';
import { pasSansCoupure, valeurDefilee } from './defilement';

describe('chiffres qui défilent', () => {
  it('part de 0, monte sans dépasser, et arrive exactement sur la cible', () => {
    expect(valeurDefilee(12.5, 0)).toBe(0);
    const suite = [0.1, 0.3, 0.5, 0.7, 0.9].map(t => valeurDefilee(12.5, t));
    for (let i = 1; i < suite.length; i++) expect(suite[i]).toBeGreaterThanOrEqual(suite[i - 1]);
    expect(Math.max(...suite)).toBeLessThanOrEqual(12);
    expect(valeurDefilee(12.5, 1)).toBe(12.5);
    expect(valeurDefilee(12.5, 3)).toBe(12.5);
  });

  it('ralentit en arrivant (décélération)', () => {
    expect(valeurDefilee(100, 0.5)).toBeGreaterThan(50);
  });
});

// Lot X (#398) : à 320 × 568, la feuille de verdict fait défiler la page ; le surtitre « Entraînement » restait rogné.
describe('défilement sans élément coupé en haut de l’écran', () => {
  // En-tête du lecteur : surtitre 8 → 22, titre 22 → 50, bouton retour 6 → 50 ; plateau à partir de 54.
  const tete = [{ haut: 8, bas: 22 }, { haut: 22, bas: 50 }, { haut: 6, bas: 50 }];
  it('ne change rien quand aucun élément n’est coupé', () => {
    expect(pasSansCoupure(0, tete, 54)).toBe(0);
    expect(pasSansCoupure(50, tete, 54)).toBe(50);
    expect(pasSansCoupure(5, tete, 54)).toBe(5);
  });
  it('fait sortir entièrement un élément que le nouveau haut couperait', () => {
    expect(pasSansCoupure(14, tete, 54)).toBe(50);
    expect(pasSansCoupure(36, tete, 54)).toBe(50);
  });
  it('garde l’élément entier si le faire sortir dépasse le maximum', () => {
    expect(pasSansCoupure(14, [{ haut: 8, bas: 80 }], 54)).toBe(8);
    expect(pasSansCoupure(14, [{ haut: -4, bas: 80 }], 54)).toBe(0);
  });
});
