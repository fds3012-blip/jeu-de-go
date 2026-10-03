import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';
import { brancher, fauxServeur, JETON, PARTIE, type FauxServeur } from './fauxSupabase';
import { plateau } from './plateau';

// #411 : Google, Apple, Facebook à côté du code par e-mail (docs/growth/connexion-sociale.md). Réseau simulé
// (e2e/fauxSupabase.ts) : `/auth/v1/authorize` renvoie aussitôt vers l'app, session dans le fragment ou erreur ;
// `linkIdentity` passe par `/auth/v1/user/identities/authorize`. Les builds de test activent chaque fournisseur par
// `e2e.google`, `e2e.apple`, `e2e.facebook` (en production : VITE_AUTH_GOOGLE, VITE_AUTH_APPLE, VITE_AUTH_FACEBOOK).

const CAPTURES = process.env.CAPTURES_411;
const TOUS = { 'e2e.google': '1', 'e2e.apple': '1', 'e2e.facebook': '1' };
const ESSAI_FINI = { 'go.essai.v1': JSON.stringify({ terminees: 3 }) };
const ANONYME = '00000000-0000-4000-8000-0000000000aa';

async function telephone(browser: Browser, baseURL: string | undefined, serveur: FauxServeur,
  o: { largeur?: number; hauteur?: number; sombre?: boolean; locale?: string; stockage?: Record<string, string> } = {}) {
  const largeur = o.largeur ?? 390;
  const ctx = await browser.newContext({
    viewport: { width: largeur, height: o.hauteur ?? (largeur === 320 ? 568 : 844) }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    locale: o.locale ?? 'fr-FR', baseURL, colorScheme: o.sombre ? 'dark' : 'light',
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }] }] },
  });
  const page = await brancher(ctx, serveur, o.stockage ?? {});
  const erreurs: string[] = [];
  page.on('pageerror', e => erreurs.push(e.message));
  return { ctx, page, erreurs };
}

async function capture(page: Page, nom: string) {
  if (CAPTURES) await page.screenshot({ path: `${CAPTURES}/${nom}.jpg`, type: 'jpeg', quality: 80, fullPage: true });
}

async function ciblesDe44(page: Page, zone: string) {
  const petites = await page.locator(`${zone} button:visible, ${zone} input:visible:not([type=checkbox]), ${zone} a:visible`).evaluateAll(els =>
    els.map(e => ({ n: (e as HTMLElement).innerText || e.id, h: e.getBoundingClientRect().height })).filter(x => x.h < 43.5));
  expect(petites).toEqual([]);
}

async function sansDefilementHorizontal(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
}

const haut = async (l: Locator) => (await l.boundingBox())!.y;
const fond = (l: Locator) => l.evaluate(e => getComputedStyle(e).backgroundColor);

/** Défi d'un ami, en attente : ouvert par lien. */
function defiEnAttente(serveur: FauxServeur) {
  serveur.profiles.push({ id: 'createur', username: 'Ami', rating: 1500, streak_days: 0, streak_last: null, streak_freezes: 0 });
  serveur.games.push({ id: PARTIE, white_id: 'createur', black_id: null, created_by: 'createur', size: 9, komi: 6.5, rules: 'japanese', handicap: 0,
    moves: '', status: 'waiting', counting: false, dead_stones: null, dead_proposed_by: null, result: null, resumed_at: 0, prive: true, rated: false });
  serveur.defis.push({ partie_id: PARTIE, jeton: JETON, createur_id: 'createur', invite_id: null, delai_coup: '3 days', date_limite: null,
    lien_expire_le: new Date(Date.now() + 7 * 864e5).toISOString(), cree_le: new Date().toISOString() });
}

/** Partie commencée sans compte (ancien défi) : la progression à garder. */
function partieSansCompte(serveur: FauxServeur) {
  const id = '33333333-3333-4333-8333-333333333333';
  serveur.games.push({ id, white_id: 'createur', black_id: ANONYME, created_by: 'createur', size: 9, komi: 6.5, rules: 'japanese', handicap: 0,
    moves: 'eeff', status: 'active', counting: false, dead_stones: null, dead_proposed_by: null, result: null, resumed_at: 0, prive: true, rated: false });
  return id;
}

