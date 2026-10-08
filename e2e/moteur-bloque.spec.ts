import { expect, test, type Page } from '@playwright/test';
import { boutonPasser, coupsJoues, finDePartie, jouer, passer, plateau } from './plateau';
import { ouvrirRevue, preparerRevue } from './revueFactice';

// #498 : iOS peut tuer un Worker sans événement `error`. Ici, chaque Worker est remplacé par un faux qui ne répond
// jamais, et les délais du moteur sont raccourcis (`window.__echelleDelaisMoteur`, lu seulement dans un build de test).
// La partie contre l'ordi continue (délai, relance, nouvel essai, puis coup de secours) ; la revue avec KataGo bloqué
// dit que l'analyse ne répond plus et propose « Réessayer ».

async function workersBloques(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __echelleDelaisMoteur: number; Worker: unknown };
    w.__echelleDelaisMoteur = 0.02;
    w.Worker = class {
      onmessage = null; onerror = null;
      postMessage() { /* Worker tué : aucune réponse */ }
      terminate() {}
      addEventListener() {}
      removeEventListener() {}
    };
  });
}

test('partie contre Pomme avec un Worker qui ne répond plus : l’ordi joue quand même, jusqu’au comptage', async ({ page }) => {
  test.setTimeout(90_000);
  const erreurs: string[] = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await workersBloques(page);
  await page.goto('/');
  await page.locator('.cta').click();
  await expect(plateau(page)).toBeVisible();
  for (const l of ['E5', 'C3', 'G7']) {
    const libre = await plateau(page).locator(`g[data-pierre][data-point="${l}"]`).count() === 0;
    if (!libre) continue;
    const avant = await coupsJoues(page).count();
    await jouer(page, l);
    // Ton coup et la réponse de Pomme : jamais « réfléchit… » sans fin.
    await expect.poll(async () => coupsJoues(page).count(), { timeout: 15_000 }).toBeGreaterThanOrEqual(avant + 2);
  }
  await expect(page.getByText(/Pomme (joue|capture|passe)/)).toBeVisible();
  // Fin de partie : le comptage aboutit (récit du score ou comptage manuel), jamais « Je cherche les pierres mortes… ».
  for (let i = 0; i < 4 && !(await finDePartie(page).isVisible()); i++) {
    await expect(boutonPasser(page).or(finDePartie(page)).first()).toBeEnabled({ timeout: 15_000 });
    if (await finDePartie(page).isVisible()) break;
    await passer(page);
  }
  await expect(finDePartie(page)).toBeVisible({ timeout: 15_000 });
  expect(erreurs).toEqual([]);
});

test('revue avec KataGo bloqué : message clair et « Réessayer », puis le bilan', async ({ page }) => {
  test.setTimeout(90_000);
  const erreurs: string[] = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await preparerRevue(page, { katago: false });
  await page.addInitScript(() => {
    const w = window as unknown as { __echelleDelaisMoteur: number; __kataGoFactice: unknown; __kataGoDebloque?: boolean };
    w.__echelleDelaisMoteur = 0.02;
    w.__kataGoFactice = {
      info: { state: 'pret' },
      analyze(pos: { board: Int8Array; toPlay: 1 | 2 }) {
        // KataGo bloqué (Worker gelé) : la promesse ne se termine jamais, tant que le test ne le débloque pas.
        if (!w.__kataGoDebloque) return new Promise(() => {});
        const k = Array.from(pos.board).filter(c => c !== 0).length;
        return Promise.resolve({ winrate: 0.5, lead: k % 2 ? 0.5 : -0.5, moves: [], ownership: new Float32Array(81), visits: 32, ms: 1, engine: 'factice' });
      },
    };
  });
  await ouvrirRevue(page);

  const bloque = page.getByTestId('revue-bloque');
  await expect(bloque).toBeVisible({ timeout: 20_000 });
  await expect(bloque).toContainText('L’analyse ne répond plus.');
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  const reessayer = bloque.getByRole('button', { name: 'Réessayer' });
  expect((await reessayer.boundingBox())!.height).toBeGreaterThanOrEqual(44);

  // KataGo répond de nouveau : « Réessayer » reprend l'analyse, jusqu'au bilan.
  await page.evaluate(() => { (window as unknown as { __kataGoDebloque: boolean }).__kataGoDebloque = true; });
  await reessayer.click();
  await expect(page.getByRole('button', { name: 'Démarrer le bilan' })).toBeVisible({ timeout: 30_000 });
  expect(erreurs).toEqual([]);
});
