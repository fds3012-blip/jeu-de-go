import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { brancher, fauxServeur } from './fauxSupabase';
import { choisirMode, jouer, ouvrirPlus, passerJusquAuScore, plateau } from './plateau';
import { GO_DU_JOUR } from '../src/content/goDuJour.gen';
import { demarrerParcours, ouvrirRevue, preparerRevue } from './revueFactice';

// #461 : audit WCAG 2.1 AA outillé. axe-core (règles wcag2a, wcag2aa, wcag21a, wcag21aa) passe sur chaque écran clé
// des parcours principaux, en sombre puis en clair. Aucune violation tolérée : un écran qui régresse casse la CI.
// axe-core vit seulement ici (dépendance de test, licence MPL-2.0) : il n'entre pas dans le bundle de l'app.
// Rapport : docs/qa/audit-accessibilite-2026-10.md.

const REGLES = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

// Le fond de page est un dégradé (le halo de lampe, --halo dans src/ui/tokens.css) : axe ne sait pas mesurer un texte
// posé dessus et classe tous ces contrastes « à revoir », sans les vérifier. Pendant la mesure, le halo est remplacé
// par sa couleur la plus forte à l'écran, en aplat : le pire cas. Son centre est 120 px au-dessus de la page et il
// s'éteint à 70 % de 420 px ; en haut de la page, l'or #EFB84A y pèse donc 0,22 × (1 − 120/294) ≈ 13 % en clair
// (0,11 × … ≈ 6,5 % en sombre) sur --bg. Rien d'autre n'est retouché.
const HALO_PIRE = { dark: 'rgb(42, 35, 25)', light: 'rgb(239, 226, 201)' } as const;

/** Lance axe sur la page en sombre puis en clair (thème « auto » de l'app), mouvements réduits, et liste les violations. */
async function verifier(page: Page, ecran: string) {
  const trouvees: string[] = [];
  for (const theme of ['dark', 'light'] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    // Laisse les transitions de couleur (thème) se terminer avant de mesurer les contrastes.
    await page.waitForTimeout(300);
    const aplat = await page.addStyleTag({ content: `body { background: ${HALO_PIRE[theme]} !important; }` });
    const { violations, incomplete } = await new AxeBuilder({ page }).withTags(REGLES).analyze();
    await aplat.evaluate(el => (el as Element).remove());
    // AXE_INCOMPLETS=1 : affiche aussi les points qu'axe ne sait pas trancher (revue manuelle de l'audit).
    if (process.env.AXE_INCOMPLETS) {
      for (const v of incomplete) console.log(`[à revoir] ${ecran} [${theme}] ${v.id} : ${v.nodes.map(n => `${n.target.join(' ')} (${n.any[0]?.message ?? ''})`).slice(0, 6).join(' | ')}`);
    }
    for (const v of violations) {
      const cibles = v.nodes.slice(0, 4).map(n => `${n.target.join(' ')}${n.failureSummary ? ` (${n.failureSummary.split('\n').slice(1, 2).join('').trim().slice(0, 140)})` : ''}`);
      trouvees.push(`[${theme === 'dark' ? 'sombre' : 'clair'}] ${v.id} (${v.impact}) : ${v.help}\n    ${cibles.join('\n    ')}`);
    }
  }
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  expect(trouvees, `${ecran} : violations axe\n${trouvees.join('\n')}`).toEqual([]);
}

const nav = (page: Page, nom: string) => page.getByRole('navigation').getByRole('button', { name: nom });

test.use({ colorScheme: 'dark', reducedMotion: 'reduce' });
// axe mesure chaque nœud (contrastes compris), deux fois par écran : plus long qu'un parcours ordinaire.
test.describe.configure({ timeout: 120_000 });

test.describe('premier lancement', () => {
  // Stockage vide : la fenêtre de consentement s'ouvre, comme au tout premier lancement.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('axe : première ouverture (consentement), accueil, choix de l’adversaire', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('dialog')).toBeVisible();
    await verifier(page, 'Consentement');
    await page.getByRole('button', { name: 'Non merci' }).click();

    await expect(page.locator('.cta')).toBeVisible();
    await verifier(page, 'Accueil (premier lancement)');

    await page.getByRole('button', { name: 'Changer' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await verifier(page, 'Feuille « Ton adversaire »');
  });
});

