import { expect, test, type Page } from '@playwright/test';

// Issue #22 puis #40 (phase 5) : écran de fin contre l'ordi, bilan gardé en localStorage (go.bilan.v1), adversaire suivant,
// tampon « BATTUE », célébration et relecture. Pour une victoire déterministe, on ouvre l'appli avec `?komi=-100`
// (paramètre de test documenté dans src/app/bilan.ts) : Noir gagne forcément si on passe tout de suite.

const bilan = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('go.bilan.v1') || '{}'));

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

test('victoire contre Pomme : tampon, confettis, Caillou en un geste, bilan gardé', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.goto('/?komi=-100');
  await page.locator('.cta').click();
  await expect(page.getByRole('img', { name: /Plateau de go 9 × 9/ })).toBeVisible();
  await passerJusquAuComptage(page);

  await expect(page.getByRole('heading', { level: 2, name: 'Victoire' })).toBeVisible();
  // Célébrations activées par défaut : les confettis s'affichent, puis disparaissent au bout de 1,5 s.
  await expect(page.getByTestId('confettis')).toBeAttached();
  await expect(page.getByTestId('confettis')).toHaveCount(0, { timeout: 5000 });
  // Le sceau de Pomme porte le tampon « BATTUE ».
  await expect(page.locator('.fin-tampon')).toHaveText('BATTUE');
  // L'écart défile puis s'arrête sur la valeur exacte ; le bilan tient en une phrase.
  await expect(page.locator('.fin-marge')).toContainText(/^de \d+(,5)? points sur 9 × 9/);
  await expect(page.locator('.fin-bilan')).toHaveText(/^\d+ coups?, .+\. Ton bilan contre Pomme\s: 1 victoire\.$/);
  // Mochi tire la leçon et annonce Caillou.
  await expect(page.locator('.fin-mochi')).toContainText(/Caillou t'attend/);

  const cta = page.locator('.cta');
  await expect(cta).toHaveCount(1);
  await expect(cta).toHaveText('Défier Caillou');
  await expect(page.getByRole('button', { name: 'Revoir ma partie' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Accueil', exact: true })).toBeVisible();
  expect(await bilan(page)).toEqual({ pomme: { v: 1, d: 0 } });
  // Pas de défilement horizontal à 390 px.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  // Un seul geste : la partie contre Caillou démarre.
  await cta.click();
  await expect(page.getByText(/Caillou a Blanc/)).toBeVisible();

  // Le bilan survit à la fermeture de l'appli ; l'accueil marque Pomme comme battu.
  await page.goto('/');
  expect(await bilan(page)).toEqual({ pomme: { v: 1, d: 0 } });
  // Caillou était le dernier adversaire choisi : l'accueil le propose.
  await expect(page.getByRole('heading', { level: 2, name: 'Caillou' })).toBeVisible();
  await page.getByRole('button', { name: 'Changer' }).click();
  await expect(page.getByRole('button', { name: 'Pomme, 20 kyu, battue', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Caillou, 16 kyu', exact: true })).toBeVisible();
  // Caillou n'est pas encore battu : Bambou reste verrouillé.
  await expect(page.getByRole('button', { name: 'Bambou, 13 kyu, verrouillé', exact: true })).toBeVisible();
  expect(erreurs).toEqual([]);
});

test('célébrations coupées dans Profil : victoire sans confettis', async ({ page }) => {
  await page.goto('/?komi=-100');
  await page.getByRole('button', { name: 'Profil' }).click();
  const celebrations = page.getByRole('switch', { name: /^Célébrations/ });
  await celebrations.click();
  await expect(celebrations).toHaveAttribute('aria-checked', 'false');
  await page.getByRole('button', { name: 'Jouer' }).click();
  await page.locator('.cta').click();
  await passerJusquAuComptage(page);
  await expect(page.getByRole('heading', { level: 2, name: 'Victoire' })).toBeVisible();
  // Le tampon reste (c'est l'information « tu l'as battue ») ; la fête, non.
  await expect(page.locator('.fin-tampon')).toHaveText('BATTUE');
  await page.waitForTimeout(800); // les confettis partiraient à 360 ms
  await expect(page.locator('canvas')).toHaveCount(0);
});

test.describe('mouvements réduits', () => {
  test.use({ reducedMotion: 'reduce' });
  test('état final direct, sans confettis', async ({ page }) => {
    await page.goto('/?komi=-100');
    await page.locator('.cta').click();
    await passerJusquAuComptage(page);
    await expect(page.getByRole('heading', { level: 2, name: 'Victoire' })).toBeVisible();
    // L'écart est affiché d'emblée à sa valeur finale.
    const marge = await page.locator('.fin-marge [aria-hidden="true"]').textContent();
    expect(marge).toBe(await page.locator('.fin-marge .sr-only').textContent());
    await page.waitForTimeout(800);
    await expect(page.locator('canvas')).toHaveCount(0);
  });
});

test('revoir ma partie : précédent et suivant, puis retour au bilan', async ({ page }) => {
  await page.goto('/?komi=-100');
  await page.locator('.cta').click();
  const plateau = page.getByRole('img', { name: /Plateau de go 9 × 9/ });
  await expect(plateau).toBeVisible();
  // Un coup au centre, pour avoir une pierre à revoir.
  const box = (await plateau.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator('g[data-point="E5"][data-pierre="noir"]')).toHaveCount(1);
  await passerJusquAuComptage(page);
  await expect(page.getByRole('heading', { level: 2, name: 'Victoire' })).toBeVisible();

  await page.getByRole('button', { name: 'Revoir ma partie' }).click();
  const precedent = page.getByRole('button', { name: 'Précédent' });
  const suivant = page.getByRole('button', { name: 'Suivant' });
  await expect(page.getByText('Revoir ma partie')).toBeVisible();
  // On commence au premier coup : ta pierre en E5.
  await expect(page.getByText(/Coup 1 sur \d+/)).toBeVisible();
  await expect(page.locator('.coach p')).toHaveText('Tu joues E5.');
  await expect(plateau.locator('g[data-pierre]')).toHaveCount(1);
  // Précédent : plateau vide.
  await precedent.click();
  await expect(page.getByText(/Coup 0 sur \d+/)).toBeVisible();
  await expect(plateau.locator('g[data-pierre]')).toHaveCount(0);
  await expect(precedent).toBeDisabled();
  // Suivant : la pierre revient.
  await suivant.click();
  await expect(plateau.locator('g[data-point="E5"][data-pierre="noir"]')).toHaveCount(1);
  // Jusqu'au bout, puis retour au bilan.
  while (await suivant.isEnabled()) await suivant.click();
  await expect(suivant).toBeDisabled();
  await page.getByRole('button', { name: 'Retour au bilan' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Victoire' })).toBeVisible();
  await expect(page.locator('.cta')).toHaveText('Défier Caillou');
});

test('défaite par abandon : pas de tampon ni de fête, Mochi encourage et propose de rejouer', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.goto('/');
  await page.locator('.cta').click();
  await expect(page.getByRole('img', { name: /Plateau de go 9 × 9/ })).toBeVisible();
  await page.getByRole('button', { name: 'Abandonner' }).click();
  await page.getByRole('button', { name: /^Confirmer/ }).click();

  await expect(page.getByRole('heading', { level: 2, name: 'Défaite' })).toBeVisible();
  await expect(page.locator('.fin-marge')).toHaveText('par abandon');
  await expect(page.locator('.fin-tampon')).toHaveCount(0);
  await expect(page.locator('.fin-mochi')).toContainText(/Tu as abandonné tôt/);
  await page.waitForTimeout(800);
  await expect(page.locator('canvas')).toHaveCount(0);
  const cta = page.locator('.cta');
  await expect(cta).toHaveText('Rejouer contre Pomme');
  expect(await bilan(page)).toEqual({ pomme: { v: 0, d: 1 } });

  await cta.click();
  await expect(page.getByText(/Pomme a Blanc/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Abandonner' })).toBeVisible();

  // Pas encore battue : aucune marque dans le carrousel.
  await page.goto('/');
  await page.getByRole('button', { name: 'Changer' }).click();
  await expect(page.getByRole('button', { name: 'Pomme, 20 kyu', exact: true })).toBeVisible();
  expect(erreurs).toEqual([]);
});
