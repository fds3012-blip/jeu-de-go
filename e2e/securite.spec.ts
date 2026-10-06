import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';
import { brancher, fauxServeur, type FauxServeur } from './fauxSupabase';
import { choisirMode, jouer, ouvrirPlus } from './plateau';

// Issues #363 et #373 : sécurité entre joueurs. Deux téléphones (deux contextes) sur le même Supabase simulé
// (e2e/fauxSupabase.ts, mêmes règles et mêmes codes que supabase/migrations/20261005220100_securite_signalements.sql) :
// « Bien joué » arrive chez l'adversaire en moins de 5 s et s'efface après 3 s ; coupé, plus rien ne s'affiche ;
// « Signaler » et « Bloquer » depuis la partie, « Mes amis », un problème ; « Nous écrire » depuis le Profil.
// Captures (10 au plus, légères) : CAPTURES_363=/tmp/captures-363 npx playwright test e2e/securite.spec.ts

const CAPTURES = process.env.CAPTURES_363;
const ANA = '00000000-0000-4000-8000-0000000003a1';
const BOB = '00000000-0000-4000-8000-0000000003b2';

async function telephone(browser: Browser, baseURL: string | undefined, serveur: FauxServeur, qui: { email: string; pseudo: string; id: string },
  o: { largeur?: number; hauteur?: number; sombre?: boolean } = {}): Promise<Page> {
  const ctx = await browser.newContext({
    viewport: { width: o.largeur ?? 390, height: o.hauteur ?? 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'fr-FR', baseURL,
    colorScheme: o.sombre ? 'dark' : 'light', reducedMotion: 'reduce',
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }] }] },
  });
  const page = await brancher(ctx, serveur, {
    'go.parties.v1': JSON.stringify({ n: 3 }),
    'sb-supabase-auth-token': JSON.stringify(serveur.sessionCompte(qui.email, qui.pseudo, qui.id)),
  });
  await page.goto('/');
  return page;
}

async function capture(page: Page, nom: string) {
  if (CAPTURES) await page.screenshot({ path: `${CAPTURES}/${nom}.jpg`, type: 'jpeg', quality: 55 });
}

async function sansDebord(page: Page, ecran: string) {
  const m = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(m.scroll, `${ecran} : défilement horizontal`).toBeLessThanOrEqual(m.client);
}

/** Chaque bouton, case et choix visible de la feuille fait au moins 44 px de haut et tient dans la largeur (le libellé du
 *  champ de texte n'est pas une cible : le champ, lui, fait plus de 44 px). */
async function cibles44(feuille: Locator, ecran: string) {
  const tailles = await feuille.locator('button:visible, label:visible:not(.signaler-label)').evaluateAll(els => els.map(e => {
    const b = e.getBoundingClientRect();
    return { nom: (e.textContent ?? e.getAttribute('aria-label') ?? '').trim().slice(0, 30), h: b.height, droite: b.right, largeur: document.documentElement.clientWidth };
  }));
  expect(tailles.length).toBeGreaterThan(0);
  for (const t of tailles) {
    expect(t.h, `${ecran} : « ${t.nom} » fait 44 px de haut`).toBeGreaterThanOrEqual(43.5);
    expect(t.droite, `${ecran} : « ${t.nom} » tient dans la largeur`).toBeLessThanOrEqual(t.largeur + 0.5);
  }
}

/** Deux comptes se trouvent en partie en direct ; renvoie la partie. */
async function partieEnDirect(serveur: FauxServeur, ana: Page, bob: Page): Promise<string> {
  await choisirMode(ana, 'en_ligne');
  await ana.getByRole('button', { name: 'Trouver un adversaire' }).click();
  await expect(ana.getByText('Je cherche quelqu’un de ton niveau…')).toBeVisible();
  await choisirMode(bob, 'en_ligne');
  await bob.getByRole('button', { name: 'Trouver un adversaire' }).click();
  await expect(bob.getByTestId('direct-partie')).toBeVisible();
  await expect(ana.getByTestId('direct-partie')).toBeVisible();
  return String(serveur.games.at(-1)!.id);
}

