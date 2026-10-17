import { expect, test, type Page } from '@playwright/test';
import { brancher, fauxServeur, type FauxServeur } from './fauxSupabase';

// #584 : requêtes Supabase d'un joueur connecté (faux serveur, e2e/fauxSupabase.ts).
// - Ouverture de l'accueil : `mon_profil` lu une seule fois (avant : 4 appels, dont 2 identiques).
// - Changements d'onglet : « À faire » (défis, notifications, file lente, demandes d'ami) n'est plus relu à chaque
//   onglet pendant une minute, sauf si le joueur change quelque chose (ici : une demande d'ami envoyée).
// Mesure de `main` : MESURE_AVANT=1 (affiche les comptes, sans vérifier).

const CORA = '00000000-0000-4000-8000-0000000000c4';
const A_FAIRE = /^(GET \/rest\/v1\/(defis|notifications|file_lente)\b|POST \/rest\/v1\/rpc\/mes_amis)/;
const compter = (s: FauxServeur, depuis: number, re: RegExp) => s.appels.slice(depuis).filter(a => re.test(a)).length;
const MESURE_AVANT = !!process.env.MESURE_AVANT;

async function onglet(page: Page, nom: string) {
  await page.getByRole('navigation').getByRole('button', { name: nom, exact: true }).click();
  await page.waitForTimeout(700);
}

test('joueur connecté : un seul `mon_profil` à l’ouverture, « À faire » pas relu à chaque onglet', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  serveur.compteExistant('bruno@exemple.test', 'Bruno', '00000000-0000-4000-8000-0000000000b2');
  const ctx = await browser.newContext({
    baseURL, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR',
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }, { name: 'go.connait-go.v1', value: '"sait"' }] }] },
  });
  const page = await brancher(ctx, serveur, { 'go.premiere-pierre.v1': 'true', 'sb-supabase-auth-token': JSON.stringify(serveur.sessionCompte('cora@exemple.test', 'Cora', CORA)) });
  const erreurs: string[] = [];
  page.on('pageerror', e => erreurs.push(e.message));

  await page.goto('/');
  await expect(page.locator('main.app-home .cta').first()).toBeVisible();
  // « À faire » se lit après le premier écran : on attend sa première lecture, puis que tout soit posé.
  await expect.poll(() => compter(serveur, 0, /rpc\/mes_amis/), { timeout: 15_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(1500);
  const profil = compter(serveur, 0, /rpc\/mon_profil/);
  const ouverture = compter(serveur, 0, A_FAIRE);

  const avant = serveur.appels.length;
  for (const nom of ['Problèmes', 'Apprendre', 'Jouer', 'Profil', 'Jouer']) await onglet(page, nom);
  const onglets = compter(serveur, avant, A_FAIRE);
  console.log(`#584 mesure : mon_profil à l'ouverture ${profil} ; « À faire » à l'ouverture ${ouverture} ; sur 5 changements d'onglet ${onglets}`);
  if (MESURE_AVANT) { await ctx.close(); return; }
  expect(profil).toBe(1);
  expect(onglets).toBe(0);

  // Le joueur change quelque chose (demande d'ami) : le changement d'onglet suivant relit.
  await onglet(page, 'Profil');
  await page.getByRole('button', { name: /^Mes amis/ }).click();
  await page.getByRole('textbox', { name: 'Pseudo de ton ami' }).fill('Bruno');
  await page.getByRole('button', { name: 'Ajouter' }).click();
  await expect(page.getByText(/Bruno/).first()).toBeVisible();
  // L'écran « Mes amis » relit sa liste après la demande : on la laisse finir.
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  const apresDemande = serveur.appels.length;
  await onglet(page, 'Jouer');
  expect(compter(serveur, apresDemande, /rpc\/mes_amis/)).toBe(1);
  expect(erreurs).toEqual([]);
  await ctx.close();
});
