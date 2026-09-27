import { expect, test, type Page } from '@playwright/test';
import { jouer, plateau } from './plateau';

// Issue #34 : revue d'une partie terminée. `?komi=-100` (paramètre de test, voir src/app/bilan.ts) donne une fin
// de partie déterministe : Noir gagne en passant. On joue quelques coups, on passe, puis on revoit la partie.

async function passerJusquAuComptage(page: Page) {
  const passer = page.getByRole('button', { name: 'Passer' });
  const valider = page.getByRole('button', { name: 'Valider le score' });
  for (let i = 0; i < 6 && !(await valider.isVisible()); i++) {
    await expect(passer).toBeEnabled({ timeout: 10_000 });
    await passer.click();
    await expect(valider.or(page.getByText(/Pomme (joue|capture)/))).toBeVisible({ timeout: 10_000 });
  }
  await expect(valider).toBeEnabled({ timeout: 10_000 });
  await valider.click();
}

/** Partie courte contre Pomme : quelques coups, puis deux passes. */
async function partieCourte(page: Page, coups: string[]) {
  await page.goto('/?komi=-100');
  await page.locator('.cta').click();
  await expect(plateau(page)).toBeVisible();
  const passer = page.getByRole('button', { name: 'Passer' });
  for (const c of coups) {
    await expect(passer).toBeEnabled({ timeout: 10_000 });
    const avant = await plateau(page).locator('g[data-pierre]').count();
    await jouer(page, c);
    // Point déjà pris par Pomme : on passe au suivant.
    if ((await plateau(page).locator('g[data-pierre]').count()) === avant) continue;
    await expect(passer).toBeEnabled({ timeout: 10_000 });
  }
  await passerJusquAuComptage(page);
  await expect(page.getByRole('heading', { level: 2, name: 'Victoire' })).toBeVisible();
}

test("fin de partie, revue coup par coup, erreurs analysées, puis rejouer d'ici", async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await partieCourte(page, ['E5']);

  // La partie est gardée en SGF sur le téléphone.
  const gardee = await page.evaluate(() => JSON.parse(localStorage.getItem('go.revue.v1') || 'null'));
  expect(gardee.adversaire).toBe('pomme');
  expect(gardee.sgf).toMatch(/^\(;GM\[1\]FF\[4\].*SZ\[9\].*;B\[ee\]/);

  await page.getByRole('button', { name: 'Revoir ma partie' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Revoir ma partie' })).toBeVisible();
  const precedent = page.getByRole('button', { name: 'Précédent' });
  const suivant = page.getByRole('button', { name: 'Suivant' });
  await expect(page.getByText(/Coup 1 sur \d+/)).toBeVisible();
  await expect(page.locator('.revue-mochi p')).toHaveText('Tu joues E5.');
  await expect(plateau(page).locator('g[data-pierre]')).toHaveCount(1);
  await expect(page.getByRole('img', { name: /Courbe d'avantage/ })).toBeVisible();

  // Précédent : plateau vide ; suivant : la pierre revient.
  await precedent.click();
  await expect(page.getByText(/Coup 0 sur \d+/)).toBeVisible();
  await expect(plateau(page).locator('g[data-pierre]')).toHaveCount(0);
  await expect(precedent).toBeDisabled();
  await suivant.click();
  await expect(plateau(page).locator('g[data-point="E5"][data-pierre="noir"]')).toHaveCount(1);

  // L'analyse tourne (logo qui tourne), puis se termine.
  await expect(page.locator('.revue-analyse')).toHaveCount(0, { timeout: 30_000 });
  // Une seule action en relief.
  await expect(page.locator('.cta')).toHaveCount(1);
  await expect(page.locator('.cta')).toHaveText("Rejouer d'ici");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  // Retour au bilan, puis de nouveau la revue.
  await page.getByRole('button', { name: 'Retour au bilan' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Victoire' })).toBeVisible();
  await page.getByRole('button', { name: 'Revoir ma partie' }).click();

  // Rejouer d'ici au coup 1 : c'est à Pomme, donc on reprend avant E5, Noir au trait.
  await page.getByRole('button', { name: "Rejouer d'ici" }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Revoir ma partie' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Passer' })).toBeEnabled();
  await expect(plateau(page).locator('g[data-pierre]')).toHaveCount(0);
  expect(erreurs).toEqual([]);
});

test("rejouer d'ici garde les coups joués jusqu'à la position choisie", async ({ page }) => {
  await partieCourte(page, ['E5']);
  await page.getByRole('button', { name: 'Revoir ma partie' }).click();
  // Coup 2 : E5 puis la réponse de Pomme ; Noir au trait.
  await page.getByRole('button', { name: 'Suivant' }).click();
  await expect(page.getByText(/Coup 2 sur \d+/)).toBeVisible();
  const pierres = await plateau(page).locator('g[data-pierre]').count();
  await page.getByRole('button', { name: "Rejouer d'ici" }).click();
  await expect(page.getByText('On reprend ici. À toi de trouver mieux !')).toBeVisible();
  await expect(plateau(page).locator('g[data-pierre]')).toHaveCount(pierres);
  await expect(plateau(page).locator('g[data-point="E5"][data-pierre="noir"]')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Passer' })).toBeEnabled();
});

// Captures du design (docs/design/v2/captures/revue-*.png) : `CAPTURES=1 npx playwright test e2e/revue.spec.ts`.
test('captures de la revue, sombre et clair', async ({ page }) => {
  test.skip(!process.env.CAPTURES, 'captures à la demande');
  test.setTimeout(120_000);
  await partieCourte(page, ['E5', 'C3', 'G7', 'C7', 'G3', 'D6', 'F4']);
  await page.getByRole('button', { name: 'Revoir ma partie' }).click();
  await expect(page.locator('.revue-analyse')).toHaveCount(0, { timeout: 60_000 });
  const erreur = page.locator('.revue-erreur').first();
  if (await erreur.count()) { await erreur.click(); await expect(page.locator('[data-meilleur]')).toHaveCount(1, { timeout: 15_000 }).catch(() => {}); }
  for (const theme of ['dark', 'light'] as const) {
    await page.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme);
    await page.screenshot({ path: `docs/design/v2/captures/revue-${theme === 'dark' ? 'sombre' : 'clair'}.png` });
  }
});
