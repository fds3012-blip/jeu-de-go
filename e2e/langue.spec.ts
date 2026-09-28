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
    await expect(page.locator('[data-palier-en-cours]')).toContainText('Your tier');
    await expect(page.locator('[data-palier-en-cours]')).toContainText('30 to 25 kyu');
    await expect(page.getByText(/Problème|Résoudre|Palier|verrouillé/)).toHaveCount(0);
    await sansDebordement(page);
    await sansCoupe(page, largeur);
    await page.screenshot({ path: `docs/localisation/captures/problemes-en-${largeur}.png` });

    // « All puzzles » (#196) : la grille, et le prochain palier fermé en une ligne.
    await page.getByRole('button', { name: 'All puzzles' }).click();
    await expect(page.getByText('From easiest to hardest. A stone is in atari when it has only one liberty left.')).toBeVisible();
    const debutant = page.getByRole('group', { name: 'Beginner' });
    await expect(debutant.getByText('30 to 25 kyu')).toBeVisible();
    await expect(page.getByRole('group', { name: /^Novice \(locked\)$/ })).toBeVisible();
    await expect(page.getByText('Solve a few more puzzles in the tier before to unlock it.').first()).toBeVisible();
    expect(await page.getByRole('button', { name: /^Puzzle \d+: / }).count()).toBeGreaterThan(0);
    await expect(page.getByRole('button', { name: /, locked$/ })).toHaveCount(0);
    await expect(page.getByText(/Problème|Résoudre|Palier|verrouillé/)).toHaveCount(0);
    await sansDebordement(page);
    await sansCoupe(page, largeur);

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

// Étape 3 : composants partagés. Joueur avec de l'XP, des parties, des problèmes réussis, Pomme battue et une erreur à rejouer.
const ERREUR = {
  id: 'erreur-en', creeLe: '2026-01-01T10:00:00.000Z', prochain: '2026-01-01', rates: 0, size: 9,
  rows: ['.........', '.........', '..O...X..', '.........', '....X....', '.........', '..X...O..', '.........', '.........'],
  toPlay: 1, reponses: [6 * 9 + 4], joue: 0, coup: 14, adversaire: 'Pomme',
};
const COMPOSANTS = '.niveau-texte, .niveau-suite, .paliers h3, .carte b, .carte small, .vedette-bulle b, .carrousel-legende, .stat span, .vitrine-rangee b, .vitrine-rangee small, .pastille-niveau, .titre-pierres, .bases-aide, .grille-pb .small';

async function sansCoupeComposants(page: Page, largeur: number) {
  // Coupé : plus large que sa boîte, tronqué par le line-clamp, ou qui dépasse l'écran (sauf dans la vitrine, qui défile de côté).
  const coupes = await page.evaluate(sel => [...document.querySelectorAll<HTMLElement>(sel)]
    .filter(e => e.offsetParent !== null && (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 2
      || (!e.closest('.vitrine-rangee') && e.getBoundingClientRect().right > innerWidth + 0.5)))
    .map(e => e.textContent), COMPOSANTS);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(largeur);
  expect(coupes).toEqual([]);
}

