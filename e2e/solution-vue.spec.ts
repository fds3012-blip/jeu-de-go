import { expect, test, type Page } from '@playwright/test';
import { attendrePierre, jouer, pierres, plateau } from './plateau';

// Issue #197 : après un échec, l'aide vient par marches (indice, réfutation, réponse).
// Un problème résolu après avoir vu la réponse est « Vu », pas « Réussi » : pas d'XP, pas de palier ; la série du jour tient.

/** Deux coups faux et les trois marches de l'aide sur « Capture la pierre » (b1 : la réponse est E5). */
async function aideComplete(page: Page) {
  await jouer(page, 'A1');
  await expect(page.getByText('Pas tout à fait. Essaie encore.')).toBeVisible();
  // #237 (N6) : pas de « Réessayer », l'indice est un lien discret.
  await expect(page.getByRole('button', { name: 'Réessayer' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Voir un indice' })).toHaveClass(/\blien\b/);
  // Plus de réponse donnée dès le premier échec.
  await expect(page.getByRole('button', { name: 'Voir la suite' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Voir la réponse' })).toHaveCount(0);

  // 1. L'indice : la zone du bon coup est entourée, le plateau reste jouable.
  await page.getByRole('button', { name: 'Voir un indice' }).click();
  await expect(page.getByText('Indice : le bon coup est dans la zone entourée. À toi !')).toBeVisible();
  await expect(plateau(page).locator('g[data-indice]')).toHaveCount(1);
  await jouer(page, 'B2');
  await expect(page.getByText('Pas tout à fait. Essaie encore.')).toBeVisible();

  // 2. La réfutation : Blanc répond au coup faux, au point clé, sur le plateau.
  await page.getByRole('button', { name: 'Voir pourquoi' }).click();
  await expect(page.getByText('Blanc répond au point clé. Le bon coup, c’est de jouer là avant lui.')).toBeVisible();
  await attendrePierre(page, 'B2', 'noir');
  await attendrePierre(page, 'E5', 'blanc');
  await expect(page.getByText('Rejoue directement sur le plateau.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Réessayer' })).toHaveCount(0);

  // 3. La réponse.
  await page.getByRole('button', { name: 'Voir la réponse' }).click();
  // #497 : la réponse vient avec son pourquoi (b1 n'a pas de texte de solution : fait calculé par les règles).
  await expect(page.locator('[data-pourquoi-probleme]')).toHaveText(/^Voilà la réponse\s:\sE5\. E5 prend une pierre blanche\.$/);
  await expect(page.getByText(/Rejoue-la pour la retenir/)).toHaveCount(0);
  await attendrePierre(page, 'E5', 'noir');
  // Pas de « Réessayer » : toucher la pierre montrée remet la position de départ, puis on rejoue le coup.
  await expect(page.getByRole('button', { name: 'Réessayer' })).toHaveCount(0);
  await jouer(page, 'E5');
  await expect(pierres(page, 'noir')).toHaveCount(3);
  await jouer(page, 'E5');
  await expect(page.getByText(/Tu as vu la réponse\s:\sce problème compte comme vu, pas réussi/)).toBeVisible();
  await expect(page.getByText('Bravo, c’est le bon coup !')).toHaveCount(0);
}

test('problème vu : indice, réfutation, réponse, puis « Vu » sans XP ni palier', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Problèmes' }).click();
  await page.getByRole('button', { name: 'Tous les problèmes' }).click();
  await page.getByRole('button', { name: /^Problème \d+ : Capture la pierre/ }).click();

  await aideComplete(page);
  // Pas d'XP, pas de réussite enregistrée.
  expect(await page.evaluate(() => localStorage.getItem('go.xp.v1'))).toBeNull();
  expect(JSON.parse((await page.evaluate(() => localStorage.getItem('go.problemes.v1'))) ?? '{}')).not.toHaveProperty('b1');
  await expect(page.getByRole('button', { name: 'Problème suivant' })).toBeVisible();

  await page.getByRole('button', { name: 'Retour aux problèmes' }).first().click();
  await expect(page.getByRole('button', { name: /^Problème \d+ : Capture la pierre, vu$/ })).toBeVisible();
  await expect(page.getByRole('group', { name: /^Débutant/ })).toHaveAttribute('data-reussis', '0');

  // Résolu ensuite sans aide : il devient « Réussi ».
  await page.getByRole('button', { name: /^Problème \d+ : Capture la pierre, vu$/ }).click();
  await jouer(page, 'E5');
  await expect(page.getByText('Bravo, c’est le bon coup !')).toBeVisible();
  await page.getByRole('button', { name: 'Retour aux problèmes' }).first().click();
  await expect(page.getByRole('button', { name: /^Problème \d+ : Capture la pierre, réussi$/ })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('go.xp.v1'))).not.toBeNull();
});

test('Go du jour vu : pas de partage ni d’XP, mais la série du jour tient', async ({ page }) => {
  // Horloge figée le 27 septembre 2026 à midi, heure de Paris : Go du jour n° 1, le problème b1.
  await page.clock.setFixedTime(new Date('2026-09-27T12:00:00+02:00'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?go-du-jour=1');
  await expect(page.getByText(/^Go du jour n°\s1$/)).toBeVisible();

  await aideComplete(page);
  await expect(page.getByText('Ta série tient quand même.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Partager' })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('go.xp.v1'))).toBeNull();

  await page.getByRole('button', { name: 'Retour aux problèmes' }).first().click();
  await expect(page.locator('.tampon-reussi')).toHaveText('Vu');
  await expect(page.locator('.palmares-serie')).toContainText('1');
  const debord = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(debord).toBeLessThanOrEqual(0);
});
