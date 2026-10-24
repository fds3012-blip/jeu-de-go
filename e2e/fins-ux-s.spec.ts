import { expect, test, type Page } from '@playwright/test';
import { choisirMode, jouer, jouerSuite, partieADeux, passer, passerJusquAuScore } from './plateau';

// #U4 : la fin d'une leçon ou d'une partie qui allume la série le dit une fois (« 1 jour de série · À demain »).
// #U8 : la première victoire qui ouvre un nouvel adversaire passe par son écran (portrait dévoilé, une phrase).

async function finirLecon1(page: Page) {
  await page.addInitScript(() => { if (!localStorage.getItem('go.test.seme')) { localStorage.setItem('go.test.seme', '1'); localStorage.setItem('go.lecons.v1', JSON.stringify({ l1: 5 })); } });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
  await page.getByRole('button', { name: 'Reprendre la leçon : Libertés et capture' }).click();
  await jouer(page, 'E4');
  await page.getByRole('button', { name: 'Terminer la leçon' }).click();
  await expect(page.getByRole('heading', { name: 'Leçon terminée' })).toBeVisible();
}

test('fin de leçon : la première du jour dit la série, la seconde se tait (#U4)', async ({ page }) => {
  await finirLecon1(page);
  const serie = page.locator('.fin-lecon').getByTestId('serie-du-jour');
  await expect(serie).toHaveText(/^1\sjour\sde\ssérie\s*À\sdemain$/);
  await expect(page.locator('.fin-lecon .cta')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  // Même jour, série déjà allumée : la leçon refaite ne répète pas la ligne.
  await page.evaluate(() => localStorage.setItem('go.lecons.v1', JSON.stringify({ l1: 5 })));
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
  await page.getByRole('button', { name: 'Reprendre la leçon : Libertés et capture' }).click();
  await jouer(page, 'E4');
  await page.getByRole('button', { name: 'Terminer la leçon' }).click();
  await expect(page.getByRole('heading', { name: 'Leçon terminée' })).toBeVisible();
  await expect(page.getByTestId('serie-du-jour')).toHaveCount(0);
});

test('fin de partie de plus de 10 coups : la série du jour est dite une fois (#U4)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await partieADeux(page);
  await jouerSuite(page, ['C3', 'G7', 'C4', 'G6', 'C5', 'G5', 'C6', 'G4', 'C7', 'G3', 'D3', 'F7']);
  await passer(page);
  await passer(page);
  await page.getByRole('button', { name: 'Valider le score' }).click();
  await expect(page.locator('.fin')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.fin').getByTestId('serie-du-jour')).toHaveText(/^1\sjour\sde\ssérie\s*À\sdemain$/);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(844);
});

test.describe('victoire sur Caillou', () => {
  test.beforeEach(async ({ page }) => {
    // Pomme déjà battue, Caillou choisi : sa première victoire ouvre Bambou (verrouillé jusque-là).
    await page.addInitScript(() => {
      if (localStorage.getItem('go.test.seme')) return;
      localStorage.setItem('go.test.seme', '1');
      localStorage.setItem('go.bilan.v1', JSON.stringify({ pomme: { v: 1, d: 0 } }));
      localStorage.setItem('go.adversaire.v1', JSON.stringify('caillou'));
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?komi=-100');
    await choisirMode(page, 'ordi');
    await passerJusquAuScore(page);
    await expect(page.getByRole('heading', { level: 2, name: 'Victoire' })).toBeVisible();
  });

  test('Bambou s’ouvre sur son écran : portrait, une phrase, un bouton ; « Plus tard » revient à la fin (#U8)', async ({ page }) => {
    const cta = page.locator('.fin .cta');
    await expect(cta).toHaveText('Défier Bambou');
    await cta.click();
    const ecran = page.getByTestId('adversaire-ouvert');
    await expect(ecran).toBeVisible();
    await expect(ecran.getByRole('heading', { level: 2 })).toHaveText('Bambou est ouvert');
    await expect(ecran).toContainText('Il plie, mais ne rompt jamais.');
    await expect(ecran.locator('[data-portrait="bambou"]')).toBeVisible();
    // Mouvements réduits : l'état final, sans voile ni cadenas.
    await expect(ecran.locator('.ouvert-voile')).toHaveCSS('opacity', '0');
    await expect(ecran.locator('.ouvert-cadenas')).toHaveCSS('opacity', '0');
    await expect(ecran.locator('.cta')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await ecran.getByRole('button', { name: 'Plus tard' }).click();
    await expect(ecran).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 2, name: 'Victoire' })).toBeVisible();
  });

  test('le bouton de l’écran lance la partie contre Bambou (#U8)', async ({ page }) => {
    await page.locator('.fin .cta').click();
    await page.getByTestId('adversaire-ouvert').locator('.cta').click();
    await expect(page.getByText(/Bambou a Blanc/)).toBeVisible();
  });
});
