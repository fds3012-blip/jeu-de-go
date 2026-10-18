import { expect, test, type Browser, type Page } from '@playwright/test';
import { SCENARIO } from '../src/content/decouverte';
import { brancher, fauxServeur, JETON, PARTIE, type FauxServeur } from './fauxSupabase';
import { abandonner, passer, plateau, toucherCta } from './plateau';
import { faireMoment } from './decouverte';

// #640 (lot N4, règles A3, A6 et A10 de DESIGN.md) : plus aucun changement d'onglet sous le joueur. Les 12 chemins de
// docs/ux/architecture-pages-2026-10.md (G3) : l'écran s'ouvre par-dessus l'écran courant, l'onglet allumé ne change pas,
// et la sortie (« ‹ », fin, retour du système) ramène à l'écran d'origine. Pour chaque chemin : l'onglet allumé pendant
// l'écran ouvert (ou pas de barre, pour une partie en plein écran), puis l'écran retrouvé à la sortie.

const ALICE = '00000000-0000-4000-8000-0000000000a1';
const CHLOE = '00000000-0000-4000-8000-0000000000c3';
const LEA = '00000000-0000-4000-8000-0000000000b2';

const nav = (page: Page) => page.getByRole('navigation', { name: 'Navigation principale' });
const onglet = (page: Page, nom: string) => nav(page).getByRole('button', { name: new RegExp(`^${nom}`) });
/** L'onglet allumé est `nom`, et lui seul. */
async function allume(page: Page, nom: string) {
  await expect(onglet(page, nom)).toHaveAttribute('aria-current', 'page');
  await expect(nav(page).locator('[aria-current="page"]')).toHaveCount(1);
}

/** Le retour du système (Android, navigateur) : la garde d'historique est posée à l'image qui suit l'ouverture. */
async function retourSysteme(page: Page) {
  await expect.poll(() => page.evaluate(() => (history.state as { garde?: boolean } | null)?.garde ?? false)).toBe(true);
  await page.goBack();
}

/** Le « ‹ » visible de l'écran affiché. */
const fleche = (page: Page) => page.locator('.retour:visible, [data-retour]:visible').last();

async function telephone(browser: Browser, baseURL: string | undefined, o: { serveur?: FauxServeur; stockage?: Record<string, string>; session?: object } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', baseURL, reducedMotion: 'reduce',
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }, { name: 'go.connait-go.v1', value: '"sait"' }] }] },
  });
  const stockage = { 'go.premiere-pierre.v1': 'true', 'go.parties.v1': JSON.stringify({ n: 3 }), ...o.stockage, ...(o.session ? { 'sb-supabase-auth-token': JSON.stringify(o.session) } : {}) };
  let page: Page;
  if (o.serveur) page = await brancher(ctx, o.serveur, stockage);
  else {
    page = await ctx.newPage();
    await page.addInitScript(s => { for (const [k, v] of Object.entries(s)) if (localStorage.getItem(k) === null) localStorage.setItem(k, v); }, stockage);
  }
  const erreurs: string[] = [];
  page.on('pageerror', e => erreurs.push(e.message));
  return { ctx, page, erreurs };
}

/** Alice et Chloé sont amies ; Chloé a joué une partie classée. */
function amies(serveur: FauxServeur) {
  serveur.compteExistant('chloe@exemple.test', 'Chloe', CHLOE);
  serveur.amities.push({ de: CHLOE, a: ALICE, etat: 'accepted', le: new Date().toISOString() });
  return serveur.sessionCompte('alice@exemple.test', 'Alice', ALICE);
}

