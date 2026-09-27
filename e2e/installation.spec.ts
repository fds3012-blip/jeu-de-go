import { expect, test, type Page } from '@playwright/test';
import { attendrePierre, jouer, passerJusquAuScore } from './plateau';

// Issue #178 : proposer d'installer l'app au bon moment (ici, un Go du jour réussi), une seule fois, refus mémorisé.
// Horloge figée le 27 septembre 2026 à midi, heure de Paris : Go du jour n° 1, le problème b1 (réponse E5).
const MIDI_PARIS = new Date('2026-09-27T12:00:00+02:00');
const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

/** Safari iOS : `navigator.standalone` vaut faux hors de l'app installée ; Chromium ne doit pas envoyer sa propre invite. */
async function commeSafari(page: Page, installee = false) {
  await page.addInitScript((standalone: boolean) => {
    Object.defineProperty(navigator, 'standalone', { configurable: true, value: standalone });
    window.addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), { capture: true });
  }, installee);
}

async function reussirGoDuJour(page: Page) {
  await page.clock.setFixedTime(MIDI_PARIS);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?go-du-jour=1');
  await expect(page.getByText(/^Go du jour n°\s1$/)).toBeVisible();
  await jouer(page, 'E5');
  await attendrePierre(page, 'E5', 'noir');
  await expect(page.getByRole('button', { name: 'Partager' })).toBeVisible();
}

const carte = (page: Page) => page.getByRole('complementary', { name: 'Garde le go sous la main' });

test.describe('iPhone, Safari', () => {
  test.use({ userAgent: IPHONE_SAFARI });

  test('la carte apparaît après un Go du jour réussi, et ne revient pas après « Plus tard »', async ({ page }) => {
    await commeSafari(page);
    await reussirGoDuJour(page);

    // La carte montre les deux gestes de Safari ; « Partager » reste l'action principale de l'écran.
    await expect(carte(page)).toBeVisible();
    await expect(carte(page)).toContainText('Partager');
    await expect(carte(page)).toContainText(/Sur l.écran d.accueil/);
    await expect(carte(page).getByRole('button', { name: 'Installer' })).toHaveCount(0);
    await expect(page.locator('.cta')).toHaveCount(1);

    const plusTard = carte(page).getByRole('button', { name: 'Plus tard' });
    const boite = await plusTard.boundingBox();
    expect(boite!.height).toBeGreaterThanOrEqual(44);
    await plusTard.click();
    await expect(carte(page)).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('go.installation.v1'))).toBe('refusee');

    // Refaire le Go du jour, puis recharger : la carte ne revient pas.
    await page.getByRole('button', { name: 'Retour aux problèmes' }).first().click();
    await page.getByRole('button', { name: 'Refaire le Go du jour' }).click();
    await jouer(page, 'E5');
    await expect(page.getByRole('button', { name: 'Partager' })).toBeVisible();
    await expect(carte(page)).toHaveCount(0);

    await reussirGoDuJour(page);
    await expect(carte(page)).toHaveCount(0);
  });

  test('première victoire contre l’ordi : la carte arrive sous l’action principale, pas pendant la partie, et une seule fois', async ({ page }) => {
    await commeSafari(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?komi=-100');
    await page.locator('.cta').click();
    await expect(page.getByRole('button', { name: 'Passer' })).toBeVisible();
    await expect(carte(page)).toHaveCount(0);
    await passerJusquAuScore(page);
    await expect(page.getByRole('heading', { level: 2, name: 'Victoire' })).toBeVisible();
    await expect(carte(page)).toBeVisible();
    // Une seule action en relief : « Défier Caillou », toujours visible sans défiler.
    await expect(page.locator('.cta')).toHaveCount(1);
    const cta = (await page.getByRole('button', { name: 'Défier Caillou' }).boundingBox())!;
    expect(cta.y + cta.height).toBeLessThanOrEqual(844);

    // Montrée une fois suffit : repères posés, même sans réponse (le « jamais deux fois » est testé dans installation.test.ts).
    expect(await page.evaluate(() => [localStorage.getItem('go.installation.v1'), localStorage.getItem('go.premiere-victoire.v1')])).toEqual(['proposee', '1']);
    await page.reload();
    await expect(carte(page)).toHaveCount(0);
  });

  test('déjà installée (lancée depuis l’écran d’accueil) : rien', async ({ page }) => {
    await commeSafari(page, true);
    await reussirGoDuJour(page);
    await expect(carte(page)).toHaveCount(0);
  });
});

test('Chrome : l’invite capturée s’ouvre sur « Installer », et l’acceptation est mémorisée', async ({ page }) => {
  // Invite simulée : Chromium sans écran ne l'envoie pas de façon fiable.
  await page.addInitScript(() => {
    const w = window as unknown as { __invites: number };
    w.__invites = 0;
    window.addEventListener('beforeinstallprompt', e => {
      if (!(e as Event & { simulee?: boolean }).simulee) e.stopImmediatePropagation();
    }, { capture: true });
    window.addEventListener('load', () => {
      const e = new Event('beforeinstallprompt', { cancelable: true }) as Event & Record<string, unknown>;
      e.simulee = true;
      e.prompt = async () => { w.__invites++; };
      e.userChoice = Promise.resolve({ outcome: 'accepted' });
      window.dispatchEvent(e);
    });
  });
  await reussirGoDuJour(page);
  await carte(page).getByRole('button', { name: 'Installer' }).click();
  await expect(carte(page)).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __invites: number }).__invites)).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem('go.installation.v1'))).toBe('acceptee');
});

test('navigateur sans installation possible : rien, et le Go du jour reste le même', async ({ page }) => {
  await page.addInitScript(() => window.addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), { capture: true }));
  await reussirGoDuJour(page);
  await expect(carte(page)).toHaveCount(0);
});
