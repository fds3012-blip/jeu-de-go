import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { brancher, fauxServeur, type FauxServeur } from './fauxSupabase';
import { abandonner, choisirMode, jouer, plateau } from './plateau';

// Audit visuel et responsive (#615, docs/ux/visuel-responsive-2026-10.md) : chaque écran principal à 7 tailles
// (téléphones 360, 390, 430 ; tablette 768 portrait et 1024 paysage ; ordinateur 1440 ; téléphone en paysage 844 × 390),
// en sombre, plus quelques mesures (défilement, débordement, largeur de la colonne, taille du goban).
// Lancement manuel seulement :
// VISUEL=.playwright-cli/visuel npx playwright test visuel-responsive-captures --workers 1
// Les PNG (densité 1) et `mesures.json` vont dans le dossier donné. On garde ensuite les plus parlants dans docs/ux/captures.

const DOSSIER = process.env.VISUEL;
test.skip(!DOSSIER, 'Captures de l’audit visuel : lancer avec VISUEL=<dossier>');

const TAILLES = [
  { nom: '360', l: 360, h: 780, mobile: true },
  { nom: '390', l: 390, h: 844, mobile: true },
  { nom: '430', l: 430, h: 932, mobile: true },
  { nom: '768', l: 768, h: 1024, mobile: true },
  { nom: '1024', l: 1024, h: 768, mobile: true },
  { nom: '1440', l: 1440, h: 900, mobile: false },
  { nom: '844x390', l: 844, h: 390, mobile: true },
] as const;
type Taille = (typeof TAILLES)[number];

const ANA = '00000000-0000-4000-8000-0000000000c1';
const CHLOE = '00000000-0000-4000-8000-0000000000c3';
const HABITUE = {
  'go.premiere-pierre.v1': 'true',
  'go.parties.v1': JSON.stringify({ n: 6, dernier: 'caillou', ordi: 6 }), 'go.bilan.v1': JSON.stringify({ pomme: { v: 2, d: 1 }, caillou: { v: 0, d: 2 } }),
  'go.adversaire.v1': JSON.stringify('caillou'), 'go.lecons.v1': JSON.stringify({ l1: 99, l2: 99, l3: 99 }),
};
const MIDI_PARIS = new Date('2026-10-17T12:00:00+02:00');

function peupler(serveur: FauxServeur) {
  serveur.compteExistant('chloe@exemple.test', 'Chloe', CHLOE);
  Object.assign(serveur.profiles.find(p => p.id === CHLOE)!, { rating: 1620, cote_provisoire: false });
  serveur.amities.push({ de: CHLOE, a: ANA, etat: 'accepted', le: new Date().toISOString() });
  for (let n = 1; n <= 4; n++) serveur.games.push({
    id: `33333333-3333-4333-8333-${String(n).padStart(12, '0')}`, black_id: n % 2 ? CHLOE : ANA, white_id: n % 2 ? ANA : CHLOE, created_by: CHLOE,
    size: 9, komi: 6.5, rules: 'japanese', handicap: 0, moves: 'eecc', status: 'finished', counting: false, dead_stones: null, dead_proposed_by: null,
    result: n % 2 ? 'B+R' : 'W+3.5', resumed_at: 0, prive: false, rated: true, updated_at: new Date(Date.now() - n * 864e5).toISOString(),
  });
}

async function appareil(browser: Browser, baseURL: string | undefined, serveur: FauxServeur, t: Taille, stockage: Record<string, string>, compte = false) {
  const ctx = await browser.newContext({
    viewport: { width: t.l, height: t.h }, deviceScaleFactor: 1, isMobile: t.mobile, hasTouch: t.mobile, locale: 'fr-FR', baseURL, timezoneId: 'Europe/Paris',
    colorScheme: 'dark', reducedMotion: 'reduce',
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }, { name: 'go.connait-go.v1', value: '"sait"' }] }] },
  });
  const s = { ...stockage };
  if (compte) s['sb-supabase-auth-token'] = JSON.stringify(serveur.sessionCompte('ana@exemple.test', 'Ana', ANA));
  const page = await brancher(ctx, serveur, s);
  await page.clock.setFixedTime(MIDI_PARIS);
  return { ctx, page };
}

const mesures: Record<string, unknown>[] = [];
const echecs: string[] = [];

