import { expect, test, type Page } from '@playwright/test';

// Issue #212 : rien de gagné ne se perd. Une série de 7 jours, puis 3 jours d'absence sans gel.
// Horloge figée en heure de Paris : le Go du jour n° 7 tombe le 03/10/2026, le n° 11 le 07/10/2026.
const JOUR_7 = new Date('2026-10-03T12:00:00+02:00');
const JOUR_11 = new Date('2026-10-07T18:20:00+02:00');
const nav = (page: Page, nom: string) => page.getByRole('navigation').getByRole('button', { name: nom }).click();
const stockage = (page: Page, cle: string) => page.evaluate(k => JSON.parse(localStorage.getItem(k) ?? 'null'), cle);

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('série de 7 jours perdue : record gardé, badge conservé, Mochi accueille sans reproche, une seule fois', async ({ page }) => {
  // Jour 7 : la série de 7 jours, et le badge vu dans le Profil.
  await page.clock.setFixedTime(JOUR_7);
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('go.go-du-jour.v1', JSON.stringify({ dernier: 7, jours: 7 })));
  await page.reload();
  await nav(page, 'Profil');
  await expect(page.locator('[data-badge="serie-7"]')).toHaveClass('obtenu');
  expect(await stockage(page, 'go.badges.v1')).toContain('serie-7');
  expect(await stockage(page, 'go.serie-record.v1')).toMatchObject({ record: 7 });

  // Jours 8, 9 et 10 oubliés, sans gel. Retour le jour 11.
  await page.clock.setFixedTime(JOUR_11);
  await page.goto('/');
  const message = page.getByTestId('retour-serie');
  await expect(message).toBeVisible();
  await expect(message).toHaveText(/Content de te revoir\s!\sTa série de 7\sjours est dans ton record\. On en commence une nouvelle\s\?/);
  await expect(message).toHaveAttribute('role', 'status');
  // Pas de flamme éteinte mise en avant, pas de « 0 ».
  await expect(page.getByRole('img', { name: /^Série de/ })).toHaveCount(0);

  // Profil : le record à la place de « 0 jour de série », et le badge toujours là.
  await nav(page, 'Profil');
  await expect(page.getByText('jours, ton record')).toBeVisible();
  await expect(page.getByText(/^jours? de série$/)).toHaveCount(0);
  await expect(page.locator('[data-badge="serie-7"]')).toHaveClass('obtenu');
  await expect(page.getByRole('status').filter({ hasText: /record/ })).toHaveCount(0); // parti en changeant d'onglet

  // Une seule fois : pas de nouveau message au rechargement.
  await page.goto('/');
  await expect(page.getByTestId('retour-serie')).toHaveCount(0);
  expect(await stockage(page, 'go.serie-record.v1')).toEqual({ record: 7, perdue: 7 });
});

test('le message tient sur un iPhone de 390 px, sans défilement horizontal', async ({ page }) => {
  await page.clock.setFixedTime(JOUR_11);
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('go.go-du-jour.v1', JSON.stringify({ dernier: 5, jours: 5 })));
  await page.evaluate(() => localStorage.setItem('go.serie-record.v1', JSON.stringify({ record: 12, perdue: null })));
  await page.reload();
  await expect(page.getByTestId('retour-serie')).toHaveText(/Ton record reste 12\sjours/);
  const deborde = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(deborde).toBe(false);
});
