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
  await expect(page.locator('.revue-mochi p')).toHaveText(/^Tu joues E5\./);
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

// Issue #71 : une note sur le coup affiché (sceau sur la pierre, liste des coups) et le bilan de précision.
test('la revue note le coup affiché et montre la précision des deux joueurs', async ({ page }) => {
  await partieCourte(page, ['E5', 'C3', 'G7']);
  await page.getByRole('button', { name: 'Revoir ma partie' }).click();
  await expect(page.locator('.revue-analyse')).toHaveCount(0, { timeout: 60_000 });

  // Coup 1 : un sceau de note sur la pierre E5, et le même dans la liste des coups, avec son libellé lu à voix haute.
  const sceau = plateau(page).locator('[data-note-sceau]');
  await expect(sceau).toHaveCount(1);
  const note = await sceau.getAttribute('data-note-sceau');
  expect(note).toMatch(/^(Solide|Imprécision|Erreur|Grosse erreur|Meilleur coup|Excellent|Bon|Brillant)$/);
  await expect(page.getByRole('button', { name: `Coup 1, E5, ${note}` })).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('.revue-mochi p')).toHaveText(/^Tu joues E5\. \S/);

  // Toucher un coup de la liste l'affiche.
  await page.getByRole('button', { name: /^Coup 2,/ }).click();
  await expect(page.getByText(/Coup 2 sur \d+/)).toBeVisible();

  // Bilan : précision des deux joueurs, puis le résumé (tableau et phrase de Mochi).
  const bilan = page.getByRole('button', { name: /Précision/ });
  await expect(bilan).toContainText(/Toi \d+\s%/);
  await expect(bilan).toContainText(/Pomme \d+\s%/);
  await bilan.click();
  const resume = page.getByRole('region', { name: 'Résumé de la partie' });
  await expect(resume.getByRole('table')).toBeVisible();
  await expect(resume.getByRole('row', { name: /Grosse erreur/ })).toBeVisible();
  await expect(resume.locator('.revue-mochi-bilan p')).not.toBeEmpty();
  await expect(page.locator('.cta')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

// Captures des notes (docs/design/v2/captures/notes-*.png) : `CAPTURES=1 npx playwright test e2e/revue.spec.ts`.
test('captures des notes, sombre et clair', async ({ page }) => {
  test.skip(!process.env.CAPTURES, 'captures à la demande');
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await partieCourte(page, ['E5', 'C3', 'G7', 'C7', 'G3', 'D6', 'F4', 'B2']);
  await page.getByRole('button', { name: 'Revoir ma partie' }).click();
  await expect(page.locator('.revue-analyse')).toHaveCount(0, { timeout: 90_000 });
  await page.getByRole('button', { name: /^Coup 5,/ }).click();
  for (const theme of ['dark', 'light'] as const) {
    await page.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme);
    await page.screenshot({ path: `docs/design/v2/captures/notes-coup-${theme === 'dark' ? 'sombre' : 'clair'}.png` });
  }
  await page.getByRole('button', { name: /Précision/ }).click();
  for (const theme of ['dark', 'light'] as const) {
    await page.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme);
    await page.screenshot({ path: `docs/design/v2/captures/notes-resume-${theme === 'dark' ? 'sombre' : 'clair'}.png` });
  }
  // Planche des 7 sceaux en grand, sur le bois du goban : mêmes couleurs que src/ui/notes.ts.
  const sceaux: [string, string, string, string][] = [
    ['Brillant', '!!', '#2F9FD8', '#04172A'], ['Meilleur coup', '★', '#3CC48E', '#07231A'], ['Excellent', '!', '#3CC48E', '#07231A'],
    ['Bon', '✓', '#A5D66F', '#12240A'], ['Imprécision', '?!', '#EFB84A', '#2E1D00'], ['Erreur', '?', '#EC8236', '#2A1200'], ['Grosse erreur', '??', '#C23A24', '#FFF6EC'],
  ];
  const cases = sceaux.map(([l, s, f, t]) => `<figure><div class="p"><i style="background:${f};color:${t};font-size:${s.length > 1 ? 30 : 38}px">${s}</i></div><figcaption>${l}</figcaption></figure>`).join('');
  await page.setViewportSize({ width: 820, height: 560 });
  await page.setContent(`<style>body{margin:0;background:#1C1916;font-family:system-ui;color:#F3EDE3}main{display:grid;grid-template-columns:repeat(4,1fr);gap:22px;padding:28px;background:linear-gradient(#EDC27A,#C58D42);border-radius:14px;margin:18px}
    figure{margin:0;display:grid;justify-items:center;gap:10px}.p{position:relative;width:120px;height:120px;border-radius:50%;background:radial-gradient(circle at 36% 30%,#5b5f5d,#151716 55%,#050606);box-shadow:4px 7px 10px rgba(35,18,4,.45)}
    i{position:absolute;right:-14px;top:-14px;width:60px;height:60px;display:grid;place-items:center;border-radius:28%;transform:rotate(-6deg);font-style:normal;font-weight:800;box-shadow:0 0 0 4px rgba(243,237,227,.9)}
    figcaption{color:#2b1a08;font-weight:700;font-size:17px;white-space:nowrap}</style><main>${cases}</main>`);
  await page.locator('main').screenshot({ path: 'docs/design/v2/captures/notes-sceaux.png' });
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