test('axe : accueil d’un joueur qui revient (Aujourd’hui) et feuille « Plus » des modes', async ({ context }) => {
  // Les modes en ligne (et donc « Plus ») n'existent qu'avec un serveur : Supabase simulé.
  const page = await brancher(context, fauxServeur(), {
    'go.parties.v1': JSON.stringify({ n: 3, dernier: 'pomme', ordi: 3 }),
    'go.bilan.v1': JSON.stringify({ pomme: { v: 1, d: 2 } }),
    'go.xp.v1': '40',
    'go.lecons.v1': JSON.stringify({ l1: 5 }),
  });
  await page.goto('/');
  await expect(page.locator('.cta')).toBeVisible();
  await verifier(page, 'Accueil (joueur qui revient)');
  await page.getByTestId('mode-plus').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await verifier(page, 'Feuille « Plus » des modes');
});

test('axe : partie contre l’ordi (début, menu Plus, coups joués), récit du score et fin de partie', async ({ page }) => {
  await page.goto('/?komi=-100');
  await page.locator('.cta').click();
  await expect(plateau(page)).toBeVisible();
  await verifier(page, 'Partie, début');

  await jouer(page, 'E5');
  await expect(page.getByRole('toolbar').getByRole('button', { name: 'Passer', exact: true })).toBeEnabled({ timeout: 10_000 });
  await ouvrirPlus(page);
  await verifier(page, 'Partie, menu Plus ouvert');
  await page.keyboard.press('Escape');

  await passerJusquAuScore(page);
  await expect(page.locator('.recit')).toBeVisible();
  await verifier(page, 'Récit du score');
  await expect(page.getByRole('heading', { level: 2, name: 'Victoire' })).toBeVisible({ timeout: 15_000 });
  await verifier(page, 'Fin de partie (victoire)');
});

test('axe : revue d’une partie (bilan puis parcours des coups)', async ({ page }) => {
  await preparerRevue(page);
  await ouvrirRevue(page);
  await expect(page.getByRole('button', { name: 'Démarrer le bilan' })).toBeVisible({ timeout: 90_000 });
  await verifier(page, 'Revue, bilan');
  await demarrerParcours(page, 6);
  await verifier(page, 'Revue, parcours au coup 6');
});

test('axe : Apprendre, leçon 1 (étape interactive) et fin de leçon', async ({ page }) => {
  await page.goto('/');
  await nav(page, 'Apprendre').click();
  await expect(page.getByRole('button', { name: /^Leçon 1 :/ })).toBeVisible();
  await verifier(page, 'Apprendre, chemin des leçons');

  await page.locator('.cta').click();
  await expect(page.locator('.lecteur-plateau')).toBeVisible();
  await verifier(page, 'Leçon 1, début');

  await page.evaluate(() => localStorage.setItem('go.lecons.v1', JSON.stringify({ l1: 5 })));
  await page.goto('/');
  await nav(page, 'Apprendre').click();
  await page.getByRole('button', { name: /^Reprendre la leçon/ }).click();
  await jouer(page, 'E4');
  await page.getByRole('button', { name: 'Terminer la leçon' }).click();
  await expect(page.getByRole('button', { name: /^Entraîne-toi/ })).toBeVisible();
  await verifier(page, 'Leçon 1, fin');
});

test('axe : Problèmes, un problème et son verdict, Go du jour', async ({ page }) => {
  await page.goto('/');
  await nav(page, 'Problèmes').click();
  await expect(page.getByRole('button', { name: 'Tous les problèmes' })).toBeVisible();
  await verifier(page, 'Problèmes');

  await page.getByRole('button', { name: 'Tous les problèmes' }).click();
  await expect(page.getByRole('button', { name: /^Problème \d+/ }).first()).toBeVisible();
  await verifier(page, 'Tous les problèmes');
  await page.getByRole('button', { name: /^Problème \d+/ }).first().click();
  await expect(plateau(page)).toBeVisible();
  await verifier(page, 'Problème');
  await jouer(page, 'A1');
  await expect(page.locator('.verdict')).toBeVisible();
  await verifier(page, 'Problème, verdict');

  await page.goto('/?go-du-jour=1');
  await expect(plateau(page)).toBeVisible();
  await verifier(page, 'Go du jour');
});

