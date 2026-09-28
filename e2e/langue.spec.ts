import { expect, test, type Page } from '@playwright/test';

// Issue #167 : `?lang=en` traduit la barre du bas et le Profil, sans débordement à 390 et 320 px.

async function sansDebordement(page: Page) {
  const { largeur, fenetre, coupes } = await page.evaluate(() => ({
    largeur: document.documentElement.scrollWidth,
    fenetre: innerWidth,
    // Textes coupés : un libellé plus large que sa boîte (ellipse ou débordement masqué).
    coupes: [...document.querySelectorAll<HTMLElement>('.onglet-libelle, .ligne-libelle, .ligne-aide, .ligne-valeur, .seg button, .profil > h2')]
      .filter(e => e.offsetParent !== null && e.scrollWidth > e.clientWidth + 1)
      .map(e => e.textContent),
  }));
  expect(largeur).toBeLessThanOrEqual(fenetre);
  expect(coupes).toEqual([]);
}

for (const largeur of [390, 320]) {
  test(`?lang=en : barre du bas et Profil en anglais, sans débordement à ${largeur} px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 844 });
    await page.goto('/?lang=en');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    for (const nom of ['Play', 'Learn', 'Puzzles', 'Profile']) await expect(nav.getByRole('button', { name: nom })).toBeVisible();
    for (const b of await nav.getByRole('button').all()) {
      const boite = (await b.boundingBox())!;
      expect(boite.height).toBeGreaterThanOrEqual(44);
      expect(boite.x + boite.width).toBeLessThanOrEqual(largeur);
    }
    await sansDebordement(page);

    await nav.getByRole('button', { name: 'Profile' }).click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    const theme = page.getByRole('group', { name: 'Theme' });
    for (const nom of ['Dark', 'Light', 'Auto']) await expect(theme.getByRole('button', { name: nom })).toBeVisible();
    for (const nom of [/^Confirm moves/, /^Celebrations/]) await expect(page.getByRole('switch', { name: nom })).toBeVisible();
    const sons = page.getByRole('group', { name: 'Sounds' });
    for (const nom of ['Sound', 'Vibration']) await expect(sons.getByRole('button', { name: nom, exact: true })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Mochi’s help' }).getByRole('button', { name: 'Beginners' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^My account/ })).toContainText('Sign in');
    await expect(page.getByRole('button', { name: 'Terms and privacy' })).toBeVisible();
    await expect(page.getByText('Guest', { exact: true })).toBeVisible();
    await expect(page.getByText('Réglages')).toHaveCount(0);
    await expect(page.locator('header').getByText('Profile', { exact: true })).toBeVisible();
    await sansDebordement(page);
    await page.screenshot({ path: `docs/localisation/captures/profil-en-${largeur}.png` });
  });
}

// Étape 2 : accueil et Problèmes. Libellés d'interface seulement : les titres des problèmes et des leçons sont du contenu,
// traduit plus tard (ils peuvent être coupés par une ellipse voulue).
const LIBELLES = '.phrase, .reglage, .cta, .btn, .tuile small, .titre-pierres, .bases-aide, .palier-nom h3, .palier-nom small, .difficulte, .lecteur-nom small, .notice, .invitation';

async function sansCoupe(page: Page, largeur: number) {
  const { page: large, coupes } = await page.evaluate(sel => ({
    page: document.documentElement.scrollWidth,
    coupes: [...document.querySelectorAll<HTMLElement>(sel)]
      .filter(e => e.offsetParent !== null && (e.scrollWidth > e.clientWidth + 1 || e.getBoundingClientRect().right > innerWidth + 0.5))
      .map(e => e.textContent),
  }), LIBELLES);
  expect(large).toBeLessThanOrEqual(largeur);
  expect(coupes).toEqual([]);
}

for (const largeur of [390, 320]) {
  test(`?lang=en : accueil et Problèmes en anglais, sans débordement à ${largeur} px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 844 });
    await page.goto('/?lang=en');

    // Accueil d'un nouveau joueur : réplique de Pomme, explication du kyu, action principale, tuiles.
    await expect(page.getByText('Shall we play together? I’ll explain everything.')).toBeVisible();
    await expect(page.getByText(/^She’s learning, just like you\. Kyu is a rank/)).toBeVisible();
    await expect(page.getByText('9 × 9 board, you’re Black')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Change' })).toBeVisible();
    const cta = page.getByRole('button', { name: 'Play your first game against Pomme' });
    await expect(cta).toContainText('Play your first game');
    expect((await cta.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(page.getByRole('button', { name: /^Daily Go #\d+/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Lesson 1 of \d+/ })).toBeVisible();
    await expect(page.locator('header').getByText('Go', { exact: true })).toBeVisible();
    await expect(page.getByText(/Joue|Plateau|Changer|Go du jour/)).toHaveCount(0);
    await sansDebordement(page);
    await sansCoupe(page, largeur);
    await page.screenshot({ path: `docs/localisation/captures/accueil-en-${largeur}.png` });

    // Feuille « Change » : adversaire et taille du plateau.
    await page.getByRole('button', { name: 'Change' }).click();
    const feuille = page.getByRole('dialog', { name: 'Your opponent' });
    await expect(feuille.getByText('Plays a bit at random. Perfect for your first game.')).toBeVisible();
    await expect(feuille.getByRole('heading', { name: 'Board size' })).toBeVisible();
    await expect(feuille.getByText('Short games, perfect for learning.')).toBeVisible();
    await expect(feuille.getByRole('button', { name: 'Play a friend on this phone' })).toBeVisible();
    await feuille.getByRole('button', { name: 'Close' }).click();

    // Problèmes : Go du jour, paliers, grille.
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Puzzles' }).click();
    await expect(page.locator('header').getByText('Puzzles', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Daily Go #\d+$/ })).toBeVisible();
    await expect(page.getByText('The same challenge for everyone, today.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Solve the Daily Go' })).toHaveText('Solve');
    await expect(page.getByText(/^(Black|White) to play$/).first()).toBeVisible();
    await expect(page.getByText('Sign in to get your rating: it shows your level and goes up as you solve puzzles.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Puzzles', exact: true })).toBeVisible();
    await expect(page.getByText('From easiest to hardest. A stone is in atari when it has only one liberty left.')).toBeVisible();
    const debutant = page.getByRole('group', { name: 'Beginner' });
    await expect(debutant.getByText('30 to 25 kyu')).toBeVisible();
    await expect(page.getByRole('group', { name: /^Novice \(locked\)$/ })).toBeVisible();
    await expect(page.getByText('Solve a few more puzzles in the tier before to unlock it.').first()).toBeVisible();
    expect(await page.getByRole('button', { name: /^Puzzle \d+: / }).count()).toBeGreaterThanOrEqual(18);
    await expect(page.getByRole('button', { name: /^Puzzle \d+: .*, locked$/ }).first()).toBeVisible();
    await expect(page.getByText(/Problème|Résoudre|Palier|verrouillé/)).toHaveCount(0);
    await sansDebordement(page);
    await sansCoupe(page, largeur);
    await page.screenshot({ path: `docs/localisation/captures/problemes-en-${largeur}.png` });

    // Un problème ouvert : en-tête, consigne, retour.
    await debutant.locator('[data-probleme]').first().click();
    await expect(page.getByRole('button', { name: 'Back to puzzles' })).toBeVisible();
    await expect(page.locator('.lecteur-nom small')).toHaveText('Puzzle 1');
    await expect(page.getByText(/You play (Black|White)\.$/)).toBeVisible();
    await sansDebordement(page);
    await sansCoupe(page, largeur);
  });
}

test('sans paramètre, une interface française reste en français', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  await nav.getByRole('button', { name: 'Profil' }).click();
  await expect(page.getByRole('heading', { name: 'Réglages' })).toBeVisible();
  await expect(page.getByRole('switch', { name: /^Confirmer au doigt/ })).toBeVisible();
});

test.describe('appareil réglé en anglais', () => {
  test.use({ locale: 'en-US' });
  // DETECTION_APPAREIL = false : pas d'interface à moitié traduite tant que tous les écrans ne sont pas traduits.
  test('reste en français tant que la détection de l\'appareil est désactivée', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button', { name: 'Profil' })).toBeVisible();
  });
});
