import { expect, test, type Page } from '@playwright/test';
import { brancher, CODE, fauxServeur, JETON, PARTIE, type FauxServeur } from './fauxSupabase';
import { plateau } from './plateau';

// #353 : une adresse qui a déjà un compte ne bloque plus. Cas de Florian : une ancienne session anonyme (défi d'hier)
// et un vrai compte. La liaison refusée bascule tout de suite en « Connecte-toi » (code `email`, sans créer de compte).
// Partout où on saisit l'e-mail : « J'ai déjà un compte » / « Créer un compte ». Supabase simulé (e2e/fauxSupabase.ts).

const CAPTURES = process.env.CAPTURES_353;
const options = (baseURL: string | undefined, largeur: number, locale = 'fr-FR', colorScheme: 'light' | 'dark' = 'light') => ({
  viewport: { width: largeur, height: largeur === 320 ? 640 : 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale, baseURL, colorScheme,
  storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }] }] },
});

async function sansDefilementHorizontal(page: Page) {
  const { large, vue } = await page.evaluate(() => ({ large: document.documentElement.scrollWidth, vue: window.innerWidth }));
  expect(large).toBeLessThanOrEqual(vue);
}

async function ciblesDe44(page: Page, zone: string) {
  const petites = await page.locator(`${zone} button:visible:not(.lien-texte), ${zone} input:visible:not([type=checkbox])`).evaluateAll(els =>
    els.map(e => ({ n: (e as HTMLElement).innerText || (e as HTMLInputElement).name || e.id, h: e.getBoundingClientRect().height })).filter(x => x.h < 44));
  expect(petites).toEqual([]);
}

/** Défi d'un ami, en attente : Florian ouvre le lien aujourd'hui. */
function defiEnAttente(serveur: FauxServeur) {
  serveur.profiles.push({ id: 'createur', username: 'Ami', rating: 1500, streak_days: 0, streak_last: null, streak_freezes: 0 });
  serveur.games.push({ id: PARTIE, white_id: 'createur', black_id: null, created_by: 'createur', size: 9, komi: 6.5, rules: 'japanese', handicap: 0,
    moves: '', status: 'waiting', counting: false, dead_stones: null, dead_proposed_by: null, result: null, resumed_at: 0, prive: true, rated: false });
  serveur.defis.push({ partie_id: PARTIE, jeton: JETON, createur_id: 'createur', invite_id: null, delai_coup: '3 days', date_limite: null,
    lien_expire_le: new Date(Date.now() + 7 * 864e5).toISOString(), cree_le: new Date().toISOString() });
}

test('Florian : session anonyme + adresse qui a un compte → bascule en connexion → code → connecté, il rejoint le défi', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const anonyme = serveur.sessionAnonyme();
  serveur.compteExistant('fds@exemple.test', 'Florian');
  defiEnAttente(serveur);
  const ctx = await browser.newContext(options(baseURL, 390));
  const page = await brancher(ctx, serveur, { 'sb-supabase-auth-token': JSON.stringify(anonyme) });
  const erreurs: string[] = [];
  page.on('pageerror', e => erreurs.push(e.message));

  await page.goto(`/#defi=${JETON}&de=Ami`);
  const apercu = page.getByTestId('defi-apercu');
  await expect(apercu).toBeVisible();
  // L'autre chemin est visible, sans second bouton principal.
  await expect(apercu.getByRole('button', { name: 'J’ai déjà un compte' })).toBeVisible();
  await expect(page.locator('.btn.primary:visible, .cta:visible')).toHaveCount(1);

  // Il tape l'adresse de son vrai compte, comme hier : la liaison est refusée (adresse prise)…
  await page.getByLabel('Ton adresse e-mail').fill('fds@exemple.test');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Recevoir mon code' }).click();
  // … et l'écran bascule tout seul : code de connexion envoyé, phrase claire, rien de bloquant.
  await expect(page.getByTestId('connexion-bascule')).toHaveText(/Cette adresse a déjà un compte\. Connecte-toi avec le code qu’on vient de t’envoyer\./);
  await expect(page.getByText('Ta partie jouée sans compte ne passe pas sur ton compte.')).toBeVisible();
  await expect(page.getByText(/Utilise une autre adresse/)).toHaveCount(0);
  await expect(apercu.getByText('Connecte-toi pour jouer.')).toBeVisible();
  expect(serveur.appels.some(a => a.startsWith('PUT /auth/v1/user'))).toBe(true);
  expect(serveur.emailsEnvoyes).toEqual([{ email: 'fds@exemple.test', type: 'connexion' }]);
  await sansDefilementHorizontal(page);
  await ciblesDe44(page, '[data-testid="defi-apercu"]');
  if (CAPTURES) await page.screenshot({ path: `${CAPTURES}/bascule-390-clair.png`, fullPage: true });
  await page.emulateMedia({ colorScheme: 'dark' });
  if (CAPTURES) await page.screenshot({ path: `${CAPTURES}/bascule-390-sombre.png`, fullPage: true });

  // Bon code : session du vrai compte (pseudo déjà choisi), et le défi est rejoint avec ce compte.
  await page.getByLabel('Code à 6 chiffres').fill(CODE);
  await expect(page.getByTestId('pseudo-obligatoire')).toHaveCount(0);
  await expect(plateau(page)).toBeVisible();
  await expect.poll(() => serveur.appels.includes('POST /rest/v1/rpc/rejoindre_defi')).toBe(true);
  expect(serveur.defis[0].invite_id).toBe('00000000-0000-4000-8000-0000000000ee');
  expect(serveur.appels).not.toContain('POST /auth/v1/signup');
  expect(erreurs).toEqual([]);
  await ctx.close();
});

