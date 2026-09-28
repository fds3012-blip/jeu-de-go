import { expect, test } from '@playwright/test';
import { attendrePierre, jouer } from './plateau';

// Issue #247 : recette du matin du 28/09 (docs/qa/recette-2026-09-28-matin.md), correctif M1 :
// une fois le Go du jour fait, « Problème suivant » devient l'action principale (bouton flottant). À 390 px, le verbe
// passait sur deux lignes et le titre était coupé à côté. Le verbe reste sur une ligne ; seul le titre s'abrège.

// Horloge figée le 27 septembre 2026 à midi, heure de Paris : Go du jour n° 1, le problème b1 (réponse E5).
const MIDI_PARIS = new Date('2026-09-27T12:00:00+02:00');

for (const largeur of [390, 320] as const) {
  test.describe(`M1, ${largeur} px`, () => {
    test.use({ viewport: { width: largeur, height: largeur === 390 ? 844 : 640 } });
    test('Go du jour fait : « Problème suivant » tient sur une ligne, sans débordement', async ({ page }) => {
      await page.clock.setFixedTime(MIDI_PARIS);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('/?go-du-jour=1');
      await jouer(page, 'E5');
      await attendrePierre(page, 'E5', 'noir');
      await page.getByRole('button', { name: 'Retour aux problèmes' }).first().click();

      const cta = page.locator('.cta.continuer');
      await expect(cta).toBeVisible();
      await expect(cta).toHaveAccessibleName(/^Problème suivant/);
      // Une seule ligne : la hauteur du texte ne dépasse pas une ligne de la police du bouton.
      const { hauteurTexte, ligne, deborde } = await cta.evaluate((el) => {
        const r = document.createRange();
        r.selectNodeContents(el.firstChild!);
        const rects = [...r.getClientRects()];
        const s = getComputedStyle(el);
        return {
          hauteurTexte: Math.max(...rects.map((x) => x.bottom)) - Math.min(...rects.map((x) => x.top)),
          ligne: parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.3,
          deborde: el.scrollWidth > el.clientWidth + 1,
        };
      });
      expect(hauteurTexte).toBeLessThanOrEqual(ligne * 1.2);
      expect(deborde).toBe(false);
      const box = (await cta.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x + box.width).toBeLessThanOrEqual(largeur);
    });
  });
}
