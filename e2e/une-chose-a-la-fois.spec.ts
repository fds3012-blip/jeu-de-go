import { expect, test, type Page } from '@playwright/test';
import { attendrePierre, jouer } from './plateau';

// Issue #236 : une fête à la fois (N2), un appel à la fois sur l'accueil (N4), « Passer » à part des aides (N7).
// Horloge figée le 27 septembre 2026 à midi, heure de Paris : Go du jour n° 1, le problème b1 (réponse E5).
const MIDI_PARIS = new Date('2026-09-27T12:00:00+02:00');
const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const DOSSIER = 'docs/design/v2/captures/une-chose-a-la-fois';
const THEMES = ['clair', 'sombre'] as const;
const schema = (th: (typeof THEMES)[number]) => (th === 'sombre' ? 'dark' : 'light');

async function preparer(page: Page, theme: (typeof THEMES)[number] = 'clair') {
  await page.clock.setFixedTime(MIDI_PARIS);
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: schema(theme) });
}

/** Stockage posé une seule fois (pas à chaque navigation). */
async function semer(page: Page, cles: Record<string, string>) {
  await page.addInitScript(c => {
    if (sessionStorage.getItem('seme-236')) return;
    sessionStorage.setItem('seme-236', '1');
    for (const [k, v] of Object.entries(c)) localStorage.setItem(k, v);
  }, cles);
}

const pasDeDefilementHorizontal = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

test.describe('N4 : un seul appel sur l’accueil', () => {
  for (const theme of THEMES) {
    test(`premier lancement : ni « À faire » ni Go du jour dans la bulle (${theme})`, async ({ page }) => {
      await preparer(page, theme);
      await page.goto('/');
      await expect(page.locator('.cta-sceau')).toContainText('Joue ta première partie');
      await expect(page.getByTestId('etat-du-jour')).toHaveCount(0);
      await expect(page.locator('.scene-bulle')).not.toContainText('Go du jour');
      await pasDeDefilementHorizontal(page);
      await page.screenshot({ path: `${DOSSIER}/accueil-premier-lancement-${theme}.png` });
    });
  }

  test('après la première partie : « À faire » revient, la bulle parle de la partie comme le bouton', async ({ page }) => {
    await preparer(page);
    // #309 : « Rejouer » suppose une partie finie contre Pomme (ici perdue).
    await semer(page, { 'go.parties.v1': JSON.stringify({ n: 1, dernier: 'pomme', ordi: 1 }), 'go.bilan.v1': JSON.stringify({ pomme: { v: 0, d: 1 } }) });
    await page.goto('/');
    await expect(page.locator('.cta-sceau')).toContainText('Rejouer contre Pomme');
    await expect(page.getByTestId('etat-du-jour')).toHaveText('À faire');
    await expect(page.locator('.scene-bulle')).not.toContainText('Go du jour');
  });

  test.describe('iPhone, Safari', () => {
    test.use({ userAgent: IPHONE_SAFARI });
    const safari = (page: Page) => page.addInitScript(() => {
      Object.defineProperty(navigator, 'standalone', { configurable: true, value: false });
      window.addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), { capture: true });
    });
    const carte = (page: Page) => page.getByRole('complementary', { name: 'Garde Mochi Go sous la main' });
    const retour = { 'go.retours.v1': JSON.stringify({ jour: 0, retours: 1 }), 'go.parties.v1': JSON.stringify({ n: 2, dernier: 'pomme', ordi: 2 }) };

    for (const theme of THEMES) {
      test(`2e retour : la carte d'installation prend la place de « À faire » (${theme})`, async ({ page }) => {
        await safari(page);
        await preparer(page, theme);
        await semer(page, retour);
        await page.goto('/');
        await expect(carte(page)).toBeVisible();
        await expect(page.getByTestId('etat-du-jour')).toHaveCount(0);
        await pasDeDefilementHorizontal(page);
        await page.screenshot({ path: `${DOSSIER}/accueil-installation-${theme}.png` });
      });
    }

    test("pas de carte d'installation le jour où Mochi a fait une annonce", async ({ page }) => {
      await safari(page);
      await preparer(page);
      // Jour de l'annonce : le numéro du Go du jour d'aujourd'hui (n° 1 le 27 septembre).
      await semer(page, { ...retour, 'go.annonce-du-jour.v1': '1' });
      await page.goto('/');
      await expect(page.locator('.cta-sceau')).toBeVisible();
      await expect(carte(page)).toHaveCount(0);
      await expect(page.getByTestId('etat-du-jour')).toHaveText('À faire');
    });
  });
});

