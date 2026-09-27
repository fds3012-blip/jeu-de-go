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

  await resoudreGoDuJour(page); // Go du jour : +20 XP
  await nav(page).getByRole('button', { name: 'Jouer' }).click();
  await expect(barre).toContainText(/20\s\/\s100\sXP/);
  await expect(page.getByRole('progressbar', { name: 'Niveau 1' })).toHaveAttribute('aria-valuenow', '20');
  // L'action principale reste visible sans défiler.
  await expect(page.locator('.cta-sceau')).toBeInViewport();
  await page.screenshot({ path: 'docs/design/v2/captures/xp-accueil.png' });
});

test('un niveau franchi est célébré à la fin du problème', async ({ page }) => {
  await preparer(page, 90);
  await resoudreGoDuJour(page); // 90 + 20 = 110 : niveau 2
  const fete = page.getByTestId('fete-niveau');
  await expect(fete).toBeVisible();
  await expect(fete).toContainText(/Niveau\s2/);
  await page.screenshot({ path: 'docs/design/v2/captures/xp-celebration.png' });
  await fete.getByRole('button').click();
  await expect(fete).toHaveCount(0);

  await nav(page).getByRole('button', { name: 'Jouer' }).click();
  await expect(page.getByTestId('barre-niveau')).toContainText(/10\s\/\s125\sXP/);
});
