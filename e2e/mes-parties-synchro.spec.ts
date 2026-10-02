import { expect, test, type Browser, type Page } from '@playwright/test';
import { abandonner, plateau } from './plateau';
import { brancher, CODE, creerCompte, fauxServeur, type FauxServeur } from './fauxSupabase';

// Issue #358 (suite) : « Mes parties » sur le compte. Une partie jouée sur le téléphone A (pendant l'essai, puis avec
// le compte) se retrouve sur le téléphone B après connexion. Supabase simulé par interception réseau (fauxSupabase.ts).

const CAPTURES = process.env.CAPTURES_358;

function telephone(browser: Browser, baseURL: string | undefined, serveur: FauxServeur, stockage: Record<string, string>, colorScheme: 'light' | 'dark' = 'light') {
  return browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', baseURL, colorScheme,
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }] }] },
  }).then(ctx => brancher(ctx, serveur, stockage).then(page => ({ ctx, page })));
}

/** La partie en cours : abandon tout de suite, puis retour à l'accueil. */
async function abandonEtAccueil(page: Page) {
  await expect(plateau(page)).toBeVisible();
  await abandonner(page);
  await expect(page.getByRole('heading', { level: 2, name: 'Défaite' })).toBeVisible();
  await page.getByRole('button', { name: 'Accueil', exact: true }).click();
}

async function ouvrirMesParties(page: Page) {
  await page.getByRole('navigation').getByRole('button', { name: 'Profil' }).click();
  await page.getByRole('button', { name: /^Mes parties/ }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Mes parties' })).toBeVisible();
}

test('une partie jouée sur le téléphone A (essai, puis compte) se retrouve sur le téléphone B après connexion', async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  const serveur = fauxServeur();
  const erreurs: string[] = [];

  // Téléphone A : 2 parties d'essai déjà finies ; la 3e se joue sans compte (gardée sur l'appareil seulement).
  const a = await telephone(browser, baseURL, serveur, { 'go.essai.v1': JSON.stringify({ terminees: 2 }) });
  a.page.on('pageerror', e => erreurs.push(e.message));
  await a.page.goto('/');
  await a.page.locator('.cta').click();
  await abandonEtAccueil(a.page);
  expect(serveur.partiesPerso).toHaveLength(0);

  // 4e partie : l'essai est fini, il crée son compte. La partie d'essai part sur le compte, en arrière-plan.
  await a.page.locator('.cta').click();
  await expect(a.page.getByTestId('creer-compte')).toBeVisible();
  await creerCompte(a.page, 'alice@exemple.test', 'Alice');
  await expect.poll(() => serveur.partiesPerso.length, { timeout: 10_000 }).toBe(1);
  // La partie demandée démarre ; finie, elle part aussi.
  await abandonEtAccueil(a.page);
  await expect.poll(() => serveur.partiesPerso.length, { timeout: 10_000 }).toBe(2);
  expect(serveur.partiesPerso.every(p => p.mode === 'ordi' && p.adversaire === 'pomme' && /^[0-9a-f]{64}$/.test(String(p.cle)))).toBe(true);
  // Rouvrir « Mes parties » sur A ne renvoie rien en double.
  await ouvrirMesParties(a.page);
  await expect(a.page.locator('.mp-parties > li > button')).toHaveCount(2);
  const envois = () => serveur.appels.filter(x => x.includes('/rpc/enregistrer_parties_perso')).length;
  const avant = envois();
  await a.page.reload();
  await ouvrirMesParties(a.page);
  await expect(a.page.locator('.mp-parties > li > button')).toHaveCount(2);
  await a.page.waitForTimeout(2000);
  expect(envois()).toBe(avant);
  expect(serveur.partiesPerso).toHaveLength(2);

  // Téléphone B : rien sur l'appareil. Il se connecte avec le même compte (essai déjà fini sur ce téléphone).
  const b = await telephone(browser, baseURL, serveur, { 'go.essai.v1': JSON.stringify({ terminees: 3 }) });
  b.page.on('pageerror', e => erreurs.push(e.message));
  await b.page.goto('/');
  await ouvrirMesParties(b.page);
  await expect(b.page.getByRole('heading', { level: 3, name: 'Tes parties arriveront ici' })).toBeVisible();
  await b.page.getByRole('button', { name: 'Joue ta première partie' }).click();
  const ecran = b.page.getByTestId('creer-compte');
  await expect(ecran).toBeVisible();
  await ecran.getByRole('button', { name: 'J’ai déjà un compte' }).click();
  await b.page.getByLabel('Ton adresse e-mail').fill('alice@exemple.test');
  await b.page.getByRole('button', { name: 'Recevoir mon code' }).click();
  await b.page.getByLabel('Code à 6 chiffres').fill(CODE);
  // Connecté : la partie demandée démarre. Il l'abandonne : 1 partie sur B, 2 venues de A.
  await abandonEtAccueil(b.page);
  await ouvrirMesParties(b.page);
  const lignes = b.page.locator('.mp-parties > li > button');
  await expect(lignes).toHaveCount(3);
  for (let i = 0; i < 3; i++) await expect(lignes.nth(i)).toHaveAccessibleName('Pomme. Tu as abandonné. Aujourd’hui, plateau 9 × 9.');
  await expect(b.page.locator('.mp-parties-statut')).toHaveCount(0);
  expect(await b.page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  if (CAPTURES) {
    await b.page.screenshot({ path: `${CAPTURES}/synchro-b-390-clair.jpeg`, type: 'jpeg', quality: 80 });
    await b.page.emulateMedia({ colorScheme: 'dark' });
    await b.page.screenshot({ path: `${CAPTURES}/synchro-b-390-sombre.jpeg`, type: 'jpeg', quality: 80 });
    await b.page.setViewportSize({ width: 320, height: 568 });
    await b.page.screenshot({ path: `${CAPTURES}/synchro-b-320-sombre.jpeg`, type: 'jpeg', quality: 80 });
    await b.page.emulateMedia({ colorScheme: 'light' });
    await b.page.screenshot({ path: `${CAPTURES}/synchro-b-320-clair.jpeg`, type: 'jpeg', quality: 80 });
    await b.page.setViewportSize({ width: 390, height: 844 });
  }
  // Une partie venue de A s'ouvre dans la revue.
  await lignes.nth(2).click();
  await expect(b.page.getByRole('heading', { level: 2, name: 'Revoir ma partie' })).toBeVisible();
  await b.page.getByRole('button', { name: 'Retour à mes parties' }).click();
  // La partie de B part sur le compte ; celles de A ne sont pas renvoyées.
  await expect.poll(() => serveur.partiesPerso.length, { timeout: 10_000 }).toBe(3);

  // Hors ligne : les parties de l'appareil restent là, et l'écran le dit simplement.
  await b.ctx.setOffline(true);
  await b.page.getByRole('button', { name: 'Retour', exact: false }).first().click();
  await b.page.getByRole('button', { name: /^Mes parties/ }).click();
  await expect(lignes).toHaveCount(1);
  await expect(b.page.locator('.mp-parties-statut')).toHaveText('Hors ligne : les parties de ton compte reviendront avec le réseau.');
  if (CAPTURES) await b.page.screenshot({ path: `${CAPTURES}/synchro-b-hors-ligne-390.jpeg`, type: 'jpeg', quality: 80 });
  expect(erreurs).toEqual([]);
  await a.ctx.close();
  await b.ctx.close();
});
