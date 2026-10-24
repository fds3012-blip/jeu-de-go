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
    localStorage.setItem('go.lecons.v1', JSON.stringify({ l1: 99, l2: 99, l3: 99, l4: 99, l5: 99, l6: 99, l7: 99 }));
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

// #688 (C6, N8) : une adresse par écran. Elle suit l'écran sans entrée d'historique en plus ; un rechargement ou un lien
// rouvre le même écran.
const chemin = (page: Page) => page.evaluate(() => location.pathname);

test('recharger /apprendre/lecon/l5 ouvre la leçon 5 ; « ‹ » puis le retour du système ramènent à Apprendre puis à Jouer', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/apprendre/lecon/l5');
  const titre = page.locator('.lecteur-lecon .lecteur-titre');
  await expect(titre).toHaveText('Vivre et mourir');
  await page.reload();
  await expect(titre).toHaveText('Vivre et mourir');
  expect(await chemin(page)).toBe('/apprendre/lecon/l5');
  await page.locator('.lecteur-tete .retour').click();
  await expect(page.getByTestId('par-theme')).toBeVisible();
  await expect.poll(() => chemin(page)).toBe('/apprendre');
  await page.goBack();
  await expect(page.locator('.accueil')).toBeVisible();
  await expect.poll(() => chemin(page)).toBe('/');
});

test('l’adresse suit l’écran : thème, Ouvertures, problème, rubrique du Profil ; chacun se rouvre au rechargement', async ({ page }) => {
  await ouvrir(page);
  await expect.poll(() => chemin(page)).toBe('/apprendre');
  await page.getByTestId('par-theme').getByRole('button', { name: /^Capture,/ }).click();
  await expect.poll(() => chemin(page)).toBe('/apprendre/capture');
  await page.reload();
  await expect(page.getByRole('heading', { level: 2, name: 'Capture' })).toBeVisible();
  // Rechargée, la page du thème garde son retour : le sommaire, puis Jouer.
  await page.goBack();
  await expect(page.getByTestId('par-theme')).toBeVisible();
  await expect.poll(() => chemin(page)).toBe('/apprendre');

  const entree = page.getByTestId('entree-ouvertures');
  await entree.scrollIntoViewIfNeeded();
  await entree.click();
  await expect.poll(() => chemin(page)).toBe('/apprendre/ouvertures');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Ouvertures' })).toBeVisible();

  await page.goto('/problemes/a01');
  await expect(page.locator('.lecteur[data-probleme="a01"]')).toBeVisible();
  await page.reload();
  await expect(page.locator('.lecteur[data-probleme="a01"]')).toBeVisible();
  await page.locator('.lecteur .retour').first().click();
  await expect(barre(page)).toBeVisible();
  await expect.poll(() => chemin(page)).toBe('/problemes');

  await vers(page, 'Profil');
  await page.getByRole('button', { name: /^Réglages/ }).click();
  await expect.poll(() => chemin(page)).toBe('/profil/reglages');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Réglages' })).toBeVisible();
  await vers(page, 'Jouer');
  await expect.poll(() => chemin(page)).toBe('/');
});

test('adresse inconnue sous /apprendre : l’app s’ouvre sur Jouer', async ({ page }) => {
  await page.goto('/apprendre/inconnu');
  await expect(page.locator('.accueil')).toBeVisible();
  await expect.poll(() => chemin(page)).toBe('/');
});
