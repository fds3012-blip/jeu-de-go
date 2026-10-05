import { readFileSync } from 'node:fs';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { brancher, fauxServeur } from './fauxSupabase';
import { jouer, plateau } from './plateau';
import { demarrerParcours, ouvrirRevue, preparerRevue } from './revueFactice';

// Joueur de club (décision de Florian du 05/10) :
// #365 réglages du plateau et du rythme (coordonnées, dernier coup, numéros en revue, temps de jeu, série masquée) ;
// #368 « Mes statistiques » (cote sur 90 jours, précision moyenne, erreurs par phase, bilan par taille et par mode) ;
// #372 « Étudier une position » (goban libre, variante, analyse KataGo à la demande, export SGF).

const CAPTURES = process.env.CAPTURES_CLUB; // ex. un dossier temporaire : captures légères (jpeg)
const capture = async (page: Page, nom: string) => {
  if (CAPTURES) await page.screenshot({ path: `${CAPTURES}/${nom}.jpg`, type: 'jpeg', quality: 60 });
};
const nav = (page: Page, nom: string) => page.getByRole('navigation').getByRole('button', { name: nom }).click();

async function ouvrirReglages(page: Page) {
  await nav(page, 'Profil');
  await page.getByRole('button', { name: /^Réglages/ }).click();
  await expect(page.getByRole('heading', { name: 'Réglages' })).toBeVisible();
}

async function ouvrirEtude(page: Page) {
  await nav(page, 'Profil');
  await page.getByRole('button', { name: /^Mes parties/ }).click();
  await page.getByTestId('lien-etude').click();
  await expect(page.getByRole('heading', { name: 'Étudier une position' })).toBeVisible();
}

/** Un KataGo factice qui conseille toujours D5, F4 et un coup de première ligne (filtré), avec Noir +2,5. */
async function kataGoEtude(page: Page) {
  await page.addInitScript(() => {
    const i = (s: string) => (s.charCodeAt(1) - 97) * 9 + (s.charCodeAt(0) - 97);
    (window as unknown as { __kataGoFactice: unknown }).__kataGoFactice = {
      info: { state: 'pret' },
      async analyze(pos: { toPlay: 1 | 2 }) {
        await new Promise(r => setTimeout(r, 40));
        const s = pos.toPlay === 1 ? 1 : -1;
        return {
          winrate: 0.6, lead: s * 2.5, ownership: new Float32Array(81), visits: 96, ms: 1, engine: 'factice',
          moves: [
            { move: i('de'), visits: 50, winrate: 0.64, lead: 3, prior: 0.3, scoreLoss: 0 },
            { move: i('af'), visits: 30, winrate: 0.6, lead: 2.6, prior: 0.2, scoreLoss: 0.4 }, // première ligne : filtré
            { move: i('ff'), visits: 20, winrate: 0.58, lead: 2.2, prior: 0.1, scoreLoss: 0.8 },
          ],
        };
      },
    };
  });
}

