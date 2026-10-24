import { gunzipSync } from 'node:zlib';
import { expect, test, type Browser, type Page, type Request } from '@playwright/test';
import { brancher, CODE, fauxServeur, type FauxServeur } from './fauxSupabase';
import { feuilleLancement, jouerDepuisLancement, plateau, toucherCta } from './plateau';

// #695 (décision de Florian, qui révise #432) : l'ordi, avec l'adversaire en cours et sa bulle, reste l'action principale
// tant qu'il y a moins de SEUIL_EN_LIGNE (4) joueurs en ligne ; au seuil, « Jouer en ligne » redevient principal. « En
// ligne » reste toujours une tuile. Le compteur vient de la fonction serveur `joueurs_en_ligne()` ; sans réponse : moins que le seuil.
// Issue #429 : tous les modes de jeu se joignent depuis l'accueil en 1 toucher (bouton principal ou tuile), sans
// défiler (#647 : la partie de découverte vit dans Apprendre, la feuille « Plus » a disparu). #432 : la partie en ligne classée est l'action principale dès le début, cote et grade
// visibles ; seul le tout premier lancement garde l'ordi (« Joue ta première partie »). Chaque choix envoie
// `mode_choisi` { mode, depuis, principal }.
// #487 : avant la toute première pierre posée sur l'appareil, l'accueil n'a que « Joue ta première partie » (tuiles
// cachées, e2e/premier-ecran.spec.ts). Le « premier lancement » de ces parcours a déjà posé une pierre (leçon 1 ouverte,
// pas finie) : c'est l'écran où les tuiles apparaissent pour la première fois.
// #613 : un mode se joint en touchant son bouton ou sa tuile ; l'ordi et à deux s'ouvrent alors sur leur feuille de
// lancement (taille, adversaire, « Jouer »), dès qu'une partie a été jouée, comme « Jouer en ligne » sur son écran.
// Le grade et la cote ont quitté l'accueil pour l'écran de lancement de la partie classée.

/** Seuil de src/app/modes.ts (SEUIL_EN_LIGNE) : l'ordi reste principal en dessous, « Jouer en ligne » le devient au seuil. */
const SEUIL = 4;
const ANA = '00000000-0000-4000-8000-0000000000c1';
const HOTE = 'https://posthog-e2e.test';
type Mode = 'en_ligne' | 'ordi' | 'ami' | 'deux';

/** Premier lancement : aucune partie, aucune leçon finie, mais une première pierre posée (#487). */
const NOUVEAU = { 'go.premiere-pierre.v1': 'true' };
/** Débutant : une partie perdue contre Pomme, aucune leçon. */
const DEBUTANT = { 'go.parties.v1': JSON.stringify({ n: 1, dernier: 'pomme', ordi: 1 }), 'go.bilan.v1': JSON.stringify({ pomme: { v: 0, d: 1 } }) };
/** Confirmé : Pomme battue, trois premières leçons finies, Caillou en cours. */
const CONFIRME = {
  'go.parties.v1': JSON.stringify({ n: 6, dernier: 'caillou', ordi: 6 }), 'go.bilan.v1': JSON.stringify({ pomme: { v: 2, d: 1 }, caillou: { v: 0, d: 2 } }),
  'go.adversaire.v1': JSON.stringify('caillou'), 'go.lecons.v1': JSON.stringify({ l1: 99, l2: 99, l3: 99 }),
};

async function telephone(browser: Browser, baseURL: string | undefined, stockage: Record<string, string>, o: { compte?: boolean; joueurs?: number | null; maintenant?: Date; serveur?: FauxServeur; largeur?: number; hauteur?: number; sombre?: boolean } = {}): Promise<Page> {
  const serveur = o.serveur ?? fauxServeur();
  serveur.fixerJoueursEnLigne(o.joueurs ?? 0);
  const ctx = await browser.newContext({
    viewport: { width: o.largeur ?? 390, height: o.hauteur ?? 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'fr-FR', baseURL,
    colorScheme: o.sombre ? 'dark' : 'light', reducedMotion: 'reduce',
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }, { name: 'go.connait-go.v1', value: '"sait"' }] }] },
  });
  const s = { ...stockage };
  if (o.compte !== false) s['sb-supabase-auth-token'] = JSON.stringify(serveur.sessionCompte('ana@exemple.test', 'Ana', ANA));
  const page = await brancher(ctx, serveur, s);
  if (o.maintenant) await page.clock.setFixedTime(o.maintenant);
  await page.goto('/');
  await expect(page.getByTestId('modes')).toBeVisible();
  return page;
}

