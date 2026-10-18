import { expect, test, type Page } from '@playwright/test';
import { ouvrirNiveauBadges } from './profil';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { attendrePierre, jouer, jouerSuite, partieADeux, passer, plateau } from './plateau';

// Issue #529 : chaque effort compte. La course rapporte de l'XP une fois par jour, une partie terminée fait vivre la
// série, les badges passent à 21 (vitrine repliée), et le niveau 10 débloque le goban « Cerisier ».

const CONTENU = fileURLToPath(new URL('../src/content', import.meta.url));
const sources = [join(CONTENU, 'puzzles.ts'), ...readdirSync(join(CONTENU, 'lots')).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts')).map(f => join(CONTENU, 'lots', f))];
const REPONSES = new Map(sources.flatMap(f => [...readFileSync(f, 'utf8').matchAll(/id: ?'([^']+)', size: ?(\d+), difficulty: ?\d+, answers: ?\[([^\]]+)\]/g)]
  .map(m => [m[1], { taille: Number(m[2]), coups: [...m[3].matchAll(/'([A-T]\d+)'/g)].map(x => x[1]) }] as const)));
const LETTRES = 'ABCDEFGHJKLMNOPQRST';
const MIDI_PARIS = new Date('2026-10-13T12:00:00+02:00');
/** seuil(10) dans src/app/xp.ts : 2 575 XP. */
const XP_NIVEAU_10 = 2575;

const lireNombre = (page: Page, cle: string) => page.evaluate(k => Number(JSON.parse(localStorage.getItem(k) ?? '0')), cle);
const course = (page: Page) => page.locator('.course-en-cours');

async function problemeAffiche(page: Page, precedent?: string | null): Promise<string> {
  if (precedent) await expect(course(page)).not.toHaveAttribute('data-probleme', precedent);
  const id = await course(page).getAttribute('data-probleme');
  expect(id).toBeTruthy();
  return id!;
}

async function reussir(page: Page): Promise<string> {
  const id = await problemeAffiche(page);
  const r = REPONSES.get(id)!;
  await expect(plateau(page, r.taille)).toBeVisible();
  await jouer(page, r.coups[0], r.taille);
  return id;
}

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

async function troisErreurs(page: Page, precedent: string | null) {
  let id = precedent;
  for (let i = 0; i < 3; i++) id = await rater(page, id);
  await expect(page.locator('.course-fin')).toBeVisible();
}

test('course : la première course du jour avec un problème juste rapporte +15 XP, la suivante rien (#529)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install({ time: MIDI_PARIS });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Problèmes' }).click();
  await page.locator('[data-course]').click();
  await page.getByRole('button', { name: 'C’est parti' }).click();
  await expect(course(page)).toBeVisible();

  const id = await reussir(page);
  await troisErreurs(page, id);
  const xp = page.locator('.course-xp');
  await expect(xp.getByTestId('pastille-xp')).toContainText(/\+15\sXP/);
  // Pas de bonus « première fois » sur la course : il reste au premier vrai problème.
  await expect(xp).not.toContainText('première fois');
  expect(await lireNombre(page, 'go.xp.v1')).toBe(15);
  expect(await lireNombre(page, 'go.course-xp.v1')).toBeGreaterThan(0);
  // Une seule pastille : la flottante ne répète pas celle de l'écran.
  await expect(page.getByTestId('pastille-xp')).toHaveCount(1);

  // Deuxième course du jour : le score, le record, rien sur l'XP (ni reproche ni minuteur).
  await page.getByRole('button', { name: 'Rejouer' }).click();
  const id2 = await reussir(page);
  await troisErreurs(page, id2);
  await expect(xp.getByTestId('pastille-xp')).toHaveCount(0);
  await expect(page.locator('.course-fin')).not.toContainText(/demain|XP/);
  expect(await lireNombre(page, 'go.xp.v1')).toBe(15);
});

test('partie : une partie terminée de plus de 10 coups fait vivre la série du jour (#529)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await partieADeux(page);
  expect(await page.evaluate(() => localStorage.getItem('go.go-du-jour.v1'))).toBeNull();
  await jouerSuite(page, ['C3', 'G7', 'C4', 'G6', 'C5', 'G5', 'C6', 'G4', 'C7', 'G3', 'D3', 'F7']);
  await passer(page);
  await passer(page);
  await page.getByRole('button', { name: 'Valider le score' }).click();
  await expect.poll(() => lireNombre(page, 'go.xp.v1'), { timeout: 15_000 }).toBeGreaterThanOrEqual(15);
  const serie = await page.evaluate(() => JSON.parse(localStorage.getItem('go.go-du-jour.v1') ?? 'null'));
  expect(serie).toMatchObject({ jours: 1 });
});

