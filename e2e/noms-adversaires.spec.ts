import { expect, test, type Browser } from '@playwright/test';
import { brancher, fauxServeur, JETON, PARTIE, type FauxServeur } from './fauxSupabase';
import { plateau } from './plateau';

// Issue #400 : la liste « Tes parties » de l'écran des défis nomme l'adversaire par son pseudo, lu sous la RLS
// existante (profils publics), en une seule lecture pour toute la liste. Sans pseudo : « Ton ami ». Lien pas encore
// ouvert : « Partie du… », comme avant. Supabase simulé (e2e/fauxSupabase.ts).
// Captures (JPEG) : docs/design/captures/noms-et-13x13.

const CAPTURES = 'docs/design/captures/noms-et-13x13';
const MOI = '00000000-0000-4000-8000-0000000000a1';
const LEA = '00000000-0000-4000-8000-0000000000b2';
const SAM = '00000000-0000-4000-8000-0000000000c3';
const NEMO = '00000000-0000-4000-8000-0000000000d4';
const H = 3_600_000;
const id = (n: number) => `${n}${PARTIE.slice(1)}`;

/** Quatre défis : à moi contre Léa, au tour d'un ami au pseudo très long, un lien pas encore ouvert, une défaite contre un ami sans pseudo. */
function semer(serveur: FauxServeur) {
  const maintenant = Date.now();
  const partie = (n: number, noir: string | null, blanc: string, p: Record<string, unknown>) => {
    serveur.games.push({ id: id(n), white_id: blanc, black_id: noir, created_by: MOI, size: 9, komi: 6.5, rules: 'japanese', handicap: 0,
      moves: '', status: 'active', counting: false, dead_stones: null, dead_proposed_by: null, result: null, resumed_at: 0, prive: true, rated: false, ...p });
    serveur.defis.push({ partie_id: id(n), jeton: `${n}${JETON.slice(1)}`, createur_id: MOI, invite_id: noir, delai_coup: '3 days',
      date_limite: p.status === 'waiting' || p.status === 'finished' ? null : new Date(maintenant + 50 * H).toISOString(),
      lien_expire_le: new Date(maintenant + 7 * 864e5).toISOString(), cree_le: new Date(maintenant - n * 864e5).toISOString() });
  };
  partie(1, LEA, MOI, { moves: 'eecggc' });
  partie(2, SAM, MOI, { moves: 'eecg' });
  partie(3, null, MOI, { status: 'waiting' });
  partie(4, NEMO, MOI, { moves: 'eecg', status: 'finished', result: 'B+3.5' });
  serveur.profiles.push({ id: LEA, username: 'Lea_du_go', rating: 1500, streak_days: 0, streak_last: null, streak_freezes: 0 });
  serveur.profiles.push({ id: SAM, username: 'Samourai_du_dimanche', rating: 1500, streak_days: 0, streak_last: null, streak_freezes: 0 });
  serveur.profiles.push({ id: NEMO, username: null, rating: 1500, streak_days: 0, streak_last: null, streak_freezes: 0 });
}

async function ouvrir(browser: Browser, baseURL: string | undefined, serveur: FauxServeur, largeur: number, sombre: boolean) {
  const session = serveur.sessionCompte('moi@exemple.test', 'Florian', MOI);
  const ctx = await browser.newContext({
    viewport: { width: largeur, height: largeur === 320 ? 568 : 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', baseURL,
    colorScheme: sombre ? 'dark' : 'light', reducedMotion: 'reduce',
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }] }] },
  });
  const page = await brancher(ctx, serveur, { 'sb-supabase-auth-token': JSON.stringify(session), 'go.parties.v1': JSON.stringify({ n: 3 }) });
  await page.goto('/');
  await page.getByTestId('lien-defi').click();
  await expect(page.getByRole('heading', { name: 'Tes parties' })).toBeVisible();
  return { ctx, page };
}

for (const [largeur, sombre] of [[390, false], [390, true], [320, true]] as const) {
  test(`« Tes parties » nomme chaque ami, à ${largeur} px (${sombre ? 'sombre' : 'clair'})`, async ({ browser, baseURL }) => {
    const serveur = fauxServeur();
    semer(serveur);
    const { ctx, page } = await ouvrir(browser, baseURL, serveur, largeur, sombre);
    const erreurs: string[] = [];
    page.on('pageerror', e => erreurs.push(e.message));
    const lignes = page.locator('.defis-liste .defi-ligne');
    await expect(lignes).toHaveCount(4);

    await expect(lignes.nth(0).locator('.defi-ligne-nom')).toHaveText('Lea_du_go');
    await expect(lignes.nth(0)).toContainText(/À toi de jouer/);
    await expect(lignes.nth(1).locator('.defi-ligne-nom')).toHaveText('Samourai_du_dimanche');
    await expect(lignes.nth(1)).toContainText('Au tour de Samourai_du_dimanche');
    // Lien pas encore ouvert : pas d'adversaire, la ligne garde sa date.
    await expect(lignes.nth(2)).toContainText(/Partie du/);
    await expect(lignes.nth(2)).toContainText('Lien pas encore ouvert');
    // Ami sans pseudo : « Ton ami ».
    await expect(lignes.nth(3).locator('.defi-ligne-nom')).toHaveText('Ton ami');
    await expect(lignes.nth(3)).toContainText('Ton ami a gagné de 3,5 points.');
    // Une seule lecture des profils pour les trois amis de la liste, pas une par ligne. (« À faire », sur l'accueil,
    // lit à part le pseudo de Léa : c'est le seul défi où c'est mon tour.)
    const lectures = serveur.appels.filter(a => a.startsWith('GET /rest/v1/profiles') && a.includes('username') && (a.includes(SAM) || a.includes(NEMO)));
    expect(lectures).toHaveLength(1);
    for (const ami of [LEA, SAM, NEMO]) expect(lectures[0]).toContain(ami);

    // Rien ne déborde : un pseudo long est coupé, la date reste lisible ; chaque ligne fait au moins 44 px.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(largeur);
    for (const l of await lignes.all()) expect((await l.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const date = (await lignes.nth(1).locator('.defi-ligne-date').boundingBox())!;
    const ligne = (await lignes.nth(1).boundingBox())!;
    expect(date.x + date.width).toBeLessThanOrEqual(ligne.x + ligne.width);
    await lignes.nth(3).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${CAPTURES}/tes-parties-${largeur}-${sombre ? 'sombre' : 'clair'}.jpg`, type: 'jpeg', quality: 80 });

    // Toucher la ligne de Léa ouvre la partie, Léa nommée sur son bandeau.
    await lignes.nth(0).click();
    await expect(plateau(page)).toBeVisible();
    await expect(page.locator('.joueur').first()).toContainText('Lea_du_go');
    expect(erreurs).toEqual([]);
    await ctx.close();
  });
}
