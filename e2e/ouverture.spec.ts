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

/** Instant (ms depuis le début de la navigation) où #root reçoit l'app. */
async function montage(page: Page): Promise<number> {
  return page.evaluate(() => new Promise<number>(resolve => {
    const root = document.getElementById('root')!;
    if (root.firstElementChild) return resolve(performance.now());
    const mo = new MutationObserver(() => { if (root.firstElementChild) { mo.disconnect(); resolve(performance.now()); } });
    mo.observe(root, { childList: true });
  }));
}

/** Instant (ms depuis le début de la navigation) où l'accueil répond : l'ouverture commence son fondu et laisse passer les touchers. */
async function interactif(page: Page): Promise<number> {
  return page.evaluate(() => new Promise<number>(resolve => {
    const h = document.documentElement;
    if (h.classList.contains('ouv-fin') || !document.getElementById('ouverture')) return resolve(performance.now());
    const mo = new MutationObserver(() => { if (h.classList.contains('ouv-fin')) { mo.disconnect(); resolve(performance.now()); } });
    mo.observe(h, { attributes: true, attributeFilter: ['class'] });
  }));
}

/** Instant (ms depuis le début de la navigation) où l'ouverture quitte la page ; null si elle n'y était pas. */
async function finOuverture(page: Page): Promise<number | null> {
  return page.evaluate(() => new Promise<number | null>(resolve => {
    const el = document.getElementById('ouverture');
    if (!el) return resolve(null);
    const mo = new MutationObserver(() => { if (!el.isConnected) { mo.disconnect(); resolve(performance.now()); } });
    mo.observe(document.body, { childList: true });
  }));
}

test('premier lancement : une seconde de scène, puis l’accueil répond', async ({ page }) => {
  await page.goto('/', { waitUntil: 'commit' });
  await page.waitForSelector('#ouverture');
  expect(await page.getAttribute('html', 'data-ouverture')).toBe('plein');
  await expect(page.locator('.ouv-nom')).toBeVisible();
  const [repond, fin] = await Promise.all([interactif(page), finOuverture(page)]);
  // Demande de Florian : une seconde en tout, jamais coupée dès que l'accueil est prêt (il l'est bien avant ici).
  // `repond` compte depuis le début de la navigation ; la seconde, depuis la première image.
  expect(repond).toBeGreaterThanOrEqual(1000);
  expect(repond).toBeLessThan(1500);
  expect(fin).not.toBeNull();
  expect(fin! - repond).toBeLessThan(400); // l'ouverture part à la fin de son fondu (220 ms)
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
  await page.locator('#root > *').first().waitFor({ state: 'attached' }); // accueil monté dessous
  const a09 = await page.evaluate(() => new Promise<{ t: number; la: boolean; fondu: boolean }>(resolve => {
    const lire = () => resolve({ t: performance.now(), la: !!document.getElementById('ouverture'), fondu: document.documentElement.classList.contains('ouv-fin') });
    const reste = 900 - performance.now();
    if (reste <= 0) lire(); else setTimeout(lire, reste);
  }));
  expect(a09.t).toBeLessThan(1000); // mesure prise avant la seconde, sinon le test ne prouve rien
  expect(a09.la).toBe(true);
  expect(a09.fondu).toBe(false);
  const fin = await finOuverture(page);
  expect(fin!).toBeLessThan(1600);
  await expect(page.locator('.cta')).toBeVisible();
});

test('aucun décalage de mise en page à la fin de l’ouverture', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    new PerformanceObserver(l => {
      for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) {
        if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto('/', { waitUntil: 'commit' });
  await page.waitForSelector('#ouverture');
  await finOuverture(page);
  await expect(page.locator('html')).not.toHaveClass(/ouv-fin/);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThan(0.01);
});

test('un toucher la passe aussitôt', async ({ page }) => {
  await page.goto('/', { waitUntil: 'commit' });
  await page.waitForSelector('#ouverture');
  await montage(page);
  const appui = page.evaluate(() => new Promise<number>(r => addEventListener('pointerdown', () => r(performance.now()), { capture: true, once: true })));
  // Le point touché est sur le goban de l'accueil, qui lance une partie : le toucher ne doit pas le traverser.
  await page.touchscreen.tap(195, 300);
  const [touche, repond] = await Promise.all([appui, interactif(page)]);
  // Sans toucher : pas avant 1 s. Avec : le fondu part au même toucher (après les écouteurs de l'app, dont le
  // déblocage du son, qui passent avant : d'où la marge).
  expect(repond - touche).toBeLessThan(250);
  await finOuverture(page);
  await page.waitForTimeout(300);
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
  const [monte, fin] = await Promise.all([montage(page), finOuverture(page)]);
  // Fondu de 150 ms dès que l'accueil est là (retiré 240 ms après) : l'ouverture n'ajoute aucune attente.
  expect(fin! - monte).toBeLessThan(400);
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
