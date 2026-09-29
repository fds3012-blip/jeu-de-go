import { expect, test, type Page } from '@playwright/test';
import { jouer } from './plateau';
import { LESSONS_FR, localiser, type LessonStep } from '../src/content/lessons';
import { ACQUIS } from '../src/content/acquis';

// Issue #16 : les leçons 9 à 12 sont sur le chemin Apprendre, sans changer l'écran (seulement les données).
// La leçon 12 (le faux œil) se joue du début à la fin, avec une erreur à chaque question, à 390 et à 320 px.
// Positions et réponses prouvées par src/go/lecons-16.test.ts.

const norm = (s: string) => s.replace(/[  \s]+/g, ' ').trim();
const L12 = LESSONS_FR.find(l => l.id === 'l12')!;
const etape = <K extends LessonStep['kind']>(i: number) => L12.steps[i] as Extract<LessonStep, { kind: K }>;
/** Toutes les leçons avant la 12 déjà faites : le bouton du chemin ouvre la leçon 12. */
const AVANT_L12 = Object.fromEntries(LESSONS_FR.filter(l => l.id !== 'l12').map(l => [l.id, l.steps.length]));

/** Aucun défilement horizontal, et ni la bulle de Mochi ni le verdict ne coupent leur texte. */
async function sansDebordement(page: Page, ecran: string) {
  const { large, fenetre } = await page.evaluate(() => ({ large: document.documentElement.scrollWidth, fenetre: innerWidth }));
  expect(large, `défilement horizontal : ${ecran}`).toBeLessThanOrEqual(fenetre);
  for (const b of await page.locator('.bubble p, .verdict').all()) {
    const { sw, cw } = await b.evaluate(e => ({ sw: e.scrollWidth, cw: e.clientWidth }));
    expect(sw, `texte coupé : ${ecran}`).toBeLessThanOrEqual(cw);
  }
}

for (const largeur of [390, 320]) {
  test(`leçon 12, le faux œil, jouée du début à la fin à ${largeur} px`, async ({ page }) => {
    await page.addInitScript(p => localStorage.setItem('go.lecons.v1', JSON.stringify(p)), AVANT_L12);
    await page.setViewportSize({ width: largeur, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();

    // Le chemin : les deux nouveaux chapitres, leurs leçons ; « Bientôt » n'annonce plus que trois chapitres.
    await expect(page.getByRole('heading', { name: 'Capturer et sauver' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Vie et mort' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Leçon 9 : Le filet, terminée' })).toBeAttached();
    await expect(page.getByRole('button', { name: 'Leçon 12 : Le faux œil, prochaine étape' })).toBeAttached();
    await expect(page.locator('.a-venir li')).toHaveText(['Formes et tesuji, les coups astucieux', 'Ouverture en 19\u00A0×\u00A019', 'Fin de partie et comptage']);
    await sansDebordement(page, 'chemin');
    await page.locator('.cta-chemin').click();

    await expect(page.getByRole('heading', { name: 'Le faux œil' })).toBeVisible();
    const zone = page.locator('.lecteur-plateau');
    const progression = page.getByRole('progressbar', { name: 'Progression de la leçon' });
    const continuer = page.getByRole('button', { name: 'Continuer' });

    // 1. On touche la pierre qui n'est pas reliée ; la démonstration montre ses deux libertés.
    await expect(page.locator('.bubble p')).toHaveText(norm(etape<'info'>(0).text));
    await expect(zone).toHaveAttribute('data-demo', 'geste');
    await sansDebordement(page, 'étape 1');
    await jouer(page, 'D1');
    await expect(zone).toHaveAttribute('data-demo', 'finie');
    await expect(page.locator('[data-note-sceau="2 libertés"]')).toBeAttached();
    await continuer.click();
    await expect(progression).toHaveAttribute('aria-valuenow', '1');

    // 2. Un geste faux, puis la pierre qui relie, au point vert.
    await expect(zone).toHaveAttribute('data-demo', 'geste');
    await jouer(page, 'A1');
    await expect(page.getByText('Pose ta pierre sur le point vert.')).toBeVisible();
    await jouer(page, 'C1');
    await expect(zone).toHaveAttribute('data-demo', 'finie');
    await sansDebordement(page, 'étape 2');
    await continuer.click();

    // 3. Question « touche » : l'œil vrai est refusé, le faux œil est la réponse.
    const q3 = etape<'touche'>(2);
    await expect(page.locator('.bubble p')).toHaveText(norm(q3.text));
    await jouer(page, 'A1');
    await expect(page.locator('.verdict')).toContainText(norm(q3.no));
    await jouer(page, 'C1');
    await expect(page.locator('.verdict')).toContainText(norm(q3.ok));
    await sansDebordement(page, 'étape 3');
    await continuer.click();

    // 4. Faire vivre : boucher un œil reçoit sa réfutation, D2 fait deux vrais yeux.
    const q4 = etape<'move'>(3);
    await jouer(page, 'C1');
    await expect(page.locator('.verdict')).toContainText(norm(q4.refus![0].no));
    await jouer(page, 'D2');
    await expect(page.locator('.verdict')).toContainText(norm(q4.ok));
    await sansDebordement(page, 'étape 4');
    await continuer.click();

    // 5. Tuer : F8 rend l'œil blanc faux.
    const q5 = etape<'move'>(4);
    await jouer(page, 'C5');
    await expect(page.locator('.verdict')).toContainText(norm(q5.no));
    await jouer(page, 'F8');
    await expect(page.locator('.verdict')).toContainText(norm(q5.ok));
    await expect(progression).toHaveAttribute('aria-valuenow', '5');
    await sansDebordement(page, 'étape 5');
    await page.getByRole('button', { name: 'Terminer la leçon' }).click();

    // Fin : chapitre en cours d'écriture, donc « Leçon terminée », et ce que le joueur sait faire.
    await expect(page.getByRole('heading', { name: 'Leçon terminée' })).toBeVisible();
    await expect(page.getByText(norm(ACQUIS.l12))).toBeVisible();
    await sansDebordement(page, 'fin de leçon');
    await page.getByRole('button', { name: 'Retour au chemin' }).click();
    await expect(page.getByRole('button', { name: 'Leçon 12 : Le faux œil, terminée' })).toBeAttached();
  });
}

test('?lang=en, 320 px : les nouveaux chapitres et la leçon 9 s’affichent en anglais', async ({ page }) => {
  const avant = Object.fromEntries(LESSONS_FR.filter(l => Number(l.id.slice(1)) < 9).map(l => [l.id, l.steps.length]));
  await page.addInitScript(p => localStorage.setItem('go.lecons.v1', JSON.stringify(p)), avant);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?lang=en');
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Learn' }).click();
  await expect(page.getByRole('heading', { name: 'Capturing and saving' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Life and death' })).toBeVisible();
  await sansDebordement(page, 'chemin en anglais');
  await page.locator('.cta-chemin').click();
  const l9 = localiser(LESSONS_FR.find(l => l.id === 'l9')!, 'en');
  await expect(page.getByRole('heading', { name: l9.title })).toBeVisible();
  await expect(page.locator('.bubble p')).toHaveText(norm(l9.steps[0].text));
  await sansDebordement(page, 'l9 en anglais');
});
