import { expect, test, type Browser, type Page } from '@playwright/test';
import { brancher, fauxServeur, type FauxServeur } from './fauxSupabase';
import { choisirMode, plateau } from './plateau';

// Issue #436 : plus jamais de file vide. Au bout de 25 s d'attente, Mochi propose honnêtement une partie contre l'IA
// la plus proche de la cote du joueur, en restant dans la file. Un humain arrive pendant cette partie : « Un joueur est
// prêt ! », « Rejoindre » ou « Rester ». Supabase simulé (e2e/fauxSupabase.ts) ; les règles du serveur (30 s,
// réglages de qui attendait le plus, refus sans cote) sont testées par supabase/tests/file_jamais_vide.test.sql.
// Ces parcours attendent vraiment 25 s : pas d'horloge simulée, la file et la présence restent celles de l'app.

const ANA = '00000000-0000-4000-8000-0000000000c1';
const BOB = '00000000-0000-4000-8000-0000000000c2';
const CAPTURES = process.env.CAPTURES_436; // ex. /tmp/captures-436

async function telephone(browser: Browser, baseURL: string | undefined, serveur: FauxServeur, qui: { email: string; pseudo: string; id: string }): Promise<Page> {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'fr-FR', baseURL, reducedMotion: 'reduce',
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }] }] },
  });
  const stockage: Record<string, string> = { 'go.parties.v1': JSON.stringify({ n: 3 }) };
  stockage['sb-supabase-auth-token'] = JSON.stringify(serveur.sessionCompte(qui.email, qui.pseudo, qui.id));
  const page = await brancher(ctx, serveur, stockage);
  await page.goto('/');
  return page;
}

async function sansDebord(page: Page, ecran: string) {
  const m = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(m.scroll, `${ecran} : défilement horizontal`).toBeLessThanOrEqual(m.client);
}