test('« Bien joué » arrive chez l’adversaire en moins de 5 s et s’efface après 3 s ; coupé, plus rien', async ({ browser, baseURL }) => {
  test.setTimeout(90_000);
  const serveur = fauxServeur();
  const ana = await telephone(browser, baseURL, serveur, { email: 'ana@exemple.test', pseudo: 'Ana', id: ANA });
  const bob = await telephone(browser, baseURL, serveur, { email: 'bob@exemple.test', pseudo: 'Bob', id: BOB });
  const erreurs: string[] = [];
  for (const p of [ana, bob]) p.on('pageerror', e => erreurs.push(e.message));
  const partie = await partieEnDirect(serveur, ana, bob);

  // « Dire » dans la barre d'actions : 6 messages, 4 émotes, pas de texte libre.
  await ana.getByRole('toolbar').getByRole('button', { name: 'Dire' }).click();
  const feuille = ana.getByTestId('feuille-dire');
  await expect(feuille.getByRole('heading', { name: 'Dire quelque chose' })).toBeVisible();
  await expect(feuille.locator('.dire-message')).toHaveCount(6);
  await expect(feuille.locator('.dire-emote')).toHaveCount(4);
  await expect(feuille.locator('textarea, input[type="text"]')).toHaveCount(0);
  await cibles44(feuille, 'feuille Dire 390 px');
  await capture(ana, '01-feuille-dire');

  const envoi = Date.now();
  await feuille.getByRole('button', { name: 'Bien joué !' }).click();
  await expect(feuille).toBeHidden();
  // Chez Ana, sa propre bulle ; chez Bob, près du nom d'Ana, en moins de 5 s.
  await expect(ana.getByTestId('bulle-moi')).toBeVisible();
  const bulle = bob.getByTestId('bulle-lui');
  await expect(bulle).toBeVisible({ timeout: 5_000 });
  const arrivee = Date.now();
  expect(arrivee - envoi).toBeLessThan(5_000);
  await expect(bulle).toHaveAccessibleName('Ana dit : Bien joué !');
  await expect(bob.locator('.joueur').first()).toContainText('Ana');
  await expect(bob.locator('.joueur').first().getByTestId('bulle-lui')).toBeVisible();
  await capture(bob, '02-bulle-adversaire');
  // Elle s'efface d'elle-même au bout de 3 s.
  await expect(bulle).toBeHidden({ timeout: 4_500 });
  expect(Date.now() - arrivee).toBeGreaterThan(2_000);
  expect(serveur.messagesPartie).toHaveLength(1);
  expect(serveur.messagesPartie[0]).toMatchObject({ partie_id: partie, auteur_id: ANA, code: 'bien_joue' });

  // Bob coupe les messages de l'adversaire (menu « Plus ») : la bulle suivante n'apparaît pas.
  const plus = await ouvrirPlus(bob);
  const reglage = plus.getByRole('switch', { name: 'Messages de l’adversaire' });
  await expect(reglage).toHaveAttribute('aria-checked', 'true');
  await reglage.click();
  await expect(reglage).toHaveAttribute('aria-checked', 'false');
  await bob.keyboard.press('Escape');
  await ana.waitForTimeout(3_100);
  await ana.getByRole('toolbar').getByRole('button', { name: 'Dire' }).click();
  await ana.getByTestId('feuille-dire').getByRole('button', { name: 'Mochi est content' }).click();
  await expect.poll(() => serveur.messagesPartie.length).toBe(2);
  await bob.waitForTimeout(1_500);
  await expect(bob.getByTestId('bulle-lui')).toHaveCount(0);
  // Le réglage est gardé sur l'appareil.
  expect(await bob.evaluate(() => localStorage.getItem('go.echanges.v1'))).toBe('{"coupes":true}');
  await sansDebord(bob, 'partie 390 px');
  expect(erreurs).toEqual([]);
});

