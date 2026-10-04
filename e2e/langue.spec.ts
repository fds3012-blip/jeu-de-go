import { expect, test, type Page } from '@playwright/test';
import { jouer } from './plateau';

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
    await expect(page.getByRole('heading', { name: 'Your journey' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^My account/ })).toContainText('Sign in');
    await expect(page.getByRole('button', { name: 'Terms and privacy' })).toBeVisible();
    await expect(page.getByText('Guest', { exact: true })).toBeVisible();
    await expect(page.getByText(/Ton parcours|Réglages/)).toHaveCount(0);
    await sansDebordement(page);
    await page.screenshot({ path: `docs/localisation/captures/profil-en-${largeur}.png` });
    // #214 : les réglages derrière leur ligne.
    await page.getByRole('button', { name: /^Settings/ }).click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    const theme = page.getByRole('group', { name: 'Theme' });
    for (const nom of ['Dark', 'Light', 'Auto']) await expect(theme.getByRole('button', { name: nom })).toBeVisible();
    for (const nom of [/^Confirm moves/, /^Celebrations/]) await expect(page.getByRole('switch', { name: nom })).toBeVisible();
    const sons = page.getByRole('group', { name: 'Sounds' });
    for (const nom of ['Sound', 'Vibration']) await expect(sons.getByRole('button', { name: nom, exact: true })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Mochi’s help' }).getByRole('button', { name: 'At first' })).toBeVisible();
    await expect(page.getByText('Réglages')).toHaveCount(0);
    await expect(page.locator('header').getByText('Profile', { exact: true })).toBeVisible();
    await sansDebordement(page);
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

    // Accueil d'un nouveau joueur (v3) : promesse de Mochi, adversaire nommé sans rang, action principale, tuiles.
    await expect(page.getByText('Learn Go by playing: I’ll explain every move.')).toBeVisible();
    await expect(page.getByText(/your first opponent · 9\s×\s9/)).toBeVisible();
    await expect(page.getByText(/kyu/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Change' })).toBeVisible();
    const cta = page.getByRole('button', { name: 'Play your first game against Pomme' });
    await expect(cta).toContainText('Play your first game');
    expect((await cta.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(page.getByRole('button', { name: /^Daily Go #\d+/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Lesson 1 of \d+/ })).toBeVisible();
    await expect(page.locator('header').getByText('Mochi Go', { exact: true })).toBeVisible();
    await expect(page.getByText(/Joue|Plateau|Changer|Go du jour/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Play a friend on this phone' })).toContainText('Two players');
    await expect(page.getByRole('button', { name: 'Guided game against Mochi' })).toContainText('Guided');
    await sansDebordement(page);
    await sansCoupe(page, largeur);
    await page.screenshot({ path: `docs/localisation/captures/accueil-en-${largeur}.png` });

    // Feuille « Change » : adversaire et taille du plateau.
    await page.getByRole('button', { name: 'Change' }).click();
    const feuille = page.getByRole('dialog', { name: 'Your opponent' });
    await expect(feuille.getByText('Plays a bit at random. Perfect for your first game.')).toBeVisible();
    await expect(feuille.getByRole('heading', { name: 'Board size' })).toBeVisible();
    await expect(feuille.getByText('Short games, perfect for learning.')).toBeVisible();
    // #429 : les modes sont sur l'accueil (tuiles), plus dans la feuille.
    await expect(feuille.getByRole('button', { name: 'Play a friend on this phone' })).toHaveCount(0);
    await feuille.getByRole('button', { name: 'Close' }).click();

    // Problèmes : Go du jour, paliers, grille.
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Puzzles' }).click();
    await expect(page.locator('header').getByText('Puzzles', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Daily Go #\d+$/ })).toBeVisible();
    await expect(page.getByText('The same puzzle for everyone, today.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Solve the Daily Go' })).toHaveText('Solve');
    await expect(page.getByText(/^(Black|White) to play$/).first()).toBeVisible();
    await expect(page.getByText('Create your account to keep your streak and solved puzzles on all your devices.')).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'Ton parcours' })).toBeVisible();
  await page.getByRole('button', { name: /^Réglages/ }).click();
  await expect(page.getByRole('heading', { name: 'Réglages' })).toBeVisible();
  await expect(page.getByRole('switch', { name: /^Confirmer au doigt/ })).toBeVisible();
});

// Choix de la langue (#167) : Profil > ?lang > appareil > français. DETECTION_APPAREIL = true.
test.describe('appareil réglé en anglais', () => {
  test.use({ locale: 'en-US' });

  test('sans réglage, l\'app s\'ouvre en anglais', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Profile' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Play your first game against Pomme' })).toBeVisible();
  });

  for (const largeur of [390, 320]) test(`le choix « Français » du Profil l'emporte sur l'appareil et sur ?lang, à ${largeur} px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 844 });
    await page.goto('/');
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Profile' }).click();
    await page.getByRole('button', { name: /^Settings/ }).click();
    const ligne = page.getByRole('group', { name: 'Language' });
    await expect(ligne.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
    for (const b of await ligne.getByRole('button').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await sansDebordement(page);
    await page.screenshot({ path: `docs/localisation/captures/reglages-langue-en-${largeur}.png` });

    // Le choix recharge la page en français et reste gardé sur l'appareil.
    await ligne.getByRole('button', { name: 'Français' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    const nav = page.getByRole('navigation', { name: 'Navigation principale' });
    await expect(nav.getByRole('button', { name: 'Profil' })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('go.langue.v1'))).toBe('"fr"');

    // Il prime aussi sur ?lang=en, et se relit dans les Réglages.
    await page.goto('/?lang=en');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await nav.getByRole('button', { name: 'Profil' }).click();
    await page.getByRole('button', { name: /^Réglages/ }).click();
    const langue = page.getByRole('group', { name: 'Langue' });
    await expect(langue.getByRole('button', { name: 'Français' })).toHaveAttribute('aria-pressed', 'true');
    await expect(langue.getByRole('button', { name: 'English' })).toHaveAttribute('lang', 'en');
    await sansDebordement(page);

    // Retour à l'anglais par le même réglage.
    await langue.getByRole('button', { name: 'English' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    expect(await page.evaluate(() => localStorage.getItem('go.langue.v1'))).toBe('"en"');
  });
});

test.describe('appareil réglé dans une autre langue', () => {
  test.use({ locale: 'de-DE' });
  test('l\'app s\'ouvre en français', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button', { name: 'Profil' })).toBeVisible();
  });
});

test.describe('appareil en espagnol qui accepte aussi l\'anglais', () => {
  test.use({ locale: 'es-ES' });
  test('l\'app s\'ouvre en anglais, première langue traduite de la liste', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'languages', { get: () => ['es-ES', 'es', 'en-US', 'en'] });
    });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  });
});

test('appareil en français (fr-FR) : l\'app reste en français, choix « Français » coché dans les Réglages', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  for (const nom of ['Jouer', 'Apprendre', 'Problèmes', 'Profil']) await expect(nav.getByRole('button', { name: nom })).toBeVisible();
  await nav.getByRole('button', { name: 'Profil' }).click();
  await expect(page.getByRole('button', { name: /^Réglages/ })).toContainText('Thème, sons…');
  await page.getByRole('button', { name: /^Réglages/ }).click();
  await expect(page.getByRole('group', { name: 'Langue' }).getByRole('button', { name: 'Français' })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => localStorage.getItem('go.langue.v1'))).toBeNull();
});

// Étape 3 : composants partagés. Joueur avec de l'XP, des parties, des problèmes réussis, Pomme battue et une erreur à rejouer.
const ERREUR = {
  id: 'erreur-en', creeLe: '2026-01-01T10:00:00.000Z', prochain: '2026-01-01', rates: 0, size: 9,
  rows: ['.........', '.........', '..O...X..', '.........', '....X....', '.........', '..X...O..', '.........', '.........'],
  toPlay: 1, reponses: [6 * 9 + 4], joue: 0, coup: 14, adversaire: 'Pomme',
};
const COMPOSANTS = '.niveau-texte, .niveau-suite, .paliers h3, .carte b, .carte small, .vedette-bulle b, .carrousel-legende, .stat span, .vitrine-detail, .pastille-niveau, .titre-pierres, .bases-aide, .grille-pb .small';

async function sansCoupeComposants(page: Page, largeur: number) {
  // Coupé : plus large que sa boîte, tronqué par le line-clamp, ou qui dépasse l'écran .
  const coupes = await page.evaluate(sel => [...document.querySelectorAll<HTMLElement>(sel)]
    .filter(e => e.offsetParent !== null && (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 2
      || e.getBoundingClientRect().right > innerWidth + 0.5))
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
    for (const legende of ['day streak', 'lessons done', 'opponent beaten', 'puzzles solved']) await expect(stats.getByText(legende, { exact: true })).toBeVisible();
    const vitrine = page.getByRole('region', { name: /^Badges, \d of 7$/ });
    await expect(vitrine.getByRole('button', { name: 'Pomme beaten: earned' })).toBeVisible();
    await expect(vitrine.getByRole('button', { name: 'First game: earned' })).toBeVisible();
    await expect(vitrine.getByRole('button', { name: '7-day streak: not earned yet. Keep a 7-day streak.' })).toHaveCount(1);
    await expect(page.getByText(/problèmes|victoires|Première partie|Réussis/)).toHaveCount(0);
    await sansDebordement(page);
    await sansCoupeComposants(page, largeur);
    await page.getByRole('button', { name: /^Settings/ }).click();
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

// Étape 4 : écran de partie, récit du score, fin de partie et revue. `?komi=-100` (paramètre de test) : Noir gagne en passant.
const PARTIE = '.actions button > span:last-child, .joueur-nom b, .joueur small, .barre-comptage .btn, .recit-etapes li, .camp-nom, .recit-continuer, '
  + '.fin-titre, .fin-marge, .fin-bilan, .fin-mochi p, .fin-action .cta, .fin-liens button, '
  + '.revue-tete h2, .revue-compteur, .bilan-table th, .bilan-score, .revue-dock .cta, .parcours-titre, .parcours-secondaires .btn';

async function sansCoupePartie(page: Page, largeur: number) {
  const coupes = await page.evaluate(sel => [...document.querySelectorAll<HTMLElement>(sel)]
    .filter(e => e.offsetParent !== null && (e.scrollWidth > e.clientWidth + 1 || e.getBoundingClientRect().right > innerWidth + 0.5))
    .map(e => e.textContent), PARTIE);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(largeur);
  expect(coupes).toEqual([]);
}

for (const largeur of [390, 320]) {
  test(`?lang=en : partie courte contre Pomme, score, fin et revue en anglais à ${largeur} px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const erreurs: string[] = [];
    page.on('pageerror', e => erreurs.push(e.message));
    await page.goto('/?lang=en&komi=-100');
    await page.getByRole('button', { name: 'Play your first game against Pomme' }).click();

    // Écran de partie : bandeaux, bulle d'intro, barre d'actions.
    const grille = page.getByRole('grid', { name: 'Go board 9 × 9' });
    await expect(grille).toBeVisible();
    await expect(page.locator('.joueur[data-joueur="You"]')).toBeVisible();
    await expect(page.getByText(/^The goal: surround more territory than Pomme/)).toBeVisible();
    const actions = page.getByRole('toolbar', { name: 'Game actions' });
    for (const nom of ['Hint', 'Who’s ahead?', 'Pass', 'More']) await expect(actions.getByRole('button', { name: nom, exact: true })).toBeVisible();
    // Annuler et abandonner sont dans le menu « More » (v3).
    await actions.getByRole('button', { name: 'More', exact: true }).click();
    for (const nom of ['Undo', 'Resign']) await expect(actions.getByRole('button', { name: nom, exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(actions.getByRole('button', { name: 'Hint' })).toHaveAccessibleDescription('3 hints left');
    await sansCoupePartie(page, largeur);

    // Un coup, la réponse de Pomme, puis deux passes.
    const passer = actions.getByRole('button', { name: 'Pass', exact: true });
    await expect(passer).toBeEnabled({ timeout: 10_000 });
    await jouer(page, 'E5');
    const coach = page.locator('.coach p[aria-live="polite"]');
    await expect(coach).toHaveText(/^Pomme (plays [A-J]\d\. (Your turn\.|Some borders)|captures)|^Atari!/, { timeout: 10_000 });
    await expect(page.getByRole('list', { name: 'Moves played' })).toContainText('1. E5');
    await expect(page.getByText(/Tu joues|Pomme joue|À toi|Indice|Passer|Abandonner/)).toHaveCount(0);
    await sansCoupePartie(page, largeur);
    await page.screenshot({ path: `docs/localisation/captures/partie-en-${largeur}.png` });

    const fin = page.locator('.recit, .barre-comptage .btn.primary:enabled');
    for (let i = 0; i < 6 && !(await fin.first().isVisible()); i++) {
      await expect(passer).toBeEnabled({ timeout: 10_000 });
      await passer.click();
      // Partie pas finie : Mochi prévient avant le passe (#235), on confirme.
      const choix = page.getByRole('group', { name: 'Pass now?' });
      if (await choix.waitFor({ state: 'visible', timeout: 600 }).then(() => true, () => false)) await choix.getByRole('button', { name: 'Pass', exact: true }).click();
      await expect(fin.or(page.getByText(/Pomme (plays|captures|continue)|Some borders are still open/)).first()).toBeVisible({ timeout: 10_000 });
    }
    await expect(fin.first()).toBeVisible({ timeout: 10_000 });
    const valider = page.getByRole('button', { name: 'Confirm score' });
    if (await valider.isVisible()) {
      await expect(page.locator('.comptage')).toContainText('(komi included)');
      await sansCoupePartie(page, largeur);
      await valider.click();
    }

    // Récit du score (tout affiché d'emblée : mouvements réduits).
    const recit = page.getByRole('region', { name: 'Counting the points' });
    await expect(recit).toBeVisible();
    await expect(recit.locator('.camp-nom').first()).toHaveText('You');
    await expect(recit.getByText(/^(Territory: the empty points each side surrounds|No territory)$/)).toBeVisible();
    await expect(recit.getByText(/^−100 komi for Pomme/)).toBeVisible();
    await expect(recit.getByText('Komi makes up for Black’s edge of playing first.')).toBeVisible();
    await expect(recit.getByText(/^You win by [\d.]+ points?!$/)).toBeVisible();
    await expect(recit.getByText(/Territoires|komi pour|Tu gagnes/)).toHaveCount(0);
    await sansCoupePartie(page, largeur);
    await page.screenshot({ path: `docs/localisation/captures/score-en-${largeur}.png` });
    await recit.getByRole('button', { name: 'See the result' }).click();

    // Écran de fin : titre, écart, bilan, leçon de Mochi, action principale, liens.
    await expect(page.getByRole('heading', { level: 2, name: 'Victory' })).toBeVisible();
    await expect(page.locator('.fin-marge .sr-only')).toHaveText(/^by [\d.]+ points? on 9 × 9$/);
    await expect(page.locator('.fin-tampon')).toHaveText('BEATEN');
    await expect(page.locator('.fin-bilan')).toHaveText(/^(\d+ moves?|No moves played), (\d+ stones? captured|no stones captured)\. Your record vs Pomme: 1 win\.$/);
    await expect(page.locator('.fin-action .cta')).toHaveText(/Challenge Caillou$/);
    for (const nom of ['Review my game', 'Home']) await expect(page.getByRole('button', { name: nom, exact: true })).toBeVisible();
    await expect(page.getByText(/Victoire|Revoir ma partie|Accueil|Défier|Ton bilan|coups?,/)).toHaveCount(0);
    await sansDebordement(page);
    await sansCoupePartie(page, largeur);
    await page.screenshot({ path: `docs/localisation/captures/fin-en-${largeur}.png` });

    // Revue v3 (#405) : attente (proverbe), bilan (précision, notes), puis le parcours.
    await page.getByRole('button', { name: 'Review my game' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Review my game' })).toBeVisible();
    await expect(page.locator('.revue-analyse')).toHaveCount(0, { timeout: 30_000 });
    await expect(page.getByRole('img', { name: 'Lead graph: Black at the bottom, White at the top' })).toBeVisible();
    const table = page.getByRole('table', { name: 'Your moves, by rating' });
    await expect(table.getByRole('row', { name: /^Accuracy \d+%/ })).toBeVisible();
    await expect(table.locator('thead')).toContainText('You');
    await expect(page.getByText(/Meilleur|Erreur|Solide|Imprécision|Précision|Démarrer/)).toHaveCount(0);
    await sansDebordement(page);
    await sansCoupePartie(page, largeur);
    await page.getByRole('button', { name: 'Start review' }).click();
    await expect(page.getByText(/^Move \d+ of \d+$/)).toBeVisible();
    await expect(page.locator('.revue-dock .cta')).toHaveText(/^(Next|Finish)$/);
    await expect(page.getByRole('button', { name: 'Previous move' })).toBeVisible();
    for (let k = 0; k < 8; k++) await page.keyboard.press('ArrowLeft');
    await expect(page.getByText(/^Move 0 of \d+$/)).toBeVisible();
    await expect(page.locator('.parcours-detail')).toHaveText('Start of the game. Tap “Next” to see the first key move.');
    await page.getByRole('button', { name: 'Next move' }).click();
    await expect(page.locator('.parcours-titre')).toHaveText(/E5 is /);
    await expect(page.getByRole('button', { name: /^Move 1, E5/ })).toBeVisible();
    await expect(page.getByText(/Coup \d|Tu joues|Rejouer|Précision|Suivant/)).toHaveCount(0);
    await sansDebordement(page);
    await sansCoupePartie(page, largeur);
    await page.screenshot({ path: `docs/localisation/captures/revue-en-${largeur}.png` });
    expect(erreurs).toEqual([]);
  });
}
