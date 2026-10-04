import { gunzipSync } from 'node:zlib';
import { expect, test, type Browser, type Page, type Request } from '@playwright/test';
import { brancher, fauxServeur, type FauxServeur } from './fauxSupabase';
import { plateau } from './plateau';

// Issue #429 : tous les modes de jeu se joignent depuis l'accueil en 1 toucher (bouton principal ou tuile), ou en 2
// par « Plus », sans défiler. Le débutant garde l'ordi en action principale ; ensuite, la partie en ligne classée,
// cote et grade visibles. Chaque choix envoie `mode_choisi` { mode, depuis, principal }.

const ANA = '00000000-0000-4000-8000-0000000000c1';
const HOTE = 'https://posthog-e2e.test';
type Mode = 'en_ligne' | 'ordi' | 'ami' | 'deux' | 'guidee';

/** Débutant : une partie perdue contre Pomme, aucune leçon. */
const DEBUTANT = { 'go.parties.v1': JSON.stringify({ n: 1, dernier: 'pomme', ordi: 1 }), 'go.bilan.v1': JSON.stringify({ pomme: { v: 0, d: 1 } }) };
/** Confirmé : Pomme battue, trois premières leçons finies, Caillou en cours. */
const CONFIRME = {
  'go.parties.v1': JSON.stringify({ n: 6, dernier: 'caillou', ordi: 6 }), 'go.bilan.v1': JSON.stringify({ pomme: { v: 2, d: 1 }, caillou: { v: 0, d: 2 } }),
  'go.adversaire.v1': JSON.stringify('caillou'), 'go.lecons.v1': JSON.stringify({ l1: 99, l2: 99, l3: 99 }),
};

async function telephone(browser: Browser, baseURL: string | undefined, stockage: Record<string, string>, o: { compte?: boolean; serveur?: FauxServeur; largeur?: number; hauteur?: number; sombre?: boolean } = {}): Promise<Page> {
  const serveur = o.serveur ?? fauxServeur();
  const ctx = await browser.newContext({
    viewport: { width: o.largeur ?? 390, height: o.hauteur ?? 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'fr-FR', baseURL,
    colorScheme: o.sombre ? 'dark' : 'light', reducedMotion: 'reduce',
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }] }] },
  });
  const s = { ...stockage };
  if (o.compte !== false) s['sb-supabase-auth-token'] = JSON.stringify(serveur.sessionCompte('ana@exemple.test', 'Ana', ANA));
  const page = await brancher(ctx, serveur, s);
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
  const tuile = page.getByTestId(`mode-${mode}`);
  if (await tuile.count()) { await tuile.click(); return 1; }
  await page.getByTestId('mode-plus').click();
  const nom = mode === 'deux' ? /^Jouer à deux sur ce téléphone/ : /^Partie guidée contre Mochi/;
  await page.getByRole('dialog', { name: 'Autres façons de jouer' }).getByRole('button', { name: nom }).click();
  return 2;
}

/** Ce que montre chaque mode une fois atteint. */
async function arrive(page: Page, mode: Mode) {
  if (mode === 'ordi' || mode === 'deux' || mode === 'guidee') await expect(plateau(page)).toBeVisible();
  if (mode === 'guidee') await expect(page.getByText(/^Partie guidée : Mochi règle sa force/)).toBeVisible();
  if (mode === 'deux') await expect(page.getByText(/Noir commence/)).toBeVisible();
  if (mode === 'en_ligne') await expect(page.getByTestId('direct-choix')).toBeVisible();
  if (mode === 'ami') await expect(page.locator('header')).toContainText('Défier un ami');
}

test('chaque mode en 1 ou 2 touchers depuis l’accueil, sans défiler (débutant, puis confirmé)', async ({ browser, baseURL }) => {
  test.setTimeout(90_000);
  for (const [qui, stockage, principal] of [['débutant', DEBUTANT, 'ordi'], ['confirmé', CONFIRME, 'en_ligne']] as const) {
    for (const mode of ['ordi', 'en_ligne', 'ami', 'deux', 'guidee'] as const) {
      const page = await telephone(browser, baseURL, stockage);
      await expect(page.locator('.cta'), qui).toHaveAttribute('data-mode', principal);
      // Rangée des modes : visible sans défiler, sous le bouton principal ; pas de « Défier un ami » en double dans l'en-tête.
      for (const id of ['modes', 'mode-plus']) await sansDefiler(page, id);
      await expect(page.locator('header button')).toHaveCount(0);
      const touchers = await atteindre(page, mode);
      expect(touchers, `${qui} : ${mode}`).toBeLessThanOrEqual(mode === 'deux' || mode === 'guidee' ? 2 : 1);
      await arrive(page, mode);
      await page.context().close();
    }
  }
});

