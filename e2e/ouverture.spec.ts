import { expect, test, type Page } from '@playwright/test';

// Ouverture animée (#406, index.html). Les autres specs ne la voient pas (navigator.webdriver) ; celle-ci la demande
// avec `e2e.ouverture` = « 1 », et repart d'un appareil où l'app n'a jamais été ouverte.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // Une seule fois par appareil (contexte) : rechargements et nouveaux onglets gardent l'état.
    if (localStorage.getItem('e2e.ouverture.init')) return;
    localStorage.setItem('e2e.ouverture.init', '1');
    localStorage.setItem('e2e.ouverture', '1');
    localStorage.removeItem('go.ouverture.derniere');
  });
});

/**
 * Retarde le JS de l'app : l'ouverture reste à l'écran le temps de l'observer (sinon, en version courte ou en
 * mouvements réduits, elle peut être partie avant la première vérification).
 */
async function retarderApp(page: Page, ms = 1200): Promise<void> {
  await page.route(/\/(assets\/index-[^/]*\.js|src\/main\.tsx)$/, async r => { await new Promise(f => setTimeout(f, ms)); await r.continue(); });
}

/**
 * Instants de l'ouverture, relevés DANS la page (#467) : un script posé avant ceux de l'app note, à la milliseconde,
 * la première image, le montage de l'accueil, le début du fondu (`ouv-fin`), le retrait de l'ouverture et le premier
 * toucher. Rien ne dépend du moment où Playwright pose ses questions : sous charge (CI, 4 lots), un aller-retour
 * lent ne fausse plus les durées. Les durées sont comparées à la première image (le départ de la seconde dans
 * index.html), plus au début de la navigation.
 */
type Instants = {
  image: number; monte: number; fin: number | null; retire: number | null; vue: boolean;
  /** Fin complète : `data-ouverture` retiré de <html> (520 ms après le fondu en version entière). */
  nettoye: number | null;
  /** Premier toucher, et l'état du fondu juste avant lui et juste après ses écouteurs (même évènement). */
  appui: number | null; finAvantToucher: boolean | null; finAuToucher: boolean | null;
};
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const t: Instants = { image: -1, monte: -1, fin: null, retire: null, vue: false, nettoye: null, appui: null, finAvantToucher: null, finAuToucher: null };
    (window as unknown as { __ouv: Instants }).__ouv = t;
    // Enregistré avant le requestAnimationFrame d'index.html : même image, appelé juste avant (image ≤ son « debut »).
    requestAnimationFrame(() => { t.image = performance.now(); });
    const enFondu = () => document.documentElement.classList.contains('ouv-fin');
    // Capture sur window : avant tout autre écouteur. Remontée sur window : après celui de l'ouverture (sur sa cible).
    addEventListener('pointerdown', () => { if (t.appui === null) { t.appui = performance.now(); t.finAvantToucher = enFondu(); } }, { capture: true });
    addEventListener('pointerdown', () => { if (t.finAuToucher === null) t.finAuToucher = enFondu(); });
    const relever = () => {
      const maintenant = performance.now();
      const ouv = document.getElementById('ouverture');
      if (ouv) t.vue = true;
      if (t.monte < 0 && document.getElementById('root')?.firstElementChild) t.monte = maintenant;
      if (t.fin === null && document.documentElement?.classList.contains('ouv-fin')) t.fin = maintenant;
      if (t.vue && t.retire === null && !ouv) t.retire = maintenant;
      if (t.fin !== null && t.nettoye === null && !document.documentElement.hasAttribute('data-ouverture')) t.nettoye = maintenant;
    };
    new MutationObserver(relever).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  });
});

/** Attend la fin de l'ouverture (retirée de la page) et rend les instants relevés. */
async function instants(page: Page): Promise<Instants & { fin: number; retire: number }> {
  await page.waitForFunction(() => {
    const t = (window as unknown as { __ouv?: Instants }).__ouv;
    return !!t && t.retire !== null && t.monte >= 0 && t.image >= 0;
  });
  const t = await page.evaluate(() => (window as unknown as { __ouv: Instants }).__ouv);
  expect(t.fin, 'le fondu (ouv-fin) a été vu').not.toBeNull();
  return t as Instants & { fin: number; retire: number };
}

/** Marge pour un minuteur de la page en retard sous charge (setTimeout ne part jamais en avance). */
const RETARD_MINUTEUR = 250;

