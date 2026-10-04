import { expect, test, type Browser, type Page } from '@playwright/test';
import { brancher, fauxServeur, type FauxServeur } from './fauxSupabase';
import { jouer, pierres } from './plateau';

// Issue #359 : amis. Deux comptes deviennent amis par leur pseudo, puis l'un défie l'autre depuis « Mes amis », sans
// lien. Deux contextes = deux téléphones ; Supabase simulé (e2e/fauxSupabase.ts, mêmes codes de refus que le serveur).
// Captures : CAPTURES_359=docs/design/captures/amis-359 npx playwright test e2e/amis.spec.ts

const CAPTURES = process.env.CAPTURES_359;
const ALICE = '00000000-0000-4000-8000-0000000000a1';
const BRUNO = '00000000-0000-4000-8000-0000000000b2';

async function telephone(browser: Browser, baseURL: string | undefined, serveur: FauxServeur, session: object | null,
  o: { largeur?: number; hauteur?: number; sombre?: boolean; locale?: string } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: o.largeur ?? 390, height: o.hauteur ?? 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    locale: o.locale ?? 'fr-FR', baseURL, colorScheme: o.sombre ? 'dark' : 'light',
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }] }] },
  });
  const page = await brancher(ctx, serveur, session ? { 'sb-supabase-auth-token': JSON.stringify(session) } : {});
  const erreurs: string[] = [];
  page.on('pageerror', e => erreurs.push(e.message));
  return { ctx, page, erreurs };
}

async function capture(page: Page, nom: string) {
  if (CAPTURES) await page.screenshot({ path: `${CAPTURES}/${nom}.jpg`, type: 'jpeg', quality: 80, fullPage: true });
}

async function ouvrirAmis(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Profil', exact: true }).click();
  await page.getByRole('button', { name: /^Mes amis/ }).click();
  await expect(page.getByRole('heading', { name: 'Mes amis' })).toBeVisible();
}

const sansDefilementLateral = async (page: Page, largeur: number) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(largeur);