for (const largeur of [390, 320]) {
  test(`?lang=en : barre XP, carrousel, profil complet et Mes erreurs en anglais à ${largeur} px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(e => {
      if (sessionStorage.getItem('composants-prets')) return;
      sessionStorage.setItem('composants-prets', '1');
      localStorage.setItem('go.xp.v1', '40');
      localStorage.setItem('go.parties.v1', JSON.stringify({ n: 3, ordi: 3, dernier: 'pomme' }));
      localStorage.setItem('go.bilan.v1', JSON.stringify({ pomme: { v: 2, d: 1 } }));
      localStorage.setItem('go.problemes.v1', JSON.stringify({ b1: true, b3: true, b4: true }));
      localStorage.setItem('go.intro-but.v1', 'true');
      localStorage.setItem('go.erreurs.v1', JSON.stringify([e]));
    }, ERREUR);
    await page.goto('/?lang=en');

    // Accueil avec la barre de niveau.
    const barre = page.getByTestId('barre-niveau');
    await expect(barre).toContainText(/^Level\u00A01/);
    await expect(barre).toContainText(/\d+\u00A0\/\u00A0\d+\u00A0XP/);
    await expect(barre.getByRole('progressbar', { name: 'Level 1' })).toHaveAttribute('aria-valuetext', /^\d+ of \d+ XP to level 2$/);
    await expect(barre.locator('.niveau-suite')).toHaveText('Level 3: the “Light kaya” board');
    await expect(page.getByText(/Niveau|goban «/)).toHaveCount(0);
    await sansDebordement(page);
    await sansCoupeComposants(page, largeur);
    await page.screenshot({ path: `docs/localisation/captures/accueil-xp-en-${largeur}.png` });

    // Carrousel des adversaires : paliers, battus, verrouillés.
    await page.getByRole('button', { name: 'Change' }).click();
    const feuille = page.getByRole('dialog', { name: 'Your opponent' });
    const liste = feuille.getByRole('list', { name: 'Opponents, from easiest to strongest' });
    for (const titre of ['First steps', 'Getting tougher', 'The masters']) await expect(liste.getByRole('heading', { name: titre })).toBeVisible();
    await expect(liste.getByRole('button', { name: 'Pomme, 20 kyu, beaten' })).toBeVisible();
    await expect(liste.locator('.vignette-tampon').first()).toHaveText('BEATEN');
    await liste.getByRole('button', { name: 'Tigre, 5 kyu, locked' }).click({ force: true }); // aria-disabled : le toucher explique quoi faire
    await expect(feuille.locator('.carrousel-legende')).toHaveText(/^Beat .+ first to face Tigre\.$/);
    await expect(feuille.getByText(/Premiers pas|verrouillé|battue?\b|BATTU|Bats d/)).toHaveCount(0);
    await sansDebordement(page);
    await sansCoupeComposants(page, largeur);
    await page.screenshot({ path: `docs/localisation/captures/adversaires-en-${largeur}.png` });
    await feuille.getByRole('button', { name: 'Close' }).click();

    // Profil complet : statistiques, badges, thèmes du goban.
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Profile' }).click();
    const stats = page.getByRole('list', { name: 'Your stats' });
    for (const legende of ['puzzles', 'day streak', 'games', 'wins']) await expect(stats.getByText(legende, { exact: true })).toBeVisible();
    const vitrine = page.getByRole('region', { name: /^Badges, \d of 7$/ });
    await expect(vitrine.getByRole('listitem', { name: 'Pomme beaten: earned' })).toBeVisible();
    await expect(vitrine.getByRole('listitem', { name: 'First game: earned' })).toBeVisible();
    await expect(vitrine.getByRole('listitem', { name: '7-day streak: not earned yet. Daily Go 7 days running.' })).toHaveCount(1);
    const goban = page.getByRole('group', { name: 'Board' });
    await expect(goban.getByRole('button', { name: 'Kaya', exact: true })).toBeVisible();
    await expect(goban.getByRole('button', { name: 'Light kaya, unlocks at level 3' })).toBeVisible();
    await expect(goban.getByRole('button', { name: 'Golden shell, unlocks at level 8' })).toBeVisible();
    await expect(page.getByText(/problèmes|victoires|Première partie|Réussis/)).toHaveCount(0);
    await sansDebordement(page);
    await sansCoupeComposants(page, largeur);
    await page.screenshot({ path: `docs/localisation/captures/profil-complet-en-${largeur}.png` });

    // Mes erreurs, dans les Problèmes.
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Puzzles' }).click();
    await expect(page.getByRole('heading', { name: /^Your mistakes to replay/ })).toBeVisible();
    await expect(page.getByText('Positions from your games. Find the move KataGo suggested.')).toBeVisible();
    const erreur = page.getByRole('button', { name: 'Replay: Your game against Pomme, move 14' });
    await expect(erreur).toContainText('Black to play');
    await expect(page.getByText(/Tes erreurs|Ta partie|Noir joue/)).toHaveCount(0);
    await sansDebordement(page);
    await sansCoupeComposants(page, largeur);
    await erreur.click();
    await expect(page.getByText('Find a better move than yours: only KataGo’s move counts.')).toBeVisible();
  });
}
