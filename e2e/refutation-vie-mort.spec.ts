import { expect, test, type Page } from '@playwright/test';
import { attendrePierre, jouer, plateau } from './plateau';

// Issue #554 : en vie et mort, un coup faux reçoit la réplique prouvée de Blanc (figée hors ligne,
// src/go/refutations-locales.gen.ts) et une phrase : le geste lu sur le plateau, puis l'issue prouvée.

const MIDI_PARIS = new Date('2026-09-27T12:00:00+02:00');

async function ouvrirProbleme(page: Page, titre: RegExp) {
  await page.clock.setFixedTime(MIDI_PARIS);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Problèmes' }).click();
  await expect(page.locator('.themes')).toBeVisible();
  await page.getByRole('button', { name: 'Tous les problèmes' }).click();
  await page.getByRole('button', { name: titre }).click();
  await expect(plateau(page)).toBeVisible();
}

test('vivre (q01) : Blanc joue au point vital, C1 devient un faux œil, et ton groupe ne peut plus faire deux yeux', async ({ page }) => {
  await ouvrirProbleme(page, /^Problème \d+ : Rends ton œil vrai/);
  await jouer(page, 'G2');
  const comprise = page.locator('.verdict [data-erreur-comprise]');
  await expect(comprise).toHaveText(
    'Blanc joue en D2. C1 devient un faux œil : Blanc peut y prendre tes pierres. Ton groupe ne peut plus faire deux yeux.');
  await attendrePierre(page, 'D2', 'blanc');
  // Le texte relu du problème reste au-dessus : il dit la même réplique.
  await expect(page.locator('.verdict')).toContainText('Blanc joue D2');
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(sw).toBeLessThanOrEqual(cw);
});

test('tuer (q02) : Blanc prend le point que tu devais jouer, et son groupe a deux yeux', async ({ page }) => {
  await ouvrirProbleme(page, /^Problème \d+ : Rends l’œil faux/);
  await jouer(page, 'J3');
  await expect(page.locator('.verdict [data-erreur-comprise]')).toHaveText(
    'Blanc joue en F2, le point que tu devais jouer. Son groupe a deux yeux : il est vivant.');
  await attendrePierre(page, 'F2', 'blanc');
  // « Voir pourquoi » rejoue la même réplique, avec la même phrase.
  await page.getByRole('button', { name: 'Voir un indice' }).click();
  await jouer(page, 'J4');
  await page.getByRole('button', { name: 'Voir pourquoi' }).click();
  await expect(page.locator('.verdict [data-erreur-comprise]')).toContainText('Son groupe a deux yeux : il est vivant.');
});
