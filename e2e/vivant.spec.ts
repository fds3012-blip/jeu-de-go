import { expect, test, type Page } from '@playwright/test';

// Issue #103 : Problèmes et Profil moins fades. Paliers illustrés, sceau jade, fête du palier complet,
// statistiques et vitrine de badges. Avec CAPTURES=1, enregistre les captures 390 × 844 de docs/design/v2/captures.
const CAPTURES = !!process.env.CAPTURES;

async function preparer(page: Page, theme: 'dark' | 'light', donnees: Record<string, unknown>) {
  await page.addInitScript(([t, d]) => {
    if (sessionStorage.getItem('vivant-pret')) return;
    sessionStorage.setItem('vivant-pret', '1');
    localStorage.setItem('go.settings.v1', JSON.stringify({ theme: t }));
    for (const [k, v] of Object.entries(d as Record<string, unknown>)) localStorage.setItem(k, JSON.stringify(v));
  }, [theme, donnees] as const);
}

async function idsDebutant(page: Page) {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Problèmes' }).click();
  await page.getByRole('button', { name: 'Tous les problèmes' }).click();
  await expect(page.getByRole('group', { name: /^Débutant/ })).toBeVisible();
  return page.getByRole('group', { name: /^Débutant/ }).locator('[data-probleme]').evaluateAll(els => els.map(e => e.getAttribute('data-probleme')!));
}

test('profil vivant : statistiques et badges déduits des données locales, sans défiler', async ({ page }) => {
  await preparer(page, 'dark', {
    'go.problemes.v1': { b1: true, b4: true, b3: true },
    'go.parties.v1': { n: 4 },
    'go.bilan.v1': { pomme: { v: 2, d: 1 } },
  });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Profil' }).click();
  const stats = page.getByRole('list', { name: 'Tes statistiques' });
  await expect(stats.getByText('3', { exact: true })).toBeVisible();
  await expect(stats.getByText('problèmes réussis')).toBeVisible();
  // #214 : Ton parcours. Pomme battue : 1 adversaire sur 9.
  await expect(stats.getByText('adversaire battu')).toBeVisible();
  await expect(stats.getByText('leçon finie')).toBeVisible();
  await expect(stats.getByText('jour de série')).toBeVisible();

  const vitrine = page.getByRole('region', { name: /^Badges/ });
  await expect(vitrine.getByRole('button', { name: 'Pomme battue : obtenu' })).toBeVisible();
  await expect(vitrine.getByRole('button', { name: 'Première partie : obtenu' })).toBeVisible();
  await expect(vitrine.getByRole('button', { name: /^7 jours de série : à gagner/ })).toHaveCount(1);

  if (CAPTURES) await page.screenshot({ path: 'test-results/profil-plein.png', fullPage: true });
  const { scroll, largeur } = await page.evaluate(() => ({ scroll: document.documentElement.scrollHeight, largeur: document.documentElement.scrollWidth }));
  expect(scroll).toBeLessThanOrEqual(844);
  expect(largeur).toBeLessThanOrEqual(390);
});

for (const theme of ['dark', 'light'] as const) {
  test(`paliers illustrés et palier complet en or (${theme === 'dark' ? 'sombre' : 'clair'})`, async ({ page }) => {
    const ids = await idsDebutant(page);
    await page.evaluate(([t, v]) => {
      localStorage.setItem('go.settings.v1', JSON.stringify({ theme: t }));
      localStorage.setItem('go.problemes.v1', JSON.stringify(v));
      localStorage.setItem('go.parties.v1', JSON.stringify({ n: 5 }));
      localStorage.setItem('go.bilan.v1', JSON.stringify({ pomme: { v: 1, d: 0 } }));
    }, [theme, Object.fromEntries([...ids.map(id => [id, true]), ['b3', true]])] as const);
    await page.reload();
    await page.getByRole('navigation').getByRole('button', { name: 'Problèmes' }).click();
    await page.getByRole('button', { name: 'Tous les problèmes' }).click();

    const debutant = page.getByRole('group', { name: /^Débutant/ });
    await expect(debutant.getByRole('img', { name: 'Palier complet' })).toBeVisible();
    await expect(debutant.locator('.pastille-ok')).toHaveCount(ids.length);
    // La fête ne se joue qu'une fois : le palier est noté comme fêté.
    await expect.poll(() => page.evaluate(() => localStorage.getItem('go.paliers-fetes.v1'))).toContain('debutant');
    const debord = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(debord).toBeLessThanOrEqual(0);

    if (CAPTURES) {
      const nom = theme === 'dark' ? 'sombre' : 'clair';
      await page.waitForTimeout(1200);
      await debutant.scrollIntoViewIfNeeded();
      await page.getByRole('heading', { name: 'Problèmes', level: 2 }).evaluate(e => e.scrollIntoView());
      await page.screenshot({ path: `docs/design/v2/captures/vivant-problemes-${nom}.png` });
      await page.getByRole('navigation').getByRole('button', { name: 'Profil' }).click();
      await page.screenshot({ path: `docs/design/v2/captures/vivant-profil-${nom}.png` });
    }
  });
}
