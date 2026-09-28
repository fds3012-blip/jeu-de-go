import { expect, test, type Page } from '@playwright/test';
import { attendrePierre, jouer, plateau } from './plateau';
import { PROBLEMES_EN } from '../src/content/problemes.en';

// Issue #167 : les problèmes en anglais avec `?lang=en` (catalogue local src/content/problemes.en.ts, par id,
// par-dessus le texte français, qu'il vienne de Supabase ou des lots). Sans `?lang`, rien ne change.
// Horloge figée le 27 septembre 2026 à midi, heure de Paris : Go du jour n° 1, le problème b1.
const MIDI_PARIS = new Date('2026-09-27T12:00:00+02:00');

async function figer(page: Page) {
  await page.clock.setFixedTime(MIDI_PARIS);
  await page.emulateMedia({ reducedMotion: 'reduce' });
}

async function sansDebordement(page: Page, ecran: string) {
  const { large, fenetre } = await page.evaluate(() => ({ large: document.documentElement.scrollWidth, fenetre: innerWidth }));
  expect(large, `défilement horizontal : ${ecran}`).toBeLessThanOrEqual(fenetre);
}

for (const largeur of [390, 320]) test(`?lang=en : Go du jour et problème de la liste en anglais, à ${largeur} px`, async ({ page }) => {
  await page.setViewportSize({ width: largeur, height: 780 });
  await figer(page);

  // Go du jour n° 1 : b1.
  await page.goto('/?lang=en&go-du-jour=1');
  await expect(page.getByText(/^Daily Go #1$/)).toBeVisible();
  await expect(plateau(page)).toBeVisible();
  await expect(page.getByRole('heading', { name: PROBLEMES_EN.b1.title })).toBeVisible();
  await expect(page.getByText(PROBLEMES_EN.b1.prompt)).toBeVisible();
  await expect(page.getByText('Capture la pierre')).toHaveCount(0);
  await sansDebordement(page, 'Go du jour');
  await page.screenshot({ path: `docs/localisation/captures/go-du-jour-en-${largeur}.png` });

  // Un problème de la liste : a01, le premier du palier Débutant. Erreur (réfutation), puis réussite (explication).
  await page.goto('/?lang=en');
  await page.getByRole('navigation').getByRole('button', { name: 'Puzzles' }).click();
  await page.getByRole('button', { name: 'All puzzles' }).click();
  await page.getByRole('group', { name: 'Beginner' }).locator('[data-probleme="a01"]').click();
  await expect(page.getByRole('heading', { name: PROBLEMES_EN.a01.title })).toBeVisible();
  await expect(page.getByText(PROBLEMES_EN.a01.prompt)).toBeVisible();
  await sansDebordement(page, 'problème a01');

  await jouer(page, 'A9');
  await expect(page.getByText(PROBLEMES_EN.a01.refutation!)).toBeVisible();
  await sansDebordement(page, 'réfutation a01');
  await jouer(page, 'E4');
  await attendrePierre(page, 'E4', 'noir');
  await expect(page.getByText(PROBLEMES_EN.a01.explanation!)).toBeVisible();
  await expect(page.getByText(/Première capture|Bravo/)).toHaveCount(0);
  await sansDebordement(page, 'explication a01');
  await page.screenshot({ path: `docs/localisation/captures/probleme-en-${largeur}.png`, fullPage: true });
});

test('sans ?lang : le Go du jour et les problèmes restent en français', async ({ page }) => {
  await figer(page);
  await page.goto('/?go-du-jour=1');
  await expect(page.getByText(/^Go du jour n°\s1$/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Capture la pierre' })).toBeVisible();
  await expect(page.getByText(PROBLEMES_EN.b1.prompt)).toHaveCount(0);

  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Problèmes' }).click();
  await page.getByRole('button', { name: 'Tous les problèmes' }).click();
  await page.getByRole('group', { name: /^Débutant/ }).locator('[data-probleme="a01"]').click();
  await expect(page.getByRole('heading', { name: 'Première capture' })).toBeVisible();
  await expect(page.getByText('Capture tout de suite la pierre blanche marquée.')).toBeVisible();
  await expect(page.getByText(PROBLEMES_EN.a01.title)).toHaveCount(0);
});
