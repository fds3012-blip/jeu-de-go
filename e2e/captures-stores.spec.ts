import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { attendrePierre, jouer, passerJusquAuScore, plateau } from './plateau';

// Issue #208 : 6 captures de store en sombre, 1290 × 2796 (iPhone 6,7 pouces), avec une légende courte.
// Lancement manuel seulement (écrit dans docs/) : CAPTURES_STORES=1 npx playwright test captures-stores
// Étape 1 : chaque écran réel de l'app à 390 × 844 (×3). Étape 2 : l'écran posé sous sa légende, sur fond encre.

test.skip(!process.env.CAPTURES_STORES, 'Captures de store : lancer avec CAPTURES_STORES=1');
test.describe.configure({ mode: 'serial' });

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const BRUTES = join(RACINE, 'test-results', 'captures-stores');
const SORTIE = join(RACINE, 'docs', 'marketing', 'stores', 'captures');
const MIDI_PARIS = new Date('2026-09-27T12:00:00+02:00');

/** Légendes des 6 captures, dans l'ordre du store. Les mêmes textes sont dans docs/marketing/fiches-stores.md. */
const CAPTURES = [
  { id: '01-accueil', fr: 'Apprends le go en jouant', en: 'Learn Go by playing' },
  { id: '02-lecon', fr: 'Tu joues dès le premier écran', en: 'Play from the very first screen' },
  { id: '03-premiere-partie', fr: 'Ta première victoire est possible', en: 'Your first win is within reach' },
  { id: '04-adversaires', fr: 'Neuf adversaires, à ton rythme', en: 'Nine opponents, at your pace' },
  { id: '05-revue', fr: 'La revue va droit au moment clé', en: 'Review goes straight to the key moment' },
  { id: '06-go-du-jour', fr: 'Un Go du jour à partager', en: 'A Daily Go to share' },
] as const;

async function preparer(page: Page, etat: Record<string, unknown> = {}) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.addInitScript((e) => {
    for (const [k, v] of Object.entries(e)) localStorage.setItem(k, JSON.stringify(v));
  }, etat);
}

async function brute(page: Page, id: string) {
  mkdirSync(BRUTES, { recursive: true });
  // Pas de défilement horizontal sur l'écran capturé.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: join(BRUTES, `${id}.png`) });
}

test('écrans bruts', async ({ page }) => {
  test.setTimeout(180_000);

  // 1. Accueil d'un nouveau joueur : une seule action, la première partie contre Pomme.
  await preparer(page);
  await page.goto('/');
  await expect(page.locator('.cta')).toBeVisible();
  await brute(page, '01-accueil');

  // 2. Leçon 1 : on pose sa pierre dès le premier écran, puis les libertés s'allument.
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
  await page.getByRole('button', { name: 'Commencer' }).click();
  await expect(page.locator('.lecteur-plateau')).toHaveAttribute('data-demo', 'geste');
  await jouer(page, 'E5');
  await expect(page.locator('.lecteur-plateau')).toHaveAttribute('data-demo', 'finie');
  await brute(page, '02-lecon');

  // 3. Première partie contre Pomme : Mochi annonce le komi réduit à 0,5 (il disparaît au premier coup).
  await page.goto('/');
  await page.locator('.cta').click();
  await expect(page.locator('.annonce-komi')).toContainText('0,5');
  await brute(page, '03-premiere-partie');
});

test('adversaires illustrés', async ({ page }) => {
  await preparer(page, { 'go.bilan.v1': { pomme: { v: 2, d: 1 }, caillou: { v: 1, d: 1 } } });
  await page.goto('/');
  await page.getByRole('button', { name: 'Changer' }).click();
  await expect(page.locator('.choix-vedette [data-portrait]')).toBeVisible();
  await brute(page, '04-adversaires');
});

