import { expect, test, type Browser, type Page } from '@playwright/test';
import { brancher, fauxServeur, JETON, PARTIE, type FauxServeur } from './fauxSupabase';
import { plateau } from './plateau';

// #354 : « Continuer avec Google » (docs/growth/connexion-google-apple.md, phase 1). Supabase simulé
// (e2e/fauxSupabase.ts) : `/auth/v1/authorize` renvoie aussitôt vers l'app avec la session dans le fragment.
// Le build de test active Google par `e2e.google` (en production : VITE_AUTH_GOOGLE=1).

const CAPTURES = process.env.CAPTURES_354;
const UA_MESSENGER_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBDV/iPhone14,5;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBID/phone;FBLC/fr_FR;FBOP/5]';
const UA_MESSENGER_ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-S911B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.6367.82 Mobile Safari/537.36 [FB_IAB/Orca-Android;FBAV/455.0.0.36.107;]';

async function telephone(browser: Browser, baseURL: string | undefined, serveur: FauxServeur, o: { largeur?: number; locale?: string; sombre?: boolean; userAgent?: string; google?: boolean; stockage?: Record<string, string> } = {}) {
  const largeur = o.largeur ?? 390;
  const ctx = await browser.newContext({
    viewport: { width: largeur, height: largeur === 320 ? 640 : 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: o.locale ?? 'fr-FR', baseURL,
    colorScheme: o.sombre ? 'dark' : 'light', ...(o.userAgent ? { userAgent: o.userAgent } : {}),
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }] }] },
  });
  const page = await brancher(ctx, serveur, { ...(o.google === false ? {} : { 'e2e.google': '1' }), ...o.stockage });
  return { ctx, page };
}

async function sansDefilementHorizontal(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
}

async function ciblesDe44(page: Page, zone: string) {
  const petites = await page.locator(`${zone} button:visible:not(.lien-texte), ${zone} input:visible:not([type=checkbox]), ${zone} a:visible`).evaluateAll(els =>
    els.map(e => ({ n: (e as HTMLElement).innerText || e.id, h: e.getBoundingClientRect().height })).filter(x => x.h < 43.5));
  expect(petites).toEqual([]);
}

test('Google : case d’âge, aller-retour, pseudo jamais pré-rempli, puis la partie demandée démarre (390 px)', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  serveur.compteGoogle({ email: 'florian.google@exemple.test', nom: 'Florian Dupont' });
  const { ctx, page } = await telephone(browser, baseURL, serveur, { stockage: { 'go.essai.v1': JSON.stringify({ terminees: 3 }) } });
  const erreurs: string[] = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await page.goto('/');
  await page.locator('.cta').click();
  const ecran = page.getByTestId('creer-compte');
  const google = ecran.getByRole('button', { name: 'Continuer avec Google' });
  await expect(google).toBeVisible();
  // Ordre : case d'âge, Google (action principale), « ou », e-mail, « Recevoir mon code » (contour), lien de connexion.
  const haut = async (l: ReturnType<Page['locator']>) => (await l.boundingBox())!.y;
  const age = ecran.getByRole('checkbox');
  const email = ecran.getByLabel('Ton adresse e-mail');
  const code = ecran.getByRole('button', { name: 'Recevoir mon code' });
  expect(await haut(age)).toBeLessThan(await haut(google));
  expect(await haut(google)).toBeLessThan(await haut(email));
  expect(await haut(email)).toBeLessThan(await haut(code));
  await expect(code).not.toHaveClass(/primary/);
  await expect(page.locator('.btn.primary:visible')).toHaveCount(0);
  expect((await google.boundingBox())!.height).toBeGreaterThanOrEqual(48);
  await expect(ecran.getByRole('button', { name: 'J’ai déjà un compte' })).toBeVisible();
  await sansDefilementHorizontal(page);
  await ciblesDe44(page, '[data-testid="creer-compte"]');
  if (CAPTURES) await page.screenshot({ path: `${CAPTURES}/google-390-clair.png`, fullPage: true });
  await page.emulateMedia({ colorScheme: 'dark' });
  if (CAPTURES) await page.screenshot({ path: `${CAPTURES}/google-390-sombre.png`, fullPage: true });

  // Sans la case : rien ne part, l'aide dit pourquoi.
  await google.click({ force: true });
  await expect(page.getByText('Coche la case pour créer ton compte.')).toBeVisible();
  expect(serveur.autorisations).toEqual([]);
  await age.check();
  await google.click();

  // Retour de Google : pseudo obligatoire, champ vide (jamais le nom Google).
  await expect(page.getByTestId('pseudo-obligatoire')).toBeVisible();
  expect(serveur.autorisations).toEqual(['google']);
  const pseudo = page.getByRole('textbox', { name: 'Pseudo' });
  await expect(pseudo).toHaveValue('');
  await expect(page.getByText(/Florian Dupont/)).toHaveCount(0);
  expect(await page.evaluate(() => location.hash)).toBe('');
  expect(await page.evaluate(() => sessionStorage.getItem('go.retour-connexion.v1'))).toBeNull();
  await pseudo.fill('Flo_go');
  await expect(page.getByText('Flo_go est libre.')).toBeVisible();
  await page.getByRole('button', { name: 'C’est mon pseudo' }).click();
  // L'action demandée (4e partie) reprend.
  await expect(plateau(page)).toBeVisible();
  expect(erreurs).toEqual([]);
  await ctx.close();
});