test('axe : Profil, Réglages, Mon compte (sans compte), Conditions', async ({ page }) => {
  await page.goto('/');
  await nav(page, 'Profil').click();
  await expect(page.getByRole('button', { name: /^Réglages/ })).toBeVisible();
  await verifier(page, 'Profil');

  await page.getByRole('button', { name: /^Réglages/ }).click();
  await expect(page.getByRole('button', { name: 'Retour' })).toBeVisible();
  await verifier(page, 'Réglages');
  await page.getByRole('button', { name: 'Retour' }).click();

  await page.getByRole('button', { name: /^Mon compte/ }).click();
  await expect(page.getByRole('button', { name: 'Retour' })).toBeVisible();
  await verifier(page, 'Mon compte (sans compte)');
  await page.getByRole('button', { name: 'Retour' }).click();

  await page.getByRole('button', { name: 'Conditions et confidentialité' }).click();
  await expect(page.getByRole('button', { name: 'Retour' })).toBeVisible();
  await verifier(page, 'Conditions et confidentialité');
});

test('axe : créer un compte, connexion, code, pseudo, Mon compte connecté', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR', baseURL, colorScheme: 'dark', reducedMotion: 'reduce',
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }] }] },
  });
  // Trois parties d'essai jouées : la suivante demande un compte.
  const page = await brancher(ctx, serveur, { 'go.essai.v1': JSON.stringify({ terminees: 3 }) });
  await page.goto('/');
  await page.locator('.cta').click();
  await expect(page.getByTestId('creer-compte')).toBeVisible();
  await verifier(page, 'Créer un compte');

  await page.getByRole('button', { name: 'J’ai déjà un compte' }).click();
  await expect(page.getByRole('button', { name: 'Créer un compte' })).toBeVisible();
  await verifier(page, 'Connexion');
  await page.getByLabel('Ton adresse e-mail').fill('inconnu@exemple.test');
  await page.getByRole('button', { name: 'Recevoir mon code' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await verifier(page, 'Connexion, adresse inconnue');

  await page.getByRole('button', { name: 'Créer un compte' }).click();
  await page.getByLabel('Ton adresse e-mail').fill('audit@exemple.test');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Recevoir mon code' }).click();
  const code = page.getByLabel('Code à 6 chiffres');
  await expect(code).toBeVisible();
  await verifier(page, 'Code reçu par e-mail');
  await code.fill('000000');
  await expect(page.getByRole('alert')).toBeVisible();
  await verifier(page, 'Code faux');
  await code.fill('123456');
  await expect(page.getByTestId('pseudo-obligatoire')).toBeVisible();
  await page.getByRole('textbox', { name: 'Pseudo' }).fill('Audit_1');
  await expect(page.getByText('Audit_1 est libre.')).toBeVisible();
  await verifier(page, 'Choix du pseudo');
  await page.getByRole('button', { name: 'C’est mon pseudo' }).click();
  await expect(plateau(page)).toBeVisible();

  await page.goto('/');
  await nav(page, 'Profil').click();
  await page.getByRole('button', { name: /^Mon compte/ }).click();
  await expect(page.getByRole('button', { name: 'Retour' })).toBeVisible();
  await verifier(page, 'Mon compte (connecté)');
  await ctx.close();
});

