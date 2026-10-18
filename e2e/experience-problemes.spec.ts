import { expect, test, type Page } from '@playwright/test';
import { ouvrirParTheme, ouvrirTous } from './problemes';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { attendrePierre, jouer, plateau } from './plateau';
import { THEME_DU_PROBLEME } from '../src/content/themes';

// Issue #549 : les problèmes deviennent un entraînement. Un coup faux reçoit une réponse prouvée et sa phrase de faits ;
// la solution complète se lit coup par coup ; une série par thème se maîtrise, puis « Thème suivant ».

const CONTENU = fileURLToPath(new URL('../src/content', import.meta.url));
const sources = [join(CONTENU, 'puzzles.ts'), ...readdirSync(join(CONTENU, 'lots')).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts')).map(f => join(CONTENU, 'lots', f))];
const REPONSES = new Map(sources.flatMap(f => [...readFileSync(f, 'utf8').matchAll(/id: ?'([^']+)', size: ?(\d+), difficulty: ?\d+, answers: ?\[([^\]]+)\]/g)]
  .map(m => [m[1], { taille: Number(m[2]), coups: [...m[3].matchAll(/'([A-T]\d+)'/g)].map(x => x[1]) }] as const)));
const MIDI_PARIS = new Date('2026-09-27T12:00:00+02:00');

async function ouvrirProblemes(page: Page) {
  await page.clock.setFixedTime(MIDI_PARIS);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Problèmes' }).click();
  await expect(page.getByTestId('problemes-sommaire')).toBeVisible();
}

test('coup faux : la réponse prouvée de Blanc est jouée et dite ; puis la solution complète, coup par coup', async ({ page }) => {
  await ouvrirProblemes(page);
  await ouvrirTous(page);
  await page.getByRole('button', { name: /^Problème \d+ : Deux chemins dans le coin/ }).click();
  await expect(plateau(page)).toBeVisible();

  // Coup loin de tout : le verdict reste, et la phrase de faits nomme la réponse de Blanc, posée sur le plateau.
  await jouer(page, 'J9');
  const comprise = page.locator('.verdict [data-erreur-comprise]');
  await expect(comprise).toContainText(/^Blanc (répond|se relie|prend) .*en [A-J]\d/);
  const point = (await comprise.textContent())!.match(/en ([A-J]\d)/)![1];
  await attendrePierre(page, point, 'blanc');

  // L'aide graduée mène à la réponse : la solution complète s'ouvre au premier coup.
  await page.getByRole('button', { name: 'Voir un indice' }).click();
  await jouer(page, 'J8');
  await page.getByRole('button', { name: 'Voir pourquoi' }).click();
  await expect(page.locator('.verdict [data-erreur-comprise]')).toContainText(/^Blanc/);
  await page.getByRole('button', { name: 'Voir la réponse' }).click();
  const etape = page.locator('.verdict .solution-etape');
  await expect(etape).toHaveText('Coup 1 sur 3');
  await expect(page.locator('[data-solution-legende]')).toContainText('Noir joue A2');
  await attendrePierre(page, 'A2', 'noir');
  const precedent = page.getByRole('button', { name: 'Coup précédent' });
  const suivant = page.getByRole('button', { name: 'Coup suivant' });
  await expect(precedent).toBeDisabled();
  for (const b of [precedent, suivant]) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);

  // Coup 2 : la défense principale de Blanc ; coup 3 : la prise.
  await suivant.click();
  await expect(etape).toHaveText('Coup 2 sur 3');
  await expect(page.locator('[data-solution-legende]')).toContainText('Blanc se défend en B1');
  await suivant.click();
  await expect(etape).toHaveText('Coup 3 sur 3');
  await expect(page.locator('[data-solution-legende]')).toContainText(/Noir prend 2 pierres en A1/);
  await attendrePierre(page, 'B2', null);
  await expect(suivant).toBeDisabled();
  await expect(page.locator('[data-pourquoi-probleme]')).toContainText('A2');
  // Retour en arrière, puis rejouer sur le plateau : toucher la pierre montrée remet la position, puis le coup compte.
  await precedent.click();
  await expect(etape).toHaveText('Coup 2 sur 3');
  await jouer(page, 'A2');
  await attendrePierre(page, 'B1', null);
  await jouer(page, 'A2');
  await expect(page.locator('[data-vu]')).toBeVisible();
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(sw).toBeLessThanOrEqual(cw);
});

test('maîtrise par thème : la barre se remplit, « Thème suivant » à la maîtrise', async ({ page }) => {
  // Cinq problèmes de capture déjà réussis sur l'appareil : il en manque un pour maîtriser « Capturer ».
  const capture = Object.entries(THEME_DU_PROBLEME).filter(([, t]) => t === 'capture').map(([id]) => id);
  await page.addInitScript(ids => {
    if (!localStorage.getItem('e2e.seme')) {
      localStorage.setItem('go.problemes.v1', JSON.stringify(Object.fromEntries(ids.map(id => [id, true]))));
      localStorage.setItem('e2e.seme', '1');
    }
  }, capture.slice(0, 5));
  await ouvrirProblemes(page);
  await ouvrirParTheme(page);

  const carte = page.locator('.theme-carte[data-theme="capturer"]');
  await expect(carte.locator('.theme-maitrise')).toHaveAttribute('aria-label', /^5 problèmes réussis sur 6/);
  await expect(page.locator('.theme-carte[data-theme="sauver"] .theme-maitrise')).toHaveAttribute('aria-label', /^0 problème réussi sur 6/);
  await expect(page.locator('.problemes .cta')).toHaveCount(1);

  await carte.click();
  const id = (await page.locator('.lecteur').getAttribute('data-probleme'))!;
  const r = REPONSES.get(id)!;
  await expect(plateau(page, r.taille)).toBeVisible();
  await jouer(page, r.coups[0], r.taille);

  // Maîtrisé : une ligne de fête, « Thème suivant » en relief, « Rester sur Capturer » en lien.
  await expect(page.locator('.theme-maitrise-fete')).toHaveText('Capturer : thème maîtrisé !');
  const versSuivant = page.locator('.verdict').getByRole('button', { name: 'Thème suivant : Sauver' });
  await expect(versSuivant).toHaveClass(/\bcta\b/);
  await expect(page.locator('.verdict .cta')).toHaveCount(1);
  await expect(page.locator('.verdict').getByRole('button', { name: 'Rester sur Capturer' })).toBeVisible();
  await versSuivant.click();
  await expect(page.locator('.lecteur .lecteur-nom small').first()).toContainText('Sauver');

  // De retour sur la liste : « Capturer » est maîtrisé.
  await page.getByRole('button', { name: 'Retour' }).first().click();
  await expect(carte.locator('[data-maitrise]')).toHaveText('Maîtrisé');
});