test('Google depuis un lien de défi : retour, pseudo, le défi est rejoint (anglais, 320 px, sombre)', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  serveur.compteGoogle({ email: 'ami.google@exemple.test', nom: 'Jane Doe' });
  serveur.profiles.push({ id: 'createur', username: 'Florian', rating: 1500, streak_days: 0, streak_last: null, streak_freezes: 0 });
  serveur.games.push({ id: PARTIE, white_id: 'createur', black_id: null, created_by: 'createur', size: 9, komi: 6.5, rules: 'japanese', handicap: 0,
    moves: '', status: 'waiting', counting: false, dead_stones: null, dead_proposed_by: null, result: null, resumed_at: 0, prive: true, rated: false });
  serveur.defis.push({ partie_id: PARTIE, jeton: JETON, createur_id: 'createur', invite_id: null, delai_coup: '3 days', date_limite: null,
    lien_expire_le: new Date(Date.now() + 7 * 864e5).toISOString(), cree_le: new Date().toISOString() });
  const { ctx, page } = await telephone(browser, baseURL, serveur, { largeur: 320, locale: 'en-US', sombre: true });
  await page.goto(`/?lang=en#defi=${JETON}&de=Florian`);
  const apercu = page.getByTestId('defi-apercu');
  await expect(apercu.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  await expect(apercu.getByRole('button', { name: 'Get my code' })).toBeVisible();
  await sansDefilementHorizontal(page);
  await ciblesDe44(page, '[data-testid="defi-apercu"]');
  if (CAPTURES) await page.screenshot({ path: `${CAPTURES}/google-defi-en-320-sombre.png`, fullPage: true });
  await apercu.getByRole('checkbox').check();
  await apercu.getByRole('button', { name: 'Continue with Google' }).click();
  await expect(page.getByTestId('pseudo-obligatoire')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Username' })).toHaveValue('');
  await page.getByRole('textbox', { name: 'Username' }).fill('Jane_go');
  await expect(page.getByText(/Jane_go/).first()).toBeVisible();
  await page.getByRole('button', { name: /username/i }).click();
  await expect.poll(() => serveur.defis[0].invite_id).toBe('00000000-0000-4000-8000-000000000099');
  await expect(plateau(page)).toBeVisible();
  await ctx.close();
});

test('compte existant (même e-mail) : Google connecte directement, sans écran de pseudo', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  serveur.compteExistant('fds@exemple.test', 'Florian');
  serveur.compteGoogle({ email: 'fds@exemple.test', nom: 'Florian D.' });
  const { ctx, page } = await telephone(browser, baseURL, serveur, { stockage: { 'go.essai.v1': JSON.stringify({ terminees: 3 }) } });
  await page.goto('/');
  await page.locator('.cta').click();
  await page.getByTestId('creer-compte').getByRole('button', { name: 'J’ai déjà un compte' }).click();
  // Connexion : pas de case d'âge, Google tout de suite.
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await page.getByRole('button', { name: 'Continuer avec Google' }).click();
  await expect(plateau(page)).toBeVisible();
  await expect(page.getByTestId('pseudo-obligatoire')).toHaveCount(0);
  await ctx.close();
});