// Coordonnées du plateau (#461) : axe ne mesure pas un texte SVG posé sur une image (le bois). On mesure au pixel : le
// bois sous chaque lettre (lettres masquées le temps de la capture, gardée en mémoire), contre l'encre du thème, ou
// contre son liseré s'il en a un. WCAG 1.4.3 : 4,5:1 (les lettres font 12 px).
for (const theme of ['kaya', 'kaya-clair', 'ardoise', 'coquillage-dore']) {
  test(`coordonnées lisibles sur le bois « ${theme} » (4,5:1, mesuré au pixel)`, async ({ page }) => {
    await page.addInitScript(t => { localStorage.setItem('go.xp.v1', '99999'); localStorage.setItem('go.themeGoban.v1', JSON.stringify(t)); }, theme);
    await page.goto('/?go-du-jour=1');
    const svg = plateau(page);
    await expect(svg).toBeVisible();
    const g = svg.locator('g.coord');
    const encre = await g.evaluate(el => ({ fill: el.getAttribute('fill')!, lisere: el.getAttribute('stroke') }));
    const boites = await g.locator('text').evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }));
    expect(boites).toHaveLength(18);
    await g.evaluate(el => el.setAttribute('visibility', 'hidden'));
    const cadre = (await svg.boundingBox())!;
    const png = (await page.screenshot({ clip: cadre, scale: 'css' })).toString('base64');
    const ratios = await page.evaluate(async ({ png, boites, cadre, encre }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${png}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const rvb = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
      const lum = ([r, g, b]: number[]) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const ratio = (a: number[], b: number[]) => { const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x); return (l1 + 0.05) / (l2 + 0.05); };
      return boites.map(b => {
        if (encre.lisere) return ratio(rvb(encre.fill), rvb(encre.lisere));
        const d = ctx.getImageData(Math.max(0, b.x - cadre.x), Math.max(0, b.y - cadre.y), Math.max(1, b.w), Math.max(1, b.h)).data;
        const m = [0, 0, 0];
        for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) m[k] += d[i + k] / (d.length / 4);
        return ratio(rvb(encre.fill), m);
      });
    }, { png, boites, cadre, encre });
    expect(Math.min(...ratios), `contrastes des coordonnées : ${ratios.map(r => r.toFixed(2)).join(' ')}`).toBeGreaterThanOrEqual(4.5);
  });
}

/** Éléments visibles qui sortent de la fenêtre (à gauche ou à droite), hors bandes à défilement horizontal. */
async function horsFenetre(page: Page): Promise<string[]> {
  return page.evaluate(() => [...document.querySelectorAll('button, a[href], h1, h2, p, b, small, span')].filter(e => {
    const r = e.getBoundingClientRect(), s = getComputedStyle(e);
    if (!r.width || s.visibility === 'hidden' || e.closest('[aria-hidden="true"], svg, .sr-only, ol')) return false;
    return r.left < -1 || r.right > innerWidth + 1;
  }).map(e => `${e.tagName.toLowerCase()}.${String((e as HTMLElement).className).split(' ')[0]} « ${(e.textContent ?? '').trim().slice(0, 30)} » ${Math.round(e.getBoundingClientRect().left)}→${Math.round(e.getBoundingClientRect().right)}`));
}

