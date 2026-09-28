import { expect, test, type Page } from '@playwright/test';
import { fromLabel } from '../src/go/coords';
import { attendrePierre, jouer, plateau } from './plateau';

// Recette du soir du 28/09 (docs/qa/recette-2026-09-28-soir.md, branche recette-soir) : défauts S3 à S6.
// #290 (S3) : en 320 × 640, le verdict d'un problème de vie et mort ne cache plus le coup gagnant ni les yeux.
// #291 (S4) : le petit tampon « BATTUE » passe le contraste AA (4,5:1).
// #292 (S5) : « Copié ! » n'agrandit plus le verdict.
// #293 (S6) : le lendemain, « Tes erreurs à rejouer » vient juste sous le Go du jour.

const SCHEMAS = ['light', 'dark'] as const;

/**
 * Position à l'écran d'une intersection, sans faire défiler la page (le `point` de plateau.ts défile jusqu'au
 * plateau, ce qui masquerait justement le défaut). Géométrie de src/ui/boardArt.ts : C = 40, M = 34.
 */
async function pointVisible(page: Page, label: string, taille = 9): Promise<{ x: number; y: number }> {
  const svg = plateau(page, taille);
  const box = (await svg.boundingBox())!;
  const [min, , w] = (await svg.getAttribute('viewBox'))!.split(' ').map(Number);
  const p = fromLabel(label, taille);
  const cx = 34 + (p % taille) * 40, cy = 34 + Math.floor(p / taille) * 40;
  return { x: box.x + ((cx - min) * box.width) / w, y: box.y + ((cy - min) * box.height) / w };
}

/** Rapport de contraste WCAG entre deux couleurs CSS `rgb(…)` / `rgba(…)` (fond opaque). */
function contraste(a: string, b: string): number {
  const lum = (c: string) => {
    const [r, g, bl] = c.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(v => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

test.describe('#290 : verdict de vie et mort en 320 × 640', () => {
  test.use({ viewport: { width: 320, height: 640 } });
  // Go du jour n° 163 = q01 (réponse D2, yeux A1 et C1) ; n° 166 = r01 (réponse B2, espace de A1 à C2).
  const CAS = [
    { numero: 163, date: '2027-03-08T12:00:00+01:00', titre: 'Rends ton œil vrai', coup: 'D2', voir: ['A1', 'C1', 'D1', 'E1', 'D2'] },
    { numero: 166, date: '2027-03-11T12:00:00+01:00', titre: 'Six points dans le coin', coup: 'B2', voir: ['A1', 'B1', 'C1', 'B2', 'C2'] },
  ];
  for (const schema of SCHEMAS) {
    for (const cas of CAS) {
      test(`${cas.titre} (${schema}) : le coup joué et les yeux restent visibles`, async ({ page }) => {
        await page.clock.setFixedTime(new Date(cas.date));
        await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: schema });
        await page.goto(`/?go-du-jour=${cas.numero}`);
        await expect(page.getByRole('heading', { level: 2, name: cas.titre })).toBeVisible();
        await jouer(page, cas.coup);
        await attendrePierre(page, cas.coup, 'noir');
        const verdict = page.locator('.verdict-juste');
        await expect(verdict).toBeVisible();
        // Chaque point à montrer est à l'écran, au-dessus de la feuille (sans défilement de la part du test).
        await expect.poll(async () => {
          const haut = (await verdict.boundingBox())!.y;
          const caches: string[] = [];
          for (const l of cas.voir) {
            const { y } = await pointVisible(page, l);
            if (y < 8 || y > haut - 12) caches.push(l);
          }
          return caches;
        }, { timeout: 3000 }).toEqual([]);
        // L'explication est repliée, pas perdue : un lien de 44 px la déplie, et le lecteur d'écran lit tout.
        const lire = verdict.getByRole('button', { name: 'Lire l’explication' });
        await expect(lire).toHaveAttribute('aria-expanded', 'false');
        expect((await lire.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        await expect(verdict.locator('.verdict-texte[role="status"]')).toContainText('ton groupe est vivant');
        await lire.click();
        await expect(verdict.getByRole('button', { name: 'Replier l’explication' })).toHaveAttribute('aria-expanded', 'true');
        const texte = verdict.locator('.verdict-texte p').first();
        expect(await texte.evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
        // Les actions restent entières, et la page ne déborde pas en largeur.
        const suivant = verdict.getByRole('button', { name: 'Problème suivant' });
        expect((await suivant.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
      });
    }
  }

  test('en 390 × 844, rien ne se replie et le plateau entier reste visible', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.clock.setFixedTime(new Date(CAS[0].date));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`/?go-du-jour=${CAS[0].numero}`);
    await jouer(page, 'D2');
    const verdict = page.locator('.verdict-juste');
    await expect(verdict).toBeVisible();
    await expect(verdict.getByRole('button', { name: 'Lire l’explication' })).toHaveCount(0);
    const haut = (await verdict.boundingBox())!.y;
    expect((await pointVisible(page, 'A9')).y).toBeGreaterThanOrEqual(0);
    expect((await pointVisible(page, 'A1')).y).toBeLessThan(haut - 12);
  });
});

test.describe('#291 : tampon « BATTUE » de la feuille des adversaires', () => {
  for (const schema of SCHEMAS) {
    test(`contraste AA (${schema})`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: schema });
      await page.addInitScript(() => {
        if (sessionStorage.getItem('tampon-pret')) return;
        sessionStorage.setItem('tampon-pret', '1');
        localStorage.setItem('go.parties.v1', JSON.stringify({ n: 3, ordi: 3, dernier: 'pomme' }));
        localStorage.setItem('go.bilan.v1', JSON.stringify({ pomme: { v: 1, d: 0 } }));
        localStorage.setItem('go.intro-but.v1', 'true');
      });
      await page.goto('/');
      await page.getByRole('button', { name: 'Changer' }).click();
      const tampon = page.getByRole('dialog').locator('.vignette-tampon').first();
      await expect(tampon).toHaveText('BATTUE');
      const { couleur, fond } = await tampon.evaluate(el => {
        const s = getComputedStyle(el);
        return { couleur: s.color, fond: s.backgroundColor };
      });
      expect(contraste(couleur, fond)).toBeGreaterThanOrEqual(4.5);
    });
  }
});

test.describe('#292 : « Copié ! » dans le bouton Partager', () => {
  test.use({ viewport: { width: 320, height: 640 } });
  for (const schema of SCHEMAS) {
    test(`la feuille ne grandit pas et ne mord pas le plateau (${schema})`, async ({ page, context }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.addInitScript(() => { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); });
      await page.clock.setFixedTime(new Date('2026-09-28T12:00:00+02:00'));
      await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: schema });
      await page.goto('/?go-du-jour=2');
      await jouer(page, 'A1');
      await expect(page.locator('.verdict-revoir')).toBeVisible();
      await jouer(page, 'E3');
      await attendrePierre(page, 'E3', 'noir');
      const verdict = page.locator('.verdict-juste');
      await expect(verdict).toBeVisible();
      // La page s'est posée : le bas du plateau au-dessus de la feuille.
      await expect.poll(async () => (await pointVisible(page, 'E1')).y < (await verdict.boundingBox())!.y - 12, { timeout: 3000 }).toBe(true);
      const avant = (await verdict.boundingBox())!;
      const titreAvant = (await page.getByRole('heading', { level: 2, name: 'Vers le bord' }).boundingBox())!;

      await verdict.getByRole('button', { name: 'Partager' }).click();
      await expect(verdict.getByText(/^Copié\s!$/)).toBeVisible();
      const apres = (await verdict.boundingBox())!;
      expect(Math.abs(apres.height - avant.height)).toBeLessThanOrEqual(1);
      expect((await pointVisible(page, 'E1')).y).toBeLessThan(apres.y - 12);
      // Le titre ne bouge pas.
      expect(Math.abs((await page.getByRole('heading', { level: 2, name: 'Vers le bord' }).boundingBox())!.y - titreAvant.y)).toBeLessThanOrEqual(1);
      // « Copié ! » est dans le bouton lui-même (44 px), et le lecteur d'écran l'entend.
      const bouton = verdict.getByRole('button', { name: 'Copié !' });
      await expect(bouton).toBeVisible();
      expect((await bouton.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await expect(page.getByRole('status').filter({ hasText: 'Colle-le dans un message' })).toHaveCount(1);
      // Deux secondes plus tard, le bouton redevient « Partager ».
      await expect(verdict.getByRole('button', { name: 'Partager' })).toBeVisible({ timeout: 4000 });
    });
  }
});

