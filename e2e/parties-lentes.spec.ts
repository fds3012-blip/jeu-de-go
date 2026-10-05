import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';
import { brancher, fauxServeur, type FauxServeur } from './fauxSupabase';
import { attendrePierre, choisirMode, jouer } from './plateau';

// Issue #440 : parties lentes classées. Deux téléphones (deux contextes) sur le même Supabase simulé
// (e2e/fauxSupabase.ts) : Ana cherche une partie lente et quitte l'écran (sa recherche reste sur l'accueil) ; Bob
// cherche la même chose, la partie commence ; Ana est prévenue sur l'accueil (« Adversaire trouvé », « À toi de jouer
// (1) »), les coups alternent en temps réel ; puis le délai d'un jour passe (horloge du serveur faux avancée) : le
// serveur décide la perte au temps, la cote bouge (« +162 »). Les règles du serveur (file lente, cote une seule fois,
// 10 parties au plus, comptage) sont testées par supabase/tests/parties_lentes.test.sql ; ici, le parcours et l'écran.

const ANA = '00000000-0000-4000-8000-0000000004a1';
const BOB = '00000000-0000-4000-8000-0000000004b2';
const CAPTURES = process.env.CAPTURES_440; // ex. /tmp/captures-440

async function telephone(browser: Browser, baseURL: string | undefined, serveur: FauxServeur, qui: { email: string; pseudo: string; id: string },
  o: { largeur?: number; sombre?: boolean } = {}): Promise<Page> {
  const ctx = await browser.newContext({
    viewport: { width: o.largeur ?? 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'fr-FR', baseURL,
    colorScheme: o.sombre ? 'dark' : 'light', reducedMotion: 'reduce',
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }] }] },
  });
  const stockage: Record<string, string> = { 'go.parties.v1': JSON.stringify({ n: 3 }) };
  stockage['sb-supabase-auth-token'] = JSON.stringify(serveur.sessionCompte(qui.email, qui.pseudo, qui.id));
  const page = await brancher(ctx, serveur, stockage);
  await page.goto('/');
  return page;
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

/** « Jouer en ligne » puis la bascule « Partie lente » (le choix est mémorisé). */
async function versLentes(page: Page) {
  await choisirMode(page, 'en_ligne');
  const bascule = page.getByTestId('bascule-en-ligne');
  await expect(bascule).toBeVisible();
  const lente = bascule.getByRole('button', { name: 'Partie lente' });
  if ((await lente.getAttribute('aria-pressed')) !== 'true') await lente.click();
  await expect(page.getByTestId('lentes')).toBeVisible();
}

