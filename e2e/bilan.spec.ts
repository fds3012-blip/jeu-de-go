import { expect, test, type Page } from '@playwright/test';

// Issue #22 : fin de partie contre l'ordi, bilan gardé en localStorage (go.bilan.v1) et adversaire suivant.
// Pour une victoire déterministe, on ouvre l'appli avec `?komi=-100` (paramètre de test documenté dans src/app/bilan.ts) :
// Noir gagne forcément si on passe tout de suite.

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

test('victoire contre Pomme : Mochi félicite, Caillou en un geste, bilan gardé', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.goto('/?komi=-100');
  await page.locator('.cta').click();
  await expect(page.getByRole('img', { name: /Plateau de go 9 × 9/ })).toBeVisible();
  await passerJusquAuComptage(page);

  await expect(page.getByText(/^Tu gagnes/)).toBeVisible();
  await expect(page.getByText('Bravo, tu as battu Pomme !', { exact: false })).toBeVisible();
  const cta = page.locator('.cta');
  await expect(cta).toHaveCount(1);
  await expect(cta).toHaveText('Défier Caillou');
  await expect(page.getByRole('button', { name: /^Leçon :/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Accueil', exact: true })).toBeVisible();
  expect(await bilan(page)).toEqual({ pomme: { v: 1, d: 0 } });

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
  // Pas de défilement horizontal à 390 px.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(erreurs).toEqual([]);
});

test('défaite par abandon : Mochi encourage et propose de rejouer', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.goto('/');
  await page.locator('.cta').click();
  await expect(page.getByRole('img', { name: /Plateau de go 9 × 9/ })).toBeVisible();
  await page.getByRole('button', { name: 'Abandonner' }).click();
  await page.getByRole('button', { name: /^Confirmer/ }).click();

  await expect(page.getByText('Pomme gagne par abandon')).toBeVisible();
  await expect(page.getByText(/Pomme gagne cette fois/)).toBeVisible();
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
