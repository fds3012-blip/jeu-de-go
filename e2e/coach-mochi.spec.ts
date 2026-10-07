import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { jouer, ouvrirPlus, plateau } from './plateau';
import { fromLabel } from '../src/go/coords';

// Coach Mochi pendant les parties contre l'IA (#470). Les coups de Pomme sont écrits d'avance (`window.__coupsOrdi`,
// build VITE_E2E seulement, voir src/engine/index.ts) : la partie arrive à coup sûr sur une prise ratée.
//
// Noir D5, Blanc E5 ; Noir F5, Blanc J9 ; Noir E6 (Blanc E5 en atari, prise en E4), Blanc J8 ;
// Noir A9 (prise ratée), Blanc J7 : Mochi le dit après la réponse de Pomme.

const ORDI = ['E5', 'J9', 'J8', 'J7', 'H9', 'H8'].map(l => fromLabel(l, 9));
const bulle = (page: Page) => page.locator('[data-coach-bulle]');
const PHRASE = /Au coup d.avant, tu pouvais prendre une pierre en E4/;

async function preparer(page: Page, stockage: Record<string, string> = {}) {
  await page.addInitScript(({ coups, stockage }) => {
    (window as unknown as { __coupsOrdi: number[] }).__coupsOrdi = [...coups];
    for (const [k, v] of Object.entries(stockage)) localStorage.setItem(k, v);
  }, { coups: ORDI, stockage });
  await page.goto('/');
  await page.locator('.cta').click();
  await expect(plateau(page)).toBeVisible();
}

/** Joue un coup de Noir et attend la réponse de Pomme : son coup annoncé, ou la bulle du coach à sa place. */
async function coup(page: Page, label: string, reponse: string) {
  await jouer(page, label);
  await expect(page.getByText(new RegExp(`Pomme joue ${reponse}`)).or(bulle(page))).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('toolbar').getByRole('button', { name: 'Passer', exact: true })).toBeEnabled();
}

async function jusquALaPriseRatee(page: Page) {
  for (const [noir, blanc] of [['D5', 'E5'], ['F5', 'J9'], ['E6', 'J8']]) {
    await coup(page, noir, blanc);
    await expect(bulle(page)).toHaveCount(0); // rien de sûr à dire : Mochi se tait
  }
  await coup(page, 'A9', 'J7');
}

test.use({ reducedMotion: 'reduce' });

test('prise ratée : une bulle sous le plateau, vraie, avec le point montré ; elle part dès que tu joues', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await preparer(page);
  await jusquALaPriseRatee(page);

  await expect(bulle(page)).toHaveText(PHRASE);
  await expect(bulle(page).locator('p')).toHaveAttribute('aria-live', 'polite');
  // Le calque montre le point, sans capter les touches.
  const calque = page.locator('.partie-plateau .calque-conseil');
  await expect(calque).toHaveAttribute('data-point', 'E4');
  await expect(calque).toHaveCSS('pointer-events', 'none');
  // La bulle n'occulte pas le plateau.
  const b = (await bulle(page).boundingBox())!, p = (await plateau(page).boundingBox())!;
  expect(b.y).toBeGreaterThanOrEqual(p.y + p.height - 1);
  // Bouton « Couper le coach » : 44 px au moins.
  const couper = bulle(page).getByRole('button', { name: 'Couper le coach' });
  const c = (await couper.boundingBox())!;
  expect(c.width).toBeGreaterThanOrEqual(44);
  expect(c.height).toBeGreaterThanOrEqual(44);

  // Contraste et rôles de la bulle, en sombre et en clair.
  for (const theme of ['dark', 'light'] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    const { violations } = await new AxeBuilder({ page }).include('.partie-mochi').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(violations.map(v => `${theme} ${v.id}`)).toEqual([]);
  }

  // Le coach ne joue jamais à ta place : rien n'a bougé sur le plateau, c'est toujours à toi.
  await expect(page.getByRole('toolbar').getByRole('button', { name: 'Passer', exact: true })).toBeEnabled();
  // Tu joues (la prise) : la bulle disparaît aussitôt, Pomme réfléchit sans Mochi.
  await jouer(page, 'E4');
  await expect(bulle(page)).toHaveCount(0);
  await expect(calque).toHaveCount(0);
  expect(erreurs).toEqual([]);
});