test('signaler l’adversaire depuis la partie et le bloquer : le serveur a la partie, plus d’appariement', async ({ browser, baseURL }) => {
  test.setTimeout(90_000);
  const serveur = fauxServeur();
  const ana = await telephone(browser, baseURL, serveur, { email: 'ana@exemple.test', pseudo: 'Ana', id: ANA });
  const bob = await telephone(browser, baseURL, serveur, { email: 'bob@exemple.test', pseudo: 'Bob', id: BOB }, { sombre: true });
  const partie = await partieEnDirect(serveur, ana, bob);

  const plus = await ouvrirPlus(bob);
  await plus.getByRole('button', { name: 'Signaler Ana' }).click();
  const feuille = bob.getByTestId('feuille-signaler');
  await expect(feuille.getByRole('heading', { name: 'Signaler Ana' })).toBeVisible();
  await expect(feuille.getByText('Ana ne saura pas que c’est toi.')).toBeVisible();
  // Une seule action principale ; sans motif, la feuille le demande.
  await expect(feuille.locator('.btn.primary')).toHaveCount(1);
  await feuille.getByRole('button', { name: 'Envoyer' }).click();
  await expect(feuille.getByRole('alert')).toHaveText('Choisis ce qui ne va pas.');
  await feuille.getByRole('radio', { name: 'Il fait exprès de gâcher la partie' }).check();
  await feuille.getByLabel('Un détail ? (facultatif)').fill('Il joue au hasard.');
  await feuille.getByRole('checkbox', { name: /Bloquer aussi Ana/ }).check();
  await cibles44(feuille, 'feuille Signaler 390 px, sombre');
  await capture(bob, '03-signaler-sombre');
  await feuille.getByRole('button', { name: 'Envoyer' }).click();
  await expect(feuille.getByText('Merci, on regarde.')).toBeVisible();
  await expect(feuille.getByText('Ana est bloqué. Tu ne le croiseras plus en partie.')).toBeVisible();
  await capture(bob, '04-merci');

  // Le serveur a le signalement (la partie, la cible lue par le serveur) et le blocage ; jamais d'e-mail dans le contexte.
  expect(serveur.signalements).toHaveLength(1);
  expect(serveur.signalements[0]).toMatchObject({ auteur_id: BOB, type: 'joueur', motif: 'antijeu', partie_id: partie, cible_joueur_id: ANA, texte: 'Il joue au hasard.' });
  expect(JSON.stringify(serveur.signalements[0].contexte)).not.toMatch(/@/);
  expect(serveur.blocages).toEqual([expect.objectContaining({ de: BOB, a: ANA })]);
  await feuille.getByRole('button', { name: 'Fermer' }).last().click();
  await expect(feuille).toBeHidden();

  // Ana ne voit rien du signalement. Les deux abandonnent ; ils ne seront plus jamais appariés.
  await expect(ana.getByText(/signal/i)).toHaveCount(0);
  serveur.games.at(-1)!.status = 'finished';
  serveur.file.push({ user: ANA, taille: 9, cadence: 'normale', regles: 'japanese', depuis: Date.now() - 60_000 });
  await bob.goto('/');
  await choisirMode(bob, 'en_ligne');
  await bob.getByRole('button', { name: 'Trouver un adversaire' }).click();
  await expect(bob.getByText('Je cherche quelqu’un de ton niveau…')).toBeVisible();
  await bob.waitForTimeout(3_000);
  await expect(bob.getByTestId('direct-partie')).toHaveCount(0);
  expect(serveur.file.map(f => f.user).sort()).toEqual([ANA, BOB].sort());
});

test('« Nous écrire » depuis le Profil, en 320 px, en sombre et zoomé à 200 %', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const ana = await telephone(browser, baseURL, serveur, { email: 'ana@exemple.test', pseudo: 'Ana', id: ANA }, { largeur: 320, hauteur: 640, sombre: true });
  await ana.getByRole('button', { name: 'Profil', exact: true }).click();
  const ligne = ana.getByTestId('ligne-ecrire');
  await expect(ligne).toContainText('Nous écrire');
  await ligne.click();
  const feuille = ana.getByTestId('feuille-signaler');
  await expect(feuille.getByRole('heading', { name: 'Nous écrire' })).toBeVisible();
  await feuille.getByRole('button', { name: 'Une idée' }).click();
  await expect(feuille.getByRole('button', { name: 'Une idée' })).toHaveAttribute('aria-pressed', 'true');
  // Message obligatoire.
  await feuille.getByRole('button', { name: 'Envoyer' }).click();
  await expect(feuille.getByRole('alert')).toHaveText('Écris ton message.');
  await feuille.getByLabel('Ton message').fill('Un mode zen sans pendule, ce serait chouette.');
  await expect(feuille.getByText('45 / 500')).toBeVisible();
  await cibles44(feuille, 'Nous écrire 320 px');
  await sansDebord(ana, 'Nous écrire 320 px');
  await capture(ana, '05-nous-ecrire-320');
  await feuille.getByRole('button', { name: 'Envoyer' }).click();
  await expect(feuille.getByText('Merci, on regarde.')).toBeVisible();
  expect(serveur.signalements).toEqual([expect.objectContaining({ auteur_id: ANA, type: 'idee', texte: 'Un mode zen sans pendule, ce serait chouette.', motif: null })]);
  expect(serveur.signalements[0].contexte).toMatchObject({ ecran: 'profil', largeur: 320 });

  // Zoom 200 % (195 px de large) : la feuille tient sans défilement horizontal.
  await ana.setViewportSize({ width: 195, height: 422 });
  await feuille.getByRole('button', { name: 'Fermer' }).last().click();
  await ligne.click();
  await expect(feuille.getByRole('button', { name: 'Envoyer' })).toBeVisible();
  await sansDebord(ana, 'Nous écrire, zoom 200 %');
});

