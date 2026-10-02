import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brancher, CODE, fauxServeur, JETON } from './fauxSupabase';
import { jouer, plateau } from './plateau';

// Audit visuel et d'usage du 2 octobre 2026 (docs/qa/audit-visuel-2026-10-02.md) : chaque écran de l'app, en 390 × 844
// et 320 × 568, clair et sombre, français et anglais. Pour chaque écran : une capture par thème dans
// docs/qa/captures/audit-02-10/, et des mesures (défilement horizontal, cibles sous 44 px, contraste des textes,
// textes coupés, nombre d'actions principales) écrites dans AUDIT_VISUEL (dossier des mesures).
// Lancement manuel seulement : AUDIT_VISUEL=<dossier des mesures> npx playwright test audit-visuel

const DOSSIER_MESURES = process.env.AUDIT_VISUEL;
test.skip(!DOSSIER_MESURES, 'Audit visuel : lancer avec AUDIT_VISUEL=<dossier>');
test.describe.configure({ mode: 'serial' });

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const CAPTURES = join(RACINE, 'docs', 'qa', 'captures', 'audit-02-10');
const SGF_9 = '(;GM[1]FF[4]SZ[9]KM[6.5]PB[florian_go]PW[Takumi88]RE[B+R];B[ee];W[cc];B[gc];W[ce];B[eg];W[cg];B[gg];W[dd];B[ed];W[ec];B[fc];W[eb];B[fb];W[dc];B[de];W[cd];B[df];W[cf];B[dg];W[dh];B[eh];W[ch])';

type Langue = 'fr' | 'en';
type Mesure = {
  ecran: string; theme: string; largeur: number;
  defilement: number; cibles: { texte: string; w: number; h: number }[]; principales: number;
  contrastes: { texte: string; ratio: number; couleur: string; fond: string; taille: number; gras: boolean }[];
  coupes: string[]; horsEcran: string[]; alertes: string[];
};

