import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

// Lot V12 (#627) : captures à 390 × 844, en sombre, de la page d'un thème (Capture, une leçon faite) et de la consigne
// de la course (docs/ux/captures/visuel-responsive/v12/). Lancement manuel seulement :
// VISUEL_V12=docs/ux/captures/visuel-responsive/v12 PREFIXE=avant npx playwright test visuel-v12-captures --workers 1

const DOSSIER = process.env.VISUEL_V12;
const PREFIXE = process.env.PREFIXE ?? 'apres';
test.skip(!DOSSIER, 'Captures du lot V12 : lancer avec VISUEL_V12=<dossier>');
test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, colorScheme: 'dark' });

const MIDI_PARIS = new Date('2026-10-17T12:00:00+02:00');

async function capture(page: Page, nom: string) {
  const dossier = join(process.cwd(), DOSSIER!);
  mkdirSync(dossier, { recursive: true });
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(dossier, `${PREFIXE}-${nom}-sombre.png`) });
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(MIDI_PARIS);
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    if (localStorage.getItem('go.parties.v1') === null) localStorage.setItem('go.parties.v1', '{"n":3}');
    if (localStorage.getItem('go.lecons.v1') === null) localStorage.setItem('go.lecons.v1', JSON.stringify({ l1: 99, l2: 99, l3: 2 }));
  });
});

test('Page du thème Capture', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
  await page.getByTestId('par-theme').getByRole('button', { name: /^Capture,/ }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Capture' })).toBeVisible();
  await capture(page, 'theme-capture');
});

test('Consigne de la course', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Problèmes', exact: true }).click();
  await page.locator('.course-carte').click();
  await expect(page.locator('.course-consigne')).toBeVisible();
  await capture(page, 'course-consigne');
});