/** Vu sans défiler : entièrement entre le haut de l'écran et la barre de navigation. */
async function sansDefiler(page: Page, testId: string) {
  const [b, nav] = await Promise.all([page.getByTestId(testId).boundingBox(), page.getByRole('navigation').boundingBox()]);
  expect(b!.y, `${testId} visible`).toBeGreaterThanOrEqual(0);
  expect(b!.y + b!.height, `${testId} au-dessus de la barre du bas`).toBeLessThanOrEqual(nav!.y + 1);
  expect(b!.height, `${testId} : 44 px`).toBeGreaterThanOrEqual(44);
}

/** Atteint un mode depuis l'accueil et renvoie le nombre de touchers. */
async function atteindre(page: Page, mode: Mode): Promise<number> {
  const principal = page.locator(`.cta[data-mode="${mode}"]`);
  if (await principal.count()) { await principal.click(); return 1; }
  await page.getByTestId(`mode-${mode}`).click();
  return 1;
}

/**
 * Ce que montre chaque mode une fois atteint. #613 : l'ordi et à deux s'ouvrent sur leur feuille de lancement quand une
 * partie a déjà été jouée (`lancement`) ; son seul bouton, « Jouer », lance la partie.
 */
async function arrive(page: Page, mode: Mode, lancement: boolean) {
  if ((mode === 'ordi' || mode === 'deux') && lancement) await jouerDepuisLancement(page);
  if (mode === 'ordi' || mode === 'deux') await expect(plateau(page)).toBeVisible();
  if (mode === 'deux') await expect(page.getByText(/Noir commence/)).toBeVisible();
  if (mode === 'en_ligne') await expect(page.getByTestId('direct-choix')).toBeVisible();
  if (mode === 'ami') await expect(page.getByRole('heading', { level: 2, name: 'Défier un ami' })).toBeVisible();
}

test('chaque mode en 1 toucher depuis l’accueil, sans défiler (premier lancement, débutant, confirmé ; sous le seuil et au seuil)', async ({ browser, baseURL }) => {
  test.setTimeout(240_000);
  for (const [qui, stockage, joueurs, principal] of [
    ['premier lancement après la première pierre', NOUVEAU, 0, 'ordi'], ['premier lancement, du monde en ligne', NOUVEAU, 10, 'ordi'],
    ['débutant, personne en ligne', DEBUTANT, 0, 'ordi'], ['débutant, du monde en ligne', DEBUTANT, SEUIL, 'en_ligne'],
    ['confirmé, personne en ligne', CONFIRME, 0, 'ordi'], ['confirmé, du monde en ligne', CONFIRME, SEUIL, 'en_ligne'],
  ] as const) {
    for (const mode of ['ordi', 'en_ligne', 'ami', 'deux'] as const) {
      const page = await telephone(browser, baseURL, stockage, { joueurs });
      await expect(page.locator('.cta'), qui).toHaveAttribute('data-mode', principal);
      // Rangée des modes : visible sans défiler, sous le bouton principal ; pas de « Défier un ami » en double dans l'en-tête.
      for (const id of ['modes', 'mode-deux']) await sansDefiler(page, id);
      // #647 : ni feuille « Plus » ni partie de découverte sur l'accueil (elle vit dans Apprendre).
      await expect(page.getByTestId('mode-plus')).toHaveCount(0);
      await expect(page.getByTestId('mode-decouverte')).toHaveCount(0);
      await expect(page.locator('header button')).toHaveCount(0);
      const touchers = await atteindre(page, mode);
      expect(touchers, `${qui} : ${mode}`).toBe(1);
      await arrive(page, mode, stockage !== NOUVEAU);
      await page.context().close();
    }
  }
});

