import { readFileSync } from 'node:fs';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { ouvrirTous } from './problemes';
import { attendrePierre, jouer, ouvrirLancementOrdi, passerJusquAuScore, pierres, plateau, toucherCta } from './plateau';
import { brancher, fauxServeur } from './fauxSupabase';

// #538 (reprend #366) : hors ligne clair et IA prête. Après une première visite, sans réseau :
// - l'accueil dit ce qui marche, grise ce qui demande internet (en ligne, un ami) avec la raison, et garde l'ordi ;
// - « Jouer contre Pomme » va jusqu'au score, un problème se joue, une partie interrompue se reprend ;
// - Bambou sans l'IA sur le téléphone : Caillou ou « Plus tard », jamais une partie qui attend ;
// - Profil › Réglages › L'IA sur ton téléphone : télécharger (progression), prête, libérer la place, hors ligne.

const FICHIER = 'public/reseaux/g170-b6c96-s175395328-d26788732.f5d32604.bin.gz';
const RESEAU = '**/reseaux/g170-b6c96-s175395328-d26788732.f5d32604.bin.gz';
const NAV = (page: Page) => page.getByRole('navigation', { name: 'Navigation principale' });
/** Appareil qui a déjà joué : accueil complet (tuiles), sans l'introduction de la première partie. */
const DEJA_JOUE = { 'go.parties.v1': JSON.stringify({ n: 1, ordi: 1, dernier: 'pomme' }), 'go.intro-but.v1': 'true', 'go.premiere-pierre.v1': 'true' };

/** Attend que le service worker contrôle la page (il s'enregistre après l'accueil et ses polices). */
async function attendreServiceWorker(page: Page) {
  await page.waitForFunction(async () => {
    const r = await navigator.serviceWorker.ready;
    return r.active?.state === 'activated' && !!navigator.serviceWorker.controller;
  }, null, { timeout: 20_000 });
}

/** Première visite en ligne (service worker installé), puis coupure du réseau et réouverture de l'app. */
async function rouvrirHorsLigne(page: Page, context: BrowserContext) {
  await page.goto('/');
  await expect(page.locator('.cta')).toBeVisible();
  await attendreServiceWorker(page);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.cta')).toBeVisible();
}

async function stocker(page: Page, valeurs: Record<string, string>) {
  await page.addInitScript(v => {
    if (sessionStorage.getItem('e2e.stocke')) return;
    sessionStorage.setItem('e2e.stocke', '1');
    for (const [k, x] of Object.entries(v)) localStorage.setItem(k, x);
  }, valeurs);
}

/** Sert le réseau KataGo depuis le fichier versionné, et compte les demandes ; téléchargement permis dans ce build de test. */
async function servirReseau(page: Page) {
  const n = { v: 0 };
  await page.addInitScript(() => { (window as unknown as { __kataGoTelechargement: boolean }).__kataGoTelechargement = true; });
  await page.route(RESEAU, route => {
    n.v++;
    return route.fulfill({ status: 200, body: readFileSync(FICHIER), headers: { 'content-type': 'application/octet-stream' } });
  });
  return n;
}

async function ouvrirReglages(page: Page) {
  await NAV(page).getByRole('button', { name: 'Profil' }).click();
  await page.getByRole('button', { name: /^Réglages/ }).click();
  await expect(page.getByRole('heading', { name: 'L’IA sur ton téléphone' })).toBeVisible();
}