test('1. placement depuis le Profil : le Profil reste allumé, « Passer » ramène au Profil', async ({ browser, baseURL }) => {
  const { ctx, page, erreurs } = await telephone(browser, baseURL);
  await page.goto('/');
  await onglet(page, 'Profil').click();
  await page.getByRole('button', { name: 'Ton niveau de départ' }).click();
  const passer = page.getByRole('button', { name: 'Passer les 3 problèmes' });
  await expect(passer).toBeVisible();
  await allume(page, 'Profil');
  await passer.click();
  await expect(page.getByRole('heading', { name: 'Ta progression' })).toBeVisible();
  await allume(page, 'Profil');
  // Le retour du système aussi (placement rouvert : rien n'est enregistré par la sortie).
  await page.getByRole('button', { name: /^(Ton niveau de départ|Refaire)/ }).first().click();
  await expect(passer).toBeVisible();
  await retourSysteme(page);
  await expect(page.getByRole('heading', { name: 'Ta progression' })).toBeVisible();
  await allume(page, 'Profil');
  expect(erreurs).toEqual([]);
  await ctx.close();
});

test('2. « Défier » depuis Mes amis : la partie en plein écran, puis « ‹ » ramène à Mes amis', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const { ctx, page, erreurs } = await telephone(browser, baseURL, { serveur, session: amies(serveur) });
  await page.goto('/');
  await onglet(page, 'Profil').click();
  await page.getByRole('button', { name: /^Mes amis/ }).click();
  await page.getByRole('button', { name: 'Défier Chloe' }).click();
  await expect(plateau(page)).toBeVisible();
  await expect(nav(page)).toHaveCount(0);
  await fleche(page).click();
  await expect(page.getByRole('heading', { name: 'Mes amis' })).toBeVisible();
  await allume(page, 'Profil');
  expect(erreurs).toEqual([]);
  await ctx.close();
});

test('3. « Défier » depuis le profil d’un ami : la sortie ramène au profil, pas à Jouer', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const { ctx, page, erreurs } = await telephone(browser, baseURL, { serveur, session: amies(serveur) });
  await page.goto('/');
  await onglet(page, 'Profil').click();
  await page.getByRole('button', { name: /^Mes amis/ }).click();
  await page.getByRole('button', { name: 'Voir le profil de Chloe' }).click();
  await page.getByTestId('profil-public').getByRole('button', { name: 'Défier Chloe' }).click();
  await expect(plateau(page)).toBeVisible();
  await expect(nav(page)).toHaveCount(0);
  await retourSysteme(page);
  await expect(page.getByRole('heading', { name: 'Profil de Chloe' })).toBeVisible();
  await allume(page, 'Profil');
  expect(erreurs).toEqual([]);
  await ctx.close();
});

test('4. profil de l’adversaire depuis la fin d’une partie en ligne : Jouer reste allumé, « Retour » rend le bilan', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const session = serveur.sessionCompte('moi@exemple.test', 'Florian', ALICE);
  serveur.games.push({ id: PARTIE, white_id: ALICE, black_id: LEA, created_by: ALICE, size: 9, komi: 6.5, rules: 'japanese', handicap: 0,
    moves: 'eecggc', status: 'active', counting: false, dead_stones: null, dead_proposed_by: null, result: null, resumed_at: 0, prive: true, rated: false });
  serveur.defis.push({ partie_id: PARTIE, jeton: JETON, createur_id: ALICE, invite_id: LEA, delai_coup: '3 days',
    date_limite: new Date(Date.now() + 50 * 3_600_000).toISOString(), lien_expire_le: new Date(Date.now() + 7 * 864e5).toISOString(), cree_le: new Date().toISOString() });
  serveur.profiles.push({ id: LEA, username: 'Lea_du_go', rating: 1500, streak_days: 0, streak_last: null, streak_freezes: 0 });
  const { ctx, page, erreurs } = await telephone(browser, baseURL, { serveur, session });
  await page.goto('/');
  await page.getByTestId('tuile-defi').click();
  await expect(plateau(page)).toBeVisible();
  await abandonner(page);
  const voir = page.getByTestId('fin-profil');
  await expect(voir).toBeVisible();
  await voir.click();
  await expect(page.getByRole('heading', { name: 'Profil de Lea_du_go' })).toBeVisible();
  await allume(page, 'Jouer');
  await page.getByRole('button', { name: 'Retour', exact: true }).click();
  await expect(page.getByTestId('fin-profil')).toBeVisible();
  await expect(page.locator('.defi-fin-titre')).toBeVisible();
  expect(erreurs).toEqual([]);
  await ctx.close();
});