test('badges : 21 sceaux, vitrine repliée, un badge de #529 gagné s’imprime une fois (#529)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    if (localStorage.getItem('go.test.seme')) return;
    localStorage.setItem('go.test.seme', '1');
    localStorage.setItem('go.course-meilleur.v1', '4');
    localStorage.setItem('go.badges.v1', JSON.stringify(['objectif-semaine']));
  });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Profil' }).click();
  await ouvrirNiveauBadges(page);
  const vitrine = page.getByRole('region', { name: 'Badges, 2 sur 21' });
  await expect(vitrine.getByRole('button', { name: 'Première course : obtenu' })).toBeVisible();
  await expect(vitrine.getByRole('button', { name: 'Objectif de la semaine : obtenu' })).toBeVisible();
  await expect(vitrine.locator('.vitrine-detail')).toHaveText('Badge gagné : Première course');
  await expect(vitrine.locator('li.nouveau')).toHaveCount(1);
  // Repliée : les 2 gagnés et les 4 suivants.
  await expect(vitrine.locator('li[data-badge]')).toHaveCount(6);
  const tous = vitrine.getByRole('button', { name: 'Voir les 21 badges' });
  await expect(tous).toHaveText('+15');
  await expect(tous).toHaveAttribute('aria-expanded', 'false');
  expect((await tous.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await tous.click();
  await expect(vitrine.locator('li[data-badge]')).toHaveCount(21);
  await expect(vitrine.getByRole('button', { name: 'Moins de badges' })).toHaveAttribute('aria-expanded', 'true');
  await vitrine.getByRole('button', { name: /^Victoire classée : à gagner/ }).click();
  await expect(vitrine.locator('.vitrine-detail')).toHaveText('Victoire classée : Gagne une partie classée en ligne.');
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('go.badges.v1') ?? '[]'))).toEqual(['objectif-semaine', 'premiere-course']);
  const deborde = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(deborde).toBe(false);
});

test('niveau 10 : la fête annonce le goban « Cerisier », qui se choisit dans les réglages (#529)', async ({ page }) => {
  // Go du jour n° 1 (problème b1, réponse E5), comme e2e/xp.spec.ts : +20, et +20 la première fois.
  await page.clock.setFixedTime(new Date('2026-09-27T12:00:00+02:00'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(xp => { if (localStorage.getItem('go.xp.v1') === null) localStorage.setItem('go.xp.v1', String(xp)); }, XP_NIVEAU_10 - 30);
  await page.goto('/?go-du-jour=1');
  await jouer(page, 'E5');
  await attendrePierre(page, 'E5', 'noir');
  await expect(page.locator('.verdict').getByTestId('pastille-xp')).toContainText(/\+40\sXP/);
  await page.waitForTimeout(800);
  // #646 : la sortie du problème (plein écran) ; la fête attendait la fin de l'exercice.
  await page.getByRole('button', { name: 'Retour aux problèmes' }).click();
  const fete = page.getByTestId('fete-niveau');
  await expect(fete).toBeVisible();
  await expect(fete).toContainText(/Niveau\s10/);
  await expect(fete).toContainText('Tu débloques le goban « Cerisier ».');
  await fete.getByRole('button').click();
  await expect(fete).toHaveCount(0);

  // #613 : la barre de niveau est dans le Profil.
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Profil' }).click();
  await ouvrirNiveauBadges(page);
  await expect(page.getByTestId('barre-niveau')).toContainText(/Niveau\s10/);
  await page.locator('.retour').first().click();
  await page.getByRole('button', { name: /^Réglages/ }).click();
  const goban = page.getByRole('group', { name: 'Goban' });
  const cerisier = goban.getByRole('button', { name: 'Cerisier', exact: true });
  await cerisier.click();
  await expect(cerisier).toHaveAttribute('aria-pressed', 'true');
  await expect(goban.getByRole('button', { name: 'Jade, débloqué au niveau 12' })).toHaveAttribute('aria-disabled', 'true');
  await expect(goban.getByRole('button', { name: 'Kaya ancien, débloqué au niveau 15' })).toContainText('Niv. 15');
  for (const b of await goban.getByRole('button').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('go.themeGoban.v1') ?? 'null'))).toBe('cerisier');
});
