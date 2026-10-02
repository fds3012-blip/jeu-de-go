import { expect, test, type Page } from '@playwright/test';
import { lancerADeux, plateau } from './plateau';

// Robustesse (#325, point 4) : jamais d'écran blanc ni d'erreur brute.
// 1. Un écran chargé à la demande qui n'arrive pas : écran d'erreur avec Mochi, « Réessayer », retour à l'accueil.
// 2. Hors ligne : bandeau « Tu es hors ligne » sur les écrans qui ont besoin du réseau, pas sur ceux qui marchent sans.
// 3. Nouvelle version : invite « Mise à jour prête », jamais pendant une partie.

const NAV = (page: Page) => page.getByRole('navigation', { name: 'Navigation principale' });
const RECHARGE_KEY = 'go.recharge-version.v1';

/** Attend que le service worker contrôle la page (il s'enregistre après l'accueil et ses polices). */
async function attendreServiceWorker(page: Page) {
  await page.waitForFunction(async () => {
    const r = await navigator.serviceWorker.ready;
    return r.active?.state === 'activated' && !!navigator.serviceWorker.controller;
  }, null, { timeout: 20_000 });
}

test.describe('écran manquant', () => {
  // Sans service worker : Playwright peut intercepter les requêtes des morceaux JS.
  test.use({ serviceWorkers: 'block' });

  test('le morceau du Profil ne se charge pas : écran d’erreur avec Mochi, retour à l’accueil, puis Réessayer', async ({ page }) => {
    // L'app recharge une fois quand un morceau manque (nouvelle version) : ici, on fait comme si elle venait de le faire.
    await page.addInitScript(k => sessionStorage.setItem(k, String(Date.now())), RECHARGE_KEY);
    await page.route(/\/assets\/Profil-[\w-]+\.js(\?.*)?$/, r => r.abort('failed'));
    await page.goto('/');
    await expect(page.locator('.cta')).toBeVisible();

    await NAV(page).getByRole('button', { name: 'Profil' }).click();
    const erreur = page.getByTestId('ecran-erreur');
    // Trois nouveaux essais espacés (0,5 + 1,5 + 3 s) avant d'abandonner.
    await expect(erreur).toBeVisible({ timeout: 20_000 });
    await expect(erreur).toHaveAttribute('data-categorie', 'chargement');
    await expect(erreur.getByRole('heading', { name: 'Oups, ça n’a pas marché.' })).toBeVisible();
    await expect(erreur.getByText(/Cet écran n’a pas pu se charger/)).toBeVisible();
    await expect(erreur.getByRole('button', { name: 'Réessayer' })).toBeVisible();
    // Pas d'erreur brute, et la barre de navigation reste.
    await expect(erreur).not.toContainText(/dynamically imported|TypeError|Failed/);
    await expect(NAV(page)).toBeVisible();
    await expect(page.locator('#root')).not.toBeEmpty();

    // Retour à l'accueil sans recharger.
    await erreur.getByRole('button', { name: 'Retour à l’accueil' }).click();
    await expect(erreur).toHaveCount(0);
    await expect(page.locator('.cta')).toBeVisible();

    // Le réseau revient : « Réessayer » repart sur une page propre et le Profil s'ouvre.
    await page.unroute(/\/assets\/Profil-[\w-]+\.js(\?.*)?$/);
    await NAV(page).getByRole('button', { name: 'Profil' }).click();
    await expect(erreur).toBeVisible({ timeout: 20_000 });
    await erreur.getByRole('button', { name: 'Réessayer' }).click();
    await expect(page.locator('.cta')).toBeVisible();
    await NAV(page).getByRole('button', { name: 'Profil' }).click();
    await expect(page.getByRole('heading', { name: 'Ton parcours' })).toBeVisible();
  });

  test('en anglais, l’écran d’erreur parle anglais', async ({ page }) => {
    await page.addInitScript(k => sessionStorage.setItem(k, String(Date.now())), RECHARGE_KEY);
    await page.route(/\/assets\/Profil-[\w-]+\.js(\?.*)?$/, r => r.abort('failed'));
    await page.goto('/?lang=en');
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Profile' }).click();
    const erreur = page.getByTestId('ecran-erreur');
    await expect(erreur.getByRole('heading', { name: 'Oops, that didn’t work.' })).toBeVisible({ timeout: 20_000 });
    await expect(erreur.getByRole('button', { name: 'Try again' })).toBeVisible();
    await expect(erreur.getByRole('button', { name: 'Back to home' })).toBeVisible();
  });
});

