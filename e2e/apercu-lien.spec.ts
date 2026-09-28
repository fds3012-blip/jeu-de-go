import { expect, test } from '@playwright/test';
import { attendrePierre, jouer, plateau } from './plateau';

// Issue #285 : un lien partagé montre un aperçu riche, et l'ami qui le touche arrive directement sur le Go du jour.
test.use({ storageState: { cookies: [], origins: [] } });

test("les balises d'aperçu sont servies et l'image répond en 200", async ({ page, request }) => {
  await page.goto('/?go-du-jour=1');
  const contenu = (cle: string) => page.locator(`meta[property="${cle}"], meta[name="${cle}"]`).getAttribute('content');
  expect(await contenu('og:title')).toBe('Go du jour : trouveras-tu le bon coup ?');
  expect(await contenu('og:locale')).toBe('fr_FR');
  expect(await contenu('twitter:card')).toBe('summary_large_image');
  const image = await contenu('og:image');
  expect(image).toBe('https://jeu-de-go.vercel.app/apercu.png');

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
