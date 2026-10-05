import { expect, test } from '@playwright/test';
import { brancher, creerCompte, fauxServeur, JETON, PARTIE } from './fauxSupabase';
import { jouer, pierres, plateau } from './plateau';

// Issue #81 : défier un ami par lien. Depuis #343 : compte avec pseudo obligatoire, plus de joueurs anonymes.
// L'ami qui ouvre le lien voit qui l'invite et le plateau, crée son compte (code par e-mail + pseudo) AVANT son
// premier coup. Deux contextes = deux téléphones ; Supabase simulé (e2e/fauxSupabase.ts).

const CAPTURES = process.env.CAPTURES_343;
const options = (baseURL: string | undefined, largeur = 390) => ({
  viewport: { width: largeur, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', baseURL,
  storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }] }] },
});

test('défier un ami : compte du créateur, lien avec son pseudo, l’ami crée son compte puis joue', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const erreurs: string[] = [];

  // Téléphone 1 : le créateur, sans compte. « Défier un ami » : la tuile « Un ami » sous le bouton principal (#429).
  const ctxA = await browser.newContext(options(baseURL));
  const a = await brancher(ctxA, serveur);
  a.on('pageerror', e => erreurs.push(e.message));
  await a.goto('/');
  const lien = a.getByRole('button', { name: 'Défier un ami' });
  await expect(lien).toBeVisible();
  await expect(lien).not.toHaveClass(/cta|primary/);
  await expect(a.locator('.cta')).toHaveCount(1);
  expect((await lien.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await lien.click();
  // Compte obligatoire pour défier.
  await expect(a.getByTestId('creer-compte')).toHaveAttribute('data-raison', 'defi');
  await creerCompte(a, 'florian@exemple.test', 'Florian');
  // Compte complet : l'écran du défi s'ouvre.
  await expect(a.getByText('Envoie un lien à un ami. Il crée son compte en un instant, puis il joue.')).toBeVisible();
  await a.getByRole('button', { name: 'Envoyer un lien' }).click();
  await expect(a.getByText('Lien copié. Colle-le dans un message.')).toBeVisible();
  const adresse = await a.getByTestId('defi-lien').locator('input').inputValue();
  // #364 : lien court `/defi#JETON&de=Pseudo`, avec sa page d'aperçu ; l'app le remet à la forme `/#defi=…`.
  expect(adresse).toBe(`${baseURL}/defi#${JETON}&de=Florian`);
  expect(serveur.appels).toContain('POST /rest/v1/rpc/creer_defi');
  expect(serveur.appels).not.toContain('POST /auth/v1/signup');
  expect(await a.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  // Téléphone 2 : l'ami ouvre le lien. Il voit qui l'invite et le plateau, puis crée son compte.
  const ctxB = await browser.newContext(options(baseURL));
  const b = await brancher(ctxB, serveur);
  b.on('pageerror', e => erreurs.push(e.message));
  await b.goto(adresse);
  await expect(b.getByRole('heading', { name: 'Florian te défie !' })).toBeVisible();
  await expect(b.getByRole('img', { name: /Plateau 9 × 9 vide/ })).toBeVisible();
  expect(new URL(b.url()).hash).toBe(''); // le jeton ne reste pas dans l'adresse
  expect(serveur.appels.filter(x => x.includes('rejoindre_defi'))).toEqual([]); // rien avant le compte
  expect(await b.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  if (CAPTURES) await b.screenshot({ path: `${CAPTURES}/defi-arrivee-390-clair.png`, fullPage: true });
  await creerCompte(b, 'ami@exemple.test', 'Ami_du_go');

  // Compte complet : il rejoint la partie et joue son premier coup, avec Noir.
  // #393 : l'ami est nommé par son pseudo (profil public), sur son bandeau et dans la phrase de Mochi.
  await expect(b.getByText('Florian te défie ! Tu as les pierres noires : à toi de commencer.')).toBeVisible();
  await expect(b.locator('.joueur').first()).toContainText('Florian');
  await expect(plateau(b)).toBeVisible();
  await jouer(b, 'E5');
  await expect(pierres(b, 'noir')).toHaveCount(1);
  await expect(b.getByText(/Au tour de Florian\. Il lui reste [23]\s+jours/)).toBeVisible();
  await expect(b.getByTestId('lier-email')).toHaveCount(0); // plus d'inscription après coup : il a déjà un compte

  // Téléphone 1 : le créateur retrouve la partie, c'est à lui de jouer. Sa liste a été lue avant l'arrivée de l'ami :
  // la ligne dit encore « Partie du… » (#400 : le pseudo de l'ami s'y affiche à la lecture suivante, voir noms-adversaires.spec).
  await a.getByRole('button', { name: /Partie du/ }).click();
  await expect(a.getByText(/À toi de jouer\. Il te reste [23]\s+jours/)).toBeVisible();
  await expect(a.locator('.joueur').first()).toContainText('Ami_du_go');
  await expect(pierres(a, 'noir')).toHaveCount(1);

  expect(erreurs).toEqual([]);
  await ctxA.close();
  await ctxB.close();
});

test('lien de défi à 320 px, mode sombre : lisible, sans défilement de côté', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const ctx = await browser.newContext({ ...options(baseURL, 320), colorScheme: 'dark' });
  const page = await brancher(ctx, serveur);
  await page.goto(`/#defi=${JETON}&de=Florian`);
  await expect(page.getByRole('heading', { name: 'Florian te défie !' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Recevoir mon code' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  if (CAPTURES) await page.screenshot({ path: `${CAPTURES}/defi-arrivee-320-sombre.png`, fullPage: true });
  await ctx.close();
});

test('ancienne partie sans compte : l’ami lie son e-mail par code, choisit son pseudo et continue', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  // Partie commencée avant #343 : l'ami (session anonyme) a Noir, c'est à lui de jouer.
  const session = serveur.sessionAnonyme();
  serveur.games.push({ id: PARTIE, white_id: 'createur', black_id: session.user.id, created_by: 'createur', size: 9, komi: 6.5, rules: 'japanese', handicap: 0,
    moves: 'eeff', status: 'active', counting: false, dead_stones: null, dead_proposed_by: null, result: null, resumed_at: 0, prive: true, rated: false });
  serveur.defis.push({ partie_id: PARTIE, jeton: JETON, createur_id: 'createur', invite_id: session.user.id, delai_coup: '3 days',
    date_limite: new Date(Date.now() + 2 * 864e5).toISOString(), lien_expire_le: new Date(Date.now() + 7 * 864e5).toISOString(), cree_le: new Date().toISOString() });
  const ctx = await browser.newContext(options(baseURL));
  const page = await brancher(ctx, serveur, { 'sb-supabase-auth-token': JSON.stringify(session) });
  await page.goto('/');
  await page.getByTestId('mode-ami').click();
  // Session anonyme : l'écran propose de lier l'e-mail (même compte, la partie est gardée).
  await expect(page.getByTestId('creer-compte')).toHaveAttribute('data-raison', 'defi');
  await page.getByLabel('Ton adresse e-mail').fill('ancien@exemple.test');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Recevoir mon code' }).click();
  await page.getByLabel('Code à 6 chiffres').fill('123456');
  expect(serveur.appels.some(x => x.startsWith('PUT /auth/v1/user'))).toBe(true);
  await expect(page.getByTestId('pseudo-obligatoire')).toBeVisible();
  await page.getByRole('textbox', { name: 'Pseudo' }).fill('Ancien');
  await expect(page.getByText('Ancien est libre.')).toBeVisible();
  await page.getByRole('button', { name: 'C’est mon pseudo' }).click();
  // Compte complet, même identifiant : la liste des défis s'ouvre, la partie en cours y est, et il joue.
  await expect(page.getByRole('button', { name: 'Envoyer un lien' })).toBeVisible();
  // #400 : la ligne nomme l'adversaire ; le créateur de cette ancienne partie n'a pas de pseudo : « Ton ami ».
  await page.getByRole('button', { name: /^Ton ami/ }).click();
  await expect(page.getByText(/À toi de jouer/)).toBeVisible();
  await expect(page.getByTestId('lier-email')).toHaveCount(0);
  await jouer(page, 'C3');
  await expect(pierres(page, 'noir')).toHaveCount(2);
  expect(serveur.appels).not.toContain('POST /auth/v1/signup');
  await ctx.close();
});

test('lien abîmé : message clair tout de suite, sans demander de compte', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const ctx = await browser.newContext(options(baseURL));
  const page = await brancher(ctx, serveur);
  await page.goto('/#defi=abc');
  await expect(page.getByRole('alert')).toContainText(/introuvable/);
  await expect(page.getByTestId('defi-apercu')).toHaveCount(0);
  await page.getByRole('button', { name: 'Retour à l’accueil' }).click();
  await expect(page.getByTestId('mode-ami')).toBeVisible();
  await ctx.close();
});
