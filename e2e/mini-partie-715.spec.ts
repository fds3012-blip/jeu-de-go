import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { attendrePierre, jouer, pierres, toucher } from './plateau';
import { coupDeLAide } from './mini';

// #715 : « Ta première partie », mini-partie 5 × 5 contre Pomme juste après les règles. Le premier qui capture 3 pierres
// gagne ; suivre l'aide de Mochi gagne toujours (prouvé par src/content/miniPartie.test.ts) ; première capture et victoire
// se fêtent sobrement ; « Encore une mini-partie » rejoue sans redonner d'XP.

const SANS_REPONSE = (baseURL: string) => ({ storageState: { cookies: [], origins: [{ origin: baseURL, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }] }] } });
const bulle = (page: Page) => page.locator('.mochi-bulle p');
const mini = (page: Page) => page.locator('.mini-partie');

/** Ouvre l'introduction en version express, passe ses 10 écrans, et arrive sur la mini-partie. */
async function versLaMiniPartie(browser: Browser, baseURL: string, o: { w?: number; h?: number; reduit?: boolean; theme?: 'dark' | 'light'; tactile?: boolean; sansHasard?: boolean } = {}) {
  const ctx = await browser.newContext({ ...SANS_REPONSE(baseURL), viewport: { width: o.w ?? 390, height: o.h ?? 844 }, reducedMotion: o.reduit === false ? 'no-preference' : 'reduce',
    colorScheme: o.theme ?? 'dark', hasTouch: !!o.tactile, isMobile: !!o.tactile });
  // `sansHasard` : Pomme joue toujours son premier coup permis (B5, C5…), jamais sur les points que le test joue.
  if (o.sansHasard) await ctx.addInitScript(() => { Math.random = () => 0; });
  const page = await ctx.newPage();
  await page.goto('/');
  await page.getByRole('region', { name: 'Tu connais le go ?' }).getByRole('button', { name: 'Un peu', exact: true }).click();
  for (let i = 0; i < 10; i++) await page.getByTestId('je-sais').click();
  await expect(mini(page)).toBeVisible();
  return { ctx, page };
}

async function attendreMonTour(page: Page) { await expect(mini(page)).toHaveAttribute('data-phase', 'noir'); }
async function tient(page: Page, largeur: number, etat = '') {
  const m = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, vh: innerHeight, w: document.documentElement.scrollWidth }));
  expect(m.h, `${etat} ${JSON.stringify(m)}`).toBeLessThanOrEqual(m.vh);
  expect(m.w, etat).toBeLessThanOrEqual(largeur);
}

test('première partie : capture, coup de pouce, victoire, XP une seule fois, encore une mini-partie', async ({ browser, baseURL }) => {
  const { ctx, page } = await versLaMiniPartie(browser, baseURL!);
  await expect(page.locator('.lecteur-titre')).toHaveText('Ta première partie');
  await expect(bulle(page)).toContainText('Pomme a laissé des pierres en atari. Capture-en 3 avant qu’elle t’en prenne 3.');
  await expect(page.locator('.etapes')).toHaveAttribute('aria-valuenow', '0');
  await expect(page.getByRole('button', { name: 'Un coup de pouce' })).toBeVisible();
  await expect(page.getByTestId('mini-prises-pomme')).toHaveCount(0); // un zéro ne dit rien
  await expect(pierres(page, 'blanc', 5)).toHaveCount(4);

  // Première capture, trouvée seul : B5 prend A5 (le coin n'a plus qu'une liberté).
  await jouer(page, 'B5', 5);
  await attendrePierre(page, 'A5', null, 5);
  await expect(bulle(page)).toContainText('Première capture ! Encore 2 pierres à prendre.');
  await expect(page.locator('.mochi-bulle')).toHaveClass(/verdict-juste/);
  await expect(page.locator('.etapes')).toHaveAttribute('aria-valuenow', '1');
  await attendreMonTour(page);

  // Le coup de pouce montre un point, annoncé comme tel ; le jouer capture.
  await page.getByRole('button', { name: 'Un coup de pouce' }).click();
  await expect(bulle(page)).toContainText('Un coup de pouce : jouer sur le point marqué capture une pierre.');
  await jouer(page, await coupDeLAide(page), 5);
  // Si Pomme a prolongé un coin, l'aide prend deux pierres d'un coup et la partie est déjà gagnée.
  await expect(page.locator('.etapes').or(page.getByTestId('fin-intro'))).toBeVisible();
  if (await mini(page).isVisible()) {
    await expect(page.locator('.etapes')).toHaveAttribute('aria-valuenow', '2');
    await expect(bulle(page)).toContainText(/Et de deux\s!\sPlus qu’une\.|Deux d’un coup\s!\sPlus qu’une\./);
    await attendreMonTour(page);
    await jouer(page, await coupDeLAide(page), 5);
  }

  // Victoire : la fin de l'introduction, fêtée, avec l'XP et « Encore une mini-partie ».
  const fin = page.getByTestId('fin-intro');
  await expect(fin).toBeVisible();
  await expect(fin).toHaveAttribute('data-victoire', 'true');
  await expect(page.getByRole('heading', { name: 'Victoire !' })).toBeFocused();
  await expect(fin).toContainText('Tu as capturé 3 pierres de Pomme. Maintenant, une vraie partie avec Mochi.');
  await expect(page.locator('.xp-en-ligne')).toBeVisible();
  await expect(page.locator('.cta')).toHaveCount(1);
  const xp1 = await page.evaluate(() => Number(JSON.parse(localStorage.getItem('go.xp.v1') || '0')));
  expect(xp1).toBeGreaterThan(0);
  expect(await page.evaluate(() => localStorage.getItem('go.mini-partie.v1'))).toBe('{"gagnee":true}');

  // Encore une mini-partie : un autre départ (trois coins), gagnée de même, sans redonner d'XP.
  await fin.getByRole('button', { name: 'Encore une mini-partie' }).click();
  await expect(mini(page)).toBeVisible();
  await expect(pierres(page, 'blanc', 5)).toHaveCount(3);
  for (let i = 0; i < 3; i++) {
    await attendreMonTour(page);
    await jouer(page, await coupDeLAide(page), 5);
    if (await page.getByTestId('fin-intro').isVisible()) break;
  }
  await expect(page.getByTestId('fin-intro')).toHaveAttribute('data-victoire', 'true');
  expect(await page.evaluate(() => Number(JSON.parse(localStorage.getItem('go.xp.v1') || '0')))).toBe(xp1);

  // « Partie de découverte avec Mochi » reste l'action principale de la fin (#677).
  await expect(page.getByRole('button', { name: 'Partie de découverte avec Mochi', exact: true })).toBeVisible();
  await ctx.close();
});

