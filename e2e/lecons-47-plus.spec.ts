import { expect, test } from '@playwright/test';
import { jouer, plateau } from './plateau';
import { LESSONS_FR, type LessonStep } from '../src/content/lessons';
import { ACQUIS } from '../src/content/acquis';

// Issue #553 (l'ouverture prouvée par KataGo) : la leçon 48, couper et relier, ouverte depuis le chemin Apprendre et
// jouée jusqu'au bout à 390 px, en 13 × 13 cadré : le point de coupe pris, un refus réfuté (« Blanc coupe en L5 »), puis
// les rôles inversés (couper), un refus réfuté (« Blanc joue en L5 »). Jugements : src/go/lecons-47-plus.test.ts.

const norm = (s: string) => s.replace(/[  \s]+/g, ' ').trim();
const L48 = LESSONS_FR.find(l => l.id === 'l48')!;
const etape = <K extends LessonStep['kind']>(i: number) => L48.steps[i] as Extract<LessonStep, { kind: K }>;
const numero = (id: string) => LESSONS_FR.findIndex(l => l.id === id) + 1;
const AVANT = Object.fromEntries(LESSONS_FR.slice(0, LESSONS_FR.indexOf(L48)).map(l => [l.id, l.steps.length]));

test('leçon 48, couper et relier, ouverte depuis le chemin et jouée en entier', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(p => localStorage.setItem('go.lecons.v1', JSON.stringify(p)), AVANT);
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
  await expect(page.getByRole('button', { name: `Leçon ${numero('l48')} : Couper et relier, 13 × 13, prochaine étape` })).toBeAttached();
  await page.locator('.cta-chemin').click();
  await expect(page.getByRole('heading', { name: 'Couper et relier' })).toBeVisible();
  await expect(plateau(page, 13)).toHaveAttribute('data-fenetre');

  const zone = page.locator('.lecteur-plateau');
  const bulle = page.locator('.bubble p');
  const verdict = page.locator('.verdict');
  const continuer = (nom = 'Continuer') => page.getByRole('button', { name: nom, exact: true }).click();
  const geste = async (i: number) => {
    const s = etape<'info'>(i);
    await expect(bulle).toHaveText(norm(s.text));
    await expect(zone).toHaveAttribute('data-demo', 'geste');
    await jouer(page, (s.geste as { pose: string }).pose, 13);
    await expect(zone).toHaveAttribute('data-demo', 'finie');
    await continuer();
  };
  const exercice = async (i: number, refus: string) => {
    const m = etape<'move'>(i);
    await expect(bulle).toHaveText(norm(m.text));
    await jouer(page, refus, 13);
    await expect(verdict).toContainText(norm(m.refus![0].no));
    await jouer(page, (m.accept as string[])[0], 13);
    await expect(verdict).toContainText(norm(m.ok));
  };

  // 1. Blanc vise C5 : l'élève le prend.
  await geste(0);
  // 2. En miroir : K4 laisse couper (réfuté), L5 prend le point de coupe.
  await exercice(1, 'K4');
  await continuer();
  // 3. Couleurs inversées : l'élève coupe en C5.
  await geste(2);
  // 4. En miroir : J6 laisse passer la coupe (réfuté), L5 coupe.
  await exercice(3, 'J6');
  await continuer('Terminer la leçon');

  await expect(page.getByRole('heading', { name: 'Leçon terminée' })).toBeVisible();
  await expect(page.getByText(norm(ACQUIS.l48))).toBeVisible();
});
