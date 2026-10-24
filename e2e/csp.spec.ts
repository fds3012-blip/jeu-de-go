import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { SGF_424 } from '../src/app/partie424.fixture';
import { brancher, fauxServeur } from './fauxSupabase';
import { ouvrirRevue } from './revueFactice';
import { choisirMode } from './plateau';

// Issue #531 : en-têtes de sécurité. `vite preview` sert les en-têtes de vercel.json (outils/csp.ts), et chaque page
// porte sa balise meta CSP (empreintes de ses scripts en ligne). Ce fichier parcourt les écrans clés et échoue à la
// moindre violation : événement `securitypolicyviolation` de la page, ou refus écrit dans la console (Workers compris :
// KataGo charge TensorFlow.js et le réseau dans un Worker). Toute la suite e2e tourne aussi sous cette politique.

interface Garde { violations: string[]; arreter: () => void }

/** Écoute les violations CSP d'une page (événements du document et console, Workers compris). */
async function garder(page: Page): Promise<Garde> {
  const violations: string[] = [];
  await page.addInitScript(() => {
    const w = window as unknown as { __csp: string[] };
    w.__csp = [];
    document.addEventListener('securitypolicyviolation', e => {
      w.__csp.push(`${e.effectiveDirective} ${e.blockedURI || '(en ligne)'} ${e.sourceFile}:${e.lineNumber}`);
    });
  });
  const surConsole = (m: { text(): string }) => {
    if (/Content Security Policy|Refused to (load|connect|execute|apply|frame|compile|create|evaluate)/i.test(m.text())) violations.push(m.text());
  };
  page.on('console', surConsole);
  page.on('worker', w => w.on('console', surConsole));
  return { violations, arreter: () => page.off('console', surConsole) };
}

async function violationsDe(page: Page, g: Garde): Promise<string[]> {
  const dom = await page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? []).catch(() => []);
  return [...g.violations, ...dom];
}

async function nouveauContexte(browser: import('@playwright/test').Browser, baseURL: string | undefined, locale = 'fr-FR'): Promise<BrowserContext> {
  return browser.newContext({
    baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale,
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }, { name: 'go.connait-go.v1', value: '"sait"' }, { name: 'go.premiere-pierre.v1', value: 'true' }] }] },
  });
}

test('en-têtes de sécurité et balise meta CSP sur l’app, les aperçus et les pages de référencement', async ({ request }) => {
  for (const chemin of ['/', '/en', '/defi', '/j/1', '/apprendre-le-go', '/en/learn-go', '/regles-du-go', '/inconnue']) {
    const r = await request.get(chemin);
    const h = r.headers();
    expect(h['content-security-policy'], chemin).toContain("frame-ancestors 'none'");
    expect(h['content-security-policy'], chemin).toContain("object-src 'none'");
    expect(h['strict-transport-security'], chemin).toMatch(/max-age=\d{8,}/);
    expect(h['x-content-type-options'], chemin).toBe('nosniff');
    expect(h['referrer-policy'], chemin).toBe('strict-origin-when-cross-origin');
    expect(h['permissions-policy'], chemin).toContain('camera=()');
    expect(h['x-frame-options'], chemin).toBe('DENY');
    const html = await r.text();
    // La balise meta précède tout script : sinon les premiers scripts échapperaient aux empreintes.
    const meta = html.indexOf('http-equiv="Content-Security-Policy"');
    expect(meta, chemin).toBeGreaterThan(0);
    expect(meta, chemin).toBeLessThan(html.indexOf('<script'));
    expect(html, chemin).toMatch(/content="script-src 'self' 'wasm-unsafe-eval' https:\/\/challenges\.cloudflare\.com( 'sha256-[A-Za-z0-9+/]+=*')+"/);
  }
  // Le Worker de KataGo et le service worker reçoivent la même politique (leurs propres en-têtes).
  const sw = await request.get('/sw.js');
  expect(sw.headers()['content-security-policy']).toContain("connect-src 'self'");
});

test('témoin : le guet voit bien une violation (connexion à un hôte non permis, script en ligne inconnu)', async ({ browser, baseURL }) => {
  const ctx = await nouveauContexte(browser, baseURL);
  const page = await ctx.newPage();
  const g = await garder(page);
  await page.goto('/');
  await expect(page.locator('.cta')).toBeVisible();
  await page.evaluate(() => fetch('https://interdit.example/x').catch(() => null));
  await page.evaluate(() => { const s = document.createElement('script'); s.textContent = 'window.__injecte = 1'; document.head.append(s); });
  await expect.poll(async () => (await violationsDe(page, g)).join('\n')).toMatch(/connect-src[\s\S]*script-src|script-src[\s\S]*connect-src/);
  expect(await page.evaluate(() => (window as unknown as { __injecte?: number }).__injecte)).toBeUndefined();
  await ctx.close();
});