test('trois fournisseurs : même ordre, charte de chaque marque, 48 px, puis « ou » et le code (390 clair, puis sombre)', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const { ctx, page, erreurs } = await telephone(browser, baseURL, serveur, { stockage: { ...TOUS, ...ESSAI_FINI } });
  await page.goto('/');
  await page.locator('.cta').click();
  const ecran = page.getByTestId('creer-compte');
  const g = ecran.getByRole('button', { name: 'Continuer avec Google' });
  const a = ecran.getByRole('button', { name: 'Continuer avec Apple' });
  const f = ecran.getByRole('button', { name: 'Continuer avec Facebook' });
  await expect(f).toBeVisible();
  // Ordre : case d'âge, Google, Apple, Facebook, « ou », e-mail, « Recevoir mon code » (contour).
  const age = ecran.getByRole('checkbox');
  const email = ecran.getByLabel('Ton adresse e-mail');
  const ys = [await haut(age), await haut(g), await haut(a), await haut(f), await haut(ecran.getByText('ou', { exact: true })), await haut(email)];
  expect([...ys].sort((x, y) => x - y)).toEqual(ys);
  // Même taille pour tous (Apple l'exige), cible tactile large.
  const hauteurs = await Promise.all([g, a, f].map(async b => Math.round((await b.boundingBox())!.height)));
  expect(new Set(hauteurs).size).toBe(1);
  expect(hauteurs[0]).toBeGreaterThanOrEqual(48);
  // Chartes : Google blanc, Apple noir (clair), Facebook bleu #1877F2.
  expect(await fond(g)).toBe('rgb(255, 255, 255)');
  expect(await fond(a)).toBe('rgb(0, 0, 0)');
  expect(await fond(f)).toBe('rgb(24, 119, 242)');
  await expect(page.locator('.btn.primary:visible')).toHaveCount(0);
  await sansDefilementHorizontal(page);
  await ciblesDe44(page, '[data-testid="creer-compte"]');
  await capture(page, 'creer-390-clair');
  // Sombre : Apple passe en blanc (HIG), Google en #131314.
  await page.emulateMedia({ colorScheme: 'dark' });
  // Les boutons ont une courte transition de couleur (app.css) : on attend la fin.
  await expect.poll(() => fond(a)).toBe('rgb(255, 255, 255)');
  await expect.poll(() => fond(g)).toBe('rgb(19, 19, 20)');
  expect(await fond(f)).toBe('rgb(24, 119, 242)');
  await capture(page, 'creer-390-sombre');
  expect(erreurs).toEqual([]);
  await ctx.close();
});

test('drapeaux : un fournisseur non réglé n’apparaît jamais (Google et Facebook seuls ; aucun)', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const deux = await telephone(browser, baseURL, serveur, { stockage: { 'e2e.google': '1', 'e2e.facebook': '1', ...ESSAI_FINI } });
  await deux.page.goto('/');
  await deux.page.locator('.cta').click();
  await expect(deux.page.getByTestId('bouton-google')).toBeVisible();
  await expect(deux.page.getByTestId('bouton-facebook')).toBeVisible();
  await expect(deux.page.getByTestId('bouton-apple')).toHaveCount(0);
  expect(await haut(deux.page.getByTestId('bouton-google'))).toBeLessThan(await haut(deux.page.getByTestId('bouton-facebook')));
  await deux.ctx.close();

  const aucun = await telephone(browser, baseURL, serveur, { stockage: ESSAI_FINI });
  await aucun.page.goto('/');
  await aucun.page.locator('.cta').click();
  await expect(aucun.page.getByRole('button', { name: 'Recevoir mon code' })).toBeVisible();
  await expect(aucun.page.getByTestId('fournisseurs')).toHaveCount(0);
  await expect(aucun.page.getByTestId('aide-navigateur')).toHaveCount(0);
  await aucun.ctx.close();
});