test.describe('#365 réglages du plateau et du rythme', () => {
  test('aperçu en tête, coordonnées, numéros, temps de jeu et série : chaque changement se voit et se garde', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await ouvrirReglages(page);
    const apercu = page.getByTestId('reglages-apercu');
    await expect(apercu).toBeVisible();
    await expect(apercu.locator('.coord')).toHaveCount(1);
    await expect(apercu.locator('[data-dernier]')).toHaveCount(1);
    await expect(apercu.locator('[data-numero]')).toHaveCount(0);
    await capture(page, 'reglages-apercu');

    for (const nom of [/^Coordonnées/, /^Dernier coup marqué/, /^Numéros des coups/, /^Montrer la série/]) {
      const s = page.getByRole('switch', { name: nom });
      await expect(s).toBeVisible();
      expect((await s.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole('switch', { name: /^Coordonnées/ }).click();
    await expect(apercu.locator('.coord')).toHaveCount(0);
    await page.getByRole('switch', { name: /^Numéros des coups/ }).click();
    await expect(apercu.locator('[data-numero]')).toHaveCount(6);
    await page.getByRole('switch', { name: /^Dernier coup marqué/ }).click();
    await expect(apercu.locator('[data-dernier]')).toHaveCount(0);

    const cadence = page.getByRole('group', { name: 'Temps de jeu en ligne' });
    const lente = cadence.getByRole('button', { name: /^20 minutes chacun/ });
    expect((await lente.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await lente.click();
    await expect(lente).toHaveAttribute('aria-pressed', 'true');

    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('go.settings.v1')!))).toMatchObject({
      coordonnees: false, numerosRevue: true, dernierCoup: false, cadence: 'lente',
    });
    // Un seul écran qui défile, jamais de côté.
    const { largeur } = await page.evaluate(() => ({ largeur: document.documentElement.scrollWidth }));
    expect(largeur).toBeLessThanOrEqual(390);
  });

  for (const taille of [9, 19] as const) {
    test(`coordonnées : « D4 » lu au bon endroit en ${taille} × ${taille}, à l’écran et au lecteur d’écran`, async ({ page }) => {
      await page.goto('/');
      await ouvrirEtude(page);
      if (taille === 19) await page.getByRole('button', { name: '19 × 19' }).click();
      const svg = plateau(page, taille);
      const lettre = svg.locator('.coord text', { hasText: /^D$/ });
      const ligne = svg.locator('.coord text', { hasText: /^4$/ });
      const bl = (await lettre.boundingBox())!, bn = (await ligne.boundingBox())!;
      await page.mouse.click(bl.x + bl.width / 2, bn.y + bn.height / 2);
      await expect(svg.locator('[data-point="D4"][data-pierre="noir"]')).toHaveCount(1);
      // Lecteur d'écran : la case de la grille porte son nom, « D4 », et dit la pierre.
      await expect(page.getByRole('gridcell', { name: /^D4\b.*noire/ })).toHaveCount(1);
    });
  }

  test('série masquée : ni flamme, ni record, ni badge de série, ni « Garde ta série » ; la série continue', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.clock.setFixedTime(new Date('2026-10-03T08:10:00+02:00'));
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('go.go-du-jour.v1', JSON.stringify({ dernier: 6, jours: 6 }));
      localStorage.setItem('go.parties.v1', JSON.stringify({ n: 2, dernier: 'pomme' }));
      localStorage.setItem('go.visite.v1', JSON.stringify({ jour: 6, absence: 0 }));
      localStorage.setItem('go.serie-record.v1', JSON.stringify({ record: 9, perdue: null }));
    });
    await page.reload();
    await expect(page.getByTestId('flamme')).toBeVisible();

    await ouvrirReglages(page);
    await page.getByRole('switch', { name: /^Montrer la série/ }).click();
    await page.getByRole('button', { name: 'Retour' }).click();
    await expect(page.getByRole('heading', { name: 'Ton parcours' })).toBeVisible();
    await expect(page.locator('.identite-serie')).toHaveCount(0);
    await expect(page.getByRole('list', { name: 'Tes statistiques' })).not.toContainText(/série|record/);
    await expect(page.getByRole('button', { name: /7 jours de série/ })).toHaveCount(0);

    await nav(page, 'Jouer');
    await expect(page.getByTestId('flamme')).toHaveCount(0);
    await expect(page.getByText(/Garde ta série/)).toHaveCount(0);
    await expect(page.getByText(/jours? de série/)).toHaveCount(0);
    await capture(page, 'serie-masquee');
    // Le calcul n'a pas bougé.
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('go.go-du-jour.v1')!))).toMatchObject({ jours: 6 });
  });
});

test.describe('#365 et #368 : la revue', () => {
  test('numéros des coups en revue, puis la revue nourrit « Mes statistiques »', async ({ page }) => {
    test.setTimeout(150_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await preparerRevue(page);
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('reglages-semes')) {
        sessionStorage.setItem('reglages-semes', '1');
        localStorage.setItem('go.settings.v1', JSON.stringify({ numerosRevue: true }));
      }
    });
    await ouvrirRevue(page);
    await demarrerParcours(page, 5);
    const svg = plateau(page);
    await expect(svg.locator('[data-numero]')).toHaveCount(5);
    await expect(svg.locator('[data-numero="5"]')).toHaveCount(1);
    await capture(page, 'revue-numeros');

    await page.goto('/');
    await nav(page, 'Profil');
    await page.getByTestId('ligne-stats').click();
    await expect(page.getByRole('heading', { name: 'Mes statistiques' })).toBeVisible();
    await expect(page.getByTestId('stats-precision')).toHaveText(/^\d{1,3}\s%$/);
    await expect(page.getByText('Sur ta dernière partie revue avec KataGo.')).toBeVisible();
    await expect(page.locator('.mstats-phases li')).toHaveCount(3);
  });
});

