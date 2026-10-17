import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

// Lot V1 (#620) : captures de Problèmes à 390 × 844, en sombre et en clair, Go du jour à faire puis fait,
// avec une série de deux jours (docs/ux/captures/visuel-responsive/v1/). Lancement manuel seulement :
// VISUEL_V1=docs/ux/captures/visuel-responsive/v1 PREFIXE=avant npx playwright test visuel-v1-captures --workers 1

const DOSSIER = process.env.VISUEL_V1;
const PREFIXE = process.env.PREFIXE ?? 'apres';
test.skip(!DOSSIER, 'Captures du lot V1 : lancer avec VISUEL_V1=<dossier>');
test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

const MIDI_PARIS = new Date('2026-10-17T12:00:00+02:00');

async function problemes(page: Page, fait: boolean) {
  await page.clock.setFixedTime(MIDI_PARIS);
  await page.addInitScript(() => { if (localStorage.getItem('go.parties.v1') === null) localStorage.setItem('go.parties.v1', '{"n":3}'); });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Problèmes', exact: true }).click();
  const titre = await page.locator('#jour-titre').textContent();
  const numero = Number(/(\d+)/.exec(titre ?? '')![1]);
  // Série de deux jours : hier et, si fait, aujourd'hui.
  await page.evaluate(([n, f]) => localStorage.setItem('go.go-du-jour.v1', JSON.stringify(f ? { dernier: n, jours: 3 } : { dernier: n - 1, jours: 2 })), [numero, fait] as const);
  await page.reload();
  await page.getByRole('navigation').getByRole('button', { name: 'Problèmes', exact: true }).click();
  await expect(page.locator('#jour-titre')).toBeVisible();
}

for (const fait of [false, true]) {
  test(`Problèmes, Go du jour ${fait ? 'fait' : 'à faire'}`, async ({ page }) => {
    const dossier = join(process.cwd(), DOSSIER!);
    mkdirSync(dossier, { recursive: true });
    for (const theme of ['dark', 'light'] as const) {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await problemes(page, fait);
      await page.waitForTimeout(400);
      const nom = `${PREFIXE}-problemes-${fait ? 'fait' : 'a-faire'}-${theme === 'dark' ? 'sombre' : 'clair'}`;
      await page.screenshot({ path: join(dossier, `${nom}.png`) });
      await page.screenshot({ path: join(dossier, `${nom}-page.png`), fullPage: true });
    }
  });
}
