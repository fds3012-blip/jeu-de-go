import { expect, test, type Page } from '@playwright/test';
import { attendrePierre, jouer, passerJusquAuScore, plateau } from './plateau';

// Issue #77 : revue → « Rejoue cette erreur » → réussite. KataGo est remplacé par un analyseur factice
// (`window.__kataGoFactice`, lu seulement dans un build de test, voir src/engine/index.ts) :
// - plateau vide, Noir au trait : D4 est le meilleur coup (+5), F4 perd 0,9 point (accepté),
//   C5 perd 1,5 point (refusé), E5 perd 10 points (Grosse erreur) ;
// - ensuite, Noir est mené de 5 points, sans candidat : aucun autre coup n'est noté comme une erreur.
// `?komi=-100` (paramètre de test) donne une fin de partie déterministe, comme e2e/revue.spec.ts.

async function kataGoFactice(page: Page) {
  await page.addInitScript(() => {
    const idx = (l: string) => { const x = 'ABCDEFGHJ'.indexOf(l[0]); return (9 - Number(l.slice(1))) * 9 + x; };
    (window as unknown as { __kataGoFactice: unknown }).__kataGoFactice = {
      info: { state: 'pret' },
      async analyze(pos: { board: Int8Array; toPlay: 1 | 2 }) {
        const vide = !Array.from(pos.board).some(c => c !== 0);
        const base = { winrate: 0.5, ownership: new Float32Array(81), visits: 64, ms: 1, engine: 'factice' };
        if (vide) {
          return { ...base, lead: 5, moves: [
            { move: idx('D4'), visits: 40, lead: 5 },
            { move: idx('F4'), visits: 20, lead: 4.1 },
            { move: idx('C5'), visits: 20, lead: 3.5 },
            { move: idx('E5'), visits: 20, lead: -5 },
          ] };
        }
        return { ...base, lead: pos.toPlay === 1 ? -5 : 5, moves: [] };
      },
    };
  });
}