test('5. profil d’un ami depuis la carte de la semaine : Jouer reste allumé, le retour rend l’accueil', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const session = amies(serveur);
  serveur.games.push({ id: '44444444-4444-4444-8444-000000000001', black_id: ALICE, white_id: CHLOE, status: 'finished', result: 'B+R', rated: true, bot_id: null, size: 9, moves: '' });
  const lundi = (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) - 7); return d.toISOString().slice(0, 10); })();
  const semaine = { courante: { lundi, compte: { parties: 4, problemes: 7, erreurs: 0, goDuJour: 3, lecons: 0 }, cibles: { parties: 3, problemes: 5, erreurs: 2 }, atteints: ['parties'] }, precedente: null, bilanVu: null };
  const { ctx, page, erreurs } = await telephone(browser, baseURL, { serveur, session, stockage: { 'go.semaine.v1': JSON.stringify(semaine) } });
  await page.goto('/');
  const carte = page.getByTestId('bilan-semaine');
  await carte.scrollIntoViewIfNeeded();
  await carte.getByRole('button', { name: 'Voir le profil de Chloe' }).click();
  await expect(page.getByRole('heading', { name: 'Profil de Chloe' })).toBeVisible();
  await allume(page, 'Jouer');
  await retourSysteme(page);
  await expect(page.getByTestId('bilan-semaine')).toBeVisible();
  await allume(page, 'Jouer');
  expect(erreurs).toEqual([]);
  await ctx.close();
});

test('6. « Étudie-la » depuis une partie partagée : Jouer reste allumé, « ‹ » rend la partie partagée', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  serveur.compteExistant('ana@exemple.test', 'Ana', '00000000-0000-4000-8000-0000000000d4');
  serveur.partagees.push({ jeton: JETON, user_id: '00000000-0000-4000-8000-0000000000d4', taille: 9, joueur: null, adversaire: null, coup: 1, objet: 'etude',
    sgf: '(;GM[1]FF[4]CA[UTF-8]SZ[9]KM[6.5]RU[Japanese]AB[cc][gg]AW[ee]PL[W];W[dd])' });
  const { ctx, page, erreurs } = await telephone(browser, baseURL, { serveur });
  await page.goto(`/partie#${JETON}`);
  await expect(page.getByRole('heading', { level: 2, name: 'Étude de Ana' })).toBeVisible();
  await page.locator('.cta').click();
  await expect(page.getByRole('heading', { name: 'Étudier une position' })).toBeVisible();
  await allume(page, 'Jouer');
  await fleche(page).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Étude de Ana' })).toBeVisible();
  await allume(page, 'Jouer');
  expect(erreurs).toEqual([]);
  await ctx.close();
});

test('7. « Analyser une autre partie » depuis la revue : Jouer reste allumé, « ‹ » rend la revue', async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  const { ctx, page, erreurs } = await telephone(browser, baseURL);
  await page.goto('/');
  await toucherCta(page);
  await expect(plateau(page)).toBeVisible();
  await passer(page);
  await expect(page.getByRole('heading', { level: 2, name: /^(Victoire|Défaite)$/ })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: /^Revoir (ma|la) partie$/ }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Revoir la partie' })).toBeVisible();
  await page.getByRole('button', { name: 'Analyser une autre partie' }).click();
  await expect(page.getByRole('heading', { name: 'Analyser une partie' })).toBeVisible();
  await allume(page, 'Jouer');
  await fleche(page).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Revoir la partie' })).toBeVisible();
  await expect(nav(page)).toHaveCount(0);
  expect(erreurs).toEqual([]);
  await ctx.close();
});

