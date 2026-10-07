import { expect, test, type Page } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jouer, plateau } from './plateau';
import { THEME_DU_PROBLEME } from '../src/content/themes';

// Issue #471 : problèmes par thème. Les séries assez fournies sont des vignettes à plat (le Go du jour reste la seule
// action en relief) ; une série ouverte enchaîne ses problèmes, compte les réussites d'affilée et garde un record.

// Bonne réponse de chaque problème, lue dans les sources (import.meta.glob n'existe pas côté Playwright).
const CONTENU = fileURLToPath(new URL('../src/content', import.meta.url));
const sources = [join(CONTENU, 'puzzles.ts'), ...readdirSync(join(CONTENU, 'lots')).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts')).map(f => join(CONTENU, 'lots', f))];
const REPONSES = new Map(sources.flatMap(f => [...readFileSync(f, 'utf8').matchAll(/id: ?'([^']+)', size: ?(\d+), difficulty: ?\d+, answers: ?\[([^\]]+)\]/g)]
  .map(m => [m[1], { taille: Number(m[2]), coups: [...m[3].matchAll(/'([A-T]\d+)'/g)].map(x => x[1]) }] as const)));

const MIDI_PARIS = new Date('2026-09-27T12:00:00+02:00');
const LETTRES = 'ABCDEFGHJKLMNOPQRST';
const lecteur = (page: Page) => page.locator('.lecteur');
const affilee = (page: Page) => page.locator('.lecteur .theme-affilee');

async function ouvrirProblemes(page: Page) {
  await page.clock.setFixedTime(MIDI_PARIS);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Problèmes' }).click();
  await expect(page.locator('.themes')).toBeVisible();
}

/** Coup faux : un coin vide qui n'est pas une réponse (un coup interdit ne compte pas : on essaie le suivant). */
async function rater(page: Page, id: string) {
  const r = REPONSES.get(id)!;
  const n = r.taille;
  const occupes = new Set(await lecteur(page).locator('[data-pierre]').evaluateAll(els => els.map(e => e.getAttribute('data-point'))));
  const coins = ['A1', `${LETTRES[n - 1]}1`, `A${n}`, `${LETTRES[n - 1]}${n}`, 'B2', `${LETTRES[n - 2]}2`, `B${n - 1}`, `${LETTRES[n - 2]}${n - 1}`];
  for (const c of coins.filter(c => !occupes.has(c) && !r.coups.includes(c))) {
    await jouer(page, c, n);
    // Un coup faux (légal) montre « rejoue sur le plateau » ; un coup interdit, non.
    if (await page.locator('.rejoue-plateau').count()) return;
  }
  throw new Error(`Aucun coup faux trouvé pour ${id}`);
}

test('séries par thème : vignettes à plat, réussites d’affilée et record', async ({ page }) => {
  await ouvrirProblemes(page);

  // Cinq séries ; la fin de partie (6 problèmes) attend d'en avoir assez. Le Go du jour reste la seule action en relief.
  const cartes = page.locator('.theme-carte');
  await expect(cartes).toHaveCount(5);
  for (const nom of ['Capturer', 'Sauver', 'Vie et mort', 'Relier et couper', 'Tesuji']) {
    await expect(page.getByRole('button', { name: new RegExp(`^${nom}`) })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: /^Fin de partie/ })).toHaveCount(0);
  await expect(page.locator('.problemes .cta')).toHaveCount(1);
  for (const box of await cartes.evaluateAll(els => els.map(e => e.getBoundingClientRect().height))) expect(box).toBeGreaterThanOrEqual(44);
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(sw).toBeLessThanOrEqual(cw);

  // Capturer : le premier problème est de la série, le compteur part de 0.
  await page.getByRole('button', { name: /^Capturer/ }).click();
  await expect(lecteur(page).locator('.lecteur-nom small')).toContainText('Capturer');
  await expect(affilee(page)).toHaveText(/^0 d’affilée/);
  const premier = (await lecteur(page).getAttribute('data-probleme'))!;
  expect(['capture', 'bord', 'atari']).toContain(THEME_DU_PROBLEME[premier]);

  // Réussi du premier coup : 1 d'affilée.
  const r = REPONSES.get(premier)!;
  await expect(plateau(page, r.taille)).toBeVisible();
  await jouer(page, r.coups[0], r.taille);
  await expect(affilee(page)).toHaveText(/^1 d’affilée/);
  await expect(page.locator('.verdict')).not.toContainText(/cote/i);

  // Le suivant reste dans la série ; raté au premier essai, le compteur revient à 0.
  await page.locator('.verdict').getByRole('button', { name: 'Problème suivant' }).click();
  await expect(lecteur(page)).not.toHaveAttribute('data-probleme', premier);
  const second = (await lecteur(page).getAttribute('data-probleme'))!;
  expect(['capture', 'bord', 'atari']).toContain(THEME_DU_PROBLEME[second]);
  await expect(affilee(page)).toHaveText(/^1 d’affilée/);
  await expect(plateau(page, REPONSES.get(second)!.taille)).toBeVisible();
  await rater(page, second);
  await expect(affilee(page)).toHaveText(/^0 d’affilée/);

  // Retour à la liste : la vignette garde le record, sur l'appareil (clé citée dans la politique de confidentialité).
  await page.getByRole('button', { name: 'Retour aux problèmes' }).first().click();
  await expect(page.getByRole('button', { name: /^Capturer/ })).toContainText('Record : 1');
  await expect(page.getByRole('button', { name: /^Sauver/ })).not.toContainText('Record');
  const etat = await page.evaluate(() => JSON.parse(localStorage.getItem('go.series-themes.v1') ?? 'null'));
  expect(etat).toEqual({ capturer: { affilee: 0, record: 1 } });
});

test('nouveau record : la pastille le dit', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('go.series-themes.v1', JSON.stringify({ tesuji: { affilee: 2, record: 2 } })));
  await ouvrirProblemes(page);
  await expect(page.getByRole('button', { name: /^Tesuji/ })).toContainText('Record : 2');
  await page.getByRole('button', { name: /^Tesuji/ }).click();
  await expect(affilee(page)).toHaveText(/^2 d’affilée/);
  const id = (await lecteur(page).getAttribute('data-probleme'))!;
  expect(['double-atari', 'echelle', 'filet', 'prise-en-retour']).toContain(THEME_DU_PROBLEME[id]);
  const r = REPONSES.get(id)!;
  await expect(plateau(page, r.taille)).toBeVisible();
  await jouer(page, r.coups[0], r.taille);
  await expect(affilee(page)).toHaveText(/3 d’affilée\s*Record\u202F!/);
  await expect(affilee(page)).toHaveClass(/record/);
});

// Captures de revue (390 × 844, sombre et clair), hors CI : CAPTURES=dossier npx playwright test problemes-par-theme.
test('captures de revue', async ({ page }) => {
  test.skip(!process.env.CAPTURES, 'seulement à la demande');
  for (const theme of ['dark', 'light'] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await page.addInitScript(() => localStorage.setItem('go.series-themes.v1', JSON.stringify({ capturer: { affilee: 1, record: 4 }, 'vie-mort': { affilee: 0, record: 2 } })));
    await ouvrirProblemes(page);
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.locator('.themes').scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(process.env.CAPTURES!, `themes-liste-${theme}.png`) });
    await page.getByRole('button', { name: /^Capturer/ }).click();
    await page.screenshot({ path: join(process.env.CAPTURES!, `themes-lecteur-${theme}.png`) });
  }
});