test('avec les animations : Pomme réfléchit, puis joue ; le coup de pouce se montre seul après deux coups sans capture', async ({ browser, baseURL }) => {
  const { ctx, page } = await versLaMiniPartie(browser, baseURL!, { reduit: false, sansHasard: true });
  await jouer(page, 'C3', 5); // aucune capture
  await expect(bulle(page)).toContainText('Pomme réfléchit…');
  await expect(mini(page)).toHaveAttribute('data-phase', 'pomme');
  await jouer(page, 'D3', 5); // Pomme réfléchit : le plateau ne répond pas
  await expect(pierres(page, 'noir', 5)).toHaveCount(9);
  await attendreMonTour(page);
  await expect(bulle(page)).toContainText('Cherche une pierre blanche qui n’a plus qu’une liberté.');
  await jouer(page, 'A3', 5); // deuxième coup sans capture
  await attendreMonTour(page);
  await expect(bulle(page)).toContainText('Un coup de pouce : jouer sur le point marqué capture une pierre.');
  await expect(page.getByRole('button', { name: 'Un coup de pouce' })).toHaveCount(0);
  await ctx.close();
});

test('au doigt, la pose se confirme comme en partie (pierre fantôme, puis seconde touche)', async ({ browser, baseURL }) => {
  const { ctx, page } = await versLaMiniPartie(browser, baseURL!, { tactile: true });
  await toucher(page, 'B5', 5);
  await expect(pierres(page, 'blanc', 5)).toHaveCount(4); // première touche : pierre fantôme seulement
  await toucher(page, 'B5', 5);
  await attendrePierre(page, 'A5', null, 5);
  await expect(page.locator('.etapes')).toHaveAttribute('aria-valuenow', '1');
  await ctx.close();
});

for (const [w, h] of [[390, 844], [320, 568]] as const) {
  for (const theme of ['dark', 'light'] as const) {
    test(`${w} × ${h}, ${theme === 'dark' ? 'sombre' : 'clair'} : la mini-partie et sa fin tiennent sans défiler, sans violation axe`, async ({ browser, baseURL }) => {
      const { ctx, page } = await versLaMiniPartie(browser, baseURL!, { w, h, theme });
      await tient(page, w, 'début');
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations.map(v => v.id)).toEqual([]);
      await jouer(page, 'B5', 5);
      await attendrePierre(page, 'A5', null, 5);
      await tient(page, w, 'première capture');
      await attendreMonTour(page);
      await page.getByRole('button', { name: 'Un coup de pouce' }).click();
      await tient(page, w, 'coup de pouce');
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations.map(v => v.id)).toEqual([]);
      for (let i = 0; i < 2; i++) { await attendreMonTour(page); await jouer(page, await coupDeLAide(page), 5); if (await page.getByTestId('fin-intro').isVisible()) break; }
      await expect(page.getByTestId('fin-intro')).toBeVisible();
      await tient(page, w, 'victoire (version express : trois actions)');
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations.map(v => v.id)).toEqual([]);
      for (const nom of ['Partie de découverte avec Mochi', 'Encore une mini-partie', 'Jouer contre Pomme']) {
        const b = await page.getByRole('button', { name: nom, exact: true }).boundingBox();
        expect(b!.height, nom).toBeGreaterThanOrEqual(44);
        expect(b!.y + b!.height, nom).toBeLessThanOrEqual(h);
      }
      await ctx.close();
    });
  }
}
