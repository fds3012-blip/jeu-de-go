import { expect, test, type Browser, type Page } from '@playwright/test';
import { brancher, fauxServeur, type FauxServeur } from './fauxSupabase';
import { choisirMode, lancerADeux } from './plateau';

// Issue #7 : première ouverture et navigation entre les onglets (viewport iPhone 390 × 844).

test("première ouverture : l'accueil s'affiche en moins de 3 secondes", async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));

  // #467 : l'instant où l'action principale apparaît est relevé dans la page, depuis le début de la navigation
  // (ce que voit le joueur), plus par l'horloge de Playwright : sous charge, ses allers-retours ajoutaient du temps.
  await page.addInitScript(() => {
    const w = window as unknown as { __ctaVisible?: number };
    const voir = () => {
      const cta = document.querySelector('.cta');
      if (w.__ctaVisible === undefined && cta && cta.getBoundingClientRect().height > 0) { w.__ctaVisible = performance.now(); mo.disconnect(); }
    };
    const mo = new MutationObserver(voir);
    mo.observe(document, { childList: true, subtree: true });
  });
  await page.goto('/');
  // L'action principale de l'accueil est visible et utilisable.
  const cta = page.locator('.cta');
  await expect(cta).toBeVisible();
  await expect(cta).toBeInViewport();
  const visible = await page.evaluate(() => (window as unknown as { __ctaVisible?: number }).__ctaVisible);
  expect(visible, 'instant d’apparition relevé').toBeDefined();
  expect(visible!).toBeLessThan(3000);

  await expect(page.getByRole('heading', { level: 1, name: 'Mochi Go' })).toBeVisible();
  // #487 : tout premier lancement, aucune pierre posée : pas encore de tuiles, une seule action.
  await expect(page.locator('.accueil[data-epure]')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Go du jour n°\s\d+/ })).toHaveCount(0);
  // Dès qu'une pierre est posée (repère de l'appareil), les deux tuiles : problème du jour et leçon suivante.
  await page.evaluate(() => { localStorage.setItem('go.premiere-pierre.v1', 'true'); window.dispatchEvent(new Event('go:premiere-pierre')); });
  await expect(page.getByRole('button', { name: /^Go du jour n°\s\d+/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Leçon 1 sur \d+/ })).toBeVisible();
  // Pas de défilement horizontal sur un écran de téléphone.
  const debord = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(debord).toBeLessThanOrEqual(0);
  expect(erreurs).toEqual([]);
});

test('navigation entre les onglets Jouer, Apprendre, Problèmes et Profil', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  const onglet = (nom: string) => nav.getByRole('button', { name: nom });

  await expect(nav.getByRole('button')).toHaveCount(4);
  await expect(onglet('Jouer')).toHaveAttribute('aria-current', 'page');

  await onglet('Apprendre').click();
  await expect(onglet('Apprendre')).toHaveAttribute('aria-current', 'page');
  await expect(onglet('Jouer')).not.toHaveAttribute('aria-current', 'page');
  await expect(page.getByText('Le chemin des leçons')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Leçon 1 :/ })).toBeVisible();

  await onglet('Problèmes').click();
  await expect(onglet('Problèmes')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { name: /^Go du jour n°\s\d+$/ })).toBeVisible();

  await onglet('Profil').click();
  await expect(onglet('Profil')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { name: 'Ton parcours' })).toBeVisible();

  await onglet('Jouer').click();
  await expect(onglet('Jouer')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.cta')).toBeVisible();
});

test("« ‹ » ramène à l'accueil depuis une partie en cours (la navigation est masquée en partie)", async ({ page }) => {
  await page.goto('/');
  await lancerADeux(page);
  await expect(page.getByRole('grid', { name: /Plateau de go/ })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toHaveCount(0);

  await page.getByRole('button', { name: "Retour à l'accueil" }).click();
  await expect(page.getByRole('grid', { name: /Plateau de go/ })).toHaveCount(0);
  await expect(page.locator('.cta')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button', { name: 'Jouer' })).toHaveAttribute('aria-current', 'page');
});

test('identité « deux pierres » (#51) : un seul onglet actif, icône de 28 px, pierre qui tombe', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  for (const nom of ['Jouer', 'Apprendre', 'Problèmes', 'Profil']) {
    await nav.getByRole('button', { name: nom }).click();
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(nav.getByRole('button', { name: nom })).toHaveAttribute('aria-current', 'page');
    const icone = nav.getByRole('button', { name: nom }).locator('svg.icone-nav');
    await expect(icone).toHaveClass(/active/);
    const box = (await icone.boundingBox())!;
    expect(Math.round(box.width)).toBe(28);
    // À l'activation, la pierre « tombe » (animation nav-pose), comme sur le goban.
    expect(await icone.locator('.pose').evaluate(e => getComputedStyle(e).animationName)).toBe('nav-pose');
  }
});

test('mouvements réduits : la pierre ne tombe pas dans l\'onglet activé', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  await nav.getByRole('button', { name: 'Apprendre' }).click();
  const pose = nav.getByRole('button', { name: 'Apprendre' }).locator('.pose');
  expect(await pose.evaluate(e => getComputedStyle(e).animationName)).toBe('none');
});