test('Google annulé : retour sur « Crée ton compte » avec une phrase claire', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  serveur.compteGoogle({ email: 'x@exemple.test', nom: 'X', annule: true });
  const { ctx, page } = await telephone(browser, baseURL, serveur, { stockage: { 'go.essai.v1': JSON.stringify({ terminees: 3 }) } });
  await page.goto('/');
  await page.locator('.cta').click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Continuer avec Google' }).click();
  await expect(page.getByTestId('creer-compte')).toHaveAttribute('data-raison', 'parties');
  await expect(page.getByRole('alert')).toHaveText('Connexion annulée. Réessaie, ou reçois un code par e-mail.');
  expect(await page.evaluate(() => location.hash)).toBe('');
  await ctx.close();
});

test('Messenger sur iPhone : pas de Google, le code en action principale, la consigne pour Safari (390 px)', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const { ctx, page } = await telephone(browser, baseURL, serveur, { userAgent: UA_MESSENGER_IOS, stockage: { 'go.essai.v1': JSON.stringify({ terminees: 3 }) } });
  await page.goto('/');
  await page.locator('.cta').click();
  const ecran = page.getByTestId('creer-compte');
  await expect(ecran.getByRole('button', { name: 'Recevoir mon code' })).toHaveClass(/primary/);
  await expect(page.getByTestId('bouton-google')).toHaveCount(0);
  await expect(page.getByTestId('aide-navigateur')).toHaveText(/Tu préfères Google.*Touche ⋯ puis.*Ouvrir dans le navigateur/);
  await expect(page.locator('.btn.primary:visible, .cta:visible')).toHaveCount(1);
  await sansDefilementHorizontal(page);
  if (CAPTURES) await page.screenshot({ path: `${CAPTURES}/messenger-ios-390.png`, fullPage: true });
  await ctx.close();
});

test('Messenger sur Android : pas de Google, lien pour ouvrir dans Chrome (anglais, 320 px)', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const { ctx, page } = await telephone(browser, baseURL, serveur, { largeur: 320, locale: 'en-US', userAgent: UA_MESSENGER_ANDROID, stockage: { 'go.essai.v1': JSON.stringify({ terminees: 3 }) } });
  await page.goto('/?lang=en');
  await page.locator('.cta').click();
  await expect(page.getByTestId('bouton-google')).toHaveCount(0);
  const lien = page.getByRole('link', { name: 'Prefer Google? Open the game in Chrome.' });
  await expect(lien).toHaveAttribute('href', /^intent:\/\/localhost:\d+\/\?lang=en#Intent;scheme=http;package=com\.android\.chrome;S\.browser_fallback_url=/);
  await sansDefilementHorizontal(page);
  await ciblesDe44(page, '[data-testid="creer-compte"]');
  await ctx.close();
});

test('sans VITE_AUTH_GOOGLE : aucun bouton Google ni aide', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const { ctx, page } = await telephone(browser, baseURL, serveur, { google: false, userAgent: UA_MESSENGER_IOS, stockage: { 'go.essai.v1': JSON.stringify({ terminees: 3 }) } });
  await page.goto('/');
  await page.locator('.cta').click();
  await expect(page.getByRole('button', { name: 'Recevoir mon code' })).toBeVisible();
  await expect(page.getByTestId('bouton-google')).toHaveCount(0);
  await expect(page.getByTestId('aide-navigateur')).toHaveCount(0);
  await ctx.close();
});

for (const [locale, titre, google] of [['fr-FR', 'Conditions et confidentialité', 'Si tu te connectes avec Google'], ['en-US', 'Terms and privacy', 'If you sign in with Google']] as const) {
  test(`politique publique : /confidentialite s’ouvre directement (${locale})`, async ({ browser, baseURL }) => {
    const serveur = fauxServeur();
    const { ctx, page } = await telephone(browser, baseURL, serveur, { largeur: 320, locale, google: false });
    await page.goto('/confidentialite');
    await expect(page.getByRole('heading', { name: titre })).toBeVisible();
    await expect(page.getByTestId('conditions-google')).toContainText(google);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await sansDefilementHorizontal(page);
    await page.locator('.retour').first().click();
    await expect.poll(() => page.evaluate(() => location.pathname)).toBe('/');
    await ctx.close();
  });
}
