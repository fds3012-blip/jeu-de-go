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
  // Accueil v3 : sans XP, pas de barre (rien à lire avant la première pierre) ; elle arrive avec le premier gain.
  await expect(page.locator('.cta')).toBeVisible();
  await expect(barre).toHaveCount(0);

  await resoudreGoDuJour(page); // Go du jour : +20 XP, et +20 de bonus pour un premier problème (#162, #233)
  // Issue #162 : le gain se voit à la fin du problème.
  const pastille = page.getByTestId('pastille-xp');
  await expect(pastille).toBeVisible();
  await expect(pastille).toContainText(/\+40\sXP/);
  await expect(pastille).toContainText('dont +20 première fois');
  await page.screenshot({ path: 'docs/design/v2/captures/xp-pastille.png' });
  await nav(page).getByRole('button', { name: 'Jouer' }).click();
  await expect(barre).toContainText(/Niveau\s1/);
  await expect(barre).toContainText(/40\s\/\s100\sXP/);
  await expect(barre).toContainText('Kaya clair');
  await expect(page.getByRole('progressbar', { name: 'Niveau 1' })).toHaveAttribute('aria-valuenow', '40');
  // L'action principale reste visible sans défiler.
  await expect(page.locator('.cta-sceau')).toBeInViewport();
  await page.screenshot({ path: 'docs/design/v2/captures/xp-accueil.png' });
});

test('un niveau franchi est célébré après le problème, seul, sans couvrir la consigne (#236)', async ({ page }) => {
  await preparer(page, 90);
  await resoudreGoDuJour(page); // 90 + 20 + 20 (premier problème) = 130 : niveau 2
  const fete = page.getByTestId('fete-niveau');
  // Pendant le problème : l'XP se lit dans la feuille de réussite, la fête de niveau attend.
  await expect(page.locator('.verdict').getByTestId('pastille-xp')).toContainText(/\+40\sXP/);
  await page.waitForTimeout(800);
  await expect(fete).toHaveCount(0);
  // Retour à l'accueil : « Niveau 2 ! », seul à l'écran.
  await nav(page).getByRole('button', { name: 'Jouer' }).click();
  await expect(fete).toBeVisible();
  await expect(fete).toContainText(/Niveau\s2/);
  await expect(page.getByTestId('pastille-xp')).toHaveCount(0);
  await page.screenshot({ path: 'docs/design/v2/captures/xp-celebration.png' });
  await fete.getByRole('button').click();
  await expect(fete).toHaveCount(0);
  await expect(page.getByTestId('barre-niveau')).toContainText(/30\s\/\s125\sXP/);
});

test('la pastille or se lit aussi en mode sombre', async ({ page }) => {
  await preparer(page);
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await resoudreGoDuJour(page);
  const pastille = page.getByTestId('pastille-xp');
  await expect(pastille).toContainText(/\+40\sXP/);
  // Aucun toucher capté : l'action principale de fin reste libre.
  await expect(page.locator('.annonce-xp')).toHaveCSS('pointer-events', 'none');
  await page.screenshot({ path: 'docs/design/v2/captures/xp-pastille-sombre.png' });
});
