import { expect, test, type Page } from '@playwright/test';
import { jouerSuite, partieADeux, plateau } from './plateau';

// Issue #109 : thèmes du goban débloqués par niveau, choisis dans le Profil, visibles en partie.
const XP_NIVEAU_5 = 575; // seuil(5) dans src/app/xp.ts

async function ouvrirProfil(page: Page) {
  await page.getByRole('navigation').getByRole('button', { name: 'Profil' }).click();
  return page.getByRole('group', { name: 'Goban' });
}

test('niveau 5 : Ardoise se choisit dans le Profil et habille le goban en partie', async ({ page }) => {
  await page.addInitScript(xp => { if (!localStorage.getItem('go.xp.v1')) localStorage.setItem('go.xp.v1', String(xp)); }, XP_NIVEAU_5);
  await page.goto('/');
  const goban = await ouvrirProfil(page);

  // Coquillage doré (niveau 8) reste verrouillé et affiche son niveau.
  const dore = goban.getByRole('button', { name: 'Coquillage doré, débloqué au niveau 8' });
  await expect(dore).toHaveAttribute('aria-disabled', 'true');
  await expect(dore).toContainText('Niv. 8');
  await dore.click({ force: true });
  await expect(dore).toHaveAttribute('aria-pressed', 'false');

  await expect(goban.getByRole('button', { name: 'Kaya', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const ardoise = goban.getByRole('button', { name: 'Ardoise', exact: true });
  await ardoise.click();
  await expect(ardoise).toHaveAttribute('aria-pressed', 'true');
  for (const b of await goban.getByRole('button').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const largeur = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  expect(largeur).toBe(true);

  await partieADeux(page);
  const bois = plateau(page).locator('image').first();
  const href = decodeURIComponent((await bois.getAttribute('href'))!);
  expect(href).toContain('#7C8792'); // fond de l'ardoise
  await jouerSuite(page, ['D5', 'E5']);
  await page.screenshot({ path: 'docs/design/v2/captures/themes-ardoise.png' });
});

test('sans le niveau requis, un thème stocké à la main ne s\'applique pas', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('go.themeGoban.v1', JSON.stringify('coquillage-dore')));
  await partieADeux(page);
  const href = decodeURIComponent((await plateau(page).locator('image').first().getAttribute('href'))!);
  expect(href).toContain('#DDA95C'); // kaya par défaut
});

// Captures 390 × 844 des quatre thèmes (docs/design/v2/captures/themes-*.png).
for (const id of ['kaya', 'kaya-clair', 'coquillage-dore'] as const) {
  test(`capture du thème ${id}`, async ({ page }) => {
    await page.addInitScript(t => {
      localStorage.setItem('go.xp.v1', '5000');
      localStorage.setItem('go.themeGoban.v1', JSON.stringify(t));
    }, id);
    await partieADeux(page);
    await jouerSuite(page, ['D5', 'E5', 'E4', 'D4']);
    await page.screenshot({ path: `docs/design/v2/captures/themes-${id}.png` });
  });
}
