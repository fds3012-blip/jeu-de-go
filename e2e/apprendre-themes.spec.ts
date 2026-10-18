import { expect, test, type Page } from '@playwright/test';
import { jouer } from './plateau';

// #590, #614 : « Par thème » dans Apprendre. Une grille de cartes sous la carte de la prochaine leçon, au même rendu que
// dans Problèmes (secondaire : « Reprendre » reste la seule action en relief) : la vignette, le nom, ce qu'on y apprend,
// puis « Maîtrisé » ou une barre. Les six premiers thèmes, puis « Tous les thèmes ». Une carte ouvre la page du thème :
// sa notion expliquée, ses leçons avec leur état, et « S'entraîner sur ce thème » (3 problèmes du thème).

async function apprendre(page: Page, lecons: Record<string, number>) {
  await page.addInitScript(p => { if (!sessionStorage.getItem('pose')) { sessionStorage.setItem('pose', '1'); localStorage.setItem('go.lecons.v1', JSON.stringify(p)); } }, lecons);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
}

for (const theme of ['light', 'dark'] as const) {
  test(`grille « Par thème » sous la carte de reprise, 390 × 844 (${theme}) : six thèmes, puis tous ; secondaire, 44 px`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: theme });
    await apprendre(page, { l1: 99, l2: 99, l3: 2 });
    const grille = page.getByTestId('par-theme');
    await expect(grille.getByRole('heading', { name: 'Par thème' })).toBeVisible();
    const cartes = grille.locator('.theme-carte');
    // Les six premiers thèmes du chemin, dans l'ordre : Capture (leçon 1) d'abord.
    await expect(cartes).toHaveCount(6);
    expect(await cartes.evaluateAll(els => els.map(e => e.getAttribute('data-theme')))).toEqual(['capture', 'atari', 'double-atari', 'bord', 'echelle', 'ko']);
    // Nom accessible : le nom, puis l'état ; la ligne de description décrit la carte.
    await expect(cartes.first()).toHaveAccessibleName(/^Capture, 1 leçon faite sur \d+$/);
    await expect(cartes.first()).toHaveAccessibleDescription('Bouche la dernière liberté pour prendre la pierre.');
    await expect(cartes.nth(1)).toHaveAccessibleName('Atari, Maîtrisé');
    await expect(cartes.nth(1).locator('.theme-maitrise-mot')).toHaveText('Maîtrisé');
    await expect(cartes.nth(1).locator('.theme-maitrise')).toHaveCount(0);
    // Rien de fait : une barre vide, sans texte.
    await expect(cartes.nth(2)).toHaveAccessibleName('Double atari, 0 leçon faite sur 1');
    expect(await cartes.nth(2).locator('.theme-maitrise > i').evaluate(i => i.getBoundingClientRect().width)).toBe(0);
    // Sous la carte de la prochaine leçon, proche d'elle.
    const carte = (await page.getByTestId('prochaine-lecon').boundingBox())!, r = (await grille.boundingBox())!;
    expect(r.y).toBeGreaterThan(carte.y + carte.height - 1);
    expect(r.y - (carte.y + carte.height)).toBeLessThan(48);
    for (const b of await cartes.all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    // Une seule action en relief ; les cartes sont à plat ; une colonne sur téléphone, sans défilement de côté.
    await expect(page.locator('.apprendre .cta')).toHaveCount(1);
    expect(await cartes.first().evaluate(b => getComputedStyle(b).boxShadow)).toBe('none');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    const xs = new Set(await cartes.evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().x))));
    expect(xs.size).toBe(1);
    // « Tous les thèmes » déplie les autres, toujours dans l'ordre du chemin.
    const tous = grille.getByRole('button', { name: 'Tous les thèmes' });
    await expect(tous).toHaveAttribute('aria-expanded', 'false');
    expect((await tous.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await tous.click();
    await expect(tous).toHaveAttribute('aria-expanded', 'true');
    await expect(cartes).toHaveCount(15);
    await expect(cartes.nth(6)).toHaveAttribute('data-theme', 'vie-mort');
    await tous.click();
    await expect(cartes).toHaveCount(6);
  });
}

test('« Par thème » à 600 px : deux colonnes', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 900 });
  await apprendre(page, { l1: 99 });
  await expect(page.getByTestId('par-theme').locator('.theme-carte')).toHaveCount(6);
  const xs = new Set(await page.getByTestId('par-theme').locator('.theme-carte').evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().x))));
  expect(xs.size).toBe(2);
});

test('page d’un thème : notion expliquée, leçons avec leur état, une leçon s’ouvre et y ramène', async ({ page }) => {
  await apprendre(page, { l1: 99 });
  await page.getByTestId('par-theme').getByRole('button', { name: /^Capture,/ }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Capture' })).toBeVisible();
  await expect(page.getByText(/Une liberté, c’est un point vide juste à côté d’une pierre/)).toBeVisible();
  const lecons = page.locator('.theme-lecon');
  expect(await lecons.count()).toBeGreaterThanOrEqual(2);
  await expect(lecons.first()).toHaveAccessibleName(/^Libertés et capture, Faite$/);
  await expect(lecons.nth(1)).toHaveAccessibleName(/, À faire$/);
  // #627 (V12) : la leçon faite porte son sceau ; plus de pastille texte « Faite » ni « À faire ».
  await expect(lecons.first().locator('.sceau-lecon[data-lecon]')).toHaveCount(1);
  await expect(lecons.nth(1).locator('.sceau-lecon')).toHaveCount(0);
  await expect(page.locator('.theme-lecon-etat')).toHaveCount(0);
  await expect(page.locator('.theme-lecons').getByText(/^(Faite|À faire)$/)).toHaveCount(0);
  for (const b of await lecons.all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(page.locator('.cta')).toHaveCount(1);
  await expect(page.locator('.cta')).toHaveText('S’entraîner sur ce thème');
  // Toucher une leçon l'ouvre ; en sortir ramène au thème.
  await lecons.first().click();
  await expect(page.locator('.lecteur-tete')).toBeVisible();
  await page.locator('.lecteur-tete .retour').click();
  await expect(page.getByRole('heading', { level: 2, name: 'Capture' })).toBeVisible();
  // « Retour à Apprendre » ramène au chemin, avec la grille.
  await page.getByRole('button', { name: 'Retour à Apprendre' }).click();
  await expect(page.getByTestId('par-theme')).toBeVisible();
  // L'onglet Apprendre touché depuis la page d'un thème ramène aussi au chemin.
  await page.getByTestId('par-theme').getByRole('button', { name: /^Atari,/ }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Atari' })).toBeVisible();
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
  await expect(page.getByTestId('par-theme')).toBeVisible();
});

test('« S’entraîner sur ce thème » : 3 problèmes du thème, puis retour au thème', async ({ page }) => {
  await apprendre(page, { l1: 99 });
  await page.getByTestId('par-theme').getByRole('button', { name: /^Capture,/ }).click();
  await page.getByRole('button', { name: 'S’entraîner sur ce thème' }).click();
  const serie = page.locator('.serie-pratique');
  await expect(serie).toHaveAttribute('data-serie', /^\S+ \S+ \S+$/);
  await expect(serie).toHaveAttribute('data-rang', '1');
  // Le premier problème (le plus facile de la capture) : a01, « Première capture ».
  await expect(serie).toHaveAttribute('data-serie', /^a01 /);
  await jouer(page, 'E4');
  await expect(page.locator('.verdict')).toBeVisible();
  // Le retour du lecteur dit où il mène : la page du thème.
  await page.getByRole('button', { name: 'Retour au thème', exact: true }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Capture' })).toBeVisible();
});