test('« Cette réponse me semble fausse » : le signalement arrive avec l’identifiant du problème', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const ana = await telephone(browser, baseURL, serveur, { email: 'ana@exemple.test', pseudo: 'Ana', id: ANA });
  await ana.getByRole('navigation').getByRole('button', { name: 'Problèmes' }).click();
  await ana.getByRole('button', { name: 'Tous les problèmes' }).click();
  await ana.getByRole('button', { name: /^Problème \d+ : Capture la pierre/ }).click();
  const lecteur = ana.locator('.lecteur');
  const id = await lecteur.getAttribute('data-probleme');
  expect(id).toBeTruthy();
  // Le lien n'apparaît qu'après un premier essai.
  await expect(ana.getByRole('button', { name: 'Cette réponse me semble fausse' })).toHaveCount(0);
  await jouer(ana, 'A1');
  await expect(ana.getByText('Pas tout à fait. Essaie encore.')).toBeVisible();
  await ana.getByRole('button', { name: 'Cette réponse me semble fausse' }).click();
  const feuille = ana.getByTestId('feuille-signaler');
  await feuille.getByRole('radio', { name: 'La réponse me semble fausse' }).check();
  await capture(ana, '06-probleme');
  await feuille.getByRole('button', { name: 'Envoyer' }).click();
  await expect(feuille.getByText('Merci, on regarde.')).toBeVisible();
  expect(serveur.signalements).toEqual([expect.objectContaining({ type: 'probleme', probleme_id: id, motif: 'reponse_fausse', auteur_id: ANA })]);
});

test('« Mes amis » : bloquer un ami le retire de la liste ; « Débloquer » le rend possible de nouveau', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  serveur.compteExistant('bob@exemple.test', 'Bob', BOB);
  serveur.amities.push({ de: ANA, a: BOB, etat: 'accepted', le: new Date().toISOString() });
  const ana = await telephone(browser, baseURL, serveur, { email: 'ana@exemple.test', pseudo: 'Ana', id: ANA }, { largeur: 320, hauteur: 640 });
  await ana.getByRole('button', { name: 'Profil', exact: true }).click();
  await ana.getByRole('button', { name: /^Mes amis/ }).click();
  await expect(ana.getByText('Bob')).toBeVisible();
  await sansDebord(ana, 'Mes amis 320 px');
  const drapeau = ana.getByRole('button', { name: 'Signaler Bob' });
  expect((await drapeau.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
  await drapeau.click();
  const feuille = ana.getByTestId('feuille-signaler');
  await feuille.getByRole('button', { name: 'Bloquer Bob' }).click();
  await expect(feuille.getByText('Bob est bloqué. Tu ne le croiseras plus en partie.')).toBeVisible();
  expect(serveur.signalements).toHaveLength(0);
  expect(serveur.blocages).toEqual([expect.objectContaining({ de: ANA, a: BOB })]);
  await feuille.getByRole('button', { name: 'Fermer' }).last().click();
  // Plus ami ; dans « Joueurs bloqués », avec « Débloquer ».
  const bloques = ana.getByRole('region', { name: 'Joueurs bloqués' });
  await expect(bloques).toContainText('Bob');
  await expect(ana.getByRole('region', { name: 'Tes amis' })).toHaveCount(0);
  await capture(ana, '07-amis-bloques-320');
  await bloques.getByRole('button', { name: 'Débloquer Bob' }).click();
  await expect(bloques).toHaveCount(0);
  expect(serveur.blocages).toHaveLength(0);
});
