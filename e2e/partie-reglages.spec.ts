import { expect, test, type Page } from '@playwright/test';
import { attendrePierre, jouer, passerJusquAuScore, pierres, plateau } from './plateau';

// #528 (reprend #361 et #15) : partie contre l'ordi complète. Les « Réglages de la partie » (handicap, komi, comptage)
// sont repliés dans la feuille « Changer » ; une partie interrompue se reprend depuis l'accueil.

const lire = (page: Page, cle: string) => page.evaluate(k => JSON.parse(localStorage.getItem(k) ?? 'null'), cle);

test('réglages repliés par défaut ; partie à 4 pierres en comptage chinois jusqu’au comptage, SGF avec HA, AB et RU', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await page.goto('/?komi=-100');
  await page.getByRole('button', { name: 'Changer' }).click();
  const feuille = page.getByRole('dialog');
  await expect(feuille).toBeVisible();

  // Le débutant ne voit rien de nouveau : un seul bouton replié, aucun réglage affiché.
  const ouvrir = page.getByTestId('reglages-partie-ouvrir');
  await expect(ouvrir).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByTestId('reglages-partie')).toHaveCount(0);
  expect((await ouvrir.boundingBox())!.height).toBeGreaterThanOrEqual(44);

  await ouvrir.click();
  await expect(ouvrir).toHaveAttribute('aria-expanded', 'true');
  const reglages = page.getByTestId('reglages-partie');
  await expect(reglages).toBeVisible();
  // Les mots sont expliqués là où on les choisit.
  await expect(reglages).toContainText('Le handicap : des pierres noires posées d’avance');
  await expect(reglages).toContainText('Le komi : des points donnés à Blanc, qui joue en second.');
  const plus = page.getByRole('button', { name: 'Une pierre de handicap en plus' });
  for (let i = 0; i < 3; i++) await plus.click();
  await expect(page.getByTestId('rp-handicap-valeur')).toHaveText('4 pierres');
  // Avec un handicap, le komi est imposé (0,5) et la phrase le dit.
  await expect(reglages.getByRole('button', { name: '7,5' })).toBeDisabled();
  await expect(reglages.getByRole('button', { name: '0,5' })).toHaveAttribute('aria-pressed', 'true');
  await expect(reglages).toContainText('Avec un handicap, le komi est de 0,5 point.');
  await reglages.getByRole('button', { name: 'Chinois' }).click();
  await expect(reglages).toContainText('Chinois : tu comptes ton territoire et tes pierres sur le plateau.');
  await expect(page.getByTestId('reglages-partie-resume')).toHaveText(/Handicap 4, komi 0,5, comptage chinois/);
  expect(await lire(page, 'go.partie.reglages.v1')).toEqual({ handicap: 4, komi: 'auto', regles: 'chinese' });

  // La partie : 4 pierres noires aux points habituels, Pomme (Blanc) joue en premier, et Mochi explique le handicap.
  await feuille.getByRole('button', { name: /contre Pomme$/ }).click();
  await expect(plateau(page)).toBeVisible();
  for (const p of ['C3', 'C7', 'G3', 'G7']) await attendrePierre(page, p, 'noir');
  await expect(pierres(page, 'blanc')).toHaveCount(1, { timeout: 10_000 });
  await expect(page.locator('.annonce-komi')).toHaveText(/^Le handicap\s: tu as 4 pierres d’avance pour équilibrer la partie, et Pomme joue en premier\.$/);
  await expect(page.locator('.joueur[data-joueur="Toi"]')).toContainText('handicap 4');

  // Une partie en cours est gardée dès ton premier coup.
  await jouer(page, 'E5');
  await expect.poll(async () => (await lire(page, 'go.partie.encours.v1'))?.handicap).toBe(4);

  await passerJusquAuScore(page);
  const recit = page.locator('.recit');
  await expect(recit).toBeVisible({ timeout: 10_000 });
  await expect(recit).toContainText('+4 pour Pomme : en règle chinoise, Blanc reçoit 1 point par pierre de handicap.');
  await expect(recit).toContainText(/pierres? pour toi/);
  await expect(page.getByRole('heading', { level: 2, name: /^(Victoire|Défaite|Égalité)$/ })).toBeVisible({ timeout: 15_000 });

  // SGF gardé pour la revue : handicap et règle ; la partie finie n'est plus « en cours ».
  const revue = await lire(page, 'go.revue.v1');
  expect(revue.sgf).toContain('HA[4]');
  expect(revue.sgf).toContain('RU[Chinese]');
  expect(revue.sgf).toMatch(/AB(\[[a-i]{2}\]){4}/);
  expect(await lire(page, 'go.partie.encours.v1')).toBeNull();
  expect(erreurs).toEqual([]);
});