/** Capture de l'écran visible (sombre ; clair en plus si demandé) et mesures de mise en page. */
async function cap(page: Page, t: Taille, nom: string, clair = false) {
  const dossier = join(process.cwd(), DOSSIER!);
  mkdirSync(dossier, { recursive: true });
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(dossier, `${nom}-${t.nom}.png`) });
  if (clair) {
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    await page.waitForTimeout(250);
    await page.screenshot({ path: join(dossier, `${nom}-${t.nom}-clair.png`) });
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  }
  const m = await page.evaluate(() => {
    const r = (s: string) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), l: Math.round(b.width), h: Math.round(b.height) }; };
    const visibles = (s: string) => [...document.querySelectorAll(s)].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; }).length;
    const plateaux = [...document.querySelectorAll('.board-wrap')].map(e => { const b = e.getBoundingClientRect(); return { l: Math.round(b.width), h: Math.round(b.height), bas: Math.round(b.bottom) }; });
    // Plus longue ligne de texte de paragraphe visible (mesure en caractères approximative : largeur / 0,5 em).
    const paras = [...document.querySelectorAll('p')].map(p => { const b = p.getBoundingClientRect(); const fs = parseFloat(getComputedStyle(p).fontSize); return b.width > 0 ? Math.round(b.width / (fs * 0.5)) : 0; });
    return {
      vue: [innerWidth, innerHeight], hauteurDoc: document.documentElement.scrollHeight, largeurDoc: document.documentElement.scrollWidth,
      app: r('.app'), nav: r('.nav'), cta: visibles('.cta, .btn.primary'), plateaux, carMaxLigne: Math.max(0, ...paras),
    };
  });
  mesures.push({ ecran: nom, taille: t.nom, ...m });
}

/** Une étape qui échoue n'arrête pas les autres : on la note et on repart de l'accueil. */
async function etape(page: Page, t: Taille, nom: string, f: () => Promise<void>) {
  try { await f(); } catch (e) { echecs.push(`${t.nom} ${nom} : ${(e as Error).message.split('\n')[0]}`); try { await page.goto('/'); } catch { /* rien */ } }
}
const nav = (page: Page, nom: RegExp) => page.getByRole('navigation').getByRole('button', { name: nom });

