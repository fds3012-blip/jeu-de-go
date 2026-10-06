import { expect, test, type Page } from '@playwright/test';
import { jouer } from './plateau';
import { LESSONS_FR, type LessonStep } from '../src/content/lessons';
import { ACQUIS } from '../src/content/acquis';

// Issue #16 (palier 21-30) : nouvelles leçons sur le chemin Apprendre, sans changer l'écran (seulement les données).
// La leçon 21 (le manque de libertés) se joue du début à la fin, avec une erreur au quiz et à l'exercice, à 390 et à
// 320 px, en clair et en sombre. Positions et réponses prouvées par src/go/lecons-21-30.test.ts.
// Captures : seulement si CAPTURES_LECONS_21_30 donne un dossier (aucune capture versionnée).

const norm = (s: string) => s.replace(/[\u00A0\u202F\s]+/g, ' ').trim();
const L21 = LESSONS_FR.find(l => l.id === 'l21')!;
const etape = <K extends LessonStep['kind']>(i: number) => L21.steps[i] as Extract<LessonStep, { kind: K }>;
/** Rang d'une leçon sur le chemin. */
const numero = (id: string) => LESSONS_FR.findIndex(l => l.id === id) + 1;
/** Toutes les leçons avant la 21 sur le chemin déjà faites : le bouton du chemin ouvre la leçon 21. */
const AVANT_L21 = Object.fromEntries(LESSONS_FR.slice(0, LESSONS_FR.findIndex(l => l.id === 'l21')).map(l => [l.id, l.steps.length]));
const DOSSIER = process.env.CAPTURES_LECONS_21_30;

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
  test(`leçon 21, le manque de libertés, jouée du début à la fin à ${largeur} px (${theme === 'light' ? 'clair' : 'sombre'})`, async ({ page }) => {
    await page.addInitScript(p => localStorage.setItem('go.lecons.v1', JSON.stringify(p)), AVANT_L21);
    await page.setViewportSize({ width: largeur, height: hauteur });
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme });
    const photo = async (n: string) => { if (DOSSIER) await page.screenshot({ path: `${DOSSIER}/l21-${largeur}-${n}.png` }); };
    await page.goto('/');
    await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();

    // Le chemin : les nouvelles leçons sont rangées dans leurs chapitres ; la 21 ferme « Formes et tesuji ».
    await expect(page.getByRole('heading', { name: 'Formes et tesuji' })).toBeAttached();
    await expect(page.getByRole('button', { name: `Leçon ${numero('l26')} : La course avec un œil, terminée` })).toBeAttached();
    await expect(page.getByRole('button', { name: `Leçon ${numero('l25')} : Les groupes du coin, terminée` })).toBeAttached();
    await expect(page.getByRole('button', { name: `Leçon ${numero('l23')} : Le hane au premier rang, terminée` })).toBeAttached();
    await expect(page.getByRole('button', { name: `Leçon ${numero('l21')} : Le manque de libertés, prochaine étape` })).toBeAttached();
    await sansDebordement(page, 'chemin');
    await page.locator('.cta-chemin').scrollIntoViewIfNeeded();
    await photo('0-chemin');
    await page.locator('.cta-chemin').click();

    await expect(page.getByRole('heading', { name: 'Le manque de libertés' })).toBeVisible();
    const zone = page.locator('.lecteur-plateau');
    const progression = page.getByRole('progressbar', { name: 'Progression de la leçon' });
    const continuer = page.getByRole('button', { name: 'Continuer' });

    // 1. Noir bouche la liberté extérieure E1 : il reste deux libertés à Blanc.
    await expect(page.locator('.bubble p')).toHaveText(norm(etape<'info'>(0).text));
    await expect(zone).toHaveAttribute('data-demo', 'geste');
    await jouer(page, 'E1');
    await expect(zone).toHaveAttribute('data-demo', 'finie');
    await expect(page.locator('[data-note-sceau="2 libertés"]')).toBeAttached();
    await sansDebordement(page, 'étape 1');
    await continuer.click();
    await expect(progression).toHaveAttribute('aria-valuenow', '1');

    // 2. Blanc relie en B1 et se met en atari ; Noir prend tout en A2.
    await expect(zone).toHaveAttribute('data-demo', 'geste');
    await jouer(page, 'A2');
    await expect(zone).toHaveAttribute('data-demo', 'finie');
    await sansDebordement(page, 'étape 2');
    await photo('2-prise');
    await continuer.click();

    // 3. Quiz : combien de libertés après A2 ? « 2 » est faux, « 1 » est juste.
    const q3 = etape<'quiz'>(2);
    await expect(page.locator('.bubble p')).toHaveText(norm(q3.text));
    const choix = (n: string) => page.locator('.choix').getByRole('button', { name: n, exact: true });
    await choix('2').click();
    await expect(choix('2')).toHaveClass(/choix-faux/);
    await expect(page.locator('.choix-aide')).toContainText(norm(q3.no));
    await choix('1').click();
    await expect(page.locator('.verdict')).toContainText(norm(q3.ok));
    await sansDebordement(page, 'étape 3');
    await continuer.click();

    // 4. À toi : H2 n'est pas la réponse ; E1 l'est.
    const q4 = etape<'move'>(3);
    await jouer(page, 'H2');
    await expect(page.locator('.verdict')).toContainText(norm(q4.no));
    await jouer(page, 'E1');
    await expect(page.locator('.verdict')).toContainText(norm(q4.ok));
    await expect(progression).toHaveAttribute('aria-valuenow', '4');
    await sansDebordement(page, 'étape 4');
    await photo('4-exercice');
    await page.getByRole('button', { name: 'Terminer la leçon' }).click();

    // Fin : chapitre en cours d'écriture, donc « Leçon terminée », et ce que le joueur sait faire.
    await expect(page.getByRole('heading', { name: 'Leçon terminée' })).toBeVisible();
    await expect(page.getByText(norm(ACQUIS.l21))).toBeVisible();
    await sansDebordement(page, 'fin de leçon');
  });
}
