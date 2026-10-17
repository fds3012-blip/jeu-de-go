import { expect, test, type Browser, type Page } from '@playwright/test';
import { brancher, creerCompte, fauxServeur, type FauxServeur } from './fauxSupabase';
import { VERSION_CONDITIONS } from '../src/data/conditions';

// #583 : la case « J'ai 15 ans ou plus… J'accepte les conditions » cochée à la création du compte est gardée par le
// serveur (`accepter_conditions`). Un compte sans cette preuve revoit la case une fois ; le jeu en ligne attend qu'elle
// soit cochée. Supabase simulé : e2e/fauxSupabase.ts.

const ANA = '00000000-0000-4000-8000-000000000583';
const accords = (s: FauxServeur) => s.appels.filter(a => a.startsWith('POST /rest/v1/rpc/accepter_conditions')).length;

async function telephone(browser: Browser, baseURL: string | undefined, serveur: FauxServeur, stockage: Record<string, string>): Promise<Page> {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'fr-FR', baseURL, reducedMotion: 'reduce',
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }, { name: 'go.connait-go.v1', value: '"sait"' }] }] },
  });
  return brancher(ctx, serveur, stockage);
}

test('création du compte par code : l’accord est gardé par le serveur, une seule fois', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  // Essai fini : la prochaine partie ouvre « Crée ton compte ».
  const page = await telephone(browser, baseURL, serveur, { 'go.essai.v1': JSON.stringify({ terminees: 3, suivi: true }) });
  await page.goto('/');
  await page.locator('.cta').click();
  await expect(page.getByTestId('creer-compte')).toBeVisible();
  await creerCompte(page, 'nouvelle@exemple.test', 'Nina');
  await expect.poll(() => accords(serveur)).toBe(1);
  const profil = serveur.profiles.find(p => p.username === 'Nina')!;
  expect(profil.conditions_version).toBe(VERSION_CONDITIONS);
  expect(profil.conditions_acceptees_le).toBeTruthy();
  expect(await page.evaluate(() => localStorage.getItem('go.conditions-a-envoyer.v1'))).toBeNull();
  await expect(page.getByTestId('accord-conditions')).toHaveCount(0);

  // Ouverture suivante : la preuve est là, rien n'est renvoyé, la case n'est pas remontrée.
  await page.reload();
  await expect(page.getByTestId('modes')).toBeVisible();
  await page.waitForTimeout(500);
  expect(accords(serveur)).toBe(1);
  await expect(page.getByTestId('accord-conditions')).toHaveCount(0);
});

test('compte existant sans preuve : la case s’affiche une fois, le jeu en ligne l’attend', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const session = serveur.sessionCompte('ana@exemple.test', 'Ana', ANA);
  // Compte d'avant #583 : aucune acceptation enregistrée.
  Object.assign(serveur.profiles.find(p => p.id === ANA)!, { conditions_version: null, conditions_acceptees_le: null });
  // Joueur qui a déjà joué : l'accueil montre les modes (dont « En ligne »).
  const page = await telephone(browser, baseURL, serveur, { 'sb-supabase-auth-token': JSON.stringify(session),
    'go.parties.v1': JSON.stringify({ n: 6, dernier: 'caillou', ordi: 6 }), 'go.bilan.v1': JSON.stringify({ pomme: { v: 2, d: 1 }, caillou: { v: 0, d: 2 } }) });
  await page.goto('/');

  // À l'ouverture : la même case que la création du compte, jamais cochée d'avance, une seule action principale.
  const ecran = page.getByTestId('accord-conditions');
  await expect(ecran).toBeVisible();
  const caseAge = ecran.getByRole('checkbox', { name: /J’ai 15\s+ans ou plus, ou un parent est d’accord/ });
  await expect(caseAge).not.toBeChecked();
  await expect(ecran.getByRole('button', { name: 'Lire les conditions' })).toBeVisible();
  await expect(page.locator('.btn.primary:visible, .cta:visible')).toHaveCount(1);
  for (const b of await ecran.locator('button:visible').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  // Sans la case, rien ne part.
  await ecran.getByRole('button', { name: 'Valider' }).click({ force: true }); // aria-disabled, mais touchable : l'aide dit pourquoi
  await expect(ecran.getByText('Coche la case pour jouer en ligne.')).toBeVisible();
  expect(accords(serveur)).toBe(0);

  // « Plus tard » : l'accueil, sans la case (une fois par ouverture).
  await ecran.getByRole('button', { name: 'Plus tard' }).click();
  await expect(page.getByTestId('modes')).toBeVisible();
  await expect(ecran).toHaveCount(0);

  // Le jeu en ligne attend la case ; cochée, il s'ouvre.
  await page.locator('.cta[data-mode="en_ligne"], [data-testid="mode-en_ligne"]').first().click();
  await expect(ecran).toBeVisible();
  await caseAge.check();
  await ecran.getByRole('button', { name: 'Valider' }).click();
  await expect(page.getByTestId('direct-choix')).toBeVisible();
  expect(accords(serveur)).toBe(1);
  expect(serveur.profiles.find(p => p.id === ANA)!.conditions_version).toBe(VERSION_CONDITIONS);

  // Ouverture suivante : plus de case.
  await page.reload();
  await expect(page.getByTestId('modes')).toBeVisible();
  await page.waitForTimeout(500);
  await expect(ecran).toHaveCount(0);
  expect(accords(serveur)).toBe(1);
});
