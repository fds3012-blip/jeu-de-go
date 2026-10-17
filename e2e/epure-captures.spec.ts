import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { brancher, fauxServeur, type FauxServeur } from './fauxSupabase';
import { abandonner, choisirMode, jouer, plateau } from './plateau';

// Épure des écrans (#592, docs/ux/epure-2026-10.md) : captures des écrans principaux en 390 × 844, sombre et clair,
// pour comparer avant et après. Lancement manuel seulement :
// EPURE=docs/ux/captures/epure-avant npx playwright test epure-captures --workers 1
// Vague 2 (#602) : même spec, dossiers docs/ux/captures/epure2-avant et epure2-apres ; 04c et 04d montrent le chemin plus bas.
// (le dossier est relatif au dépôt ; les PNG sont pris en densité 1 pour rester légers).

const DOSSIER = process.env.EPURE;
test.skip(!DOSSIER, 'Captures de l’épure : lancer avec EPURE=<dossier>');
test.describe.configure({ mode: 'serial' });

const ANA = '00000000-0000-4000-8000-0000000000c1';
/** Joueur habitué : Pomme battue, trois leçons finies, Caillou en cours (comme e2e/loi-de-hick.spec.ts). */
const HABITUE = {
  'go.premiere-pierre.v1': 'true',
  'go.parties.v1': JSON.stringify({ n: 6, dernier: 'caillou', ordi: 6 }), 'go.bilan.v1': JSON.stringify({ pomme: { v: 2, d: 1 }, caillou: { v: 0, d: 2 } }),
  'go.adversaire.v1': JSON.stringify('caillou'), 'go.lecons.v1': JSON.stringify({ l1: 99, l2: 99, l3: 99 }),
};
const MIDI_PARIS = new Date('2026-10-17T12:00:00+02:00');

async function telephone(browser: Browser, baseURL: string | undefined, serveur: FauxServeur, stockage: Record<string, string>, compte = false) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'fr-FR', baseURL, timezoneId: 'Europe/Paris',
    colorScheme: 'dark', reducedMotion: 'reduce',
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }, { name: 'go.connait-go.v1', value: '"sait"' }] }] },
  });
  const s = { ...stockage };
  if (compte) s['sb-supabase-auth-token'] = JSON.stringify(serveur.sessionCompte('ana@exemple.test', 'Ana', ANA));
  const page = await brancher(ctx, serveur, s);
  await page.clock.setFixedTime(MIDI_PARIS);
  return { ctx, page };
}

/** Une capture par thème, écran entier visible (pas la page défilée). */
async function cap(page: Page, nom: string) {
  const dossier = join(process.cwd(), DOSSIER!);
  mkdirSync(dossier, { recursive: true });
  for (const theme of ['dark', 'light'] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.waitForTimeout(350);
    await page.screenshot({ path: join(dossier, `${nom}-${theme === 'dark' ? 'sombre' : 'clair'}.png`) });
  }
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
}
const nav = (page: Page, nom: RegExp) => page.getByRole('navigation').getByRole('button', { name: nom });
/** #602 : défile pour mettre l'élément en haut de l'écran, sous l'en-tête. */
async function enHaut(page: Page, selecteur: string) {
  await page.locator(selecteur).first().evaluate(el => window.scrollBy({ top: el.getBoundingClientRect().top - 72, behavior: 'instant' as ScrollBehavior }));
  await page.waitForTimeout(300);
}

test('nouveau joueur', async ({ browser, baseURL }) => {
  test.setTimeout(240_000);
  const serveur = fauxServeur();
  const a = await telephone(browser, baseURL, serveur, {});
  await a.page.goto('/');
  await expect(a.page.locator('.cta')).toBeVisible();
  await cap(a.page, '01-jouer-premier-lancement');
  await a.ctx.close();
  const b = await telephone(browser, baseURL, serveur, { 'go.premiere-pierre.v1': 'true' });
  await b.page.goto('/');
  await expect(b.page.getByTestId('modes')).toBeVisible();
  await cap(b.page, '02-jouer-apres-premiere-pierre');
  await nav(b.page, /^Apprendre$/).click();
  await expect(b.page.locator('.cta').first()).toBeVisible();
  await cap(b.page, '04b-apprendre-nouveau');
  await enHaut(b.page, '[data-chapitre="c1"] .gue > ol > li:nth-child(4)');
  await cap(b.page, '04c-apprendre-nouveau-suite');
  await b.ctx.close();
});

