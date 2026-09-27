import { expect, test, type Page } from '@playwright/test';
import { attendrePierre, jouer } from './plateau';

// Issue #109 : XP, niveaux et récompenses. Un problème réussi fait avancer la barre de niveau de l'accueil.
// Horloge figée le 27 septembre 2026 à midi, heure de Paris : Go du jour n° 1, le problème b1 (réponse E5).
const MIDI_PARIS = new Date('2026-09-27T12:00:00+02:00');

async function preparer(page: Page, xp?: number) {
  await page.clock.setFixedTime(MIDI_PARIS);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // XP de départ, posés une seule fois (pas à chaque navigation).
  if (xp !== undefined) await page.addInitScript(v => { if (localStorage.getItem('go.xp.v1') === null) localStorage.setItem('go.xp.v1', String(v)); }, xp);
}

const nav = (page: Page) => page.getByRole('navigation', { name: 'Navigation principale' });

async function resoudreGoDuJour(page: Page) {
  await page.goto('/?go-du-jour=1');
  await jouer(page, 'E5');
  await attendrePierre(page, 'E5', 'noir');
}

test("un problème réussi fait monter l'XP sur l'accueil", async ({ page }) => {
  await preparer(page);
  await page.goto('/');
  const barre = page.getByTestId('barre-niveau');
  await expect(barre).toContainText(/Niveau\s1/);
  await expect(barre).toContainText(/0\s\/\s100\sXP/);
  await expect(barre).toContainText('Kaya clair');

  await resoudreGoDuJour(page); // Go du jour : +20 XP, et +10 de bonus pour un premier problème (#162)
  // Issue #162 : le gain se voit à la fin du problème.
  const pastille = page.getByTestId('pastille-xp');
  await expect(pastille).toBeVisible();
  await expect(pastille).toContainText(/\+30\sXP/);
  await expect(pastille).toContainText('dont +10 première fois');
  await page.screenshot({ path: 'docs/design/v2/captures/xp-pastille.png' });
  await nav(page).getByRole('button', { name: 'Jouer' }).click();
  await expect(barre).toContainText(/30\s\/\s100\sXP/);
  await expect(page.getByRole('progressbar', { name: 'Niveau 1' })).toHaveAttribute('aria-valuenow', '30');
  // L'action principale reste visible sans défiler.
  await expect(page.locator('.cta-sceau')).toBeInViewport();
  await page.screenshot({ path: 'docs/design/v2/captures/xp-accueil.png' });
});

test('un niveau franchi est célébré à la fin du problème', async ({ page }) => {
  await preparer(page, 90);
  await resoudreGoDuJour(page); // 90 + 20 + 10 (premier problème) = 120 : niveau 2
  const fete = page.getByTestId('fete-niveau');
  await expect(fete).toBeVisible();
  await expect(fete).toContainText(/Niveau\s2/);
  // La pastille se range sous la carte, sans la chevaucher.
  const [carte, pastille] = await Promise.all([fete.boundingBox(), page.getByTestId('pastille-xp').boundingBox()]);
  expect(pastille!.y).toBeGreaterThanOrEqual(carte!.y + carte!.height);
  await page.screenshot({ path: 'docs/design/v2/captures/xp-celebration.png' });
  await fete.getByRole('button').click();
  await expect(fete).toHaveCount(0);

  await nav(page).getByRole('button', { name: 'Jouer' }).click();
  await expect(page.getByTestId('barre-niveau')).toContainText(/20\s\/\s125\sXP/);
});

test('la pastille or se lit aussi en mode sombre', async ({ page }) => {
  await preparer(page);
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await resoudreGoDuJour(page);
  const pastille = page.getByTestId('pastille-xp');
  await expect(pastille).toContainText(/\+30\sXP/);
  // Aucun toucher capté : l'action principale de fin reste libre.
  await expect(page.locator('.annonce-xp')).toHaveCSS('pointer-events', 'none');
  await page.screenshot({ path: 'docs/design/v2/captures/xp-pastille-sombre.png' });
});
