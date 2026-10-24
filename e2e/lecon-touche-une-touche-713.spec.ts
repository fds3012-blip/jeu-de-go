import { expect, test, type Browser, type Page } from '@playwright/test';
import { fantome, pierres, toucher } from './plateau';
import { LESSONS_FR } from '../src/content/lessons';

// #713 : répondre n'est pas poser. Dans les leçons, « touche le point » (question `touche` ou geste `touche` d'une démonstration)
// répond à une seule touche, sans pierre fantôme ni seconde touche, même avec « Confirmer au doigt » (réglage par défaut).
// La pose d'une pierre garde sa confirmation. Les grands plateaux (plus de 9 lignes) gardent la seconde touche.

const bulle = (page: Page) => page.locator('.mochi-bulle p');

/** Ouvre une leçon à l'étape `etape` : les leçons d'avant sont faites, celle-ci reprend à cette étape. */
async function ouvrirA(browser: Browser, baseURL: string, id: string, etape: number) {
  const idx = LESSONS_FR.findIndex(l => l.id === id);
  const progres = Object.fromEntries(LESSONS_FR.slice(0, idx).map(l => [l.id, l.steps.length]));
  if (etape > 0) progres[id] = etape;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce',
    storageState: { cookies: [], origins: [{ origin: baseURL, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }, { name: 'go.connait-go.v1', value: '"sait"' }, { name: 'go.lecons.v1', value: JSON.stringify(progres) }] }] } });
  const page = await ctx.newPage();
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
  await page.locator('.cta-chemin').scrollIntoViewIfNeeded();
  await page.locator('.cta-chemin').tap();
  await expect(page.locator('.lecteur-lecon')).toBeVisible();
  return { ctx, page };
}

test('question « touche » (leçon 4, le ko) : un mauvais point puis le bon répondent à une seule touche', async ({ browser, baseURL }) => {
  const l4 = LESSONS_FR.find(l => l.id === 'l4')!;
  const { ctx, page } = await ouvrirA(browser, baseURL!, 'l4', l4.steps.length - 1);
  await expect(bulle(page)).toContainText('Touche le point où Blanc ne peut pas reprendre.');
  await toucher(page, 'A1');
  await expect(fantome(page)).toHaveCount(0);
  await expect(bulle(page)).toContainText('Cherche où Blanc reprendrait ta pierre F5.');
  await toucher(page, 'E5');
  await expect(fantome(page)).toHaveCount(0);
  await expect(bulle(page)).toContainText('Oui, E5 : Blanc doit d’abord jouer ailleurs.');
  await ctx.close();
});

test('geste « touche » d’une démonstration (leçon 5, les yeux) : une seule touche, puis la démonstration se joue', async ({ browser, baseURL }) => {
  const { ctx, page } = await ouvrirA(browser, baseURL!, 'l5', 0);
  await expect(page.locator('.lecteur-plateau')).toHaveAttribute('data-demo', 'geste');
  await toucher(page, 'E5'); // pas un œil : l'aide, sans pierre fantôme
  await expect(fantome(page)).toHaveCount(0);
  await expect(bulle(page)).toContainText('Cherche un point vide entouré de pierres noires.');
  await toucher(page, 'A1');
  await expect(fantome(page)).toHaveCount(0);
  await expect(page.locator('.lecon-actions').getByRole('button', { name: 'Continuer', exact: true })).toBeVisible();
  await ctx.close();
});

test('poser une pierre garde sa confirmation : première touche = pierre fantôme, seconde = pierre posée (leçon 1)', async ({ browser, baseURL }) => {
  const { ctx, page } = await ouvrirA(browser, baseURL!, 'l1', 0);
  // La leçon 1 commence par un geste « pose » ; on touche le point vert deux fois.
  const point = await page.locator('.halos').getAttribute('data-guide');
  expect(point, 'le premier geste est une pose guidée').toBeTruthy();
  const p = point!.split(' ')[0];
  await toucher(page, p);
  await expect(fantome(page)).toHaveCount(1);
  const avant = await pierres(page, 'noir').count();
  await toucher(page, p);
  await expect(pierres(page, 'noir')).toHaveCount(avant + 1);
  await ctx.close();
});
