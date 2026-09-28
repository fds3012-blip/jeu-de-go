import { expect, test, type Page } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jouer, plateau } from './plateau';

// Issue #283 : « Je sais déjà jouer ». Placement en 3 problèmes, niveau estimé en kyu, adversaire conseillé.
// L'accueil d'un premier lancement garde une seule action principale ; le lien est discret, dessous.

// Bonne réponse de chaque problème, lue dans les sources (comme e2e/continuer-a-ta-mesure.spec.ts).
const CONTENU = fileURLToPath(new URL('../src/content', import.meta.url));
const sources = [join(CONTENU, 'puzzles.ts'), ...readdirSync(join(CONTENU, 'lots')).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts')).map(f => join(CONTENU, 'lots', f))];
const REPONSES = new Map(sources.flatMap(f => [...readFileSync(f, 'utf8').matchAll(/id: ?'([^']+)', size: ?(\d+), difficulty: ?\d+, answers: ?\[([^\]]*)\]/g)]
  .map(m => [m[1], { taille: Number(m[2]), coups: [...m[3].matchAll(/'([A-T]\d+)'/g)].map(x => x[1]) }] as const)));

const COINS = ['A1', 'J1', 'A9', 'J9', 'B1', 'A2', 'H1', 'J2', 'B9', 'A8'];

/** Joue le problème de placement affiché : la bonne réponse, ou un coup faux légal. */
async function repondre(page: Page, juste: boolean) {
  const lecteur = page.locator('.placement');
  const id = (await lecteur.getAttribute('data-probleme'))!;
  const r = REPONSES.get(id)!;
  expect(r, `réponse du problème ${id}`).toBeTruthy();
  await expect(plateau(page, r.taille)).toBeVisible();
  const verdict = page.locator('.verdict');
  if (juste) {
    await jouer(page, r.coups[0], r.taille);
  } else {
    // Un coin libre, qui n'est pas une bonne réponse : un coup interdit ou occupé ne compte pas, on essaie le suivant.
    for (const c of COINS.filter(x => !r.coups.includes(x))) {
      await jouer(page, c, r.taille);
      if (await verdict.isVisible().catch(() => false)) break;
      await page.waitForTimeout(150);
      if (await verdict.isVisible().catch(() => false)) break;
    }
  }
  await expect(verdict).toBeVisible();
  await expect(verdict).toContainText(juste ? 'Bien vu' : 'Ce n’était pas ça');
  return id;
}

for (const theme of ['dark', 'light'] as const) {
  test(`accueil, « Je sais déjà jouer », 3 problèmes réussis, niveau puis adversaire (${theme})`, async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.goto('/');

    // Une seule action principale ; le lien est secondaire, au moins 44 px de haut.
    await expect(page.locator('.cta')).toHaveCount(1);
    const lien = page.getByRole('button', { name: 'Je sais déjà jouer' });
    await expect(lien).toBeVisible();
    expect((await lien.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await lien.click();

    const debut = Date.now();
    const vus: string[] = [];
    for (let i = 1; i <= 3; i++) {
      await expect(page.locator('.placement')).toHaveAttribute('data-rang', String(i));
      await expect(page.getByText(`Placement, ${i} sur 3`)).toBeVisible();
      const passer = page.getByRole('button', { name: 'Passer le placement' });
      expect((await passer.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      vus.push(await repondre(page, true));
      await page.locator('.verdict .cta').click();
    }
    expect(new Set(vus).size).toBe(3);

    const fin = page.getByTestId('placement-fin');
    await expect(fin.getByRole('heading', { name: 'Tu es environ 8 kyu.' })).toBeVisible();
    await expect(fin).toContainText('Le kyu est un niveau du go');
    const cta = fin.getByRole('button', { name: 'Joue contre Renard' });
    await expect(cta).toBeVisible();
    expect(Date.now() - debut).toBeLessThan(60_000);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.screenshot({ path: info.outputPath(`placement-fin-${theme}.png`) });
    if (process.env.PLACEMENT_CAPTURES) await page.screenshot({ path: `${process.env.PLACEMENT_CAPTURES}/placement-fin-${theme}.png` });

    // La cote de « Continuer à ta mesure » part du placement ; le résultat est gardé sur l'appareil.
    const etat = await page.evaluate(() => ({
      cote: JSON.parse(localStorage.getItem('go.cote-joueur.v1') ?? 'null'),
      placement: JSON.parse(localStorage.getItem('go.placement.v1') ?? 'null'),
    }));
    expect(etat.placement).toMatchObject({ fait: true, kyu: 8, adversaire: 'renard' });
    expect(etat.cote.cote).toBe(etat.placement.cote);

    await cta.click();
    await expect(page.getByText(/Renard/).first()).toBeVisible();
    await expect(page.getByRole('navigation')).toHaveCount(0);

    // Le kyu ne revient que dans le Profil, sur une ligne discrète ; jamais sur l'accueil.
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Je sais déjà jouer' })).toHaveCount(0);
    await expect(page.getByText(/\d+ kyu/).filter({ hasText: /environ/ })).toHaveCount(0);
    await page.getByRole('navigation').getByRole('button', { name: 'Profil' }).click();
    await expect(page.getByRole('button', { name: /Niveau estimé.*8 kyu, le \d\d\/\d\d/ })).toBeVisible();
  });
}

test('tout raté : pas de niveau annoncé, la leçon 1 sans message d’échec', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Je sais déjà jouer' }).click();
  for (let i = 1; i <= 3; i++) {
    await expect(page.locator('.placement')).toHaveAttribute('data-rang', String(i));
    await repondre(page, false);
    await page.locator('.verdict .cta').click();
  }
  const fin = page.getByTestId('placement-fin');
  await expect(fin.getByRole('heading', { name: 'On commence par les bases' })).toBeVisible();
  await expect(fin).not.toContainText(/kyu|raté|échec/i);
  await fin.getByRole('button', { name: 'Commence la leçon 1' }).click();
  await expect(page.locator('.lecteur, .lecon').first()).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('go.placement.v1') ?? 'null'))).toMatchObject({ fait: true, kyu: null });
});

test('le joueur passe le placement : retour à l’accueil, le lien ne revient pas (320 px)', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Je sais déjà jouer' }).click();
  await repondre(page, true);
  await page.locator('.verdict .cta').click();
  await expect(page.locator('.placement')).toHaveAttribute('data-rang', '2');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.getByRole('button', { name: 'Passer le placement' }).click();

  // Retour à l'accueil, une seule action principale, plus de lien ; aucun niveau enregistré.
  await expect(page.locator('.accueil')).toBeVisible();
  await expect(page.locator('.cta')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Je sais déjà jouer' })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('go.placement.v1') ?? 'null'))).toMatchObject({ fait: false, saute: true });
  // Le Profil propose de le faire plus tard.
  await page.getByRole('navigation').getByRole('button', { name: 'Profil' }).click();
  await expect(page.getByRole('button', { name: 'Faire le placement' })).toBeVisible();
});
