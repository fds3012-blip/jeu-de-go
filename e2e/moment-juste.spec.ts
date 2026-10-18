import { expect, test } from '@playwright/test';
import { ouvrirLancementOrdi } from './plateau';
import { ouvrirNiveauBadges } from './profil';

// #631 (lot V11, principe P1 de DESIGN.md) : une information n'apparaît qu'au moment où elle sert une décision.
// Ce qui disparaît revient quand il sert : la phrase du kyu à la première ouverture, la cote après une partie classée,
// chaque chiffre du Profil dès qu'il n'est plus à zéro.

const nav = (page: import('@playwright/test').Page, nom: string) => page.getByRole('navigation').getByRole('button', { name: nom, exact: true }).click();

test('feuille de lancement : la phrase du kyu à la première ouverture seulement, une grille par taille', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('pret')) return;
    sessionStorage.setItem('pret', '1');
    localStorage.setItem('go.premiere-pierre.v1', 'true');
    localStorage.setItem('go.parties.v1', JSON.stringify({ n: 1, dernier: 'pomme', ordi: 1 }));
  });
  await page.goto('/');
  let feuille = await ouvrirLancementOrdi(page);
  await expect(feuille.getByTestId('feuille-kyu')).toHaveText(/^Le kyu, c’est le grade au go/);
  // La taille se montre par sa grille ; le nom du bouton reste « 9 × 9 ».
  const tailles = feuille.getByRole('group', { name: 'Taille du plateau' });
  await expect(tailles.locator('svg.grille-taille')).toHaveCount(3);
  await expect(tailles.getByRole('button', { name: '9 × 9', exact: true })).toBeVisible();
  for (const b of await tailles.getByRole('button').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await feuille.getByRole('button', { name: 'Fermer' }).click();
  await expect(feuille).toBeHidden();

  // Deuxième ouverture, puis après rechargement : le mot est connu, la phrase ne revient pas.
  feuille = await ouvrirLancementOrdi(page);
  await expect(feuille.getByTestId('feuille-kyu')).toHaveCount(0);
  await expect(feuille.getByRole('button', { name: /^Pomme, 20 kyu/ })).toBeVisible();
  await page.reload();
  feuille = await ouvrirLancementOrdi(page);
  await expect(feuille.getByTestId('feuille-kyu')).toHaveCount(0);
});

test('Statistiques sans partie classée : ni cote ni grade, une phrase par carte, pas de bilan vide', async ({ page }) => {
  await page.goto('/');
  await nav(page, 'Profil');
  await page.getByTestId('ligne-stats').click();
  const stats = page.getByTestId('stats');
  await expect(stats).toBeVisible();
  await expect(page.getByTestId('stats-cote')).toHaveCount(0);
  await expect(stats).not.toContainText(/1500|kyu|\?/);
  await expect(stats.getByRole('region', { name: 'Ta cote' })).toContainText('Ta cote se lit avec un compte');
  await expect(stats.getByRole('region', { name: 'Bilan' })).toHaveCount(0);
  // Les visuels fantômes ne sont pas lus : chaque carte vide se résume à son titre et à sa phrase.
  for (const carte of await stats.locator('.mstats-carte').all()) await expect(carte.locator('p')).toHaveCount(1);
  await expect(stats.locator('.mstats-fantome')).toHaveCount(2);
  await expect(stats.getByRole('img')).toHaveCount(0);
});

test('Profil : pas de chiffre à zéro, chacun revient avec le premier', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('pret')) return;
    sessionStorage.setItem('pret', '1');
    localStorage.setItem('go.lecons.v1', JSON.stringify({ l1: 6 }));
  });
  await page.goto('/');
  await nav(page, 'Profil');
  // #654 : le sommaire n'affiche aucun compteur à zéro (pas de « 0 parties », « 0 / 3 », « 0 » badge)…
  await expect(page.getByTestId('ligne-niveau')).toBeVisible();
  await expect(page.locator('.sommaire-etat').filter({ hasText: /(^|\D)0(\D|$)/ })).toHaveCount(0);
  await expect(page.getByText(/^0$/)).toHaveCount(0);
  // … et les chiffres du parcours, dans « Niveau et badges », ne montrent que ceux qui existent.
  await ouvrirNiveauBadges(page);
  const stats = page.getByRole('list', { name: 'Tes statistiques' });
  await expect(stats.getByRole('listitem')).toHaveCount(1);
  await expect(stats).toContainText(/leçon finie/);
  await expect(page.getByText(/^0$/)).toHaveCount(0);

  await page.evaluate(() => localStorage.setItem('go.problemes.v1', JSON.stringify({ b1: true })));
  await page.reload();
  await nav(page, 'Profil');
  await ouvrirNiveauBadges(page);
  await expect(stats.getByRole('listitem')).toHaveCount(2);
  await expect(stats).toContainText(/1\s*problème réussi/);
});
