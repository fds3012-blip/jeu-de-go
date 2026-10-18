import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

// Lot V2 (#625) : captures de la grille « Par thème » à 390 × 844, en sombre, dans Apprendre et dans Problèmes
// (docs/ux/captures/visuel-responsive/v2/). Lancement manuel seulement :
// VISUEL_V2=docs/ux/captures/visuel-responsive/v2 PREFIXE=avant npx playwright test visuel-v2-captures --workers 1

const DOSSIER = process.env.VISUEL_V2;
const PREFIXE = process.env.PREFIXE ?? 'apres';
test.skip(!DOSSIER, 'Captures du lot V2 : lancer avec VISUEL_V2=<dossier>');
test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, colorScheme: 'dark' });

const MIDI_PARIS = new Date('2026-10-17T12:00:00+02:00');

async function capture(page: Page, nom: string) {
  const dossier = join(process.cwd(), DOSSIER!);
  mkdirSync(dossier, { recursive: true });
  await page.locator('.themes h3').first().evaluate(h => h.scrollIntoView({ block: 'start' }));
  await page.evaluate(() => window.scrollBy(0, -72));
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

test('Apprendre, grille « Par thème »', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
  await expect(page.getByTestId('par-theme').locator('.theme-carte')).toHaveCount(6);
  await capture(page, 'apprendre-themes');
});

test('Problèmes, grille « Par thème »', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Problèmes', exact: true }).click();
  await expect(page.locator('.theme-carte')).toHaveCount(6);
  await capture(page, 'problemes-themes');
});