test('premier lancement, première pierre posée : « Joue ta première partie » contre Pomme reste l’action principale, « En ligne », « Un ami » et « À deux » juste dessous', async ({ browser, baseURL }) => {
  const page = await telephone(browser, baseURL, NOUVEAU);
  await expect(page.locator('.cta')).toHaveText('Joue ta première partie');
  await expect(page.locator('.cta')).toHaveAttribute('data-mode', 'ordi');
  const tuiles = page.getByTestId('modes').getByRole('button');
  await expect(tuiles).toHaveCount(3);
  // #613 : ni grade ni cote sur l'accueil, même dans le nom accessible : ils attendent le lancement de la partie classée.
  await expect(tuiles.nth(0)).toHaveAccessibleName(/^En ligne\s: Partie classée$/);
  await expect(tuiles.nth(0)).toHaveText('En ligne');
  await expect(tuiles.nth(1)).toHaveAccessibleName('Défier un ami');
  await expect(tuiles.nth(2)).toHaveAccessibleName('Jouer à deux sur ce téléphone');
  await expect(tuiles.nth(2)).toHaveText('À deux');
  // Une seule action principale : les tuiles sont au trait, sans relief.
  await expect(page.locator('.cta')).toHaveCount(1);
  for (let i = 0; i < 3; i++) expect(await tuiles.nth(i).evaluate(b => getComputedStyle(b).boxShadow)).not.toContain('0px 5px 0px');
  // Au premier lancement, « Changer » (sous Pomme) ouvre la feuille de lancement : adversaire et taille seulement.
  await page.getByRole('button', { name: 'Changer' }).click();
  const feuille = page.getByRole('dialog', { name: 'Ton adversaire' });
  await expect(feuille.getByRole('button', { name: /à deux|guidée|humain/i })).toHaveCount(0);
  await page.context().close();
});

for (const [qui, stockage, adversaire] of [['débutant', DEBUTANT, 'Pomme'], ['confirmé', CONFIRME, 'Caillou']] as const) test(`${qui} : au seuil de joueurs en ligne, « Jouer en ligne » en action principale, grade et cote au lancement, l’ordi et l’ami juste à côté`, async ({ browser, baseURL }) => {
  const page = await telephone(browser, baseURL, stockage, { joueurs: SEUIL });
  const cta = page.locator('.cta');
  await expect(cta).toHaveText('Jouer en ligne');
  await expect(cta).toHaveAccessibleName('Jouer en ligne, partie classée');
  // #613 : à l'ouverture, ni grade, ni cote, ni taille, ni niveau.
  // (#695 : le rang de l'adversaire de l'ordi, sous sa bulle, n'est ni le grade ni la cote du joueur.)
  await expect(page.locator('main')).not.toContainText(/1500|9 × 9|XP/);
  await expect(cta).not.toContainText(/kyu/);
  await expect(page.getByTestId('modes')).not.toContainText(/kyu/);
  await expect(page.getByTestId('barre-niveau')).toHaveCount(0);
  // Ils se montrent au lancement de la partie classée, là où ils servent.
  await cta.click();
  const niveau = page.getByTestId('direct-choix').getByTestId('ton-niveau');
  await expect(niveau).toContainText(/15ᵉ\skyu/);
  await expect(niveau.getByTestId('ton-niveau-cote')).toHaveText(/^1500\s\?$/);
  await expect(niveau).toContainText('Joue en direct contre quelqu’un de ton niveau.');
  await expect(niveau.getByText(/^Ta cote provisoire\s: 1500, 15ᵉ\skyu\.$/)).toHaveCount(1);
  await page.getByRole('button', { name: /^Retour/ }).first().click();
  await expect(page.getByTestId('modes')).toBeVisible();
  const ordi = page.getByTestId('mode-ordi');
  await expect(ordi).toHaveText('L’ordi');
  // #592 : le nom de l'adversaire n'est plus écrit sur la tuile ; son sceau la marque, et le lecteur d'écran le lit.
  await expect(ordi).toHaveAccessibleName(new RegExp(adversaire));
  await sansDefiler(page, 'mode-ordi');
  await ordi.click();
  // #613 : la feuille de lancement, avec la taille du dernier choix déjà cochée.
  await expect(feuilleLancement(page).getByRole('button', { name: '9 × 9' })).toHaveAttribute('aria-pressed', 'true');
  await jouerDepuisLancement(page);
  await expect(plateau(page)).toBeVisible();
  await expect(page.getByText(new RegExp(adversaire)).first()).toBeVisible();
  await page.context().close();
});

