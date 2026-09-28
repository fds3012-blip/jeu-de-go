import { expect, test, type Page } from '@playwright/test';
import { attendrePierre, jouer, plateau } from './plateau';

// Issue #75 : Go du jour, défi quotidien commun et partageable.
// Horloge figée le 27 septembre 2026 à midi, heure de Paris : Go du jour n° 1, le problème b1 (réponse E5).
const MIDI_PARIS = new Date('2026-09-27T12:00:00+02:00');

async function figer(page: Page) {
  await page.clock.setFixedTime(MIDI_PARIS);
  await page.emulateMedia({ reducedMotion: 'reduce' });
}

/** Remplace la feuille de partage : on garde ce qui est partagé. */
async function mockPartage(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __partages: ShareData[] };
    w.__partages = [];
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (d: ShareData) => { w.__partages.push(d); } });
  });
}

/** Pas de Web Share API : le texte part dans le presse-papiers. */
async function mockPressePapiers(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __copies: string[] };
    w.__copies = [];
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t: string) => { w.__copies.push(t); } } });
  });
}

test('le lien ouvre le Go du jour sans compte, on le résout, puis on le partage', async ({ page }) => {
  await figer(page);
  await mockPartage(page);
  const t0 = Date.now();
  await page.goto('/?go-du-jour=1');

  // Directement sur le problème, avec l'en-tête « Go du jour n° 1 ».
  await expect(page.getByText(/^Go du jour n°\s1$/)).toBeVisible();
  await expect(plateau(page)).toBeVisible();
  expect(Date.now() - t0).toBeLessThan(3000);
  await expect(page.getByText('Le Go du jour a changé')).toHaveCount(0);
  // Le paramètre est retiré de l'adresse : un rechargement ne compte pas une nouvelle arrivée.
  await expect(page).toHaveURL(/\/$/);

  await jouer(page, 'A1');
  await expect(page.getByText('Pas tout à fait. Essaie encore.')).toBeVisible();
  await page.getByRole('button', { name: 'Réessayer' }).click();
  await jouer(page, 'E5');
  await attendrePierre(page, 'E5', 'noir');

  // « Partager » est l'action principale, en relief.
  const partager = page.getByRole('button', { name: 'Partager' });
  await expect(partager).toBeVisible();
  await expect(partager).toHaveClass(/\bcta\b/);
  const boite = await partager.boundingBox();
  expect(boite!.height).toBeGreaterThanOrEqual(44);
  await partager.click();

  const partages = await page.evaluate(() => (window as unknown as { __partages: ShareData[] }).__partages);
  expect(partages).toEqual([{ text: 'Go du jour n° 1 · résolu en 2 essais · série 1 🔥', url: 'https://jeu-de-go.vercel.app/?go-du-jour=1' }]);
  // Jamais la réponse.
  expect(JSON.stringify(partages)).not.toMatch(/E5/i);

  // Le lien partagé rouvre le même problème.
  await page.goto(partages[0].url!.replace('https://jeu-de-go.vercel.app', ''));
  await expect(page.getByText(/^Go du jour n°\s1$/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Capture la pierre' })).toBeVisible();
});

test('sans Web Share API : copie dans le presse-papiers et « Copié ! »', async ({ page }) => {
  await figer(page);
  await mockPressePapiers(page);
  await page.goto('/?go-du-jour=1');
  await jouer(page, 'E5');
  await page.getByRole('button', { name: 'Partager' }).click();
  await expect(page.getByText(/^Copié\s!$/)).toBeVisible();
  const copies = await page.evaluate(() => (window as unknown as { __copies: string[] }).__copies);
  expect(copies).toEqual(['Go du jour n° 1 · résolu en 1 essai · série 1 🔥\nhttps://jeu-de-go.vercel.app/?go-du-jour=1']);
});

test('un lien d’un autre jour ouvre celui d’aujourd’hui et le dit', async ({ page }) => {
  await figer(page);
  await page.goto('/?go-du-jour=5');
  await expect(page.getByText('Le Go du jour a changé : voici celui d’aujourd’hui.')).toBeVisible();
  await expect(page.getByText(/^Go du jour n°\s1$/)).toBeVisible();
});

test.describe('premier lancement', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('la fenêtre de consentement attend la fin du Go du jour', async ({ page }) => {
    await figer(page);
    await mockPartage(page);
    await page.goto('/?go-du-jour=1');
    const fenetre = page.getByRole('dialog', { name: 'Tu m’aides à chasser les bugs ?' });
    await expect(plateau(page)).toBeVisible();
    await page.waitForTimeout(300);
    await expect(fenetre).toBeHidden();
    await jouer(page, 'E5');
    await page.getByRole('button', { name: 'Partager' }).click();
    await expect(fenetre).toBeHidden();
    // De retour à la liste des problèmes, elle peut apparaître.
    await page.getByRole('button', { name: 'Retour aux problèmes' }).first().click();
    await expect(fenetre).toBeVisible();
  });
});