test.describe('#293 : le lendemain, les erreurs à rejouer', () => {
  // Erreur ratée la veille (28/09) : elle est due le 29/09.
  const ROWS = ['.........', '.........', '..O...X..', '.........', '....X....', '.........', '..X...O..', '.........', '.........'];
  const ERREUR = {
    id: 'erreur-veille', creeLe: '2026-09-28T19:00:00.000Z', prochain: '2026-09-29', rates: 1,
    size: 9, rows: ROWS, toPlay: 1, reponses: [6 * 9 + 4], joue: 0, coup: 14, adversaire: 'Pomme',
  };
  for (const [largeur, hauteur] of [[390, 844], [320, 640]] as const) {
    test(`juste sous le Go du jour, une seule action principale (${largeur} px)`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: hauteur });
      await page.clock.setFixedTime(new Date('2026-09-29T12:00:00+02:00'));
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript(e => {
        if (sessionStorage.getItem('erreurs-pretes')) return;
        sessionStorage.setItem('erreurs-pretes', '1');
        localStorage.setItem('go.erreurs.v1', JSON.stringify([e]));
      }, ERREUR);
      await page.goto('/');
      await page.getByRole('navigation').getByRole('button', { name: 'Problèmes' }).click();
      const erreurs = page.getByRole('heading', { level: 2, name: /Tes erreurs à rejouer/ });
      await expect(erreurs).toBeVisible();
      const [jour, probs, rejouer] = await Promise.all([
        page.locator('#jour-titre').boundingBox(),
        page.getByRole('heading', { level: 2, name: 'Problèmes' }).boundingBox(),
        page.getByRole('button', { name: /^Rejouer : Ta partie contre Pomme/ }).boundingBox(),
      ]);
      // Juste sous le Go du jour, avant la liste des problèmes (et donc avant « Tous les problèmes »).
      const e = (await erreurs.boundingBox())!;
      expect(e.y).toBeGreaterThan(jour!.y);
      expect(e.y).toBeLessThan(probs!.y);
      const revision = page.getByRole('heading', { level: 2, name: /Révision du jour/ });
      if (await revision.count()) expect(e.y).toBeLessThan((await revision.boundingBox())!.y);
      // Une vignette, comme les autres problèmes, et pas un grand plateau pleine largeur.
      expect(rejouer!.width).toBeLessThan(largeur * 0.6);
      // Une seule action en relief : le Go du jour.
      await expect(page.locator('.problemes .cta:visible')).toHaveCount(1);
      await expect(page.locator('.problemes .cta')).toHaveText('Résoudre');
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(largeur);
    });
  }
});
