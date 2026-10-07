import { expect, test, type Page } from '@playwright/test';
import { fantome, jouer, toucher } from './plateau';
import { motsEntiers, toucherAction } from './lecteur';
import { LESSONS_FR, type LessonStep } from '../src/content/lessons';
import { ACQUIS } from '../src/content/acquis';

// Issue #16 (leçons 32 et suivantes) : fin de partie et tesuji, sur le chemin Apprendre, sans changer l'écran.
// La leçon 34 (relier par en dessous, le watari) se joue du début à la fin, avec un coup refusé à chaque exercice :
// 390 px en clair, 320 px en sombre, puis au zoom 200 % (195 px, polices bloquées) entièrement au doigt.
// Positions et réponses prouvées par src/go/lecons-32-plus.test.ts. Captures : seulement si CAPTURES_LECONS_32 donne
// un dossier (aucune capture versionnée).

const norm = (s: string) => s.replace(/[\u00A0\u202F\s]+/g, ' ').trim();
const DOSSIER = process.env.CAPTURES_LECONS_32;
const L34 = LESSONS_FR.find(l => l.id === 'l34')!;
const etape = <K extends LessonStep['kind']>(i: number) => L34.steps[i] as Extract<LessonStep, { kind: K }>;
const numero = (id: string) => LESSONS_FR.findIndex(l => l.id === id) + 1;
const AVANT = Object.fromEntries(LESSONS_FR.slice(0, LESSONS_FR.indexOf(L34)).map(l => [l.id, l.steps.length]));

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

async function l34(page: Page, auDoigt: boolean, ecran: (n: string) => Promise<void>) {
  await page.addInitScript(p => localStorage.setItem('go.lecons.v1', JSON.stringify(p)), AVANT);
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
  // Le chemin : la valeur d'un coup et le sente avant le gote ferment « Fin de partie », le watari suit le manque de libertés.
  await expect(page.getByRole('button', { name: `Leçon ${numero('l32')} : La valeur d’un coup, terminée` })).toBeAttached();
  await expect(page.getByRole('button', { name: `Leçon ${numero('l33')} : Le sente avant le gote, terminée` })).toBeAttached();
  await expect(page.getByRole('button', { name: `Leçon ${numero('l34')} : Relier par en dessous, prochaine étape` })).toBeAttached();
  await sansDebordement(page, 'chemin');
  await page.locator('.cta-chemin').scrollIntoViewIfNeeded();
  await ecran('0-chemin');
  if (auDoigt) await page.locator('.cta-chemin').tap();
  else await page.locator('.cta-chemin').click();
  await expect(page.getByRole('heading', { name: 'Relier par en dessous' })).toBeVisible();

  const zone = page.locator('.lecteur-plateau');
  const bulle = page.locator('.bubble p');
  const appuyer = (nom: string, n: string) => auDoigt ? toucherAction(page, nom, n) : page.getByRole('button', { name: nom, exact: true }).click();

  // 1. Le watari : Noir glisse en E1, sous la pierre blanche.
  await expect(bulle).toHaveText(norm(etape<'info'>(0).text));
  await expect(zone).toHaveAttribute('data-demo', 'geste');
  await poser(page, 'E1', auDoigt);
  await expect(zone).toHaveAttribute('data-demo', 'finie');
  await ecran('1-watari');
  await appuyer('Continuer', 'étape 1');

  // 2. Blanc coupe en D1 : D2 le met en atari.
  await expect(bulle).toHaveText(norm(etape<'info'>(1).text));
  await expect(zone).toHaveAttribute('data-demo', 'geste');
  await poser(page, 'D2', auDoigt);
  await expect(zone).toHaveAttribute('data-demo', 'finie');
  await ecran('2-coupe-d1');
  await appuyer('Continuer', 'étape 2');

  // 3. Blanc coupe en D2 : C1 est refusé (Blanc joue D1), D1 relie.
  const q3 = etape<'move'>(2);
  await expect(bulle).toHaveText(norm(q3.text));
  await poser(page, 'C1', auDoigt);
  await expect(page.locator('.verdict')).toContainText(norm(q3.refus![0].no));
  await poser(page, 'D1', auDoigt);
  await expect(page.locator('.verdict')).toContainText(norm(q3.ok));
  await ecran('3-coupe-d2');
  await appuyer('Continuer', 'étape 3');

  // 4. À toi, en miroir : F2 est refusé (Blanc bloque en E1), E1 relie.
  const q4 = etape<'move'>(3);
  await expect(bulle).toHaveText(norm(q4.text));
  await poser(page, 'F2', auDoigt);
  await expect(page.locator('.verdict')).toContainText(norm(q4.refus![0].no));
  await poser(page, 'E1', auDoigt);
  await expect(page.locator('.verdict')).toContainText(norm(q4.ok));
  await ecran('4-a-toi');
  await appuyer('Terminer la leçon', 'étape 4');

  await expect(page.getByRole('heading', { name: 'Leçon terminée' })).toBeVisible();
  await expect(page.getByText(norm(ACQUIS.l34))).toBeVisible();
  await ecran('5-fin');
}

for (const [largeur, hauteur, theme] of [[390, 844, 'light'], [320, 568, 'dark']] as const) {
  test(`leçon 34, relier par en dessous, jouée en entier à ${largeur} px (${theme === 'light' ? 'clair' : 'sombre'})`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: hauteur });
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme });
    await l34(page, false, async n => {
      await sansDebordement(page, n);
      if (DOSSIER && largeur === 390 && ['1-watari', '3-coupe-d2'].includes(n)) await page.screenshot({ path: `${DOSSIER}/l34-${largeur}-${n}.png` });
    });
  });
}

test('leçon 34 au zoom 200 %, polices bloquées : jouée au doigt, rien ne déborde, mots entiers', async ({ page }) => {
  await page.route(/\.(woff2?|ttf|otf)(\?|$)/, r => r.abort());
  await page.setViewportSize({ width: 195, height: 422 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await l34(page, true, async n => {
    await sansDebordement(page, `200 % ${n}`);
    if (await page.locator('.mochi-bulle p').count()) await motsEntiers(page, `200 % ${n}`);
    if (DOSSIER && n === '3-coupe-d2') await page.screenshot({ path: `${DOSSIER}/l34-195-${n}.png` });
  });
});