test('« J’ai déjà un compte » : adresse inconnue → message, puis compte existant → code → la partie demandée démarre (320 px, sombre)', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  serveur.compteExistant('fds@exemple.test', 'Florian');
  const ctx = await browser.newContext(options(baseURL, 320, 'fr-FR', 'dark'));
  const page = await brancher(ctx, serveur, { 'go.essai.v1': JSON.stringify({ terminees: 3 }) });
  await page.goto('/');
  await page.locator('.cta').click();
  const ecran = page.getByTestId('creer-compte');
  await expect(page.getByRole('heading', { name: 'Crée ton compte' })).toBeVisible();
  await ecran.getByRole('button', { name: 'J’ai déjà un compte' }).click();
  // Connexion : titre, pas de case d'âge (déjà acceptée à la création), une seule action.
  await expect(page.getByRole('heading', { name: 'Connecte-toi' })).toBeVisible();
  await expect(page.getByText(/Entre l’adresse de ton compte/)).toBeVisible();
  await expect(page.getByText(/Crée ton compte pour continuer/)).toHaveCount(0);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.locator('.btn.primary:visible, .cta:visible')).toHaveCount(1);
  await page.getByLabel('Ton adresse e-mail').fill('inconnu@exemple.test');
  await page.getByRole('button', { name: 'Recevoir mon code' }).click();
  await expect(page.getByRole('alert')).toHaveText('Aucun compte avec cette adresse. Crée ton compte.');
  expect(serveur.emailsEnvoyes).toEqual([]);
  await sansDefilementHorizontal(page);
  await ciblesDe44(page, '[data-testid="creer-compte"]');
  if (CAPTURES) await page.screenshot({ path: `${CAPTURES}/inconnu-320-sombre.png`, fullPage: true });
  // L'inverse : « Créer un compte » ramène la création et sa case.
  await ecran.getByRole('button', { name: 'Créer un compte' }).click();
  await expect(page.getByRole('heading', { name: 'Crée ton compte' })).toBeVisible();
  await expect(page.getByRole('checkbox')).toBeVisible();
  // Retour en connexion avec la bonne adresse.
  await ecran.getByRole('button', { name: 'J’ai déjà un compte' }).click();
  await page.getByLabel('Ton adresse e-mail').fill('fds@exemple.test');
  await page.getByRole('button', { name: 'Recevoir mon code' }).click();
  await expect(page.getByTestId('connexion-bascule')).toHaveCount(0);
  await page.getByLabel('Code à 6 chiffres').fill(CODE);
  // Compte complet : l'action demandée (4e partie) reprend.
  await expect(plateau(page)).toBeVisible();
  expect(serveur.emailsEnvoyes).toEqual([{ email: 'fds@exemple.test', type: 'connexion' }]);
  await ctx.close();
});

for (const largeur of [390, 320]) {
  test(`Mon compte → « You’re playing without an account » : adresse prise → connexion en anglais (${largeur} px)`, async ({ browser, baseURL }) => {
    const serveur = fauxServeur();
    const anonyme = serveur.sessionAnonyme();
    serveur.compteExistant('fds@exemple.test', 'Florian');
    const ctx = await browser.newContext(options(baseURL, largeur, 'en-US'));
    const page = await brancher(ctx, serveur, { 'sb-supabase-auth-token': JSON.stringify(anonyme) });
    await page.goto('/?lang=en');
    await page.getByRole('navigation').getByRole('button', { name: 'Profile' }).click();
    await page.getByRole('button', { name: /^My account/ }).click();
    const carte = page.getByTestId('lier-email');
    await expect(carte.getByText('You’re playing without an account')).toBeVisible();
    await expect(carte.getByRole('button', { name: 'I already have an account' })).toBeVisible();
    await page.getByLabel(/email/i).first().fill('fds@exemple.test');
    await carte.getByRole('checkbox').check();
    await carte.getByRole('button', { name: 'Keep my game' }).click();
    await expect(page.getByTestId('connexion-bascule')).toHaveText('This address already has an account. Log in with the code we just sent you.');
    await expect(carte.getByText('Your game played without an account won’t move to your account.')).toBeVisible();
    await expect(carte.getByText('Log in', { exact: true })).toBeVisible();
    await sansDefilementHorizontal(page);
    await ciblesDe44(page, '[data-testid="lier-email"]');
    if (CAPTURES) await page.screenshot({ path: `${CAPTURES}/compte-en-${largeur}.png`, fullPage: true });
    await page.getByLabel('6-digit code').fill(CODE);
    // Connecté au vrai compte : son pseudo s'affiche, plus de carte « sans compte ».
    await expect(page.getByText('Florian', { exact: true })).toBeVisible();
    await expect(page.getByTestId('lier-email')).toHaveCount(0);
    await ctx.close();
  });
}