test('premier lancement : une seconde de scène, puis l’accueil répond', async ({ page }) => {
  await page.goto('/', { waitUntil: 'commit' });
  await page.waitForSelector('#ouverture');
  expect(await page.getAttribute('html', 'data-ouverture')).toBe('plein');
  await expect(page.locator('.ouv-nom')).toBeVisible();
  const t = await instants(page);
  // Demande de Florian : une seconde en tout, jamais coupée dès que l'accueil est prêt (il l'est bien avant ici).
  // L'accueil répond (fondu `ouv-fin`) une seconde après la première image, pas avant…
  expect(t.fin - t.image).toBeGreaterThanOrEqual(999);
  // … et pas plus tard que nécessaire : à 1 s, ou au montage de l'accueil s'il arrive après (machine chargée).
  expect(t.fin - Math.max(t.monte, t.image + 1000)).toBeLessThan(RETARD_MINUTEUR);
  expect(t.retire - t.fin).toBeLessThan(400); // l'ouverture part à la fin de son fondu (220 ms)
  // L'action principale reçoit le toucher (rien par-dessus), et la page ne garde aucune trace de l'ouverture.
  const cta = page.locator('.cta');
  await expect(cta).toBeVisible();
  const recu = await cta.evaluate(b => { const r = b.getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('.cta') === b; });
  expect(recu).toBe(true);
  await expect(page.locator('html')).not.toHaveAttribute('data-ouverture');
  await expect(page.locator('html')).not.toHaveClass(/ouv-/);
});

test('la scène est encore là à 0,9 s, partie vers 1,2 s', async ({ page }) => {
  await page.goto('/', { waitUntil: 'commit' });
  await page.waitForSelector('#ouverture');
  const t = await instants(page);
  // À 0,9 s de la première image, la scène est là et sans fondu : le fondu commence après, le retrait encore après.
  // (Déduit des instants relevés dans la page : un relevé « à 0,9 s » demandé par Playwright arrivait parfois trop tard.)
  expect(t.fin - t.image).toBeGreaterThan(900);
  expect(t.retire).toBeGreaterThan(t.fin);
  // Partie vers 1,2 s : 240 ms après le fondu, lui-même à 1 s (ou au montage de l'accueil, s'il est plus tard).
  expect(t.retire - Math.max(t.monte, t.image + 1000)).toBeLessThan(240 + RETARD_MINUTEUR);
  await expect(page.locator('.cta')).toBeVisible();
});

test('aucun décalage de mise en page à la fin de l’ouverture', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __decalages: { t: number; v: number }[] };
    w.__decalages = [];
    new PerformanceObserver(l => {
      for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean; startTime: number }[]) {
        if (!e.hadRecentInput) w.__decalages.push({ t: e.startTime, v: e.value });
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto('/', { waitUntil: 'commit' });
  await page.waitForSelector('#ouverture');
  await instants(page);
  await expect(page.locator('html')).not.toHaveClass(/ouv-fin/);
  // Fenêtre mesurée dans la page (#467) : de l'ouverture jusqu'à 300 ms après sa fin complète, sur l'horloge de la
  // page (plus 300 ms d'attente fixe côté Playwright, plus ou moins longue selon la charge). On attend que cette
  // fenêtre soit passée et que l'image suivante ait remis ses décalages à l'observateur.
  const borne = await page.evaluate(() => (window as unknown as { __ouv: Instants }).__ouv.nettoye! + 300);
  await page.waitForFunction(b => performance.now() >= b, borne);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const cls = await page.evaluate(b => (window as unknown as { __decalages: { t: number; v: number }[] }).__decalages
    .filter(d => d.t <= b).reduce((s, d) => s + d.v, 0), borne);
  expect(cls).toBeLessThan(0.01);
});

test('un toucher la passe aussitôt', async ({ page }) => {
  await page.goto('/', { waitUntil: 'commit' });
  await page.waitForSelector('#ouverture');
  await page.locator('#root > *').first().waitFor({ state: 'attached' }); // accueil monté dessous
  // Le point touché est sur le goban de l'accueil, qui lance une partie : le toucher ne doit pas le traverser.
  await page.touchscreen.tap(195, 300);
  const t = await instants(page);
  expect(t.appui).not.toBeNull();
  // Sans toucher : pas avant 1 s. Avec : le fondu part pendant le toucher lui-même (#467 : vérifié dans l'évènement,
  // après les écouteurs de l'ouverture, plutôt que par une durée qui dépendait de la charge de la machine).
  if (t.finAvantToucher) {
    // Machine très chargée : l'accueil a mis plus d'une seconde à se monter, la scène était déjà partie.
    test.info().annotations.push({ type: 'non concluant', description: 'scène déjà partie avant le toucher' });
  } else {
    expect(t.finAuToucher, 'le fondu commence pendant le toucher').toBe(true);
  }
  // Fin complète de l'ouverture (520 ms après le fondu, bien après le « clic » du toucher) : rien n'est passé dessous.
  await expect(page.locator('html')).not.toHaveAttribute('data-ouverture');
  await expect(page.locator('html')).not.toHaveClass(/ouv-tenu/);
  await expect(page.locator('main.app-home')).toHaveCount(1);
  await expect(page.locator('main.app-partie')).toHaveCount(0);
  await expect(page.locator('.cta')).toBeVisible();
});

