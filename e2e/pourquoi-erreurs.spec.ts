import { expect, test, type Page } from '@playwright/test';
import { jouer } from './plateau';

// #492 : « Rejouer mes erreurs », pourquoi la bonne réponse est la bonne. Deux erreurs gardées sur l'appareil :
// - la position de Florian (Caillou, coup 5) : Noir C3 et G7, Blanc D5 et C2 ; KataGo préférait D3, Florian a joué C4,
//   environ 6 points d'écart. Aucun motif tactique sûr : phrase générale, chiffrée ;
// - un sauvetage : Noir E5 en atari (Blanc D5, F5, E6) ; le bon coup E4, le coup joué G3.
// Captures avant / après : `CAPTURES_492=<dossier> npx playwright test e2e/pourquoi-erreurs.spec.ts`.

const CAPTURES = process.env.CAPTURES_492;
const N = 9;
const idx = (l: string) => {
  const x = 'ABCDEFGHJ'.indexOf(l[0]), y = N - Number(l.slice(1));
  return y * N + x;
};
function rangees(noires: string[], blanches: string[]): string[] {
  const r = Array.from({ length: N }, () => '.'.repeat(N).split(''));
  for (const s of noires) r[Math.floor(idx(s) / N)][idx(s) % N] = 'X';
  for (const s of blanches) r[Math.floor(idx(s) / N)][idx(s) % N] = 'O';
  return r.map(l => l.join(''));
}
const base = { creeLe: '2026-01-01T10:00:00.000Z', prochain: '2026-01-01', rates: 1, reussites: 0, maj: 1, size: 9, toPlay: 1 };
const FLORIAN = {
  ...base, id: 'erreur-florian', rows: rangees(['C3', 'G7'], ['D5', 'C2']), reponses: [idx('D3')], joue: idx('C4'), coup: 5, adversaire: 'Caillou', perte: 5.6,
};
const SAUVETAGE = {
  ...base, id: 'erreur-sauve', creeLe: '2026-01-02T10:00:00.000Z', rows: rangees(['E5'], ['D5', 'F5', 'E6']), reponses: [idx('E4')], joue: idx('G3'), coup: 12, adversaire: 'Pomme', perte: 4.2,
};

async function preremplir(page: Page, erreurs: object[]) {
  await page.addInitScript(e => {
    if (sessionStorage.getItem('pourquoi-pret')) return;
    localStorage.setItem('go.parties.v1', JSON.stringify({ n: 1, dernier: 'caillou', ordi: 1 }));
    localStorage.setItem('go.bilan.v1', JSON.stringify({ caillou: { v: 0, d: 1 } }));
    localStorage.setItem('go.erreurs.v1', JSON.stringify(e));
    localStorage.setItem('go.xp.premieres.v1', JSON.stringify(['probleme', 'partie']));
    sessionStorage.setItem('pourquoi-pret', '1');
  }, erreurs);
}

async function capture(page: Page, nom: string) {
  if (!CAPTURES) return;
  await page.screenshot({ path: `${CAPTURES}/${nom}.png` });
}

async function ouvrirSeance(page: Page) {
  await page.goto('/');
  const carte = page.getByTestId('tuile-revisions');
  await carte.scrollIntoViewIfNeeded();
  await carte.click();
  await expect(page.locator('.lecteur')).toBeVisible();
}

/** Raté, puis l'aide graduée (indice, pourquoi, réponse) : chaque marche s'ouvre après un nouvel essai raté. */
async function rateEtReponse(page: Page, faux: string[] = ['B7', 'A1', 'J9', 'H2']) {
  const aide = page.locator('.lecteur .lien-aide');
  for (const f of faux) {
    // Un point différent à chaque fois : toucher la pierre fausse encore affichée remettrait seulement la position.
    await jouer(page, f);
    await expect(aide).toBeVisible();
    const libelle = await aide.textContent();
    await aide.click();
    if (libelle === 'Voir la réponse') return;
  }
  throw new Error('La réponse n’est jamais proposée');
}