/** Mesures d'accessibilité et de mise en page de l'écran affiché (voir en-tête). */
async function mesurer(page: Page, ecran: string, theme: string, largeur: number): Promise<Mesure> {
  return page.evaluate(({ ecran, theme, largeur }) => {
    const vis = (el: Element) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && r.bottom > 0 && r.top < innerHeight;
    };
    const texteDe = (el: Element) => ((el as HTMLElement).innerText || el.getAttribute('aria-label') || el.tagName).replace(/\s+/g, ' ').trim().slice(0, 50);
    // Zone active : la fenêtre modale ouverte, sinon la page entière (ce qui est sous une modale n'est pas évalué).
    const modale = document.querySelector('dialog[open], [aria-modal="true"]');
    const racine: ParentNode = modale ?? document;
    const dansModale = (el: Element) => !modale || modale.contains(el);
    const cibles = [...racine.querySelectorAll('button, a[href], input, [role="button"], [role="switch"], [role="tab"], select, textarea')]
      .filter(el => vis(el) && dansModale(el) && !el.closest('[aria-hidden="true"]') && (el as HTMLInputElement).type !== 'checkbox')
      .map(el => { const r = el.getBoundingClientRect(); return { texte: texteDe(el), w: Math.round(r.width), h: Math.round(r.height), x: r.x }; })
      .filter(c => c.w < 44 || c.h < 44);
    const horsEcran = [...racine.querySelectorAll('button, a[href], input')].filter(vis)
      .filter(el => { const r = el.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1; }).map(texteDe);
    const principales = [...document.querySelectorAll('.cta, .btn.primary')].filter(vis).filter(dansModale).length;

    // Contraste WCAG : couleur du texte (avec son opacité) sur le premier fond opaque trouvé en remontant.
    const parse = (c: string): [number, number, number, number] => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return [0, 0, 0, 0];
      const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
    };
    const lum = ([r, g, b]: number[]) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const compose = (dessus: number[], dessous: number[]) => { const a = dessus[3]; return [0, 1, 2].map(i => Math.round(dessus[i] * a + dessous[i] * (1 - a))).concat(1); };
    const fondDe = (el: Element): { fond: number[]; via: string; incertain: boolean } => {
      let couches: number[][] = [];
      let incertain = false;
      let via = '';
      let e: Element | null = el;
      while (e) {
        const s = getComputedStyle(e);
        const bg = parse(s.backgroundColor);
        if (s.backgroundImage !== 'none' || e.tagName === 'IMG' || e.tagName === 'svg' || e.tagName === 'CANVAS') incertain = true;
        if (bg[3] > 0) { couches.push(bg); via = via || (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : e.tagName.toLowerCase()); if (bg[3] >= 1) break; }
        e = e.parentElement;
      }
      if (!couches.length || couches[couches.length - 1][3] < 1) couches.push([255, 255, 255, 1]);
      let fond = couches.pop()!;
      while (couches.length) fond = compose(couches.pop()!, fond);
      return { fond, via, incertain };
    };
    const ratio = (a: number[], b: number[]) => { const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x); return (l1 + 0.05) / (l2 + 0.05); };
    const contrastes: Mesure['contrastes'] = [];
    const vus = new Set<string>();
    const marche = document.createTreeWalker(racine instanceof Document ? racine.body : racine, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = marche.nextNode())) {
      const txt = (n.textContent ?? '').replace(/\s+/g, ' ').trim();
      const el = n.parentElement;
      if (!txt || !el || !vis(el) || el.closest('[aria-hidden="true"]') && !el.closest('button')) continue;
      if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName)) continue;
      const s = getComputedStyle(el);
      const taille = parseFloat(s.fontSize);
      const poids = parseInt(s.fontWeight, 10) || 400;
      const gras = poids >= 700;
      // Opacité héritée : l'élément et ses parents.
      let op = 1; let p: Element | null = el;
      while (p) { op *= parseFloat(getComputedStyle(p).opacity) || 1; p = p.parentElement; }
      const col = parse(s.color); col[3] *= op;
      const { fond, via, incertain } = fondDe(el);
      const couleur = compose(col, fond);
      const r = ratio(couleur, fond);
      const grand = taille >= 24 || (taille >= 18.66 && gras);
      const seuil = grand ? 3 : 4.5;
      const cle = txt.slice(0, 40) + '|' + via;
      if (r < seuil && !vus.has(cle)) {
        vus.add(cle);
        contrastes.push({ texte: txt.slice(0, 50) + (incertain ? ' [fond incertain]' : ''), ratio: Math.round(r * 100) / 100, couleur: `rgb(${couleur.slice(0, 3).join(',')})`, fond: `rgb(${fond.slice(0, 3).join(',')}) ${via}`, taille, gras });
      }
    }
    // Textes coupés : points de suspension actifs, ou boîte à débordement caché dont le texte dépasse.
    const coupes = [...racine.querySelectorAll('*')].filter(vis).filter(el => {
      const s = getComputedStyle(el);
      const he = el as HTMLElement;
      if (!he.innerText?.trim()) return false;
      if (s.textOverflow === 'ellipsis' && s.overflow !== 'visible' && he.scrollWidth > he.clientWidth + 1) return true;
      return s.overflowY === 'hidden' && he.scrollHeight > he.clientHeight + 2 && he.children.length === 0;
    }).map(texteDe);
    return { ecran, theme, largeur, defilement: document.documentElement.scrollWidth - innerWidth, cibles, principales, contrastes, coupes, horsEcran, alertes: [] };
  }, { ecran, theme, largeur });
}

/** Un écran : capture en sombre puis en clair (le thème est « auto »), et mesures pour chacun. */
async function capturer(page: Page, cfg: { largeur: number; langue: Langue }, ecran: string, mesures: Mesure[], options: { pleine?: boolean; reduire?: boolean } = {}) {
  mkdirSync(CAPTURES, { recursive: true });
  for (const theme of ['dark', 'light'] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: options.reduire === false ? 'no-preference' : 'reduce' });
    await page.waitForTimeout(250);
    const chemin = join(CAPTURES, `${ecran}-${cfg.largeur}-${theme === 'dark' ? 'sombre' : 'clair'}-${cfg.langue}.jpg`);
    await page.screenshot({ path: chemin, type: 'jpeg', quality: 82, fullPage: !!options.pleine });
    try { mesures.push(await mesurer(page, ecran, theme, cfg.largeur)); } catch (e) { mesures.push({ ecran, theme, largeur: cfg.largeur, defilement: 0, cibles: [], principales: 0, contrastes: [], coupes: [], horsEcran: [], alertes: [`mesure impossible : ${String(e).slice(0, 120)}`] }); }
  }
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
}

