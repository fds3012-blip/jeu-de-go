import { expect, test, type Page } from '@playwright/test';
import { brancher, fauxServeur } from './fauxSupabase';
import { plateau } from './plateau';

// Issue #382 : défauts 🟠 de l'audit visuel du 02/10 (docs/qa/audit-visuel-2026-10-02.md).
// n° 1 : plus de vide sous le plateau d'un problème, la consigne de Mochi est dessous, visible au-dessus de la barre.
// n° 5 : la taille du plateau se voit et se change sans défiler dans la feuille des adversaires, en 320 × 568.
// n° 8 : en 320 × 568, l'action de « Crée ton compte » est au-dessus de la ligne de flottaison.

const MIDI_PARIS_28 = new Date('2026-09-28T12:00:00+02:00');
const ECRANS = [{ width: 390, height: 844 }, { width: 320, height: 568 }];

async function ouvrirGoDuJour(page: Page) {
  await page.clock.setFixedTime(MIDI_PARIS_28);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => { if (localStorage.getItem('go.parties.v1') === null) localStorage.setItem('go.parties.v1', '{"n":1}'); });
  await page.goto('/?go-du-jour=2');
  await expect(page.getByRole('heading', { level: 2, name: 'Vers le bord' })).toBeVisible();
}

for (const ecran of ECRANS) {
  test.describe(`${ecran.width} × ${ecran.height}`, () => {
    test.use({ viewport: ecran });

    test('problème : plateau en tête sur la largeur, consigne de Mochi dessous, au-dessus de la barre', async ({ page }) => {
      await ouvrirGoDuJour(page);
      const p = await plateau(page).boundingBox();
      const mochi = page.locator('.lecteur-mochi');
      await expect(mochi).toContainText('Tu joues Noir');
      const m = await mochi.boundingBox();
      const nav = await page.getByRole('navigation').boundingBox();
      expect(p && m && nav).toBeTruthy();
      // Le plateau prend presque toute la largeur ; la consigne est sous lui, entière, avant la barre de navigation.
      expect(p!.width).toBeGreaterThan(ecran.width * 0.8);
      expect(m!.y).toBeGreaterThanOrEqual(p!.y + p!.height - 1);
      expect(m!.y + m!.height).toBeLessThanOrEqual(nav!.y + 1);
      // Plus de grand vide : entre la consigne et la barre, moins d'un tiers d'écran.
      expect(nav!.y - (m!.y + m!.height)).toBeLessThan(ecran.height / 3);
    });
  });
}

test.describe('320 × 568', () => {
  test.use({ viewport: { width: 320, height: 568 } });

  test('feuille des adversaires : la taille du plateau est visible et se change sans défiler', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Changer' }).click();
    const feuille = page.getByRole('dialog');
    await expect(feuille).toBeVisible();
    // La feuille monte en 150 ms (accueil.css). Un clic pendant ce mouvement fait défiler la feuille par Playwright
    // (élément « instable », nouvel essai avec un autre alignement) : on attend la fin de l'entrée, comme le doigt.
    await feuille.evaluate(d => Promise.all(d.getAnimations({ subtree: true }).map(a => a.finished)));
    const treize = feuille.getByRole('button', { name: '13 × 13' });
    const cta = feuille.locator('.btn.primary');
    const t = await treize.boundingBox();
    const c = await cta.boundingBox();
    expect(t && c).toBeTruthy();
    expect(t!.y).toBeGreaterThanOrEqual(0);
    expect(t!.y + t!.height).toBeLessThanOrEqual(c!.y);
    await treize.click();
    await expect(treize).toHaveAttribute('aria-pressed', 'true');
    // Aucun défilement n'a été nécessaire.
    expect(await feuille.evaluate(d => d.scrollTop)).toBe(0);
  });

  test('« Crée ton compte » : le champ et l’action principale sont visibles sans défiler', async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ viewport: { width: 320, height: 568 }, baseURL, locale: 'fr-FR',
      storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }] }] } });
    const page = await brancher(ctx, fauxServeur(), { 'go.essai.v1': JSON.stringify({ terminees: 3 }) });
    await page.goto('/');
    await page.locator('.cta').click();
    await expect(page.getByTestId('creer-compte')).toBeVisible();
    const action = page.getByRole('button', { name: 'Recevoir mon code' });
    const b = await action.boundingBox();
    expect(b).toBeTruthy();
    expect(b!.y + b!.height).toBeLessThanOrEqual(568);
    expect(await page.evaluate(() => scrollY)).toBe(0);
    // « Ce qui est gardé » reste à l'écran, juste sous le formulaire.
    await expect(page.locator('.creer-garde')).toBeAttached();
    await ctx.close();
  });
});