/** Ana cherche dans la file par défaut, personne ne vient : au bout de 25 s, Mochi propose l'IA ; elle accepte. */
async function repliAccepte(ana: Page, serveur: FauxServeur): Promise<string> {
  await choisirMode(ana, 'en_ligne');
  const choix = ana.getByTestId('direct-choix');
  // File par défaut : 9 × 9, normal, japonais (#436), même si l'accueil était réglé autrement.
  await expect(choix.getByRole('button', { name: '9 × 9' })).toHaveAttribute('aria-pressed', 'true');
  await expect(choix.getByRole('button', { name: /Normal/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(choix.getByRole('button', { name: 'Japonais' })).toHaveAttribute('aria-pressed', 'true');
  await choix.getByRole('button', { name: 'Trouver un adversaire' }).click();
  await expect(ana.getByText('Je cherche quelqu’un de ton niveau…')).toBeVisible();
  // Rien avant 25 s.
  await ana.waitForTimeout(20_000);
  await expect(ana.getByTestId('direct-repli')).toHaveCount(0);
  const repli = ana.getByTestId('direct-repli');
  await expect(repli).toBeVisible({ timeout: 10_000 });
  await expect(repli.getByRole('status')).toHaveText(/^Personne de ton niveau pour l’instant\. Joue contre \S+ en attendant\s?: je te préviens si quelqu’un arrive\.$/);
  const nom = /Joue contre (\S+) en attendant/.exec((await repli.getByRole('status').textContent()) ?? '')![1];
  // Honnête : l'IA est nommée comme une IA, la partie n'est pas classée. Une seule action principale.
  await expect(repli.getByText(`${nom} est une IA. Cette partie n’est pas classée.`)).toBeVisible();
  await expect(ana.getByTestId('direct-attente').locator('.btn.primary')).toHaveCount(1);
  await expect(ana.getByRole('button', { name: 'Continuer d’attendre' })).toBeVisible();
  await sansDebord(ana, 'attente avec repli');
  if (CAPTURES) await ana.screenshot({ path: `${CAPTURES}/repli-propose.jpg`, type: 'jpeg', quality: 55 });
  await repli.getByRole('button', { name: `Jouer contre ${nom}` }).click();
  // La partie contre l'IA s'ouvre, et la file est gardée.
  await expect(plateau(ana)).toBeVisible();
  await expect(ana.getByTestId('veille-file')).toContainText('Je cherche toujours un joueur pour toi.');
  expect(serveur.file.map(f => f.user)).toEqual([ANA]);
  return nom;
}

test('file vide : au bout de 25 s, Mochi propose l’IA proche de ta cote ; la file est gardée pendant la partie', async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  const serveur = fauxServeur();
  const ana = await telephone(browser, baseURL, serveur, { email: 'ana@exemple.test', pseudo: 'Ana', id: ANA });
  const erreurs: string[] = [];
  ana.on('pageerror', e => erreurs.push(e.message));
  const nom = await repliAccepte(ana, serveur);
  // Jamais d'IA déguisée : son nom est celui de l'échelle, dans le bandeau de l'adversaire. Aucun compteur de joueurs.
  await expect(ana.locator('.joueur').first()).toContainText(nom);
  await expect(ana.getByText(/joueurs? en ligne/i)).toHaveCount(0);
  await sansDebord(ana, 'partie IA avec la bande');
  if (CAPTURES) await ana.screenshot({ path: `${CAPTURES}/repli-partie.jpg`, type: 'jpeg', quality: 55 });
  // Présence entretenue : find_match rappelée pendant la partie contre l'IA.
  const avant = serveur.appels.filter(a => a.includes('find_match')).length;
  await expect.poll(() => serveur.appels.filter(a => a.includes('find_match')).length, { timeout: 8_000 }).toBeGreaterThan(avant + 1);
  // « Ne plus chercher » : la bande part, la partie contre l'IA continue, la place est rendue.
  await ana.getByRole('button', { name: 'Ne plus chercher' }).click();
  await expect(ana.getByTestId('veille-file')).toHaveCount(0);
  await expect(plateau(ana)).toBeVisible();
  await expect.poll(() => serveur.file.length).toBe(0);
  expect(erreurs).toEqual([]);
});

test('un humain arrive pendant la partie contre l’IA : « Un joueur est prêt ! », Rejoindre ouvre la partie classée', async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  const serveur = fauxServeur();
  const ana = await telephone(browser, baseURL, serveur, { email: 'ana@exemple.test', pseudo: 'Ana', id: ANA });
  const bob = await telephone(browser, baseURL, serveur, { email: 'bob@exemple.test', pseudo: 'Bob', id: BOB });
  await repliAccepte(ana, serveur);
  // Bob arrive avec les réglages par défaut : il trouve Ana, qui attendait toujours.
  await choisirMode(bob, 'en_ligne');
  await bob.getByRole('button', { name: 'Trouver un adversaire' }).click();
  await expect(bob.getByTestId('direct-partie')).toBeVisible();
  const bande = ana.getByTestId('veille-file');
  await expect(bande.getByRole('alert')).toContainText('Un joueur est prêt !', { timeout: 8_000 });
  await expect(bande.getByRole('button', { name: 'Rejoindre' })).toBeVisible();
  await expect(bande.getByRole('button', { name: 'Rester' })).toBeVisible();
  // Non bloquant : la partie contre l'IA reste là, dessous.
  await expect(plateau(ana)).toBeVisible();
  for (const b of await bande.getByRole('button').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
  await sansDebord(ana, 'joueur prêt');
  if (CAPTURES) await ana.screenshot({ path: `${CAPTURES}/repli-joueur-pret.jpg`, type: 'jpeg', quality: 55 });
  await bande.getByRole('button', { name: 'Rejoindre' }).click();
  await expect(ana.getByTestId('direct-partie')).toBeVisible();
  await expect(ana.getByText('Partie classée contre Bob. À toi de commencer !')).toBeVisible();
  await expect(ana.getByTestId('veille-file')).toHaveCount(0);
  expect(serveur.games.find(g => g.black_id === ANA)?.status).toBe('active');
});

test('refuser : « Rester » annule la partie en direct sans cote, la partie contre l’IA continue', async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  const serveur = fauxServeur();
  const ana = await telephone(browser, baseURL, serveur, { email: 'ana@exemple.test', pseudo: 'Ana', id: ANA });
  const bob = await telephone(browser, baseURL, serveur, { email: 'bob@exemple.test', pseudo: 'Bob', id: BOB });
  await repliAccepte(ana, serveur);
  await choisirMode(bob, 'en_ligne');
  await bob.getByRole('button', { name: 'Trouver un adversaire' }).click();
  await expect(bob.getByTestId('direct-partie')).toBeVisible();
  const bande = ana.getByTestId('veille-file');
  await expect(bande.getByRole('button', { name: 'Rester' })).toBeVisible({ timeout: 8_000 });
  await bande.getByRole('button', { name: 'Rester' }).click();
  await expect(ana.getByTestId('veille-file')).toHaveCount(0);
  await expect(plateau(ana)).toBeVisible();
  await expect(ana.getByTestId('direct-partie')).toHaveCount(0);
  // Bob voit la partie annulée, sans effet sur sa cote ; Ana n'est plus dans la file.
  await expect(bob.getByTestId('direct-fin').getByText('Partie annulée : personne n’a vraiment joué. Ta cote ne bouge pas.')).toBeVisible({ timeout: 10_000 });
  const partie = serveur.games.find(g => g.black_id === ANA)!;
  expect(partie.status).toBe('aborted');
  expect(serveur.ratingHistory.filter(r => r.kind === 'game')).toHaveLength(0);
  expect(serveur.file).toHaveLength(0);
});
