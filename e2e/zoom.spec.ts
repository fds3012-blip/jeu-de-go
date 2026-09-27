import { expect, test, type Locator, type Page } from '@playwright/test';

// Issue #121 : zoom 200 % et reflow (WCAG 1.4.4 et 1.4.10).
// - 195 × 422 : un iPhone de 390 px zoomé à 200 % ;
// - 320 × 640 : plus petite largeur CSS exigée par 1.4.10 ;
// - 390 × 844 avec la taille de police racine doublée (texte agrandi à 200 %).
// Sur chaque écran principal : pas de défilement horizontal, et le bouton principal
// est entier dans la largeur et n'est recouvert par rien.

type Cas = { nom: string; largeur: number; hauteur: number; police?: boolean };
const CAS: Cas[] = [
  { nom: 'zoom 200 % (195 px)', largeur: 195, hauteur: 422 },
  { nom: '320 px', largeur: 320, hauteur: 640 },
  { nom: 'police doublée (390 px)', largeur: 390, hauteur: 844, police: true },
];

async function sansDebord(page: Page, ecran: string) {
  const m = await page.evaluate(() => {
    const d = document.documentElement;
    // Éléments qui dépassent à droite : utile pour savoir quoi corriger quand le test échoue.
    // Le dernier élément HTML dont le contenu déborde de sa boîte est en général la cause.
    const fautifs = [...document.querySelectorAll('body *')]
      .filter(e => e instanceof HTMLElement && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === 'visible')
      .slice(-4)
      .map(e => `${e.tagName.toLowerCase()}.${String(e.className).split(' ').join('.')} (${e.scrollWidth} > ${e.clientWidth})`);
    return { scroll: d.scrollWidth, client: d.clientWidth, fautifs };
  });
  expect(m.scroll, `${ecran} : défilement horizontal (${m.fautifs.join(' ; ')})`).toBeLessThanOrEqual(m.client);
}

async function boutonLibre(bouton: Locator, ecran: string) {
  await bouton.scrollIntoViewIfNeeded();
  await expect(bouton).toBeVisible();
  const r = await bouton.evaluate((el: HTMLElement) => {
    const b = el.getBoundingClientRect();
    const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
    const dessus = document.elementFromPoint(cx, cy);
    return {
      gauche: b.left, droite: b.right, largeur: document.documentElement.clientWidth,
      libre: !!dessus && (el === dessus || el.contains(dessus)),
      dessus: dessus ? `${dessus.tagName.toLowerCase()}.${String(dessus.className)}` : 'rien',
      // Texte coupé : contenu plus large que la boîte sans retour à la ligne possible.
      coupe: el.scrollWidth > el.clientWidth + 1,
    };
  });
  expect(r.gauche, `${ecran} : bouton principal coupé à gauche`).toBeGreaterThanOrEqual(0);
  expect(r.droite, `${ecran} : bouton principal coupé à droite`).toBeLessThanOrEqual(r.largeur + 1);
  expect(r.libre, `${ecran} : bouton principal recouvert par ${r.dessus}`).toBe(true);
  expect(r.coupe, `${ecran} : texte du bouton principal coupé`).toBe(false);
}

const onglet = (page: Page, nom: string) =>
  page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button', { name: nom });

for (const c of CAS) {
  test.describe(c.nom, () => {
    test.use({ viewport: { width: c.largeur, height: c.hauteur } });
    test.beforeEach(async ({ page }) => {
      if (c.police) await page.addInitScript(() => {
        document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = '200%'; });
      });
    });

    test('accueil, problèmes, profil et apprendre sans défilement horizontal', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('.cta')).toBeVisible();
      await sansDebord(page, 'Accueil');
      await boutonLibre(page.locator('.cta'), 'Accueil');

      // Barre du bas : les onglets ne se chevauchent pas.
      const boites = [];
      for (const n of ['Jouer', 'Apprendre', 'Problèmes', 'Profil']) boites.push((await onglet(page, n).boundingBox())!);
      for (let i = 1; i < boites.length; i++) expect(boites[i].x, 'onglets de la barre du bas qui se chevauchent').toBeGreaterThanOrEqual(boites[i - 1].x + boites[i - 1].width - 1);

      await onglet(page, 'Problèmes').click();
      await page.waitForTimeout(300);
      await sansDebord(page, 'Problèmes');

      await onglet(page, 'Profil').click();
      await expect(page.getByRole('heading', { name: 'Réglages' })).toBeVisible();
      await sansDebord(page, 'Profil');
    });

    test('apprendre et leçon 1 sans défilement horizontal', async ({ page }) => {
      await page.goto('/');
      await onglet(page, 'Apprendre').click();
      await expect(page.getByRole('button', { name: 'Commencer' })).toBeVisible();
      await sansDebord(page, 'Apprendre');
      await boutonLibre(page.getByRole('button', { name: 'Commencer' }), 'Apprendre');

      await page.getByRole('button', { name: 'Commencer' }).click();
      await expect(page.getByRole('progressbar', { name: 'Progression de la leçon' })).toBeVisible();
      await sansDebord(page, 'Leçon 1');
    });

    test('partie contre l’ordinateur sans défilement horizontal', async ({ page }) => {
      await page.goto('/');
      await page.locator('.cta').click();
      await expect(page.locator('.board, [role="grid"]').first()).toBeVisible();
      await sansDebord(page, 'Partie');
    });
  });
}
