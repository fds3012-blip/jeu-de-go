import { expect, test, type Page } from '@playwright/test';
import { jouer } from './plateau';
import { LESSONS_FR, localiser, type LessonStep } from '../src/content/lessons';

// Issue #167 : les leçons traduites s'affichent en anglais avec `?lang=en` ; sans `?lang`, rien ne change (français).
// Positions et réponses identiques : vérifiées par src/content/lessons.en.test.ts.

const FR = LESSONS_FR[0];
const EN = localiser(FR, 'en');
const coup = EN.steps[3] as Extract<LessonStep, { kind: 'move' }>;
const norm = (s: string) => s.replace(/[\u00A0\u202F\s]+/g, ' ').trim();

/** Aucun défilement horizontal, et la bulle de Mochi tient dans sa largeur. */
async function sansDebordement(page: Page, ecran: string) {
  const { large, fenetre } = await page.evaluate(() => ({ large: document.documentElement.scrollWidth, fenetre: innerWidth }));
  expect(large, `défilement horizontal : ${ecran}`).toBeLessThanOrEqual(fenetre);
  for (const b of await page.locator('.bubble p, .verdict').all()) {
    const { sw, cw } = await b.evaluate(e => ({ sw: e.scrollWidth, cw: e.clientWidth }));
    expect(sw, `texte coupé : ${ecran}`).toBeLessThanOrEqual(cw);
  }
}

for (const largeur of [390, 320]) {
  test(`?lang=en : la leçon 1 en anglais à ${largeur} px, sans débordement`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?lang=en');
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Learn' }).click();
    await expect(page.getByText(EN.desc)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'The basics' })).toBeVisible();
    await sansDebordement(page, 'chemin');
    await page.locator('.cta-chemin').click();
    await expect(page.getByRole('heading', { name: EN.title })).toBeVisible();
    await expect(page.locator('.bubble p')).toHaveText(norm(EN.steps[0].text));
    await expect(page.getByText(FR.steps[0].text)).toHaveCount(0);
    await sansDebordement(page, 'étape 1');
  });

  test(`?lang=en : une question de la leçon 1 répond en anglais à ${largeur} px`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('go.lecons.v1', JSON.stringify({ l1: 3 })));
    await page.setViewportSize({ width: largeur, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?lang=en');
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Learn' }).click();
    await page.locator('.cta-chemin').click();
    await expect(page.locator('.bubble p')).toHaveText(norm(coup.text));
    await sansDebordement(page, 'étape 4');
    await jouer(page, coup.accept[0] as string);
    await expect(page.locator('.verdict')).toContainText(norm(coup.ok));
    await sansDebordement(page, 'étape 4, réponse');
  });
}

test('sans ?lang : la leçon 1 reste en français, identique à avant', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
  await expect(page.getByText(FR.desc)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Les bases' })).toBeVisible();
  await page.locator('.cta-chemin').click();
  await expect(page.getByRole('heading', { name: 'Libertés et capture' })).toBeVisible();
  await expect(page.locator('.bubble p')).toHaveText(norm(FR.steps[0].text));
  await sansDebordement(page, 'étape 1 en français');
});

// Leçon 7 en anglais : choix en mots (« In White’s ») et nombres à l'anglaise (33.5), sans débordement.
const L7 = localiser(LESSONS_FR.find(l => l.id === 'l7')!, 'en');
for (const largeur of [390, 320]) {
  test(`?lang=en : quiz de la leçon 7 en anglais à ${largeur} px, sans débordement`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('go.lecons.v1', JSON.stringify({ l1: 6, l2: 6, l3: 8, l4: 5, l5: 5, l6: 6, l7: 4 })));
    await page.setViewportSize({ width: largeur, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?lang=en');
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Learn' }).click();
    await page.locator('.cta-chemin').click();
    await expect(page.getByRole('heading', { name: L7.title })).toBeVisible();
    await expect(page.locator('.bubble p')).toHaveText(norm(L7.steps[4].text));
    for (const c of ['I pass', 'In my territory', 'In White’s']) await expect(page.getByRole('button', { name: c, exact: true })).toBeVisible();
    await sansDebordement(page, 'l7, quiz en mots');
    for (const b of await page.locator('.choix button').all()) {
      const { sw, cw } = await b.evaluate(e => ({ sw: e.scrollWidth, cw: e.clientWidth }));
      expect(sw, 'choix coupé').toBeLessThanOrEqual(cw);
    }
    await page.getByRole('button', { name: 'I pass', exact: true }).click();
    await expect(page.locator('.verdict')).toContainText('two passes in a row');
  });
}
