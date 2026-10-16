import { expect, test, type Browser, type Page } from '@playwright/test';
import { brancher, fauxServeur, type FauxServeur } from './fauxSupabase';

// Issue #560 : profil public d'un joueur. Depuis « Mes amis », Alice ouvre le profil de son amie Chloé (grade, cote,
// parties classées), touche l'adversaire d'une partie (Bruno) et lui envoie une demande d'ami depuis son profil.
// Supabase simulé (e2e/fauxSupabase.ts, mêmes règles que le serveur).
// Captures : CAPTURES_560=docs/design/captures/profil-public-560 npx playwright test e2e/profil-public.spec.ts

const CAPTURES = process.env.CAPTURES_560;
const ALICE = '00000000-0000-4000-8000-0000000000a1';
const BRUNO = '00000000-0000-4000-8000-0000000000b2';
const CHLOE = '00000000-0000-4000-8000-0000000000c3';

async function telephone(browser: Browser, baseURL: string | undefined, serveur: FauxServeur, session: object | null,
  o: { largeur?: number; hauteur?: number; sombre?: boolean; locale?: string } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: o.largeur ?? 390, height: o.hauteur ?? 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    locale: o.locale ?? 'fr-FR', baseURL, colorScheme: o.sombre ? 'dark' : 'light',
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }, { name: 'go.connait-go.v1', value: '"sait"' }] }] },
  });
  const page = await brancher(ctx, serveur, { 'go.premiere-pierre.v1': 'true', ...(session ? { 'sb-supabase-auth-token': JSON.stringify(session) } : {}) });
  const erreurs: string[] = [];
  page.on('pageerror', e => erreurs.push(e.message));
  return { ctx, page, erreurs };
}

async function capture(page: Page, nom: string) {
  // Les pierres de la bande arrivent l'une après l'autre (≈ 350 ms) : la capture attend la fin de l'entrée.
  if (CAPTURES) await page.waitForTimeout(600);
  if (CAPTURES) await page.screenshot({ path: `${CAPTURES}/${nom}.jpg`, type: 'jpeg', quality: 80, fullPage: true });
}

const sansDefilementLateral = async (page: Page, largeur: number) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(largeur);

/** Chloé (1620, sûre) a joué 6 parties classées : 4 contre Bruno, 1 contre Alice, 1 contre Denis. Alice et Chloé sont amies. */
function peupler(serveur: FauxServeur) {
  serveur.compteExistant('bruno@exemple.test', 'Bruno', BRUNO);
  serveur.compteExistant('chloe@exemple.test', 'Chloe', CHLOE);
  serveur.compteExistant('denis@exemple.test', 'Denis', '00000000-0000-4000-8000-0000000000d4');
  Object.assign(serveur.profiles.find(p => p.id === CHLOE)!, { rating: 1620, cote_provisoire: false });
  serveur.amities.push({ de: CHLOE, a: ALICE, etat: 'accepted', le: new Date().toISOString() });
  const partie = (n: number, noir: string, blanc: string, result: string, size = 9) => serveur.games.push({
    id: `33333333-3333-4333-8333-${String(n).padStart(12, '0')}`, black_id: noir, white_id: blanc, created_by: noir, size, komi: 6.5, rules: 'japanese',
    handicap: 0, moves: 'eecc', status: 'finished', counting: false, dead_stones: null, dead_proposed_by: null, result, resumed_at: 0, prive: false, rated: true,
    updated_at: new Date(Date.now() - n * 864e5).toISOString(),
  });
  partie(1, CHLOE, BRUNO, 'B+R');
  partie(2, BRUNO, CHLOE, 'B+5.5', 13);
  partie(3, CHLOE, ALICE, 'W+T');
  partie(4, '00000000-0000-4000-8000-0000000000d4', CHLOE, 'W+2.5');
  partie(5, CHLOE, BRUNO, 'B+R');
  partie(6, CHLOE, BRUNO, 'W+R');
}

