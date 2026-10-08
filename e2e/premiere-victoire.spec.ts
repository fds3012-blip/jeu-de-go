import { expect, test } from '@playwright/test';
import { passer } from './plateau';

// Issue #160 : les 3 premières parties contre l'ordi se jouent avec un komi de 0,5, annoncé par Mochi,
// et la barre d'avantage est cachée pendant la toute première. Le score final compte bien ce komi annoncé.
test('première partie : komi 0,5 annoncé et expliqué, pas de barre d’avantage, score compté avec 0,5', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.goto('/');
  await page.locator('.cta').click();
  await expect(page.locator('svg.board[aria-label="Plateau de go 9 × 9"]')).toBeVisible();

  // Mochi dit le but, puis explique le komi en une phrase.
  const annonce = page.locator('.annonce-komi');
  await expect(annonce).toHaveText(/^Le komi\s: des points donnés à Blanc, qui joue en second\. Pour tes premières parties, il est de 0,5\.$/);
  await expect(page.getByText(/Le but\s: entourer plus de territoire que Pomme/)).toBeVisible();
  await expect(page.locator('.avantage')).toHaveCount(0);

  // Plateau vide : Noir passe, Pomme passe. Seul le komi compte : Pomme gagne de 0,5 point exactement.
  await passer(page);
  const recit = page.locator('.recit');
  await expect(recit).toBeVisible({ timeout: 10_000 });
  await expect(recit).toContainText('+0,5 komi pour Pomme');
  await expect(page.getByTestId('recit-noir')).toHaveText('0');
  await expect(page.getByTestId('recit-blanc')).toHaveText('0,5');
  await expect(page.getByRole('heading', { level: 2, name: 'Défaite' })).toBeVisible({ timeout: 6000 });
  await expect(page.locator('.fin-marge')).toContainText('de 0,5 point sur 9 × 9');

  // #251 : cette partie finie sur un plateau vide ne compte pas parmi les 3 parties à komi réduit.
  // La partie suivante est encore la « première » : komi 0,5 expliqué, sans barre d'avantage. Le but n'est pas redit.
  await page.locator('.cta').click();
  await expect(annonce).toHaveText(/^Le komi\s: des points donnés à Blanc, qui joue en second\. Pour tes premières parties, il est de 0,5\.$/);
  await expect(page.getByText(/Le but\s: entourer/)).toHaveCount(0);
  await expect(page.locator('.avantage')).toHaveCount(0);
  const parties = await page.evaluate(() => JSON.parse(localStorage.getItem('go.parties.v1') ?? '{}'));
  expect(parties).toMatchObject({ n: 2, ordi: 1 });
  expect(erreurs).toEqual([]);
});

test('deuxième partie (après une vraie première partie) : rappel court du komi, la barre d’avantage revient', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('go.parties.v1', JSON.stringify({ n: 1, ordi: 1, dernier: 'pomme' }));
    localStorage.setItem('go.intro-but.v1', 'true');
  });
  await page.reload();
  await page.locator('.cta').click();
  await expect(page.locator('.annonce-komi')).toHaveText('Cette partie encore, le komi est de 0,5 point.');
  await expect(page.getByRole('img', { name: /^Avantage estimé : (Noir \+|Blanc \+|À égalité)/ })).toBeVisible({ timeout: 10_000 });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('go.parties.v1') ?? '{}').ordi)).toBe(2);
});

test('quatrième partie : le komi habituel (6,5) revient, et Mochi le dit', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('go.parties.v1', JSON.stringify({ n: 3, ordi: 3, dernier: 'pomme' }));
    localStorage.setItem('go.intro-but.v1', 'true');
  });
  await page.reload();
  await page.locator('.cta').click();
  await expect(page.locator('.annonce-komi')).toHaveText('Le komi passe à 6,5 points, sa valeur habituelle.');
  await passer(page);
  await expect(page.locator('.recit')).toContainText('+6,5 komi pour Pomme', { timeout: 10_000 });
  await expect(page.getByTestId('recit-blanc')).toHaveText('6,5');
});
