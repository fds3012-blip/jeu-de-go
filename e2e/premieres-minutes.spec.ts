import { expect, test, type Page } from '@playwright/test';
import { brancher, fauxServeur } from './fauxSupabase';
import { boutonPasser, choisirMode, coupsJoues, fantome, message, passer, passerJusquAuScore, plateau, point, toucher } from './plateau';

// #466 : les 5 premières minutes d'un débutant (docs/ux/premieres-minutes-2026-10.md). Un test par correction :
// 1. la pierre fantôme du premier toucher dit « Touche encore » ; 2. la bulle d'entrée commence par le geste ;
// 3. le comptage ne parle pas de « pierres grisées » quand rien n'est grisé ; 4. un territoire à 0 est expliqué à la fin ;
// 5. la limite de l'essai dit ce qui reste ouvert sans compte, et c'est vrai.

const CAPTURES = process.env.CAPTURES_466;

async function capturer(page: Page, nom: string) {
  if (!CAPTURES) return;
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.screenshot({ path: `${CAPTURES}/${nom}-${theme === 'dark' ? 'sombre' : 'clair'}.jpg`, type: 'jpeg', quality: 70 });
  }
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
}

const bulleIntro = (page: Page) => page.locator('.coach-intro:not([data-cache])');

test('1. premier toucher : la pierre fantôme respire et Mochi dit de toucher encore ; la consigne s’efface ensuite', async ({ page }) => {
  await page.goto('/');
  await page.locator('.cta').tap();
  await expect(plateau(page)).toBeVisible();
  await expect(boutonPasser(page)).toBeEnabled({ timeout: 30_000 });

  // Premier toucher : pas de pierre, une pierre fantôme qui attend, et la consigne de Mochi (lue au lecteur d'écran).
  await toucher(page, 'E5');
  await expect(fantome(page)).toHaveAttribute('data-confirmer', 'true');
  await expect(plateau(page).locator('g[data-pierre="noir"]')).toHaveCount(0);
  await expect(message(page)).toHaveText(/^Touche encore pour poser ta pierre en E5\.$/);
  await expect(bulleIntro(page)).toHaveCount(0);
  // Elle respire (mouvement permis)…
  expect(await fantome(page).evaluate(e => getComputedStyle(e).animationName)).toBe('go-attend');
  await capturer(page, 'fantome');
  // … et reste fixe en mouvements réduits.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await fantome(page).evaluate(e => getComputedStyle(e).animationName)).toBe('none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  // Toucher un autre point déplace la pierre fantôme et la consigne suit.
  await toucher(page, 'D4');
  await expect(message(page)).toHaveText(/en D4\.$/);
  // Second toucher au même point : la pierre est posée, la consigne disparaît.
  await toucher(page, 'D4');
  await expect(plateau(page).locator('g[data-pierre="noir"]')).toHaveCount(1);
  await expect(message(page)).not.toHaveText(/Touche encore/);

  // Le geste est appris : au-delà des premiers coups, le premier toucher ne remplace plus la phrase du coup.
  for (const p of ['C3', 'G7', 'G3']) {
    await expect(boutonPasser(page)).toBeEnabled({ timeout: 30_000 });
    const libre = !(await plateau(page).locator(`g[data-point="${p}"][data-pierre]`).count());
    if (!libre) continue;
    await toucher(page, p);
    await toucher(page, p);
  }
  await expect(boutonPasser(page)).toBeEnabled({ timeout: 30_000 });
  expect(await coupsJoues(page).count()).toBeGreaterThanOrEqual(6);
  const libre = ['C7', 'E7', 'E3', 'B5', 'H5'];
  for (const p of libre) {
    if (await plateau(page).locator(`g[data-point="${p}"][data-pierre]`).count()) continue;
    await toucher(page, p);
    break;
  }
  await expect(fantome(page)).toHaveCount(1);
  await expect(message(page)).not.toHaveText(/Touche encore/);
});

test('2. bulle d’entrée : le geste d’abord, le but ensuite, et peu de mots avant la première pierre', async ({ page }) => {
  await page.goto('/');
  await page.locator('.cta').click();
  await expect(plateau(page)).toBeVisible();
  const intro = bulleIntro(page);
  await expect(intro).toHaveText(/^Touche un croisement des lignes pour poser ta pierre\. Le but\s: entourer plus de territoire que Pomme\./);
  // Avant #466 : 44 mots (but, libertés entre parenthèses, komi). Le komi reste expliqué, en une phrase courte.
  const mots = (await intro.innerText()).split(/\s+/).filter(m => /\p{L}|\d/u.test(m)).length;
  expect(mots).toBeLessThanOrEqual(36);
  await expect(page.locator('.annonce-komi')).toHaveText(/^Le komi\s: des points donnés à Blanc, qui joue en second\./);
  await capturer(page, 'bulle-entree');
});