test('Facebook de bout en bout : case d’âge, aller-retour, pseudo exigé et jamais pré-rempli, la partie démarre (320 × 568, sombre)', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  serveur.compteSocial('facebook', { email: 'fanny@exemple.test', nom: 'Fanny Martin' });
  const { ctx, page, erreurs } = await telephone(browser, baseURL, serveur, { largeur: 320, sombre: true, stockage: { ...TOUS, ...ESSAI_FINI } });
  await page.goto('/');
  await page.locator('.cta').click();
  const ecran = page.getByTestId('creer-compte');
  await expect(ecran.getByTestId('bouton-facebook')).toBeVisible();
  await sansDefilementHorizontal(page);
  await ciblesDe44(page, '[data-testid="creer-compte"]');
  await capture(page, 'creer-320-sombre');
  // Sans la case : rien ne part, l'aide dit pourquoi.
  await ecran.getByTestId('bouton-facebook').click({ force: true });
  await expect(page.getByText('Coche la case pour créer ton compte.')).toBeVisible();
  expect(serveur.autorisations).toEqual([]);
  await ecran.getByRole('checkbox').check();
  await ecran.getByTestId('bouton-facebook').click();

  await expect(page.getByTestId('pseudo-obligatoire')).toBeVisible();
  expect(serveur.autorisations).toEqual(['facebook']);
  const pseudo = page.getByRole('textbox', { name: 'Pseudo' });
  await expect(pseudo).toHaveValue('');
  await expect(page.getByText(/Fanny|Martin/)).toHaveCount(0);
  expect(await page.evaluate(() => location.hash)).toBe('');
  await capture(page, 'pseudo-apres-facebook-320-sombre');
  await pseudo.fill('Fanny_go');
  await expect(page.getByText('Fanny_go est libre.')).toBeVisible();
  await page.getByRole('button', { name: 'C’est mon pseudo' }).click();
  await expect(plateau(page)).toBeVisible();
  expect(serveur.profiles.find(p => p.id === '00000000-0000-4000-8000-00000000009f')?.username).toBe('Fanny_go');
  expect(erreurs).toEqual([]);
  await ctx.close();
});

test('Apple annulé : retour sur « Crée ton compte », phrase claire, rien de perdu', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  serveur.compteSocial('apple', { email: 'x@exemple.test', nom: 'X', annule: true });
  const { ctx, page } = await telephone(browser, baseURL, serveur, { stockage: { ...TOUS, ...ESSAI_FINI } });
  await page.goto('/');
  await page.locator('.cta').click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Continuer avec Apple' }).click();
  await expect(page.getByTestId('creer-compte')).toHaveAttribute('data-raison', 'parties');
  await expect(page.getByRole('alert').filter({ hasText: 'Connexion' })).toHaveText('Connexion annulée. Réessaie, ou reçois un code par e-mail.');
  expect(await page.evaluate(() => location.hash)).toBe('');
  // Rien n'a changé : les trois boutons et le code sont toujours là.
  await expect(page.getByTestId('fournisseurs').getByRole('button')).toHaveCount(3);
  await ctx.close();
});

test('session sans compte : Google relie la session (même identifiant, partie gardée), pseudo exigé, défi rejoint', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const anonyme = serveur.sessionAnonyme(ANONYME);
  serveur.compteSocial('google', { email: 'nouveau@exemple.test', nom: 'Nouveau Joueur' });
  defiEnAttente(serveur);
  const enCours = partieSansCompte(serveur);
  const { ctx, page, erreurs } = await telephone(browser, baseURL, serveur, { stockage: { ...TOUS, 'sb-supabase-auth-token': JSON.stringify(anonyme) } });
  await page.goto(`/#defi=${JETON}&de=Ami`);
  const apercu = page.getByTestId('defi-apercu');
  // Avant le premier coup : même ordre que partout.
  const boutons = apercu.getByTestId('fournisseurs').getByRole('button');
  await expect(boutons).toHaveText(['Continuer avec Google', 'Continuer avec Apple', 'Continuer avec Facebook']);
  await apercu.getByRole('checkbox').check();
  await apercu.getByRole('button', { name: 'Continuer avec Google' }).click();

  await expect(page.getByTestId('pseudo-obligatoire')).toBeVisible();
  // linkIdentity : la session garde son identifiant, elle n'est plus anonyme ; sa partie est toujours à elle.
  expect(serveur.autorisations).toEqual(['lier:google']);
  expect(serveur.utilisateur(ANONYME)?.anonyme).toBe(false);
  expect(serveur.games.find(x => x.id === enCours)?.black_id).toBe(ANONYME);
  await page.getByRole('textbox', { name: 'Pseudo' }).fill('Nouveau_go');
  await expect(page.getByText('Nouveau_go est libre.')).toBeVisible();
  await page.getByRole('button', { name: 'C’est mon pseudo' }).click();
  await expect.poll(() => serveur.defis[0].invite_id).toBe(ANONYME);
  await expect(plateau(page)).toBeVisible();
  expect(serveur.appels).not.toContain('POST /rest/v1/rpc/preparer_rattachement');
  expect(erreurs).toEqual([]);
  await ctx.close();
});

