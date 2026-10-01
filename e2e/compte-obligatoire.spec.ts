import { expect, test, type Page } from '@playwright/test';
import { brancher, CODE, fauxServeur } from './fauxSupabase';
import { plateau } from './plateau';

// #343 : compte obligatoire avec pseudo, essai limité sans compte (modèle chess.com), connexion par code à 6 chiffres.
// Supabase est simulé (e2e/fauxSupabase.ts) : sans service de compte, l'essai n'est pas limité (src/app/essai.ts).

const CAPTURES = process.env.CAPTURES_343;

async function sansDefilementHorizontal(page: Page) {
  const { large, vue } = await page.evaluate(() => ({ large: document.documentElement.scrollWidth, vue: window.innerWidth }));
  expect(large).toBeLessThanOrEqual(vue);
}

async function ciblesDe44(page: Page, zone: string) {
  const petites = await page.locator(`${zone} button:visible:not(.lien-texte), ${zone} input:visible:not([type=checkbox])`).evaluateAll(els =>
    els.map(e => ({ n: (e as HTMLElement).innerText || (e as HTMLInputElement).name || e.id, h: e.getBoundingClientRect().height })).filter(x => x.h < 44));
  expect(petites).toEqual([]);
}

test('essai → 3e partie finie → « Crée ton compte » → code → pseudo → la partie démarre', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', baseURL,
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }] }] } });
  // 2 parties d'essai déjà finies sur ce téléphone.
  const page = await brancher(ctx, serveur, { 'go.essai.v1': JSON.stringify({ terminees: 2 }) });
  const erreurs: string[] = [];
  page.on('pageerror', e => erreurs.push(e.message));

  // Leçons 1 à 3 et Go du jour libres ; la leçon 4 demande un compte.
  await page.goto('/');
  // 3e partie : libre. On abandonne tout de suite : elle compte.
  await page.locator('.cta').click();
  await expect(plateau(page)).toBeVisible();
  const actions = page.getByRole('toolbar', { name: 'Actions de la partie' });
  await actions.getByRole('button', { name: 'Abandonner' }).click();
  await actions.getByRole('button', { name: /^Confirmer/ }).click();
  await expect(page.locator('.cta')).toHaveText(/Rejouer contre Pomme/);
  expect(await page.evaluate(() => localStorage.getItem('go.essai.v1'))).toBe('{"terminees":3}');

  // 4e partie : l'essai est fini.
  await page.locator('.cta').click();
  const ecran = page.getByTestId('creer-compte');
  await expect(ecran).toBeVisible();
  await expect(ecran).toHaveAttribute('data-raison', 'parties');
  await expect(page.getByRole('heading', { name: 'Crée ton compte' })).toBeVisible();
  await expect(page.getByText(/Tu as joué tes 3 parties d’essai/)).toBeVisible();
  for (const garde of ['ta progression', 'ta série de jours', 'tes badges', 'tes parties']) await expect(ecran.getByText(garde)).toBeVisible();
  // Une seule action principale, pas de barre de navigation.
  await expect(page.locator('.btn.primary:visible, .cta:visible')).toHaveCount(1);
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await sansDefilementHorizontal(page);
  await ciblesDe44(page, '[data-testid="creer-compte"]');
  if (CAPTURES) await page.screenshot({ path: `${CAPTURES}/creer-compte-390-clair.png` });
  await page.emulateMedia({ colorScheme: 'dark' });
  if (CAPTURES) await page.screenshot({ path: `${CAPTURES}/creer-compte-390-sombre.png` });

  // Code par e-mail : saisie dans l'app (clavier chiffres, remplissage automatique du code).
  await page.getByLabel('Ton adresse e-mail').fill('nouveau@exemple.test');
  // Case d'âge jamais cochée d'avance : sans elle, l'aide dit pourquoi et rien ne part.
  const age = page.getByRole('checkbox', { name: /J’ai 15\s+ans ou plus, ou un parent est d’accord/ });
  await expect(age).not.toBeChecked();
  // aria-disabled : Playwright ne le toucherait pas ; au doigt, le toucher affiche l'aide.
  await expect(page.getByRole('button', { name: 'Recevoir mon code' })).toHaveAttribute('aria-disabled', 'true');
  await page.getByRole('button', { name: 'Recevoir mon code' }).click({ force: true });
  await expect(page.getByText(/Coche la case pour créer ton compte/)).toBeVisible();
  expect(serveur.emailsEnvoyes).toEqual([]);
  await page.getByRole('button', { name: /moins de 15\s+ans\s*\?/ }).click();
  await expect(page.getByText(/Montre cet écran à un parent/)).toBeVisible();
  await age.check();
  await page.getByRole('button', { name: 'Recevoir mon code' }).click();
  const champ = page.getByLabel('Code à 6 chiffres');
  await expect(champ).toBeFocused();
  await expect(champ).toHaveAttribute('autocomplete', 'one-time-code');
  await expect(champ).toHaveAttribute('inputmode', 'numeric');
  expect((await champ.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(page.getByText(/On t’a envoyé un code à 6\s+chiffres à nouveau@exemple\.test/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Renvoyer le code dans \d+ s/ })).toBeDisabled();
  if (CAPTURES) await page.screenshot({ path: `${CAPTURES}/code-390-sombre.png` });
  // Mauvais code : message clair, on reste.
  await champ.fill('000000');
  await expect(page.getByText('Ce code ne marche pas. Vérifie-le, ou demande un nouveau code.')).toBeVisible();
  // Bon code collé avec des espaces : validé tout seul.
  await champ.fill(`${CODE.slice(0, 3)} ${CODE.slice(3)}`);

  // Pseudo obligatoire, bloquant : pas de retour, pas de navigation.
  const pseudo = page.getByTestId('pseudo-obligatoire');
  await expect(pseudo).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Choisis ton pseudo' })).toBeVisible();
  await expect(page.getByText(/De 3 à 24 caractères/)).toBeVisible();
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Pseudo' }).fill('pris');
  await expect(page.getByText('Ce pseudo est déjà pris.').or(page.getByText(/déjà pris/))).toBeVisible();
  await expect(page.getByRole('button', { name: 'C’est mon pseudo' })).toBeDisabled();
  await page.getByRole('textbox', { name: 'Pseudo' }).fill('Joueur_1');
  await expect(page.getByText('Joueur_1 est libre.')).toBeVisible();
  await sansDefilementHorizontal(page);
  await ciblesDe44(page, '[data-testid="pseudo-obligatoire"]');
  if (CAPTURES) await page.screenshot({ path: `${CAPTURES}/pseudo-390-sombre.png` });
  await page.emulateMedia({ colorScheme: 'light' });
  if (CAPTURES) await page.screenshot({ path: `${CAPTURES}/pseudo-390-clair.png` });
  await page.getByRole('button', { name: 'C’est mon pseudo' }).click();

  // Compte complet : la partie demandée démarre.
  await expect(plateau(page)).toBeVisible();
  expect(serveur.appels.some(a => a.startsWith('PATCH /rest/v1/profiles'))).toBe(true);
  expect(serveur.appels).not.toContain('POST /auth/v1/signup');
  expect(erreurs).toEqual([]);
  await ctx.close();
});

