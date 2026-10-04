import { expect, test, type Page } from '@playwright/test';
import { attendrePierre, jouer, passerJusquAuScore } from './plateau';

// Issue #178 : proposer d'installer l'app au bon moment, une seule fois, refus mémorisé.
// Issue #214 : plus au-dessus du plateau résolu du Go du jour ; sur l'accueil au 2e retour, et une ligne permanente dans le Profil.
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

const carte = (page: Page) => page.getByRole('complementary', { name: 'Garde Mochi Go sous la main' });

/** Jours d'ouverture déjà vus sur l'appareil (#214) : `retours` = jours distincts après le premier, le dernier la veille. */
async function dejaVenu(page: Page, retours: number) {
  await page.addInitScript(r => {
    if (sessionStorage.getItem('retours-semes')) return;
    sessionStorage.setItem('retours-semes', '1');
    localStorage.setItem('go.retours.v1', JSON.stringify({ jour: 0, retours: r }));
  }, retours);
}

const ongletProfil = (page: Page) => page.getByRole('navigation').getByRole('button', { name: 'Profil' });

test.describe('iPhone, Safari', () => {
  test.use({ userAgent: IPHONE_SAFARI });

  test('Go du jour réussi : plus de carte par-dessus le plateau résolu', async ({ page }) => {
    await commeSafari(page);
    await reussirGoDuJour(page);
    await expect(carte(page)).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('go.installation.v1'))).toBeNull();
  });

  test('accueil : rien au 1er retour, la carte compacte au 2e, puis plus jamais après « Plus tard »', async ({ page }) => {
    await commeSafari(page);
    await page.clock.setFixedTime(MIDI_PARIS);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await dejaVenu(page, 0); // hier, premier jour : aujourd'hui est le 1er retour
    await page.goto('/');
    await expect(page.locator('.cta')).toBeVisible();
    await expect(carte(page)).toHaveCount(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('go.retours.v1')!).retours)).toBe(1);

    // Le lendemain : 2e retour.
    await page.clock.setFixedTime(new Date(MIDI_PARIS.getTime() + 86_400_000));
    await page.reload();
    await expect(carte(page)).toBeVisible();
    // Sous l'action principale, qui reste seule en relief et visible sans défiler.
    await expect(page.locator('.cta')).toHaveCount(1);
    const cta = (await page.locator('.cta').boundingBox())!, boite = (await carte(page).boundingBox())!;
    expect(boite.y).toBeGreaterThan(cta.y + cta.height);
    const nav = (await page.getByRole('navigation').boundingBox())!;
    expect(boite.y + boite.height, 'carte entière au-dessus de la barre du bas').toBeLessThanOrEqual(nav.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

    // Compacte : les deux gestes de Safari s'ouvrent sur « Comment faire ? ».
    await expect(carte(page)).not.toContainText(/Sur l.écran d.accueil/);
    const comment = carte(page).getByRole('button', { name: 'Comment faire ?' });
    expect((await comment.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await comment.click();
    await expect(carte(page)).toContainText('Partager');
    await expect(carte(page)).toContainText(/Sur l.écran d.accueil/);
    await expect(carte(page).getByRole('list')).toBeFocused();

    const plusTard = carte(page).getByRole('button', { name: 'Plus tard' });
    expect((await plusTard.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await plusTard.click();
    await expect(carte(page)).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('go.installation.v1'))).toBe('refusee');

    // Le jour suivant : elle ne revient pas sur l'accueil…
    await page.clock.setFixedTime(new Date(MIDI_PARIS.getTime() + 2 * 86_400_000));
    await page.reload();
    await expect(page.locator('.cta')).toBeVisible();
    await expect(carte(page)).toHaveCount(0);
    // … mais la ligne du Profil reste, et montre les deux gestes.
    await ongletProfil(page).click();
    await page.getByRole('button', { name: 'Installer l’app' }).click();
    await expect(page.getByRole('heading', { name: 'Installer l’app' })).toBeVisible();
    await expect(carte(page)).toContainText(/Sur l.écran d.accueil/);
    await expect(carte(page).getByRole('button', { name: 'Plus tard' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Retour' }).click();
    await expect(page.getByRole('heading', { name: 'Ton parcours' })).toBeVisible();
  });

  test('montrée une fois sans réponse : elle ne revient pas sur l’accueil', async ({ page }) => {
    await commeSafari(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await dejaVenu(page, 1);
    await page.goto('/');
    await expect(carte(page)).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('go.installation.v1'))).toBe('proposee');
    await page.reload();
    await expect(page.locator('.cta')).toBeVisible();
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

  test('déjà installée (lancée depuis l’écran d’accueil) : rien, ni sur l’accueil ni dans le Profil', async ({ page }) => {
    await commeSafari(page, true);
    await dejaVenu(page, 3);
    await page.goto('/');
    await expect(page.locator('.cta')).toBeVisible();
    await expect(carte(page)).toHaveCount(0);
    await ongletProfil(page).click();
    await expect(page.getByRole('heading', { name: 'Ton parcours' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Installer l’app' })).toHaveCount(0);
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
  await dejaVenu(page, 1);
  await page.goto('/');
  await carte(page).getByRole('button', { name: 'Installer' }).click();
  await expect(carte(page)).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __invites: number }).__invites)).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem('go.installation.v1'))).toBe('acceptee');
  // Installée : plus de ligne dans le Profil.
  await ongletProfil(page).click();
  await expect(page.getByRole('heading', { name: 'Ton parcours' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Installer l’app' })).toHaveCount(0);
});

test('Chrome : « Installer l’app » depuis le Profil ouvre l’invite', async ({ page }) => {
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
      e.userChoice = Promise.resolve({ outcome: 'dismissed' });
      window.dispatchEvent(e);
    });
  });
  await page.goto('/');
  await page.waitForFunction(() => document.readyState === 'complete');
  await ongletProfil(page).click();
  await page.getByRole('button', { name: 'Installer l’app' }).click();
  await page.getByRole('complementary', { name: 'Garde Mochi Go sous la main' }).getByRole('button', { name: 'Installer' }).click();
  // Refusée dans l'invite : retour au Profil, sans repère « refusée » posé (c'est le joueur qui l'avait demandée).
  await expect(page.getByRole('heading', { name: 'Ton parcours' })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __invites: number }).__invites)).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem('go.installation.v1'))).toBeNull();
});

test('navigateur sans installation possible : rien, ni carte ni ligne dans le Profil', async ({ page }) => {
  await page.addInitScript(() => window.addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), { capture: true }));
  await dejaVenu(page, 2);
  await page.goto('/');
  await expect(page.locator('.cta')).toBeVisible();
  await expect(carte(page)).toHaveCount(0);
  await ongletProfil(page).click();
  await expect(page.getByRole('heading', { name: 'Ton parcours' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Installer l’app' })).toHaveCount(0);
});
