import { expect, test, type Browser, type Page, type Request } from '@playwright/test';
import { brancher, CODE, fauxServeur, type FauxServeur } from './fauxSupabase';
import { abandonner, choisirMode, jouer, plateau } from './plateau';

// #437 : compteurs anonymes de la première visite (src/data/compteurs.ts, fonction `compter_etape`). Supabase est
// simulé (e2e/fauxSupabase.ts) ; on lit les appels `compter_etape` envoyés par chaque téléphone.
// Une première session compte chacune des neuf étapes une seule fois ; le drapeau de l'équipe coupe tout.
// #519 : un navigateur piloté (`navigator.webdriver`, comme celui de Playwright) ne compte rien. Les téléphones des tests
// se déclarent donc navigateur ordinaire (`humain`) ; le dernier test garde le drapeau et vérifie que rien ne part.

// Ordre d'une première session : écran, geste (toucher « Joue ta première partie »), partie ouverte, plateau touché
// (pierre fantôme), pierre, partie finie, limite, compte, partie en ligne.
const ETAPES = ['premier_ecran', 'premier_geste', 'partie_ouverte', 'premier_toucher_plateau', 'premiere_pierre',
  'premiere_partie_finie', 'limite_essai', 'compte_cree', 'premiere_partie_en_ligne'];
const HOTE_POSTHOG = 'https://posthog-e2e.test';

interface Envoi { etape: string; autorisation: string | undefined; referer: string | undefined; cookie: string | undefined }

/** Écoute les appels `compter_etape` d'une page (corps et en-têtes). */
function ecouter(page: Page): Envoi[] {
  const envois: Envoi[] = [];
  page.on('request', (r: Request) => {
    if (r.method() !== 'POST' || !r.url().endsWith('/rest/v1/rpc/compter_etape')) return;
    const h = r.headers();
    envois.push({ etape: (r.postDataJSON() as { p_etape: string }).p_etape, autorisation: h.authorization, referer: h.referer, cookie: h.cookie });
  });
  return envois;
}

/** Navigateur ordinaire : `navigator.webdriver` faux, comme chez un joueur (sinon rien n'est compté, #519). */
async function humain(page: Page): Promise<Page> {
  await page.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }); });
  return page;
}

async function telephone(browser: Browser, baseURL: string | undefined, serveur: FauxServeur, stockage: Record<string, string> = {}, pilote = false): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR', baseURL, reducedMotion: 'reduce' });
  const page = await brancher(ctx, serveur, { 'go.consentement.v1': 'refuse', ...stockage });
  return pilote ? page : humain(page);
}

const etapes = (e: Envoi[]) => e.map(x => x.etape);

