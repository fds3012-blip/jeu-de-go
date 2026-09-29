import { expect, test, type Page } from '@playwright/test';
import { jouer, plateau } from './plateau';

// Conseil de Mochi (#80) : partie → conseil → phrase dans la bulle (annoncée) et zone montrée par un calque posé sur le plateau.
// Sans KataGo (premier test) : les modèles qui ne demandent que les règles. Avec KataGo simulé (second test, même
// technique que e2e/rejoue-erreur.spec.ts : `window.__kataGoFactice`, build VITE_E2E) : la zone à défendre.

const barre = (page: Page) => page.getByRole('toolbar', { name: 'Actions de la partie' });
const bulle = (page: Page) => page.locator('.partie-mochi .coach p[aria-live="polite"]');
const calque = (page: Page) => page.locator('.partie-plateau .calque-conseil');

test('partie contre Pomme : le conseil de Mochi montre une phrase et la zone, puis « utile »', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.goto('/');
  await page.locator('.cta').click();
  await expect(plateau(page)).toBeVisible();
  await jouer(page, 'E5');
  await expect(page.getByText(/Pomme (joue|capture|passe)/)).toBeVisible({ timeout: 10_000 });

  const bouton = barre(page).getByRole('button', { name: 'Conseil', exact: true });
  await expect(bouton).toBeEnabled();
  const boite = await bouton.boundingBox();
  expect(boite!.height).toBeGreaterThanOrEqual(44);
  expect(boite!.width).toBeGreaterThanOrEqual(44);
  // L'indice reste là : le conseil ne le remplace pas, et « Passer » reste l'action principale.
  await expect(barre(page).getByRole('button', { name: /^Indice/ })).toBeVisible();

  await bouton.click();
  // Deux pierres sur le 9 × 9 : il reste forcément un coin vide.
  await expect(bulle(page)).toHaveText(/Un coin est encore libre\s*: les coins d.abord\./);
  await expect(calque(page)).toHaveCount(1);
  const points = (await calque(page).getAttribute('data-conseil'))!.split(' ');
  expect(points).toHaveLength(4);
  // Le calque ne prend aucun geste : les touches passent au plateau.
  await expect(calque(page)).toHaveCSS('pointer-events', 'none');

  // Retour « utile / pas utile » : deux boutons de 44 px, une seule réponse, puis un merci.
  const note = page.getByRole('group', { name: /Ce conseil t.aide/ });
  const utile = note.getByRole('button', { name: 'Utile', exact: true });
  await expect(note.getByRole('button', { name: 'Pas utile' })).toBeVisible();
  const b = await utile.boundingBox();
  expect(b!.height).toBeGreaterThanOrEqual(44);
  expect(b!.width).toBeGreaterThanOrEqual(44);
  await utile.click();
  await expect(page.getByText('Merci pour ton avis !')).toBeVisible();
  await expect(note).toHaveCount(0);
  await expect(bulle(page)).toHaveText(/Un coin est encore libre/);

  // Jouer dans la zone (vide, c'est un coin libre) efface le calque.
  await jouer(page, points[0]);
  await expect(calque(page)).toHaveCount(0);
  expect(erreurs).toEqual([]);
});

/** KataGo simulé : Noir tient le bas à gauche (4 × 4) ; si Blanc jouait maintenant, cette zone basculerait. */
async function kataGoFactice(page: Page) {
  await page.addInitScript(() => {
    const idx = (l: string, n = 9) => { const x = 'ABCDEFGHJKLMNOPQRST'.indexOf(l[0]); return (n - Number(l.slice(1))) * n + x; };
    const dansZone = (p: number) => p % 9 < 4 && Math.floor(p / 9) >= 5;
    (window as unknown as { __kataGoFactice: unknown }).__kataGoFactice = {
      info: { state: 'pret' },
      async analyze(pos: { toPlay: 1 | 2; size: number }) {
        const n = pos.size * pos.size;
        const noir = pos.toPlay === 1;
        const ownership = Float32Array.from({ length: n }, (_, p) => (dansZone(p) ? (noir ? 0.8 : -0.6) : 0));
        const moves = (noir ? ['C3', 'G7'] : ['D4', 'C3']).map(l => ({ move: idx(l), visits: 10, prior: 0.2, winrate: 0.5, lead: 1, scoreLoss: 0 }));
        return { moves, winrate: 0.5, lead: 0, ownership, visits: 24, ms: 1, engine: 'factice' };
      },
    };
  });
}

test('KataGo simulé : « Protège ta zone », zone et point montrés par le calque, sans toucher au plateau', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await kataGoFactice(page);
  await page.goto('/');
  await page.locator('.cta').click();
  await expect(plateau(page)).toBeVisible();
  await jouer(page, 'G7');
  await expect(page.getByText(/Pomme (joue|capture|passe)/)).toBeVisible({ timeout: 10_000 });

  await barre(page).getByRole('button', { name: 'Conseil', exact: true }).click();
  await expect(bulle(page)).toHaveText(/Protège ta zone vers [A-J]\d\s*: ton adversaire pourrait la prendre\./);
  await expect(calque(page)).toHaveCount(1);
  const zone = (await calque(page).getAttribute('data-conseil'))!.split(' ');
  // La zone est le bas à gauche (colonnes A à D, lignes 1 à 4), sans les pierres de Pomme.
  expect(zone.length).toBeGreaterThanOrEqual(3);
  for (const p of zone) expect(p).toMatch(/^[A-D][1-4]$/);
  const nomme = (await bulle(page).textContent())!.match(/vers ([A-J]\d)/)![1];
  expect(zone).toContain(nomme);
  // Le plateau lui-même n'a reçu aucune marque de conseil : tout est dans le calque.
  await expect(plateau(page).locator('[data-conseil]')).toHaveCount(0);
  // Le calque est aligné sur le plateau (même boîte).
  const bp = await plateau(page).boundingBox(), bc = await calque(page).boundingBox();
  expect(Math.abs(bp!.x - bc!.x)).toBeLessThan(2);
  expect(Math.abs(bp!.width - bc!.width)).toBeLessThan(2);
  expect(erreurs).toEqual([]);
});