test('couper le coach depuis sa bulle, puis le rallumer dans « Plus » ; le réglage est gardé', async ({ page }) => {
  await preparer(page);
  await jusquALaPriseRatee(page);
  await expect(bulle(page)).toHaveText(PHRASE);
  await bulle(page).getByRole('button', { name: 'Couper le coach' }).click();
  await expect(bulle(page)).toHaveCount(0);
  await expect(page.getByText(/je me tais/)).toBeVisible();
  const reglage = () => page.evaluate(() => JSON.parse(localStorage.getItem('go.settings.v1') || '{}').coach);
  expect(await reglage()).toBe('non');

  const menu = await ouvrirPlus(page);
  const inter = menu.getByRole('switch', { name: 'Coach Mochi' });
  await expect(inter).toHaveAttribute('aria-checked', 'false');
  await inter.click();
  await expect(inter).toHaveAttribute('aria-checked', 'true');
  expect(await reglage()).toBe('oui');
});

test('après 10 parties, le coach se tait (réglage « Au début »)', async ({ page }) => {
  await preparer(page, { 'go.parties.v1': JSON.stringify({ n: 10, dernier: 'pomme', ordi: 10 }) });
  await jusquALaPriseRatee(page);
  await expect(page.getByText(/Pomme joue J7/)).toBeVisible();
  await expect(bulle(page)).toHaveCount(0);
  const menu = await ouvrirPlus(page);
  await expect(menu.getByRole('switch', { name: 'Coach Mochi' })).toHaveAttribute('aria-checked', 'false');
});

// Zoom 200 % et reflow (comme e2e/zoom.spec.ts) : 195 px (390 px zoomé), 320 px, et police racine doublée.
for (const [largeur, hauteur, police] of [[195, 422, false], [320, 640, false], [390, 844, true]] as const) {
  test.describe(`${largeur} px${police ? ', police doublée' : ''}`, () => {
    test.use({ viewport: { width: largeur, height: hauteur } });
    test('la bulle tient sans défilement horizontal, sous le plateau, et son bouton est libre', async ({ page }) => {
      if (police) await page.addInitScript(() => {
        document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = '200%'; });
      });
      // Sixième partie (le coach parle encore) : sans la bulle « Le but » du tout premier coup, posée sur le plateau en 195 px.
      await preparer(page, { 'go.parties.v1': JSON.stringify({ n: 5, dernier: 'pomme', ordi: 5 }), 'go.intro-but.v1': 'true' });
      await jusquALaPriseRatee(page);
      await expect(bulle(page)).toHaveText(PHRASE);
      const m = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
      expect(m.scroll).toBeLessThanOrEqual(m.client);
      const b = (await bulle(page).boundingBox())!, p = (await plateau(page).boundingBox())!;
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(largeur + 1);
      expect(b.y).toBeGreaterThanOrEqual(p.y + p.height - 1);
      const couper = bulle(page).getByRole('button', { name: 'Couper le coach' });
      // Texte agrandi : la page défile ; en bas de page, la barre d'actions fixe ne cache plus le bouton.
      await page.evaluate(() => window.scrollTo(0, document.scrollingElement!.scrollHeight));
      const r = await couper.evaluate((el: HTMLElement) => {
        const b = el.getBoundingClientRect(), dessus = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        return { libre: !!dessus && (el === dessus || el.contains(dessus)), droite: b.right, largeur: document.documentElement.clientWidth,
          dessus: dessus ? `${dessus.tagName.toLowerCase()}.${String(dessus.className)}` : 'rien' };
      });
      expect(r.droite).toBeLessThanOrEqual(r.largeur + 1);
      expect(r.libre, `bouton recouvert par ${r.dessus}`).toBe(true);
    });
  });
}

test('Réglages : « Coach Mochi en partie » se règle (Au début, Toujours, Jamais)', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Profil' }).click();
  await page.getByRole('button', { name: /^Réglages/ }).click();
  const groupe = page.getByRole('group', { name: 'Coach Mochi en partie' });
  await expect(groupe).toBeVisible();
  await groupe.getByRole('button', { name: 'Jamais' }).or(groupe.getByRole('radio', { name: 'Jamais' })).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('go.settings.v1') || '{}').coach)).toBe('non');
});
