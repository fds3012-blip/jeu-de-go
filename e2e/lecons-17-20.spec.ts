import { expect, test, type Page } from '@playwright/test';
import { jouer } from './plateau';
import { LESSONS_FR, type LessonStep } from '../src/content/lessons';
import { ACQUIS } from '../src/content/acquis';

// Issue #16 (05/10) : leçons 17 à 20 sur le chemin Apprendre, sans changer l'écran (seulement les données).
// La leçon 20 (relier et mourir) se joue du début à la fin, avec une erreur à la question et au quiz, à 390 et à
// 320 px, en clair et en sombre. Positions et réponses prouvées par src/go/lecons-17-20.test.ts.
// Captures : seulement si CAPTURES_LECONS_17_20 donne un dossier (aucune capture versionnée).

const norm = (s: string) => s.replace(/[\u00A0\u202F\s]+/g, ' ').trim();
const L20 = LESSONS_FR.find(l => l.id === 'l20')!;
const etape = <K extends LessonStep['kind']>(i: number) => L20.steps[i] as Extract<LessonStep, { kind: K }>;
/** Toutes les leçons avant la 20 déjà faites : le bouton du chemin ouvre la leçon 20. */
const AVANT_L20 = Object.fromEntries(LESSONS_FR.slice(0, LESSONS_FR.findIndex(l => l.id === 'l20')).map(l => [l.id, l.steps.length]));
const DOSSIER = process.env.CAPTURES_LECONS_17_20;

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
  test(`leçon 20, relier et mourir, jouée du début à la fin à ${largeur} px (${theme === 'light' ? 'clair' : 'sombre'})`, async ({ page }) => {
    await page.addInitScript(p => localStorage.setItem('go.lecons.v1', JSON.stringify(p)), AVANT_L20);
    await page.setViewportSize({ width: largeur, height: hauteur });
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme });
    const photo = async (n: string) => { if (DOSSIER) await page.screenshot({ path: `${DOSSIER}/l20-${largeur}-${n}.png` }); };
    await page.goto('/');
    await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();

    // Le chemin : la leçon 17 finit « Vie et mort », le chapitre « Formes et tesuji » a ses trois leçons.
    await expect(page.getByRole('heading', { name: 'Formes et tesuji' })).toBeAttached();
    await expect(page.getByRole('button', { name: 'Leçon 15 : Les formes d’yeux, terminée' })).toBeAttached();
    await expect(page.getByRole('button', { name: 'Leçon 18 : Les bonnes formes, terminée' })).toBeAttached();
    await expect(page.getByRole('button', { name: 'Leçon 20 : Relier et mourir, prochaine étape' })).toBeAttached();
    await expect(page.locator('.a-venir li')).toHaveText(['Ouverture en 19 × 19']);
    await sansDebordement(page, 'chemin');
    await page.locator('.cta-chemin').scrollIntoViewIfNeeded();
    await photo('0-chemin');
    await page.locator('.cta-chemin').click();

    await expect(page.getByRole('heading', { name: 'Relier et mourir' })).toBeVisible();
    const zone = page.locator('.lecteur-plateau');
    const progression = page.getByRole('progressbar', { name: 'Progression de la leçon' });
    const continuer = page.getByRole('button', { name: 'Continuer' });

    // 1. L'atari en F1 ; Blanc relie et reste en atari.
    await expect(page.locator('.bubble p')).toHaveText(norm(etape<'info'>(0).text));
    await expect(zone).toHaveAttribute('data-demo', 'geste');
    await jouer(page, 'F1');
    await expect(zone).toHaveAttribute('data-demo', 'finie');
    await expect(page.locator('[data-note-sceau="1 liberté"]')).toBeAttached();
    await sansDebordement(page, 'étape 1');
    await continuer.click();
    await expect(progression).toHaveAttribute('aria-valuenow', '1');

    // 2. On prend les cinq pierres en C1.
    await expect(zone).toHaveAttribute('data-demo', 'geste');
    await jouer(page, 'C1');
    await expect(zone).toHaveAttribute('data-demo', 'finie');
    await sansDebordement(page, 'étape 2');
    await continuer.click();

    // 3. À toi : F9 reçoit sa réfutation, C9 est la réponse.
    const q3 = etape<'move'>(2);
    await jouer(page, 'F9');
    await expect(page.locator('.verdict')).toContainText(norm(q3.refus![0].no));
    await jouer(page, 'C9');
    await expect(page.locator('.verdict')).toContainText(norm(q3.ok));
    await sansDebordement(page, 'étape 3');
    await photo('3-oiotoshi');
    await continuer.click();

    // 4. Quiz : Blanc ne doit pas relier.
    const q4 = etape<'quiz'>(3);
    await expect(page.locator('.bubble p')).toHaveText(norm(q4.text));
    const choix = (n: string) => page.locator('.choix').getByRole('button', { name: n, exact: true });
    await choix('Oui').click();
    await expect(choix('Oui')).toHaveClass(/choix-faux/);
    await expect(page.locator('.choix-aide')).toContainText(norm(q4.no));
    await choix('Non, il abandonne E1').click();
    await expect(page.locator('.verdict')).toContainText(norm(q4.ok));
    await expect(progression).toHaveAttribute('aria-valuenow', '4');
    await sansDebordement(page, 'étape 4');
    await page.getByRole('button', { name: 'Terminer la leçon' }).click();

    // Fin : chapitre en cours d'écriture, donc « Leçon terminée », et ce que le joueur sait faire.
    await expect(page.getByRole('heading', { name: 'Leçon terminée' })).toBeVisible();
    await expect(page.getByText(norm(ACQUIS.l20))).toBeVisible();
    await sansDebordement(page, 'fin de leçon');
    await photo('5-fin');
  });
}