/** Une étape de l'audit : si elle échoue, on note et on continue (l'audit couvre le plus d'écrans possible). */
async function etape(nom: string, mesures: Mesure[], cfg: { largeur: number }, page: Page, f: () => Promise<void>) {
  // AUDIT_ETAPES=04,16 : ne joue que ces étapes (mise au point).
  const filtre = process.env.AUDIT_ETAPES?.split(',').filter(Boolean);
  if (filtre?.length && !filtre.some(p => nom.startsWith(p))) return;
  try { await f(); } catch (e) {
    const m = String(e).split('\n').filter(l => /Error|Locator|locator|Expected|Received|waiting/.test(l)).slice(0, 4).join(' / ').slice(0, 400);
    mesures.push({ ecran: nom, theme: '-', largeur: cfg.largeur, defilement: 0, cibles: [], principales: 0, contrastes: [], coupes: [], horsEcran: [], alertes: [`ÉTAPE ÉCHOUÉE : ${m}`] });
    await page.screenshot({ path: join(DOSSIER_MESURES!, `echec-${nom}-${cfg.largeur}.png`) }).catch(() => {});
  }
}

const T = {
  nonMerci: /^(Non merci|No thanks)$/, changer: /^(Changer|Change)$/, fermer: /^(Fermer|Close)$/,
  apprendre: /^(Apprendre|Learn)$/, problemes: /^(Problèmes|Puzzles)$/, profil: /^(Profil|Profile)$/,
  passer: /^(Passer|Pass)$/, passeGroupe: /^(Passer maintenant ?\?|Pass now\?)$/, valider: /^(Valider le score|Confirm score)$/,
  revoir: /^(Revoir ma partie|Review my game)$/, terminer: /^(Terminer la leçon|Finish the lesson)$/, pratique: /^(Entraîne-toi|Practice)/,
  reprendre: /^(Reprendre la leçon|Resume the lesson)/, tous: /^(Tous les problèmes|All puzzles)$/, probleme: /^(Problème|Puzzle) \d+/,
  cestParti: /^(C’est parti|Start)$/, saisJouer: /^(Je sais déjà jouer|I already know how to play)$/, passerPlacement: /^(Passer le placement|Skip the placement)$/,
  reglages: /^(Réglages|Settings)/, compte: /^(Mon compte|My account)/, conditions: /^(Conditions et confidentialité|Terms and privacy)$/,
  importer: /^(Analyser une partie|Analyze a game)/, lire: /^(Lire la partie|Read the game)$/, retour: /^(Retour|Back)$/,
  defier: /^(Défier un ami|Challenge a friend)/, envoyerLien: /^(Envoyer un lien|Send a link)$/, recevoirCode: /^(Recevoir mon code|Get my code)$/,
  dejaCompte: /^(J’ai déjà un compte|I already have an account)$/, creerCompte: /^(Créer un compte|Create an account)$/,
  monPseudo: /^(C’est mon pseudo|That’s my username)$/, pseudo: /^(Pseudo|Username)$/, email: /^(Ton adresse e-mail|Your email address)$/,
  partieDu: /^(Partie du|Game of)/, quitterCourse: /^(Quitter la course|Leave the rush)$/, suivant: /^(Problème suivant|Next puzzle)$/,
  retourChemin: /^(Retour au chemin|Back to the path)$/,
};

const nav = (page: Page, nom: RegExp) => page.getByRole('navigation').getByRole('button', { name: nom });
const barre = (page: Page) => page.getByRole('toolbar').first();
const boutonPasser = (page: Page) => barre(page).getByRole('button', { name: T.passer });

/** Passe, en confirmant si Mochi demande ; attend que la passe soit jouée ou la partie finie. */
async function passer(page: Page) {
  const avant = await page.locator('ol.coups > li:not(.vide)').count();
  const choix = page.getByRole('group', { name: T.passeGroupe });
  const fin = page.locator('.recit, .barre-comptage');
  await expect(boutonPasser(page)).toBeEnabled({ timeout: 15_000 });
  await boutonPasser(page).click();
  await expect.poll(async () => (await choix.count()) > 0 || (await page.locator('ol.coups > li:not(.vide)').count()) > avant || (await fin.count()) > 0, { timeout: 15_000 }).toBe(true);
  if (await choix.count()) await choix.getByRole('button', { name: T.passer }).click();
}