for (const t of TAILLES) {
  test(`écrans à ${t.nom}`, async ({ browser, baseURL }) => {
    test.setTimeout(600_000);
    const clair = t.nom === '390';

    // Nouveau joueur, puis joueur sans compte qui a fini son essai (création de compte).
    const serveur0 = fauxServeur();
    const a = await appareil(browser, baseURL, serveur0, t, {});
    await etape(a.page, t, 'jouer-nouveau', async () => { await a.page.goto('/'); await expect(a.page.locator('.cta')).toBeVisible(); await cap(a.page, t, '01-jouer-nouveau', clair); });
    await a.ctx.close();
    const c = await appareil(browser, baseURL, serveur0, t, { ...HABITUE, 'go.essai.v1': JSON.stringify({ terminees: 3, suivi: true }) });
    await etape(c.page, t, 'creer-compte', async () => {
      await c.page.goto('/');
      await c.page.locator('.cta').first().click();
      await expect(c.page.getByTestId('creer-compte')).toBeVisible();
      await cap(c.page, t, '30-creer-compte', clair);
    });
    await c.ctx.close();

    // Joueur habitué avec un compte et une amie.
    const serveur = fauxServeur();
    peupler(serveur);
    const { ctx, page } = await appareil(browser, baseURL, serveur, t, HABITUE, true);
    await etape(page, t, 'jouer-habitue', async () => {
      await page.goto('/');
      await expect(page.getByTestId('modes')).toBeVisible();
      await page.waitForTimeout(800);
      await cap(page, t, '02-jouer-habitue', clair);
    });
    await etape(page, t, 'changer', async () => {
      await page.getByRole('button', { name: /^Changer/ }).first().click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await cap(page, t, '03-lancement-changer', clair);
      await page.keyboard.press('Escape');
    });
    await etape(page, t, 'partie', async () => {
      await page.goto('/');
      await choisirMode(page, 'ordi');
      await expect(plateau(page)).toBeVisible();
      await jouer(page, 'E5');
      await page.waitForTimeout(2500);
      await cap(page, t, '04-partie', clair);
      await abandonner(page);
      await page.waitForTimeout(2500);
      await cap(page, t, '05-fin-de-partie', clair);
    });
    await etape(page, t, 'apprendre', async () => {
      await page.goto('/');
      await nav(page, /^Apprendre$/).click();
      await expect(page.locator('.cta').first()).toBeVisible();
      await cap(page, t, '10-apprendre', clair);
    });
    await etape(page, t, 'theme', async () => {
      await page.getByTestId('par-theme').getByRole('button').first().click();
      await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
      await cap(page, t, '11-theme', clair);
      await page.getByRole('button', { name: 'Retour à Apprendre' }).click();
    });
    await etape(page, t, 'ouvertures', async () => {
      const entree = page.getByTestId('entree-ouvertures');
      await entree.scrollIntoViewIfNeeded();
      await entree.click();
      await expect(page.locator('.ouv-carte').first()).toBeVisible();
      await cap(page, t, '13-ouvertures', clair);
      await page.locator('.ouv-carte').first().click();
      await page.waitForTimeout(500);
      await cap(page, t, '14-ouverture');
    });
    await etape(page, t, 'lecon', async () => {
      await page.goto('/');
      await nav(page, /^Apprendre$/).click();
      await page.getByRole('button', { name: /^(Commencer|Reprendre)( la leçon)?/ }).first().click();
      await expect(page.getByRole('progressbar', { name: 'Progression de la leçon' })).toBeVisible();
      await page.waitForTimeout(600);
      await cap(page, t, '12-lecon', clair);
    });
    await etape(page, t, 'problemes', async () => {
      await page.goto('/');
      await nav(page, /^Problèmes$/).click();
      await expect(page.locator('.themes')).toBeVisible();
      await page.waitForTimeout(800);
      await cap(page, t, '20-problemes', clair);
      // La carte « Problème suivant » et la grille « Par thème », comme sur la capture de Florian.
      await page.locator('.palier-en-cours, .continuer-carte').first().evaluate(e => e.scrollIntoView({ block: 'start' }));
      await page.waitForTimeout(300);
      await cap(page, t, '21-problemes-defile', clair);
      await page.evaluate(() => window.scrollTo(0, 0));
    });
    await etape(page, t, 'probleme', async () => {
      await page.locator('.cta').first().click();
      await expect(plateau(page).first()).toBeVisible();
      await page.waitForTimeout(600);
      await cap(page, t, '22-probleme', clair);
    });
    await etape(page, t, 'course', async () => {
      await page.goto('/');
      await nav(page, /^Problèmes$/).click();
      await page.locator('.course-carte').click();
      await expect(page.getByRole('heading', { name: /Course/ })).toBeVisible();
      await cap(page, t, '23-course-consigne');
      await page.getByRole('button', { name: 'C’est parti' }).click();
      await page.waitForTimeout(800);
      await cap(page, t, '24-course', clair);
    });
    await etape(page, t, 'tous', async () => {
      await page.goto('/');
      await nav(page, /^Problèmes$/).click();
      await page.getByRole('button', { name: 'Tous les problèmes' }).click();
      await expect(page.getByRole('heading', { name: 'Tous les problèmes' })).toBeVisible();
      await cap(page, t, '25-tous-les-problemes', clair);
    });
    await etape(page, t, 'profil', async () => {
      await page.goto('/');
      await nav(page, /^Profil$/).click();
      await expect(page.getByRole('button', { name: /^Réglages/ })).toBeVisible();
      await cap(page, t, '40-profil', clair);
    });
    await etape(page, t, 'stats', async () => {
      await page.getByTestId('ligne-stats').click();
      await page.waitForTimeout(600);
      await cap(page, t, '41-statistiques', clair);
      await page.getByRole('button', { name: /^Retour/ }).first().click();
    });
    await etape(page, t, 'reglages', async () => {
      await page.getByRole('button', { name: /^Réglages/ }).click();
      await expect(page.getByRole('heading', { name: 'Réglages' })).toBeVisible();
      await cap(page, t, '42-reglages', clair);
      await page.getByRole('button', { name: /^Retour/ }).first().click();
    });
    await etape(page, t, 'amis', async () => {
      await page.getByRole('button', { name: /^Mes amis/ }).click();
      await expect(page.getByRole('heading', { name: 'Mes amis' })).toBeVisible();
      await page.waitForTimeout(500);
      await cap(page, t, '43-amis', clair);
      await page.getByRole('button', { name: 'Voir le profil de Chloe' }).first().click();
      await expect(page.getByTestId('profil-public')).toBeVisible();
      await page.waitForTimeout(600);
      await cap(page, t, '44-profil-public', clair);
    });
    await ctx.close();
    writeFileSync(join(process.cwd(), DOSSIER!, `mesures-${t.nom}.json`), JSON.stringify({ mesures, echecs }, null, 1));
    mesures.length = 0; echecs.length = 0;
  });
}
