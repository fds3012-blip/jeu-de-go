import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';
import { brancher, fauxServeur, type FauxServeur } from './fauxSupabase';
import { choisirMode, jouer, plateau, attendrePierre } from './plateau';

// Issue #360 : jouer en direct contre un humain. Deux téléphones (deux contextes) sur le même Supabase simulé
// (e2e/fauxSupabase.ts) : ils se trouvent, jouent jusqu'au score, voient le « +162 » de la cote, « Rejouer » et
// « Revoir la partie ». Les règles du serveur (pendule, perte au temps, absence, cote une seule fois) sont testées par
// supabase/tests/partie_en_direct.test.sql ; ici, le parcours et l'écran.

const ANA = '00000000-0000-4000-8000-0000000000c1';
const BOB = '00000000-0000-4000-8000-0000000000c2';
const CAPTURES = process.env.CAPTURES_360; // ex. /tmp/captures-360

async function telephone(browser: Browser, baseURL: string | undefined, serveur: FauxServeur, qui: { email: string; pseudo: string; id: string } | null,
  o: { largeur?: number; hauteur?: number; sombre?: boolean; polices?: boolean; texte200?: boolean } = {}): Promise<Page> {
  const ctx = await browser.newContext({
    viewport: { width: o.largeur ?? 390, height: o.hauteur ?? 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'fr-FR', baseURL,
    colorScheme: o.sombre ? 'dark' : 'light', reducedMotion: 'reduce',
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }] }] },
  });
  const stockage: Record<string, string> = { 'go.parties.v1': JSON.stringify({ n: 3 }) };
  if (qui) stockage['sb-supabase-auth-token'] = JSON.stringify(serveur.sessionCompte(qui.email, qui.pseudo, qui.id));
  const page = await brancher(ctx, serveur, stockage);
  if (o.polices === false) await page.route(/\.(woff2?|ttf|otf)(\?|$)/, r => r.abort());
  if (o.texte200) await page.addInitScript(() => { document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = '200%'; }); });
  await page.goto('/');
  return page;
}

/** Accueil → « En ligne » (#429 : tuile, ou bouton principal du joueur confirmé). */
async function ouvrirDirect(page: Page) {
  await choisirMode(page, 'en_ligne');
}