test('deux comptes deviennent amis, puis l’un défie l’autre depuis « Mes amis », sans lien', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const a = await telephone(browser, baseURL, serveur, serveur.sessionCompte('alice@exemple.test', 'Alice', ALICE));
  const b = await telephone(browser, baseURL, serveur, serveur.sessionCompte('bruno@exemple.test', 'Bruno', BRUNO), { sombre: true });

  // Alice : état vide accueillant, une seule action principale, « Ajouter ».
  await ouvrirAmis(a.page);
  await expect(a.page.getByText('Joue avec tes amis')).toBeVisible();
  await expect(a.page.locator('.btn.primary')).toHaveCount(1);
  const ajouter = a.page.getByRole('button', { name: 'Ajouter' });
  expect((await ajouter.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await capture(a.page, 'amis-vide-390-clair');

  // Erreurs claires : pseudo inconnu, puis son propre pseudo.
  const champ = a.page.getByRole('textbox', { name: 'Pseudo de ton ami' });
  await champ.fill('Personne');
  await ajouter.click();
  await expect(a.page.getByTestId('amis').getByRole('alert')).toHaveText(/Aucun joueur avec ce pseudo/);
  await expect(champ).toHaveAttribute('aria-invalid', 'true');
  await champ.fill('alice');
  await ajouter.click();
  await expect(a.page.getByTestId('amis').getByRole('alert')).toHaveText(/C’est ton pseudo/);

  // Demande à Bruno (sans tenir compte des majuscules).
  await champ.fill('bruno');
  await ajouter.click();
  await expect(a.page.getByTestId('amis').getByRole('status')).toHaveText(/Demande envoyée à bruno/);
  await expect(a.page.getByRole('heading', { name: 'En attente de réponse' })).toBeVisible();
  await expect(a.page.getByText('Bruno', { exact: true })).toBeVisible();
  // Doublon refusé.
  await champ.fill('Bruno');
  await a.page.getByRole('button', { name: 'Ajouter' }).click();
  await expect(a.page.getByTestId('amis').getByRole('alert')).toHaveText(/Demande déjà envoyée/);
  await sansDefilementLateral(a.page, 390);

  // Bruno : la ligne « Mes amis » du Profil annonce la demande ; il l'accepte.
  await b.page.goto('/');
  await b.page.getByRole('button', { name: 'Profil', exact: true }).click();
  const ligne = b.page.getByRole('button', { name: /^Mes amis/ });
  await expect(ligne).toContainText('1 demande');
  await capture(b.page, 'profil-ligne-amis-390-sombre');
  await ligne.click();
  await expect(b.page.getByRole('heading', { name: 'Demandes reçues' })).toBeVisible();
  const accepter = b.page.getByRole('button', { name: 'Accepter la demande de Alice' });
  expect((await accepter.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await capture(b.page, 'amis-demande-390-sombre');
  await accepter.click();
  await expect(b.page.getByRole('heading', { name: 'Tes amis' })).toBeVisible();
  const defier = b.page.getByRole('button', { name: /^Défier Alice/ });
  await expect(defier).toBeVisible();
  expect((await defier.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(b.page.getByRole('heading', { name: 'Demandes reçues' })).toHaveCount(0);
  await sansDefilementLateral(b.page, 390);
  await capture(b.page, 'amis-liste-390-sombre');

  // Bruno défie Alice : la partie s'ouvre tout de suite, sans lien. Alice a Noir et joue la première.
  await defier.click();
  await expect(b.page.getByText(/Au tour de Alice\./)).toBeVisible();
  expect(serveur.appels).toContain('POST /rest/v1/rpc/defier_ami');
  expect(serveur.appels).not.toContain('POST /rest/v1/rpc/creer_defi');
  await expect(b.page.getByRole('button', { name: 'Renvoyer le lien' })).toHaveCount(0);
  await capture(b.page, 'defi-depuis-amis-390-sombre');

  // Alice : son ami apparaît dans sa liste ; elle retrouve la partie dans ses défis et joue.
  await ouvrirAmis(a.page);
  await expect(a.page.getByRole('heading', { name: 'Tes amis' })).toBeVisible();
  await expect(a.page.getByRole('button', { name: /^Défier Bruno/ })).toBeVisible();
  await capture(a.page, 'amis-liste-390-clair');
  await a.page.getByRole('navigation').getByRole('button', { name: /^Jouer/ }).click();
  await a.page.getByTestId('mode-ami').click();
  await a.page.getByRole('button', { name: /Bruno/ }).first().click();
  await expect(a.page.getByText('Bruno te défie ! Tu as les pierres noires : à toi de commencer.')).toBeVisible();
  await jouer(a.page, 'E5');
  await expect(pierres(a.page, 'noir')).toHaveCount(1);

  expect([...a.erreurs, ...b.erreurs]).toEqual([]);
  await a.ctx.close();
  await b.ctx.close();
});

test('retirer un ami demande une confirmation ; annuler une demande envoyée', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const a = await telephone(browser, baseURL, serveur, serveur.sessionCompte('alice@exemple.test', 'Alice', ALICE));
  serveur.compteExistant('bruno@exemple.test', 'Bruno', BRUNO);
  serveur.compteExistant('chloe@exemple.test', 'Chloe', '00000000-0000-4000-8000-0000000000c3');
  serveur.amities.push({ de: BRUNO, a: ALICE, etat: 'accepted', le: new Date().toISOString() });
  serveur.amities.push({ de: ALICE, a: '00000000-0000-4000-8000-0000000000c3', etat: 'pending', le: new Date().toISOString() });
  await ouvrirAmis(a.page);

  await a.page.getByRole('button', { name: 'Retirer Bruno de tes amis' }).click();
  const confirmer = a.page.getByRole('button', { name: 'Confirmer : retirer Bruno de tes amis' });
  await expect(confirmer).toBeVisible();
  expect(serveur.appels.filter(x => x.includes('retirer_ami'))).toEqual([]);
  await confirmer.click();
  await expect(a.page.getByRole('heading', { name: 'Tes amis' })).toHaveCount(0);

  await a.page.getByRole('button', { name: 'Annuler ta demande à Chloe' }).click();
  await expect(a.page.getByText('Joue avec tes amis')).toBeVisible();
  expect(serveur.amities).toEqual([]);
  await a.ctx.close();
});

test('« Mes amis » à 320 px, mode sombre : lisible, cibles de 44 px, sans défilement de côté', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const a = await telephone(browser, baseURL, serveur, serveur.sessionCompte('alice@exemple.test', 'Alice', ALICE), { largeur: 320, hauteur: 568, sombre: true });
  await ouvrirAmis(a.page);
  await expect(a.page.getByText('Joue avec tes amis')).toBeVisible();
  await sansDefilementLateral(a.page, 320);
  await capture(a.page, 'amis-vide-320-sombre');

  // Un ami au pseudo long et une demande reçue : rien ne déborde.
  serveur.compteExistant('long@exemple.test', 'Un_pseudo_tres_tres_long', '00000000-0000-4000-8000-0000000000d4');
  serveur.compteExistant('bruno@exemple.test', 'Bruno', BRUNO);
  serveur.amities.push({ de: '00000000-0000-4000-8000-0000000000d4', a: ALICE, etat: 'accepted', le: new Date().toISOString() });
  serveur.amities.push({ de: BRUNO, a: ALICE, etat: 'pending', le: new Date().toISOString() });
  await a.page.getByRole('button', { name: 'Retour' }).click();
  await a.page.getByRole('button', { name: /^Mes amis/ }).click();
  await expect(a.page.getByRole('button', { name: /^Défier Un_pseudo/ })).toBeVisible();
  await sansDefilementLateral(a.page, 320);
  for (const bouton of await a.page.locator('.amis button').all()) {
    const boite = await bouton.boundingBox();
    expect(boite!.height, await bouton.innerText()).toBeGreaterThanOrEqual(44);
  }
  await capture(a.page, 'amis-liste-320-sombre');
  await a.ctx.close();
});

test('avec un compte et une demande reçue, le Profil tient sur un écran de 390 × 844 ; « À faire » mène aux amis', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const a = await telephone(browser, baseURL, serveur, serveur.sessionCompte('alice@exemple.test', 'Alice', ALICE));
  serveur.compteExistant('bruno@exemple.test', 'Bruno', BRUNO);
  serveur.amities.push({ de: BRUNO, a: ALICE, etat: 'pending', le: new Date().toISOString() });
  await a.page.goto('/');
  // Pastille jade sur l'onglet Profil (#367) : une demande d'ami attend.
  const onglet = a.page.getByRole('navigation').getByRole('button', { name: /Profil/ });
  await expect(onglet.locator('.onglet-pastille')).toHaveCount(1);
  await onglet.click();
  await expect(a.page.getByRole('button', { name: /^Mes amis/ })).toContainText('1 demande');
  await expect(a.page.getByRole('button', { name: /^Mes parties/ })).toBeVisible();
  await capture(a.page, 'profil-amis-390-clair');
  const { scroll, largeur } = await a.page.evaluate(() => ({ scroll: document.documentElement.scrollHeight, largeur: document.documentElement.scrollWidth }));
  expect(scroll).toBeLessThanOrEqual(844);
  expect(largeur).toBeLessThanOrEqual(390);
  await a.ctx.close();
});

test('sans compte : la ligne « Mes amis » ouvre la création du compte', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const a = await telephone(browser, baseURL, serveur, null);
  await a.page.goto('/');
  await a.page.getByRole('button', { name: 'Profil', exact: true }).click();
  const ligne = a.page.getByRole('button', { name: /^Mes amis/ });
  await expect(ligne).toContainText('Avec un compte');
  await ligne.click();
  await expect(a.page.getByTestId('creer-compte')).toBeVisible();
  expect(serveur.appels.filter(x => x.includes('mes_amis'))).toEqual([]);
  await a.ctx.close();
});

test('en anglais : « My friends », « Add », « Challenge »', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const a = await telephone(browser, baseURL, serveur, serveur.sessionCompte('alice@exemple.test', 'Alice', ALICE), { locale: 'en-US' });
  serveur.compteExistant('bruno@exemple.test', 'Bruno', BRUNO);
  serveur.amities.push({ de: BRUNO, a: ALICE, etat: 'accepted', le: new Date().toISOString() });
  await a.page.goto('/?lang=en');
  await a.page.getByRole('button', { name: 'Profile', exact: true }).click();
  await a.page.getByRole('button', { name: /^My friends/ }).click();
  await expect(a.page.getByRole('heading', { name: 'My friends' })).toBeVisible();
  await expect(a.page.getByRole('button', { name: 'Add', exact: true })).toBeVisible();
  await expect(a.page.getByRole('button', { name: /^Challenge Bruno/ })).toBeVisible();
  await capture(a.page, 'amis-liste-390-anglais');
  await a.ctx.close();
});