test('8. découverte lancée de Jouer : sa fin ramène à Jouer, pas à Apprendre', async ({ browser, baseURL }) => {
  const dernier = SCENARIO.length - 1;
  const { ctx, page, erreurs } = await telephone(browser, baseURL, { stockage: { 'go.decouverte.v1': JSON.stringify({ etape: dernier, fini: false }) } });
  await page.goto('/');
  await page.getByTestId('modes').waitFor();
  const tuile = page.getByTestId('mode-decouverte');
  if (await tuile.count()) await tuile.click();
  else {
    await page.getByTestId('mode-plus').click();
    await page.getByRole('dialog', { name: 'Autres façons de jouer' }).getByRole('button', { name: /^Partie de découverte avec Mochi/ }).click();
  }
  await expect(page.locator('.decouverte')).toBeVisible();
  await allume(page, 'Jouer');
  await faireMoment(page, dernier);
  await page.getByTestId('fin-decouverte').getByRole('button', { name: 'Continuer' }).click();
  await expect(page.locator('main.app-home .cta').first()).toBeVisible();
  await allume(page, 'Jouer');
  expect(erreurs).toEqual([]);
  await ctx.close();
});

test.describe('9. une leçon ouverte hors d’Apprendre se pose par-dessus et y ramène', () => {
  test('depuis l’accueil (tuile « Leçon ») : Jouer reste allumé, « Retour » rend l’accueil', async ({ browser, baseURL }) => {
    const { ctx, page, erreurs } = await telephone(browser, baseURL);
    await page.goto('/');
    await page.locator('.tuile-lecon').click();
    await expect(plateau(page)).toBeVisible();
    await allume(page, 'Jouer');
    await fleche(page).click();
    await expect(page.locator('main.app-home .tuile-lecon')).toBeVisible();
    // Le focus revient sur la tuile qui a ouvert la leçon.
    await expect(page.locator('.tuile-lecon')).toBeFocused();
    await allume(page, 'Jouer');
    expect(erreurs).toEqual([]);
    await ctx.close();
  });

  test('depuis l’aide d’un problème ouvert : Problèmes reste allumé, le retour rend le même problème', async ({ browser, baseURL }) => {
    const { ctx, page, erreurs } = await telephone(browser, baseURL);
    await page.goto('/');
    await onglet(page, 'Problèmes').click();
    await page.getByRole('button', { name: 'Résoudre le Go du jour' }).click();
    const titre = page.getByRole('heading', { level: 2 }).first();
    const nom = await titre.innerText();
    await page.getByRole('button', { name: /^Aide/ }).first().click();
    await page.locator('dialog.aide[open]').getByRole('button', { name: /^Rejoue la leçon/ }).first().click();
    await expect(page.locator('.lecteur-lecon')).toBeVisible();
    await allume(page, 'Problèmes');
    await retourSysteme(page);
    await expect(page.locator('.lecteur-lecon')).toHaveCount(0);
    await expect(titre).toHaveText(nom);
    await expect(page.getByRole('button', { name: 'Retour aux problèmes' })).toBeVisible();
    await allume(page, 'Problèmes');
    expect(erreurs).toEqual([]);
    await ctx.close();
  });

  test('depuis la fin d’une partie (« Ouvrir la leçon ») : « Retour » rend l’écran de fin', async ({ browser, baseURL }) => {
    const { ctx, page, erreurs } = await telephone(browser, baseURL);
    await page.goto('/');
    await toucherCta(page);
    await expect(plateau(page)).toBeVisible();
    await passer(page);
    await expect(page.getByRole('heading', { level: 2, name: 'Défaite' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Ouvrir la leçon' }).click();
    await expect(page.locator('.lecteur-lecon')).toBeVisible();
    await allume(page, 'Jouer');
    await page.locator('.lecteur-lecon').getByRole('button', { name: 'Retour', exact: true }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Défaite' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ouvrir la leçon' })).toBeVisible();
    expect(erreurs).toEqual([]);
    await ctx.close();
  });
});

test('10. fin de chapitre › « Joue contre Pomme » : la sortie de la partie rend la fin de leçon', async ({ browser, baseURL }) => {
  const { ctx, page, erreurs } = await telephone(browser, baseURL, { stockage: {
    'go.lecons.v1': JSON.stringify({ l1: 6, l2: 6, l3: 8, l4: 5, l5: 5, l6: 6, l7: 5 }), 'go.settings.v1': JSON.stringify({ celebrations: false }) } });
  await page.goto('/');
  await onglet(page, 'Apprendre').click();
  await page.getByRole('button', { name: 'Reprendre la leçon : Compter les points' }).click();
  await page.locator('.choix').getByRole('button', { name: '39', exact: true }).click();
  await page.getByRole('button', { name: 'Terminer la leçon' }).click();
  await expect(page.getByRole('heading', { name: 'Chapitre terminé' })).toBeVisible();
  await page.getByRole('button', { name: 'Joue contre Pomme' }).click();
  await expect(page.locator('main.app-partie')).toBeVisible();
  await expect(nav(page)).toHaveCount(0);
  await retourSysteme(page);
  await expect(page.getByRole('heading', { name: 'Chapitre terminé' })).toBeVisible();
  await allume(page, 'Apprendre');
  expect(erreurs).toEqual([]);
  await ctx.close();
});

test('11. Ta semaine › « Jouer une partie » : la sortie de la partie rend Ta semaine, Profil allumé', async ({ browser, baseURL }) => {
  const { ctx, page, erreurs } = await telephone(browser, baseURL, { stockage: { 'go.parties.v1': JSON.stringify({ n: 0 }) } });
  await page.goto('/');
  await onglet(page, 'Profil').click();
  await page.getByTestId('ligne-semaine').click();
  await page.getByRole('button', { name: 'Jouer une partie' }).click();
  const feuille = page.locator('dialog[data-testid="feuille-lancement"][open]');
  if (await feuille.count()) await feuille.getByTestId('lancement-jouer').click();
  await expect(plateau(page)).toBeVisible();
  await expect(nav(page)).toHaveCount(0);
  await fleche(page).click();
  await expect(page.getByRole('heading', { name: 'Ta semaine' })).toBeVisible();
  await allume(page, 'Profil');
  expect(erreurs).toEqual([]);
  await ctx.close();
});

test('12. « Conditions » depuis « Crée ton compte » : Jouer reste allumé, « ‹ » rend l’écran de compte tel quel', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const { ctx, page, erreurs } = await telephone(browser, baseURL, { serveur });
  await page.goto('/');
  await page.getByTestId('modes').waitFor();
  await page.getByTestId('mode-ami').click();
  const email = page.getByRole('textbox', { name: 'Ton adresse e-mail' });
  await expect(email).toBeVisible();
  await email.fill('alice@exemple.test');
  const caseAge = page.locator('.case-age input[type="checkbox"]');
  await caseAge.check();
  await page.locator('.case-age-conditions').click();
  await expect(page.getByRole('heading', { name: /Conditions/ }).first()).toBeVisible();
  await allume(page, 'Jouer');
  await fleche(page).click();
  // L'écran de compte, tel qu'on l'avait laissé : l'adresse et la case.
  await expect(email).toBeVisible();
  await expect(email).toHaveValue('alice@exemple.test');
  await expect(caseAge).toBeChecked();
  await expect(nav(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Retour', exact: true }).click();
  await expect(page.locator('main.app-home .cta').first()).toBeVisible();
  await allume(page, 'Jouer');
  expect(erreurs).toEqual([]);
  await ctx.close();
});