async function jusquAuScore(page: Page, avantValidation: () => Promise<void>) {
  const fin = page.locator('.recit, .barre-comptage');
  for (let i = 0; i < 8 && !(await fin.first().isVisible()); i++) {
    await passer(page);
    await expect.poll(async () => (await fin.first().isVisible()) || (await boutonPasser(page).isEnabled().catch(() => false)), { timeout: 15_000 }).toBe(true);
  }
  await expect(fin.first()).toBeVisible({ timeout: 15_000 });
  const valider = page.getByRole('button', { name: T.valider });
  if (await valider.isVisible()) { await expect(valider).toBeEnabled({ timeout: 15_000 }); await avantValidation(); await valider.click(); }
  await expect(page.locator('.recit')).toBeVisible({ timeout: 15_000 });
}

const CONFIGS: { largeur: number; hauteur: number; langue: Langue }[] = [
  { largeur: 390, hauteur: 844, langue: 'fr' }, { largeur: 320, hauteur: 568, langue: 'fr' },
  { largeur: 390, hauteur: 844, langue: 'en' }, { largeur: 320, hauteur: 568, langue: 'en' },
];

for (const cfg of CONFIGS) {
  const options = (baseURL: string | undefined, consent: boolean) => ({
    viewport: { width: cfg.largeur, height: cfg.hauteur }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: cfg.langue === 'fr' ? 'fr-FR' : 'en-US',
    timezoneId: 'Europe/Paris', colorScheme: 'dark' as const, reducedMotion: 'reduce' as const, baseURL,
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [
      { name: 'go.langue.v1', value: JSON.stringify(cfg.langue) }, ...(consent ? [{ name: 'go.consentement.v1', value: 'refuse' }] : []),
    ] }] },
  });
  const mesures: Mesure[] = [];
  const ecrire = () => { mkdirSync(DOSSIER_MESURES!, { recursive: true }); writeFileSync(join(DOSSIER_MESURES!, `mesures-${cfg.largeur}-${cfg.langue}.json`), JSON.stringify(mesures, null, 1)); };
  const erreursJs: string[] = [];

  test(`parcours libre ${cfg.largeur} px ${cfg.langue}`, async ({ browser, baseURL }) => {
    test.setTimeout(900_000);
    const ctx = await browser.newContext(options(baseURL, false));
    const page = await ctx.newPage();
    page.on('pageerror', e => erreursJs.push(`[libre] ${e.message}`));
    const cap = (ecran: string, o?: { pleine?: boolean }) => capturer(page, cfg, ecran, mesures, o);
    const E = (nom: string, f: () => Promise<void>) => etape(nom, mesures, cfg, page, f);

    // 1. Premier lancement : fenêtre de consentement, puis accueil.
    await E('01-consentement', async () => {
      await page.goto('/');
      await expect(page.getByRole('dialog')).toBeVisible();
      await cap('01-consentement');
      await page.getByRole('button', { name: T.nonMerci }).click();
    });
    await E('02-accueil', async () => {
      await expect(page.locator('.cta')).toBeVisible();
      await cap('02-accueil');
      await cap('02b-accueil-page', { pleine: true });
    });
    // 2. Choix de l'adversaire.
    await E('03-adversaires', async () => {
      await page.getByRole('button', { name: T.changer }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await cap('03-adversaires');
      await page.getByRole('dialog').getByRole('button', { name: T.fermer }).click();
    });
    // 3. Partie contre Pomme : début (bulle de Mochi), milieu, score, fin, revue.
    await E('04-partie', async () => {
      await page.goto('/?komi=-100');
      await page.locator('.cta').click();
      await expect(page.locator('.coach-intro')).toBeVisible();
      await cap('04-partie-debut');
      await jouer(page, 'E5');
      await expect(boutonPasser(page)).toBeEnabled({ timeout: 15_000 });
      for (const c of ['C3', 'G7', 'C7', 'G3']) {
        const avant = await plateau(page).locator('g[data-pierre]').count();
        await jouer(page, c);
        if ((await plateau(page).locator('g[data-pierre]').count()) === avant) continue;
        await expect(boutonPasser(page)).toBeEnabled({ timeout: 15_000 });
      }
      await cap('05-partie-milieu');
      await jusquAuScore(page, () => cap('06-comptage'));
      await cap('06b-score');
      await page.locator('.recit .cta, .cta').first().click();
      await expect(page.getByRole('button', { name: T.revoir })).toBeVisible();
      await cap('07-fin');
      await cap('07b-fin-page', { pleine: true });
      await page.getByRole('button', { name: T.revoir }).click();
      await expect(page.locator('.revue-analyse')).toHaveCount(0, { timeout: 90_000 });
      await page.evaluate(() => scrollTo(0, 0));
      await cap('08-revue');
      await cap('08b-revue-page', { pleine: true });
    });
    // 4. Apprendre : chemin, leçon 1, fin de leçon, entraînement.
    await E('09-apprendre', async () => {
      await page.goto('/');
      await nav(page, T.apprendre).click();
      await expect(page.locator('.cta')).toBeVisible();
      await cap('09-apprendre');
      await cap('09b-apprendre-page', { pleine: true });
      await page.locator('.cta').click();
      await expect(page.locator('.lecteur-plateau')).toBeVisible();
      await cap('10-lecon-debut');
      await jouer(page, 'E5');
      await page.waitForTimeout(400);
      await cap('10b-lecon-etape');
    });
    await E('10c-lecon-fin', async () => {
      await page.evaluate(() => localStorage.setItem('go.lecons.v1', JSON.stringify({ l1: 5 })));
      await page.goto('/');
      await nav(page, T.apprendre).click();
      await page.getByRole('button', { name: T.reprendre }).click();
      await jouer(page, 'E4');
      await page.getByRole('button', { name: T.terminer }).click();
      await expect(page.getByRole('button', { name: T.pratique })).toBeVisible();
      await cap('10c-lecon-fin');
      await page.getByRole('button', { name: T.pratique }).click();
      await expect(plateau(page)).toBeVisible();
      await cap('11-entrainement');
      await jouer(page, 'A1');
      await expect(page.locator('.verdict')).toBeVisible();
      await cap('11b-entrainement-verdict');
    });
    // 5. Problèmes : liste, tous, un problème et son verdict, Go du jour, course.
    await E('12-problemes', async () => {
      await page.goto('/');
      await nav(page, T.problemes).click();
      await expect(page.getByRole('button', { name: T.tous })).toBeVisible();
      await cap('12-problemes');
      await cap('12b-problemes-page', { pleine: true });
      await page.getByRole('button', { name: T.tous }).click();
      await expect(page.getByRole('button', { name: T.probleme }).first()).toBeVisible();
      await cap('12c-problemes-tous', { pleine: true });
      await page.getByRole('button', { name: T.probleme }).first().click();
      await expect(plateau(page)).toBeVisible();
      await cap('13-probleme');
      await jouer(page, 'A1');
      await expect(page.locator('.verdict')).toBeVisible();
      await cap('13b-probleme-verdict');
    });
    await E('14-go-du-jour', async () => {
      await page.goto('/?go-du-jour=1');
      await expect(plateau(page)).toBeVisible();
      await cap('14-go-du-jour');
      await jouer(page, 'E5');
      await expect(page.locator('.verdict')).toBeVisible();
      await page.waitForTimeout(3500);
      await cap('14b-go-du-jour-bravo');
    });
    await E('15-course', async () => {
      await page.goto('/');
      await nav(page, T.problemes).click();
      await page.locator('[data-course]').click();
      await expect(page.getByRole('button', { name: T.cestParti })).toBeVisible();
      await cap('15-course-regles');
      await page.getByRole('button', { name: T.cestParti }).click();
      await expect(plateau(page)).toBeVisible();
      await cap('15b-course');
    });
    // 6. Placement « Je sais déjà jouer » (accueil d'un joueur qui n'a pas encore joué).
    await E('16-placement', async () => {
      await page.evaluate(() => { const l = localStorage.getItem('go.langue.v1'); localStorage.clear(); localStorage.setItem('go.consentement.v1', 'refuse'); if (l) localStorage.setItem('go.langue.v1', l); });
      await page.goto('/');
      await page.getByRole('button', { name: T.saisJouer }).click();
      await expect(page.locator('.placement')).toBeVisible();
      await cap('16-placement');
      for (const c of ['A1', 'J1', 'A9', 'J9']) { await jouer(page, c, Number(await page.locator('.placement').getAttribute('data-taille')) || 9).catch(() => {}); if (await page.locator('.verdict').isVisible()) break; }
      await expect(page.locator('.verdict')).toBeVisible();
      await cap('16b-placement-verdict');
      for (let i = 0; i < 3; i++) {
        await page.locator('.verdict .cta').click();
        if (await page.getByTestId('placement-fin').isVisible().catch(() => false)) break;
        for (const c of ['A1', 'J1', 'A9', 'J9', 'B2']) { await jouer(page, c).catch(() => {}); if (await page.locator('.verdict').isVisible()) break; }
        await expect(page.locator('.verdict')).toBeVisible();
      }
      await expect(page.getByTestId('placement-fin')).toBeVisible();
      await cap('16c-placement-fin');
      await cap('16d-placement-fin-page', { pleine: true });
    });
    // 7. Profil et ses sous-vues.
    await E('17-profil', async () => {
      await page.goto('/');
      await nav(page, T.profil).click();
      await expect(page.getByRole('button', { name: T.reglages })).toBeVisible();
      await cap('17-profil');
      await cap('17b-profil-page', { pleine: true });
      await page.getByRole('button', { name: T.reglages }).click();
      await expect(page.getByRole('button', { name: T.retour })).toBeVisible();
      await cap('18-reglages');
      await cap('18b-reglages-page', { pleine: true });
      await page.getByRole('button', { name: T.retour }).click();
      await page.getByRole('button', { name: T.compte }).click();
      await cap('19-compte-sans-service');
      await page.getByRole('button', { name: T.retour }).click();
      await page.getByRole('button', { name: T.conditions }).click();
      await cap('20-conditions');
      await cap('20b-conditions-page', { pleine: true });
      await page.getByRole('button', { name: T.retour }).click();
      await page.getByRole('button', { name: T.importer }).click();
      await expect(page.getByRole('button', { name: T.lire })).toBeVisible();
      await cap('21-import');
      await cap('21b-import-page', { pleine: true });
      const texte = page.locator('textarea');
      await texte.fill('ma partie de dimanche');
      await page.getByRole('button', { name: T.lire }).click();
      await expect(page.getByRole('alert')).toBeVisible();
      await cap('21c-import-erreur');
      await texte.fill(SGF_9);
      await page.getByRole('button', { name: T.lire }).click();
      await expect(page.getByRole('button', { name: /Noir|Black/ }).first()).toBeVisible();
      await cap('21d-import-couleur');
    });
    ecrire();
    await ctx.close();
  });

  test(`compte et défi ${cfg.largeur} px ${cfg.langue}`, async ({ browser, baseURL }) => {
    test.setTimeout(600_000);
    const serveur = fauxServeur();
    const ctxA = await browser.newContext(options(baseURL, true));
    const a = await brancher(ctxA, serveur, { 'go.essai.v1': JSON.stringify({ terminees: 3 }) });
    a.on('pageerror', e => erreursJs.push(`[compte] ${e.message}`));
    const capA = (ecran: string, o?: { pleine?: boolean }) => capturer(a, cfg, ecran, mesures, o);
    const E = (nom: string, f: () => Promise<void>) => etape(nom, mesures, cfg, a, f);

    await E('22-creer-compte', async () => {
      await a.goto('/');
      await a.locator('.cta').click();
      await expect(a.getByTestId('creer-compte')).toBeVisible();
      await capA('22-creer-compte');
      await capA('22b-creer-compte-page', { pleine: true });
      await a.getByRole('button', { name: T.dejaCompte }).click();
      await expect(a.getByRole('button', { name: T.creerCompte })).toBeVisible();
      await capA('23-connexion');
      await a.getByLabel(T.email).fill('inconnu@exemple.test');
      await a.getByRole('button', { name: T.recevoirCode }).click();
      await expect(a.getByRole('alert')).toBeVisible();
      await capA('23b-connexion-erreur');
      await a.getByRole('button', { name: T.creerCompte }).click();
      await a.getByLabel(T.email).fill('pas-une-adresse');
      await a.getByRole('button', { name: T.recevoirCode }).click({ force: true });
      await expect(a.getByRole('alert').or(a.locator('[role="status"]')).first()).toBeVisible();
      await capA('22c-creer-compte-erreurs');
      await a.getByLabel(T.email).fill('audit@exemple.test');
      await a.getByRole('checkbox').check();
      await a.getByRole('button', { name: T.recevoirCode }).click();
      const champ = a.getByLabel(/6/);
      await expect(champ).toBeVisible();
      await capA('24-code');
      await champ.fill('000000');
      await expect(a.getByRole('alert')).toBeVisible();
      await capA('24b-code-erreur');
      await champ.fill(CODE);
      await expect(a.getByTestId('pseudo-obligatoire')).toBeVisible();
      await capA('25-pseudo');
      await a.getByRole('textbox', { name: T.pseudo }).fill('pris');
      await a.waitForTimeout(600);
      await capA('25b-pseudo-pris');
      await a.getByRole('textbox', { name: T.pseudo }).fill('Audit_1');
      await expect(a.getByText(/Audit_1/).first()).toBeVisible();
      await a.waitForTimeout(400);
      await capA('25c-pseudo-libre');
      await a.getByRole('button', { name: T.monPseudo }).click();
      await expect(plateau(a)).toBeVisible();
    });
    let lien = '';
    await E('26-defi-creer', async () => {
      await a.goto('/');
      await a.getByTestId('lien-defi').click();
      await expect(a.getByRole('button', { name: T.envoyerLien })).toBeVisible();
      await capA('26-defi-creer');
      await a.getByRole('button', { name: T.envoyerLien }).click();
      await expect(a.getByTestId('defi-lien')).toBeVisible();
      await capA('26b-defi-lien');
      lien = await a.getByTestId('defi-lien').locator('input').inputValue();
    });
    const ctxB = await browser.newContext(options(baseURL, true));
    const b = await brancher(ctxB, serveur);
    b.on('pageerror', e => erreursJs.push(`[defi] ${e.message}`));
    const capB = (ecran: string, o?: { pleine?: boolean }) => capturer(b, cfg, ecran, mesures, o);
    await E('27-defi-arrivee', async () => {
      await b.goto(lien || `/#defi=${JETON}&de=Audit_1`);
      await expect(b.getByRole('button', { name: T.recevoirCode })).toBeVisible();
      await capB('27-defi-arrivee');
      await capB('27b-defi-arrivee-page', { pleine: true });
      await b.getByLabel(T.email).fill('ami@exemple.test');
      await b.getByRole('checkbox').check();
      await b.getByRole('button', { name: T.recevoirCode }).click();
      await b.getByLabel(/6/).fill(CODE);
      await b.getByRole('textbox', { name: T.pseudo }).fill('Ami_du_go');
      await expect(b.getByText(/Ami_du_go/).first()).toBeVisible();
      await b.getByRole('button', { name: T.monPseudo }).click();
      await expect(plateau(b)).toBeVisible();
      await capB('28-defi-partie-a-toi');
      await jouer(b, 'E5');
      await expect(plateau(b).locator('g[data-pierre="noir"]')).toHaveCount(1);
      await capB('28b-defi-partie-a-lui');
    });
    await E('28c-defi-liste', async () => {
      await a.goto('/');
      await a.getByTestId('lien-defi').click();
      await expect(a.getByRole('button', { name: T.partieDu })).toBeVisible();
      await capA('28c-defi-liste');
      await a.getByRole('button', { name: T.partieDu }).click();
      await expect(plateau(a)).toBeVisible();
      await capA('28d-defi-partie-createur');
    });
    await E('29-compte-connecte', async () => {
      await a.goto('/');
      await nav(a, T.profil).click();
      await capA('17c-profil-connecte');
      await a.getByRole('button', { name: T.compte }).click();
      await expect(a.getByRole('button', { name: T.retour })).toBeVisible();
      await a.waitForTimeout(500);
      await capA('29-compte-connecte');
      await capA('29b-compte-connecte-page', { pleine: true });
    });
    await E('30-defi-lien-abime', async () => {
      await b.goto('/#defi=abc');
      await expect(b.getByRole('alert')).toBeVisible();
      await capB('30-defi-lien-abime');
    });
    mesures.push({ ecran: 'erreurs-js', theme: '-', largeur: cfg.largeur, defilement: 0, cibles: [], principales: 0, contrastes: [], coupes: [], horsEcran: [], alertes: erreursJs });
    ecrire();
    await ctxA.close();
    await ctxB.close();
  });
}
