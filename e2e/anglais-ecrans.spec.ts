import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { jouer, plateau } from './plateau';
import { fromLabel } from '../src/go/coords';

// Version anglaise complète (#473) : les écrans clés en anglais (accueil, partie avec une bulle du coach Mochi, bilan,
// leçon, problèmes, profil), à 390 et 320 px, en sombre et en clair. Sur chacun : aucun défilement horizontal, aucun
// texte qui dépasse de l'écran, aucun libellé coupé (texte plus large que sa boîte, hors ellipses voulues).
// CAPTURES_473=<dossier> : enregistre en plus une capture par écran, largeur et thème (hors dépôt).

const DOSSIER = process.env.CAPTURES_473;

// Coups de Pomme écrits d'avance (build VITE_E2E, src/engine/index.ts) : la partie arrive sur une prise ratée, et
// Mochi la dit (sa plus longue phrase de coach). Voir e2e/coach-mochi.spec.ts.
const ORDI = ['E5', 'J9', 'J8', 'J7', 'H9', 'H8'].map(l => fromLabel(l, 9));

/** Ellipses voulues : titres de leçon et de problème dans une liste étroite (contenu, coupé exprès). */
const ELLIPSES_VOULUES = '.lecteur-nom, .vignette-titre, .pb-titre, [data-ellipse]';

async function verifier(page: Page, ecran: string, largeur: number) {
  for (const theme of ['dark', 'light'] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.waitForTimeout(150);
    const m = await page.evaluate(sel => {
      const visibles = [...document.querySelectorAll<HTMLElement>('body *')].filter(e => {
        const st = getComputedStyle(e);
        if (!e.offsetParent && st.position !== 'fixed') return false;
        // Textes pour lecteur d'écran seulement (boîte de 1 px, découpée) : jamais vus, jamais coupés à l'œil.
        const r = e.getBoundingClientRect();
        if (r.width <= 1 || r.height <= 1 || st.clip !== 'auto' || st.clipPath !== 'none') return false;
        return [...e.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.textContent!.trim());
      });
      const coupes = visibles.filter(e => {
        if (e.closest(sel)) return false;
        const s = getComputedStyle(e);
        const masque = s.overflowX !== 'visible' || s.textOverflow === 'ellipsis';
        return masque && e.scrollWidth > e.clientWidth + 1;
      }).map(e => e.textContent!.trim().slice(0, 60));
      // Dans une bande qui défile exprès (liste des coups, carrousels) : hors de l'écran, mais atteignable.
      const defile = (e: HTMLElement) => {
        for (let a = e.parentElement; a; a = a.parentElement) if (/auto|scroll/.test(getComputedStyle(a).overflowX)) return true;
        return false;
      };
      const dehors = visibles.filter(e => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && (r.right > innerWidth + 0.5 || r.left < -0.5) && !e.closest('[aria-hidden="true"]') && !defile(e);
      }).map(e => e.textContent!.trim().slice(0, 60));
      return { large: document.documentElement.scrollWidth, fenetre: innerWidth, coupes, dehors };
    }, ELLIPSES_VOULUES);
    expect(m.large, `${ecran} ${theme} : défilement horizontal`).toBeLessThanOrEqual(m.fenetre);
    expect(m.dehors, `${ecran} ${theme} : texte hors de l'écran`).toEqual([]);
    expect(m.coupes, `${ecran} ${theme} : texte coupé`).toEqual([]);
    if (DOSSIER) {
      mkdirSync(DOSSIER, { recursive: true });
      await page.screenshot({ path: join(DOSSIER, `${ecran}-en-${largeur}-${theme === 'dark' ? 'sombre' : 'clair'}.png`), fullPage: true });
    }
  }
}

