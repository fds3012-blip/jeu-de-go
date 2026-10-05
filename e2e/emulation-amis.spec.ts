import { expect, test, type Browser, type Page } from '@playwright/test';
import { brancher, fauxServeur, type FauxServeur } from './fauxSupabase';
import { attendrePierre, jouer } from './plateau';

// Issue #369 (décision du 05/10) : émulation entre amis, dès 2 joueurs. Supabase simulé (e2e/fauxSupabase.ts).
// - Go du jour : Léa le réussit ; Florian, son ami, la voit « Réussi en 1 essai » sous sa propre réussite ; un non-ami
//   n'apparaît jamais ; « Rappelle-lui » prévient Max (pastille sur Problèmes chez lui).
// - Profil, « Ta semaine » : objectifs, une seule action principale, « Tu as battu Lea 1 fois. », cote de la semaine.
// - Accueil : bilan de la semaine passée, une fois. Ta cote : records. Objectif atteint : +30 XP.
// Horloge figée le 27/09/2026 à midi (Paris) pour le Go du jour : n° 1, le problème b1 (réponse E5).

const MIDI_PARIS = new Date('2026-09-27T12:00:00+02:00');
const FLO = '00000000-0000-4000-8000-0000000000a1';
const LEA = '00000000-0000-4000-8000-0000000000b2';
const MAX = '00000000-0000-4000-8000-0000000000c3';
const EVE = '00000000-0000-4000-8000-0000000000e5';
const CAPTURES = process.env.CAPTURES_369; // ex. un dossier temporaire : captures légères (jpeg)

interface Options { sombre?: boolean; largeur?: number; horloge?: Date; stockage?: Record<string, string>; compte?: [string, string, string] }

async function telephone(browser: Browser, baseURL: string | undefined, serveur: FauxServeur | null, o: Options = {}) {
  const largeur = o.largeur ?? 390;
  const ctx = await browser.newContext({
    viewport: { width: largeur, height: largeur === 320 ? 568 : 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', baseURL,
    colorScheme: o.sombre ? 'dark' : 'light', reducedMotion: 'reduce',
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }] }] },
  });
  const stockage: Record<string, string> = { 'go.parties.v1': JSON.stringify({ n: 3 }), ...o.stockage };
  if (o.compte && serveur) stockage['sb-supabase-auth-token'] = JSON.stringify(serveur.sessionCompte(...o.compte));
  const page = serveur ? await brancher(ctx, serveur, stockage) : await ctx.newPage();
  if (!serveur) await page.addInitScript(s => { for (const [k, v] of Object.entries(s)) if (localStorage.getItem(k) === null) localStorage.setItem(k, v); }, stockage);
  if (o.horloge) await page.clock.setFixedTime(o.horloge);
  return { ctx, page };
}

const capture = async (page: Page, nom: string) => {
  if (CAPTURES) await page.screenshot({ path: `${CAPTURES}/${nom}.jpg`, type: 'jpeg', quality: 60 });
};
const nav = (page: Page) => page.getByRole('navigation');
const sansDebordement = async (page: Page) => {
  const { large, fenetre } = await page.evaluate(() => ({ large: document.documentElement.scrollWidth, fenetre: innerWidth }));
  expect(large).toBeLessThanOrEqual(fenetre);
};

/** Ouvre le Go du jour n° 1 par son lien, joue les coups donnés ; le dernier est la réponse. */
async function goDuJour(page: Page, coups: string[]) {
  await page.goto('/?go-du-jour=1');
  await expect(page.getByText(/^Go du jour n°\s1$/)).toBeVisible();
  for (const c of coups.slice(0, -1)) {
    await jouer(page, c);
    await expect(page.getByText('Pas tout à fait. Essaie encore.')).toBeVisible();
  }
  await jouer(page, coups.at(-1)!);
  await attendrePierre(page, coups.at(-1)!, 'noir');
}