test('parties lentes : recherche sur l’accueil, appariement, coups alternés, perte au temps décidée par le serveur, « +162 »', async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  const serveur = fauxServeur();
  const ana = await telephone(browser, baseURL, serveur, { email: 'ana.lente@exemple.test', pseudo: 'Ana', id: ANA });
  const bob = await telephone(browser, baseURL, serveur, { email: 'bob.lente@exemple.test', pseudo: 'Bob', id: BOB });
  const erreurs: string[] = [];
  for (const p of [ana, bob]) p.on('pageerror', e => erreurs.push(e.message));

  // 1. Ana : « Jouer en ligne » ouvre le direct (premier choix), la bascule mène à « Partie lente ».
  await versLentes(ana);
  const ecran = ana.getByTestId('lentes');
  await expect(ecran.getByRole('heading', { name: 'Partie lente' })).toBeVisible();
  await expect(ecran.getByRole('group', { name: 'Taille du plateau' }).getByRole('button', { name: '9 × 9' })).toHaveAttribute('aria-pressed', 'true');
  await expect(ecran.getByRole('group', { name: 'Temps par coup' }).getByRole('button', { name: '1 jour' })).toHaveAttribute('aria-pressed', 'true');
  await expect(ecran.getByText('Tu as 1 jour pour jouer chaque coup. Passé ce délai, tu perds au temps.')).toBeVisible();
  await expect(ecran.locator('.btn.primary')).toHaveCount(1);
  for (const b of await ecran.getByRole('button').all()) await cible44(b, `bouton « ${await b.textContent()} »`);
  await sansDebord(ana, 'parties lentes 390 px');
  if (CAPTURES) await ana.screenshot({ path: `${CAPTURES}/lentes-choix.jpg`, type: 'jpeg', quality: 60 });

  // 2. Personne : la recherche reste ouverte. Ana retourne à l'accueil : sa recherche y est, annulable.
  await ecran.getByRole('button', { name: 'Trouver un adversaire' }).click();
  await expect(ana.getByTestId('lente-recherche')).toContainText('Je te cherche un adversaire de ton niveau.');
  await expect(ana.getByTestId('lente-recherche')).toContainText('9 × 9 · 1 jour par coup');
  await expect(ecran.locator('.btn.primary')).toHaveCount(0);
  expect(serveur.fileLente).toHaveLength(1);
  if (CAPTURES) await ana.screenshot({ path: `${CAPTURES}/lentes-recherche.jpg`, type: 'jpeg', quality: 60 });
  await ecran.getByRole('button', { name: 'Retour' }).click();
  const tuileRecherche = ana.getByTestId('tuile-lente-recherche');
  await expect(tuileRecherche).toContainText('Je cherche ton adversaire…');
  await cible44(tuileRecherche.getByRole('button', { name: 'Annuler la recherche de partie lente' }), 'Annuler');

  // 3. Bob : son premier choix ; la bascule mène à « Partie lente », même réglage : la partie commence tout de suite.
  await versLentes(bob);
  await bob.getByRole('button', { name: 'Trouver un adversaire' }).click();
  await expect(bob.locator('.defi-partie')).toBeVisible();
  await expect(bob.getByText('Chacun a 1 jour pour jouer son coup. Sinon, il perd au temps.')).toBeVisible();
  await expect(bob.locator('.joueur').first()).toContainText('Ana');
  await expect(bob.getByText(/^Au tour de Ana\. Il lui reste/)).toBeVisible();

  // 4. Ana (Noir) est prévenue sur l'accueil, sans recharger : « À toi de jouer (1) », point d'or sur « Jouer en
  //    ligne ». Une seule tuile pour cette partie (pas de « Adversaire trouvé » en double) ; sa recherche est finie.
  await expect(ana.getByTestId('tuile-lente')).toContainText('À toi de jouer (1)', { timeout: 10_000 });
  await expect(ana.getByTestId('tuile-lente-trouvee')).toHaveCount(0);
  await expect(ana.getByTestId('tuile-lente-recherche')).toHaveCount(0);
  await expect(ana.locator('.cta.a-jouer[data-mode="en_ligne"]')).toHaveCount(1);
  await sansDebord(ana, 'accueil 390 px');
  if (CAPTURES) await ana.screenshot({ path: `${CAPTURES}/lentes-accueil.jpg`, type: 'jpeg', quality: 60 });
  await ana.getByTestId('tuile-lente').click();
  await expect(ana.locator('.defi-partie')).toBeVisible();
  await expect(ana.getByText('Partie classée contre Bob. À toi de commencer !')).toBeVisible();
  // Ouvrir la partie efface « adversaire trouvé » de sa ligne de file.
  await expect.poll(() => serveur.fileLente.length).toBe(0);

  // 5. Coups alternés, en temps réel.
  await jouer(ana, 'E5');
  await attendrePierre(bob, 'E5', 'noir');
  await expect(bob.getByText(/^À toi de jouer\. Il te reste/)).toBeVisible();
  await jouer(bob, 'C3');
  await attendrePierre(ana, 'C3', 'blanc');
  await jouer(ana, 'G7');
  await attendrePierre(bob, 'G7', 'noir');
  if (CAPTURES) await bob.screenshot({ path: `${CAPTURES}/lentes-partie.jpg`, type: 'jpeg', quality: 60 });

  // 6. Bob laisse passer son jour. Le serveur constate la perte au temps (tâche planifiée), la cote bouge une fois.
  serveur.avancerHorloge(25 * 3_600_000);
  expect(serveur.tacheLentes()).toBe(1);
  await expect(ana.getByText('Tu as gagné au temps : Bob n’a pas joué à temps.').first()).toBeVisible({ timeout: 10_000 });
  await expect(ana.getByTestId('cote-ecart')).toHaveText('+162');
  await expect(bob.getByText('Perdu au temps : ton délai est passé sans ton coup.').first()).toBeVisible({ timeout: 10_000 });
  await expect(bob.getByTestId('cote-ecart')).toHaveText('−162');
  expect(serveur.ratingHistory.filter(r => r.kind === 'game')).toHaveLength(2);
  const fin = ana.locator('.defi-fin');
  await expect(fin.locator('.btn.primary')).toHaveText('Nouvelle partie lente');
  await expect(fin.getByRole('button', { name: 'Revoir ma partie' })).toBeVisible();
  await sansDebord(ana, 'bilan 390 px');
  if (CAPTURES) await ana.screenshot({ path: `${CAPTURES}/lentes-bilan.jpg`, type: 'jpeg', quality: 60 });

  // 7. « Nouvelle partie lente » : l'écran des parties lentes, avec la partie finie dans la liste. Le choix est
  //    mémorisé : « Jouer en ligne » y ramène directement.
  await fin.getByRole('button', { name: 'Nouvelle partie lente' }).click();
  await expect(ana.getByTestId('lentes')).toBeVisible();
  await expect(ana.getByRole('button', { name: /Partie contre Bob, Terminée/ })).toBeVisible();
  await ana.getByTestId('lentes').getByRole('button', { name: 'Retour' }).click();
  await choisirMode(ana, 'en_ligne');
  await expect(ana.getByTestId('lentes')).toBeVisible();
  await ana.getByTestId('bascule-en-ligne').getByRole('button', { name: 'En direct' }).click();
  await expect(ana.getByTestId('direct-choix')).toBeVisible();
  expect(erreurs).toEqual([]);
});