test('joueur habitué', async ({ browser, baseURL }) => {
  test.setTimeout(400_000);
  const serveur = fauxServeur();
  const { ctx, page } = await telephone(browser, baseURL, serveur, HABITUE, true);
  await page.goto('/');
  await expect(page.getByTestId('modes')).toBeVisible();
  await page.waitForTimeout(800);
  await cap(page, '03-jouer-habitue');

  await nav(page, /^Apprendre$/).click();
  await expect(page.locator('.cta').first()).toBeVisible();
  await cap(page, '04-apprendre-habitue');
  await enHaut(page, '[data-chapitre="c2"]');
  await cap(page, '04d-apprendre-chapitre-ouverture');

  await nav(page, /^Problèmes$/).click();
  await expect(page.locator('.themes')).toBeVisible();
  await page.waitForTimeout(800);
  await cap(page, '05-problemes-liste');
  await page.locator('.cta').first().click();
  await expect(plateau(page).first()).toBeVisible();
  await page.waitForTimeout(600);
  await cap(page, '06-probleme-en-cours');

  await page.goto('/');
  await nav(page, /^Profil$/).click();
  await expect(page.getByRole('button', { name: /^Réglages/ })).toBeVisible();
  await cap(page, '07-profil');

  await page.goto('/');
  await choisirMode(page, 'ordi');
  await expect(plateau(page)).toBeVisible();
  await jouer(page, 'E5');
  await page.waitForTimeout(2500);
  await cap(page, '08-partie-ordi');
  await abandonner(page);
  await page.waitForTimeout(2500);
  await cap(page, '09-fin-de-partie');

  await page.goto('/');
  await nav(page, /^Apprendre$/).click();
  await page.getByRole('button', { name: /^(Commencer|Reprendre)( la leçon)?/ }).first().click();
  await expect(page.getByRole('progressbar', { name: 'Progression de la leçon' })).toBeVisible();
  await page.waitForTimeout(600);
  await cap(page, '10-lecon');
  await ctx.close();
});

// #613 : l'ouverture de Jouer (habitué et nouveau) et l'étape de lancement (l'ordi, en ligne), avant et après.
// EPURE=docs/ux/captures/jouer-613/apres npx playwright test epure-captures -g "jouer 613" --workers 1
// Gardées dans le dépôt : la version sombre seulement, en JPEG qualité 72 (30 à 40 Ko chacune).
test('jouer 613', async ({ browser, baseURL }) => {
  const cap = async (page: Page, nom: string) => {
    const dossier = join(process.cwd(), DOSSIER!);
    mkdirSync(dossier, { recursive: true });
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await page.waitForTimeout(350);
    await page.screenshot({ path: join(dossier, `${nom}-sombre.jpg`), type: 'jpeg', quality: 72 });
  };
  test.setTimeout(240_000);
  const serveur = fauxServeur();
  const a = await telephone(browser, baseURL, serveur, {});
  await a.page.goto('/');
  await expect(a.page.locator('.cta')).toBeVisible();
  await cap(a.page, '01-jouer-nouveau-premier-lancement');
  await a.ctx.close();
  const b = await telephone(browser, baseURL, serveur, { 'go.premiere-pierre.v1': 'true' });
  await b.page.goto('/');
  await expect(b.page.getByTestId('modes')).toBeVisible();
  await cap(b.page, '02-jouer-nouveau-apres-premiere-pierre');
  await b.ctx.close();

  const { ctx, page } = await telephone(browser, baseURL, serveur, { ...HABITUE, 'go.xp.v1': '480' }, true);
  await page.goto('/');
  await expect(page.getByTestId('modes')).toBeVisible();
  await page.waitForTimeout(800);
  await cap(page, '03-jouer-habitue');
  // Étape de lancement contre l'ordi : la feuille (avant : « Changer » ; après : la tuile « L'ordi »).
  const changer = page.getByRole('button', { name: 'Changer' });
  if (await changer.count()) await changer.first().click();
  else await page.getByTestId('mode-ordi').click();
  await expect(page.getByRole('dialog', { name: 'Ton adversaire' })).toBeVisible();
  await page.waitForTimeout(600);
  await cap(page, '04-lancement-ordi');
  await page.goto('/');
  await expect(page.getByTestId('modes')).toBeVisible();
  await page.locator('.cta[data-mode="en_ligne"]').click();
  await expect(page.getByTestId('direct-choix')).toBeVisible();
  await page.waitForTimeout(800);
  await cap(page, '05-lancement-en-ligne');
  await ctx.close();
});