test('sans compte, dès la première partie : « Jouer en ligne » passe par « Crée ton compte », puis reprend', async ({ browser, baseURL }) => {
  const page = await telephone(browser, baseURL, DEBUTANT, { compte: false, joueurs: SEUIL });
  await expect(page.locator('.cta')).toHaveText('Jouer en ligne');
  await toucherCta(page);
  await expect(page.getByTestId('creer-compte')).toHaveAttribute('data-raison', 'en_ligne');
  // Code par e-mail, pseudo : la partie en ligne reprend d'elle-même (choix de la cadence).
  await page.getByLabel('Ton adresse e-mail').fill('nouveau@exemple.test');
  await page.getByRole('checkbox', { name: /J’ai 15\s+ans ou plus/ }).check();
  await page.getByRole('button', { name: 'Recevoir mon code' }).click();
  await page.getByLabel('Code à 6 chiffres').fill(CODE);
  await page.getByRole('textbox', { name: 'Pseudo' }).fill('Joueur_1');
  await expect(page.getByText('Joueur_1 est libre.')).toBeVisible();
  await page.getByRole('button', { name: 'C’est mon pseudo' }).click();
  await expect(page.getByTestId('direct-choix')).toBeVisible();
  await page.context().close();
});

for (const [qui, stockage, adversaire] of [['débutant', DEBUTANT, 'Pomme'], ['confirmé', CONFIRME, 'Caillou']] as const) test(`${qui} : personne en ligne, le bouton principal lance l’ordi, sa bulle dit l’état du jour, « En ligne » reste une tuile`, async ({ browser, baseURL }) => {
  const page = await telephone(browser, baseURL, stockage, { joueurs: 0 });
  const cta = page.locator('.cta');
  await expect(cta).toHaveAttribute('data-mode', 'ordi');
  await expect(cta).toHaveText(new RegExp(`^(Jouer|Rejouer) contre ${adversaire}$`));
  // L'adversaire et sa bulle sont sous le goban ; la phrase d'état du jour (U2) ne parle ni de partie ni de compte à rebours.
  await expect(page.locator('.adversaire h2')).toHaveText(adversaire);
  await expect(page.locator('.adversaire .scene-bulle')).toHaveText(/^(Nouveau Go du jour\.|Série de \d+ jours?\. Un Go du jour et c’est \d+\.|Fait pour aujourd’hui\. À demain\s!)$/);
  // « En ligne » reste joignable en un toucher, juste dessous, en première tuile.
  const tuiles = page.getByTestId('modes').getByRole('button');
  await expect(tuiles).toHaveCount(3);
  await expect(tuiles.nth(0)).toHaveText('En ligne');
  await sansDefiler(page, 'mode-en_ligne');
  await page.getByTestId('mode-en_ligne').click();
  await expect(page.getByTestId('direct-choix')).toBeVisible();
  await page.getByRole('button', { name: /^Retour/ }).first().click();
  // Le bouton principal lance une partie contre l'ordi (feuille de lancement, puis « Jouer »).
  await toucherCta(page);
  await expect(plateau(page)).toBeVisible();
  await page.context().close();
});

test('le seuil : 3 joueurs en ligne, l’ordi ; 4, « Jouer en ligne » ; la bulle de l’adversaire reste là dans les deux cas', async ({ browser, baseURL }) => {
  for (const [joueurs, principal] of [[SEUIL - 1, 'ordi'], [SEUIL, 'en_ligne']] as const) {
    const page = await telephone(browser, baseURL, DEBUTANT, { joueurs });
    await expect(page.locator('.cta')).toHaveAttribute('data-mode', principal);
    await expect(page.locator('.adversaire .scene-bulle')).toBeVisible();
    // Une seule action principale, et le mode qui n'est pas principal est une tuile.
    await expect(page.locator('.cta')).toHaveCount(1);
    await expect(page.getByTestId(`mode-${principal === 'ordi' ? 'en_ligne' : 'ordi'}`)).toBeVisible();
    await expect(page.getByTestId(`mode-${principal}`)).toHaveCount(0);
    await page.context().close();
  }
});

test('compteur sans réponse (erreur du serveur) : on compte moins que le seuil, l’ordi reste principal', async ({ browser, baseURL }) => {
  const page = await telephone(browser, baseURL, DEBUTANT, { joueurs: null });
  await expect(page.locator('.cta')).toHaveAttribute('data-mode', 'ordi');
  await expect(page.getByTestId('mode-en_ligne')).toBeVisible();
  await page.context().close();
});

test('le compteur ne demande rien de personnel : un appel sans paramètre, une réponse qui est un nombre', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const page = await telephone(browser, baseURL, DEBUTANT, { serveur, joueurs: 7 });
  await expect(page.locator('.cta')).toHaveAttribute('data-mode', 'en_ligne');
  const appels = serveur.appels.filter(a => a.includes('/rpc/joueurs_en_ligne'));
  expect(appels.length).toBeGreaterThan(0);
  for (const a of appels) expect(a).toMatch(/^POST \/rest\/v1\/rpc\/joueurs_en_ligne$/);
  await page.context().close();
});

