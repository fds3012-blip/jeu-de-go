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
  // #237 (N6) : comme en leçon, pas de « Réessayer » ; on rejoue directement, l'indice reste un lien discret.
  await expect(page.getByRole('button', { name: 'Réessayer' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Voir un indice' })).toHaveClass(/\blien\b/);
  await jouer(page, 'E5');
  await attendrePierre(page, 'E5', 'noir');
  // #237 (N3) : ce Go du jour (b1) est l'étape 4 de la leçon 1. #251 (M3) : le joueur n'a pas fait la leçon,
  // ce n'est donc pas une redite ; la Révision du jour le reprendra demain (voir revision-du-jour.spec.ts).
  const revision = await page.evaluate(() => JSON.parse(localStorage.getItem('go.revision.v1') ?? '{}'));
  expect(revision.recents ?? {}).toEqual({});
  expect(revision.suivis).toEqual({ b1: { base: 1, etape: 0 } });

  // « Partager » est l'action secondaire (#75) : à plat, sous « Problème suivant » en relief.
  const partager = page.getByRole('button', { name: 'Partager' });
  await expect(partager).toBeVisible();
  await expect(partager).not.toHaveClass(/\bcta\b/);
  await expect(page.locator('.verdict .cta')).toHaveCount(1);
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

test('un lien d’un jour à venir ouvre celui d’aujourd’hui et le dit', async ({ page }) => {
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

test('résoudre, partager (texte copié), puis ouvrir le lien dans un nouveau contexte : même problème', async ({ browser }) => {
  // Le 29 septembre à 10 h à Paris : Go du jour n° 3 (problème b3).
  const jour = new Date('2026-09-29T10:00:00+02:00');
  const a = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const pa = await a.newPage();
  await pa.clock.setFixedTime(jour);
  await pa.emulateMedia({ reducedMotion: 'reduce' });
  await mockPressePapiers(pa);
  await pa.goto('/?go-du-jour=3');
  await expect(pa.getByText(/^Go du jour n°\s3$/)).toBeVisible();
  const titre = await pa.locator('.lecteur-nom h2').innerText();
  // Le n° 3 est le problème b3 (calendrier, goDuJour.test.ts) ; sa réponse est E5.
  await jouer(pa, 'E5');
  await attendrePierre(pa, 'E5', 'noir');
  await pa.getByRole('button', { name: 'Partager' }).click();
  await expect(pa.getByText(/^Copié\s!$/)).toBeVisible();
  const [copie] = await pa.evaluate(() => (window as unknown as { __copies: string[] }).__copies);
  expect(copie).toMatch(/^Go du jour n° 3 · résolu en 1 essai · série 1 🔥\nhttps:\/\/jeu-de-go\.vercel\.app\/\?go-du-jour=3$/);
  // Aucune coordonnée (lettre A-T sans I suivie d'un numéro de ligne).
  expect(copie).not.toMatch(/\b[A-HJ-T](1[0-9]|[1-9])\b/);
  await a.close();

  // Un ami, sans compte ni consentement, ouvre le lien le lendemain : il tombe sur le n° 3, pas sur celui du jour.
  const b = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const pb = await b.newPage();
  await pb.clock.setFixedTime(new Date('2026-09-30T10:00:00+02:00'));
  await pb.emulateMedia({ reducedMotion: 'reduce' });
  const lien = copie.split('\n')[1].replace('https://jeu-de-go.vercel.app', '');
  await pb.goto(lien);
  await expect(pb.getByText(/^Go du jour n°\s3$/)).toBeVisible();
  await expect(pb.locator('.lecteur-nom h2')).toHaveText(titre);
  await expect(pb.getByText('Ce Go du jour date d’un autre jour. Celui d’aujourd’hui, c’est le n° 4.')).toBeVisible();
  await expect(pb.getByRole('dialog', { name: 'Tu m’aides à chasser les bugs ?' })).toBeHidden();
  await expect(plateau(pb)).toBeVisible();
  await b.close();
});