test('depuis « Mes amis », le profil d’une amie, puis celui d’un adversaire, à qui on demande d’être ami', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  peupler(serveur);
  const a = await telephone(browser, baseURL, serveur, serveur.sessionCompte('alice@exemple.test', 'Alice', ALICE));
  await a.page.goto('/');
  await a.page.getByRole('button', { name: 'Profil', exact: true }).click();
  await a.page.getByRole('button', { name: /^Mes amis/ }).click();
  const nom = a.page.getByRole('button', { name: 'Voir le profil de Chloe' });
  expect((await nom.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await nom.click();

  // Profil de Chloé : grade et cote, 6 parties classées, les 5 dernières, une seule action en relief : « Défier ».
  await expect(a.page.getByRole('heading', { name: 'Profil de Chloe' })).toBeVisible();
  const profil = a.page.getByTestId('profil-public');
  await expect(profil).toHaveAttribute('data-lien', 'amis');
  await expect(profil.locator('.joueur-grade')).toHaveText('14ᵉ kyu');
  await expect(profil.locator('.joueur-cote-nombre')).toHaveText('1620');
  await expect(profil.getByText('6 parties classées')).toBeVisible();
  await expect(profil.locator('.joueur-partie')).toHaveCount(5);
  await expect(profil.locator('.joueur-partie').first()).toContainText(/Victoire.*Bruno.*9 × 9/s);
  await expect(profil.locator('.joueur-partie').nth(2)).toContainText('contre toi');
  await expect(a.page.locator('.btn.primary')).toHaveCount(1);
  const defier = a.page.getByRole('button', { name: 'Défier Chloe' });
  expect((await defier.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(a.page.getByRole('button', { name: 'Signaler ou bloquer Chloe' })).toBeVisible();
  await sansDefilementLateral(a.page, 390);
  await capture(a.page, 'profil-amie-390-clair');
  // Jamais d'e-mail ni d'identifiant à l'écran.
  expect(await profil.innerText()).not.toMatch(/exemple\.test|00000000-0000/);

  // L'adversaire Bruno se touche : son profil s'ouvre, sans lien d'amitié ; une seule action : « Demander en ami ».
  await profil.getByRole('button', { name: 'Voir le profil de Bruno' }).first().click();
  await expect(a.page.getByRole('heading', { name: 'Profil de Bruno' })).toBeVisible();
  await expect(a.page.getByTestId('profil-public')).toHaveAttribute('data-lien', 'aucun');
  await expect(a.page.getByText('4 parties classées')).toBeVisible();
  await expect(a.page.getByTestId('profil-public').locator('.joueur-bande .stone')).toHaveCount(4);
  const demander = a.page.getByRole('button', { name: 'Demander en ami' });
  await expect(demander).toBeVisible();
  await expect(a.page.locator('.btn.primary')).toHaveCount(1);
  await demander.click();
  await expect(a.page.getByTestId('joueur-action').getByRole('status')).toHaveText(/Demande envoyée/);
  await expect(a.page.getByRole('button', { name: 'Annuler la demande' })).toBeVisible();
  expect(serveur.appels).toContain('POST /rest/v1/rpc/demander_ami');
  expect(serveur.amities.some(f => f.de === ALICE && f.a === BRUNO && f.etat === 'pending')).toBe(true);
  await capture(a.page, 'profil-demande-390-clair');

  // Retour : d'abord le profil de Chloé, puis « Mes amis ».
  await a.page.getByRole('button', { name: 'Retour' }).click();
  await expect(a.page.getByRole('heading', { name: 'Profil de Chloe' })).toBeVisible();
  await a.page.getByRole('button', { name: 'Retour' }).click();
  await expect(a.page.getByRole('heading', { name: 'Mes amis' })).toBeVisible();
  // La demande envoyée depuis le profil est dans la liste.
  await expect(a.page.getByRole('heading', { name: 'En attente de réponse' })).toBeVisible();

  expect(a.erreurs).toEqual([]);
  await a.ctx.close();
});

test('demande reçue : « Accepter » en action principale ; joueur bloqué : « Ce joueur n’est pas disponible » (sombre, 320 px)', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  peupler(serveur);
  // Bruno a demandé Alice ; Denis a bloqué Alice (elle ne le sait pas).
  serveur.amities.push({ de: BRUNO, a: ALICE, etat: 'pending', le: new Date().toISOString() });
  serveur.blocages.push({ de: '00000000-0000-4000-8000-0000000000d4', a: ALICE, le: new Date().toISOString() });
  const a = await telephone(browser, baseURL, serveur, serveur.sessionCompte('alice@exemple.test', 'Alice', ALICE), { largeur: 320, hauteur: 568, sombre: true });
  await a.page.goto('/');
  await a.page.getByRole('button', { name: 'Profil', exact: true }).click();
  await a.page.getByRole('button', { name: /^Mes amis/ }).click();
  await a.page.getByRole('button', { name: 'Voir le profil de Bruno' }).click();
  await expect(a.page.getByTestId('profil-public')).toHaveAttribute('data-lien', 'recue');
  await expect(a.page.getByText('Bruno veut devenir ton ami.')).toBeVisible();
  await expect(a.page.locator('.btn.primary')).toHaveCount(1);
  for (const bouton of await a.page.locator('.joueur button').all()) {
    const boite = await bouton.boundingBox();
    expect(boite!.height, await bouton.innerText()).toBeGreaterThanOrEqual(44);
  }
  await sansDefilementLateral(a.page, 320);
  await capture(a.page, 'profil-demande-recue-320-sombre');
  await a.page.getByRole('button', { name: 'Accepter', exact: true }).click();
  await expect(a.page.getByTestId('profil-public')).toHaveAttribute('data-lien', 'amis');
  await expect(a.page.getByRole('button', { name: 'Défier Bruno' })).toBeVisible();

  // Dans les parties de Bruno, Chloé est nommée ; Denis, qui a bloqué Alice, serait « un joueur ». Chloé → Denis : rien.
  await a.page.getByRole('button', { name: 'Voir le profil de Chloe' }).first().click();
  await expect(a.page.getByRole('heading', { name: 'Profil de Chloe' })).toBeVisible();
  const parties = a.page.getByTestId('profil-public').locator('.joueur-partie');
  await expect(parties.nth(3)).toContainText('contre un joueur');
  expect(await a.page.getByTestId('profil-public').innerText()).not.toContain('Denis');
  await capture(a.page, 'profil-amie-320-sombre');
  expect(a.erreurs).toEqual([]);
  await a.ctx.close();
});

test('en anglais : « Chloe’s profile », « Challenge Chloe », « Latest rated games »', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  peupler(serveur);
  const a = await telephone(browser, baseURL, serveur, serveur.sessionCompte('alice@exemple.test', 'Alice', ALICE), { locale: 'en-US' });
  await a.page.goto('/?lang=en');
  await a.page.getByRole('button', { name: 'Profile', exact: true }).click();
  await a.page.getByRole('button', { name: /^My friends/ }).click();
  await a.page.getByRole('button', { name: 'See Chloe’s profile' }).click();
  await expect(a.page.getByRole('heading', { name: 'Chloe’s profile' })).toBeVisible();
  await expect(a.page.getByRole('button', { name: 'Challenge Chloe' })).toBeVisible();
  await expect(a.page.getByRole('heading', { name: 'Latest rated games' })).toBeVisible();
  await expect(a.page.locator('.joueur-grade')).toHaveText('14 kyu');
  await capture(a.page, 'profil-amie-390-anglais');
  await a.ctx.close();
});
