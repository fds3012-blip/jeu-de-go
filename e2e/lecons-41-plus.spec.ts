import { expect, test } from '@playwright/test';
import { jouer } from './plateau';
import { LESSONS_FR, type LessonStep } from '../src/content/lessons';
import { ACQUIS } from '../src/content/acquis';

// Issue #547 (leçons 41 et suivantes) : la leçon 45, les menaces de ko, ouverte depuis le chemin Apprendre et jouée
// jusqu'au bout à 390 px : la prise blanche, la menace posée, un mauvais choix au quiz, la reprise immédiate refusée,
// la menace trouvée, le ko fermé. Positions et réponses prouvées par src/go/lecons-41-plus.test.ts.

const norm = (s: string) => s.replace(/[\u00A0\u202F\s]+/g, ' ').replace(/(?<=\p{L})'(?=\p{L})/gu, '’').trim();
const L45 = LESSONS_FR.find(l => l.id === 'l45')!;
const etape = <K extends LessonStep['kind']>(i: number) => L45.steps[i] as Extract<LessonStep, { kind: K }>;
const numero = (id: string) => LESSONS_FR.findIndex(l => l.id === id) + 1;
const AVANT = Object.fromEntries(LESSONS_FR.slice(0, LESSONS_FR.indexOf(L45)).map(l => [l.id, l.steps.length]));

test('leçon 45, les menaces de ko, ouverte depuis le chemin et jouée en entier', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(p => localStorage.setItem('go.lecons.v1', JSON.stringify(p)), AVANT);
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
  await expect(page.getByRole('button', { name: `Leçon ${numero('l45')} : Les menaces de ko, prochaine étape` })).toBeAttached();
  await page.locator('.cta-chemin').click();
  await expect(page.getByRole('heading', { name: 'Les menaces de ko' })).toBeVisible();

  const zone = page.locator('.lecteur-plateau');
  const bulle = page.locator('.bubble p');
  const verdict = page.locator('.verdict');
  const continuer = (nom = 'Continuer') => page.getByRole('button', { name: nom, exact: true }).click();

  // 1. Blanc prend le ko : la démonstration se regarde.
  await expect(bulle).toHaveText(norm(etape<'info'>(0).text));
  await expect(zone).toHaveAttribute('data-demo', 'finie');
  await continuer();

  // 2. La menace : l'élève pose C1 ; Blanc relie, Noir reprend.
  await expect(bulle).toHaveText(norm(etape<'info'>(1).text));
  await expect(zone).toHaveAttribute('data-demo', 'geste');
  await jouer(page, 'C1');
  await expect(zone).toHaveAttribute('data-demo', 'finie');
  await continuer();

  // 3. Quiz : « Il ne perd rien » est faux.
  const q = etape<'quiz'>(2);
  await expect(bulle).toHaveText(norm(q.text));
  const choix = (n: string) => page.locator('.choix').getByRole('button', { name: n, exact: true });
  await choix(q.choices[1]).click();
  await expect(choix(q.choices[1])).toHaveClass(/choix-faux/);
  await choix(q.choices[0]).click();
  await expect(verdict).toContainText(norm(q.ok));
  await continuer();

  // 4. En miroir : reprendre en E5 est refusé, G1 est la menace.
  const m = etape<'move'>(3);
  await expect(bulle).toHaveText(norm(m.text));
  await jouer(page, 'E5');
  await expect(verdict).toContainText(norm(m.refus![0].no));
  await jouer(page, 'G1');
  await expect(verdict).toContainText(norm(m.ok));
  await continuer();

  // 5. Fermer le ko.
  const f = etape<'move'>(4);
  await expect(bulle).toHaveText(norm(f.text));
  await jouer(page, 'D5');
  await expect(verdict).toContainText(norm(f.ok));
  await continuer('Terminer la leçon');

  await expect(page.getByRole('heading', { name: 'Leçon terminée' })).toBeVisible();
  await expect(page.getByText(norm(ACQUIS.l45))).toBeVisible();
});
