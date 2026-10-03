import { expect, test, type Page } from '@playwright/test';
import { jouer, passerJusquAuScore, plateau } from './plateau';
import { demarrerParcours } from './revueFactice';

// Issue #34 : revue d'une partie terminée. `?komi=-100` (paramètre de test, voir src/app/bilan.ts) donne une fin
// de partie déterministe : Noir gagne en passant. On joue quelques coups, on passe, puis on revoit la partie.
// Revue v3 (#405) : analyse → bilan → « Démarrer le bilan » → parcours. Le parcours lui-même (notes du go, coups clés)
// est testé avec un KataGo factice dans e2e/revue-bilan.spec.ts ; ici, le moteur simple, sans KataGo.

// Depuis #117, le comptage contre l'ordi peut être automatique (récit direct) : voir passerJusquAuScore.
const passerJusquAuComptage = passerJusquAuScore;

/** Partie courte contre Pomme : quelques coups, puis deux passes. `komi` : -100 pour gagner, 100 pour perdre. */
async function partieCourte(page: Page, coups: string[], komi = -100) {
  await page.goto(`/?komi=${komi}`);
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
  await expect(page.getByRole('heading', { level: 2, name: komi < 0 ? 'Victoire' : 'Défaite' })).toBeVisible();
}

test("fin de partie, bilan, revue coup par coup, puis rejouer d'ici", async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await partieCourte(page, ['E5']);

  // La partie est gardée en SGF sur le téléphone.
  const gardee = await page.evaluate(() => JSON.parse(localStorage.getItem('go.revue.v1') || 'null'));
  expect(gardee.adversaire).toBe('pomme');
  expect(gardee.sgf).toMatch(/^\(;GM\[1\]FF\[4\].*SZ\[9\].*;B\[ee\]/);

  await page.getByRole('button', { name: 'Revoir ma partie' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Revoir ma partie' })).toBeVisible();
  // Le bilan : une seule action en relief, « Démarrer le bilan ».
  await expect(page.getByRole('button', { name: 'Démarrer le bilan' })).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.cta')).toHaveCount(1);
  await expect(page.getByRole('img', { name: /Courbe d'avantage/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  await demarrerParcours(page, 1);
  await expect(page.getByText(/Coup 1 sur \d+/)).toBeVisible();
  await expect(page.locator('.parcours-titre')).toHaveText(/^\S+\s*E5 est /);
  await expect(plateau(page).locator('g[data-pierre]')).toHaveCount(1);

  // Coup précédent : plateau vide ; coup suivant : la pierre revient.
  const precedent = page.getByRole('button', { name: 'Coup précédent' });
  await precedent.click();
  await expect(page.getByText(/Coup 0 sur \d+/)).toBeVisible();
  await expect(plateau(page).locator('g[data-pierre]')).toHaveCount(0);
  await expect(precedent).toBeDisabled();
  await page.getByRole('button', { name: 'Coup suivant' }).click();
  await expect(plateau(page).locator('g[data-point="E5"][data-pierre="noir"]')).toHaveCount(1);
  // Une seule action en relief : « Suivant » (ou « Terminer » après le dernier coup clé).
  await expect(page.locator('.cta')).toHaveCount(1);
  await expect(page.locator('.cta')).toHaveText(/^(Suivant|Terminer)$/);

  // Retour au résumé, puis au bilan de la partie, puis de nouveau la revue.
  await page.getByRole('button', { name: 'Retour au résumé' }).click();
  await page.getByRole('button', { name: 'Retour au bilan' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Victoire' })).toBeVisible();
  await page.getByRole('button', { name: 'Revoir ma partie' }).click();

  // Rejouer d'ici au coup 1 : c'est à Pomme, donc on reprend avant E5, Noir au trait.
  await demarrerParcours(page, 1);
  await page.getByRole('button', { name: "Rejouer d'ici" }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Revoir ma partie' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Passer' })).toBeEnabled();
  await expect(plateau(page).locator('g[data-pierre]')).toHaveCount(0);
  expect(erreurs).toEqual([]);
});

test("rejouer d'ici garde les coups joués jusqu'à la position choisie", async ({ page }) => {
  await partieCourte(page, ['E5']);
  await page.getByRole('button', { name: 'Revoir ma partie' }).click();
  // Coup 2 : E5 puis la réponse de Pomme ; on reprend juste avant la réponse, avec E5 sur le plateau.
  await demarrerParcours(page, 2);
  await expect(page.getByText(/Coup 2 sur \d+/)).toBeVisible();
  await page.getByRole('button', { name: "Rejouer d'ici" }).click();
  await expect(page.getByText('On reprend ici. À toi de trouver mieux !')).toBeVisible();
  await expect(plateau(page).locator('g[data-point="E5"][data-pierre="noir"]')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Passer' })).toBeEnabled();
});

// Issue #71 : une note sur le coup affiché (sceau sur la pierre, bande des coups) et la précision des deux joueurs.
test('la revue note le coup affiché et montre la précision des deux joueurs', async ({ page }) => {
  await partieCourte(page, ['E5', 'C3', 'G7']);
  await page.getByRole('button', { name: 'Revoir ma partie' }).click();
  await expect(page.getByRole('button', { name: 'Démarrer le bilan' })).toBeVisible({ timeout: 60_000 });

  // Bilan : précision des deux joueurs, tableau des notes, phrase de Mochi.
  const table = page.getByRole('table', { name: 'Tes coups, note par note' });
  await expect(table.getByRole('row', { name: /^Précision \d+\s% \d+\s%$/ })).toBeVisible();
  await expect(table.getByRole('columnheader', { name: 'Toi' })).toBeVisible();
  await expect(table.getByRole('columnheader', { name: 'Pomme' })).toBeVisible();
  await expect(page.locator('.bilan-bulle')).not.toBeEmpty();

  // Coup 1 : un sceau de note sur la pierre E5, et le même dans la bande des coups, avec son libellé lu à voix haute.
  await demarrerParcours(page, 1);
  const sceau = plateau(page).locator('[data-note-sceau]');
  await expect(sceau).toHaveCount(1);
  const note = await sceau.getAttribute('data-note-sceau');
  expect(note).toMatch(/^(Classique|Solide|Forcé|Imprécision|Erreur|Gaffe)$/);
  await expect(page.getByRole('button', { name: `Coup 1, E5, ${note}` })).toHaveAttribute('aria-current', 'true');

  // Toucher un coup de la bande l'affiche.
  await page.getByRole('button', { name: /^Coup 2,/ }).click();
  await expect(page.getByText(/Coup 2 sur \d+/)).toBeVisible();
  // « Suivant » est dans le dock : il reste à l'écran.
  await expect(page.locator('.cta')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

// Issue #186 : revue honnête. Après une lourde défaite (komi de 100), ni précision flatteuse ni « aucune erreur ».
test('défaite lourde : précision plafonnée et bilan sans félicitations', async ({ page }) => {
  await partieCourte(page, ['E5', 'C3'], 100);
  await page.getByRole('button', { name: 'Revoir ma partie' }).click();
  await expect(page.getByRole('button', { name: 'Démarrer le bilan' })).toBeVisible({ timeout: 60_000 });
  const texte = ((await page.getByRole('row', { name: /^Précision/ }).textContent()) ?? '').replace(/\s/g, ' ');
  expect(Number(/Précision\s*(\d+)/.exec(texte)?.[1])).toBeLessThanOrEqual(50);
  await expect(page.getByText(/Aucune grosse erreur|Bien joué/)).toHaveCount(0);
  const phrase = page.locator('.bilan-bulle');
  await expect(phrase).toHaveText(/^Tu perds de \d/);
  await expect(phrase).not.toHaveText(/Aucune erreur|Très belle|plus juste/);
});

// Issue #186 : le moment clé (passes comprises) fait partie des coups clés du parcours, et « Rejouer d'ici » en repart.
// Pomme choisit ses coups au hasard parmi ses bons coups : on joue sur la première ligne (des coups perdants) et on
// recommence jusqu'à trois fois si la partie n'a pas de moment clé.
test("le parcours passe par le moment clé, et rejoue d'ici sans partie vide", async ({ page }) => {
  test.setTimeout(180_000);
  const cle = page.locator('.parcours-cle');
  const suivant = page.getByRole('button', { name: 'Suivant', exact: true });
  let trouve = false;
  for (let essai = 0; essai < 3 && !trouve; essai++) {
    await partieCourte(page, ['E5', 'A1', 'A9', 'J1', 'J9']);
    await page.getByRole('button', { name: 'Revoir ma partie' }).click();
    await demarrerParcours(page);
    for (let k = 0; k < 14 && !(await cle.count()) && (await suivant.count()); k++) await suivant.click();
    trouve = (await cle.count()) > 0;
  }
  test.skip(!trouve, 'trois parties sans moment clé : Pomme a joué sans laisser de points');
  await expect(cle).toHaveText('Moment clé');
  const coup = Number(/Coup (\d+) sur/.exec((await page.locator('.revue-compteur').textContent())!)![1]);
  expect(coup).toBeGreaterThan(1);
  await expect(page.locator('.cta')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  // « Rejouer d'ici » repart juste avant le coup clé, Noir au trait : jamais d'une partie vide.
  await page.getByRole('button', { name: "Rejouer d'ici" }).click();
  await expect(page.getByText('On reprend ici. À toi de trouver mieux !')).toBeVisible();
  expect(await plateau(page).locator('g[data-pierre]').count()).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: 'Passer' })).toBeEnabled();
});
