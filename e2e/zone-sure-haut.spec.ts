import { expect, test, type Page } from '@playwright/test';

// #618 (lot V3, principe P9) : rien ne passe sous la barre d'état quand la page défile.
// Chromium n'a pas d'encoche : env(safe-area-inset-top) y vaut 0. On simule celle d'un iPhone 12 à 15 (47 px)
// en surchargeant --zone-haut, la variable qui porte la zone sûre du haut dans app.css.
const ENCOCHE = 47;

async function simulerEncoche(page: Page) {
  await page.addStyleTag({ content: `html:root { --zone-haut: ${ENCOCHE}px; }` });
}

/** Les pixels de la bande de la barre d'état. */
async function bande(page: Page) {
  return page.screenshot({ clip: { x: 0, y: 0, width: 390, height: ENCOCHE }, animations: 'disabled' });
}

for (const theme of ['dark', 'light'] as const) {
  for (const onglet of ['Apprendre', 'Problèmes'] as const) {
    test(`${onglet} (${theme === 'dark' ? 'sombre' : 'clair'}) : la zone de la barre d'état reste sur le fond au défilement`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.goto('/');
      await page.getByRole('navigation').getByRole('button', { name: onglet }).click();
      await simulerEncoche(page);
      // Le contenu commence sous la zone sûre, en haut de page.
      expect(await page.evaluate(() => parseFloat(getComputedStyle(document.body).paddingTop))).toBe(ENCOCHE);
      // #643 : l'écran se charge à la demande (React.lazy, Suspense sans repli ; Problèmes passe aussi par
      // « problemes-chargement »). Tant qu'il n'est pas monté, la page fait juste la hauteur de la fenêtre et
      // scrollTo(0, 240) reste à 0. On attend que la page soit assez haute pour défiler de 240 px.
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)).toBeGreaterThanOrEqual(240);

      await page.evaluate(() => window.scrollTo(0, 0));
      const enHaut = await bande(page);

      // On fait défiler : la page défile vraiment, et la bande est la même qu'en haut de page (le fond, rien d'autre).
      await page.evaluate(() => window.scrollTo(0, 240));
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
      expect(Buffer.compare(await bande(page), enHaut)).toBe(0);

      // Et le contenu passe bien dessous : le premier titre est remonté au-dessus de la ligne de la zone sûre.
      const yTitre = await page.locator('main h1, .app h1, .app h2').first().evaluate((el) => el.getBoundingClientRect().bottom);
      expect(yTitre).toBeLessThan(ENCOCHE);
    });
  }
}

test('sans encoche, la bande ne prend aucune place', async ({ page }) => {
  await page.goto('/');
  const h = await page.evaluate(() => getComputedStyle(document.body, '::before').height);
  expect(h).toBe('0px');
});
