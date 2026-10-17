import { expect, test, type Browser, type Page } from '@playwright/test';
import { brancher, fauxServeur, JETON, type FauxServeur } from './fauxSupabase';
import { choisirMode, jouer, lancerADeux, plateau } from './plateau';

// #606 (lot N1, règle A7 de DESIGN.md) : le retour du système (Android, navigateur, geste d'iOS) fait ce que fait
// « ‹ » : `page.goBack()` sur chaque famille d'écran. Une feuille se ferme d'abord ; une partie demande confirmation ;
// à la racine d'Apprendre, de Problèmes ou du Profil, retour à Jouer ; à la racine de Jouer, le système sort.

const nav = (page: Page) => page.getByRole('navigation', { name: 'Navigation principale' });
const onglet = (page: Page, nom: string) => nav(page).getByRole('button', { name: nom });

/** L'accueil de Jouer, sans entrée d'historique en trop : le retour suivant sortira. */
async function racineJouer(page: Page) {
  await expect(onglet(page, 'Jouer')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('main.app-home .cta').first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => (history.state as { garde?: boolean } | null)?.garde ?? false)).toBe(false);
}

/** Le retour du système est branché après le premier écran : on attend sa marque dans l'historique. */
async function ouvrir(page: Page, adresse = '/') {
  await page.goto(adresse);
  await expect.poll(() => page.evaluate(() => typeof (history.state as { mochiNav?: number } | null)?.mochiNav)).toBe('number');
}

/**
 * Le retour du système (bouton ou geste d'Android, retour du navigateur). La garde est posée à l'image qui suit
 * l'ouverture d'un écran ; un doigt n'est jamais plus rapide, Playwright si : on l'attend.
 */
async function retour(page: Page) {
  await expect.poll(() => page.evaluate(() => (history.state as { garde?: boolean } | null)?.garde ?? false)).toBe(true);
  await page.goBack();
}

test('Réglages : retour au Profil, puis à Jouer, puis le système sort', async ({ page }) => {
  await ouvrir(page);
  await onglet(page, 'Profil').click();
  await page.getByRole('button', { name: 'Réglages', exact: true }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Réglages' })).toBeVisible();

  await retour(page);
  await expect(page.getByRole('heading', { level: 2, name: 'Réglages' })).toHaveCount(0);
  await expect(onglet(page, 'Profil')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.retour')).toHaveCount(0);

  await retour(page);
  await racineJouer(page);

  // À la racine de Jouer : le système fait (ici, le navigateur revient à la page d'avant l'app).
  await page.goBack();
  await expect(page).toHaveURL('about:blank');
});

test('deux retours rapides : un « ‹ » chacun, sans sortir de l’app', async ({ page }) => {
  await ouvrir(page);
  await onglet(page, 'Profil').click();
  await page.getByRole('button', { name: 'Réglages', exact: true }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Réglages' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (history.state as { garde?: boolean } | null)?.garde ?? false)).toBe(true);
  await page.evaluate(() => { history.back(); setTimeout(() => history.back(), 30); });
  await racineJouer(page);
  expect(page.url()).toMatch(/^http:\/\/localhost:\d+\/$/);
});

test('Échap fait le retour sur ordinateur', async ({ page }) => {
  await ouvrir(page);
  await onglet(page, 'Profil').click();
  await page.getByRole('button', { name: 'Réglages', exact: true }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Réglages' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { level: 2, name: 'Réglages' })).toHaveCount(0);
  await expect(onglet(page, 'Profil')).toHaveAttribute('aria-current', 'page');
  await page.keyboard.press('Escape');
  await racineJouer(page);
  // À la racine de Jouer, Échap ne fait rien.
  await page.keyboard.press('Escape');
  await racineJouer(page);
});

test('leçon : retour au chemin d’Apprendre, puis à Jouer', async ({ page }) => {
  await ouvrir(page);
  await onglet(page, 'Apprendre').click();
  await page.getByRole('button', { name: /^Leçon 1 :/ }).first().click();
  await expect(plateau(page)).toBeVisible();
  await retour(page);
  await expect(plateau(page)).toHaveCount(0);
  await expect(onglet(page, 'Apprendre')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('button', { name: /^Leçon 1 :/ }).first()).toBeVisible();
  await retour(page);
  await racineJouer(page);
});

test('problème : retour à la liste de Problèmes, puis à Jouer', async ({ page }) => {
  await ouvrir(page);
  await onglet(page, 'Problèmes').click();
  await page.getByRole('button', { name: 'Résoudre le Go du jour' }).click();
  await expect(plateau(page)).toBeVisible();
  await retour(page);
  await expect(plateau(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Résoudre le Go du jour' })).toBeVisible();
  await retour(page);
  await racineJouer(page);
});

test('partie commencée : le retour demande confirmation, comme « ‹ »', async ({ page }) => {
  await ouvrir(page);
  await lancerADeux(page);
  await jouer(page, 'E5');
  const question = page.getByRole('group', { name: 'Quitter la partie ?' });

  await retour(page);
  await expect(question).toBeVisible();
  await expect(plateau(page)).toBeVisible();
  // Un second retour répond « Jouer encore » : rien n'est perdu.
  await retour(page);
  await expect(question).toHaveCount(0);
  await expect(plateau(page)).toBeVisible();

  await retour(page);
  await question.getByRole('button', { name: 'Quitter', exact: true }).click();
  await racineJouer(page);
});

test('feuille « Changer » : le retour la ferme, l’accueil reste', async ({ page }) => {
  await ouvrir(page);
  await page.getByRole('button', { name: 'Changer', exact: true }).click();
  const feuille = page.locator('dialog.feuille[open]');
  await expect(feuille).toBeVisible();
  await retour(page);
  await expect(feuille).toHaveCount(0);
  await racineJouer(page);
});

test('Aide : le retour ferme la feuille, le Profil reste', async ({ page }) => {
  await ouvrir(page);
  await onglet(page, 'Profil').click();
  await page.getByRole('button', { name: 'Aide', exact: true }).click();
  const aide = page.locator('dialog.aide[open]');
  await expect(aide).toBeVisible();
  await retour(page);
  await expect(aide).toHaveCount(0);
  await expect(onglet(page, 'Profil')).toHaveAttribute('aria-current', 'page');
  await retour(page);
  await racineJouer(page);
});

test('rechargement au milieu d’une pile : l’app repart sur Jouer, sans garde en trop', async ({ page }) => {
  await ouvrir(page);
  await onglet(page, 'Profil').click();
  await page.getByRole('button', { name: 'Réglages', exact: true }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Réglages' })).toBeVisible();
  await page.reload();
  await racineJouer(page);
  await expect.poll(() => page.evaluate(() => typeof (history.state as { mochiNav?: number } | null)?.mochiNav)).toBe('number');
  await onglet(page, 'Problèmes').click();
  await retour(page);
  await racineJouer(page);
});

async function telephone(browser: Browser, baseURL: string | undefined, serveur: FauxServeur, qui: { email: string; pseudo: string; id: string }): Promise<Page> {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'fr-FR', baseURL, reducedMotion: 'reduce',
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }, { name: 'go.connait-go.v1', value: '"sait"' }] }] },
  });
  const page = await brancher(ctx, serveur, {
    'go.parties.v1': JSON.stringify({ n: 3 }), 'sb-supabase-auth-token': JSON.stringify(serveur.sessionCompte(qui.email, qui.pseudo, qui.id)),
  });
  await ouvrir(page);
  return page;
}

