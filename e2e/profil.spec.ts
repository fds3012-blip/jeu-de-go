import { expect, test } from '@playwright/test';

// Issue #50 : Profil court, qui tient dans l'écran d'un iPhone sans défiler.
// Issue #214 : « Ton parcours » d'abord, les réglages derrière une ligne.
for (const theme of ['dark', 'light'] as const) {
  test(`Profil tient sans défiler en 390 × 844 (${theme === 'dark' ? 'sombre' : 'clair'})`, async ({ page }) => {
    await page.addInitScript(t => localStorage.setItem('go.settings.v1', JSON.stringify({ theme: t })), theme);
    await page.goto('/');
    await page.getByRole('navigation').getByRole('button', { name: 'Profil' }).click();
    await expect(page.getByRole('heading', { name: 'Ton parcours' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Réglages/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Mon compte/ })).toBeVisible();

    const { scroll, hauteur, largeur, fenetre } = await page.evaluate(() => ({
      scroll: document.documentElement.scrollHeight, hauteur: innerHeight, largeur: document.documentElement.scrollWidth, fenetre: innerWidth,
    }));
    expect(hauteur).toBe(844);
    expect(scroll).toBeLessThanOrEqual(hauteur);
    expect(largeur).toBeLessThanOrEqual(fenetre);

    // Dernier lien au-dessus de la barre de navigation.
    const lien = (await page.getByRole('button', { name: 'Conditions et confidentialité' }).boundingBox())!;
    const nav = (await page.getByRole('navigation').boundingBox())!;
    expect(lien.y + lien.height).toBeLessThanOrEqual(nav.y);
  });
}

test('Ton parcours : niveau et XP, record, leçons, adversaires battus, problèmes réussis sans total, vitrine', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    if (sessionStorage.getItem('parcours-pret')) return;
    sessionStorage.setItem('parcours-pret', '1');
    const d: Record<string, unknown> = {
      'go.xp.v1': 420, // niveau 4
      'go.bilan.v1': { pomme: { v: 2, d: 1 }, caillou: { v: 1, d: 0 }, bambou: { v: 0, d: 2 } },
      'go.parties.v1': { n: 6 },
      'go.problemes.v1': { b1: true, b3: true, b4: true },
      'go.lecons.v1': { l1: 6, l2: 6 },
      'go.serie-record.v1': { record: 7, perdue: null },
    };
    for (const [k, v] of Object.entries(d)) localStorage.setItem(k, JSON.stringify(v));
  });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Profil' }).click();

  const carte = page.getByRole('region', { name: 'Ton profil' });
  await expect(carte.getByRole('progressbar', { name: 'Niveau 4' })).toBeVisible();
  await expect(carte.getByTestId('barre-niveau')).toContainText(/XP/);
  const stats = page.getByRole('list', { name: 'Tes statistiques' });
  const lignes = stats.getByRole('listitem');
  await expect(lignes).toHaveCount(4);
  await expect(lignes.nth(0)).toHaveText(/^7\s*jours de record$/);
  await expect(lignes.nth(1)).toHaveText(/^2\/7\s*leçons finies sur 7$/);
  await expect(lignes.nth(2)).toHaveText(/^2\/9\s*adversaires battus sur 9$/);
  await expect(lignes.nth(3)).toHaveText(/^3\s*problèmes réussis$/); // sans total : les problèmes n'ont pas de fin
  await expect(page.getByRole('region', { name: /^Badges/ }).getByRole('listitem', { name: 'Pomme battue : obtenu' })).toBeVisible();

  // Les réglages ne sont plus sur la page : ils sont derrière leur ligne.
  await expect(page.getByRole('group', { name: 'Thème' })).toHaveCount(0);
  const nav = (await page.getByRole('navigation').boundingBox())!;
  for (const el of [carte, stats, page.getByRole('region', { name: /^Badges/ }), page.getByRole('button', { name: /^Réglages/ })]) {
    const b = (await el.boundingBox())!;
    expect(b.y + b.height, 'Ton parcours tient au premier écran').toBeLessThanOrEqual(nav.y);
  }
  for (const b of await page.locator('.profil .lignes button').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
});

test('réglages en lignes : thème segmenté, interrupteurs, cibles de 44 px', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Profil' }).click();
  // #214 : une ligne « Réglages » ouvre la sous-vue ; tous les réglages d'avant y sont.
  await page.getByRole('button', { name: /^Réglages/ }).click();
  await expect(page.getByRole('heading', { name: 'Réglages' })).toBeVisible();
  for (const g of ['Thème', 'Goban', 'Sons', 'Aide de Mochi']) await expect(page.getByRole('group', { name: g })).toBeVisible();
  const { scroll } = await page.evaluate(() => ({ scroll: document.documentElement.scrollHeight }));
  expect(scroll).toBeLessThanOrEqual(844);
  const theme = page.getByRole('group', { name: 'Thème' });
  await theme.getByRole('button', { name: 'Clair' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await theme.getByRole('button', { name: 'Auto' }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme');

  for (const nom of [/^Confirmer au doigt/, /^Célébrations/]) {
    const s = page.getByRole('switch', { name: nom });
    await expect(s).toHaveAttribute('aria-checked', 'true');
    expect((await s.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  for (const b of await theme.getByRole('button').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);

  // #165 : son et vibrations sur une seule ligne, réglables séparément.
  const sons = page.getByRole('group', { name: 'Sons' });
  const son = sons.getByRole('button', { name: 'Son', exact: true }), vib = sons.getByRole('button', { name: 'Vibrations' });
  for (const b of [son, vib]) {
    await expect(b).toHaveAttribute('aria-pressed', 'true');
    const box = (await b.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44); expect(box.width).toBeGreaterThanOrEqual(44);
  }
  await vib.click();
  await expect(vib).toHaveAttribute('aria-pressed', 'false');
  await expect(son).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('go.settings.v1')!))).toMatchObject({ sound: true, vibrations: false });
  await vib.click();
  await expect(vib).toHaveAttribute('aria-pressed', 'true');

  // Retour ramène à « Ton parcours » ; « Mon compte » ouvre une sous-vue, Retour ramène au Profil.
  await page.getByRole('button', { name: 'Retour' }).click();
  await expect(page.getByRole('heading', { name: 'Ton parcours' })).toBeVisible();
  await page.getByRole('button', { name: /^Mon compte/ }).click();
  await expect(page.getByRole('heading', { name: 'Mon compte' })).toBeVisible();
  await page.getByRole('button', { name: 'Retour' }).click();
  await expect(page.getByRole('heading', { name: 'Ton parcours' })).toBeVisible();
});

test('changer d’onglet referme les réglages : le Profil rouvre sur Ton parcours', async ({ page }) => {
  await page.goto('/');
  const onglet = (n: string) => page.getByRole('navigation').getByRole('button', { name: n });
  await onglet('Profil').click();
  await page.getByRole('button', { name: /^Réglages/ }).click();
  await onglet('Jouer').click();
  await onglet('Profil').click();
  await expect(page.getByRole('heading', { name: 'Ton parcours' })).toBeVisible();
});
