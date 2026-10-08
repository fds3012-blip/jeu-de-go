import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brancher, fauxServeur, JETON, PARTIE } from './fauxSupabase';
import { jouer, plateau } from './plateau';
import { preparerRevue } from './revueFactice';
import { fromLabel } from '../src/go/coords';

// Captures des stores, en français et en anglais (#501 ; v1 : #208, français seul).
// Lancement manuel seulement (écrit dans docs/) : CAPTURES_STORES=1 npx playwright test e2e/captures-stores.spec.ts --workers=1
// (le chemin complet : un simple « captures-stores » filtre aussi sur le dossier, et lance toute la suite si le dépôt
// est dans un dossier dont le nom le contient).
// Étape 1 : chaque écran réel de l'app à 390 × 844 (×3), en sombre, dans chaque langue (`?lang=en`).
// Étape 2 : l'écran posé sous sa légende, sur fond encre, à chaque format demandé par les stores :
//   - `iphone-6.9` : 1320 × 2868 (App Store Connect, « iPhone with Dynamic Island (large display) ») ;
//   - `iphone-6.3` : 1206 × 2622 (« Dynamic Island (medium display) ») : facultatif, Apple réduit le 6,9 pouces ;
//   - `play` : 1080 × 1920 (Google Play, téléphone, 9:16, sans cadre d'appareil).
// CAPTURES_STORES_FORMATS choisit les formats (par défaut : iphone-6.9,play, les seuls versionnés) ;
// CAPTURES_STORES_SORTIE change le dossier (par défaut docs/marketing/captures-stores/{fr,en}/{format}/).

test.skip(!process.env.CAPTURES_STORES, 'Captures de store : lancer avec CAPTURES_STORES=1');
test.describe.configure({ mode: 'serial' });

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const BRUTES = join(RACINE, 'test-results', 'captures-stores-brutes');
const SORTIE = process.env.CAPTURES_STORES_SORTIE ?? join(RACINE, 'docs', 'marketing', 'captures-stores');
const LANGUES = ['fr', 'en'] as const;
type Langue = (typeof LANGUES)[number];

/** Formats de sortie : taille CSS de la page de composition (×3 à la photo). */
const FORMATS = {
  'iphone-6.9': { largeur: 440, hauteur: 956, cadre: true },
  'iphone-6.3': { largeur: 402, hauteur: 874, cadre: true },
  play: { largeur: 360, hauteur: 640, cadre: false },
} as const;
type Format = keyof typeof FORMATS;
const CHOISIS = (process.env.CAPTURES_STORES_FORMATS ?? 'iphone-6.9,play').split(',').map(f => f.trim()) as Format[];

/**
 * Légendes des 6 captures, dans l'ordre du store. Les mêmes textes sont dans docs/marketing/fiches-stores.md,
 * avec, pour chacune, la preuve dans le code.
 */
const CAPTURES = [
  { id: '01-pomme', fr: 'Joue contre Pomme dès la première minute', en: 'Play Pomme in your very first minute' },
  { id: '02-coach', fr: 'Mochi t’aide pendant la partie', en: 'Mochi coaches you as you play' },
  { id: '03-lecons', fr: '35 leçons à jouer, pas à lire', en: '35 lessons to play, not to read' },
  { id: '04-problemes', fr: 'Plus de 200 problèmes, par thème', en: 'Over 200 puzzles, by theme' },
  { id: '05-revue', fr: 'La revue t’explique tes coups', en: 'A review that explains your moves' },
  { id: '06-ami', fr: 'Défie un ami par un lien', en: 'Challenge a friend with a link' },
] as const;

const T = {
  fr: { pommeJoue: 'Pomme joue', passer: 'Passer', apprendre: 'Apprendre', problemes: 'Problèmes', profil: 'Profil', mesParties: /^Mes parties/,
    demarrer: 'Démarrer le bilan', suivant: 'Suivant', voirBonCoup: 'Voir le bon coup', aToi: /À toi de jouer\. Il te reste/ },
  en: { pommeJoue: 'Pomme plays', passer: 'Pass', apprendre: 'Learn', problemes: 'Puzzles', profil: 'Profile', mesParties: /^My games/,
    demarrer: 'Start review', suivant: 'Next', voirBonCoup: 'Show the right move', aToi: /Your move\. You have/ },
} as const;

const MIDI_PARIS = new Date('2026-09-27T12:00:00+02:00');
/** Coups de Pomme écrits d'avance (build VITE_E2E, `window.__coupsOrdi`, src/engine/index.ts). */
const ordi = (labels: string[]) => labels.map(l => fromLabel(l, 9));