/** Réponse montrée : le premier toucher sur la pierre affichée remet la position, le second joue. */
async function rejouerReponse(page: Page, bon: string) {
  const resolu = page.locator('[data-vu]');
  await jouer(page, bon);
  if (!(await resolu.count())) await jouer(page, bon);
  await expect(resolu).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

async function sansDebord(page: Page, ecran: string) {
  const m = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(m.scroll, `${ecran} : défilement horizontal`).toBeLessThanOrEqual(m.client);
}

/** La croix rouge du plateau (coup joué dans la partie). */
const croix = (page: Page) => page.locator('.lecteur svg path[stroke="#D2432C"]');

test('échec : la réponse vient avec le pourquoi chiffré et la croix sur le coup joué (position de Florian)', async ({ page }) => {
  await preremplir(page, [FLORIAN]);
  await ouvrirSeance(page);
  await rateEtReponse(page);
  const pourquoi = page.locator('[data-pourquoi]');
  await expect(pourquoi).toHaveText(/^Selon KataGo, D3 gardait environ 6\spoints de plus que ton coup en C4\. Aucune pierre n’est en atari ici\s: l’écart ne vient pas d’une prise immédiate\.$/);
  await expect(page.getByText(/Rejoue-la pour la retenir/)).toHaveCount(0);
  await expect(page.getByText('La croix marque ton coup dans la partie.')).toBeVisible();
  await expect(croix(page)).toHaveCount(1);
  // « Revoir la suite » reste une cible de 44 px.
  const revoir = page.getByRole('button', { name: 'Revoir la suite' });
  expect((await revoir.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await sansDebord(page, 'réponse');
});

test('échec : « Revoir la suite » montre la prise que permettait le coup joué, puis le bon coup', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await preremplir(page, [SAUVETAGE]);
  await ouvrirSeance(page);
  await rateEtReponse(page);
  const verdict = page.locator('.verdict');
  await expect(verdict.getByText('Ton coup dans la partie : G3.')).toBeVisible();
  await expect(verdict.getByText('Blanc prend une pierre en E4.')).toBeVisible();
  await expect(verdict.getByText('Retour à la position de ta partie.')).toBeVisible();
  // Dernière position : le bon coup, et l'explication remplace la légende.
  await expect(page.locator('[data-pourquoi]')).toHaveText(
    /^E4 sort ta pierre de l’atari \(il ne lui restait qu’une liberté\)\s: elle a maintenant 3\slibertés\. Après ton coup en G3, Blanc pouvait prendre une de tes pierres en E4\.$/,
    { timeout: 10_000 },
  );
  await expect(page.locator('[data-ecart]')).toHaveText(/^Écart\s: environ 4\spoints selon KataGo\.$/);
  await expect(croix(page)).toHaveCount(1);
});

test('mouvements réduits : la suite saute à la fin, explication comprise', async ({ page }) => {
  await preremplir(page, [SAUVETAGE]);
  await ouvrirSeance(page);
  await rateEtReponse(page);
  await expect(page.locator('[data-pourquoi]')).toContainText('E4 sort ta pierre de l’atari');
  await page.getByRole('button', { name: 'Revoir la suite' }).click();
  await expect(page.locator('[data-pourquoi]')).toContainText('E4 sort ta pierre de l’atari');
});

test('réussite : courte confirmation du pourquoi', async ({ page }) => {
  await preremplir(page, [SAUVETAGE]);
  await ouvrirSeance(page);
  await jouer(page, 'E4');
  await expect(page.locator('.verdict-juste')).toContainText(/Bravo, c’est le coup de KataGo\s! E4 sort ta pierre de l’atari/);
});

for (const cas of [{ l: 320, h: 640, theme: 'dark' as const }, { l: 390, h: 844, theme: 'light' as const }]) {
  test(`${cas.l} px, ${cas.theme === 'dark' ? 'sombre' : 'clair'} : explication lisible, sans débord`, async ({ page }) => {
    await page.setViewportSize({ width: cas.l, height: cas.h });
    await page.emulateMedia({ colorScheme: cas.theme, reducedMotion: 'reduce' });
    await preremplir(page, [SAUVETAGE]);
    await ouvrirSeance(page);
    await rateEtReponse(page);
    const texte = page.locator('[data-pourquoi]');
    await expect(texte).toBeVisible();
    await sansDebord(page, `${cas.l} px`);
    // Contraste : le texte de l'explication se détache du fond de la feuille (couleurs calculées).
    const couleurs = await texte.evaluate(el => [getComputedStyle(el).color, getComputedStyle(el.closest('.verdict')!).backgroundColor]);
    expect(couleurs[0]).not.toBe(couleurs[1]);
  });
}

for (const theme of ['light', 'dark'] as const) {
  test(`captures (${theme})`, async ({ page }) => {
    test.skip(!CAPTURES, 'captures à la demande');
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await preremplir(page, [FLORIAN, SAUVETAGE]);
    await ouvrirSeance(page);
    await rateEtReponse(page);
    await page.waitForTimeout(300);
    await capture(page, `florian-reponse-${theme}`);
    await rejouerReponse(page, 'D3');
    await page.getByRole('button', { name: 'Révision suivante' }).click();
    await rateEtReponse(page);
    await page.waitForTimeout(300);
    await capture(page, `sauvetage-reponse-${theme}`);
  });
}