test('leçon 4 et problèmes : compte demandé ; le Go du jour reste libre (320 px, sombre)', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const ctx = await browser.newContext({ viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', baseURL,
    colorScheme: 'dark', storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }] }] } });
  const page = await brancher(ctx, serveur);
  await page.goto('/');
  await page.getByRole('button', { name: 'Problèmes' }).click();
  // Go du jour : libre.
  await expect(page.getByRole('heading', { name: /Go du jour/ })).toBeVisible();
  // « Tous les problèmes » : compte.
  await page.getByRole('button', { name: 'Tous les problèmes' }).click();
  await expect(page.getByTestId('creer-compte')).toHaveAttribute('data-raison', 'problemes');
  await expect(page.getByText('Le Go du jour reste libre. Crée ton compte pour les autres problèmes.')).toBeVisible();
  await sansDefilementHorizontal(page);
  if (CAPTURES) await page.screenshot({ path: `${CAPTURES}/creer-compte-320-sombre.png`, fullPage: true });
  await page.getByRole('button', { name: 'Plus tard' }).click();
  await expect(page.getByTestId('creer-compte')).toHaveCount(0);
  await expect(page.getByRole('navigation')).toBeVisible();

  // Apprendre : la leçon 4 demande un compte.
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
  const lecon4 = page.getByRole('button', { name: /^Leçon 4 :/ });
  await lecon4.scrollIntoViewIfNeeded();
  await lecon4.click();
  await expect(page.getByTestId('creer-compte')).toHaveAttribute('data-raison', 'lecons');
  await page.getByRole('button', { name: 'Retour' }).click();
  // Les leçons 1 à 3 restent libres.
  await page.getByRole('button', { name: /^Leçon 3 :/ }).click();
  await expect(page.getByTestId('creer-compte')).toHaveCount(0);
  await expect(page.getByRole('progressbar', { name: 'Progression de la leçon' })).toBeVisible();
  expect(serveur.appels).not.toContain('POST /auth/v1/signup');
  await ctx.close();
});

test('code à 6 chiffres : champ, renvoi et retour à l’adresse (320 px, clair)', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const ctx = await browser.newContext({ viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', baseURL,
    colorScheme: 'light', storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }] }] } });
  const page = await brancher(ctx, serveur, { 'go.essai.v1': JSON.stringify({ terminees: 3 }) });
  await page.goto('/');
  await page.locator('.cta').click();
  await page.getByLabel('Ton adresse e-mail').fill('pas-une-adresse');
  await page.getByRole('button', { name: 'Recevoir mon code' }).click({ force: true });
  await expect(page.getByText('Entre une adresse e-mail valide.')).toBeVisible();
  await page.getByLabel('Ton adresse e-mail').fill('ami@exemple.test');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Recevoir mon code' }).click();
  await expect(page.getByLabel('Code à 6 chiffres')).toBeVisible();
  await sansDefilementHorizontal(page);
  await ciblesDe44(page, '[data-testid="creer-compte"]');
  if (CAPTURES) await page.screenshot({ path: `${CAPTURES}/code-320-clair.png`, fullPage: true });
  await page.getByRole('button', { name: 'Changer d’adresse' }).click();
  await expect(page.getByLabel('Ton adresse e-mail')).toHaveValue('ami@exemple.test');
  expect(serveur.emailsEnvoyes).toEqual([{ email: 'ami@exemple.test', type: 'email' }]);
  await ctx.close();
});