test('hors ligne : bandeau sur le Profil (compte), rien sur l’accueil ni dans Apprendre, et il disparaît au retour du réseau', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.locator('.cta')).toBeVisible();
  await attendreServiceWorker(page);

  await context.setOffline(true);
  const bandeau = page.getByTestId('bandeau-hors-ligne');
  // L'accueil marche hors ligne : pas de bandeau.
  await expect(page.locator('.cta')).toBeVisible();
  await expect(bandeau).toHaveCount(0);
  // Le Profil (compte, synchronisation) a besoin du réseau : bandeau discret, écran toujours là.
  await NAV(page).getByRole('button', { name: 'Profil' }).click();
  await expect(page.getByRole('heading', { name: 'Ton parcours' })).toBeVisible();
  await expect(bandeau).toBeVisible();
  await expect(bandeau).toContainText('Tu es hors ligne');
  // Apprendre marche hors ligne : pas de bandeau.
  await NAV(page).getByRole('button', { name: 'Apprendre' }).click();
  await expect(page.getByRole('button', { name: /^Leçon 1 :/ })).toBeVisible();
  await expect(bandeau).toHaveCount(0);

  await context.setOffline(false);
  await NAV(page).getByRole('button', { name: 'Profil' }).click();
  await expect(page.getByRole('heading', { name: 'Ton parcours' })).toBeVisible();
  await expect(bandeau).toHaveCount(0);
});

test('nouvelle version : invite « Mise à jour prête », jamais pendant une partie, « Plus tard » la cache', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.cta')).toBeVisible();
  await attendreServiceWorker(page);
  const invite = page.getByTestId('invite-mise-a-jour');
  await expect(invite).toHaveCount(0);

  // Une partie en cours : le nouveau service worker prend la page, l'invite attend.
  await lancerADeux(page);
  await expect(plateau(page)).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.dispatchEvent(new Event('controllerchange')));
  await expect(invite).toHaveCount(0);

  // Retour à l'accueil : l'invite se montre, discrète, avec « Recharger ».
  await page.locator('button.retour').click();
  await expect(page.locator('.cta')).toBeVisible();
  await expect(invite).toBeVisible();
  await expect(invite).toContainText('Mise à jour prête');
  await expect(invite.getByRole('button', { name: 'Recharger' })).toBeVisible();

  await invite.getByRole('button', { name: 'Plus tard' }).click();
  await expect(invite).toHaveCount(0);
});

// Captures (docs/design/captures/robustesse-02-10/) : `CAPTURES=1 PW_PORT=… npx playwright test e2e/robustesse.spec.ts`.
const TAILLES = [[390, 844], [320, 568]] as const;
const DOSSIER = 'docs/design/captures/robustesse-02-10';

test.describe('captures : écran d’erreur', () => {
  test.use({ serviceWorkers: 'block' });
  test('clair et sombre, 390 et 320', async ({ page }) => {
    test.skip(!process.env.CAPTURES, 'captures à la demande');
    await page.addInitScript(k => sessionStorage.setItem(k, String(Date.now())), RECHARGE_KEY);
    await page.route(/\/assets\/Profil-[\w-]+\.js(\?.*)?$/, r => r.abort('failed'));
    for (const [largeur, hauteur] of TAILLES) {
      await page.setViewportSize({ width: largeur, height: hauteur });
      for (const theme of ['dark', 'light'] as const) {
        await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
        const nom = `${theme === 'dark' ? 'sombre' : 'clair'}-${largeur}`;
        await page.goto('/');
        await expect(page.locator('.cta')).toBeVisible();
        await NAV(page).getByRole('button', { name: 'Profil' }).click();
        await expect(page.getByTestId('ecran-erreur')).toBeVisible({ timeout: 20_000 });
        await page.screenshot({ path: `${DOSSIER}/erreur-${nom}.png` });
      }
    }
  });
});

test('captures : bandeau hors ligne et mise à jour prête, clair et sombre, 390 et 320', async ({ page, context }) => {
  test.skip(!process.env.CAPTURES, 'captures à la demande');
  await page.goto('/');
  await expect(page.locator('.cta')).toBeVisible();
  await attendreServiceWorker(page);
  for (const [largeur, hauteur] of TAILLES) {
    await page.setViewportSize({ width: largeur, height: hauteur });
    for (const theme of ['dark', 'light'] as const) {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      const nom = `${theme === 'dark' ? 'sombre' : 'clair'}-${largeur}`;
      await context.setOffline(false);
      await page.reload();
      await expect(page.locator('.cta')).toBeVisible();
      await attendreServiceWorker(page);
      await page.evaluate(() => navigator.serviceWorker.dispatchEvent(new Event('controllerchange')));
      await context.setOffline(true);
      await NAV(page).getByRole('button', { name: 'Profil' }).click();
      await expect(page.getByTestId('bandeau-hors-ligne')).toBeVisible();
      await expect(page.getByTestId('invite-mise-a-jour')).toBeVisible();
      await page.screenshot({ path: `${DOSSIER}/bandeaux-${nom}.png` });
    }
  }
  await context.setOffline(false);
});
