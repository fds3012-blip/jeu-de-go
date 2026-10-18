import { expect, test } from '@playwright/test';

// Issue #50, #214 : le Profil. #654 (A13, modèle : « Plus » de chess.com) : un sommaire. Une carte d'identité compacte,
// puis des rubriques groupées sous de petits titres ; chaque ligne ouvre son détail.
for (const theme of ['dark', 'light'] as const) {
  test(`Profil en sommaire, 390 × 844 (${theme === 'dark' ? 'sombre' : 'clair'}) : identité, puis cinq rubriques`, async ({ page }) => {
    await page.addInitScript(t => localStorage.setItem('go.settings.v1', JSON.stringify({ theme: t })), theme);
    await page.goto('/');
    await page.getByRole('navigation').getByRole('button', { name: 'Profil' }).click();
    await expect(page.getByRole('heading', { name: 'Profil', exact: true })).toBeVisible();
    const titres = page.locator('.profil-sommaire .sommaire-titre');
    await expect(titres).toHaveText(['Ta progression', 'Tes parties et tes amis', 'L’app', 'Compte', 'Aide']);
    // E3 : quatre lignes au plus par rubrique ; aucune action en relief.
    for (const r of await page.locator('.profil-sommaire .sommaire').all()) expect(await r.locator('.sommaire-entree').count()).toBeLessThanOrEqual(4);
    await expect(page.locator('.profil .cta')).toHaveCount(0);
    for (const b of await page.locator('.profil-sommaire .sommaire-entree').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(48);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    // Au premier regard : la carte d'identité et toute la rubrique « Ta progression ».
    const nav = (await page.getByRole('navigation').boundingBox())!;
    const progression = (await page.getByTestId('rubrique-progression').boundingBox())!;
    expect(progression.y + progression.height).toBeLessThanOrEqual(nav.y);
    // #655 : « Compter une photo » suit « Mes parties » (« Mes amis » vient après, avec le serveur) : une autre façon de
    // finir une partie, jouée sur un vrai goban.
    expect(await page.getByTestId('rubrique-social').locator('.sommaire-entree').evaluateAll(es => es.map(e => (e as HTMLElement).dataset.entree).slice(0, 2)))
      .toEqual(['parties', 'photo']);
    // Mes données a quitté le troisième niveau (A4) : une ligne de la rubrique « Compte ».
    await expect(page.getByTestId('rubrique-compte').getByRole('button')).toHaveText(['Mon compteSe connecter', 'Mes données', 'Conditions et confidentialité']);
  });
}

// #647 (P1) : pas de « 0 / 100 XP » avant le premier XP ; la barre et le niveau restent (#654 : dans « Niveau et badges »).
test('Profil sans XP : ni « 0 / 100 XP » ni chiffre à zéro, la barre de niveau reste', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Profil' }).click();
  await page.getByTestId('ligne-niveau').click();
  const barre = page.getByTestId('barre-niveau');
  await expect(barre.getByRole('progressbar', { name: 'Niveau 1' })).toBeVisible();
  await expect(barre).not.toContainText(/XP/);
});

test('Niveau et badges : niveau et XP, record, leçons, adversaires battus, problèmes réussis sans total, vitrine', async ({ page }) => {
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

  // La carte compacte dit le niveau ; l'XP et les chiffres sont dans le détail.
  const carte = page.getByRole('region', { name: 'Ton profil' });
  await expect(carte).toContainText('Niveau 4');
  await expect(carte.getByRole('progressbar')).toHaveCount(0);
  const entree = page.getByTestId('ligne-niveau');
  await expect(entree).toHaveAccessibleName(/^Niveau et badges, Nouveau$/);
  await entree.click();
  await expect(page.getByRole('heading', { name: 'Niveau et badges' })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Niveau 4' })).toBeVisible();
  await expect(page.getByTestId('barre-niveau')).toContainText(/XP/);
  const lignes = page.getByRole('list', { name: 'Tes statistiques' }).getByRole('listitem');
  await expect(lignes).toHaveCount(4);
  await expect(lignes.nth(0)).toHaveText(/^7\s*jours, ta série record$/);
  await expect(lignes.nth(1)).toHaveText(/^2\/(\d+)\s*leçons finies sur \1$/);
  await expect(lignes.nth(2)).toHaveText(/^2\/9\s*adversaires battus sur 9$/);
  await expect(lignes.nth(3)).toHaveText(/^3\s*problèmes réussis$/); // sans total : les problèmes n'ont pas de fin
  await expect(page.getByRole('region', { name: /^Badges/ }).getByRole('button', { name: 'Pomme battue : obtenu' })).toBeVisible();
  // « ‹ » (ou le retour du système) ramène au sommaire ; les badges ne sont plus nouveaux.
  await page.goBack();
  await expect(page.getByTestId('ligne-niveau')).toBeVisible();
  await page.reload();
  await page.getByRole('navigation').getByRole('button', { name: 'Profil' }).click();
  await expect(page.getByTestId('ligne-niveau')).toHaveAccessibleName(/^Niveau et badges, Badges, \d+ sur 21$/);
});

test('réglages en lignes : thème segmenté, interrupteurs, cibles de 44 px', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Profil' }).click();
  // #214 : une ligne « Réglages » ouvre la sous-vue ; tous les réglages d'avant y sont.
  await page.getByRole('button', { name: /^Réglages/ }).click();
  await expect(page.getByRole('heading', { name: 'Réglages' })).toBeVisible();
  for (const g of ['Thème', 'Goban', 'Aide de Mochi']) await expect(page.getByRole('group', { name: g })).toBeVisible();
  // #365 : les réglages du joueur de club s'ajoutent ; l'écran défile, groupé par titres, jamais de côté.
  const { largeur } = await page.evaluate(() => ({ largeur: document.documentElement.scrollWidth }));
  expect(largeur).toBeLessThanOrEqual(390);
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

  // #165 : son et vibrations réglables séparément. #509 (L2) : deux interrupteurs, plus un faux choix segmenté.
  const son = page.getByRole('switch', { name: 'Sons', exact: true }), vib = page.getByRole('switch', { name: 'Vibrations', exact: true });
  for (const b of [son, vib]) {
    await expect(b).toHaveAttribute('aria-checked', 'true');
    const box = (await b.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44); expect(box.width).toBeGreaterThanOrEqual(44);
  }
  await vib.click();
  await expect(vib).toHaveAttribute('aria-checked', 'false');
  await expect(son).toHaveAttribute('aria-checked', 'true');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('go.settings.v1')!))).toMatchObject({ sound: true, vibrations: false });
  await vib.click();
  await expect(vib).toHaveAttribute('aria-checked', 'true');

  // Retour ramène au sommaire ; « Mon compte » ouvre une sous-vue, Retour ramène au Profil.
  await page.getByRole('button', { name: 'Retour' }).click();
  await expect(page.getByRole('heading', { name: 'Profil', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Mon compte/ }).click();
  await expect(page.getByRole('heading', { name: 'Mon compte' })).toBeVisible();
  await page.getByRole('button', { name: 'Retour' }).click();
  await expect(page.getByRole('heading', { name: 'Profil', exact: true })).toBeVisible();
});

test('changer d’onglet referme les réglages : le Profil rouvre sur son menu', async ({ page }) => {
  await page.goto('/');
  const onglet = (n: string) => page.getByRole('navigation').getByRole('button', { name: n });
  await onglet('Profil').click();
  await page.getByRole('button', { name: /^Réglages/ }).click();
  await onglet('Jouer').click();
  await onglet('Profil').click();
  await expect(page.getByRole('heading', { name: 'Profil', exact: true })).toBeVisible();
});