test('accueil hors ligne avec les comptes : bandeau, « En ligne » et « Un ami » grisés avec la raison, Pomme jusqu’au score', async ({ context }) => {
  const erreurs: string[] = [];
  const page = await brancher(context, fauxServeur(), DEJA_JOUE);
  page.on('pageerror', e => erreurs.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // En ligne : la partie classée est l'action principale, ses tuiles sont actives.
  await page.goto('/');
  await expect(page.locator('.cta[data-mode="en_ligne"]')).toBeVisible();
  await expect(page.getByTestId('mode-ami')).not.toHaveAttribute('aria-disabled', 'true');
  await attendreServiceWorker(page);

  await context.setOffline(true);
  await page.reload();
  const bandeau = page.getByTestId('bandeau-hors-ligne');
  await expect(bandeau).toHaveAttribute('data-ou', 'accueil');
  await expect(bandeau).toContainText('Tu peux jouer contre l’ordi, faire les leçons et les problèmes.');
  // L'action principale reste là : l'ordi.
  await expect(page.locator('.cta')).toHaveAttribute('data-mode', 'ordi');
  await expect(page.locator('.cta')).toHaveAccessibleName(/contre Pomme$/);
  // Ce qui demande internet reste à sa place, grisé, et dit pourquoi (jamais un bouton qui échoue en silence).
  for (const [mode, nom] of [['en_ligne', 'En ligne'], ['ami', 'Un ami']] as const) {
    const tuile = page.getByTestId(`mode-${mode}`);
    await expect(tuile).toHaveAttribute('aria-disabled', 'true');
    await expect(tuile).toContainText('Il faut internet');
    await expect(tuile).toHaveAccessibleName(`${nom} : il faut internet`);
    expect((await tuile.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    // Un toucher n'emmène nulle part (aria-disabled : Playwright refuse le clic ordinaire, on force le geste).
    await tuile.click({ force: true });
    await expect(page.locator('.cta')).toBeVisible();
    await expect(page.getByTestId('modes')).toBeVisible();
  }
  // Aucun débordement à 390 px.
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

  await toucherCta(page);
  await expect(plateau(page)).toBeVisible();
  await expect(page.getByTestId('repli-hors-ligne')).toHaveCount(0);
  // Pas de bandeau pendant la partie : elle marche sans réseau.
  await expect(bandeau).toHaveCount(0);
  await passerJusquAuScore(page);
  await expect(page.locator('.recit')).toBeVisible({ timeout: 15_000 });
  expect(erreurs).toEqual([]);
});

test('hors ligne : un problème se joue jusqu’au « Bravo »', async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await rouvrirHorsLigne(page, context);
  await NAV(page).getByRole('button', { name: 'Problèmes' }).click();
  await ouvrirTous(page);
  await page.getByRole('button', { name: /^Problème \d+ : Capture la pierre/ }).click();
  await expect(plateau(page)).toBeVisible();
  await jouer(page, 'E5');
  await expect(page.getByText('Bravo, c’est le bon coup !')).toBeVisible();
  await attendrePierre(page, 'D5', null);
});

test('#528 hors ligne : une partie interrompue contre Pomme se reprend où elle s’était arrêtée', async ({ page, context }) => {
  await stocker(page, DEJA_JOUE);
  await page.goto('/');
  await attendreServiceWorker(page);
  await toucherCta(page);
  await expect(plateau(page)).toBeVisible();
  await jouer(page, 'C3');
  await expect(pierres(page, 'blanc')).toHaveCount(1, { timeout: 10_000 });
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('go.partie.encours.v1') ?? '{}').coups)).toBe(2);

  await context.setOffline(true);
  await page.goto('/');
  const tuile = page.getByTestId('tuile-reprise');
  await expect(tuile).toBeVisible();
  await tuile.click();
  await expect(plateau(page)).toBeVisible();
  await attendrePierre(page, 'C3', 'noir');
  await expect(pierres(page, 'blanc')).toHaveCount(1);
  // La partie continue sans réseau : Pomme répond.
  await jouer(page, 'G7');
  await expect(pierres(page, 'blanc')).toHaveCount(2, { timeout: 10_000 });
});

