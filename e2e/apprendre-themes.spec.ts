import { expect, test, type Page } from '@playwright/test';
import { jouer } from './plateau';

// #590 : « Par thème » dans Apprendre. Une rangée de puces sous la carte de la prochaine leçon (secondaire : « Reprendre »
// reste la seule action en relief), qui ouvre la page du thème : sa notion expliquée, ses leçons avec leur état, et
// « S'entraîner sur ce thème » (la série de 3 problèmes de fin de leçon, sur ce thème).

async function apprendre(page: Page, lecons: Record<string, number>) {
  await page.addInitScript(p => { if (!sessionStorage.getItem('pose')) { sessionStorage.setItem('pose', '1'); localStorage.setItem('go.lecons.v1', JSON.stringify(p)); } }, lecons);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
}

for (const theme of ['light', 'dark'] as const) {
  test(`rangée « Par thème » sous la carte de reprise, 390 × 844 (${theme}) : secondaire, 44 px, sans défilement de page`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: theme });
    await apprendre(page, { l1: 99, l2: 2 });
    const rangee = page.getByTestId('par-theme');
    await expect(rangee.getByRole('heading', { name: 'Par thème' })).toBeVisible();
    const puces = rangee.getByRole('button');
    // Seulement les thèmes qui ont une leçon, dans l'ordre du chemin : Capture (leçon 1) d'abord.
    expect(await puces.count()).toBeGreaterThanOrEqual(10);
    await expect(puces.first()).toHaveAccessibleName(/^Capture : 1 leçon faite sur \d+$/);
    await expect(puces.nth(1)).toHaveAccessibleName('Atari : 0 leçon faite sur 1');
    // Sous la carte de la prochaine leçon, dans le même bloc.
    const carte = (await page.getByTestId('prochaine-lecon').boundingBox())!, r = (await rangee.boundingBox())!;
    expect(r.y).toBeGreaterThan(carte.y + carte.height - 1);
    expect(r.y - (carte.y + carte.height)).toBeLessThan(40);
    for (let i = 0; i < 3; i++) expect((await puces.nth(i).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    // Une seule action en relief ; la rangée défile de côté, pas la page.
    await expect(page.locator('.apprendre .cta')).toHaveCount(1);
    expect(await puces.first().evaluate(b => getComputedStyle(b).boxShadow)).toBe('none');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    const liste = rangee.locator('ul');
    expect(await liste.evaluate(u => u.scrollWidth > u.clientWidth)).toBe(true);
  });
}

test('page d’un thème : notion expliquée, leçons avec leur état, une leçon s’ouvre et y ramène', async ({ page }) => {
  await apprendre(page, { l1: 99 });
  await page.getByTestId('par-theme').getByRole('button', { name: /^Capture :/ }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Capture' })).toBeVisible();
  await expect(page.getByText(/Une liberté, c’est un point vide juste à côté d’une pierre/)).toBeVisible();
  const lecons = page.locator('.theme-lecon');
  expect(await lecons.count()).toBeGreaterThanOrEqual(2);
  await expect(lecons.first()).toHaveAccessibleName(/^Libertés et capture, Faite$/);
  await expect(lecons.nth(1)).toHaveAccessibleName(/, À faire$/);
  for (const b of await lecons.all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(page.locator('.cta')).toHaveCount(1);
  await expect(page.locator('.cta')).toHaveText('S’entraîner sur ce thème');
  // Toucher une leçon l'ouvre ; en sortir ramène au thème.
  await lecons.first().click();
  await expect(page.locator('.lecteur-tete')).toBeVisible();
  await page.locator('.lecteur-tete .retour').click();
  await expect(page.getByRole('heading', { level: 2, name: 'Capture' })).toBeVisible();
  // « Retour à Apprendre » ramène au chemin, avec la rangée.
  await page.getByRole('button', { name: 'Retour à Apprendre' }).click();
  await expect(page.getByTestId('par-theme')).toBeVisible();
  // L'onglet Apprendre touché depuis la page d'un thème ramène aussi au chemin.
  await page.getByTestId('par-theme').getByRole('button', { name: /^Atari :/ }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Atari' })).toBeVisible();
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
  await expect(page.getByTestId('par-theme')).toBeVisible();
});

test('« S’entraîner sur ce thème » : 3 problèmes du thème, puis retour au thème', async ({ page }) => {
  await apprendre(page, { l1: 99 });
  await page.getByTestId('par-theme').getByRole('button', { name: /^Capture :/ }).click();
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