test.describe('zoom 200 % (195 px CSS), polices web bloquées', () => {
  test.use({ viewport: { width: 195, height: 422 } });
  test.beforeEach(async ({ context }) => { await context.route(/\.(woff2?|ttf|otf)(\?.*)?$/, r => r.abort()); });

  test('partie : la barre d’actions passe sur deux rangées, cibles de 44 px, rien hors de l’écran', async ({ page }) => {
    await page.goto('/');
    await page.locator('.cta').click();
    await expect(plateau(page)).toBeVisible();
    const boutons = page.getByRole('toolbar', { name: 'Actions de la partie' }).getByRole('button');
    await expect(boutons.first()).toBeVisible();
    for (const b of await boutons.all()) {
      const r = (await b.boundingBox())!;
      expect(r.width, await b.innerText()).toBeGreaterThanOrEqual(44);
      expect(r.height).toBeGreaterThanOrEqual(44);
    }
    expect(await horsFenetre(page)).toEqual([]);
  });

  test('Profil et Réglages : « Aide » dans l’écran, « Niv. 3 » en 12 px au moins', async ({ page }) => {
    await page.goto('/');
    await nav(page, 'Profil').click();
    await expect(page.getByRole('button', { name: /^Réglages/ })).toBeVisible();
    expect(await horsFenetre(page)).toEqual([]);
    await page.getByRole('button', { name: /^Réglages/ }).click();
    const niveau = page.locator('.pastille-niveau').first();
    await expect(niveau).toBeVisible();
    expect(parseFloat(await niveau.evaluate(e => getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(12);
    expect(await horsFenetre(page)).toEqual([]);
  });
});

test('revue : les flèches coup précédent / suivant sont des chevrons au trait, de la couleur du texte', async ({ page }) => {
  await preparerRevue(page);
  await ouvrirRevue(page);
  await demarrerParcours(page, 6);
  for (const nom of ['Coup précédent', 'Coup suivant']) {
    const s = await page.getByRole('button', { name: nom, exact: true }).locator('svg').evaluate(svg => {
      const c = getComputedStyle(svg), b = getComputedStyle(svg.closest('button')!);
      return { fill: c.fill, stroke: c.stroke, texte: b.color };
    });
    expect(s.fill).toBe('none');
    expect(s.stroke).toBe(s.texte);
  }
});

// #465 : jouer en ligne. Le choix et l'attente du direct, et les parties lentes, gardent l'en-tête et la barre du bas.
test('axe : jouer en ligne (direct : choix et attente ; parties lentes)', async ({ context }) => {
  const serveur = fauxServeur();
  const page = await brancher(context, serveur, {
    'go.parties.v1': JSON.stringify({ n: 3 }),
    'sb-supabase-auth-token': JSON.stringify(serveur.sessionCompte('ana.axe@exemple.test', 'Ana', '00000000-0000-4000-8000-0000000465c3')),
  });
  await page.goto('/');
  await choisirMode(page, 'en_ligne');
  const bascule = page.getByTestId('bascule-en-ligne');
  await bascule.getByRole('button', { name: 'En direct' }).click();
  await expect(page.getByTestId('direct-choix')).toBeVisible();
  await verifier(page, 'En direct, choix');
  await bascule.getByRole('button', { name: 'Partie lente' }).click();
  await expect(page.getByTestId('lentes')).toBeVisible();
  await verifier(page, 'Parties lentes');
  await page.getByTestId('bascule-en-ligne').getByRole('button', { name: 'En direct' }).click();
  await page.getByRole('button', { name: 'Trouver un adversaire' }).click();
  await expect(page.getByTestId('direct-attente')).toBeVisible();
  await verifier(page, 'En direct, attente');
});

// #465 (audit #461, C) : espacement du texte forcé (WCAG 1.4.12). Aucun texte coupé par « … » (ellipse ou nombre de
// lignes limité), sur l'accueil (avec chacun des titres du Go du jour) et sur le Profil.
const ESPACEMENT = `*, *::before, *::after { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; }
  p { margin-bottom: 2em !important; }`;
async function textesCoupes(page: Page): Promise<string[]> {
  return page.evaluate(() => [...document.querySelectorAll<HTMLElement>('body *')].filter(e => {
    if (!e.getClientRects().length || e.closest('[aria-hidden="true"], .sr-only, svg')) return false;
    const s = getComputedStyle(e);
    if (s.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1) return true;
    return s.webkitLineClamp !== 'none' && s.webkitLineClamp !== '' && e.scrollHeight > e.clientHeight + 1;
  }).map(e => `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} « ${(e.textContent ?? '').trim().slice(0, 40)} »`));
}
test('espacement du texte forcé (1.4.12) : accueil et Profil sans texte coupé', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.cta')).toBeVisible();
  await page.addStyleTag({ content: ESPACEMENT });
  // #487 : tout premier lancement (accueil épuré), puis l'accueil complet dès qu'une pierre est posée.
  await expect(page.locator('.accueil[data-epure]')).toBeVisible();
  expect(await textesCoupes(page), 'Accueil épuré').toEqual([]);
  await page.evaluate(() => { localStorage.setItem('go.premiere-pierre.v1', 'true'); window.dispatchEvent(new Event('go:premiere-pierre')); });
  await expect(page.locator('.tuile-probleme')).toBeVisible();
  expect(await textesCoupes(page), 'Accueil').toEqual([]);
  // Tous les titres du Go du jour, posés tour à tour dans la tuile (le titre du jour change chaque jour).
  const titre = page.locator('.tuile-probleme b');
  for (const [, t] of GO_DU_JOUR) {
    await titre.evaluate((b, x) => { b.textContent = x; }, t);
    expect(await textesCoupes(page), `Accueil, Go du jour « ${t} »`).toEqual([]);
  }
  await nav(page, 'Profil').click();
  await expect(page.getByRole('button', { name: /^Réglages/ })).toBeVisible();
  await page.addStyleTag({ content: ESPACEMENT });
  expect(await textesCoupes(page), 'Profil').toEqual([]);
});