for (const largeur of [390, 320]) test(`écrans clés en anglais à ${largeur} px, sombre et clair : rien ne déborde ni n'est coupé`, async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: largeur, height: largeur === 320 ? 640 : 844 });
  const erreurs: string[] = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await page.addInitScript(coups => { (window as unknown as { __coupsOrdi: number[] }).__coupsOrdi = [...coups]; }, ORDI);
  await page.goto('/?lang=en&komi=-100');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.en.webmanifest');
  const nav = page.getByRole('navigation', { name: 'Main navigation' });

  // Accueil.
  await expect(page.getByRole('button', { name: 'Play your first game against Pomme' })).toBeVisible();
  await verifier(page, 'accueil', largeur);

  // Partie : quelques coups jusqu'à la prise ratée, que Mochi signale.
  await page.getByRole('button', { name: 'Play your first game against Pomme' }).click();
  await expect(plateau(page)).toBeVisible();
  const actions = page.getByRole('toolbar', { name: 'Game actions' });
  const passer = actions.getByRole('button', { name: 'Pass', exact: true });
  const bulle = page.locator('[data-coach-bulle]');
  for (const [noir, blanc] of [['D5', 'E5'], ['F5', 'J9'], ['E6', 'J8'], ['A9', 'J7']]) {
    await expect(passer).toBeEnabled({ timeout: 10_000 });
    await jouer(page, noir);
    await expect(page.getByText(new RegExp(`Pomme plays ${blanc}`)).or(bulle)).toBeVisible({ timeout: 10_000 });
  }
  await expect(bulle).toHaveText(/Last move, you could capture a stone at E4/);
  await verifier(page, 'partie-coach', largeur);

  // Fin de partie : passes jusqu'au comptage, puis le bilan.
  const fin = page.locator('.recit, .barre-comptage .btn.primary:enabled');
  for (let i = 0; i < 8 && !(await fin.first().isVisible()); i++) {
    await expect(passer).toBeEnabled({ timeout: 15_000 });
    await passer.click();
    const choix = page.getByRole('group', { name: 'Pass now?' });
    if (await choix.waitFor({ state: 'visible', timeout: 600 }).then(() => true, () => false)) await choix.getByRole('button', { name: 'Pass', exact: true }).click();
    await page.waitForTimeout(400);
  }
  await expect(fin.first()).toBeVisible({ timeout: 15_000 });
  const valider = page.getByRole('button', { name: 'Confirm score' });
  if (await valider.isVisible()) await valider.click();
  const recit = page.getByRole('region', { name: 'Counting the points' });
  await expect(recit).toBeVisible();
  await verifier(page, 'comptage', largeur);
  await recit.getByRole('button', { name: 'See the result' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Victory' })).toBeVisible();
  await verifier(page, 'bilan', largeur);

  // Leçon : la première du chemin, puis une étape plus loin.
  await page.goto('/?lang=en');
  await nav.getByRole('button', { name: 'Learn' }).click();
  await verifier(page, 'apprendre', largeur);
  await page.locator('.cta-chemin').click();
  await expect(page.getByRole('button', { name: 'Back to the path' })).toBeVisible();
  await verifier(page, 'lecon', largeur);
  await page.getByRole('button', { name: 'Back to the path' }).click();

  // Problèmes : l'écran (Go du jour, thèmes), puis un problème.
  await nav.getByRole('button', { name: 'Puzzles' }).click();
  await expect(page.getByRole('heading', { name: /^Daily Go #\d+$/ })).toBeVisible();
  await verifier(page, 'problemes', largeur);
  await page.getByRole('button', { name: 'All puzzles' }).click();
  await page.getByRole('group', { name: 'Beginner' }).locator('[data-probleme]').first().click();
  await expect(page.getByRole('button', { name: 'Back to puzzles' })).toBeVisible();
  await verifier(page, 'probleme', largeur);
  await page.getByRole('button', { name: 'Back to puzzles' }).click();

  // Profil et réglages.
  await nav.getByRole('button', { name: 'Profile' }).click();
  await expect(page.getByRole('heading', { name: 'Your journey' })).toBeVisible();
  await verifier(page, 'profil', largeur);
  await page.getByRole('button', { name: /^Settings/ }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await verifier(page, 'reglages', largeur);
  expect(erreurs).toEqual([]);
});
