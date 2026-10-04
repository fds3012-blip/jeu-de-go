import { expect, test, type Browser, type Page } from '@playwright/test';
import { brancher, fauxServeur, JETON, PARTIE, type FauxServeur } from './fauxSupabase';
import { plateau } from './plateau';

// Issue #417 : cote de jeu visible (Glicko-2, calculée par le serveur). Profil : « Ta cote » partage la ligne du
// placement ; la sous-vue montre la cote (« 800 ? » tant qu'elle est provisoire), le grade, kyu et dan expliqués une
// fois, la courbe de 30 jours et le choix du départ avant la première partie classée. Fin de partie classée : « +14 »
// (défilé, fixe avec les mouvements réduits) et la fête au changement de grade. Supabase simulé (e2e/fauxSupabase.ts).

const MOI = '00000000-0000-4000-8000-0000000000a1';
const LEA = '00000000-0000-4000-8000-0000000000b2';
const CAPTURES = process.env.CAPTURES_417; // ex. un dossier temporaire : captures légères (jpeg)
const H = 3_600_000;

async function telephone(browser: Browser, baseURL: string | undefined, serveur: FauxServeur, o: { sombre?: boolean; reduit?: boolean; largeur?: number } = {}) {
  const session = serveur.sessionCompte('moi@exemple.test', 'Florian', MOI);
  const largeur = o.largeur ?? 390;
  const ctx = await browser.newContext({
    viewport: { width: largeur, height: largeur === 320 ? 568 : 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', baseURL,
    colorScheme: o.sombre ? 'dark' : 'light', reducedMotion: o.reduit === false ? 'no-preference' : 'reduce',
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }] }] },
  });
  const page = await brancher(ctx, serveur, { 'sb-supabase-auth-token': JSON.stringify(session), 'go.parties.v1': JSON.stringify({ n: 3 }) });
  return { ctx, page };
}

const capture = async (page: Page, nom: string) => {
  if (CAPTURES) await page.screenshot({ path: `${CAPTURES}/${nom}.jpg`, type: 'jpeg', quality: 70 });
};

const ouvrirProfil = async (page: Page) => {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: /^Profil/ }).click();
  await expect(page.getByRole('heading', { name: 'Ton parcours' })).toBeVisible();
};