test('revue : rejoue ton erreur, un coup raté revient demain, un coup à moins de 1 point est accepté', async ({ page }) => {
  const erreursPage: string[] = [];
  page.on('pageerror', e => erreursPage.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await kataGoFactice(page);

  // Partie courte contre Pomme : E5, puis on passe jusqu'au score.
  await page.goto('/?komi=-100');
  await page.locator('.cta').click();
  await expect(plateau(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Passer' })).toBeEnabled({ timeout: 10_000 });
  await jouer(page, 'E5');
  await expect(page.getByRole('button', { name: 'Passer' })).toBeEnabled({ timeout: 10_000 });
  await passerJusquAuScore(page);
  await expect(page.getByRole('heading', { level: 2, name: 'Victoire' })).toBeVisible();

  await page.getByRole('button', { name: 'Revoir ma partie' }).click();
  await expect(page.locator('.revue-analyse')).toHaveCount(0, { timeout: 30_000 });

  // La Grosse erreur du coup 1 : « Rejoue cette erreur » devient l'action principale, le bon coup reste caché.
  await page.locator('.revue-erreur', { hasText: 'Coup 1' }).click();
  const rejoue = page.getByRole('button', { name: 'Rejoue cette erreur' });
  await expect(rejoue).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.cta')).toHaveCount(1);
  await expect(page.locator('.cta')).toHaveText('Rejoue cette erreur');
  const voir = page.getByRole('button', { name: 'Voir le bon coup' });
  await expect(voir).toBeVisible();
  await expect(page.locator('[data-meilleur]')).toHaveCount(0);
  await expect(page.getByText(/Essaie plutôt/)).toHaveCount(0);
  for (const b of [rejoue, voir]) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await rejoue.click();

  // La position d'avant l'erreur revient : plateau vide, Noir au trait.
  await expect(page.getByRole('heading', { level: 2, name: 'Rejoue ton erreur' })).toBeVisible();
  await expect(plateau(page).locator('g[data-pierre]')).toHaveCount(0);
  await expect(page.getByText(/tout coup qui perd moins de 1 point est accepté/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  // C5 perd 1,5 point : refusé. L'erreur rejoint la révision espacée, pour demain.
  await jouer(page, 'C5');
  await expect(page.getByText(/Pas celui-là\. Cherche encore\./)).toBeVisible();
  await expect(plateau(page).locator('g[data-pierre]')).toHaveCount(0);
  const gardees = await page.evaluate(() => JSON.parse(localStorage.getItem('go.erreurs.v1') ?? '[]'));
  expect(gardees).toHaveLength(1);
  const demain = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 1); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-'); });
  expect(gardees[0]).toMatchObject({ prochain: demain, rates: 1, reussites: 0, coup: 1 });

  // F4 perd 0,9 point : accepté, même si ce n'est pas le premier choix de KataGo.
  await jouer(page, 'F4');
  await attendrePierre(page, 'F4', 'noir');
  await expect(page.getByText(/Bravo\s!\sKataGo range ce coup parmi les meilleurs\./)).toBeVisible();
  await page.getByRole('button', { name: 'Retour à la revue' }).last().click();
  await expect(page.getByRole('heading', { level: 2, name: 'Revoir ma partie' })).toBeVisible();

  // Après l'essai, la revue montre le bon coup : pierre verte, « Essaie plutôt D4 », « Rejouer d'ici » redevient principal.
  await expect(page.locator('[data-meilleur]')).toHaveCount(1);
  await expect(page.getByText(/Essaie plutôt D4/)).toBeVisible();
  await expect(page.locator('.cta')).toHaveText("Rejouer d'ici");
  await expect(page.getByRole('button', { name: 'Rejoue cette erreur' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Voir le bon coup' })).toHaveCount(0);

  expect(erreursPage).toEqual([]);
});

test("revue : le bon coup n'est pas visible avant l'essai, « Voir le bon coup » le montre", async ({ page }) => {
  const erreursPage: string[] = [];
  page.on('pageerror', e => erreursPage.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await kataGoFactice(page);

  await page.goto('/?komi=-100');
  await page.locator('.cta').click();
  await expect(page.getByRole('button', { name: 'Passer' })).toBeEnabled({ timeout: 10_000 });
  await jouer(page, 'E5');
  await expect(page.getByRole('button', { name: 'Passer' })).toBeEnabled({ timeout: 10_000 });
  await passerJusquAuScore(page);
  await page.getByRole('button', { name: 'Revoir ma partie' }).click();
  await expect(page.locator('.revue-analyse')).toHaveCount(0, { timeout: 30_000 });

  await page.locator('.revue-erreur', { hasText: 'Coup 1' }).click();
  await expect(page.locator('.cta')).toHaveText('Rejoue cette erreur', { timeout: 10_000 });
  // L'erreur est décrite, la réponse non : ni pierre verte, ni coordonnée du bon coup.
  await expect(page.locator('.revue-mochi p')).toContainText('Tu peux trouver mieux');
  await expect(page.locator('.revue-mochi p')).not.toContainText('D4');
  await expect(page.locator('[data-meilleur]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  // « Voir le bon coup » : la pierre verte et le conseil apparaissent, « Rejouer d'ici » redevient l'action principale.
  await page.getByRole('button', { name: 'Voir le bon coup' }).click();
  await expect(page.locator('[data-meilleur]')).toHaveCount(1);
  await expect(page.getByText(/Essaie plutôt D4/)).toBeVisible();
  await expect(page.locator('.cta')).toHaveText("Rejouer d'ici");
  await expect(page.getByRole('button', { name: 'Rejoue cette erreur' })).toBeVisible();

  expect(erreursPage).toEqual([]);
});

// Captures (docs/design/v2/captures/rejoue-erreur-*.png) : `CAPTURES=1 npx playwright test e2e/rejoue-erreur.spec.ts`.
test('captures de « Rejoue cette erreur », sombre et clair', async ({ page }) => {
  test.skip(!process.env.CAPTURES, 'captures à la demande');
  test.setTimeout(120_000);
  await kataGoFactice(page);
  for (const theme of ['dark', 'light'] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    const nom = theme === 'dark' ? 'sombre' : 'clair';
    await page.goto('/?komi=-100');
    await page.locator('.cta').click();
    await expect(page.getByRole('button', { name: 'Passer' })).toBeEnabled({ timeout: 10_000 });
    await jouer(page, 'E5');
    await expect(page.getByRole('button', { name: 'Passer' })).toBeEnabled({ timeout: 10_000 });
    await passerJusquAuScore(page);
    await page.getByRole('button', { name: 'Revoir ma partie' }).click();
    await expect(page.locator('.revue-analyse')).toHaveCount(0, { timeout: 30_000 });
    await page.locator('.revue-erreur', { hasText: 'Coup 1' }).click();
    await page.getByRole('button', { name: 'Voir le bon coup' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `docs/design/v2/captures/rejoue-erreur-bouton-${nom}.png` });
    await page.getByRole('button', { name: 'Rejoue cette erreur' }).click();
    await jouer(page, 'C5');
    await expect(page.getByText(/Pas celui-là/)).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `docs/design/v2/captures/rejoue-erreur-rate-${nom}.png` });
    await jouer(page, 'F4');
    await expect(page.getByText(/KataGo range ce coup/)).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `docs/design/v2/captures/rejoue-erreur-reussi-${nom}.png` });
  }
});