test('revue ouverte sur le moment clé', async ({ page }) => {
  test.setTimeout(300_000);
  await preparer(page, { 'go.intro-but.v1': true, 'go.parties.v1': { n: 4, ordi: 4 } });
  // Même recette que e2e/revue.spec.ts (#186) : coups sur la première ligne, puis passes. Pomme joue un peu au
  // hasard, donc on recommence (jusqu'à 5 fois) tant que la revue n'a pas de moment clé.
  const puce = page.getByRole('button', { name: /^Moment clé, coup \d+/ });
  for (let essai = 0; essai < 5 && !(await puce.count()); essai++) {
    await page.goto('/?komi=-100');
    await page.locator('.cta').click();
    await expect(plateau(page)).toBeVisible();
    const passer = page.getByRole('button', { name: 'Passer' });
    for (const c of ['E5', 'A1', 'A9', 'J1', 'J9']) {
      await expect(passer).toBeEnabled({ timeout: 10_000 });
      await jouer(page, c);
    }
    await expect(passer).toBeEnabled({ timeout: 10_000 });
    await passerJusquAuScore(page);
    await page.getByRole('button', { name: 'Revoir ma partie' }).click();
    await expect(page.locator('.revue-analyse')).toHaveCount(0, { timeout: 60_000 });
  }
  await expect(puce).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.revue-mochi p').first()).toHaveText(/^Moment clé/);
  await page.evaluate(() => scrollTo(0, 0));
  await brute(page, '05-revue');
});

test('Go du jour résolu, avec la série', async ({ page }) => {
  await page.clock.setFixedTime(MIDI_PARIS);
  await preparer(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: async () => {} });
  });
  await page.goto('/?go-du-jour=1');
  await expect(page.getByText(/^Go du jour n°\s1$/)).toBeVisible();
  await jouer(page, 'E5');
  await attendrePierre(page, 'E5', 'noir');
  await expect(page.getByRole('button', { name: /Partager/ }).first()).toBeVisible();
  // La pastille « +30 XP » passe par-dessus le titre : on attend qu'elle parte.
  await page.clock.runFor(10_000).catch(() => {});
  await expect(page.getByTestId('pastille-xp')).toHaveCount(0, { timeout: 10_000 });
  await brute(page, '06-go-du-jour');
});

/** Police des légendes (celle de l'app), embarquée : la page de composition n'a pas d'origine. */
function police(): string {
  const f = join(RACINE, 'node_modules', '@fontsource-variable', 'bricolage-grotesque', 'files', 'bricolage-grotesque-latin-wght-normal.woff2');
  return readFileSync(f).toString('base64');
}

// Seulement en français : l'interface anglaise n'est pas complète (DETECTION_APPAREIL = false, src/content/i18n).
// Une capture anglaise montrerait des écrans en français sous une légende anglaise. Les légendes anglaises sont prêtes.
for (const langue of ['fr'] as const) {
  test(`composition des 6 captures (${langue})`, async ({ page }) => {
    // 430 × 932 à ×3 = 1290 × 2796, format iPhone 6,7 pouces accepté par App Store Connect.
    await page.setViewportSize({ width: 430, height: 932 });
    const woff = police();
    mkdirSync(join(SORTIE, langue), { recursive: true });
    for (const c of CAPTURES) {
      const img = readFileSync(join(BRUTES, `${c.id}.png`)).toString('base64');
      await page.setContent(`<!doctype html><html lang="${langue}"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>
        @font-face { font-family: B; src: url(data:font/woff2;base64,${woff}) format('woff2'); font-weight: 200 800; }
        html, body { margin: 0; height: 100%; }
        body { background: radial-gradient(120% 45% at 50% 0%, #3a2f22 0%, #1C1916 60%); color: #F3EDE3; font-family: B, sans-serif;
          display: flex; flex-direction: column; align-items: center; overflow: hidden; }
        h1 { font-size: 34px; line-height: 1.12; font-weight: 750; letter-spacing: -0.01em; text-align: center; margin: 58px 28px 30px; text-wrap: balance; }
        h1 span { display: block; width: 44px; height: 5px; border-radius: 3px; background: #3CC48E; margin: 0 auto 18px; }
        .tel { width: 332px; height: 720px; border-radius: 44px; background: #0d0b0a; padding: 9px; box-sizing: border-box;
          box-shadow: 0 0 0 1.5px #4a4038, 0 30px 60px rgba(0,0,0,.55); }
        .tel img { display: block; width: 100%; height: 100%; border-radius: 28px; object-fit: cover; object-position: top; }
      </style></head><body><h1><span></span>${c[langue]}</h1><div class="tel"><img src="data:image/png;base64,${img}" alt=""></div></body></html>`);
      await page.evaluate(() => document.fonts.ready);
      const chemin = join(SORTIE, langue, `${c.id}.jpg`);
      await page.screenshot({ path: chemin, type: 'jpeg', quality: 86 });
      expect(statSync(chemin).size).toBeLessThan(1_000_000);
    }
  });
}
