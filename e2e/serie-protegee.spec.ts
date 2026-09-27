import { expect, test, type Page } from '@playwright/test';
import { attendrePierre, jouer } from './plateau';

// Issue #76 : série protégée. Série de 7 jours (un gel gagné), puis un jour manqué : le gel sauve la série.
// Horloge figée à midi, heure de Paris, comme e2e/go-du-jour.spec.ts. Le Go du jour n° 7 est le problème b1 (réponse E5).
const JOUR_7 = new Date('2026-10-03T12:00:00+02:00');
const JOUR_9 = new Date('2026-10-05T12:00:00+02:00'); // le jour 8 est manqué

async function stockage(page: Page, cle: string) {
  return page.evaluate(k => JSON.parse(localStorage.getItem(k) ?? 'null'), cle);
}

test('série de 7 jours, puis un jour manqué : la série est sauvée', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.setFixedTime(JOUR_7);
  await page.goto('/');
  // Six jours de suite déjà réussis sur cet appareil.
  await page.evaluate(() => localStorage.setItem('go.go-du-jour.v1', JSON.stringify({ dernier: 6, jours: 6 })));

  await page.goto('/?go-du-jour=7');
  await expect(page.getByText(/^Go du jour n°\s7$/)).toBeVisible();
  await jouer(page, 'E5');
  await attendrePierre(page, 'E5', 'noir');
  // 7e jour : un gel est gagné, et on le dit.
  await expect(page.getByText(/Tu gagnes un gel/)).toBeVisible();
  expect(await stockage(page, 'go.gel.v1')).toMatchObject({ gels: 1 });
  expect(await stockage(page, 'go.go-du-jour.v1')).toEqual({ dernier: 7, jours: 7 });

  // Le glaçon s'affiche à côté du titre du Go du jour.
  await page.getByRole('button', { name: 'Retour aux problèmes' }).first().click();
  await expect(page.getByRole('img', { name: '1 gel de série en réserve' })).toBeVisible();

  // Jour 8 oublié. Retour le jour 9 : le gel est consommé, Mochi l'annonce.
  await page.clock.setFixedTime(JOUR_9);
  await page.goto('/');
  await expect(page.getByRole('status').filter({ hasText: /Ton gel a protégé ta série de 7\sjours\s!/ })).toBeVisible();
  expect(await stockage(page, 'go.go-du-jour.v1')).toEqual({ dernier: 8, jours: 7 });
  expect(await stockage(page, 'go.gel.v1')).toMatchObject({ gels: 0, geles: [8], annonce: null });
  await expect(page.getByTestId('glacon')).toHaveCount(0);

  // Une seule fois : l'annonce ne revient pas.
  await page.reload();
  await expect(page.getByText(/Ton gel a protégé/)).toHaveCount(0);
  expect(await stockage(page, 'go.go-du-jour.v1')).toEqual({ dernier: 8, jours: 7 });
});
