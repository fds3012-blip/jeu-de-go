import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

// Lot V4 (#626) : captures d’Ouvertures à 390 × 844, en sombre : la liste en 9 × 9 et en 19 × 19, puis le départ d’une ouverture
// (docs/ux/captures/visuel-responsive/v4/). Lancement manuel seulement :
// VISUEL_V4=docs/ux/captures/visuel-responsive/v4 PREFIXE=avant npx playwright test visuel-v4-captures --workers 1

const DOSSIER = process.env.VISUEL_V4;
const PREFIXE = process.env.PREFIXE ?? 'apres';
test.skip(!DOSSIER, 'Captures du lot V4 : lancer avec VISUEL_V4=<dossier>');
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
});

test('Ouvertures : la liste, puis une ouverture', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
  await page.getByTestId('entree-ouvertures').click();
  await expect(page.locator('.ouv-carte').first()).toBeVisible();
  await capture(page, 'ouvertures-9');
  await page.getByRole('button', { name: '19 × 19' }).click();
  await expect(page.locator('.ouv-carte[data-id="h-sansan"]')).toBeVisible();
  await capture(page, 'ouvertures-19');
  await page.locator('.ouv-carte[data-id="h-sansan"]').click();
  await expect(page.getByTestId('ouverture')).toBeVisible();
  await capture(page, 'ouverture-depart');
});
