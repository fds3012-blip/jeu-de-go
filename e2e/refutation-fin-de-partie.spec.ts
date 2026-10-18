import { expect, test } from '@playwright/test';
import { ouvrirTous } from './problemes';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { attendrePierre, jouer, plateau } from './plateau';

// Issue #558 : en fin de partie, un coup faux reçoit la réplique prouvée de Blanc (compte de points figé hors ligne,
// src/go/refutations-locales.gen.ts) et une phrase : le geste, le fait sur ton coup, puis la perte.

const MIDI_PARIS = new Date('2026-09-27T12:00:00+02:00');
const CONTENU = fileURLToPath(new URL('../src/content', import.meta.url));
const sources = [join(CONTENU, 'puzzles.ts'), ...readdirSync(join(CONTENU, 'lots')).filter(f => f.endsWith('.ts')).map(f => join(CONTENU, 'lots', f))];
const IDS = sources.flatMap(f => [...readFileSync(f, 'utf8').matchAll(/id: ?'([^']+)', size:/g)].map(m => m[1]));

test('y01 : reculer en C1, Blanc avance en D1, et la phrase dit la perte (un point)', async ({ page }) => {
  // Tous les paliers ouverts : chaque problème déjà réussi sur l'appareil, sauf y01.
  await page.addInitScript(ids => {
    if (!localStorage.getItem('e2e.seme')) {
      localStorage.setItem('go.problemes.v1', JSON.stringify(Object.fromEntries(ids.map(id => [id, true]))));
      localStorage.setItem('e2e.seme', '1');
    }
  }, IDS.filter(id => id !== 'y01'));
  await page.clock.setFixedTime(MIDI_PARIS);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Problèmes' }).click();
  await expect(page.getByTestId('problemes-sommaire')).toBeVisible();
  await ouvrirTous(page);
  await page.getByRole('button', { name: /^Problème \d+ : Bloque au premier rang/ }).click();
  await expect(plateau(page)).toBeVisible();

  await jouer(page, 'C1');
  await expect(page.locator('.verdict [data-erreur-comprise]')).toHaveText(
    'Blanc joue en D1, le point que tu devais jouer. Tu perds au moins un point par rapport au bon coup.');
  await attendrePierre(page, 'D1', 'blanc');
  // Le texte relu du problème reste au-dessus : il dit la même réplique.
  await expect(page.locator('.verdict')).toContainText('Blanc joue D1');

  // Une pierre dans ton propre territoire : le fait est dit, et la perte monte à deux.
  await jouer(page, 'A9');
  await jouer(page, 'A9');
  await expect(page.locator('.verdict [data-erreur-comprise]')).toHaveText(
    'Blanc joue en D1, le point que tu devais jouer. Ta pierre en A9 est dans ton territoire : elle te coûte un point. Tu perds au moins 2 points par rapport au bon coup.');
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(sw).toBeLessThanOrEqual(cw);
});