test('phrase d’état du jour dans la bulle, quel que soit le mode du bouton (U2)', async ({ browser, baseURL }) => {
  // Go du jour n° 7 (03/10/2026) : la série de 6 jours est en jeu.
  const stockage = { ...CONFIRME, 'go.go-du-jour.v1': JSON.stringify({ dernier: 6, jours: 6 }), 'go.visite.v1': JSON.stringify({ jour: 6, absence: 0 }) };
  for (const [joueurs, principal] of [[0, 'ordi'], [SEUIL, 'en_ligne']] as const) {
    const page = await telephone(browser, baseURL, stockage, { joueurs, maintenant: new Date('2026-10-03T08:10:00+02:00') });
    await expect(page.locator('.cta')).toHaveAttribute('data-mode', principal);
    await expect(page.locator('.adversaire .scene-bulle')).toHaveText('Série de 6 jours. Un Go du jour et c’est 7.');
    await page.context().close();
  }
});

for (const [largeur, hauteur] of [[320, 568], [390, 844]] as const) {
  for (const [sombre, joueurs] of [[false, 0], [true, 0], [false, SEUIL], [true, SEUIL]] as const) {
    test(`rangée des modes en ${largeur} × ${hauteur} (${sombre ? 'sombre' : 'clair'}, ${joueurs ? 'du monde en ligne' : 'personne en ligne'}) : sans défilement horizontal, cibles de 44 px, bouton au-dessus de la barre`, async ({ browser, baseURL }) => {
      const page = await telephone(browser, baseURL, CONFIRME, { largeur, hauteur, sombre, joueurs });
      await expect(page.locator('.cta')).toHaveAttribute('data-mode', joueurs ? 'en_ligne' : 'ordi');
      const m = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, vue: innerWidth }));
      expect(m.scroll).toBeLessThanOrEqual(m.vue);
      const [cta, nav] = await Promise.all([page.locator('.cta').boundingBox(), page.getByRole('navigation').boundingBox()]);
      expect(cta!.y + cta!.height).toBeLessThanOrEqual(nav!.y + 1);
      for (const id of [joueurs ? 'mode-ordi' : 'mode-en_ligne', 'mode-ami', 'mode-deux']) await sansDefiler(page, id);
      await page.context().close();
    });
  }
}

/** Corps d'un envoi PostHog (gzip, base64 en formulaire ou JSON brut). */
function lireEnvoi(r: Request): string {
  const brut = r.postDataBuffer();
  if (!brut) return '';
  if (new URL(r.url()).searchParams.get('compression') === 'gzip-js' || (brut[0] === 0x1f && brut[1] === 0x8b)) return gunzipSync(brut).toString('utf8');
  const texte = brut.toString('utf8');
  if (texte.startsWith('data=')) {
    const data = decodeURIComponent(texte.slice(5).split('&')[0].replace(/\+/g, ' '));
    try { return Buffer.from(data, 'base64').toString('utf8'); } catch { return data; }
  }
  return texte;
}

test.describe('mesure', () => {
  // posthog-js jette les événements des navigateurs pilotés : on se présente comme un navigateur ordinaire.
  test.use({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });

  test('« À deux » envoie mode_choisi { mode: deux, depuis: tuile }', async ({ page }) => {
    const envois: string[] = [];
    await page.route(`${HOTE}/**`, async route => {
      const r = route.request();
      if (r.method() === 'POST') envois.push(lireEnvoi(r));
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":1}' });
    });
    await page.addInitScript(hote => {
      localStorage.setItem('e2e.posthog.hote', hote);
      Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false });
      Object.defineProperty(Navigator.prototype, 'userAgentData', { get: () => undefined });
    }, HOTE);
    // #487 : une pierre déjà posée (sinon l'accueil n'a que le bouton principal).
    await page.addInitScript(() => localStorage.setItem('go.premiere-pierre.v1', 'true'));
    await page.goto('/');
    // Sans comptes dans ce build : « À deux » est une tuile, en un toucher.
    await page.getByTestId('mode-deux').click();
    await expect(plateau(page)).toBeVisible();
    await expect.poll(() => envois.join('\n'), { timeout: 15_000 }).toContain('mode_choisi');
    const tout = envois.join('\n');
    expect(tout).toMatch(/"event":"mode_choisi"/);
    expect(tout).toMatch(/"mode":"deux"/);
    expect(tout).toMatch(/"depuis":"tuile"/);
  });
});