test('parties lentes : Blanc absent est prévenu « Adversaire trouvé » ; la recherche s’annule depuis l’accueil ; 320 px et sombre', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const ana = await telephone(browser, baseURL, serveur, { email: 'ana.320@exemple.test', pseudo: 'Ana', id: ANA }, { largeur: 320, sombre: true });
  await versLentes(ana);
  await ana.getByRole('group', { name: 'Taille du plateau' }).getByRole('button', { name: '13 × 13' }).click();
  await ana.getByRole('group', { name: 'Temps par coup' }).getByRole('button', { name: '3 jours' }).click();
  await expect(ana.getByText('Tu as 3 jours pour jouer chaque coup. Passé ce délai, tu perds au temps.')).toBeVisible();
  await sansDebord(ana, 'parties lentes 320 px');
  await ana.getByRole('button', { name: 'Trouver un adversaire' }).click();
  await expect(ana.getByTestId('lente-recherche')).toContainText('13 × 13 · 3 jours par coup');
  expect(serveur.fileLente[0]).toMatchObject({ size: 13, delai_jours: 3, partie_id: null });
  await sansDebord(ana, 'recherche 320 px');
  if (CAPTURES) await ana.screenshot({ path: `${CAPTURES}/lentes-recherche-320-sombre.jpg`, type: 'jpeg', quality: 60 });
  await ana.getByTestId('lentes').getByRole('button', { name: 'Retour' }).click();
  await sansDebord(ana, 'accueil 320 px');
  await ana.getByRole('button', { name: 'Annuler la recherche de partie lente' }).click();
  await expect(ana.getByTestId('tuile-lente-recherche')).toHaveCount(0);
  expect(serveur.fileLente).toHaveLength(0);

  // Adversaire trouvé pendant l'absence, Ana en Blanc (ce n'est pas à elle) : la tuile « Adversaire trouvé ! » ouvre la partie.
  await versLentes(ana);
  await ana.getByRole('button', { name: 'Trouver un adversaire' }).click();
  await expect(ana.getByTestId('lente-recherche')).toBeVisible();
  await ana.getByTestId('lentes').getByRole('button', { name: 'Retour' }).click();
  await expect(ana.getByTestId('tuile-lente-recherche')).toBeVisible();
  // Le faux serveur fait attendre Ana en Noir : on échange les couleurs, comme un tirage au sort défavorable.
  const bob = await telephone(browser, baseURL, serveur, { email: 'bob.320@exemple.test', pseudo: 'Bob', id: BOB });
  await versLentes(bob);
  await bob.getByRole('button', { name: 'Trouver un adversaire' }).click();
  await expect(bob.locator('.defi-partie')).toBeVisible();
  const g = serveur.games.find(x => x.rated && x.black_id === ANA)!;
  Object.assign(g, { black_id: BOB, white_id: ANA });
  serveur.notifier(ANA, 'tour', String(g.id)); // relecture de l'accueil d'Ana (temps réel)
  await expect(ana.getByTestId('tuile-lente-trouvee')).toContainText('Adversaire trouvé !', { timeout: 10_000 });
  await expect(ana.getByTestId('tuile-lente')).toHaveCount(0);
  await sansDebord(ana, 'accueil adversaire trouvé 320 px');
  await ana.getByTestId('tuile-lente-trouvee').click();
  await expect(ana.locator('.defi-partie')).toBeVisible();
  await expect(ana.getByText(/^Au tour de Bob\. Il lui reste/).first()).toBeVisible();
  expect(serveur.fileLente).toHaveLength(0);
});

test('parties lentes : zoom 200 % (195 px) sans débord', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const ana = await telephone(browser, baseURL, serveur, { email: 'ana.195@exemple.test', pseudo: 'Ana', id: ANA }, { largeur: 195 });
  await versLentes(ana);
  await sansDebord(ana, 'parties lentes 195 px');
  await ana.getByRole('button', { name: 'Trouver un adversaire' }).click();
  await expect(ana.getByTestId('lente-recherche')).toBeVisible();
  await sansDebord(ana, 'recherche 195 px');
  await ana.getByTestId('lentes').getByRole('button', { name: 'Retour' }).click();
  await expect(ana.getByTestId('tuile-lente-recherche')).toBeVisible();
  await sansDebord(ana, 'accueil 195 px');
});
