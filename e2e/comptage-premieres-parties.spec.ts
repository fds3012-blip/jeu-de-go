import { expect, test, type Page } from '@playwright/test';
import { boutonPasser, choisirMode, coupsJoues, jouer, passer, plateau } from './plateau';
import { fromLabel } from '../src/go/coords';

// Comptage sûr des 3 premières parties (#486). Les coups de Pomme sont écrits d'avance (`window.__coupsOrdi`, build
// VITE_E2E seulement) : la partie finit à coup sûr sur la même position. Noir tient A à G, Blanc H et J ; dans le coin
// noir, un groupe blanc (C9, C8, C7, B7, A7) n'a qu'un œil carré de quatre points : il est mort. Les simulations du
// moteur hésitent sur ce groupe ; la preuve exacte (src/engine/comptageSur.ts) le tranche.
// - Première partie : Mochi grise le groupe tout seul, explique en une phrase, et « Corriger » reste possible.
// - Quatrième partie : comportement d'avant, le groupe douteux est laissé au joueur (« Valider le score »).

const NOIR = ['D9', 'D8', 'D7', 'A6', 'B6', 'C6', 'D6', 'G9', 'G8', 'G7', 'G6', 'G5', 'G4', 'G3', 'G2', 'G1'];
const BLANC = ['C9', 'C8', 'C7', 'B7', 'A7', 'H9', 'H8', 'H7', 'H6', 'H5', 'H4', 'H3', 'H2', 'H1'];
const MORTES = ['C9', 'C8', 'C7', 'B7', 'A7'];
const PHRASE = "J’ai compté pour toi : les pierres grisées ne peuvent plus vivre, elles deviennent des prisonniers.";

async function preparer(page: Page, stockage: Record<string, string>) {
  // Après ses 14 coups, Pomme passe.
  const coups = [...BLANC.map(l => fromLabel(l, 9)), -1, -1, -1];
  await page.addInitScript(({ coups, stockage }) => {
    (window as unknown as { __coupsOrdi: number[] }).__coupsOrdi = [...coups];
    for (const [k, v] of Object.entries(stockage)) localStorage.setItem(k, v);
  }, { coups, stockage: { 'go.consentement.v1': 'refuse', ...stockage } });
  await page.goto('/');
}

/** Joue les coups de Noir (Pomme répond à chacun), puis passe : Pomme a déjà passé, la partie se compte. */
async function jouerJusquAuComptage(page: Page) {
  await expect(plateau(page)).toBeVisible();
  for (const l of NOIR) {
    await expect(boutonPasser(page)).toBeEnabled({ timeout: 15_000 });
    const avant = await coupsJoues(page).count();
    await jouer(page, l);
    await expect.poll(async () => coupsJoues(page).count(), { timeout: 15_000 }).toBeGreaterThanOrEqual(avant + 2);
  }
  await expect(boutonPasser(page)).toBeEnabled({ timeout: 15_000 });
  await passer(page);
}

for (const theme of ['light', 'dark'] as const) {
  test(`première partie : Mochi marque seul le groupe mort et l'explique (${theme})`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ colorScheme: theme });
    await preparer(page, {});
    await page.locator('.cta').click();
    await jouerJusquAuComptage(page);
    // Récit direct, sans « Valider le score » : le groupe blanc est grisé, la phrase de Mochi l'explique.
    const aside = page.locator('.comptage-auto');
    await expect(aside).toBeVisible({ timeout: 15_000 });
    await expect(aside).toContainText(PHRASE);
    for (const l of MORTES) await expect(page.locator(`.recit [data-point="${l}"]`).first()).toHaveAttribute('data-morte', '');
    await expect(page.getByRole('button', { name: 'Valider le score' })).toHaveCount(0);
    // Le joueur peut toujours corriger.
    const corriger = aside.getByRole('button', { name: 'Corriger les pierres mortes' });
    const box = await corriger.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await corriger.click();
    await expect(page.getByRole('button', { name: 'Valider le score' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
}

test('première partie, mouvements réduits : même comptage sûr, récit immédiat', async ({ page }) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await preparer(page, {});
  await page.locator('.cta').click();
  await jouerJusquAuComptage(page);
  await expect(page.locator('.comptage-auto')).toContainText(PHRASE, { timeout: 15_000 });
  // Mouvements réduits : les totaux sont là d'emblée (Noir : 26 + 5 prisonniers ; voir le récit).
  await expect(page.getByTestId('recit-noir')).not.toHaveText('');
});

test('quatrième partie : comportement d\'avant, le groupe douteux est laissé au joueur', async ({ page }) => {
  test.setTimeout(120_000);
  await preparer(page, {
    'go.essai.v1': JSON.stringify({ terminees: 3, suivi: true }),
    'go.parties.v1': JSON.stringify({ n: 3, ordi: 3, dernier: 'pomme' }),
  });
  await choisirMode(page, 'ordi');
  await jouerJusquAuComptage(page);
  await expect(page.getByRole('button', { name: 'Valider le score' })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.comptage-auto')).toHaveCount(0);
  await expect(page.getByText(/Je ne suis pas sûr pour certains groupes/)).toBeVisible();
});
