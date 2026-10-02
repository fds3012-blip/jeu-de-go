import { expect, test, type Page } from '@playwright/test';
import { jouer } from './plateau';
// Textes anglais : chargés à la demande dans l'app (#325), enregistrés ici pour `localiser(…, 'en')`.
import '../src/content/anglais.setup';
import { LESSONS_FR, localiser, type LessonStep } from '../src/content/lessons';
import { ACQUIS } from '../src/content/acquis';

// Issue #16 : les leçons 13 à 16 sont sur le chemin Apprendre, sans changer l'écran (seulement les données).
// La leçon 14 (le seki) se joue du début à la fin, avec une erreur à chaque question, à 390 et à 320 px, en clair et en
// sombre. Positions et réponses prouvées par src/go/lecons-13-16.test.ts. Captures : docs/design/captures/lecons-13-16.

const norm = (s: string) => s.replace(/[\u00A0\u202F\s]+/g, ' ').trim();
const L14 = LESSONS_FR.find(l => l.id === 'l14')!;
const etape = <K extends LessonStep['kind']>(i: number) => L14.steps[i] as Extract<LessonStep, { kind: K }>;
/** Toutes les leçons avant la 14 déjà faites : le bouton du chemin ouvre la leçon 14. */
const AVANT_L14 = Object.fromEntries(LESSONS_FR.slice(0, LESSONS_FR.findIndex(l => l.id === 'l14')).map(l => [l.id, l.steps.length]));

/** Aucun défilement horizontal, et ni la bulle de Mochi ni le verdict ne coupent leur texte. */
async function sansDebordement(page: Page, ecran: string) {
  const { large, fenetre } = await page.evaluate(() => ({ large: document.documentElement.scrollWidth, fenetre: innerWidth }));
  expect(large, `défilement horizontal : ${ecran}`).toBeLessThanOrEqual(fenetre);
  for (const b of await page.locator('.bubble p, .verdict').all()) {
    const { sw, cw } = await b.evaluate(e => ({ sw: e.scrollWidth, cw: e.clientWidth }));
    expect(sw, `texte coupé : ${ecran}`).toBeLessThanOrEqual(cw);
  }
}