test('première session : chaque étape comptée une seule fois, sans session ni adresse de page', async ({ browser, baseURL }) => {
  test.setTimeout(90_000);
  const serveur = fauxServeur();
  // Bob a déjà un compte et joue depuis longtemps : il ne compte rien.
  const bob = await telephone(browser, baseURL, serveur, {
    'go.parties.v1': JSON.stringify({ n: 3 }),
    'sb-supabase-auth-token': JSON.stringify(serveur.sessionCompte('bob@exemple.test', 'Bob', '00000000-0000-4000-8000-0000000004b1')),
  });
  const envoisBob = ecouter(bob);
  await bob.goto('/');
  const page = await telephone(browser, baseURL, serveur);
  const envois = ecouter(page);
  const erreurs: string[] = [];
  page.on('pageerror', e => erreurs.push(e.message));

  // 1. Premier écran, au tout premier lancement, après l'affichage de l'accueil.
  await page.goto('/');
  await expect(page.locator('.cta')).toHaveText('Joue ta première partie');
  await expect.poll(() => etapes(envois)).toEqual(['premier_ecran']);

  // 2. Premier geste (le toucher du bouton), partie ouverte, plateau touché, première pierre, puis première partie finie.
  await page.locator('.cta').click();
  await expect(plateau(page)).toBeVisible();
  await expect.poll(() => etapes(envois)).toEqual(['premier_ecran', 'premier_geste', 'partie_ouverte']);
  await jouer(page, 'E5');
  await expect.poll(() => etapes(envois)).toContain('premiere_pierre');
  expect(etapes(envois).slice(3, 5)).toEqual(['premier_toucher_plateau', 'premiere_pierre']);
  await abandonner(page);
  await expect.poll(() => etapes(envois)).toContain('premiere_partie_finie');

  // 4. Limite de l'essai : « Jouer en ligne » demande un compte. 5. Compte créé (code, pseudo).
  await expect(page.locator('.cta')).toHaveText(/Rejouer contre Pomme/);
  await page.getByRole('button', { name: 'Accueil', exact: true }).click();
  await choisirMode(page, 'en_ligne');
  await expect(page.getByTestId('creer-compte')).toHaveAttribute('data-raison', 'en_ligne');
  await expect.poll(() => etapes(envois)).toContain('limite_essai');
  await page.getByLabel('Ton adresse e-mail').fill('nouveau@exemple.test');
  await page.getByRole('checkbox', { name: /J’ai 15\s+ans ou plus/ }).check();
  await page.getByRole('button', { name: 'Recevoir mon code' }).click();
  await page.getByLabel('Code à 6 chiffres').fill(CODE);
  await expect.poll(() => etapes(envois)).toContain('compte_cree');
  await page.getByRole('textbox', { name: 'Pseudo' }).fill('Nouveau_1');
  await expect(page.getByText('Nouveau_1 est libre.')).toBeVisible();
  await page.getByRole('button', { name: 'C’est mon pseudo' }).click();

  // 6. Première partie en ligne : Bob attend déjà, le nouveau compte le trouve.
  await expect(page.getByTestId('direct-choix')).toBeVisible();
  await choisirMode(bob, 'en_ligne');
  await bob.getByRole('button', { name: 'Trouver un adversaire' }).click();
  await expect(bob.getByText('Je cherche quelqu’un de ton niveau…')).toBeVisible();
  await page.getByRole('button', { name: 'Trouver un adversaire' }).click();
  await expect(page.getByTestId('direct-partie')).toBeVisible();
  await expect.poll(() => etapes(envois)).toContain('premiere_partie_en_ligne');

  // Rechargée, l'app ne recompte rien : nouvelle partie contre l'ordi, nouvelle pierre.
  await page.goto('/');
  await choisirMode(page, 'ordi');
  await expect(plateau(page)).toBeVisible();
  await jouer(page, 'E5');
  await page.waitForTimeout(1500);
  expect([...etapes(envois)].sort()).toEqual([...ETAPES].sort());
  expect(etapes(envois)).toEqual(ETAPES);

  // Rien qui désigne le joueur : la clé publique seule (jamais le jeton du compte), ni cookie ni adresse de page.
  for (const e of envois) {
    expect(e.autorisation).toBe('Bearer cle-publique-de-test');
    expect(e.referer).toBeUndefined();
    expect(e.cookie).toBeUndefined();
  }
  // Repères sur l'appareil : le mois seulement, une clé par étape.
  const reperes = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('go.entonnoir.')).map(k => [k, localStorage.getItem(k)]));
  expect(reperes.map(([k]) => k).sort()).toEqual(ETAPES.map(e => `go.entonnoir.${e}`).sort());
  for (const [, v] of reperes) expect(v).toMatch(/^\d{4}-\d{2}$/);
  // Bob, appareil déjà connu, n'a rien compté.
  expect(envoisBob).toEqual([]);
  expect(erreurs).toEqual([]);
});

// posthog-js jette les événements des navigateurs pilotés : on se présente comme un iPhone ordinaire (comme
// e2e/url-sensible.spec.ts), pour que le témoin sans drapeau reçoive bien quelque chose.
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

