import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ORDRE_THEMES, THEMES_GOBAN, contraste, themeGoban, woodDataUrl } from './boardArt';
import { RECOMPENSES, niveauDe, niveauRequis, seuil, themeDebloque } from '../app/xp';

// Empreinte du bois de kaya tel qu'il était avant les thèmes (origin/main, #109) : le défaut ne bouge pas d'un pixel.
const EMPREINTE_KAYA = 'dce6731405da8a6c4992bebe76f72f6ffc805d8368f2fa9e6898ecfbcc96fd7a';
const NOIRE = '#151716';

describe('thèmes du goban (#109)', () => {
  it('le kaya par défaut est identique octet pour octet', () => {
    expect(createHash('sha256').update(woodDataUrl()).digest('hex')).toBe(EMPREINTE_KAYA);
    expect(woodDataUrl('kaya')).toBe(woodDataUrl());
  });

  it('chaque bois a sa propre texture, calculée une seule fois', () => {
    const urls = ORDRE_THEMES.map(id => woodDataUrl(id));
    expect(new Set(urls.slice(0, 3)).size).toBe(3); // kaya, kaya clair, ardoise : trois bois différents
    expect(woodDataUrl('ardoise')).toBe(urls[2]);
    expect(decodeURIComponent(urls[2])).toContain(THEMES_GOBAN.ardoise.fond[1]);
  });

  it('un identifiant inconnu retombe sur le kaya', () => {
    expect(themeGoban('bambou').id).toBe('kaya');
    expect(themeGoban(null).id).toBe('kaya');
  });

  it('les récompenses de xp.ts sont toutes des thèmes', () => {
    for (const r of RECOMPENSES) expect(ORDRE_THEMES).toContain(r.id);
  });

  it('déverrouillage : kaya dès le niveau 1, kaya clair au 3, ardoise au 5, coquillage doré au 8', () => {
    expect(ORDRE_THEMES.map(niveauRequis)).toEqual([1, 3, 5, 8]);
    const niv = (xp: number) => niveauDe(xp).niveau;
    expect(themeDebloque('kaya', niv(0))).toBe(true);
    for (const [id, n] of [['kaya-clair', 3], ['ardoise', 5], ['coquillage-dore', 8]] as const) {
      expect(themeDebloque(id, niv(seuil(n) - 1))).toBe(false);
      expect(themeDebloque(id, niv(seuil(n)))).toBe(true);
    }
  });

  // Le goban a les mêmes couleurs en mode sombre et clair : un seul contrôle par thème vaut pour les deux.
  for (const id of ORDRE_THEMES) {
    const t = THEMES_GOBAN[id];
    it(`${t.nom} : lignes, coordonnées et pierres lisibles (AA)`, () => {
      for (const bois of t.fond) {
        expect(contraste(t.ligne, bois)).toBeGreaterThanOrEqual(3); // élément graphique : 3:1
        expect(contraste(NOIRE, bois)).toBeGreaterThanOrEqual(3);
      }
      expect(contraste(t.coord, t.fond[1])).toBeGreaterThanOrEqual(4.5); // texte des coordonnées
      expect(contraste(t.blanche[1], NOIRE)).toBeGreaterThanOrEqual(3); // noire contre blanche
      // Pierre blanche sur le bois : son ombre portée brun foncé la détache (comme sur le kaya d'origine),
      // et cette ombre tient 3:1 contre la pierre.
      expect(contraste('#231204', t.blanche[1])).toBeGreaterThanOrEqual(3);
    });
  }
});
