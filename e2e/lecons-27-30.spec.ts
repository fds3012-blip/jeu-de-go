import { expect, test, type Page } from '@playwright/test';
import { jouer } from './plateau';
import { LESSONS_FR, type LessonStep } from '../src/content/lessons';
import { ACQUIS } from '../src/content/acquis';

// Issue #16 (palier 27-30) : la leçon 27 (attaquer et défendre) rejoint « L’ouverture », sans changer l'écran.
// Elle se joue du début à la fin, avec une erreur au geste et à chaque exercice, à 390 et à 320 px, en clair et en sombre.
// Positions et réponses prouvées par src/go/lecons-27-30.test.ts (preuves KataGo figées).
// Captures : seulement si CAPTURES_LECONS_27_30 donne un dossier (aucune capture versionnée).

const norm = (s: string) => s.replace(/[\u00A0\u202F\s]+/g, ' ').trim();
const L27 = LESSONS_FR.find(l => l.id === 'l27')!;
const etape = <K extends LessonStep['kind']>(i: number) => L27.steps[i] as Extract<LessonStep, { kind: K }>;
const numero = (id: string) => LESSONS_FR.findIndex(l => l.id === id) + 1;
/** Toutes les leçons avant la 27 sur le chemin déjà faites : le bouton du chemin ouvre la leçon 27. */
const AVANT_L27 = Object.fromEntries(LESSONS_FR.slice(0, LESSONS_FR.findIndex(l => l.id === 'l27')).map(l => [l.id, l.steps.length]));
const DOSSIER = process.env.CAPTURES_LECONS_27_30;

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
  test(`leçon 27, attaquer et défendre, jouée du début à la fin à ${largeur} px (${theme === 'light' ? 'clair' : 'sombre'})`, async ({ page }) => {
    await page.addInitScript(p => localStorage.setItem('go.lecons.v1', JSON.stringify(p)), AVANT_L27);
    await page.setViewportSize({ width: largeur, height: hauteur });
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme });
    const photo = async (n: string) => { if (DOSSIER) await page.screenshot({ path: `${DOSSIER}/l27-${largeur}-${n}.png` }); };
    await page.goto('/');
    await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();

    // Le chemin : la leçon 27 suit « Les premiers coups », dans « L’ouverture ».
    await expect(page.getByRole('heading', { name: 'L’ouverture' })).toBeAttached();
    await expect(page.getByRole('button', { name: `Leçon ${numero('l8')} : Les premiers coups, terminée` })).toBeAttached();
    await expect(page.getByRole('button', { name: `Leçon ${numero('l27')} : Attaquer et défendre, prochaine étape` })).toBeAttached();
    await sansDebordement(page, 'chemin');
    await page.locator('.cta-chemin').scrollIntoViewIfNeeded();
    await page.locator('.cta-chemin').click();

    await expect(page.getByRole('heading', { name: 'Attaquer et défendre' })).toBeVisible();
    const zone = page.locator('.lecteur-plateau');
    const progression = page.getByRole('progressbar', { name: 'Progression de la leçon' });
    const continuer = page.getByRole('button', { name: 'Continuer' });

    // 1. Noir ferme le centre à la pierre faible, en F4.
    await expect(page.locator('.bubble p')).toHaveText(norm(etape<'info'>(0).text));
    await expect(zone).toHaveAttribute('data-demo', 'geste');
    await jouer(page, 'F4');
    await expect(zone).toHaveAttribute('data-demo', 'finie');
    await sansDebordement(page, 'étape 1');
    await photo('1-attaque');
    await continuer.click();
    await expect(progression).toHaveAttribute('aria-valuenow', '1');

    // 2. Si Blanc joue d'abord, il sort au même point : un point faux reçoit l'aide du geste.
    await expect(page.locator('.bubble p')).toHaveText(norm(etape<'info'>(1).text));
    await expect(zone).toHaveAttribute('data-demo', 'geste');
    await jouer(page, 'B8');
    await expect(page.getByText(norm((etape<'info'>(1).geste as { no: string }).no))).toBeVisible();
    await jouer(page, 'F4');
    await expect(zone).toHaveAttribute('data-demo', 'finie');
    await sansDebordement(page, 'étape 2');
    await continuer.click();

    // 3. À toi, sur le côté : G5 est réfuté (« elle sort par F4 »), F4 est la réponse.
    const q3 = etape<'move'>(2);
    await jouer(page, 'G5');
    await expect(page.locator('.verdict')).toContainText(norm(q3.refus![0].no));
    await jouer(page, 'F4');
    await expect(page.locator('.verdict')).toContainText(norm(q3.ok));
    await sansDebordement(page, 'étape 3');
    await photo('3-cote');
    await continuer.click();

    // 4. Défendre : ramper en E3 est réfuté ; F4 sort vers le centre.
    const q4 = etape<'move'>(3);
    await jouer(page, 'E3');
    await expect(page.locator('.verdict')).toContainText(norm(q4.refus![0].no));
    await jouer(page, 'F4');
    await expect(page.locator('.verdict')).toContainText(norm(q4.ok));
    await expect(progression).toHaveAttribute('aria-valuenow', '4');
    await sansDebordement(page, 'étape 4');
    await page.getByRole('button', { name: 'Terminer la leçon' }).click();

    // Fin : chapitre en cours d'écriture, donc « Leçon terminée », et ce que le joueur sait faire.
    await expect(page.getByRole('heading', { name: 'Leçon terminée' })).toBeVisible();
    await expect(page.getByText(norm(ACQUIS.l27))).toBeVisible();
    await sansDebordement(page, 'fin de leçon');
  });
}
