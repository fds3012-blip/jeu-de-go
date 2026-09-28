import { expect, test, type Page } from '@playwright/test';
import { attendrePierre, jouer } from './plateau';

// Issue #199 : Révision du jour (problèmes déjà réussis, repris à J+1, J+3, J+7) et série « un défi par jour ».
// Horloge figée à midi, heure de Paris : le 01/10/2026 est le Go du jour n° 5. Le problème b1 (réponse E5) a été
// réussi la veille (n° 4) : il revient aujourd'hui, à J+1.
const JOUR_5 = new Date('2026-10-01T12:00:00+02:00');
const nav = (page: Page, nom: string) => page.getByRole('navigation').getByRole('button', { name: nom }).click();

async function preremplir(page: Page) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('revision-prete')) return;
    localStorage.setItem('go.problemes.v1', JSON.stringify({ b1: true }));
    localStorage.setItem('go.revision.v1', JSON.stringify({ suivis: { b1: { base: 4, etape: 0 } }, jour: null }));
    // b1 a été réussi : le bonus « premier problème » est déjà pris.
    localStorage.setItem('go.xp.premieres.v1', JSON.stringify(['probleme']));
    sessionStorage.setItem('revision-prete', '1');
  });
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.setFixedTime(JOUR_5);
});

test('révision du jour : un problème déjà réussi revient à J+1, on le refait, la série vit', async ({ page }) => {
  await preremplir(page);
  await page.goto('/');
  await nav(page, 'Problèmes');

  // Sous le Go du jour, une seule carte : le prochain exercice, sans total.
  await expect(page.getByRole('heading', { name: 'Révision du jour' })).toBeVisible();
  await expect(page.getByText('Un défi par jour garde ta série : le Go du jour, une leçon ou la révision.')).toBeVisible();
  const carte = page.getByRole('button', { name: /^Réviser : / });
  await expect(carte).toHaveCount(1);
  await expect(page.locator('.revision')).not.toContainText(/\d\s*\/\s*\d/);
  // Pas de défilement horizontal à 390 px.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  await carte.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await jouer(page, 'E5');
  await attendrePierre(page, 'E5', 'noir');
  await page.getByRole('button', { name: 'Retour aux problèmes' }).first().click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Révision faite : un seul mot, la série de l'appareil vaut 1, le Go du jour reste à faire.
  await expect(page.getByText('Révision faite. D’autres problèmes reviendront demain.')).toBeVisible();
  await expect(page.locator('.palmares-serie')).toContainText('1');
  await expect(page.getByRole('button', { name: /^Résoudre/ })).toBeVisible();

  // Calendrier : réussi du premier coup, prochaine échéance J+3 (base 4, étape 1).
  const etat = await page.evaluate(() => JSON.parse(localStorage.getItem('go.revision.v1') ?? 'null'));
  expect(etat.suivis.b1).toEqual({ base: 4, etape: 1 });
  expect(etat.jour).toEqual({ numero: 5, ids: ['b1'], faits: ['b1'] });
  // #233 : la révision finie rapporte 20 XP, une fois (le problème, déjà réussi, n'en rapporte pas).
  expect(await page.evaluate(() => localStorage.getItem('go.xp.v1'))).toBe('20');

  // Accueil : la flamme de la série.
  await nav(page, 'Jouer');
  await expect(page.getByRole('img', { name: 'Série de 1 jour' })).toBeVisible();

  // Le lendemain, rien n'est dû (J+3 tombe le n° 7) : la section disparaît.
  await page.clock.setFixedTime(new Date('2026-10-02T12:00:00+02:00'));
  await page.reload();
  await nav(page, 'Problèmes');
  await expect(page.getByRole('heading', { name: 'Go du jour', exact: false }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Révision du jour' })).toHaveCount(0);
});

test('rien à réviser : pas de section (joueur neuf)', async ({ page }) => {
  await page.goto('/');
  await nav(page, 'Problèmes');
  await expect(page.getByRole('heading', { name: /Go du jour/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Révision du jour' })).toHaveCount(0);
});

test('un défi par jour : une leçon terminée fait vivre la série, sans cocher le Go du jour', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('go.lecons.v1', JSON.stringify({ l1: 6, l2: 6, l3: 8, l4: 4 })));
  await page.goto('/');
  await expect(page.getByRole('img', { name: /^Série de/ })).toHaveCount(0);
  await nav(page, 'Apprendre');
  await page.getByRole('button', { name: 'Continuer : Le ko' }).click();
  await jouer(page, 'E5');
  await page.getByRole('button', { name: 'Terminer la leçon' }).click();
  await expect(page.getByRole('heading', { name: 'Leçon terminée' })).toBeVisible();

  await nav(page, 'Jouer');
  await expect(page.getByRole('img', { name: 'Série de 1 jour' })).toBeVisible();
  await nav(page, 'Problèmes');
  await expect(page.locator('.palmares-serie')).toContainText('1');
  // Le Go du jour n'est pas coché : « Résoudre » reste l'action principale.
  await expect(page.getByRole('button', { name: /^Résoudre/ })).toBeVisible();
});

// Captures (docs/design/v2/captures/revision-*.png) : `CAPTURES=1 npx playwright test e2e/revision-du-jour.spec.ts`.
test('captures de la révision du jour, sombre et clair', async ({ page }) => {
  test.skip(!process.env.CAPTURES, 'captures à la demande');
  await preremplir(page);
  for (const theme of ['dark', 'light'] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    const nom = theme === 'dark' ? 'sombre' : 'clair';
    await page.goto('/');
    await nav(page, 'Problèmes');
    const titre = page.getByRole('heading', { name: 'Révision du jour' });
    await titre.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -120));
    await page.screenshot({ path: `docs/design/v2/captures/revision-${nom}.png` });
  }
});
