import { expect, test } from '@playwright/test';
import { attendrePierre, jouer, plateau } from './plateau';

// Issue #285 : un lien partagé montre un aperçu riche, et l'ami qui le touche arrive directement sur le Go du jour.
test.use({ storageState: { cookies: [], origins: [] } });

test("les balises d'aperçu sont servies et l'image répond en 200", async ({ page, request }) => {
  // Lien `/?go-du-jour=1` (forme longue) : l'aperçu général de l'accueil (#489) ; les liens courts `/j/N` ont le leur.
  await page.goto('/?go-du-jour=1');
  const contenu = (cle: string) => page.locator(`meta[property="${cle}"], meta[name="${cle}"]`).getAttribute('content');
  expect(await contenu('og:title')).toBe('Mochi Go : apprends le go en jouant');
  expect(await contenu('og:locale')).toBe('fr_FR');
  expect(await contenu('twitter:card')).toBe('summary_large_image');
  const image = await contenu('og:image');
  expect(image).toBe('https://mochi-go.app/apercu-accueil.png');

  // Même chemin, servi par le build local.
  const rep = await request.get(new URL(image!).pathname);
  expect(rep.status()).toBe(200);
  expect(rep.headers()['content-type']).toContain('image/png');
  const b = await rep.body();
  expect([b.readUInt32BE(16), b.readUInt32BE(20)]).toEqual([1200, 630]);
});

test('lien ouvert sans stockage local : problème jouable en 1 tap, aucune fenêtre avant', async ({ page }) => {
  // 27 septembre 2026 à midi, heure de Paris : Go du jour n° 1 (problème b1, réponse E5).
  await page.clock.setFixedTime(new Date('2026-09-27T12:00:00+02:00'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?go-du-jour=1');
  await expect(page.getByText(/^Go du jour n°\s1$/)).toBeVisible();
  await expect(plateau(page)).toBeVisible();
  await page.waitForTimeout(300);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await jouer(page, 'E5');
  await attendrePierre(page, 'E5', 'noir');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test("l'ami qui n'a jamais joué : Mochi l'accueille, puis une seule action vers la leçon 1", async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-27T12:00:00+02:00'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?go-du-jour=1');
  await expect(page.getByText(/Premier coup au go\s\? Touche le plateau\./)).toBeVisible();
  await jouer(page, 'E5');
  await attendrePierre(page, 'E5', 'noir');
  // Une seule action en relief, de 44 px au moins, et plus de « Problème suivant ».
  const cta = page.locator('.cta');
  await expect(cta).toHaveCount(1);
  await expect(cta).toHaveText('Apprends à jouer en 2 minutes');
  await expect(page.getByRole('button', { name: 'Problème suivant' })).toHaveCount(0);
  expect((await cta.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await cta.click();
  await expect(page.locator('.lecteur-lecon .lecteur-titre')).toHaveText(/Libertés et capture/);
});

test('un joueur qui a déjà joué garde « Problème suivant » après le Go du jour du lien', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-27T12:00:00+02:00'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('go.parties.v1', JSON.stringify({ n: 2 })));
  await page.goto('/?go-du-jour=1');
  await expect(plateau(page)).toBeVisible();
  await expect(page.getByText(/Premier coup au go/)).toHaveCount(0);
  await jouer(page, 'E5');
  await attendrePierre(page, 'E5', 'noir');
  await expect(page.getByRole('button', { name: 'Problème suivant' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apprends à jouer en 2 minutes' })).toHaveCount(0);
});
