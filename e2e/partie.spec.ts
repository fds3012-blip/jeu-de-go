import { expect, test } from '@playwright/test';
import { bandeau, couvercle, jouer, jouerSuite, message, partieADeux, plateau } from './plateau';

// Issue #40, phase 3 : écran de partie (grammaire de chess.com) à 390 × 844.

test('liste des coups, couvercle, atari et navigation masquée (partie à deux)', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await partieADeux(page);

  // Pendant la partie : ni barre de navigation ni barre d'avantage (réservée aux parties contre l'ordi).
  await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toHaveCount(0);
  await expect(page.locator('.avantage')).toHaveCount(0);

  const coups = page.getByRole('list', { name: 'Coups joués' }).getByRole('listitem');
  await expect(coups).toHaveText(['Aucun coup joué']);
  await jouer(page, 'D5');
  await expect(coups).toHaveText(['1. D5']);
  await expect(coups.last()).toHaveAttribute('aria-current', 'step');

  // Blanc E5 entouré par D5, F5 et E6 : atari, la dernière liberté (E4) est montrée.
  await jouerSuite(page, ['E5', 'F5', 'A1', 'E6']);
  await expect(message(page)).toHaveText(/^Atari\s! Un groupe blanc n'a plus qu'une liberté/);
  await expect(coups).toHaveCount(5);

  // Blanc joue ailleurs, Noir prend en E4 : la pierre part dans le couvercle de Noir.
  await jouerSuite(page, ['A2', 'E4']);
  await expect(message(page)).toHaveText('Noir capture 1 pierre.');
  await expect(couvercle(page, 'Noir')).toHaveAttribute('data-captures', '1');
  await expect(couvercle(page, 'Noir')).toContainText('1 pierre capturée');
  await expect(couvercle(page, 'Noir').locator('.mini.b')).toHaveCount(1);
  await expect(couvercle(page, 'Blanc')).toHaveAttribute('data-captures', '0');
  await expect(coups.last()).toHaveText('7. E4');
  await expect(coups.last()).toHaveAttribute('aria-current', 'step');

  // Passer s'inscrit dans la liste ; le coup courant suit le dernier coup.
  await page.getByRole('button', { name: 'Passer' }).click();
  await expect(coups).toHaveCount(8);
  await expect(coups.last()).toHaveText('8. passe');
  await expect(page.locator('.coups li[aria-current]')).toHaveCount(1);
  await expect(bandeau(page, 'Noir')).toHaveClass(/active/);

  // Barre d'actions : cibles de 44 px au moins, et pas de défilement horizontal.
  for (const nom of ['Indice', 'Qui mène', 'Annuler', 'Passer', 'Abandonner']) {
    const box = (await page.getByRole('toolbar', { name: 'Actions de la partie' }).getByRole('button', { name: nom }).boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  expect(erreurs).toEqual([]);
});

test("contre l'ordi : barre d'avantage après le premier coup, indice entouré", async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.goto('/');
  await page.locator('.cta').click();
  await expect(plateau(page)).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toHaveCount(0);

  // L'estimation tourne dans un Worker : le libellé apparaît sans bloquer le plateau.
  const barre = page.getByRole('img', { name: /^Avantage estimé : (Noir \+|Blanc \+|À égalité)/ });
  await expect(barre).toBeVisible({ timeout: 10_000 });

  await jouer(page, 'E5');
  await expect(page.getByText(/Pomme (joue|capture|passe)/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('list', { name: 'Coups joués' }).getByRole('listitem')).toHaveCount(2);

  const indice = page.getByRole('button', { name: 'Indice' });
  await expect(indice).toBeEnabled();
  await indice.click();
  await expect(plateau(page).locator('[data-indice]')).toHaveCount(1, { timeout: 10_000 });
  await expect(message(page)).toHaveText(/Regarde dans le cercle vert/);
  // 3 indices par partie contre l'ordi (#35) : le libellé reste « Indice », le reste est dans la description.
  await expect(indice).toHaveAttribute('aria-description', '2 indices restants');
  expect(erreurs).toEqual([]);
});