async function sansDebord(page: Page, ecran: string) {
  const m = await page.evaluate(() => {
    const fautifs = [...document.querySelectorAll('body *')]
      .filter(e => e instanceof HTMLElement && e.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
      .slice(0, 6).map(e => `${e.tagName.toLowerCase()}.${String(e.className).split(' ').join('.')} (${Math.round(e.getBoundingClientRect().right)})`);
    return { scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth, fautifs };
  });
  expect(m.scroll, `${ecran} : défilement horizontal (${m.fautifs.join(' ; ')})`).toBeLessThanOrEqual(m.client);
}
async function cible44(l: Locator, nom: string) {
  const b = (await l.boundingBox())!;
  expect(b.height, `${nom} : 44 px de haut`).toBeGreaterThanOrEqual(43.5);
}

test('deux comptes se trouvent en moins de 10 s et jouent jusqu’au score ; « +162 », « Rejouer », « Revoir »', async ({ browser, baseURL }) => {
  test.setTimeout(90_000);
  const serveur = fauxServeur();
  const ana = await telephone(browser, baseURL, serveur, { email: 'ana@exemple.test', pseudo: 'Ana', id: ANA });
  const bob = await telephone(browser, baseURL, serveur, { email: 'bob@exemple.test', pseudo: 'Bob', id: BOB });
  const erreurs: string[] = [];
  for (const p of [ana, bob]) p.on('pageerror', e => erreurs.push(e.message));

  // Choix : un seul bouton principal, 10 min + 3 × 30 s par défaut, byo-yomi expliqué.
  await ouvrirDirect(ana);
  const choix = ana.getByTestId('direct-choix');
  await expect(choix.getByRole('heading', { name: 'Un humain, maintenant' })).toBeVisible();
  await expect(choix.getByRole('button', { name: /Normal\s*10 min \+ 3 × 30 s/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(choix.getByText(/c’est le byo-yomi/)).toBeVisible();
  await expect(choix.locator('.btn.primary')).toHaveCount(1);
  if (CAPTURES) await ana.screenshot({ path: `${CAPTURES}/direct-choix.jpg`, type: 'jpeg', quality: 60 });

  const debut = Date.now();
  await choix.getByRole('button', { name: 'Trouver un adversaire' }).click();
  await expect(ana.getByText('Je cherche quelqu’un de ton niveau…')).toBeVisible();
  await expect(ana.getByRole('button', { name: 'Annuler' })).toBeVisible();
  if (CAPTURES) await ana.screenshot({ path: `${CAPTURES}/direct-attente.jpg`, type: 'jpeg', quality: 60 });

  await ouvrirDirect(bob);
  await bob.getByRole('button', { name: 'Trouver un adversaire' }).click();
  // Bob crée la partie ; Ana, qui attendait, la retrouve à son prochain appel. Ana a Noir.
  await expect(bob.getByTestId('direct-partie')).toBeVisible();
  await expect(ana.getByTestId('direct-partie')).toBeVisible();
  expect(Date.now() - debut).toBeLessThan(10_000);
  await expect(ana.getByText('Partie classée contre Bob. À toi de commencer !')).toBeVisible();
  // Pseudo, grade et cote de l'adversaire ; les deux pendules, à 10:00.
  await expect(ana.locator('.joueur').first()).toContainText('Bob');
  await expect(ana.locator('.joueur').first()).toContainText(/kyu · 1500/);
  await expect(bob.getByRole('timer')).toHaveCount(2);
  await expect(bob.locator('.direct-pendule.tourne')).toHaveCount(1);
  await expect(bob.getByRole('timer', { name: /Temps de Ana : (10:00|9:5\d)\./ })).toBeVisible();
  await expect(bob.getByRole('timer', { name: /^Ton temps : 10:00\.$/ })).toBeVisible();
  await cible44(ana.getByRole('timer').first(), 'pendule');
  await sansDebord(ana, 'partie 390 px');
  if (CAPTURES) await ana.screenshot({ path: `${CAPTURES}/direct-partie.jpg`, type: 'jpeg', quality: 60 });

  // Ana joue E5 ; Bob le voit arriver (temps réel, #425), passe ; Ana passe : comptage.
  await jouer(ana, 'E5');
  await attendrePierre(bob, 'E5', 'noir');
  await expect(bob.getByText('À toi de jouer.')).toBeVisible();
  await bob.getByRole('button', { name: 'Passer' }).click();
  await expect(ana.getByText('À toi de jouer.')).toBeVisible({ timeout: 8_000 });
  await ana.getByRole('button', { name: 'Passer' }).click();
  await expect(ana.getByRole('button', { name: 'Proposer ce compte' })).toBeVisible();
  await ana.getByRole('button', { name: 'Proposer ce compte' }).click();
  await expect(bob.getByText('Ana propose ce compte. Tu es d’accord ?')).toBeVisible({ timeout: 8_000 });
  await bob.getByRole('button', { name: 'Accepter le compte' }).click();

  // Bilan : le score, la cote qui bouge (« +162 », fixe avec les mouvements réduits), « Rejouer », « Revoir la partie ».
  await expect(bob.getByTestId('direct-fin').getByText('Ana a gagné de 73,5 points.')).toBeVisible();
  await expect(ana.getByTestId('direct-fin').getByText('Tu as gagné de 73,5 points !')).toBeVisible({ timeout: 8_000 });
  await expect(ana.getByTestId('cote-ecart')).toHaveText('+162');
  await expect(bob.getByTestId('cote-ecart')).toHaveText('−162');
  const fin = ana.getByTestId('direct-fin');
  await expect(fin.locator('.btn.primary')).toHaveText('Rejouer');
  await expect(fin.getByRole('button', { name: 'Revoir la partie' })).toBeVisible();
  await sansDebord(ana, 'bilan 390 px');
  if (CAPTURES) await ana.screenshot({ path: `${CAPTURES}/direct-bilan.jpg`, type: 'jpeg', quality: 60 });
  // La cote n'est comptée qu'une fois, par le serveur.
  expect(serveur.ratingHistory.filter(r => r.kind === 'game')).toHaveLength(2);

  // « Rejouer » : nouvelle recherche, même taille et même temps.
  await fin.getByRole('button', { name: 'Rejouer' }).click();
  await expect(ana.getByText('Je cherche quelqu’un de ton niveau…')).toBeVisible();
  await expect(ana.getByText(/9 × 9 · 10 min \+ 3 × 30 s/)).toBeVisible();
  await ana.getByRole('button', { name: 'Annuler' }).click();
  await expect(ana.getByTestId('direct-choix')).toBeVisible();
  expect(serveur.file).toHaveLength(0);
  expect(erreurs).toEqual([]);
});

test('attente annulée : retour au choix, la file est vide', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const ana = await telephone(browser, baseURL, serveur, { email: 'ana@exemple.test', pseudo: 'Ana', id: ANA });
  await ouvrirDirect(ana);
  await ana.getByRole('button', { name: '13 × 13' }).click();
  await ana.getByRole('button', { name: /Rapide/ }).click();
  await ana.getByRole('button', { name: 'Trouver un adversaire' }).click();
  await expect(ana.getByText(/13 × 13 · 5 min \+ 3 × 20 s/)).toBeVisible();
  await expect.poll(() => serveur.file.length).toBe(1);
  expect(serveur.file[0]).toMatchObject({ taille: 13, cadence: 'rapide', regles: 'japanese' });
  await ana.getByRole('button', { name: 'Annuler' }).click();
  await expect(ana.getByTestId('direct-choix')).toBeVisible();
  await expect(ana.getByRole('button', { name: '13 × 13' })).toHaveAttribute('aria-pressed', 'true');
  expect(serveur.file).toHaveLength(0);
});

test('perte au temps décidée par le serveur : la pendule tombée, la partie est perdue', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  serveur.profiles.push({ id: BOB, username: 'Bob', rating: 1500, streak_days: 0, streak_last: null, streak_freezes: 0 });
  const id = '33333333-3333-4333-8333-000000000099';
  serveur.games.push({ id, black_id: ANA, white_id: BOB, created_by: BOB, bot_id: null, size: 9, komi: 6.5, rules: 'japanese', handicap: 0, moves: 'eecc',
    status: 'active', counting: false, dead_stones: null, dead_proposed_by: null, result: null, resumed_at: 0, prive: false, rated: true, updated_at: new Date().toISOString() });
  // Ana (Noir, au trait) est en byo-yomi : sa dernière période finit dans 9 s (le temps d'ouvrir l'écran).
  serveur.pendules.push({ partie_id: id, cadence: 'normale', main_ms: 600000, periodes: 3, periode_ms: 30000, noir_ms: 0, blanc_ms: 400000,
    noir_periodes: 1, blanc_periodes: 3, trait_depuis: new Date(Date.now() - 21_000).toISOString(), comptage_depuis: null, noir_vu_le: null, blanc_vu_le: null });
  const ana = await telephone(browser, baseURL, serveur, { email: 'ana@exemple.test', pseudo: 'Ana', id: ANA });
  // La partie en cours est retrouvée en ouvrant le direct.
  await ouvrirDirect(ana);
  await expect(ana.getByTestId('direct-partie')).toBeVisible();
  await expect(ana.getByTestId('direct-partie').locator('.coach').getByText(/Byo-yomi\s:\sjoue en moins de \d\ss\./)).toBeVisible();
  await expect(ana.locator('.direct-pendule.byoyomi.urgent')).toBeVisible();
  // La pendule affichée tombe : le client demande au serveur, qui constate.
  await expect(ana.getByTestId('direct-fin').getByText('Perdu au temps.')).toBeVisible({ timeout: 15_000 });
  await expect(ana.getByTestId('cote-ecart')).toHaveText('−162');
  expect(serveur.games.find(g => g.id === id)?.result).toBe('W+T');
});

test('sans compte : « Crée ton compte » d’abord', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const page = await telephone(browser, baseURL, serveur, null);
  await ouvrirDirect(page);
  await expect(page.getByText('Pour jouer en ligne, il te faut un compte et un pseudo.')).toBeVisible();
  expect(serveur.appels.some(a => a.includes('find_match'))).toBe(false);
});

// #460 : au zoom 200 % et avec le texte agrandi à 200 %, polices web bloquées (la police de repli est plus large), le
// bandeau de l'adversaire au trait (pseudo, grade, pendule, prisonniers) faisait défiler l'écran de côté.
for (const cas of [{ largeur: 320, hauteur: 640, sombre: true }, { largeur: 195, hauteur: 422, sombre: false, polices: false },
  { largeur: 390, hauteur: 844, sombre: false, polices: false, texte200: true }]) {
  test(`choix, attente et partie à ${cas.largeur} px${cas.sombre ? ', sombre' : ''}${cas.texte200 ? ', texte à 200 %' : ''}${cas.polices === false ? ', polices bloquées' : ''} : sans débord, cibles de 44 px`, async ({ browser, baseURL }) => {
    test.setTimeout(60_000);
    const serveur = fauxServeur();
    const ana = await telephone(browser, baseURL, serveur, { email: 'ana@exemple.test', pseudo: 'Ana', id: ANA }, cas);
    const bob = await telephone(browser, baseURL, serveur, { email: 'bob@exemple.test', pseudo: 'Bob_le_long_pseudo', id: BOB });
    await ouvrirDirect(ana);
    await expect(ana.getByTestId('direct-choix')).toBeVisible();
    await sansDebord(ana, 'choix');
    for (const b of await ana.getByTestId('direct-choix').getByRole('button').all()) await cible44(b, (await b.textContent()) ?? 'bouton');
    const cta = ana.getByRole('button', { name: 'Trouver un adversaire' });
    await cta.scrollIntoViewIfNeeded();
    await cta.click();
    await expect(ana.getByTestId('direct-attente')).toBeVisible();
    await sansDebord(ana, 'attente');
    await ouvrirDirect(bob);
    await bob.getByRole('button', { name: 'Trouver un adversaire' }).click();
    await expect(ana.getByTestId('direct-partie')).toBeVisible();
    await expect(plateau(ana)).toBeVisible();
    await sansDebord(ana, 'partie');
    // Ana joue : c'est au tour de Bob, son bandeau (le plus chargé) passe au trait.
    await jouer(ana, 'E5');
    await expect(ana.getByText(/^Au tour de Bob_le_long_pseudo/).first()).toBeVisible();
    await sansDebord(ana, 'partie, au tour de l’adversaire');
    if (CAPTURES && cas.largeur === 320) await ana.screenshot({ path: `${CAPTURES}/direct-partie-320-sombre.jpg`, type: 'jpeg', quality: 60 });
  });
}
