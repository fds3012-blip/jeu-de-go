import { expect, test, type Page } from '@playwright/test';
import { barre } from './onglet';
import { ouvrirParTheme } from './problemes';

// #685 (C6, N3 ; règle A8 de DESIGN.md) : chaque onglet garde sa pile quand on en change. Un détour par un autre onglet
// retrouve la page d'un thème, les Ouvertures ou une sous-vue du Profil, défilement compris. Toucher l'onglet déjà
// actif ramène à sa racine. Le retour du système fait toujours ce que fait « ‹ ».

const vers = (page: Page, nom: string) => barre(page).getByRole('button', { name: nom, exact: true }).click();
const defilement = (page: Page) => page.evaluate(() => Math.round(window.scrollY));

async function ouvrir(page: Page) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('pose')) return;
    sessionStorage.setItem('pose', '1');
    localStorage.setItem('go.lecons.v1', JSON.stringify({ l1: 99, l2: 99 }));
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await vers(page, 'Apprendre');
}

test('page d’un thème → Profil → Apprendre : même page, même défilement', async ({ page }) => {
  await ouvrir(page);
  // Écran bas (390 × 480) : la page du thème défile.
  await page.setViewportSize({ width: 390, height: 480 });
  const carte = page.getByTestId('par-theme').getByRole('button', { name: /^Vie et mort,/ });
  await carte.scrollIntoViewIfNeeded();
  await carte.click();
  const titre = page.getByRole('heading', { level: 2, name: 'Vie et mort' });
  await expect(titre).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 240));
  await expect.poll(() => defilement(page)).toBeGreaterThan(100);
  const y = await defilement(page);

  await vers(page, 'Profil');
  await expect(page.getByRole('heading', { level: 1, name: 'Profil' })).toBeVisible();
  await expect(titre).toBeHidden();
  expect(await defilement(page)).toBe(0);

  await vers(page, 'Apprendre');
  await expect(titre).toBeVisible();
  await expect.poll(() => defilement(page)).toBe(y);

  // Le retour du système fait « ‹ » : le sommaire d'Apprendre, puis Jouer.
  await page.goBack();
  await expect(page.getByTestId('par-theme')).toBeVisible();
  await expect(titre).toBeHidden();
  await page.goBack();
  await expect(page.locator('.accueil')).toBeVisible();

  // Revenir à Apprendre : son sommaire, gardé tel quel.
  await vers(page, 'Apprendre');
  await expect(page.getByTestId('par-theme')).toBeVisible();
});

test('Ouvertures → Problèmes « Par thème » → Apprendre → Problèmes : chacun retrouvé ; l’onglet actif touché ramène au sommaire', async ({ page }) => {
  await ouvrir(page);
  const entree = page.getByTestId('entree-ouvertures');
  await entree.scrollIntoViewIfNeeded();
  await entree.click();
  const ouvertures = page.getByRole('heading', { name: 'Ouvertures' });
  await expect(ouvertures).toBeVisible();

  await vers(page, 'Problèmes');
  await expect(ouvertures).toBeHidden();
  await ouvrirParTheme(page);
  const parTheme = page.locator('.problemes-par-theme');

  await vers(page, 'Apprendre');
  await expect(ouvertures).toBeVisible();
  await vers(page, 'Problèmes');
  await expect(parTheme).toBeVisible();

  // A8 : toucher l'onglet déjà actif ramène à sa racine.
  await vers(page, 'Problèmes');
  await expect(parTheme).toBeHidden();
  await expect(page.getByTestId('entree-par-theme')).toBeVisible();
  await vers(page, 'Apprendre');
  await expect(ouvertures).toBeVisible();
  await vers(page, 'Apprendre');
  await expect(ouvertures).toBeHidden();
  await expect(page.getByTestId('par-theme')).toBeVisible();
});

test('sous-vue du Profil → Jouer → Profil : Réglages est là ; Profil touché à nouveau ramène au sommaire', async ({ page }) => {
  await ouvrir(page);
  await vers(page, 'Profil');
  await page.getByRole('button', { name: /^Réglages/ }).click();
  const reglages = page.getByRole('heading', { name: 'Réglages' });
  await expect(reglages).toBeVisible();

  await vers(page, 'Jouer');
  await expect(page.locator('.accueil')).toBeVisible();
  await expect(reglages).toBeHidden();
  // À la racine de Jouer, rien de caché ne retient le retour du système : aucune garde d'historique.
  await expect.poll(() => page.evaluate(() => (history.state as { garde?: boolean } | null)?.garde ?? false)).toBe(false);

  await vers(page, 'Profil');
  await expect(reglages).toBeVisible();
  await vers(page, 'Profil');
  await expect(reglages).toBeHidden();
  await expect(page.getByRole('button', { name: /^Réglages/ })).toBeVisible();
});
