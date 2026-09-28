import { expect, test } from '@playwright/test';
import { jouerSuite, message, partieADeux, passer, plateau } from './plateau';

// Issue #159, partie écran. Position avancée jouée à deux : murs noir en D et blanc en F, la colonne E reste ouverte.
// 21 pierres (un quart du plateau) : la partie est « avancée ».
const COUPS = ['D1', 'F1', 'D2', 'F2', 'D3', 'F3', 'D4', 'F4', 'D5', 'F5', 'D6', 'F6', 'D7', 'F7', 'D8', 'F8', 'D9', 'F9', 'C5', 'G5', 'B5'];
const COLONNE_E = Array.from({ length: 9 }, (_, i) => `E${i + 1}`);

test('passer avec des frontières ouvertes : Mochi montre les points, le passe reste possible', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await partieADeux(page);
  await jouerSuite(page, COUPS);
  await expect(plateau(page).locator('g[data-pierre]')).toHaveCount(21);

  // Blanc passe : la phrase de Mochi, et un anneau discret sur chaque point de la colonne E.
  await page.getByRole('button', { name: 'Passer' }).click();
  await expect(message(page)).toHaveText(/Il reste des frontières ouvertes\s:\sferme-les avant de passer\./);
  const anneaux = plateau(page).locator('[data-frontiere]');
  await expect(anneaux).toHaveCount(9);
  expect((await anneaux.evaluateAll(els => els.map(e => e.getAttribute('data-frontiere')))).sort()).toEqual([...COLONNE_E].sort());
  if (process.env.CAPTURE_DIR) for (const theme of ['dark', 'light'] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await page.screenshot({ path: `${process.env.CAPTURE_DIR}/frontieres-${theme}.png` });
  }

  // Pas de blocage : Noir passe aussi, on arrive au comptage, les anneaux ont disparu.
  await page.getByRole('button', { name: 'Passer' }).click();
  await expect(page.getByRole('button', { name: 'Valider le score' })).toBeVisible({ timeout: 10_000 });
  await expect(anneaux).toHaveCount(0);
  expect(erreurs).toEqual([]);
});

test('partie pas encore avancée : passer ne déclenche aucune alerte', async ({ page }) => {
  await partieADeux(page);
  await jouerSuite(page, ['D5', 'F5']);
  await page.getByRole('button', { name: 'Passer' }).click();
  await expect(message(page)).toHaveText(/Noir passe/);
  await expect(plateau(page).locator('[data-frontiere]')).toHaveCount(0);
});

test("au comptage, la barre d'avantage affiche le score réel", async ({ page }) => {
  // Quatrième partie contre l'ordi : la barre d'avantage est affichée, komi normal (6,5).
  await page.addInitScript(() => {
    localStorage.setItem('go.parties.v1', JSON.stringify({ n: 3, ordi: 3, dernier: 'pomme' }));
    localStorage.setItem('go.intro-but.v1', 'true');
  });
  await page.goto('/');
  await page.locator('.cta').click();
  await expect(plateau(page)).toBeVisible();
  // Plateau vide : deux passes, puis « Corriger les pierres mortes » ouvre le comptage (la barre reste à l'écran).
  await passer(page);
  await page.getByRole('button', { name: 'Corriger les pierres mortes' }).click({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Valider le score' })).toBeVisible();
  // Score : Toi 0, Pomme 6,5 (komi). La barre dit exactement la même chose.
  await expect(page.locator('.comptage')).toContainText(/Toi 0, Pomme 6,5/);
  await expect(page.locator('.avantage-libelle')).toHaveText('Blanc +6,5');
  await expect(page.getByRole('img', { name: 'Score compté : Blanc +6,5' })).toBeVisible();
});