test.describe('N2 : une fête à la fois, jamais sur la consigne', () => {
  for (const theme of THEMES) {
    test(`problème réussi : l'XP dans la feuille, rien sur le titre ni la consigne (${theme})`, async ({ page }) => {
      await preparer(page, theme);
      await semer(page, { 'go.xp.v1': '90' });
      await page.goto('/?go-du-jour=1');
      await jouer(page, 'E5');
      await attendrePierre(page, 'E5', 'noir');
      const feuille = page.locator('.verdict');
      await expect(feuille.getByTestId('pastille-xp')).toContainText(/\+40\sXP/);
      await page.waitForTimeout(600);
      // Ni carte de niveau ni pastille flottante pendant l'exercice.
      await expect(page.getByTestId('fete-niveau')).toHaveCount(0);
      await expect(page.locator('.annonce-xp .pastille-xp')).toHaveCount(0);
      await pasDeDefilementHorizontal(page);
      await page.screenshot({ path: `${DOSSIER}/probleme-reussi-${theme}.png` });
      // Fin de l'exercice : « Niveau 2 ! », seul.
      await page.getByRole('button', { name: 'Retour aux problèmes' }).first().click();
      await expect(page.getByTestId('fete-niveau')).toContainText(/Niveau\s2/);
      await expect(page.getByTestId('pastille-xp')).toHaveCount(0);
      await page.screenshot({ path: `${DOSSIER}/niveau-apres-probleme-${theme}.png` });
    });
  }
});

test.describe('N7 : « Passer » à part des aides', () => {
  for (const theme of THEMES) {
    test(`barre de partie : aides à gauche, « Passer » plein à droite, 44 px (${theme})`, async ({ page }) => {
      await preparer(page, theme);
      await semer(page, { 'go.parties.v1': JSON.stringify({ n: 3, dernier: 'pomme', ordi: 3 }), 'go.intro-but.v1': 'true' });
      await page.goto('/');
      await page.locator('.cta-sceau').click();
      const barre = page.getByRole('toolbar', { name: 'Actions de la partie' });
      await expect(barre).toBeVisible();
      const passer = barre.getByRole('button', { name: 'Passer' });
      const quiMene = barre.locator('[data-action="qui-mene"]');
      await expect(passer).toHaveClass(/decider/);
      const [p, q, filet] = await Promise.all([passer.boundingBox(), quiMene.boundingBox(), barre.locator('.actions-filet').boundingBox()]);
      expect(p!.height).toBeGreaterThanOrEqual(44);
      expect(p!.width).toBeGreaterThanOrEqual(44);
      expect(p!.x).toBeGreaterThan(filet!.x);
      expect(q!.x + q!.width).toBeLessThanOrEqual(filet!.x + 1);
      expect(p!.x + p!.width).toBeLessThanOrEqual(390);
      // Chaque libellé tient sur une ligne.
      for (const b of await barre.getByRole('button').all()) {
        const s = b.locator('span').last();
        const h = await s.evaluate(e => e.getBoundingClientRect().height);
        expect(h).toBeLessThan(24);
      }
      await pasDeDefilementHorizontal(page);
      await page.screenshot({ path: `${DOSSIER}/partie-barre-${theme}.png` });
    });
  }
});