test('3. comptage : sans pierre grisée, Mochi et la ligne du score ne parlent pas de pierres grisées', async ({ page }) => {
  await page.goto('/');
  await choisirMode(page, 'deux');
  await expect(plateau(page)).toBeVisible();
  // À deux, le comptage est toujours vérifié par les joueurs ; ici, aucune pierre n'est morte.
  for (const p of ['C3', 'G7', 'C7', 'G3']) {
    const { x, y } = await point(page, p);
    await page.mouse.click(x, y);
  }
  await passer(page);
  await passer(page);
  await expect(page.locator('.barre-comptage')).toBeVisible();
  await expect(page.locator('p.comptage')).toBeVisible();
  await expect(page.locator('p.comptage')).not.toContainText('grisées');
  await expect(page.locator('p.comptage')).toContainText('(komi compris).');
  await expect(message(page)).not.toContainText('grisées');
});

test('4. fin de partie : un territoire à 0 est expliqué par Mochi, pas « perdu de peu »', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.locator('.cta').click();
  await expect(plateau(page)).toBeVisible();
  // Des pierres éparpillées qui ne ferment rien (le débutant type), puis il passe.
  for (const p of ['E5', 'C3', 'G7', 'C7', 'G3', 'E3', 'E7', 'C5', 'G5', 'E1', 'A5', 'J5']) {
    await expect(boutonPasser(page)).toBeEnabled({ timeout: 30_000 });
    if (await plateau(page).locator(`g[data-point="${p}"][data-pierre]`).count()) continue;
    const { x, y } = await point(page, p);
    await page.mouse.click(x, y);
  }
  // Passer jusqu'au score (Mochi prévient ; le comptage manuel se valide tel quel). La partie varie (Pomme tire au
  // hasard parmi ses coups) : la phrase attendue dépend du territoire compté, lu dans le récit. Le cas « 0 » est
  // aussi couvert sans hasard par src/app/bilan.test.ts.
  await passerJusquAuScore(page);
  const recit = page.locator('.recit');
  await expect(recit).toBeVisible({ timeout: 30_000 });
  // Première ligne du récit : « Aucun territoire », ou « N points de territoire pour toi… » / « … pour Pomme ».
  const ligneTerritoire = await recit.locator('.recit-etapes li').first().innerText();
  const toiSansTerritoire = !/pour toi/i.test(ligneTerritoire);
  await recit.getByRole('button', { name: 'Voir le résultat' }).click();
  const fin = page.locator('section.fin');
  await expect(fin.getByRole('heading', { level: 2 })).toBeVisible();
  const defaite = /Défaite/.test(await fin.getByRole('heading', { level: 2 }).innerText());
  // Une leçon plus urgente passe avant (bilan.ts, leconMochi : fin trop tôt, pierres prises, atari subis) : Mochi
  // propose alors d'ouvrir une leçon. Depuis #488, Pomme joue plus près des pierres du joueur : ce cas arrive.
  const leconPlusUrgente = (await fin.getByRole('button', { name: 'Ouvrir la leçon' }).count()) > 0;
  if (defaite && toiSansTerritoire && !leconPlusUrgente) {
    await expect(fin).toContainText('Ton territoire compte 0 : tes pierres ne fermaient aucun espace.');
    await expect(fin).not.toContainText('Perdu de peu');
  } else if (defaite && toiSansTerritoire) {
    await expect(fin).not.toContainText('Perdu de peu');
  } else {
    await expect(fin).not.toContainText('Ton territoire compte 0');
  }
  test.info().annotations.push({ type: 'cas', description: `défaite=${defaite}, territoire nul=${toiSansTerritoire} (${ligneTerritoire})` });
  await capturer(page, 'fin-territoire');
});

test('5. limite de l’essai : ce qui reste ouvert sans compte est dit, et c’est vrai', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR', baseURL,
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }] }] } });
  const page = await brancher(ctx, serveur, { 'go.essai.v1': JSON.stringify({ terminees: 3, suivi: true }), 'go.parties.v1': JSON.stringify({ n: 3, ordi: 3, dernier: 'pomme' }) });
  await page.goto('/');
  await choisirMode(page, 'ordi');
  const ecran = page.getByTestId('creer-compte');
  await expect(ecran).toHaveAttribute('data-raison', 'parties');
  await expect(ecran.getByText(/Sans compte, les leçons 1 à 3 et le Go du jour restent ouverts\./)).toBeVisible();
  await capturer(page, 'limite-essai');
  // « Plus tard » : la leçon 1 s'ouvre bien sans compte.
  await page.getByRole('button', { name: 'Plus tard' }).click();
  await page.getByRole('navigation').getByRole('button', { name: /^Apprendre/ }).click();
  await page.getByRole('button', { name: 'Commencer' }).click();
  await expect(page.locator('.lecteur-plateau')).toBeVisible();
  await expect(page.getByTestId('creer-compte')).toHaveCount(0);
  await ctx.close();
});
