import { expect, test, type Page } from '@playwright/test';
import { attendrePierre, jouer } from './plateau';

// Issue #161 : une série dès le jour 1 pour le joueur sans compte, gardée sur le téléphone.
// Horloge figée à midi, heure de Paris. Le Go du jour n° 1 (27/09/2026) est le problème b1 (réponse E5).
const JOUR_1 = new Date('2026-09-27T12:00:00+02:00');
const JOUR_3 = new Date('2026-09-29T12:00:00+02:00');
const JOUR_5 = new Date('2026-10-01T12:00:00+02:00');
const nav = (page: Page, nom: string) => page.getByRole('navigation').getByRole('button', { name: nom }).click();

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('jour 1 sans compte : la série vaut 1 partout (accueil, Problèmes, Profil)', async ({ page }) => {
  await page.clock.setFixedTime(JOUR_1);
  await page.goto('/?go-du-jour=1');
  await jouer(page, 'E5');
  await attendrePierre(page, 'E5', 'noir');
  await page.getByRole('button', { name: 'Retour aux problèmes' }).first().click();

  // Écran Problèmes : la flamme, comme pour un joueur connecté, et l'invitation habituelle (pas encore le jour 3).
  await expect(page.locator('.palmares-serie')).toContainText('1');
  await expect(page.locator('.palmares-serie')).toContainText('jour de suite');
  await expect(page.getByRole('button', { name: 'Me connecter' })).toBeVisible();
  await expect(page.getByText('Avec un compte, ta série et tes leçons te suivent.')).toHaveCount(0);

  // Accueil : la flamme dans l'en-tête.
  await nav(page, 'Jouer');
  await expect(page.getByRole('img', { name: 'Série de 1 jour' })).toBeVisible();

  // Profil : plus de « 0 jour de série ».
  await nav(page, 'Profil');
  await expect(page.locator('.identite').getByRole('img', { name: 'Série de 1 jour' })).toBeVisible();
  await expect(page.getByText('Sans compte, tout reste sur ce téléphone.')).toBeVisible();

  // La série reste sur le téléphone : toujours là le lendemain (pas encore joué), perdue deux jours plus tard.
  await page.clock.setFixedTime(new Date('2026-09-28T09:00:00+02:00'));
  await page.reload();
  await expect(page.getByRole('img', { name: 'Série de 1 jour' })).toBeVisible();
  await page.clock.setFixedTime(new Date('2026-09-29T09:00:00+02:00'));
  await page.reload();
  await expect(page.getByRole('img', { name: /^Série de/ })).toHaveCount(0);
});

test('3e jour de série sans compte : invitation discrète à créer un compte', async ({ page }) => {
  await page.clock.setFixedTime(JOUR_3);
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('go.go-du-jour.v1', JSON.stringify({ dernier: 3, jours: 3 })));
  await page.reload();

  await expect(page.getByRole('img', { name: 'Série de 3 jours' })).toBeVisible();
  await nav(page, 'Problèmes');
  await expect(page.locator('.palmares-serie')).toContainText('3');
  await expect(page.getByText('Avec un compte, ta série et tes leçons te suivent.')).toBeVisible();
  await page.getByRole('button', { name: 'Créer un compte' }).click();
  await expect(page.getByRole('navigation').getByRole('button', { name: 'Profil' })).toHaveAttribute('aria-current', 'page');

  // Profil : la ligne sous « Invité » devient l'invitation ; « Mon compte » reste l'action.
  await expect(page.locator('.identite')).toContainText('Avec un compte, ta série et tes leçons te suivent.');
  await page.getByRole('button', { name: /Mon compte/ }).click();
  await expect(page.getByRole('heading', { name: 'Mon compte' })).toBeVisible();

  // Aucun défilement horizontal à 390 px.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('un gel de l’appareil garde la série affichée après un jour manqué', async ({ page }) => {
  await page.clock.setFixedTime(JOUR_5);
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('go.go-du-jour.v1', JSON.stringify({ dernier: 3, jours: 3 }));
    localStorage.setItem('go.gel.v1', JSON.stringify({ gels: 1, geles: [], annonce: null }));
  });
  await page.reload();
  await expect(page.getByRole('img', { name: 'Série de 3 jours' })).toBeVisible();
  await nav(page, 'Profil');
  await expect(page.locator('.identite').getByRole('img', { name: 'Série de 3 jours' })).toBeVisible();
});