test('débutant : l’ordi en action principale, « En ligne » et « Un ami » juste dessous, « Plus » pour le reste', async ({ browser, baseURL }) => {
  const page = await telephone(browser, baseURL, DEBUTANT);
  await expect(page.locator('.cta')).toHaveText('Rejouer contre Pomme');
  const tuiles = page.getByTestId('modes').getByRole('button');
  await expect(tuiles).toHaveCount(3);
  await expect(tuiles.nth(0)).toHaveAccessibleName(/^En ligne\s: Partie classée, 15ᵉ\skyu · 1500\s\?$/);
  await expect(tuiles.nth(0)).toContainText(/15ᵉ\skyu · 1500\s\?/);
  await expect(tuiles.nth(1)).toHaveAccessibleName('Défier un ami');
  await expect(tuiles.nth(2)).toHaveAccessibleName(/^Plus de façons de jouer/);
  await expect(tuiles.nth(2)).toHaveAttribute('aria-haspopup', 'dialog');
  // Une seule action principale : les tuiles sont au trait, sans relief.
  await expect(page.locator('.cta')).toHaveCount(1);
  for (let i = 0; i < 3; i++) expect(await tuiles.nth(i).evaluate(b => getComputedStyle(b).boxShadow)).not.toContain('0px 5px 0px');
  // « Changer » ne sert plus qu'à l'adversaire et à la taille.
  await page.getByRole('button', { name: 'Changer' }).click();
  const feuille = page.getByRole('dialog', { name: 'Ton adversaire' });
  await expect(feuille.getByRole('button', { name: /à deux|guidée|humain/i })).toHaveCount(0);
  await page.context().close();
});

test('confirmé : « Jouer en ligne » en action principale, grade et cote visibles, l’ordi et l’ami juste à côté', async ({ browser, baseURL }) => {
  const page = await telephone(browser, baseURL, CONFIRME);
  const cta = page.locator('.cta');
  await expect(cta).toHaveText('Jouer en ligne');
  await expect(cta).toHaveAccessibleName('Jouer en ligne, partie classée');
  const classee = page.getByTestId('classee');
  await expect(classee.getByRole('heading', { level: 2 })).toHaveText(/^15ᵉ\skyu$/);
  await expect(classee.getByTestId('classee-cote')).toHaveText(/^1500\s\?$/);
  await expect(classee).toContainText('Ta cote bouge à chaque partie.');
  const ordi = page.getByTestId('mode-ordi');
  await expect(ordi).toContainText('Contre l’ordi');
  await expect(ordi).toContainText('Caillou');
  await sansDefiler(page, 'mode-ordi');
  await ordi.click();
  await expect(plateau(page)).toBeVisible();
  await expect(page.getByText(/Caillou/).first()).toBeVisible();
  await page.context().close();
});

test('sans compte : la partie en ligne passe par « Crée ton compte », comme avant', async ({ browser, baseURL }) => {
  const page = await telephone(browser, baseURL, CONFIRME, { compte: false });
  await expect(page.locator('.cta')).toHaveText('Jouer en ligne');
  await expect(page.getByTestId('classee')).toContainText('Ton compte garde ta cote.');
  await page.locator('.cta').click();
  await expect(page.getByTestId('creer-compte')).toHaveAttribute('data-raison', 'en_ligne');
  await page.context().close();
});

for (const [largeur, hauteur] of [[320, 568], [390, 844]] as const) {
  for (const sombre of [false, true]) {
    test(`rangée des modes en ${largeur} × ${hauteur} (${sombre ? 'sombre' : 'clair'}) : sans défilement horizontal, cibles de 44 px, bouton au-dessus de la barre`, async ({ browser, baseURL }) => {
      const page = await telephone(browser, baseURL, CONFIRME, { largeur, hauteur, sombre });
      const m = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, vue: innerWidth }));
      expect(m.scroll).toBeLessThanOrEqual(m.vue);
      const [cta, nav] = await Promise.all([page.locator('.cta').boundingBox(), page.getByRole('navigation').boundingBox()]);
      expect(cta!.y + cta!.height).toBeLessThanOrEqual(nav!.y + 1);
      for (const id of ['mode-ordi', 'mode-ami', 'mode-plus']) await sansDefiler(page, id);
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