/** Lundi de la semaine en cours, heure de Paris (comme src/app/semaine.ts). */
function lundiParis(decalage = 0): string {
  const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const d = new Date(`${jour}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + decalage * 7);
  return d.toISOString().slice(0, 10);
}
const semaine = (lundi: string, compte: Record<string, number>, atteints: string[] = []) => ({
  lundi, compte: { parties: 0, problemes: 0, erreurs: 0, goDuJour: 0, lecons: 0, ...compte }, cibles: { parties: 3, problemes: 5, erreurs: 2 }, atteints,
});

test('deux amis : Léa réussit, Florian la voit après sa réussite ; « Rappelle-lui » prévient Max ; un non-ami jamais', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  serveur.amities.push({ de: FLO, a: LEA, etat: 'accepted', le: new Date().toISOString() }, { de: MAX, a: FLO, etat: 'accepted', le: new Date().toISOString() });
  // Eve n'est l'amie de personne ; elle réussit aussi le Go du jour.
  const lea = await telephone(browser, baseURL, serveur, { horloge: MIDI_PARIS, compte: ['lea@exemple.test', 'Lea', LEA] });
  const eve = await telephone(browser, baseURL, serveur, { horloge: MIDI_PARIS, compte: ['eve@exemple.test', 'Eve', EVE] });
  await goDuJour(lea.page, ['E5']);
  await goDuJour(eve.page, ['E5']);
  await expect.poll(() => serveur.goDuJour.filter(g => g.etat === 'reussi').length).toBe(2);

  const flo = await telephone(browser, baseURL, serveur, { horloge: MIDI_PARIS, compte: ['flo@exemple.test', 'Florian', FLO], stockage: { 'go.parties.v1': JSON.stringify({ n: 3 }) } });
  const max = await telephone(browser, baseURL, serveur, { compte: ['max@exemple.test', 'Max', MAX] });
  await flo.page.goto('/?go-du-jour=1');
  await expect(flo.page.getByTestId('amis-du-jour')).toHaveCount(0);
  await goDuJour(flo.page, ['A1', 'E5']);
  // Le serveur a compté les deux essais de Florian.
  await expect.poll(() => serveur.goDuJour.find(g => g.user === FLO)?.essais).toBe(2);

  // Une seule action en relief ; le bloc, replié, résume : 1 ami sur 2 l'a fait.
  const bloc = flo.page.getByTestId('amis-du-jour');
  await expect(bloc).toBeVisible();
  await expect(flo.page.locator('.verdict .cta')).toHaveCount(1);
  await expect(bloc.locator('summary')).toContainText('Tes amis aujourd’hui');
  await expect(bloc.locator('summary')).toContainText('1 sur 2');
  expect((await bloc.locator('summary').boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await bloc.locator('summary').click();
  const lignes = bloc.locator('li');
  await expect(lignes).toHaveCount(3);
  // Ordre du serveur, sans rang : Léa (1 essai), toi (2 essais), Max (pas encore). Jamais Eve.
  await expect(lignes.nth(0)).toContainText('Lea');
  await expect(lignes.nth(0)).toContainText('Réussi en 1 essai');
  await expect(lignes.nth(1)).toContainText('Toi');
  await expect(lignes.nth(1)).toContainText('Réussi en 2 essais');
  await expect(lignes.nth(2)).toContainText('Max');
  await expect(lignes.nth(2)).toContainText('Pas encore');
  await expect(bloc).not.toContainText('Eve');
  await expect(bloc).not.toContainText(/cote|1er|#1/i);
  await sansDebordement(flo.page);
  await capture(flo.page, 'go-du-jour-amis-clair');

  const rappeler = bloc.getByRole('button', { name: 'Rappeler le Go du jour à Max' });
  expect((await rappeler.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await rappeler.click();
  await expect(lignes.nth(2)).toContainText('Rappel envoyé');
  await expect(bloc.getByRole('button', { name: /Rappeler/ })).toHaveCount(0);
  expect(serveur.notifications.filter(n => n.destinataire_id === MAX && n.type === 'go_du_jour')).toHaveLength(1);

  // Chez Max : la pastille de l'onglet Problèmes dit qu'un ami l'attend.
  await max.page.goto('/');
  await expect(nav(max.page).getByRole('button', { name: 'Problèmes, Un ami t’attend au Go du jour' })).toBeVisible();

  for (const c of [lea, eve, flo, max]) await c.ctx.close();
});

test('à 320 px en mode sombre : la liste des amis reste lisible, sans débordement, cibles de 44 px', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  serveur.amities.push({ de: FLO, a: LEA, etat: 'accepted', le: new Date().toISOString() });
  serveur.profiles.push({ id: LEA, username: 'Lea', rating: 800 }, { id: MAX, username: 'Maximilien_Longpseudo', rating: 800 });
  serveur.amities.push({ de: FLO, a: MAX, etat: 'accepted', le: new Date().toISOString() });
  const flo = await telephone(browser, baseURL, serveur, { horloge: MIDI_PARIS, compte: ['flo@exemple.test', 'Florian', FLO], sombre: true, largeur: 320 });
  await goDuJour(flo.page, ['E5']);
  const bloc = flo.page.getByTestId('amis-du-jour');
  await bloc.locator('summary').click();
  await expect(bloc.locator('li')).toHaveCount(3);
  for (const b of await bloc.getByRole('button').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await sansDebordement(flo.page);
  await capture(flo.page, 'go-du-jour-amis-320-sombre');
  await flo.ctx.close();
});

for (const sombre of [false, true]) {
  test(`Profil, « Ta semaine » (${sombre ? 'sombre' : 'clair'}) : objectifs, une seule action, amis battus et cote de la semaine`, async ({ browser, baseURL }) => {
    const serveur = fauxServeur();
    serveur.amities.push({ de: FLO, a: LEA, etat: 'accepted', le: new Date().toISOString() });
    serveur.profiles.push({ id: EVE, username: 'Eve', rating: 800 }, { id: LEA, username: 'Lea', rating: 800 });
    serveur.games.push(
      { id: '44444444-4444-4444-8444-000000000001', black_id: FLO, white_id: LEA, status: 'finished', result: 'B+R', rated: true, bot_id: null, size: 9, moves: '' },
      // Contre Eve (pas une amie) : comptée, jamais nommée.
      { id: '44444444-4444-4444-8444-000000000002', black_id: EVE, white_id: FLO, status: 'finished', result: 'B+3.5', rated: false, bot_id: null, size: 9, moves: '' },
    );
    serveur.ratingHistory.push({ user_id: FLO, kind: 'game', rating: 814, ecart: 14, rd: 300, game_id: '44444444-4444-4444-8444-000000000001', created_at: new Date().toISOString() });
    const { ctx, page } = await telephone(browser, baseURL, serveur, { sombre, compte: ['flo@exemple.test', 'Florian', FLO],
      stockage: { 'go.semaine.v1': JSON.stringify({ courante: semaine(lundiParis(), { parties: 3, problemes: 2, goDuJour: 1 }, ['parties']), precedente: null, bilanVu: null }) } });
    await page.goto('/');
    await nav(page).getByRole('button', { name: /^Profil/ }).click();
    await expect(page.getByRole('heading', { name: 'Ton parcours' })).toBeVisible();
    const ligne = page.getByTestId('ligne-semaine');
    await expect(ligne).toContainText('1 / 3 objectifs');
    // Une ligne de plus : le Profil tient toujours sans défiler, sans débordement.
    const { scroll } = await page.evaluate(() => ({ scroll: document.documentElement.scrollHeight }));
    expect(scroll).toBeLessThanOrEqual(844);
    await sansDebordement(page);
    await capture(page, `profil-ligne-semaine-${sombre ? 'sombre' : 'clair'}`);

    await ligne.click();
    await expect(page.getByRole('heading', { name: 'Ta semaine' })).toBeVisible();
    const vue = page.getByTestId('semaine');
    await expect(vue.locator('li[data-objectif="parties"]')).toContainText('Atteint');
    await expect(vue.locator('li[data-objectif="problemes"]')).toContainText('2 / 5');
    await expect(vue.locator('li[data-objectif="erreurs"]')).toContainText('0 / 2');
    // Une seule action en relief : le prochain objectif.
    await expect(page.locator('.btn.primary, .cta')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Faire un problème' })).toBeVisible();
    await expect(vue.getByTestId('phrases-semaine')).toContainText('Tu as battu Lea 1 fois.');
    await expect(vue.getByTestId('phrases-semaine')).toContainText('Ta cote : +14 cette semaine.');
    await expect(vue).not.toContainText('Eve');
    for (const b of await page.getByRole('button').all()) if (await b.isVisible()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await sansDebordement(page);
    await capture(page, `profil-semaine-${sombre ? 'sombre' : 'clair'}`);

    await page.getByRole('button', { name: 'Faire un problème' }).click();
    await expect(nav(page).getByRole('button', { name: /^Problèmes/ })).toHaveAttribute('aria-current', 'page');
    await ctx.close();
  });
}

test('Ta semaine sans compte, hors ligne : les objectifs restent, le serveur le dit simplement', async ({ browser, baseURL }) => {
  const { ctx, page } = await telephone(browser, baseURL, null, { largeur: 320, sombre: true });
  await page.goto('/');
  await nav(page).getByRole('button', { name: /^Profil/ }).click();
  await page.getByTestId('ligne-semaine').click();
  await expect(page.getByText('Avec un compte, tu verras aussi tes parties contre tes amis.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Jouer une partie' })).toBeVisible();
  await ctx.setOffline(true);
  await expect(page.getByTestId('semaine').locator('li.objectif')).toHaveCount(3);
  await sansDebordement(page);
  await ctx.close();
});

test('accueil : le bilan de la semaine passée se montre une fois, puis plus avant la semaine suivante', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const { ctx, page } = await telephone(browser, baseURL, serveur, { compte: ['flo@exemple.test', 'Florian', FLO],
    stockage: { 'go.semaine.v1': JSON.stringify({ courante: semaine(lundiParis(-1), { parties: 4, problemes: 7, goDuJour: 3 }, ['parties', 'problemes']), precedente: null, bilanVu: null }) } });
  await page.goto('/');
  const carte = page.getByTestId('bilan-semaine');
  // Sous les tuiles : marqué vu seulement une fois à l'écran (un rechargement avant ne le perd pas).
  await expect(carte).toBeAttached();
  await page.reload();
  await carte.scrollIntoViewIfNeeded();
  await expect(carte).toBeVisible();
  await expect(carte).toContainText('Ta semaine passée');
  await expect(carte.locator('[data-stat="parties"]')).toContainText('4');
  await expect(carte.locator('[data-stat="goDuJour"]')).toContainText('3');
  await expect(carte).toContainText('2 objectifs atteints sur 3');
  // Un seul bouton en relief sur l'accueil ; « Fermer » est discret, 44 px.
  await expect(page.locator('.cta')).toHaveCount(1);
  const fermer = carte.getByRole('button', { name: 'Fermer le bilan de la semaine' });
  expect((await fermer.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await sansDebordement(page);
  await capture(page, 'accueil-bilan-semaine');
  await fermer.click();
  await expect(carte).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.cta')).toBeVisible();
  await expect(page.getByTestId('bilan-semaine')).toHaveCount(0);
  await ctx.close();
});

test('Ta cote : records personnels (meilleure cote, plus longue série de victoires)', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const { ctx, page } = await telephone(browser, baseURL, serveur, { compte: ['flo@exemple.test', 'Florian', FLO] });
  Object.assign(serveur.profiles.find(p => p.id === FLO)!, { rating: 820, cote_parties: 3, cote_provisoire: true });
  const h = (n: number, rating: number, ecart: number) => ({ user_id: FLO, kind: 'game', rating, ecart, rd: 300, game_id: null, created_at: new Date(Date.now() - (5 - n) * 60_000).toISOString() });
  serveur.ratingHistory.push(h(1, 830, 30), h(2, 850, 20), h(3, 820, -30));
  await page.goto('/');
  await nav(page).getByRole('button', { name: /^Profil/ }).click();
  await page.getByTestId('ligne-cote').click();
  const records = page.getByTestId('records');
  await expect(records.getByTestId('record-cote')).toContainText('850');
  await expect(records.getByTestId('record-serie')).toContainText('2 victoires');
  await sansDebordement(page);
  await ctx.close();
});

test('objectif de la semaine atteint par le Go du jour : +30 XP, une fois', async ({ browser, baseURL }) => {
  // Sans compte : le Go du jour reste libre ; la semaine du 27/09 commence le lundi 21/09.
  const { ctx, page } = await telephone(browser, baseURL, null, { horloge: MIDI_PARIS,
    stockage: { 'go.semaine.v1': JSON.stringify({ courante: semaine('2026-09-21', { problemes: 4 }), precedente: null, bilanVu: null }) } });
  await goDuJour(page, ['E5']);
  // Go du jour 20 + première fois 20 + objectif 30.
  await expect.poll(() => page.evaluate(() => Number(localStorage.getItem('go.xp.v1')))).toBe(70);
  const etat = await page.evaluate(() => JSON.parse(localStorage.getItem('go.semaine.v1') ?? '{}'));
  expect(etat.courante.atteints).toEqual(['problemes']);
  expect(etat.courante.compte.problemes).toBe(5);
  await ctx.close();
});