for (const sombre of [false, true]) {
  test(`Profil, ${sombre ? 'sombre' : 'clair'} : ta cote, le grade expliqué une fois, et le départ choisi`, async ({ browser, baseURL }) => {
    const serveur = fauxServeur();
    const { ctx, page } = await telephone(browser, baseURL, serveur, { sombre });
    serveur.profiles.find(p => p.id === MOI)!.rating = 800;
    await ouvrirProfil(page);

    // La ligne « Ta cote » partage la ligne du placement : le Profil tient toujours sans défiler.
    const ligne = page.getByTestId('ligne-cote');
    await expect(ligne).toContainText('Ta cote');
    await expect(ligne).toContainText('Choisis ton départ');
    expect((await ligne.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const { scroll, largeur } = await page.evaluate(() => ({ scroll: document.documentElement.scrollHeight, largeur: document.documentElement.scrollWidth }));
    expect(scroll).toBeLessThanOrEqual(844);
    expect(largeur).toBeLessThanOrEqual(390);
    await capture(page, `profil-ligne-${sombre ? 'sombre' : 'clair'}`);

    await ligne.click();
    await expect(page.getByRole('heading', { name: 'Ta cote' })).toBeVisible();
    const chiffre = page.getByTestId('cote-chiffre');
    await expect(chiffre).toContainText('800 ?');
    await expect(chiffre).toContainText('22ᵉ kyu');
    await expect(chiffre).toContainText('Ta cote provisoire : 800, 22ᵉ kyu.');
    // Kyu et dan expliqués la première fois ; les IA ne comptent pas.
    await expect(page.getByTestId('cote-vocabulaire')).toContainText('Le kyu, c’est ton grade.');
    await expect(page.getByText(/Les parties contre les IA, non\./)).toBeVisible();
    await expect(page.getByText('Ta courbe apparaît après ta première partie classée.')).toBeVisible();

    // Trois départs ; « Je joue en club » ouvre le choix du grade. Une seule action principale.
    const depart = page.getByRole('group', { name: 'D’où pars-tu ?' });
    for (const n of ['Je découvre', 'Je connais les règles', 'Je joue en club']) {
      const b = depart.getByRole('button', { name: new RegExp(n) });
      await expect(b).toBeVisible();
      expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await expect(depart.getByRole('button', { name: /Je découvre/ })).toContainText('Départ au 27ᵉ kyu');
    await depart.getByRole('button', { name: /Je joue en club/ }).click();
    await page.getByLabel('Ton grade en club').selectOption('12');
    await expect(page.locator('.btn.primary')).toHaveCount(1);
    await capture(page, `profil-cote-depart-${sombre ? 'sombre' : 'clair'}`);
    await page.getByRole('button', { name: 'Partir du 12ᵉ kyu' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'C’est noté : tu pars du 12ᵉ kyu.' })).toBeVisible();
    await expect(chiffre).toContainText('1800 ?');
    await expect(chiffre).toContainText('12ᵉ kyu');
    await expect(page.getByTestId('cote-courbe')).toBeVisible();
    expect(serveur.profiles.find(p => p.id === MOI)).toMatchObject({ rating: 1800, cote_depart: 'club', cote_depart_kyu: 12 });

    // Retour : la ligne du Profil donne le grade et la cote ; à la visite suivante, plus d'explication.
    await page.getByRole('button', { name: 'Retour' }).click();
    await expect(page.getByTestId('ligne-cote')).toContainText('12ᵉ kyu · 1800 ?');
    await page.getByTestId('ligne-cote').click();
    await expect(page.getByTestId('cote-chiffre')).toBeVisible();
    await expect(page.getByTestId('cote-vocabulaire')).toHaveCount(0);
    await ctx.close();
  });
}

test('Profil : cote sûre après des parties classées, courbe de 30 jours, départ figé', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const { ctx, page } = await telephone(browser, baseURL, serveur, { largeur: 320 });
  Object.assign(serveur.profiles.find(p => p.id === MOI)!, { rating: 1620, cote_provisoire: false, cote_parties: 14, cote_depart: 'regles', cote_depart_kyu: null });
  const jour = (n: number) => new Date(Date.now() - n * 864e5).toISOString();
  serveur.ratingHistory.push(
    { user_id: MOI, kind: 'depart', rating: 800, created_at: jour(40) },
    { user_id: MOI, kind: 'game', rating: 1480, ecart: 25, created_at: jour(20) },
    { user_id: MOI, kind: 'puzzle', rating: 900, created_at: jour(15) },
    { user_id: MOI, kind: 'game', rating: 1590, ecart: 18, created_at: jour(8) },
    { user_id: MOI, kind: 'game', rating: 1620, ecart: 30, created_at: jour(1) },
    { user_id: LEA, kind: 'game', rating: 2500, ecart: 9, created_at: jour(1) },
  );
  await ouvrirProfil(page);
  await expect(page.getByTestId('ligne-cote')).toContainText('14ᵉ kyu · 1620');
  await page.getByTestId('ligne-cote').click();
  const chiffre = page.getByTestId('cote-chiffre');
  await expect(chiffre).toContainText('1620');
  await expect(chiffre).not.toContainText('?');
  await expect(chiffre).toContainText('14ᵉ kyu');
  // Courbe : parties classées des 30 derniers jours seulement (ni le départ d'il y a 40 jours, ni les problèmes).
  await expect(page.getByRole('img', { name: 'Ta cote sur 30 jours : de 1480 à 1620.' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'D’où pars-tu ?' })).toHaveCount(0);
  await expect(page.getByText('Ton départ est fixé depuis ta première partie classée.')).toBeVisible();
  const { largeur } = await page.evaluate(() => ({ largeur: document.documentElement.scrollWidth }));
  expect(largeur).toBeLessThanOrEqual(320);
  await capture(page, 'profil-cote-sure-320');
  await ctx.close();
});

/** Partie classée contre Léa (Noir), à moi de jouer (Blanc). */
function semerPartieClassee(serveur: FauxServeur) {
  serveur.games.push({ id: PARTIE, white_id: MOI, black_id: LEA, created_by: MOI, size: 9, komi: 6.5, rules: 'japanese', handicap: 0,
    moves: 'eecggc', status: 'active', counting: false, dead_stones: null, dead_proposed_by: null, result: null, resumed_at: 0, prive: true, rated: true });
  serveur.defis.push({ partie_id: PARTIE, jeton: JETON, createur_id: MOI, invite_id: LEA, delai_coup: '3 days',
    date_limite: new Date(Date.now() + 50 * H).toISOString(), lien_expire_le: new Date(Date.now() + 7 * 864e5).toISOString(), cree_le: new Date().toISOString() });
  serveur.profiles.push({ id: LEA, username: 'Lea_du_go', rating: 1580, cote_provisoire: false, streak_days: 0, streak_last: null, streak_freezes: 0 });
}

/** Léa abandonne : le serveur compte la partie (+14 pour moi, 1592 → 1606), puis l'écran relit la partie. */
async function leaAbandonne(page: Page, serveur: FauxServeur, ecart = 14, apres = 1606) {
  Object.assign(serveur.games[0], { status: 'finished', result: 'W+R' });
  Object.assign(serveur.profiles.find(p => p.id === MOI)!, { rating: apres, cote_provisoire: false });
  serveur.ratingHistory.push({ user_id: MOI, kind: 'game', game_id: PARTIE, rating: apres, ecart, created_at: new Date().toISOString() });
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
}

for (const reduit of [true, false]) {
  test(`fin de partie classée, ${reduit ? 'mouvements réduits' : 'animée'} : « +14 », la nouvelle cote, « Tu passes 14ᵉ kyu ! »`, async ({ browser, baseURL }) => {
    const serveur = fauxServeur();
    semerPartieClassee(serveur);
    const { ctx, page } = await telephone(browser, baseURL, serveur, { reduit, sombre: !reduit });
    await page.goto('/');
    await page.getByTestId('tuile-defi').click();
    await expect(plateau(page)).toBeVisible();
    // Carte de l'adversaire : sa couleur, son grade et sa cote.
    await expect(page.locator('.joueur').first()).toContainText('Lea_du_go');
    await expect(page.locator('.joueur').first()).toContainText('15ᵉ kyu · 1580');
    expect(await page.locator('.joueur').first().locator('text=1580').count()).toBe(1);

    await leaAbandonne(page, serveur);
    const gain = page.getByTestId('cote-gain');
    await expect(gain).toBeVisible();
    await expect(page.getByTestId('cote-ecart')).toHaveText('+14');
    await expect(gain).toContainText('Ta cote : 1606 · 14ᵉ kyu');
    await expect(page.getByTestId('cote-grade-change')).toHaveText('Tu passes 14ᵉ kyu !');
    await expect(gain.getByRole('status').first()).toHaveText('Ta cote : +14 points. Elle passe à 1606.');
    if (reduit) {
      await expect(gain).not.toHaveClass(/anime/);
      await expect(page.locator('canvas')).toHaveCount(0);
    } else {
      await expect(gain).toHaveClass(/anime/);
    }
    // Toujours une seule action principale : « Défier quelqu'un d'autre », visible sans défiler.
    await expect(page.locator('.defi-fin .btn.primary')).toHaveCount(1);
    await expect(page.locator('.defi-fin .btn.primary')).toBeInViewport();
    // Kyu et dan expliqués la première fois, sous les actions.
    await expect(page.getByTestId('cote-vocabulaire')).toContainText('Le kyu, c’est ton grade.');
    await capture(page, `fin-classee-${reduit ? 'reduit-clair' : 'anime-sombre'}`);
    await ctx.close();
  });
}

test('partie non classée : ni cote ni grade, à la fin comme pendant la partie', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  semerPartieClassee(serveur);
  serveur.games[0].rated = false;
  const { ctx, page } = await telephone(browser, baseURL, serveur);
  await page.goto('/');
  await page.getByTestId('tuile-defi').click();
  await expect(plateau(page)).toBeVisible();
  await expect(page.locator('.joueur').first()).toContainText('Lea_du_go');
  await expect(page.locator('.joueur').first()).not.toContainText('kyu');
  await leaAbandonne(page, serveur);
  await expect(page.locator('.defi-fin')).toBeVisible();
  await expect(page.getByTestId('cote-gain')).toHaveCount(0);
  await expect(page.getByTestId('cote-vocabulaire')).toHaveCount(0);
  await ctx.close();
});