test('reprise : fermer l’onglet en pleine partie, rouvrir, « Reprendre ta partie », et la partie continue', async ({ context, page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('go.parties.v1', JSON.stringify({ n: 3, ordi: 3, dernier: 'pomme' }));
    localStorage.setItem('go.intro-but.v1', 'true');
    localStorage.setItem('go.premiere-pierre.v1', 'true');
  });
  await page.reload();
  await expect(page.getByTestId('tuile-reprise')).toHaveCount(0);
  await page.locator('.cta').click();
  await expect(plateau(page)).toBeVisible();
  for (const p of ['C3', 'G7']) {
    const avant = await pierres(page, 'blanc').count();
    await jouer(page, p);
    await expect(pierres(page, 'blanc')).toHaveCount(avant + 1, { timeout: 10_000 });
  }
  const blanches = await page.locator('g[data-pierre="blanc"]').evaluateAll(g => g.map(e => e.getAttribute('data-point')).sort());
  await expect.poll(async () => (await lire(page, 'go.partie.encours.v1'))?.coups).toBe(4);

  // L'onglet se ferme ; on rouvre l'app : l'accueil propose la partie, sans prendre la place du bouton principal.
  await page.close();
  const p2 = await context.newPage();
  await p2.goto('/');
  const tuile = p2.getByTestId('tuile-reprise');
  await expect(tuile).toBeVisible();
  await expect(tuile).toHaveAccessibleName('Reprendre ta partie contre Pomme, 9 × 9, 4 coups joués');
  await expect(p2.locator('.cta')).toHaveAccessibleName(/contre Pomme$/);
  expect((await tuile.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await tuile.click();

  await expect(plateau(p2)).toBeVisible();
  await expect(p2.getByText('On reprend ta partie là où tu l’avais laissée.')).toBeVisible();
  for (const p of ['C3', 'G7']) await attendrePierre(p2, p, 'noir');
  for (const p of blanches) await attendrePierre(p2, p!, 'blanc');
  // Reprendre ne relance pas une partie : le compteur des parties contre l'ordi ne bouge pas.
  expect(await lire(p2, 'go.parties.v1')).toMatchObject({ n: 3, ordi: 3 });
  await jouer(p2, 'C7');
  await expect(pierres(p2, 'blanc')).toHaveCount(3, { timeout: 10_000 });
  await expect.poll(async () => (await lire(p2, 'go.partie.encours.v1'))?.coups).toBe(6);

  // « Quitter » (la partie est perdue, Mochi l'a dit) : plus rien à reprendre.
  await p2.getByRole('button', { name: "Retour à l'accueil" }).click();
  await p2.getByRole('group', { name: 'Quitter la partie ?' }).getByRole('button', { name: 'Quitter' }).click();
  await expect(p2.locator('.cta')).toBeVisible();
  await expect(p2.getByTestId('tuile-reprise')).toHaveCount(0);
  expect(await lire(p2, 'go.partie.encours.v1')).toBeNull();
});

test('réglages par défaut : la partie est celle d’avant (Noir commence, komi 0,5 annoncé), rien n’est écrit', async ({ page }) => {
  await page.goto('/');
  await page.locator('.cta').click();
  await expect(plateau(page)).toBeVisible();
  await expect(page.locator('.annonce-komi')).toHaveText(/^Le komi\s: des points donnés à Blanc, qui joue en second\. Pour tes premières parties, il est de 0,5\.$/);
  await expect(page.locator('g[data-pierre]')).toHaveCount(0);
  expect(await lire(page, 'go.partie.reglages.v1')).toBeNull();
});