test('identité déjà reliée à un autre compte : avertissement, « Se connecter à ce compte », partie rattachée (390 clair)', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const anonyme = serveur.sessionAnonyme(ANONYME);
  const florian = serveur.compteExistant('fds@exemple.test', 'Florian');
  serveur.relierIdentite('google', 'fds.perso@exemple.test', florian);
  serveur.compteSocial('google', { email: 'fds.perso@exemple.test', nom: 'Florian D.' });
  defiEnAttente(serveur);
  const enCours = partieSansCompte(serveur);
  const { ctx, page, erreurs } = await telephone(browser, baseURL, serveur, { stockage: { ...TOUS, 'sb-supabase-auth-token': JSON.stringify(anonyme) } });
  await page.goto(`/#defi=${JETON}&de=Ami`);
  const apercu = page.getByTestId('defi-apercu');
  await apercu.getByRole('checkbox').check();
  await apercu.getByRole('button', { name: 'Continuer avec Google' }).click();

  const encadre = page.getByTestId('deja-lie');
  await expect(encadre).toBeVisible();
  await expect(encadre).toContainText('Ce compte Google est déjà relié à un autre compte du jeu.');
  await expect(encadre).toContainText('Attention : ta partie commencée sans compte risque de ne pas te suivre dans ce compte.');
  // Une seule action principale : se connecter à ce compte. Le code par e-mail reste dessous.
  await expect(page.locator('.btn.primary:visible')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Recevoir mon code' })).toBeVisible();
  expect(await page.evaluate(() => location.hash)).toBe('');
  await sansDefilementHorizontal(page);
  await ciblesDe44(page, '[data-testid="defi-apercu"]');
  await capture(page, 'deja-lie-390-clair');

  await encadre.getByRole('button', { name: 'Se connecter à ce compte' }).click();
  // Compte existant, pseudo déjà choisi : pas d'écran de pseudo ; la partie sans compte est rattachée ; le défi est rejoint.
  await expect(plateau(page)).toBeVisible();
  await expect(page.getByTestId('pseudo-obligatoire')).toHaveCount(0);
  expect(serveur.autorisations).toEqual(['lier:google', 'google']);
  await expect.poll(() => serveur.games.find(x => x.id === enCours)?.black_id).toBe(florian.id);
  await expect.poll(() => serveur.defis[0].invite_id).toBe(florian.id);
  expect(erreurs).toEqual([]);
  await ctx.close();
});

test('liaison fermée dans Supabase : repli sur la connexion classique, avec rattachement', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  serveur.liaison(false);
  const anonyme = serveur.sessionAnonyme(ANONYME);
  serveur.compteSocial('facebook', { email: 'repli@exemple.test', nom: 'Repli' });
  const enCours = partieSansCompte(serveur);
  serveur.profiles.push({ id: 'createur', username: 'Ami', rating: 1500, streak_days: 0, streak_last: null, streak_freezes: 0 });
  const { ctx, page } = await telephone(browser, baseURL, serveur, { stockage: { ...TOUS, 'sb-supabase-auth-token': JSON.stringify(anonyme) } });
  await page.goto('/');
  await page.getByRole('button', { name: 'Profil', exact: true }).click();
  await page.getByRole('button', { name: /Mon compte/ }).first().click();
  const lier = page.getByTestId('lier-email');
  await lier.getByRole('checkbox').check();
  await lier.getByRole('button', { name: 'Continuer avec Facebook' }).click();
  await expect(page.getByTestId('pseudo-obligatoire')).toBeVisible();
  expect(serveur.autorisations).toEqual(['facebook']);
  expect(serveur.appels).toContain('POST /rest/v1/rpc/preparer_rattachement');
  await expect.poll(() => serveur.games.find(x => x.id === enCours)?.black_id).toBe('00000000-0000-4000-8000-00000000009f');
  await ctx.close();
});