test.describe('#368 Mes statistiques', () => {
  async function telephone(browser: Browser, baseURL: string | undefined, sombre: boolean, largeur = 390) {
    const serveur = fauxServeur();
    const MOI = '00000000-0000-4000-8000-0000000000a1';
    const session = serveur.sessionCompte('moi@exemple.test', 'Florian', MOI);
    serveur.profiles.find(p => p.id === MOI)!.rating = 1520;
    serveur.profiles.find(p => p.id === MOI)!.cote_provisoire = false;
    const jour = (n: number) => new Date(Date.now() - n * 864e5).toISOString();
    serveur.games.push({ id: 'g1', size: 9, black_id: MOI, white_id: 'x' }, { id: 'g2', size: 13, black_id: 'x', white_id: MOI });
    serveur.ratingHistory.push(
      { user_id: MOI, kind: 'depart', rating: 1500, ecart: null, game_id: null, created_at: jour(20) },
      { user_id: MOI, kind: 'game', rating: 1488, ecart: -12, game_id: 'g1', created_at: jour(10) },
      { user_id: MOI, kind: 'puzzle', rating: 2400, ecart: null, game_id: null, created_at: jour(5) },
      { user_id: MOI, kind: 'game', rating: 1520, ecart: 32, game_id: 'g2', created_at: jour(2) },
    );
    const ctx = await browser.newContext({
      viewport: { width: largeur, height: largeur === 320 ? 568 : 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', baseURL,
      colorScheme: sombre ? 'dark' : 'light', reducedMotion: 'reduce',
      storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }] }] },
    });
    const d = new Date().toISOString();
    const page = await brancher(ctx, serveur, {
      'sb-supabase-auth-token': JSON.stringify(session),
      'go.stats.revues.v1': JSON.stringify([{ cle: 'a', date: d, taille: 9, precision: 78, erreurs: [0, 3, 1] }, { cle: 'b', date: d, taille: 9, precision: 84, erreurs: [1, 2, 0] }]),
      'go.historique.v1': JSON.stringify([
        { id: '2026-10-04T10:00:00.000Z', date: '2026-10-04T10:00:00.000Z', sgf: '(;SZ[9];B[ee])', mode: 'ordi', taille: 9, joueur: 1, adversaire: 'pomme', resultat: 'B+5.5' },
        { id: '2026-10-03T10:00:00.000Z', date: '2026-10-03T10:00:00.000Z', sgf: '(;SZ[13];B[gg])', mode: 'ordi', taille: 13, joueur: 1, adversaire: 'riviere', resultat: 'W+R' },
      ]),
    });
    return { ctx, page };
  }

  for (const sombre of [false, true]) {
    test(`cote sur 90 jours, précision, erreurs par phase et bilan (${sombre ? 'sombre' : 'clair'})`, async ({ browser, baseURL }) => {
      const { ctx, page } = await telephone(browser, baseURL, sombre);
      await page.goto('/');
      await nav(page, 'Profil');
      const ligne = page.getByTestId('ligne-stats');
      expect((await ligne.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      // Le Profil tient toujours sans défiler.
      expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(844);
      await ligne.click();
      await expect(page.getByRole('heading', { name: 'Mes statistiques' })).toBeVisible();
      // Mochi : la phase où tu te trompes le plus, en une phrase.
      await expect(page.locator('.mstats-bulle')).toHaveText(/surtout en milieu de partie/);
      await expect(page.getByTestId('stats-cote')).toContainText('1520');
      await expect(page.getByTestId('stats-courbe')).toHaveAccessibleName('Ta cote sur 90 jours : de 1500 à 1520, entre 1488 et 1520.');
      await expect(page.getByTestId('stats-precision')).toHaveText(/^81\s%$/);
      await expect(page.locator('[data-phase="milieu"]')).toHaveAccessibleName('Milieu de partie : 2,5 erreurs par partie');
      const modes = page.getByTestId('stats-modes');
      await expect(modes.locator('[data-ligne="ordi"]')).toContainText(/Contre l’IA\s*1\s*1\s*50\s%/);
      await expect(modes.locator('[data-ligne="enLigne"]')).toContainText(/En ligne, classées\s*1\s*1\s*50\s%/);
      await expect(page.getByTestId('stats-tailles').locator('[data-ligne="13"]')).toContainText(/13 × 13\s*1\s*1/);
      // Décision #137 : rien sur les problèmes (la cote de problème à 2400 n'est jamais lue).
      await expect(page.getByTestId('stats')).not.toContainText(/problème|2400/);
      await expect(page.locator('.cta')).toHaveCount(1);
      await expect(page.locator('.cta')).toHaveText('Revoir une partie');
      const { largeur } = await page.evaluate(() => ({ largeur: document.documentElement.scrollWidth }));
      expect(largeur).toBeLessThanOrEqual(390);
      await capture(page, `stats-${sombre ? 'sombre' : 'clair'}`);
      await page.locator('.cta').click();
      await expect(page.getByRole('heading', { name: 'Mes parties' })).toBeVisible();
      await ctx.close();
    });
  }

  test('320 px et hors ligne : l’appareil seulement, sans défilement de côté', async ({ browser, baseURL }) => {
    const { ctx, page } = await telephone(browser, baseURL, false, 320);
    await page.goto('/');
    await nav(page, 'Profil');
    // L'écran a déjà été ouvert en ligne (son morceau est chargé ; en vrai, le service worker le garde aussi).
    await page.getByTestId('ligne-stats').click();
    await expect(page.getByTestId('stats-cote')).toContainText('1520');
    await page.getByRole('button', { name: 'Retour' }).click();
    await ctx.setOffline(true);
    await page.getByTestId('ligne-stats').click();
    await expect(page.getByText(/^Hors ligne\s: seules les parties de ce téléphone comptent\.$/)).toBeVisible();
    await expect(page.getByTestId('stats-precision')).toHaveText(/^81\s%$/);
    const { largeur } = await page.evaluate(() => ({ largeur: document.documentElement.scrollWidth }));
    expect(largeur).toBeLessThanOrEqual(320);
    await ctx.setOffline(false);
    await ctx.close();
  });
});