for (const equipe of [true, false]) {
  test(equipe ? 'drapeau de l’équipe (?equipe=1) : ni compteurs ni PostHog, même après rechargement'
    : 'témoin sans drapeau : compteurs et PostHog partent', async ({ browser, baseURL }) => {
    const serveur = fauxServeur();
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR', baseURL, userAgent: UA_IPHONE });
    const page = await brancher(ctx, serveur, { 'go.consentement.v1': 'refuse' });
    const envois = ecouter(page);
    const posthog: string[] = [];
    await page.route(`${HOTE_POSTHOG}/**`, route => {
      if (route.request().method() === 'POST') posthog.push(route.request().url());
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":1}' });
    });
    await page.addInitScript(hote => {
      localStorage.setItem('e2e.posthog.hote', hote);
      Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false });
      Object.defineProperty(Navigator.prototype, 'userAgentData', { get: () => undefined });
    }, HOTE_POSTHOG);

    await page.goto(equipe ? '/?equipe=1&lang=fr' : '/?lang=fr');
    await expect(page.locator('.cta')).toHaveText('Joue ta première partie');
    // Le paramètre quitte l'adresse ; le drapeau est posé.
    expect(new URL(page.url()).search).toBe('?lang=fr');
    expect(await page.evaluate(() => localStorage.getItem('go.equipe.v1'))).toBe(equipe ? '1' : null);
    await page.locator('.cta').click();
    await jouer(page, 'E5');
    await abandonner(page);
    if (!equipe) {
      await expect.poll(() => etapes(envois)).toEqual(['premier_ecran', 'premier_geste', 'partie_ouverte', 'premier_toucher_plateau', 'premiere_pierre', 'premiere_partie_finie']);
      await expect.poll(() => posthog.length, { timeout: 15_000 }).toBeGreaterThan(0);
      return;
    }
    await page.reload();
    await expect(page.locator('.cta')).toBeVisible();
    await page.waitForTimeout(5000); // le SDK PostHog groupe ses envois (quelques secondes)
    expect(envois).toEqual([]);
    expect(posthog).toEqual([]);
    expect(await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('go.entonnoir.')))).toEqual([]);
  });
}

test('navigateur piloté (navigator.webdriver) : rien n’est compté ni posé sur l’appareil (#519)', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const page = await telephone(browser, baseURL, serveur, {}, true);
  const envois = ecouter(page);
  await page.goto('/');
  expect(await page.evaluate(() => navigator.webdriver)).toBe(true);
  await expect(page.locator('.cta')).toHaveText('Joue ta première partie');
  await page.locator('.cta').click();
  await expect(plateau(page)).toBeVisible();
  await jouer(page, 'E5');
  await page.waitForTimeout(1500);
  expect(envois).toEqual([]);
  expect(await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('go.entonnoir.')))).toEqual([]);
});

// Première pierre hors partie (#519) : en leçon, elle compte aussi (avant, seulement en partie).
test('première pierre posée en leçon : comptée comme première pierre, sans partie ouverte', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  // Leçon 1 entamée sur cet appareil (étape 5 : capturer), mais aucune partie ni aucun retour : appareil neuf.
  const page = await telephone(browser, baseURL, serveur, { 'go.lecons.v1': JSON.stringify({ l1: 5 }) });
  const envois = ecouter(page);
  await page.goto('/');
  await expect.poll(() => etapes(envois)).toEqual(['premier_ecran']);
  await page.getByRole('navigation').getByRole('button', { name: 'Apprendre' }).click();
  await page.getByRole('button', { name: 'Reprendre la leçon : Libertés et capture' }).click();
  await jouer(page, 'E4');
  await expect.poll(() => etapes(envois)).toContain('premiere_pierre');
  expect(etapes(envois)).toEqual(['premier_ecran', 'premier_geste', 'premier_toucher_plateau', 'premiere_pierre']);
});

test('réglage caché : 7 touchers sur la version, dans Profil > Réglages, posent puis retirent le drapeau', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const page = await telephone(browser, baseURL, serveur, { 'go.parties.v1': JSON.stringify({ n: 3 }) });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Profil' }).click();
  await page.getByRole('button', { name: /^Réglages/ }).click();
  const version = page.getByTestId('version-app');
  await expect(version).toHaveText(/^Version /);
  expect((await version.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  for (let i = 0; i < 6; i++) await version.click();
  await expect(page.getByRole('status').filter({ hasText: 'Appareil de l’équipe' })).toHaveCount(0);
  await version.click();
  await expect(page.getByText('Appareil de l’équipe : mesure coupée.')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('go.equipe.v1'))).toBe('1');
  for (let i = 0; i < 7; i++) await version.click();
  await expect(page.getByText('Appareil de l’équipe : mesure coupée.')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('go.equipe.v1'))).toBeNull();
});
