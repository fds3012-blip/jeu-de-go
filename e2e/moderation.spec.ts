import { expect, test, type Browser, type Page } from '@playwright/test';
import { brancher, fauxServeur, type FauxServeur } from './fauxSupabase';
import { choisirMode } from './plateau';

// Issue #531 : modération. Sur le Supabase simulé (e2e/fauxSupabase.ts) : un pseudo interdit est refusé pendant la
// saisie, avec une phrase lisible, et le bouton reste inactif ; un compte suspendu lit un refus clair en cherchant une
// partie en direct, en ajoutant un ami, sans jamais le message générique. La vraie liste de mots et les déclencheurs
// sont testés par supabase/tests/moderation.test.sql.

const ZOE = '00000000-0000-4000-8000-000000053111';
const YAN = '00000000-0000-4000-8000-000000053112';
const SUSPENDU = 'Ton compte est suspendu : rien en ligne pour l’instant. L’ordi, les leçons et les problèmes restent ouverts.';

async function telephone(browser: Browser, baseURL: string | undefined, serveur: FauxServeur, session: unknown, sombre = false): Promise<Page> {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'fr-FR', baseURL,
    colorScheme: sombre ? 'dark' : 'light', reducedMotion: 'reduce',
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }, { name: 'go.connait-go.v1', value: '"sait"' }] }] },
  });
  const page = await brancher(ctx, serveur, { 'go.premiere-pierre.v1': 'true', 'go.parties.v1': JSON.stringify({ n: 3 }), 'sb-supabase-auth-token': JSON.stringify(session) });
  await page.goto('/');
  return page;
}

test('pseudo interdit : refusé pendant la saisie, phrase lisible, bouton inactif ; un pseudo correct passe', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const page = await telephone(browser, baseURL, serveur, serveur.sessionCompte('zoe@exemple.test', null as unknown as string, ZOE));
  const erreurs: string[] = [];
  page.on('pageerror', e => erreurs.push(e.message));
  const ecran = page.getByTestId('pseudo-obligatoire');
  await expect(ecran).toBeVisible();
  const champ = ecran.getByRole('textbox', { name: 'Pseudo' });
  await champ.fill('GrosConnard');
  await expect(ecran.getByRole('status')).toHaveText('Ce pseudo n’est pas accepté. Choisis-en un autre, sans gros mot ni nom de l’équipe.');
  await expect(champ).toHaveAttribute('aria-invalid', 'true');
  await expect(ecran.getByRole('button', { name: 'C’est mon pseudo' })).toBeDisabled();
  expect(serveur.profiles.find(p => p.id === ZOE)?.username).toBeNull();

  await champ.fill('Zoe');
  await expect(ecran.getByText('Zoe est libre.')).toBeVisible();
  await ecran.getByRole('button', { name: 'C’est mon pseudo' }).click();
  await expect(ecran).toHaveCount(0);
  expect(serveur.profiles.find(p => p.id === ZOE)?.username).toBe('Zoe');
  expect(erreurs).toEqual([]);
});

test('compte suspendu : refus clair en direct et chez les amis, l’ordi reste ouvert', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  serveur.suspendus.add(YAN);
  const page = await telephone(browser, baseURL, serveur, serveur.sessionCompte('yan@exemple.test', 'Yan', YAN), true);
  const erreurs: string[] = [];
  page.on('pageerror', e => erreurs.push(e.message));

  // Partie en direct : la recherche est refusée par le serveur, la phrase le dit.
  await choisirMode(page, 'en_ligne');
  await page.getByTestId('direct-choix').getByRole('button', { name: 'Trouver un adversaire' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Ton compte est suspendu' })).toHaveText(SUSPENDU);
  expect(serveur.file).toHaveLength(0);

  // Mes amis : la demande est refusée de même.
  serveur.compteExistant('lea@exemple.test', 'Lea', '00000000-0000-4000-8000-000000053113');
  await page.goto('/');
  await page.getByRole('button', { name: 'Profil', exact: true }).click();
  await page.getByRole('button', { name: /^Mes amis/ }).click();
  await page.getByRole('textbox', { name: 'Pseudo de ton ami' }).fill('Lea');
  await page.getByRole('button', { name: 'Ajouter' }).click();
  await expect(page.getByTestId('amis').getByRole('alert')).toHaveText(SUSPENDU);
  expect(serveur.amities).toHaveLength(0);
  expect(erreurs).toEqual([]);
});