test('mouvements réduits : pas de scène, un simple fondu', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await retarderApp(page);
  await page.goto('/', { waitUntil: 'commit' });
  await page.waitForSelector('#ouverture');
  expect(await page.getAttribute('html', 'data-ouverture')).toBe('reduit');
  await expect(page.locator('.ouv-nom')).toBeHidden();
  await expect(page.locator('.ouv-logo')).toBeVisible();
  const anims = await page.evaluate(() => document.getAnimations().filter(a => (a as CSSAnimation).animationName?.startsWith('ouv-')).length);
  expect(anims).toBe(0);
  const t = await instants(page);
  // Fondu de 150 ms dès que l'accueil est là (retiré 240 ms après) : l'ouverture n'ajoute aucune attente.
  expect(t.retire - t.monte).toBeLessThan(400);
  await expect(page.locator('.cta')).toBeVisible();
});

test('lien de défi : aucune ouverture', async ({ page }) => {
  await page.goto('/#defi=jeton-de-test', { waitUntil: 'domcontentloaded' });
  expect(await page.getAttribute('html', 'data-ouverture')).toBeNull();
  await expect(page.locator('#ouverture')).toHaveCount(0);
});

test('rechargement (dont « nouvelle version prête ») : aucune ouverture ; réouverture rapprochée : version courte', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.locator('.cta')).toBeVisible();
  await page.reload({ waitUntil: 'domcontentloaded' });
  expect(await page.getAttribute('html', 'data-ouverture')).toBeNull();
  // Nouvel onglet (l'app fermée puis rouverte) quelques secondes après : la version courte.
  const autre = await context.newPage();
  await retarderApp(autre);
  await autre.goto('/', { waitUntil: 'commit' });
  await autre.waitForSelector('#ouverture');
  expect(await autre.getAttribute('html', 'data-ouverture')).toBe('court');
  await expect(autre.locator('.ouv-nom')).toBeHidden();
});

// Captures (docs/design/captures/ouverture-animee/) : `CAPTURES=1 PW_PORT=… npx playwright test e2e/ouverture.spec.ts`.
// Les animations sont figées puis placées à l'instant voulu : images exactes, quel que soit le rythme de la machine.
const DOSSIER = 'docs/design/captures/ouverture-animee';
for (const theme of ['dark', 'light'] as const) {
  const nom = theme === 'dark' ? 'sombre' : 'clair';
  test(`captures de l'ouverture (${nom})`, async ({ page, context }) => {
    test.skip(!process.env.CAPTURES, 'captures à la demande');
    await page.emulateMedia({ colorScheme: theme });
    // 1. La scène : sans le JS de l'app, l'ouverture reste à l'écran.
    await page.route(/\/(assets\/index-[^/]*\.js|src\/main\.tsx)$/, r => r.abort());
    await page.goto('/');
    for (const t of [0, 400, 900]) {
      await page.evaluate(t => document.getAnimations().forEach(a => { a.pause(); a.currentTime = t; }), t);
      await page.screenshot({ path: `${DOSSIER}/${nom}-1-scene-${String(t).padStart(3, '0')}ms.jpg`, type: 'jpeg', quality: 80 });
    }
    await page.unroute(/\/(assets\/index-[^/]*\.js|src\/main\.tsx)$/);
    // 2. La fin, dans un nouvel onglet (lancement neuf) : l'accueil se construit, l'action principale d'abord.
    await page.evaluate(() => localStorage.removeItem('go.ouverture.derniere'));
    await page.close();
    page = await context.newPage();
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('/', { waitUntil: 'commit' });
    await page.waitForFunction(() => document.documentElement.classList.contains('ouv-fin'), undefined, { polling: 10 });
    await page.evaluate(() => {
      document.querySelectorAll('.nav, .cta, .app > *, .accueil > *').forEach(e => getComputedStyle(e).opacity);
      const ouv = document.getElementById('ouverture')!;
      ouv.remove = () => {};
      document.getAnimations().forEach(a => {
        const cible = (a.effect as KeyframeEffect).target;
        if (cible && cible !== ouv && ouv.contains(cible)) a.finish(); else a.pause();
      });
    });
    await page.evaluate(() => document.getAnimations().forEach(a => a.finish()));
    await page.screenshot({ path: `${DOSSIER}/${nom}-2-accueil.jpg`, type: 'jpeg', quality: 80 });
  });
}

test('capture 320 × 568 (sombre)', async ({ page }) => {
  test.skip(!process.env.CAPTURES, 'captures à la demande');
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.route(/\/(assets\/index-[^/]*\.js|src\/main\.tsx)$/, r => r.abort());
  await page.goto('/');
  await page.evaluate(() => document.getAnimations().forEach(a => { a.pause(); a.currentTime = 900; }));
  await page.screenshot({ path: `${DOSSIER}/sombre-320-scene-900ms.jpg`, type: 'jpeg', quality: 80 });
});
