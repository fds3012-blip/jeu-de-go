import { expect, test } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jouer, plateau } from './plateau';

// Identifiants de tous les problèmes, lus dans les sources (import.meta.glob n'existe pas côté Playwright).
const CONTENU = fileURLToPath(new URL('../src/content', import.meta.url));
const sources = [join(CONTENU, 'puzzles.ts'), ...readdirSync(join(CONTENU, 'lots')).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts')).map(f => join(CONTENU, 'lots', f))];
const ALL_PUZZLES = sources.flatMap(f => [...readFileSync(f, 'utf8').matchAll(/id: ?'([^']+)'/g)].map(m => ({ id: m[1] })));

// Issue #147 : les problèmes ne finissent jamais. Tout est résolu, et pourtant « Continuer »
// et « Problème suivant » proposent toujours un problème.

test('tout résolu : Continuer ouvre un problème, et Problème suivant existe après une réussite', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const tous = Object.fromEntries(ALL_PUZZLES.map(p => [p.id, true]));
  await page.addInitScript(v => localStorage.setItem('go.problemes.v1', JSON.stringify(v)), tous);
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Problèmes' }).click();

  const continuer = page.getByRole('button', { name: /^Continuer : / });
  await expect(continuer).toBeVisible();
  await expect(page.getByText(/c.est fini|tout est résolu/i)).toHaveCount(0);
  await continuer.click();
  await expect(plateau(page)).toBeVisible();

  // Retour à la liste, puis le problème b1 : la bonne réponse est E5.
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Problèmes' }).click();
  await page.getByRole('button', { name: /^Problème \d+ : Capture la pierre/ }).click();
  await jouer(page, 'E5');
  await expect(page.getByText('Bravo, c’est le bon coup !')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Problème suivant' }).first()).toBeVisible();
});