test.describe('#372 Étudier une position', () => {
  test('poser 5 pierres, analyser, jouer une variante et revenir : la position de départ est intacte', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await kataGoEtude(page);
    await page.goto('/');
    await ouvrirEtude(page);
    const svg = plateau(page);
    const outils = page.getByRole('group', { name: 'Outil' });
    for (const b of await outils.getByRole('button').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    for (const l of ['C3', 'G7', 'C7']) await jouer(page, l);
    await outils.getByRole('button', { name: 'Blanc' }).click();
    for (const l of ['G3', 'E5']) await jouer(page, l);
    await expect(svg.locator('[data-pierre]')).toHaveCount(5);

    await expect(page.locator('.cta')).toHaveCount(1);
    await page.getByRole('button', { name: 'Analyser' }).click();
    const resultat = page.getByTestId('etude-resultat');
    await expect(resultat).toContainText('Noir mène de 2,5 points.');
    // Trois conseils au plus, jamais sur la première ligne d'une position encore vide.
    const candidats = page.getByTestId('etude-candidats').locator('[data-candidat]');
    await expect(candidats).toHaveCount(2);
    await expect(page.getByTestId('etude-candidats').locator('[data-candidat="A4"]')).toHaveCount(0);
    await expect(resultat).toContainText('D5 : 64 % de chances de gagner');
    await capture(page, 'etude-analyse');

    await outils.getByRole('button', { name: 'Jouer' }).click();
    await jouer(page, 'D5');
    await jouer(page, 'F4');
    await expect(svg.locator('[data-numero]')).toHaveCount(2);
    // 390 × 844 : Annuler et Revenir se touchent sans défiler, au-dessus du goban et du bouton « Analyser ».
    await page.evaluate(() => window.scrollTo(0, 0));
    const cta = (await page.locator('.cta').boundingBox())!;
    for (const nom of ['Annuler', 'Revenir']) {
      const b = (await page.getByRole('button', { name: nom, exact: true }).boundingBox())!;
      expect(b.height).toBeGreaterThanOrEqual(44);
      expect(b.y + b.height, nom).toBeLessThanOrEqual(cta.y);
    }
    const plateauBas = (await svg.boundingBox())!;
    expect(plateauBas.y + plateauBas.height, 'goban entier au-dessus d’« Analyser »').toBeLessThanOrEqual(cta.y + 2);
    // La position a changé : les conseils d'avant disparaissent.
    await expect(page.getByTestId('etude-candidats')).toHaveCount(0);
    await page.getByRole('button', { name: 'Revenir' }).click();
    await expect(svg.locator('[data-pierre]')).toHaveCount(5);
    await expect(svg.locator('[data-numero]')).toHaveCount(0);
    for (const [l, c] of [['C3', 'noir'], ['G7', 'noir'], ['C7', 'noir'], ['G3', 'blanc'], ['E5', 'blanc']]) {
      await expect(svg.locator(`[data-point="${l}"][data-pierre="${c}"]`)).toHaveCount(1);
    }

    // Export SGF, relisible par l'import (AB, AW, PL).
    const [telechargement] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exporter en SGF' }).click()]);
    const sgf = readFileSync(await telechargement.path(), 'utf8');
    expect(sgf).toMatch(/^\(;GM\[1\]FF\[4\].*SZ\[9\]/);
    expect(sgf).toContain('AB[');
    expect(sgf).toContain('AW[');
    // L'étude est gardée sur l'appareil.
    await page.reload();
    await ouvrirEtude(page);
    await expect(plateau(page).locator('[data-pierre]')).toHaveCount(5);
  });

  test('sans KataGo en cache : l’écran propose le téléchargement et n’affiche aucun conseil', async ({ page }) => {
    await page.goto('/');
    await ouvrirEtude(page);
    await jouer(page, 'E5');
    await page.getByRole('button', { name: 'Analyser' }).click();
    await expect(page.getByTestId('etude-sans-katago')).toContainText('Télécharge l’IA pour analyser');
    await expect(page.getByRole('button', { name: 'Télécharger l’IA' })).toBeVisible();
    await expect(page.getByTestId('etude-candidats')).toHaveCount(0);
    await expect(page.getByTestId('etude-resultat')).toHaveCount(0);
  });
});