test('écrans clés sans aucune violation CSP : accueil, partie contre l’ordi, leçons, problèmes, profil, anglais', async ({ browser, baseURL }) => {
  test.setTimeout(90_000);
  const ctx = await nouveauContexte(browser, baseURL);
  const page = await ctx.newPage();
  const g = await garder(page);
  await page.goto('/');
  await expect(page.locator('.cta')).toBeVisible();
  // L'ouverture animée (scripts en ligne) est jouée, pour vérifier aussi ses empreintes.
  await page.evaluate(() => localStorage.setItem('e2e.ouverture', '1'));
  await page.reload();
  await expect(page.locator('.cta')).toBeVisible();
  await choisirMode(page, 'ordi');
  await expect(page.locator('.goban, svg[role="grid"], [data-testid="plateau"]').first()).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  await page.goto('/');
  await nav.getByRole('button', { name: 'Apprendre' }).click();
  await nav.getByRole('button', { name: 'Problèmes' }).click();
  await nav.getByRole('button', { name: 'Profil' }).click();
  await page.waitForLoadState('networkidle');
  await page.goto('/?lang=en');
  await expect(page.locator('.cta')).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(await violationsDe(page, g)).toEqual([]);
  await ctx.close();
});

test('liens courts, aperçus et pages de référencement (démo jouable) sans violation', async ({ browser, baseURL }) => {
  const ctx = await nouveauContexte(browser, baseURL);
  const page = await ctx.newPage();
  const g = await garder(page);
  // Lien court du Go du jour : le script en ligne de l'aperçu remet l'adresse en forme, puis l'app s'ouvre.
  await page.goto('/j/1');
  // #688 (N8) : puis l'adresse suit l'écran ouvert (le problème du jour, `/problemes/<id>`).
  await expect.poll(() => new URL(page.url()).pathname).toMatch(/^\/(problemes\/[a-z0-9-]+)?$/);
  await page.waitForLoadState('networkidle');
  // Page de référencement : son propre script (démo), sans le JS de l'app.
  await page.goto('/apprendre-le-go');
  const demo = page.locator('#demo');
  await expect(demo.locator('.sans-js')).toBeHidden();
  await page.locator('.goban-points').getByRole('button', { name: /^E4,/ }).click();
  await expect(demo.getByRole('status')).toHaveText(/Capturée/);
  await page.goto('/en/learn-go');
  await expect(page.locator('#demo .sans-js')).toBeHidden();
  expect(await violationsDe(page, g)).toEqual([]);
  await ctx.close();
});

test('compte et en ligne (Supabase simulé, temps réel) sans violation', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const ctx = await nouveauContexte(browser, baseURL);
  const session = serveur.sessionCompte('csp@exemple.test', 'Csp', '00000000-0000-4000-8000-000000053199');
  const page = await brancher(ctx, serveur, { 'sb-supabase-auth-token': JSON.stringify(session) });
  const g = await garder(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Profil', exact: true }).click();
  await page.getByRole('button', { name: /^Mes amis/ }).click();
  await expect(page.getByRole('heading', { name: 'Mes amis' })).toBeVisible();
  await page.goto('/');
  await choisirMode(page, 'en_ligne');
  await page.getByTestId('direct-choix').getByRole('button', { name: 'Trouver un adversaire' }).click();
  await expect(page.getByTestId('direct-attente')).toBeVisible();
  await expect.poll(() => serveur.file.length).toBe(1);
  expect(await violationsDe(page, g)).toEqual([]);
  await ctx.close();
});

test('KataGo : vrai réseau et vrai TensorFlow.js dans le Worker, sous la CSP', async ({ browser, baseURL }) => {
  test.setTimeout(240_000);
  const ctx = await nouveauContexte(browser, baseURL);
  await ctx.addInitScript(({ sgf }) => {
    localStorage.setItem('go.historique.v1', JSON.stringify([{
      id: 'ami-531', date: new Date(Date.now() - 3_600_000).toISOString(), sgf, mode: 'defi', taille: 9, joueur: 1, adversaire: 'Ami', resultat: 'B+17.5',
    }]));
    localStorage.setItem('go.parties.v1', JSON.stringify({ n: 5 }));
    (window as unknown as { __kataGoTelechargement: boolean }).__kataGoTelechargement = true;
  }, { sgf: SGF_424 });
  const page = await ctx.newPage();
  const g = await garder(page);
  let indisponible = '';
  page.on('console', m => { if (/KataGo indisponible/.test(m.text())) indisponible = m.text(); });
  await ouvrirRevue(page);
  await expect(page.locator('.bilan-katago')).toHaveCount(0, { timeout: 200_000 });
  expect(indisponible).toBe('');
  expect(await violationsDe(page, g)).toEqual([]);
  await ctx.close();
});