for (const [largeur, hauteur, theme] of [[390, 844, 'light'], [320, 568, 'dark']] as const) {
  test(`leçon 14, le seki, jouée du début à la fin à ${largeur} px (${theme === 'light' ? 'clair' : 'sombre'})`, async ({ page }) => {
    await page.addInitScript(p => localStorage.setItem('go.lecons.v1', JSON.stringify(p)), AVANT_L14);
    await page.setViewportSize({ width: largeur, height: hauteur });
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme });
    const photo = (n: string) => page.screenshot({ path: `docs/design/captures/lecons-13-16/l14-${largeur}-${n}.png` });
    await page.goto('/');
    await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();

    // Le chemin : le nouveau chapitre et ses leçons ; « Bientôt » n'annonce plus que deux chapitres.
    await expect(page.getByRole('heading', { name: 'Fin de partie et comptage' })).toBeAttached();
    await expect(page.getByRole('button', { name: 'Leçon 13 : Le point vital, terminée' })).toBeAttached();
    await expect(page.getByRole('button', { name: 'Leçon 14 : Le seki, prochaine étape' })).toBeAttached();
    await expect(page.getByRole('button', { name: 'Leçon 16 : Compter une partie' })).toBeAttached();
    await expect(page.locator('.a-venir li')).toHaveText(['Formes et tesuji, les coups astucieux', 'Ouverture en 19\u00A0×\u00A019']);
    await sansDebordement(page, 'chemin');
    await page.locator('.cta-chemin').scrollIntoViewIfNeeded();
    await photo('0-chemin');
    await page.locator('.cta-chemin').click();

    await expect(page.getByRole('heading', { name: 'Le seki' })).toBeVisible();
    const zone = page.locator('.lecteur-plateau');
    const progression = page.getByRole('progressbar', { name: 'Progression de la leçon' });
    const continuer = page.getByRole('button', { name: 'Continuer' });

    // 1. On touche une liberté partagée ; un point faux reçoit l'aide du geste.
    await expect(page.locator('.bubble p')).toHaveText(norm(etape<'info'>(0).text));
    await expect(zone).toHaveAttribute('data-demo', 'geste');
    await jouer(page, 'H5');
    await expect(page.getByText(norm((etape<'info'>(0).geste as { no: string }).no))).toBeVisible();
    await jouer(page, 'E1');
    await expect(zone).toHaveAttribute('data-demo', 'finie');
    await expect(page.locator('[data-note-sceau="2 libertés"]')).toBeAttached();
    await sansDebordement(page, 'étape 1');
    await photo('1-libertes-partagees');
    await continuer.click();
    await expect(progression).toHaveAttribute('aria-valuenow', '1');

    // 2. Noir remplit C1 et se fait prendre.
    await expect(zone).toHaveAttribute('data-demo', 'geste');
    await jouer(page, 'C1');
    await expect(zone).toHaveAttribute('data-demo', 'finie');
    await sansDebordement(page, 'étape 2');
    await photo('2-noir-remplit');
    await continuer.click();

    // 3. Blanc remplit C1 ; on prend tout en E1.
    await expect(zone).toHaveAttribute('data-demo', 'geste');
    await jouer(page, 'E1');
    await expect(zone).toHaveAttribute('data-demo', 'finie');
    await sansDebordement(page, 'étape 3');
    await continuer.click();

    // 4. Quiz : les points d'un seki ne sont à personne.
    const q4 = etape<'quiz'>(3);
    await expect(page.locator('.bubble p')).toHaveText(norm(q4.text));
    const choix = (n: string) => page.locator('.choix').getByRole('button', { name: n, exact: true });
    await choix('À Noir').click();
    await expect(choix('À Noir')).toHaveClass(/choix-faux/);
    await expect(page.locator('.choix-aide')).toContainText(norm(q4.no));
    await choix('À personne').click();
    await expect(page.locator('.verdict')).toContainText(norm(q4.ok));
    await sansDebordement(page, 'étape 4');
    await photo('4-quiz');
    await continuer.click();

    // 5. Faire seki : C1 reçoit sa réfutation, E2 est la réponse.
    const q5 = etape<'move'>(4);
    await jouer(page, 'C1');
    await expect(page.locator('.verdict')).toContainText(norm(q5.refus![0].no));
    await jouer(page, 'E2');
    await expect(page.locator('.verdict')).toContainText(norm(q5.ok));
    await expect(progression).toHaveAttribute('aria-valuenow', '5');
    await sansDebordement(page, 'étape 5');
    await photo('5-seki');
    await page.getByRole('button', { name: 'Terminer la leçon' }).click();

    // Fin : chapitre en cours d'écriture, donc « Leçon terminée », et ce que le joueur sait faire.
    await expect(page.getByRole('heading', { name: 'Leçon terminée' })).toBeVisible();
    await expect(page.getByText(norm(ACQUIS.l14))).toBeVisible();
    await sansDebordement(page, 'fin de leçon');
    await photo('6-fin');
    await page.getByRole('button', { name: 'Retour au chemin' }).click();
    await expect(page.getByRole('button', { name: 'Leçon 14 : Le seki, terminée' })).toBeAttached();
  });
}

test('?lang=en, 320 px : le chapitre « Fin de partie et comptage » et la leçon 15 s’affichent en anglais', async ({ page }) => {
  const avant = Object.fromEntries(LESSONS_FR.slice(0, LESSONS_FR.findIndex(l => l.id === 'l15')).map(l => [l.id, l.steps.length]));
  await page.addInitScript(p => localStorage.setItem('go.lecons.v1', JSON.stringify(p)), avant);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?lang=en');
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Learn' }).click();
  await expect(page.getByRole('heading', { name: 'Endgame and counting' })).toBeAttached();
  await sansDebordement(page, 'chemin en anglais');
  await page.locator('.cta-chemin').click();
  const l15 = localiser(LESSONS_FR.find(l => l.id === 'l15')!, 'en');
  await expect(page.getByRole('heading', { name: l15.title })).toBeVisible();
  await expect(page.locator('.bubble p')).toHaveText(norm(l15.steps[0].text));
  await sansDebordement(page, 'l15 en anglais');
  await page.screenshot({ path: 'docs/design/captures/lecons-13-16/l15-320-en.png' });
});