test('Mon compte : relier Facebook, le retirer ; le dernier moyen ne se retire pas (390 clair)', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const id = '00000000-0000-4000-8000-0000000000c1';
  const ses = serveur.sessionCompte('camille@exemple.test', 'Camille', id);
  serveur.compteSocial('facebook', { email: 'camille.fb@exemple.test', nom: 'Camille B.' });
  const { ctx, page, erreurs } = await telephone(browser, baseURL, serveur,
    { stockage: { 'e2e.google': '1', 'e2e.facebook': '1', 'sb-supabase-auth-token': JSON.stringify(ses) } });
  await page.goto('/');
  await page.getByRole('button', { name: 'Profil', exact: true }).click();
  await page.getByRole('button', { name: /Mon compte/ }).first().click();
  const moyens = page.getByTestId('moyens-connexion');
  await expect(moyens.locator('li')).toHaveCount(1);
  await expect(moyens.locator('li')).toContainText('Code par e-mail');
  await expect(moyens.getByRole('button', { name: /Retirer/ })).toHaveCount(0);
  await expect(moyens.getByTestId('fournisseurs').getByRole('button')).toHaveText(['Continuer avec Google', 'Continuer avec Facebook']);
  await moyens.getByRole('button', { name: 'Continuer avec Facebook' }).click();

  // Retour : Mon compte se rouvre, Facebook est relié au MÊME compte.
  await expect(page.getByText('Facebook est relié à ton compte.')).toBeVisible();
  expect(serveur.autorisations).toEqual(['lier:facebook']);
  await expect(moyens.locator('li')).toHaveCount(2);
  await expect(moyens.locator('li[data-moyen="facebook"]')).toContainText('camille.fb@exemple.test');
  await expect(moyens.getByTestId('bouton-facebook')).toHaveCount(0);
  await expect(page.getByText(/Camille B\./)).toHaveCount(0);
  await sansDefilementHorizontal(page);
  await ciblesDe44(page, '[data-testid="moyens-connexion"]');
  await capture(page, 'mon-compte-390-clair');

  await moyens.getByRole('button', { name: 'Retirer Facebook' }).click();
  await expect(page.getByText('Facebook est retiré de ton compte.')).toBeVisible();
  await expect(moyens.locator('li')).toHaveCount(1);
  await expect(moyens.getByRole('button', { name: /Retirer/ })).toHaveCount(0);
  expect(serveur.utilisateur(id)?.identites?.map(i => i.provider)).toEqual(['email']);
  expect(erreurs).toEqual([]);
  await ctx.close();
});

test('Mon compte : identité déjà à un autre compte → avertissement et « Se connecter à ce compte » (anglais, 320 sombre)', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const autre = serveur.compteExistant('other@exemple.test', 'Other', '00000000-0000-4000-8000-0000000000d2');
  serveur.relierIdentite('google', 'shared@exemple.test', autre);
  serveur.compteSocial('google', { email: 'shared@exemple.test', nom: 'Shared' });
  const ses = serveur.sessionCompte('me@exemple.test', 'Me', '00000000-0000-4000-8000-0000000000d1');
  const { ctx, page } = await telephone(browser, baseURL, serveur,
    { largeur: 320, sombre: true, locale: 'en-US', stockage: { ...TOUS, 'sb-supabase-auth-token': JSON.stringify(ses) } });
  await page.goto('/?lang=en');
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await page.getByRole('button', { name: /My account/ }).first().click();
  await page.getByTestId('moyens-connexion').getByRole('button', { name: 'Continue with Google' }).click();
  const encadre = page.getByTestId('deja-lie');
  await expect(encadre).toContainText('This Google account is already linked to another game account.');
  await expect(encadre).toContainText('Heads-up: you’ll leave your current account on this phone.');
  await sansDefilementHorizontal(page);
  await ciblesDe44(page, '[data-testid="moyens-connexion"]');
  await capture(page, 'mon-compte-deja-lie-en-320-sombre');
  await encadre.getByRole('button', { name: 'Sign in to that account' }).click();
  await expect(page.getByText('Other', { exact: true })).toBeVisible();
  await ctx.close();
});