const adresse = (langue: Langue, chemin = '/') => (langue === 'en' ? `${chemin}${chemin.includes('?') ? '&' : '?'}lang=en` : chemin);

async function preparer(page: Page, etat: Record<string, unknown> = {}, coups?: number[]) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.clock.setFixedTime(MIDI_PARIS);
  await page.addInitScript(({ etat, coups }) => {
    for (const [k, v] of Object.entries(etat)) localStorage.setItem(k, JSON.stringify(v));
    if (coups) (window as unknown as { __coupsOrdi: number[] }).__coupsOrdi = [...coups];
  }, { etat, coups });
}

async function brute(page: Page, langue: Langue, id: string) {
  mkdirSync(join(BRUTES, langue), { recursive: true });
  await expect(page.locator('html')).toHaveAttribute('lang', langue);
  // Pas de défilement horizontal sur l'écran capturé.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(BRUTES, langue, `${id}.png`) });
}

/** Joue un coup de Noir et attend la réponse annoncée de Pomme (ou la bulle du coach à sa place). */
async function coup(page: Page, langue: Langue, noir: string, blanc: string) {
  await expect(page.getByRole('toolbar').getByRole('button', { name: T[langue].passer, exact: true })).toBeEnabled({ timeout: 10_000 });
  await jouer(page, noir);
  await expect(page.getByText(new RegExp(`${T[langue].pommeJoue} ${blanc}`)).or(page.locator('[data-coach-bulle]'))).toBeVisible({ timeout: 10_000 });
}

