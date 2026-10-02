import { expect, test, type Page } from '@playwright/test';
import { abandonner, jouer, passerJusquAuScore, plateau } from './plateau';
import { brancher, fauxServeur, JETON, PARTIE } from './fauxSupabase';

// Issue #358 : « Mes parties ». Chaque partie terminée est gardée sur l'appareil ; le Profil les liste, la plus
// récente d'abord, avec l'adversaire, le résultat en mots, la date et la taille du plateau ; un toucher ouvre la revue.

// Capture de la liste : seulement si CAPTURES_358 est posée (les captures du dépôt ne changent pas à chaque parcours).
const CAPTURES = process.env.CAPTURES_358;

async function ouvrirMesParties(page: Page) {
  await page.getByRole('navigation').getByRole('button', { name: 'Profil' }).click();
  await page.getByRole('button', { name: /^Mes parties/ }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Mes parties' })).toBeVisible();
}

/** Partie courte contre Pomme : un coup, la réponse de Pomme, puis abandon. */
async function partieAbandonnee(page: Page) {
  await page.getByRole('navigation').getByRole('button', { name: 'Jouer' }).click();
  await page.locator('.cta').click();
  await expect(plateau(page)).toBeVisible();
  const passer = page.getByRole('button', { name: 'Passer' });
  await expect(passer).toBeEnabled({ timeout: 10_000 });
  await jouer(page, 'E5');
  await expect(passer).toBeEnabled({ timeout: 10_000 });
  await abandonner(page);
  await expect(page.getByRole('heading', { level: 2, name: 'Défaite' })).toBeVisible();
  await page.getByRole('button', { name: 'Accueil', exact: true }).click();
}

test('état vide : Mochi accueille, une seule action lance la première partie', async ({ page }) => {
  await page.goto('/');
  await ouvrirMesParties(page);
  await expect(page.getByRole('heading', { level: 3, name: 'Tes parties arriveront ici' })).toBeVisible();
  await expect(page.locator('.cta')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Joue ta première partie' }).click();
  await expect(plateau(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Passer' })).toBeVisible();
});

test('trois parties contre l’ordi : toutes dans « Mes parties », avec le bon résultat, et chacune ouvre la revue', async ({ page }) => {
  test.setTimeout(120_000);
  const erreurs: string[] = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await page.goto('/');
  await partieAbandonnee(page);
  await partieAbandonnee(page);

  // Troisième partie gagnée aux points (`?komi=-100`, paramètre de test : Noir gagne en passant).
  await page.goto('/?komi=-100');
  await page.locator('.cta').click();
  await expect(plateau(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Passer' })).toBeEnabled({ timeout: 10_000 });
  await jouer(page, 'E5');
  await passerJusquAuScore(page);
  await expect(page.getByRole('heading', { level: 2, name: 'Victoire' })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Accueil', exact: true }).click();

  // Le Profil annonce les 3 parties.
  await page.getByRole('navigation').getByRole('button', { name: 'Profil' }).click();
  await expect(page.getByRole('button', { name: /^Mes parties/ })).toContainText('3 parties');
  await page.getByRole('button', { name: /^Mes parties/ }).click();

  const lignes = page.locator('.mp-parties > li > button');
  await expect(lignes).toHaveCount(3);
  // La plus récente d'abord : la victoire, puis les deux abandons.
  await expect(lignes.nth(0)).toHaveAccessibleName(/^Pomme\. Tu as gagné de [\d,]+ points?\. Aujourd’hui, plateau 9 × 9\.$/);
  await expect(lignes.nth(1)).toHaveAccessibleName('Pomme. Tu as abandonné. Aujourd’hui, plateau 9 × 9.');
  await expect(lignes.nth(2)).toHaveAccessibleName('Pomme. Tu as abandonné. Aujourd’hui, plateau 9 × 9.');
  await expect(page.locator('.mp-partie-sceau[data-issue="victoire"]')).toHaveCount(1);
  await expect(page.locator('.mp-partie-sceau[data-issue="defaite"]')).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  if (CAPTURES) await page.screenshot({ path: `${CAPTURES}/liste-390-clair.jpeg`, type: 'jpeg', quality: 80 });

  // Chaque partie ouvre la revue, coup par coup, puis « ‹ » ramène à la liste.
  for (let i = 0; i < 3; i++) {
    await lignes.nth(i).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Revoir ma partie' })).toBeVisible();
    await expect(page.getByText(/Coup 1 sur \d+/)).toBeVisible();
    await expect(plateau(page).locator('g[data-point="E5"][data-pierre="noir"]')).toHaveCount(1);
    // Pas de « Rejouer d'ici » depuis l'historique (l'écran de partie ne reprend pas encore une partie gardée).
    await expect(page.getByRole('button', { name: "Rejouer d'ici" })).toHaveCount(0);
    await page.getByRole('button', { name: 'Retour à mes parties' }).click();
    await expect(lignes).toHaveCount(3);
  }
  expect(erreurs).toEqual([]);
});

test('la dernière partie gardée par une version d’avant #358 (à deux) apparaît dans la liste', async ({ page }) => {
  // Seule la dernière partie de la revue (`go.revue.v1`, avant #358) : elle apparaît dans la liste.
  await page.addInitScript(() => {
    if (sessionStorage.getItem('semee')) return;
    sessionStorage.setItem('semee', '1');
    localStorage.setItem('go.revue.v1', JSON.stringify({
      sgf: '(;GM[1]FF[4]CA[UTF-8]SZ[9]KM[6.5]RU[Japanese]PB[Noir]PW[Blanc]RE[W+3.5];B[ee];W[cc];B[gg])',
      date: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    }));
  });
  await page.goto('/');
  await ouvrirMesParties(page);
  const ligne = page.locator('.mp-parties > li > button');
  await expect(ligne).toHaveCount(1);
  await expect(ligne).toHaveAccessibleName('Partie à deux. Blanc gagne de 3,5 points. Il y a 2 jours, plateau 9 × 9.');
  await ligne.click();
  await expect(page.getByRole('heading', { level: 2, name: 'Revoir ma partie' })).toBeVisible();
  await expect(page.getByText(/Coup 1 sur 3/)).toBeVisible();
});

test('un défi par lien terminé, lu sur le serveur, rejoint la liste et ouvre la revue avec le bon camp', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  // Ancienne session de défi : le joueur a Blanc ; son ami (Noir) a abandonné hier.
  const session = serveur.sessionAnonyme();
  const hier = new Date(Date.now() - 864e5).toISOString();
  serveur.games.push({ id: PARTIE, white_id: session.user.id, black_id: 'ami', created_by: session.user.id, size: 9, komi: 6.5, rules: 'japanese', handicap: 0,
    moves: 'eeffgg', status: 'finished', counting: false, dead_stones: null, dead_proposed_by: null, result: 'W+R', resumed_at: 0, prive: true, rated: false, updated_at: hier });
  serveur.defis.push({ partie_id: PARTIE, jeton: JETON, createur_id: session.user.id, invite_id: 'ami', delai_coup: '3 days',
    date_limite: null, lien_expire_le: hier, cree_le: hier });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', baseURL,
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }] }] },
  });
  const page = await brancher(ctx, serveur, { 'sb-supabase-auth-token': JSON.stringify(session) });
  await page.goto('/');
  await ouvrirMesParties(page);
  const ligne = page.locator('.mp-parties > li > button');
  await expect(ligne).toHaveCount(1);
  await expect(ligne).toHaveAccessibleName('Ton ami. Tu as gagné par abandon. Hier, plateau 9 × 9.');
  await ligne.click();
  await expect(page.getByRole('heading', { level: 2, name: 'Revoir ma partie' })).toBeVisible();
  await expect(page.getByText(/Coup 1 sur 3/)).toBeVisible();
  // Le joueur a Blanc : le premier coup est celui de son ami.
  await expect(page.locator('.revue-mochi p')).toHaveText(/^Ton ami joue E5\./);
  await ctx.close();
});