test('les onglets sont des cibles tactiles de 44 px minimum', async ({ page }) => {
  await page.goto('/');
  for (const b of await page.getByRole('navigation').getByRole('button').all()) {
    const box = (await b.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
});

// Régression de #145 : `contain: inline-size` réduisait les libellés des onglets à 0 px (icônes seules).
test('les quatre onglets affichent leur libellé en entier', async ({ page }) => {
  await page.goto('/');
  const libelles = page.locator('.onglet-libelle');
  await expect(libelles).toHaveCount(4);
  for (const l of await libelles.all()) {
    await expect(l).toBeVisible();
    const tronque = await l.evaluate(e => e.scrollWidth > e.clientWidth || e.clientWidth === 0);
    expect(tronque).toBe(false);
  }
});

// #465 : règle de navigation (docs/ux/navigation.md). Les écrans de choix et d'attente du jeu en ligne gardent
// l'en-tête et la barre du bas, comme l'accueil ; la partie en direct est en plein écran. La bascule « En direct » /
// « Partie lente » ne fait ni apparaître ni disparaître l'en-tête. Le titre de l'onglet suit l'écran (WCAG 2.4.2).
async function telephone(browser: Browser, baseURL: string | undefined, serveur: FauxServeur, qui: { email: string; pseudo: string; id: string }): Promise<Page> {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'fr-FR', baseURL, reducedMotion: 'reduce',
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }] }] },
  });
  const page = await brancher(ctx, serveur, {
    'go.parties.v1': JSON.stringify({ n: 3 }), 'sb-supabase-auth-token': JSON.stringify(serveur.sessionCompte(qui.email, qui.pseudo, qui.id)),
  });
  await page.goto('/');
  return page;
}
async function chrome(page: Page, visible: boolean, ecran: string) {
  await expect(page.locator('header.top'), `${ecran} : en-tête`).toHaveCount(visible ? 1 : 0);
  await expect(page.getByRole('navigation', { name: 'Navigation principale' }), `${ecran} : barre du bas`).toHaveCount(visible ? 1 : 0);
}

test('#465 : en ligne, le choix et l’attente gardent l’en-tête et la barre du bas ; la partie en direct est en plein écran', async ({ browser, baseURL }) => {
  test.setTimeout(60_000);
  const serveur = fauxServeur();
  const ana = await telephone(browser, baseURL, serveur, { email: 'ana.nav@exemple.test', pseudo: 'Ana', id: '00000000-0000-4000-8000-0000000465a1' });
  const bob = await telephone(browser, baseURL, serveur, { email: 'bob.nav@exemple.test', pseudo: 'Bob', id: '00000000-0000-4000-8000-0000000465b2' });
  await expect(ana).toHaveTitle('Mochi Go : apprendre et jouer au go');

  await choisirMode(ana, 'en_ligne');
  const bascule = ana.getByTestId('bascule-en-ligne');
  await bascule.getByRole('button', { name: 'En direct' }).click();
  await expect(ana.getByTestId('direct-choix')).toBeVisible();
  await chrome(ana, true, 'Direct, choix');
  await expect(ana).toHaveTitle('En direct · Mochi Go');
  await expect(ana.getByRole('navigation').getByRole('button', { name: 'Jouer' })).toHaveAttribute('aria-current', 'page');

  // La bascule ne change ni l'en-tête ni la barre, dans un sens comme dans l'autre.
  await bascule.getByRole('button', { name: 'Partie lente' }).click();
  await expect(ana.getByTestId('lentes')).toBeVisible();
  await chrome(ana, true, 'Parties lentes');
  await expect(ana).toHaveTitle('Partie lente · Mochi Go');
  await ana.getByTestId('bascule-en-ligne').getByRole('button', { name: 'En direct' }).click();
  await expect(ana.getByTestId('direct-choix')).toBeVisible();
  await chrome(ana, true, 'Direct, retour de la bascule');

  // Attente : en-tête et barre restent ; la barre du bas permet de partir (la place dans la file est rendue).
  await ana.getByRole('button', { name: 'Trouver un adversaire' }).click();
  await expect(ana.getByTestId('direct-attente')).toBeVisible();
  await chrome(ana, true, 'Direct, attente');

  // Partie : plein écran, chez les deux joueurs.
  await choisirMode(bob, 'en_ligne');
  await bob.getByRole('button', { name: 'Trouver un adversaire' }).click();
  await expect(ana.getByTestId('direct-partie')).toBeVisible();
  await expect(bob.getByTestId('direct-partie')).toBeVisible();
  await chrome(ana, false, 'Direct, partie (Ana)');
  await chrome(bob, false, 'Direct, partie (Bob)');
  await expect(ana.getByRole('heading', { level: 1, name: 'Mochi Go' })).toBeAttached();
});

test('#465 : le titre de l’onglet suit l’écran', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Mochi Go : apprendre et jouer au go');
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  await nav.getByRole('button', { name: 'Apprendre' }).click();
  await expect(page).toHaveTitle('Apprendre · Mochi Go');
  await page.getByRole('button', { name: /^Leçon 1 :/ }).first().click();
  await expect(page).toHaveTitle(/^.+ · Mochi Go$/);
  await expect(page).not.toHaveTitle('Apprendre · Mochi Go');
  await nav.getByRole('button', { name: 'Problèmes' }).click();
  await expect(page).toHaveTitle('Problèmes · Mochi Go');
  await nav.getByRole('button', { name: 'Profil' }).click();
  await expect(page).toHaveTitle('Profil · Mochi Go');
  await nav.getByRole('button', { name: 'Jouer' }).click();
  await lancerADeux(page);
  await expect(page).toHaveTitle('Partie à deux · Mochi Go');
});
