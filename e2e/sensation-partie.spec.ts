import { expect, test, type Page } from '@playwright/test';
import { fromLabel, toLabel } from '../src/go/coords';
import { newPosition, play, type Position } from '../src/go/rules';
import { metEnAtari } from '../src/app/partie';
import { jouer, message, plateau } from './plateau';

// Issue #187 : sensation en partie contre Pomme. Plateau stable au premier coup, capture du joueur fêtée.

/** Nombre de coups joués (liste des coups au-dessus du plateau). */
const coupsJoues = (page: Page) => page.locator('ol.coups li:not(.vide)');

/** Haut du plateau à l'écran. */
async function hautPlateau(page: Page): Promise<number> {
  return (await plateau(page).boundingBox())!.y;
}

/** Position lue sur le plateau affiché (Noir au trait : on ne lit qu'à notre tour). */
async function lirePosition(page: Page): Promise<Position> {
  const pos = newPosition(9);
  const pierres = await plateau(page).locator('g[data-pierre]:not([data-morte])').evaluateAll(els =>
    els.map(e => [e.getAttribute('data-point')!, e.getAttribute('data-pierre')!] as const));
  for (const [label, c] of pierres) pos.board[fromLabel(label, 9)] = c === 'noir' ? 1 : 2;
  return pos;
}

/** Un coup pour Noir : une capture si possible, sinon un atari, sinon un point sûr (au moins 2 libertés). */
function choisir(pos: Position): { p: number; capture: boolean } | null {
  const libres = Array.from({ length: 81 }, (_, i) => i).filter(i => !pos.board[i]);
  const essais = libres.map(p => ({ p, r: play(pos, p) })).filter((x): x is { p: number; r: Position } => typeof x.r !== 'string');
  const capture = essais.find(x => x.r.captures[1] > pos.captures[1]);
  if (capture) return { p: capture.p, capture: true };
  const atari = essais.find(x => metEnAtari(x.r, x.p));
  if (atari) return { p: atari.p, capture: false };
  const centre = [40, 30, 50, 32, 48, 22, 58, 38, 42, 24, 56, 20, 60];
  const sur = essais.find(x => centre.includes(x.p)) ?? essais[Math.floor(essais.length / 2)];
  return sur ? { p: sur.p, capture: false } : null;
}

test('le plateau ne bouge pas au premier coup, intro de Mochi comprise (±2 px)', async ({ page }) => {
  await page.goto('/');
  await page.locator('.cta').click();
  await expect(page.getByText(/Le but\s: entourer plus de territoire que Pomme/)).toBeVisible();
  const avant = await hautPlateau(page);
  await jouer(page, 'E5');
  await expect(coupsJoues(page)).toHaveCount(1);
  expect(Math.abs((await hautPlateau(page)) - avant)).toBeLessThanOrEqual(2);
  // La réponse de Pomme remplace la bulle : toujours rien ne bouge.
  await expect(coupsJoues(page)).toHaveCount(2, { timeout: 10_000 });
  await expect(message(page)).toContainText(/Pomme (joue|capture)|Atari|Passe/);
  expect(Math.abs((await hautPlateau(page)) - avant)).toBeLessThanOrEqual(2);
});

test('le plateau ne bouge pas au premier coup, sans intro (±2 px)', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('go.parties.v1', JSON.stringify({ n: 3, ordi: 3, dernier: 'pomme' }));
    localStorage.setItem('go.intro-but.v1', 'true');
  });
  await page.reload();
  await page.locator('.cta').click();
  await expect(plateau(page)).toBeVisible();
  const avant = await hautPlateau(page);
  await jouer(page, 'E5');
  await expect(coupsJoues(page)).toHaveCount(1);
  expect(Math.abs((await hautPlateau(page)) - avant)).toBeLessThanOrEqual(2);
  await expect(coupsJoues(page)).toHaveCount(2, { timeout: 10_000 });
  expect(Math.abs((await hautPlateau(page)) - avant)).toBeLessThanOrEqual(2);
});

for (const mouvement of ['no-preference', 'reduce'] as const) {
  test(`ta capture est fêtée : « Bravo » lisible, Pomme attend${mouvement === 'reduce' ? ', pas de « +N » (mouvements réduits)' : ', « +N » vers ton couvercle'}`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ reducedMotion: mouvement, colorScheme: process.env.CAPTURE_THEME === 'light' ? 'light' : 'dark' });
    await page.goto('/');
    await page.locator('.cta').click();
    await expect(plateau(page)).toBeVisible();
    let captureVue = false;
    for (let tour = 0; tour < 35 && !captureVue; tour++) {
      const n = await coupsJoues(page).count();
      const pos = await lirePosition(page);
      const coup = choisir(pos);
      if (!coup) break;
      await jouer(page, toLabel(coup.p, 9));
      // Pomme répond vite en e2e (sauf après une capture) : on attend au moins notre coup.
      await expect.poll(() => coupsJoues(page).count()).toBeGreaterThan(n);
      if (coup.capture) {
        captureVue = true;
        // Le message reste pendant que Pomme réfléchit (pause de 700 ms en plus).
        await expect(message(page)).toHaveText(/^Bravo, tu captures \d+ pierres?\s!$/);
        const gain = page.locator('.joueur[data-joueur="Toi"] .gain-capture');
        if (mouvement === 'reduce') await expect(gain).toHaveCount(0);
        else await expect(gain).toHaveText(/^\+\d+$/);
        // Captures 390 × 844 : CAPTURE_DIR et CAPTURE_THEME (dark ou light) pour la revue de design.
        if (process.env.CAPTURE_DIR && mouvement === 'no-preference') await page.screenshot({ path: `${process.env.CAPTURE_DIR}/capture-bravo-${process.env.CAPTURE_THEME ?? 'dark'}.png` });
        else {
          // 400 ms plus tard, Pomme n'a toujours pas répondu : le « Bravo » se lit.
          await page.waitForTimeout(400);
          await expect(message(page)).toHaveText(/^Bravo, tu captures/);
        }
        await expect(coupsJoues(page)).toHaveCount(n + 2, { timeout: 10_000 });
        await expect(gain).toHaveCount(0);
      }
      else {
        await expect(coupsJoues(page)).toHaveCount(n + 2, { timeout: 10_000 });
        if (await page.locator('.recit, .barre-comptage').first().isVisible()) break;
      }
    }
    expect(captureVue, 'aucune capture en 35 coups').toBe(true);
  });
}