test('partie en direct : le retour demande confirmation (la pendule continue), puis ramène à Jouer', async ({ browser, baseURL }) => {
  test.setTimeout(60_000);
  const serveur = fauxServeur();
  const ana = await telephone(browser, baseURL, serveur, { email: 'ana.retour@exemple.test', pseudo: 'Ana', id: '00000000-0000-4000-8000-0000000606a1' });
  const bob = await telephone(browser, baseURL, serveur, { email: 'bob.retour@exemple.test', pseudo: 'Bob', id: '00000000-0000-4000-8000-0000000606b2' });
  for (const p of [ana, bob]) {
    await choisirMode(p, 'en_ligne');
    await p.getByTestId('bascule-en-ligne').getByRole('button', { name: 'En direct' }).click();
  }
  await ana.getByRole('button', { name: 'Trouver un adversaire' }).click();
  await expect(ana.getByTestId('direct-attente')).toBeVisible();
  await bob.getByRole('button', { name: 'Trouver un adversaire' }).click();
  await expect(ana.getByTestId('direct-partie')).toBeVisible();

  const question = ana.getByRole('group', { name: 'Quitter la partie en direct ?' });
  await retour(ana);
  await expect(question).toBeVisible();
  await expect(ana.locator('[data-choix="quitter"]')).toContainText('Ta pendule continue');
  await retour(ana);
  await expect(question).toHaveCount(0);
  await expect(ana.getByTestId('direct-partie')).toBeVisible();

  // « ‹ » fait la même chose.
  await ana.locator('[data-testid="direct-partie"] .retour').click();
  await expect(question).toBeVisible();
  await question.getByRole('button', { name: 'Quitter', exact: true }).click();
  await expect(ana.getByTestId('direct-partie')).toHaveCount(0);
  await racineJouer(ana);
});

test('lien de défi : à l’arrivée, le retour ramène à Jouer ; un lien ouvert dans l’app aussi', async ({ browser, baseURL }) => {
  const ctx = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, locale: 'fr-FR' });
  const page = await brancher(ctx, fauxServeur(), { 'go.consentement.v1': 'refuse', 'go.connait-go.v1': '"sait"' });
  await ouvrir(page, `/#defi=${JETON}&de=Florian`);
  await expect(page.getByRole('heading', { name: 'Florian te défie !' })).toBeVisible();
  await retour(page);
  await expect(page.getByRole('heading', { name: 'Florian te défie !' })).toHaveCount(0);
  await racineJouer(page);

  // Lien ouvert dans l'onglet déjà ouvert (`hashchange`) : l'arrivée s'affiche, le retour ramène à Jouer.
  await onglet(page, 'Profil').click();
  await page.evaluate(j => { location.hash = `#defi=${j}&de=Florian`; }, JETON);
  await expect(page.getByRole('heading', { name: 'Florian te défie !' })).toBeVisible();
  await retour(page);
  await expect(page.getByRole('heading', { name: 'Florian te défie !' })).toHaveCount(0);
  await racineJouer(page);
  await ctx.close();
});