for (const langue of LANGUES) {
  test.describe(`écrans bruts (${langue})`, () => {
    test('1. première partie contre Pomme', async ({ page }) => {
      // Nouveau joueur : un seul bouton à l'accueil, « Joue ta première partie » contre Pomme (src/app/Accueil.tsx).
      await preparer(page, {}, ordi(['F6', 'D6']));
      await page.goto(adresse(langue));
      await page.locator('.cta').click();
      await expect(plateau(page)).toBeVisible();
      await coup(page, langue, 'D4', 'F6');
      await coup(page, langue, 'F4', 'D6');
      await expect(page.getByText(new RegExp(`${T[langue].pommeJoue} D6`))).toBeVisible();
      await brute(page, langue, '01-pomme');
    });

    test('2. coach Mochi en partie', async ({ page }) => {
      // Recette d'e2e/coach-mochi.spec.ts (#470) : Mochi signale la prise ratée en E4 et montre le point.
      await preparer(page, { 'go.parties.v1': { n: 1, dernier: 'pomme', ordi: 1 }, 'go.intro-but.v1': true }, ordi(['E5', 'J9', 'J8', 'J7', 'H9', 'H8']));
      await page.goto(adresse(langue));
      await page.locator('.cta').click();
      await expect(plateau(page)).toBeVisible();
      for (const [noir, blanc] of [['D5', 'E5'], ['F5', 'J9'], ['E6', 'J8'], ['A9', 'J7']]) await coup(page, langue, noir, blanc);
      await expect(page.locator('[data-coach-bulle]')).toHaveText(langue === 'fr' ? /tu pouvais prendre une pierre en E4/ : /you could capture a stone at E4/);
      await expect(page.locator('.partie-plateau .calque-conseil')).toHaveAttribute('data-point', 'E4');
      await brute(page, langue, '02-coach');
    });

    test('3. leçon 1 : la pierre posée, ses libertés allumées', async ({ page }) => {
      await preparer(page);
      await page.goto(adresse(langue));
      await page.getByRole('navigation').getByRole('button', { name: T[langue].apprendre }).click();
      await page.locator('.cta-chemin').click();
      await expect(page.locator('.lecteur-plateau')).toHaveAttribute('data-demo', 'geste');
      await jouer(page, 'E5');
      await expect(page.locator('.lecteur-plateau')).toHaveAttribute('data-demo', 'finie');
      await brute(page, langue, '03-lecons');
    });

    test('4. problèmes par thème', async ({ page }) => {
      // Écran Problèmes (#471) : le Go du jour, puis les séries par thème.
      await preparer(page);
      await page.goto(adresse(langue));
      await page.getByRole('navigation').getByRole('button', { name: T[langue].problemes }).click();
      await expect(page.locator('.theme-carte')).toHaveCount(5);
      // Les thèmes en haut de l'écran, sous la course de 3 minutes (le Go du jour, au-dessus, serait coupé).
      await page.evaluate(() => {
        scrollTo(0, 0);
        const t = document.querySelector('.themes')!.getBoundingClientRect();
        scrollBy(0, Math.max(0, t.top - 250));
      });
      await brute(page, langue, '04-problemes');
    });

    test('5. revue : le coup manqué expliqué, le bon coup montré', async ({ page }) => {
      // Partie fixe et analyse figée (e2e/revueFactice.ts, comme e2e/revue-bilan.spec.ts) : l'écran est celui de l'app.
      await preparer(page);
      await preparerRevue(page);
      await page.goto(adresse(langue));
      await page.getByRole('navigation').getByRole('button', { name: T[langue].profil }).click();
      await page.getByRole('button', { name: T[langue].mesParties }).click();
      await page.locator('.mp-parties > li > button').first().click();
      const demarrer = page.getByRole('button', { name: T[langue].demarrer });
      await expect(demarrer).toBeVisible({ timeout: 30_000 });
      await demarrer.click();
      const suivant = page.getByRole('button', { name: T[langue].suivant, exact: true });
      for (let i = 0; i < 3; i++) await suivant.click();
      await expect(plateau(page).locator('[data-note-sceau]')).toHaveAttribute('data-note-sceau', langue === 'fr' ? 'Coup manqué' : /.+/);
      await page.getByRole('button', { name: T[langue].voirBonCoup }).click();
      await expect(plateau(page).locator('[data-meilleur]')).toHaveCount(1);
      // Le titre « Revoir ma partie » en haut : « Rejoue cette erreur » reste lisible au-dessus de « Suivant », qui colle
      // au bas de l'écran.
      await page.evaluate(() => {
        scrollTo(0, 0);
        const titre = document.querySelector('.parcours-bulle')!.getBoundingClientRect();
        scrollBy(0, Math.max(0, titre.top - 60));
      });
      await brute(page, langue, '05-revue');
    });

    test('6. partie avec un ami, par un lien', async ({ browser, baseURL }) => {
      // Recette d'e2e/defi-partie-v3.spec.ts (#81, #393) : Supabase simulé, partie entre amis, 3 jours par coup. Léa a Noir
      // et vient de jouer son 5e coup (9 coups) : c'est à moi, Blanc.
      const MOI = '00000000-0000-4000-8000-0000000000a1';
      const LEA = '00000000-0000-4000-8000-0000000000b2';
      const serveur = fauxServeur();
      serveur.games.push({ id: PARTIE, white_id: MOI, black_id: LEA, created_by: MOI, size: 9, komi: 6.5, rules: 'japanese', handicap: 0,
        moves: 'eecggcggcceggfdcce', status: 'active', counting: false, dead_stones: null, dead_proposed_by: null, result: null, resumed_at: 0, prive: true, rated: false });
      serveur.defis.push({ partie_id: PARTIE, jeton: JETON, createur_id: MOI, invite_id: LEA, delai_coup: '3 days',
        date_limite: new Date(Date.now() + 50 * 3_600_000).toISOString(), lien_expire_le: new Date(Date.now() + 7 * 864e5).toISOString(), cree_le: new Date().toISOString() });
      serveur.profiles.push({ id: LEA, username: 'Lea', rating: 1500, streak_days: 0, streak_last: null, streak_freezes: 0 });
      const ctx = await browser.newContext({
        viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: langue === 'fr' ? 'fr-FR' : 'en-US', baseURL,
        colorScheme: 'dark', reducedMotion: 'reduce',
        storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }] }] },
      });
      const session = serveur.sessionCompte('moi@exemple.test', langue === 'fr' ? 'Florian' : 'Sam', MOI);
      const page = await brancher(ctx, serveur, { 'sb-supabase-auth-token': JSON.stringify(session), 'go.parties.v1': JSON.stringify({ n: 3 }) });
      await page.goto(adresse(langue));
      await page.getByTestId('tuile-defi').click();
      await expect(plateau(page)).toBeVisible();
      await expect(page.getByText(T[langue].aToi)).toBeVisible();
      await expect(page.locator('.joueur').first()).toContainText('Lea');
      await brute(page, langue, '06-ami');
      await ctx.close();
    });
  });
}

/** Police des légendes (celle de l'app), embarquée : la page de composition n'a pas d'origine. */
function police(): string {
  const f = join(RACINE, 'node_modules', '@fontsource-variable', 'bricolage-grotesque', 'files', 'bricolage-grotesque-latin-wght-normal.woff2');
  return readFileSync(f).toString('base64');
}

