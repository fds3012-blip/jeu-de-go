import { expect, test } from '@playwright/test';
import { jouer } from './plateau';

// #U5 : la série est dite d'une seule façon (même pastille, même état) sur Jouer, Problèmes et Profil, et une leçon qui
// l'a gardée ne laisse pas un « À faire » en or sur le Go du jour.
// #U10 : tant que le Go du jour est à faire, Problèmes n'a qu'une porte pour lui : la carte du dessus.

test('série gardée par une leçon : flamme pleine partout, plus de « À faire » en or', async ({ page }) => {
  await page.addInitScript(() => { if (!localStorage.getItem('go.test.seme')) { localStorage.setItem('go.test.seme', '1'); localStorage.setItem('go.lecons.v1', JSON.stringify({ l1: 5 })); localStorage.setItem('go.parties.v1', JSON.stringify({ n: 1 })); } });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const onglet = (nom: string) => page.getByRole('navigation').getByRole('button', { name: nom }).click();
  await page.goto('/');
  await onglet('Apprendre');
  // Avant la leçon : pas de série, rien à dire.
  await page.getByRole('button', { name: 'Reprendre la leçon : Libertés et capture' }).click();
  await jouer(page, 'E4');
  await page.getByRole('button', { name: 'Terminer la leçon' }).click();
  await expect(page.getByRole('heading', { name: 'Leçon terminée' })).toBeVisible();
  await page.getByRole('button', { name: 'Retour à Apprendre' }).click();

  await onglet('Jouer');
  await expect(page.getByTestId('flamme')).toHaveAttribute('data-etat', 'pleine');
  await expect(page.getByTestId('etat-du-jour')).toHaveCount(0);

  await onglet('Problèmes');
  await expect(page.getByTestId('serie-problemes')).toHaveAttribute('data-etat', 'pleine');
  await expect(page.getByTestId('serie-problemes')).toHaveAccessibleName(/^Série de 1 jour\. Go du jour fait aujourd’hui\.$/);
  // #U10 : une seule porte vers le Go du jour tant qu'il est à faire : la carte.
  await expect(page.getByRole('button', { name: 'Résoudre le Go du jour' })).toBeVisible();
  await expect(page.getByTestId('entree-du-jour')).toHaveCount(0);
  await expect(page.locator('.sommaire-etat')).toHaveCount(0);

  await onglet('Profil');
  await expect(page.getByTestId('serie-profil')).toHaveAttribute('data-etat', 'pleine');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('série en jeu, rien fait aujourd’hui : flamme creuse et « À faire » restent', async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('go.test.seme')) return;
    localStorage.setItem('go.test.seme', '1');
    localStorage.setItem('go.parties.v1', JSON.stringify({ n: 1 }));
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByTestId('flamme')).toHaveCount(0); // pas de série : pas de flamme (jamais de flamme éteinte)
  await expect(page.getByTestId('etat-du-jour')).toHaveText('À faire');
});
