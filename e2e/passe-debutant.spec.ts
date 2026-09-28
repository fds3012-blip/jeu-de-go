import { expect, test, type Page } from '@playwright/test';
import { attendreReponse, boutonPasser, coupsJoues, finDePartie, jouer, message, passer, plateau } from './plateau';

// Issue #235 : le débutant passe tôt. Mochi prévient avant (sans bloquer), et pendant les premières parties
// Pomme ne profite pas des passes : la partie se termine en 2 passes au plus.

const choix = (page: Page) => page.getByRole('group', { name: 'Passer maintenant ?' });

/** Joue sur le premier point libre de la liste, puis attend la réponse de Pomme. */
async function jouerContrePomme(page: Page, labels: string[], n: number): Promise<void> {
  for (let fait = 0, i = 0; fait < n && i < labels.length; i++) {
    const libre = await plateau(page).locator(`g[data-pierre][data-point="${labels[i]}"]`).count() === 0;
    if (!libre) continue;
    const avant = await coupsJoues(page).count();
    await jouer(page, labels[i]);
    await expect(plateau(page).locator(`g[data-pierre="noir"][data-point="${labels[i]}"]`)).toHaveCount(1);
    // Pomme a répondu : ton coup et le sien sont inscrits, et c'est de nouveau à toi.
    expect(await attendreReponse(page, avant)).toBe(false);
    fait++;
  }
}

test('passer trop tôt : Mochi prévient, « Jouer encore » reprend la main, « Passer » passe', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.goto('/');
  await page.locator('.cta').click();
  await expect(plateau(page)).toBeVisible();
  await jouerContrePomme(page, ['E5', 'C3', 'G7'], 2);
  const coups = await plateau(page).locator('g[data-pierre]').count();

  // Premier toucher sur « Passer » : rien n'est joué, Mochi prévient en une phrase, deux choix. Le plateau ne bouge pas.
  const avant = await plateau(page).boundingBox();
  await boutonPasser(page).click();
  await expect(message(page)).toHaveText('Il reste de la place à prendre. Tu passes quand même ?');
  await expect(choix(page)).toBeVisible();
  expect(await plateau(page).boundingBox()).toEqual(avant);
  // Les deux choix restent au-dessus de la barre d'actions.
  const barre = (await page.getByRole('toolbar').boundingBox())!, zone = (await choix(page).boundingBox())!;
  expect(zone.y + zone.height).toBeLessThanOrEqual(barre.y);
  const [passerBulle, continuer] = [choix(page).getByRole('button', { name: 'Passer', exact: true }), choix(page).getByRole('button', { name: 'Jouer encore' })];
  for (const b of [passerBulle, continuer]) {
    const box = (await b.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  if (process.env.CAPTURE_DIR) for (const theme of ['dark', 'light'] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await page.screenshot({ path: `${process.env.CAPTURE_DIR}/passe-avertissement-${theme}.png` });
  }

  // « Jouer encore » : l'avertissement disparaît, c'est toujours à toi, aucune passe jouée.
  await continuer.click();
  await expect(choix(page)).toHaveCount(0);
  await expect(message(page)).toHaveText(/À toi\s!/);
  await expect(plateau(page).locator('g[data-pierre]')).toHaveCount(coups);

  // Deuxième essai : Mochi prévient encore ; « Passer » dans sa bulle passe vraiment (sans blocage).
  await boutonPasser(page).click();
  await passerBulle.click();
  await expect(choix(page)).toHaveCount(0);
  await expect(page.locator('.recit, .barre-comptage').or(page.getByText(/Pomme (joue|continue)/)).first()).toBeVisible({ timeout: 10_000 });
  expect(erreurs).toEqual([]);
});

test('première partie : le joueur répond « Passer » deux fois, la partie se termine en 2 passes au plus', async ({ page }) => {
  await page.goto('/');
  await page.locator('.cta').click();
  await expect(plateau(page)).toBeVisible();
  // Une douzaine de coups chacun : la partie est « avancée », les frontières sont ouvertes partout.
  await jouerContrePomme(page, ['E5', 'C3', 'G7', 'C7', 'G3', 'D4', 'F6', 'D6', 'F4', 'B5', 'H5', 'E3', 'E7', 'C5', 'G5', 'B3', 'H7'], 11);

  const fin = finDePartie(page);
  let passes = 0;
  for (let i = 0; i < 2 && !(await fin.isVisible()); i++) {
    await expect(boutonPasser(page)).toBeEnabled({ timeout: 10_000 });
    const avant = await coupsJoues(page).count();
    // Mochi prévient si la partie n'est pas finie (toujours au premier passe ici) : le joueur répond « Passer ».
    const averti = await passer(page);
    if (i === 0) expect(averti).toBe(true);
    passes++;
    // #258 : Pomme a répondu (un coup de plus) ou la partie est finie. Pas sa phrase : après ta passe, Mochi peut
    // annoncer un atari ou conseiller de passer au lieu de « Pomme joue… », selon le coup trouvé par le moteur.
    await attendreReponse(page, avant);
  }
  await expect(fin).toBeVisible({ timeout: 10_000 });
  expect(passes).toBeLessThanOrEqual(2);
});
