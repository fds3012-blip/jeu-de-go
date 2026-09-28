import { expect, test, type Page } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jouer, plateau } from './plateau';

// Issue #287 : course aux problèmes, 3 minutes ou 3 erreurs. Horloge simulée (page.clock) : la course se joue
// en quelques secondes. Fin sur les erreurs, fin sur le temps, texte partagé vérifié, à 390 et 320 px.

// Bonne réponse de chaque problème, lue dans les sources (import.meta.glob n'existe pas côté Playwright).
const CONTENU = fileURLToPath(new URL('../src/content', import.meta.url));
const sources = [join(CONTENU, 'puzzles.ts'), ...readdirSync(join(CONTENU, 'lots')).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts')).map(f => join(CONTENU, 'lots', f))];
const REPONSES = new Map(sources.flatMap(f => [...readFileSync(f, 'utf8').matchAll(/id: ?'([^']+)', size: ?(\d+), difficulty: ?\d+, answers: ?\[([^\]]+)\]/g)]
  .map(m => [m[1], { taille: Number(m[2]), coups: [...m[3].matchAll(/'([A-T]\d+)'/g)].map(x => x[1]) }] as const)));

const MIDI_PARIS = new Date('2026-09-27T12:00:00+02:00');
const LETTRES = 'ABCDEFGHJKLMNOPQRST';

/** Copie du presse-papiers interceptée, et pas de feuille de partage native : on lit le texte copié. */
async function preparer(page: Page, meilleur?: number) {
  await page.addInitScript(m => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t: string) => { (window as unknown as { __copie: string }).__copie = t; } }, configurable: true });
    if (m !== null) localStorage.setItem('go.course-meilleur.v1', String(m));
  }, meilleur ?? null);
  await page.clock.install({ time: MIDI_PARIS });
}

async function ouvrirCourse(page: Page) {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Problèmes' }).click();
  // Carte secondaire : la seule action en relief reste le Go du jour (ou « Problème suivant »).
  const carte = page.locator('[data-course]');
  await expect(carte).toBeVisible();
  await expect(carte).not.toHaveClass(/\bcta\b/);
  await expect(page.locator('.problemes .cta')).toHaveCount(1);
  await carte.click();
  await expect(page.getByRole('heading', { name: /Course/ })).toBeVisible();
  await page.getByRole('button', { name: 'C’est parti' }).click();
  await expect(page.locator('.course-en-cours')).toBeVisible();
}

const course = (page: Page) => page.locator('.course-en-cours');

/** Id du problème affiché, une fois la marque du précédent partie. */
async function problemeAffiche(page: Page, precedent?: string | null): Promise<string> {
  if (precedent) await expect(course(page)).not.toHaveAttribute('data-probleme', precedent);
  const id = await course(page).getAttribute('data-probleme');
  expect(id).toBeTruthy();
  return id!;
}

async function reussir(page: Page, precedent?: string | null): Promise<string> {
  const id = await problemeAffiche(page, precedent);
  const r = REPONSES.get(id)!;
  await expect(plateau(page, r.taille)).toBeVisible();
  await jouer(page, r.coups[0], r.taille);
  return id;
}

/** Joue un coup faux : un coin vide qui n'est pas une réponse (un coup interdit ne compte pas : on essaie le suivant). */
async function rater(page: Page, precedent?: string | null): Promise<string> {
  const id = await problemeAffiche(page, precedent);
  const r = REPONSES.get(id)!;
  const n = r.taille;
  const avant = Number(await page.locator('.course-pastilles').getAttribute('data-erreurs'));
  const occupes = new Set(await course(page).locator('[data-pierre]').evaluateAll(els => els.map(e => e.getAttribute('data-point'))));
  const coins = [`A1`, `${LETTRES[n - 1]}1`, `A${n}`, `${LETTRES[n - 1]}${n}`, `B2`, `${LETTRES[n - 2]}2`, `B${n - 1}`, `${LETTRES[n - 2]}${n - 1}`];
  for (const c of coins.filter(c => !occupes.has(c) && !r.coups.includes(c))) {
    await jouer(page, c, n);
    if (Number(await page.locator('.course-pastilles').getAttribute('data-erreurs')) > avant || await page.locator('.course-fin').isVisible()) return id;
  }
  throw new Error(`Aucun coup faux trouvé pour ${id}`);
}

async function sansDefilementHorizontal(page: Page) {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(sw).toBeLessThanOrEqual(cw);
}