test('Bambou hors ligne sans l’IA : Caillou ou « Plus tard » ; avec l’IA téléchargée, Bambou joue', async ({ page, context }) => {
  await stocker(page, { ...DEJA_JOUE, 'go.bilan.v1': JSON.stringify({ pomme: { v: 1, d: 0 }, caillou: { v: 1, d: 0 } }), 'go.adversaire.v1': '"bambou"' });
  const reseau = await servirReseau(page);
  await rouvrirHorsLigne(page, context);
  await expect(page.locator('.cta')).toHaveAccessibleName(/contre Bambou$/);

  await toucherCta(page);
  const feuille = page.getByTestId('repli-hors-ligne');
  await expect(feuille).toBeVisible();
  await expect(feuille.getByRole('heading', { name: 'Bambou a besoin de l’IA' })).toBeVisible();
  await feuille.getByRole('button', { name: 'Plus tard' }).click();
  await expect(feuille).toHaveCount(0);
  await expect(page.locator('.cta')).toHaveAccessibleName(/contre Bambou$/);
  expect(reseau.v).toBe(0);

  await toucherCta(page);
  await page.getByTestId('repli-hors-ligne').getByRole('button', { name: 'Jouer contre Caillou' }).click();
  await expect(plateau(page)).toBeVisible();
  await expect(page.locator('.joueur[data-joueur="Caillou"]')).toBeVisible();
  await page.locator('button.retour').click();

  // Retour du réseau : l'IA se télécharge depuis les Réglages ; ensuite, hors ligne, Bambou joue sans rien demander.
  await context.setOffline(false);
  await ouvrirReglages(page);
  await page.getByTestId('ia-telecharger').click();
  await expect(page.getByTestId('reglage-ia')).toHaveAttribute('data-etat', 'prete', { timeout: 30_000 });
  await context.setOffline(true);
  await NAV(page).getByRole('button', { name: 'Jouer' }).click();
  await ouvrirLancementOrdi(page);
  await page.getByRole('dialog').getByRole('button', { name: /^Bambou/ }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: /contre Bambou$/ }).click();
  await expect(plateau(page)).toBeVisible();
  await expect(page.getByTestId('repli-hors-ligne')).toHaveCount(0);
});

test('Réglages › L’IA sur ton téléphone : télécharger, prête, libérer la place, hors ligne', async ({ page, context }) => {
  const erreurs: string[] = [];
  page.on('pageerror', e => erreurs.push(e.message));
  const reseau = await servirReseau(page);
  await page.goto('/');
  await expect(page.locator('.cta')).toBeVisible();
  await ouvrirReglages(page);
  const ia = page.getByTestId('reglage-ia');
  await expect(ia).toHaveAttribute('data-etat', 'a-telecharger');
  await expect(ia).toContainText('3,8 Mo à télécharger, une seule fois. Mieux en Wi-Fi.');
  const bouton = page.getByTestId('ia-telecharger');
  await expect(bouton).toHaveText('Télécharger l’IA maintenant');
  expect((await bouton.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await bouton.click();
  await expect(ia).toHaveAttribute('data-etat', 'prete', { timeout: 30_000 });
  await expect(ia.getByRole('status')).toHaveText('C’est fait : l’IA est sur ton téléphone.');
  expect(reseau.v).toBe(1);
  const enCache = () => page.evaluate(async () => {
    const [m] = await (window as unknown as { __moteurE2E: () => Promise<[{ reseauEnCache(): Promise<boolean> }]> }).__moteurE2E();
    return m.reseauEnCache();
  });
  expect(await enCache()).toBe(true);

  // Revenir plus tard : l'état est relu du cache.
  await NAV(page).getByRole('button', { name: 'Jouer' }).click();
  await ouvrirReglages(page);
  await expect(ia).toHaveAttribute('data-etat', 'prete');
  await expect(ia).toContainText('Prête, même hors ligne. Elle prend 3,8 Mo.');

  await page.getByTestId('ia-liberer').click();
  await expect(ia).toHaveAttribute('data-etat', 'a-telecharger');
  await expect(ia.getByRole('status')).toHaveText('Place libérée. Tu pourras la retélécharger ici.');
  expect(await enCache()).toBe(false);

  // Hors ligne, pas de bouton qui échouerait : la raison, en clair.
  await context.setOffline(true);
  await expect(ia).toHaveAttribute('data-etat', 'hors-ligne');
  await expect(ia).toContainText('Tu es hors ligne : connecte-toi pour la télécharger.');
  await expect(page.getByTestId('ia-telecharger')).toHaveCount(0);
  expect(erreurs).toEqual([]);
});

test('Settings › AI on your phone, in English', async ({ page }) => {
  await page.goto('/?lang=en');
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Profile' }).click();
  await page.getByRole('button', { name: /^Settings/ }).click();
  await expect(page.getByRole('heading', { name: 'AI on your phone' })).toBeVisible();
  await expect(page.getByTestId('reglage-ia')).toContainText('3.8 MB to download, just once. Best on Wi-Fi.');
  await expect(page.getByTestId('ia-telecharger')).toHaveText('Download the AI now');
});