/**
 * Page de composition (Encre & Jade) : fond encre, filet jade, légende, puis l'écran. Sur l'App Store, l'écran dans
 * un téléphone stylisé ; sur Google Play, l'écran seul aux coins arrondis (Google déconseille les cadres d'appareil).
 * Toutes les mesures sont en unités `u` (1/440 de la largeur) : la même mise en page à chaque format.
 */
function composition(langue: Langue, legende: string, img: string, woff: string, f: (typeof FORMATS)[Format]): string {
  const u = f.largeur / 440;
  const px = (n: number) => `${(n * u).toFixed(2)}px`;
  // Même mise en page pour toutes les légendes (une ou deux lignes) : bloc de titre de hauteur fixe.
  const haut = f.cadre ? 720 : f.hauteur / u - 36 - 95 - 22 - 34;
  const larg = f.cadre ? 332 : (haut * 390) / 844;
  const tel = f.cadre
    ? `.tel { width: ${px(larg)}; height: ${px(haut)}; border-radius: ${px(44)}; background: #0d0b0a; padding: ${px(9)}; box-sizing: border-box;
         box-shadow: 0 0 0 ${px(1.5)} #4a4038, 0 ${px(30)} ${px(60)} rgba(0,0,0,.55); }
       .tel img { border-radius: ${px(35)}; }`
    : `.tel { width: ${px(larg)}; height: ${px(haut)}; border-radius: ${px(26)}; overflow: hidden;
         box-shadow: 0 0 0 ${px(1.5)} #4a4038, 0 ${px(24)} ${px(48)} rgba(0,0,0,.5); }
       .tel img { border-radius: ${px(26)}; }`;
  return `<!doctype html><html lang="${langue}"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>
    @font-face { font-family: B; src: url(data:font/woff2;base64,${woff}) format('woff2'); font-weight: 200 800; }
    html, body { margin: 0; height: 100%; }
    body { background: radial-gradient(120% 45% at 50% 0%, #3a2f22 0%, #1C1916 60%); color: #F3EDE3; font-family: B, sans-serif;
      display: flex; flex-direction: column; align-items: center; overflow: hidden; }
    h1 { font-size: ${px(f.cadre ? 34 : 32)}; line-height: 1.12; font-weight: 750; letter-spacing: -0.01em; text-align: center;
      margin: ${px(f.cadre ? 50 : 36)} ${px(28)} ${px(f.cadre ? 28 : 22)}; height: ${px(f.cadre ? 100 : 95)}; box-sizing: border-box;
      display: flex; flex-direction: column; justify-content: flex-end; align-items: center; }
    h1 b { font-weight: inherit; text-wrap: balance; }
    h1 span { display: block; width: ${px(44)}; height: ${px(5)}; border-radius: ${px(3)}; background: #3CC48E; margin: 0 auto ${px(18)}; }
    .tel img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top; }
    ${tel}
  </style></head><body><h1><span></span><b>${legende}</b></h1><div class="tel"><img src="data:image/png;base64,${img}" alt=""></div></body></html>`;
}

for (const langue of LANGUES) {
  test(`composition des 6 captures (${langue})`, async ({ page }) => {
    const woff = police();
    for (const nom of CHOISIS) {
      const f = FORMATS[nom];
      expect(f, `format inconnu : ${nom}`).toBeTruthy();
      await page.setViewportSize({ width: f.largeur, height: f.hauteur });
      const dossier = join(SORTIE, langue, nom);
      mkdirSync(dossier, { recursive: true });
      for (const c of CAPTURES) {
        const img = readFileSync(join(BRUTES, langue, `${c.id}.png`)).toString('base64');
        await page.setContent(composition(langue, c[langue], img, woff, f));
        await page.evaluate(() => document.fonts.ready);
        // La légende tient sur deux lignes au plus.
        const lignes = await page.locator('h1 b').evaluate(b => Math.round(b.getBoundingClientRect().height / (parseFloat(getComputedStyle(b).fontSize) * 1.12)));
        expect(lignes, `${langue} ${nom} ${c.id} : légende trop longue`).toBeLessThanOrEqual(2);
        const chemin = join(dossier, `${c.id}.jpg`);
        await page.screenshot({ path: chemin, type: 'jpeg', quality: 82 });
        expect(statSync(chemin).size).toBeLessThan(1_000_000);
      }
    }
  });
}
