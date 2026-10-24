import { expect, test, type Page } from '@playwright/test';
import { jouer, plateau } from './plateau';
import { LESSONS_FR, type LessonStep } from '../src/content/lessons';
import { ACQUIS } from '../src/content/acquis';
import { OUVERTURES } from '../src/content/ouvertures';
import { CATALOGUE_OUVERTURES } from '../src/content/i18n/ouvertures';

// Issue #672 : les ouvertures célèbres. La leçon 56 (le san-san d'AlphaGo), ouverte depuis le thème « Ouverture »
// d'Apprendre et jouée jusqu'au bout à 390 × 844 en sombre : le geste, deux exercices avec chacun une erreur réfutée
// par KataGo, puis la fin. Ensuite, le répertoire mène à la leçon de son ouverture. Preuves :
// src/go/ouvertures-celebres.test.ts et src/go/ouvertures.test.ts.

const norm = (s: string) => s.replace(/[\u00a0\u202f\s]+/g, ' ').replace(/(?<=\p{L})'(?=\p{L})/gu, '’').trim();
const L56 = LESSONS_FR.find(l => l.id === 'l56')!;
const etape = <K extends LessonStep['kind']>(i: number) => L56.steps[i] as Extract<LessonStep, { kind: K }>;
const CAPTURES = 'docs/pedagogie/captures-672';

async function apprendre(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
}

test('leçon 56, le san-san d’AlphaGo, ouverte depuis le thème Ouverture et jouée en entier', async ({ page }) => {
  await apprendre(page);
  const carte = page.locator('.theme-carte[data-theme="ouverture"]');
  await carte.scrollIntoViewIfNeeded();
  await carte.click();
  // La page du thème liste les sept nouvelles leçons avec les anciennes.
  for (const id of ['l50', 'l51', 'l52', 'l53', 'l54', 'l55', 'l56']) {
    await expect(page.locator('.theme-lecon', { hasText: norm(LESSONS_FR.find(l => l.id === id)!.title) })).toHaveCount(1);
  }
  await page.screenshot({ path: `${CAPTURES}/theme-ouverture-390-sombre.png`, fullPage: true });
  await page.locator('.theme-lecon', { hasText: norm(L56.title) }).click();
  await expect(page.getByRole('heading', { name: norm(L56.title) })).toBeVisible();
  await expect(plateau(page, 19)).toHaveAttribute('data-fenetre');

  const zone = page.locator('.lecteur-plateau');
  const bulle = page.locator('.bubble p');
  const verdict = page.locator('.verdict');
  const continuer = (nom = 'Continuer') => page.getByRole('button', { name: nom, exact: true }).click();

  // 1. Le geste : l'élève entre au san-san, Blanc bloque.
  const s1 = etape<'info'>(0);
  await expect(bulle).toHaveText(norm(s1.text));
  await expect(zone).toHaveAttribute('data-demo', 'geste');
  await jouer(page, (s1.geste as { pose: string }).pose, 19);
  await expect(zone).toHaveAttribute('data-demo', 'finie');
  await page.screenshot({ path: `${CAPTURES}/l56-geste-390-sombre.png` });
  await continuer();

  // 2. Ramper : D2 est réfuté (« Blanc ferme en D3 », coût KataGo), puis D3.
  const s2 = etape<'move'>(1);
  await expect(bulle).toHaveText(norm(s2.text));
  await jouer(page, 'D2', 19);
  await expect(verdict).toContainText(norm(s2.refus![0].no));
  await page.screenshot({ path: `${CAPTURES}/l56-refutation-390-sombre.png` });
  await jouer(page, 'D3', 19);
  await expect(verdict).toContainText(norm(s2.ok));
  await continuer();

  // 3. Blanc s'allonge (démonstration sans geste).
  await expect(bulle).toHaveText(norm(etape<'info'>(2).text));
  await expect(zone).toHaveAttribute('data-demo', 'finie');
  await continuer();

  // 4. Avancer sur le bas : G3 est réfuté (« Blanc coupe en E3 »), F3 accepté.
  const s4 = etape<'move'>(3);
  await expect(bulle).toHaveText(norm(s4.text));
  await jouer(page, 'G3', 19);
  await expect(verdict).toContainText(norm(s4.refus![0].no));
  await jouer(page, 'F3', 19);
  await expect(verdict).toContainText(norm(s4.ok));
  await continuer();

  // 5. Le mot de la fin : avant l'IA, ce san-san passait pour trop tôt.
  await expect(bulle).toHaveText(norm(etape<'info'>(4).text));
  await page.screenshot({ path: `${CAPTURES}/l56-fin-390-sombre.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await continuer('Terminer la leçon');
  await expect(page.getByRole('heading', { name: 'Leçon terminée' })).toBeVisible();
  await expect(page.getByText(norm(ACQUIS.l56))).toBeVisible();
});

test('le répertoire mène à la leçon de son ouverture ; la ligne propre à une leçon n’est pas dans la liste', async ({ page }) => {
  await apprendre(page);
  const entree = page.getByTestId('entree-ouvertures');
  await entree.scrollIntoViewIfNeeded();
  await entree.click();
  await page.getByRole('button', { name: '19 × 19', exact: true }).click();
  await expect(page.locator('.ouv-carte')).toHaveCount(OUVERTURES.filter(o => o.taille === 19 && o.repertoire !== false).length);
  await expect(page.locator('.ouv-carte[data-id="h-sansan-noir"]')).toHaveCount(0);
  await expect(page.locator('.ouv-carte[data-id="g-sanrensei"]')).toBeVisible();
  await page.screenshot({ path: `${CAPTURES}/repertoire-19-390-sombre.png`, fullPage: true });

  await page.locator('.ouv-carte[data-id="g-sanrensei"]').click();
  const lien = page.getByTestId('ouverture-lecon');
  await expect(lien).toHaveText(CATALOGUE_OUVERTURES.fr.lecon);
  expect((await lien.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: `${CAPTURES}/repertoire-sanrensei-390-sombre.png` });
  // Au milieu de la séquence, le lien s'efface ; il revient à la fin.
  await page.getByTestId('ouverture-suivant').click();
  await expect(lien).toHaveCount(0);
  const lecon = LESSONS_FR.find(l => l.id === 'l51')!;
  await page.getByRole('button', { name: 'Précédent' }).click();
  await page.getByTestId('ouverture-lecon').click();
  await expect(page.getByRole('heading', { name: norm(lecon.title) })).toBeVisible();
  await expect(page.locator('.bubble p')).toHaveText(norm(lecon.steps[0].text));
});
