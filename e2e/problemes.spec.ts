import { expect, test } from '@playwright/test';
import { attendrePierre, jouer, plateau } from './plateau';

// Issue #11 : problèmes sans connexion (copie locale des problèmes de base).

test('problèmes sans compte : erreur, bonne réponse, suite et problème suivant', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Problèmes' }).click();

  await expect(page.getByRole('heading', { name: /^Go du jour n°\s\d+$/ })).toBeVisible();
  // Le Go du jour mis en scène, puis la grille des problèmes (au moins les 18 de #11 et #16 ; les lots de #91 s'y ajoutent).
  expect(await page.getByRole('button', { name: /^Problème \d+ : / }).count()).toBeGreaterThanOrEqual(18);
  await expect(page.getByRole('button', { name: 'Résoudre le Go du jour' })).toBeVisible();
  const debord = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(debord).toBeLessThanOrEqual(0);

  // Le problème b1 (par son titre, les lots de #91 s'intercalent par difficulté) : la pierre blanche D5 n'a plus qu'une liberté, en E5.
  await page.getByRole('button', { name: /^Problème \d+ : Capture la pierre/ }).click();
  await expect(plateau(page)).toBeVisible();

  await jouer(page, 'A1');
  await expect(page.getByText('Pas tout à fait. Essaie encore.')).toBeVisible();
  await attendrePierre(page, 'A1', null);

  await jouer(page, 'E5');
  await expect(page.getByText('Bravo, c’est le bon coup !')).toBeVisible();
  await attendrePierre(page, 'E5', 'noir');
  await attendrePierre(page, 'D5', null);

  await page.getByRole('button', { name: 'Voir la suite' }).click();
  await expect(page.getByText(/Voilà la suite/)).toBeVisible();
  await attendrePierre(page, 'E5', 'noir');

  await page.getByRole('button', { name: 'Problème suivant' }).click();
  // Les problèmes sont rangés par difficulté (#91) : après b1 (400) vient b4 (400), « Sauve ta pierre ».
  await expect(page.getByRole('heading', { name: 'Sauve ta pierre' })).toBeVisible();

  // Le problème réussi reste coché après rechargement.
  await page.reload();
  await page.getByRole('navigation').getByRole('button', { name: 'Problèmes' }).click();
  await expect(page.getByRole('button', { name: /^Problème \d+ : Capture la pierre, réussi/ })).toBeVisible();
});

// Issue #93 : paliers. Novice est verrouillé tant que 60 % des Débutant ne sont pas réussis.
test('paliers : Novice verrouillé, puis ouvert après les réussites', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => { if (!sessionStorage.getItem('init')) { localStorage.setItem('go.problemes.v1', JSON.stringify({ b1: true })); sessionStorage.setItem('init', '1'); } });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Problèmes' }).click();

  const debutant = page.getByRole('group', { name: /^Débutant/ });
  const novice = page.getByRole('group', { name: /^Novice/ });
  await expect(debutant.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
  await expect(novice).toHaveAccessibleName(/verrouillé/);
  await expect(novice.getByText('Réussis 60 % du palier précédent pour l’ouvrir.')).toBeVisible();
  const verrouilles = novice.getByRole('button', { name: /, verrouillé$/ });
  expect(await verrouilles.count()).toBeGreaterThan(0);
  await expect(verrouilles.first()).toBeDisabled();

  // « Continuer » ouvre le prochain problème non réussi du palier ouvert le plus avancé : Sauve ta pierre (b4).
  await page.getByRole('button', { name: /^Continuer : / }).click();
  await expect(page.getByRole('heading', { name: 'Sauve ta pierre' })).toBeVisible();
  await jouer(page, 'D4');
  await expect(page.getByRole('button', { name: 'Problème suivant' })).toBeVisible();
  await page.getByRole('button', { name: 'Retour aux problèmes' }).first().click();

  // 2 sur 3 réussis : Novice s'ouvre.
  await expect(debutant.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2');
  await expect(novice).not.toHaveAccessibleName(/verrouillé/);
  await expect(novice.getByText('Réussis 60 % du palier précédent pour l’ouvrir.')).toHaveCount(0);
  await expect(novice.getByRole('button').first()).toBeEnabled();
  const debord = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(debord).toBeLessThanOrEqual(0);
});
