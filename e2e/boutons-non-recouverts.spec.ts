import { expect, test, type Page } from '@playwright/test';
import { jouer, plateau } from './plateau';
import { demarrerParcours, ouvrirRevue, preparerRevue } from './revueFactice';

// Issue #503 : sur les écrans à barre fixe en bas (revue : bilan et parcours, « Rejouer mes erreurs », problèmes,
// leçons), aucun bouton visible n'est recouvert par un élément fixe. Pour chaque bouton : on l'amène au milieu de
// l'écran (autant que la page le permet), puis on regarde ce qui est dessiné en son centre (elementFromPoint).
// La réserve de place sous le contenu doit suffire pour que le dernier bouton de la page sorte de sous la barre.

const ECRANS = [[320, 568], [390, 844], [412, 915]] as const;

async function aucunBoutonRecouvert(page: Page, ecran: string) {
  const fautes = await page.evaluate(async () => {
    const image = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    /** Le premier ancêtre (ou l'élément) en position fixe ou collante. */
    const fixe = (el: Element | null) => {
      for (let e = el; e; e = e.parentElement) {
        const p = getComputedStyle(e).position;
        if (p === 'fixed' || p === 'sticky') return e;
      }
      return null;
    };
    const boutons = [...document.querySelectorAll<HTMLElement>('button, a[href], [role="button"]')].filter(b => {
      const r = b.getBoundingClientRect(), s = getComputedStyle(b);
      return r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && !b.closest('[aria-hidden="true"], [inert], .sr-only');
    });
    const out: string[] = [];
    for (const b of boutons) {
      if (!b.isConnected) continue;
      if (!fixe(b)) { b.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }); await image(); }
      const r = b.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) continue;
      const dessus = document.elementFromPoint(cx, cy);
      if (!dessus || b.contains(dessus)) continue;
      const barre = fixe(dessus);
      if (barre && !barre.contains(b)) {
        const nom = (e: Element) => `${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : ''}`;
        out.push(`« ${(b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 40)} » sous ${nom(barre)}`);
      }
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
    return out;
  });
  expect(fautes, `${ecran} : boutons recouverts par un élément fixe`).toEqual([]);
  const debord = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(debord, `${ecran} : défilement horizontal`).toBeLessThanOrEqual(0);
}

for (const [l, h] of ECRANS) {
  const taille = `${l} × ${h}`;
  test.describe(`${taille}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: l, height: h });
      await page.emulateMedia({ reducedMotion: 'reduce' });
    });

    test(`revue : bilan, parcours sur une erreur, « Rejouer mes erreurs » (${taille})`, async ({ page }) => {
      await preparerRevue(page);
      await ouvrirRevue(page);
      await expect(page.getByRole('button', { name: 'Rejouer mes erreurs (2)' })).toBeVisible({ timeout: 30_000 });
      await aucunBoutonRecouvert(page, `bilan ${taille}`);

      // Parcours sur le coup 7 (Coup manqué, le tien) : « Rejoue cette erreur » et « Suivant » ensemble, sans défiler.
      await demarrerParcours(page, 7);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      const rejoue = page.getByRole('button', { name: 'Rejoue cette erreur' });
      const suivant = page.locator('.revue-dock .cta');
      await expect(rejoue).toBeInViewport({ ratio: 1 });
      await expect(suivant).toBeInViewport({ ratio: 1 });
      const a = (await rejoue.boundingBox())!, b = (await suivant.boundingBox())!;
      const disjoints = a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
      expect(disjoints, '« Rejoue cette erreur » et « Suivant » se recouvrent').toBe(true);
      expect(a.height).toBeGreaterThanOrEqual(44);
      expect(b.height).toBeGreaterThanOrEqual(44);
      await expect(page.locator('.cta')).toHaveCount(1);
      await aucunBoutonRecouvert(page, `parcours ${taille}`);

      // Retour au bilan, puis la séance « Rejouer mes erreurs ».
      await page.getByRole('button', { name: 'Retour au résumé' }).click();
      await page.getByRole('button', { name: 'Rejouer mes erreurs (2)' }).click();
      await expect(page.getByRole('heading', { level: 2, name: 'Rejoue tes erreurs' })).toBeVisible();
      await aucunBoutonRecouvert(page, `rejouer mes erreurs ${taille}`);
    });

    test(`problèmes : accueil, problème raté puis réussi (${taille})`, async ({ page }) => {
      await page.goto('/');
      await page.getByRole('navigation').getByRole('button', { name: 'Problèmes' }).click();
      await expect(page.getByRole('button', { name: 'Résoudre le Go du jour' })).toBeVisible();
      await aucunBoutonRecouvert(page, `problèmes ${taille}`);
      await page.getByRole('button', { name: 'Tous les problèmes' }).click();
      await page.getByRole('button', { name: /^Problème \d+ : Capture la pierre/ }).click();
      await expect(plateau(page)).toBeVisible();
      await jouer(page, 'A1');
      await expect(page.getByText('Pas tout à fait. Essaie encore.')).toBeVisible();
      await aucunBoutonRecouvert(page, `problème raté ${taille}`);
      await jouer(page, 'E5');
      await expect(page.getByText('Bravo, c’est le bon coup !')).toBeVisible();
      await aucunBoutonRecouvert(page, `problème réussi ${taille}`);
    });

    test(`leçon 1 : étape jouée, puis fin de leçon (${taille})`, async ({ page }) => {
      await page.goto('/');
      await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
      await page.getByRole('button', { name: 'Commencer' }).click();
      await jouer(page, 'E5');
      await expect(page.getByRole('button', { name: 'Continuer' })).toBeVisible();
      await aucunBoutonRecouvert(page, `leçon ${taille}`);
      await page.getByRole('button', { name: 'Continuer' }).click();
      for (const p of ['A1', 'D6', 'E5', 'E5']) {
        await jouer(page, p);
        await page.getByRole('button', { name: 'Continuer' }).click();
      }
      await jouer(page, 'E4');
      await page.getByRole('button', { name: 'Terminer la leçon' }).click();
      await expect(page.getByRole('heading', { name: 'Leçon terminée' })).toBeVisible();
      await aucunBoutonRecouvert(page, `fin de leçon ${taille}`);
    });
  });
}