for (const largeur of [390, 320]) {
  test(`${largeur} px : 2 justes puis 3 erreurs, la course s’arrête ; meilleur score, partage, Rejouer`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: largeur === 390 ? 844 : 640 });
    await preparer(page);
    await ouvrirCourse(page);
    await expect(page.locator('.course-temps')).toHaveText('3:00');
    await expect(page.locator('.course-pastilles')).toHaveAttribute('aria-label', '0 erreur sur 3');
    await sansDefilementHorizontal(page);

    let id = await reussir(page);
    await expect(page.locator('.course-score-chiffre')).toHaveText('1');
    id = await reussir(page, id);
    await expect(page.locator('.course-score-chiffre')).toHaveText('2');
    id = await rater(page, id);
    await expect(page.locator('.course-pastilles')).toHaveAttribute('aria-label', '1 erreur sur 3');
    await expect(page.locator('.course-pastilles .pleine')).toHaveCount(1);
    id = await rater(page, id);
    await expect(page.locator('.course-pastilles .pleine')).toHaveCount(2);
    await rater(page, id);

    // Fin : la raison, le score, nouveau meilleur score gardé sur l'appareil.
    const fin = page.locator('.course-fin');
    await expect(fin).toBeVisible();
    await expect(fin).toHaveAttribute('data-raison', 'erreurs');
    await expect(fin.locator('.course-resultat-chiffre')).toHaveText('2');
    await expect(fin).toContainText('problèmes résolus');
    await expect(fin.locator('.course-nouveau')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('go.course-meilleur.v1'))).toBe('2');
    // Rejouer en action principale (la seule en relief), Partager en action secondaire.
    await expect(fin.locator('.cta')).toHaveCount(1);
    await expect(fin.locator('.cta')).toHaveText('Rejouer');
    await sansDefilementHorizontal(page);
    for (const b of await fin.getByRole('button').all()) {
      const box = (await b.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
    }

    await fin.getByRole('button', { name: 'Partager' }).click();
    await expect(fin.getByRole('button', { name: 'Copié !' })).toBeVisible();
    const copie = await page.evaluate(() => (window as unknown as { __copie: string }).__copie);
    expect(copie).toBe('Course de go : 2 problèmes en 3 min · meilleur 2\nhttps://jeu-de-go.vercel.app/');

    // Rejouer relance une course neuve.
    await fin.getByRole('button', { name: 'Rejouer' }).click();
    await expect(course(page)).toBeVisible();
    await expect(page.locator('.course-score-chiffre')).toHaveText('0');
    await expect(page.locator('.course-pastilles .pleine')).toHaveCount(0);
    await expect(page.locator('.course-temps')).toHaveText('3:00');

    // Le meilleur score s'affiche sur la carte, sans aucun total de problèmes.
    await page.getByRole('button', { name: 'Quitter la course' }).click();
    await expect(page.locator('[data-course]')).toContainText('Ton meilleur');
    await expect(page.getByText(/\d+\s\/\s\d+/)).toHaveCount(0);
  });
}

test('fin sur le temps : annonces toutes les 30 s, puis écran de fin et partage avec le meilleur score', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await preparer(page, 17);
  await ouvrirCourse(page);
  const annonce = page.locator('[data-annonce-temps]');
  await expect(annonce).toHaveText('');

  await reussir(page);
  await expect(page.locator('.course-score-chiffre')).toHaveText('1');
  // Mouvements réduits : aucune animation du minuteur, ni de la barre, ni du score.
  const anim = await page.evaluate(() => {
    const s = (sel: string) => getComputedStyle(document.querySelector(sel)!);
    return { barre: s('.course-barre span').transitionDuration, score: s('.course-score-chiffre').animationName };
  });
  expect(anim.barre).toBe('0s');
  expect(anim.score).toBe('none');

  await page.clock.runFor(30_000);
  await expect(annonce).toHaveText('Il reste 2 min 30 s.');
  await expect(page.locator('.course-temps')).toHaveText(/^2:[23]\d$/);
  await page.clock.runFor(30_000);
  await expect(annonce).toHaveText('Il reste 2 minutes.');
  await page.clock.runFor(90_000);
  await expect(annonce).toHaveText('Il reste 30 secondes.');
  await expect(page.locator('.course-chrono')).not.toHaveClass(/urgent/);
  await page.clock.runFor(21_000);
  // Les 10 dernières secondes : le minuteur passe en hanko (couleur seulement, sans clignoter).
  await expect(page.locator('.course-chrono')).toHaveClass(/urgent/);
  await page.clock.runFor(10_000);

  const fin = page.locator('.course-fin');
  await expect(fin).toBeVisible();
  await expect(fin).toHaveAttribute('data-raison', 'temps');
  await expect(fin.getByRole('heading', { name: /Temps écoulé/ })).toBeVisible();
  await expect(fin.locator('.course-resultat-chiffre')).toHaveText('1');
  await expect(fin).toContainText('problème résolu');
  await expect(fin.locator('[data-meilleur]')).toContainText('17');
  expect(await page.evaluate(() => localStorage.getItem('go.course-meilleur.v1'))).toBe('17');

  await fin.getByRole('button', { name: 'Partager' }).click();
  const copie = await page.evaluate(() => (window as unknown as { __copie: string }).__copie);
  expect(copie).toBe('Course de go : 1 problème en 3 min · meilleur 17\nhttps://jeu-de-go.vercel.app/');
  // Sans spoiler : aucune coordonnée de coup.
  expect(copie.split('\n')[0]).not.toMatch(/\b[A-HJ-T]1?\d\b/);
});
