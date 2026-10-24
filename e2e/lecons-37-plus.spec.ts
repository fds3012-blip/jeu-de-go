import { expect, test, type Page } from '@playwright/test';
import { fantome, jouer, toucher } from './plateau';
import { motsEntiers, toucherAction } from './lecteur';
import { LESSONS_FR, type LessonStep } from '../src/content/lessons';
import { ACQUIS } from '../src/content/acquis';

// Issue #539 (leçons 37 et suivantes, vers 5 kyu), sur le chemin Apprendre, sans changer l'écran.
// La leçon 39 (les libertés communes) se joue du début à la fin : un mauvais choix au quiz, un coup refusé à chaque
// exercice ; 390 px en clair, 320 px en sombre, puis au zoom 200 % (195 px, polices bloquées) entièrement au doigt.
// Les leçons 37, 38 et 40 sont dans la page de leur thème (#652). Positions et réponses prouvées par
// src/go/lecons-37-plus.test.ts. Captures : seulement si CAPTURES_LECONS_37 donne un dossier (aucune capture versionnée).

const norm = (s: string) => s.replace(/[\u00A0\u202F\s]+/g, ' ').replace(/(?<=\p{L})'(?=\p{L})/gu, '’').trim();
const DOSSIER = process.env.CAPTURES_LECONS_37;
const L39 = LESSONS_FR.find(l => l.id === 'l39')!;
const etape = <K extends LessonStep['kind']>(i: number) => L39.steps[i] as Extract<LessonStep, { kind: K }>;
const numero = (id: string) => LESSONS_FR.findIndex(l => l.id === id) + 1;
const AVANT = Object.fromEntries(LESSONS_FR.slice(0, LESSONS_FR.indexOf(L39)).map(l => [l.id, l.steps.length]));

async function sansDebordement(page: Page, ecran: string) {
  const { large, fenetre } = await page.evaluate(() => ({ large: document.documentElement.scrollWidth, fenetre: innerWidth }));
  expect(large, `défilement horizontal : ${ecran}`).toBeLessThanOrEqual(fenetre);
  for (const b of await page.locator('.bubble p, .verdict').all()) {
    const { sw, cw } = await b.evaluate(e => ({ sw: e.scrollWidth, cw: e.clientWidth }));
    expect(sw, `texte coupé : ${ecran}`).toBeLessThanOrEqual(cw);
  }
}

/** Joue une pierre : à la souris, ou au doigt (avec la seconde touche si une pierre fantôme attend la confirmation). */
async function poser(page: Page, point: string, auDoigt: boolean) {
  if (!auDoigt) return jouer(page, point);
  await toucher(page, point);
  if (await fantome(page).count()) await toucher(page, point);
}

async function l39(page: Page, auDoigt: boolean, ecran: (n: string) => Promise<void>) {
  await page.addInitScript(p => localStorage.setItem('go.lecons.v1', JSON.stringify(p)), AVANT);
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
  // #652 : le sommaire d'Apprendre ; la carte de la prochaine leçon ouvre la leçon.
  await expect(page.getByRole('button', { name: `Leçon ${numero('l39')} : Les libertés communes, prochaine étape` })).toBeAttached();
  // Les leçons 37, 38 et 40 s'ouvrent depuis leur thème : src/app/themesApprendre.test.ts le vérifie pour chaque leçon.
  await sansDebordement(page, 'chemin');
  await page.locator('.cta-chemin').scrollIntoViewIfNeeded();
  await ecran('0-chemin');
  if (auDoigt) await page.locator('.cta-chemin').tap();
  else await page.locator('.cta-chemin').click();
  await expect(page.getByRole('heading', { name: 'Les libertés communes' })).toBeVisible();

  const zone = page.locator('.lecteur-plateau');
  const bulle = page.locator('.bubble p');
  const appuyer = (nom: string, n: string) => auDoigt ? toucherAction(page, nom, n) : page.getByRole('button', { name: nom, exact: true }).click();

  // 1. La liberté commune : l'élève touche E1.
  await expect(bulle).toHaveText(norm(etape<'info'>(0).text));
  await expect(zone).toHaveAttribute('data-demo', 'geste');
  await poser(page, 'E1', auDoigt);
  await expect(zone).toHaveAttribute('data-demo', 'finie');
  await ecran('1-commune');
  await appuyer('Continuer', 'étape 1');

  // 2. Le dehors d'abord : J2, Blanc A2, Noir E1 prend tout le groupe.
  await expect(bulle).toHaveText(norm(etape<'info'>(1).text));
  await expect(zone).toHaveAttribute('data-demo', 'geste');
  await poser(page, 'J2', auDoigt);
  await expect(zone).toHaveAttribute('data-demo', 'finie');
  await ecran('2-dehors');
  await appuyer('Continuer', 'étape 2');

  // 3. Quiz : E1 d'abord, qui gagne ? « Toi » est faux, « Blanc » est juste.
  const q3 = etape<'quiz'>(2);
  await expect(bulle).toHaveText(norm(q3.text));
  const choix = (n: string) => page.locator('.choix').getByRole('button', { name: n, exact: true });
  if (auDoigt) await choix('Toi').tap(); else await choix('Toi').click();
  await expect(choix('Toi')).toHaveClass(/choix-faux/);
  await expect(page.locator('.choix-aide')).toContainText(norm(q3.no));
  if (auDoigt) await choix('Blanc').tap(); else await choix('Blanc').click();
  await expect(page.locator('.verdict')).toContainText(norm(q3.ok));
  await ecran('3-quiz');
  await appuyer('Continuer', 'étape 3');

  // 4. Deux libertés dehors chacun : E1 est refusé (liberté commune), J1 gagne.
  const q4 = etape<'move'>(3);
  await expect(bulle).toHaveText(norm(q4.text));
  await poser(page, 'E1', auDoigt);
  await expect(page.locator('.verdict')).toContainText(norm(q4.refus![0].no));
  await poser(page, 'J1', auDoigt);
  await expect(page.locator('.verdict')).toContainText(norm(q4.ok));
  await ecran('4-deux-dehors');
  await appuyer('Continuer', 'étape 4');

  // 5. En miroir : E1 est refusé, A2 gagne.
  const q5 = etape<'move'>(4);
  await expect(bulle).toHaveText(norm(q5.text));
  await poser(page, 'E1', auDoigt);
  await expect(page.locator('.verdict')).toContainText(norm(q5.refus![0].no));
  await poser(page, 'A2', auDoigt);
  await expect(page.locator('.verdict')).toContainText(norm(q5.ok));
  await ecran('5-miroir');
  await appuyer('Terminer la leçon', 'étape 5');

  await expect(page.getByRole('heading', { name: 'Leçon terminée' })).toBeVisible();
  await expect(page.getByText(norm(ACQUIS.l39))).toBeVisible();
  await ecran('6-fin');
}

for (const [largeur, hauteur, theme] of [[390, 844, 'light'], [320, 568, 'dark']] as const) {
  test(`leçon 39, les libertés communes, jouée en entier à ${largeur} px (${theme === 'light' ? 'clair' : 'sombre'})`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: hauteur });
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme });
    await l39(page, false, async n => {
      await sansDebordement(page, n);
      if (DOSSIER) await page.screenshot({ path: `${DOSSIER}/l39-${largeur}-${n}.png` });
    });
  });
}

test('leçon 39 au zoom 200 %, polices bloquées : jouée au doigt, rien ne déborde, mots entiers', async ({ page }) => {
  await page.route(/\.(woff2?|ttf|otf)(\?|$)/, r => r.abort());
  await page.setViewportSize({ width: 195, height: 422 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await l39(page, true, async n => {
    await sansDebordement(page, `200 % ${n}`);
    if (await page.locator('.mochi-bulle p').count()) await motsEntiers(page, `200 % ${n}`);
  });
});
