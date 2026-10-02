import { expect, test, type Page } from '@playwright/test';

// Ouverture animée (#406, index.html). Les autres specs ne la voient pas (navigator.webdriver) ; celle-ci la demande
// avec `go.ouverture.e2e` = « 1 », et repart d'un appareil où l'app n'a jamais été ouverte.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('e2e.ouverture.init')) return; // une seule fois : les rechargements gardent l'état
    sessionStorage.setItem('e2e.ouverture.init', '1');
    localStorage.setItem('go.ouverture.e2e', '1');
    localStorage.removeItem('go.ouverture.derniere');
  });
});

/** Instant (ms depuis le début de la navigation) où l'ouverture quitte la page ; null si elle n'y était pas. */
async function finOuverture(page: Page): Promise<number | null> {
  return page.evaluate(() => new Promise<number | null>(resolve => {
    const el = document.getElementById('ouverture');
    if (!el) return resolve(null);
    const mo = new MutationObserver(() => { if (!el.isConnected) { mo.disconnect(); resolve(performance.now()); } });
    mo.observe(document.body, { childList: true });
  }));
}

test('premier lancement : la scène se joue, puis l’accueil répond en moins de 1,5 s', async ({ page }) => {
  await page.goto('/', { waitUntil: 'commit' });
  await page.waitForSelector('#ouverture');
  expect(await page.getAttribute('html', 'data-ouverture')).toBe('plein');
  await expect(page.locator('.ouv-nom')).toBeVisible();
  const fin = await finOuverture(page);
  expect(fin).not.toBeNull();
  expect(fin!).toBeLessThan(1500);
  // L'action principale reçoit le toucher (rien par-dessus), et la page ne garde aucune trace de l'ouverture.
  const cta = page.locator('.cta');
  await expect(cta).toBeVisible();
  const recu = await cta.evaluate(b => { const r = b.getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('.cta') === b; });
  expect(recu).toBe(true);
  await expect(page.locator('html')).not.toHaveAttribute('data-ouverture');
  await expect(page.locator('html')).not.toHaveClass(/ouv-/);
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
  await page.locator('#root > *').first().waitFor({ state: 'attached' });
  const avant = await page.evaluate(() => performance.now());
  const surveille = page.evaluate(() => new Promise<string>(r => setTimeout(() => r(location.href + '|' + document.querySelectorAll('.cta').length), 900)));
  await page.touchscreen.tap(195, 300);
  const fin = await finOuverture(page);
  // Sans toucher : pas avant 0,7 s puis 0,52 s de fondu. Avec : fondu immédiat, retiré 0,52 s plus tard au plus.
  expect(fin! - avant).toBeLessThan(700);
  // Le toucher n'a rien déclenché dessous (le goban de l'accueil lance une partie) : on est toujours sur l'accueil.
  expect((await surveille).endsWith('|1')).toBe(true);
  await expect(page.locator('.cta')).toBeVisible();
});

test('mouvements réduits : pas de scène, un simple fondu', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/', { waitUntil: 'commit' });
  await page.waitForSelector('#ouverture');
  expect(await page.getAttribute('html', 'data-ouverture')).toBe('reduit');
  await expect(page.locator('.ouv-nom')).toBeHidden();
  await expect(page.locator('.ouv-logo')).toBeVisible();
  const anims = await page.evaluate(() => document.getAnimations().filter(a => (a as CSSAnimation).animationName?.startsWith('ouv-')).length);
  expect(anims).toBe(0);
  const fin = await finOuverture(page);
  expect(fin!).toBeLessThan(1200);
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
  test(`captures de l'ouverture (${nom})`, async ({ page }) => {
    test.skip(!process.env.CAPTURES, 'captures à la demande');
    await page.emulateMedia({ colorScheme: theme });
    // 1. La scène : sans le JS de l'app, l'ouverture reste à l'écran.
    await page.route(/\/(assets\/index-[^/]*\.js|src\/main\.tsx)$/, r => r.abort());
    await page.goto('/');
    for (const t of [0, 300, 700]) {
      await page.evaluate(t => document.getAnimations().forEach(a => { a.pause(); a.currentTime = t; }), t);
      await page.screenshot({ path: `${DOSSIER}/${nom}-1-scene-${String(t).padStart(3, '0')}ms.jpg`, type: 'jpeg', quality: 80 });
    }
    await page.unroute(/\/(assets\/index-[^/]*\.js|src\/main\.tsx)$/);
    // 2. La fin : l'accueil se construit, l'action principale d'abord.
    await page.evaluate(() => { sessionStorage.removeItem('go.ouverture.vue'); localStorage.removeItem('go.ouverture.derniere'); });
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.classList.contains('ouv-fin'));
    await page.evaluate(() => {
      document.querySelectorAll('.nav, .cta, .app > *, .accueil > *').forEach(e => getComputedStyle(e).opacity);
      const ouv = document.getElementById('ouverture')!;
      ouv.remove = () => {};
      document.getAnimations().forEach(a => {
        const cible = (a.effect as KeyframeEffect).target;
        if (cible && cible !== ouv && ouv.contains(cible)) a.finish(); else a.pause();
      });
    });
    for (const t of [120, 420]) {
      await page.evaluate(t => document.getAnimations().forEach(a => { if (a.playState === 'paused') a.currentTime = t; }), t);
      await page.screenshot({ path: `${DOSSIER}/${nom}-2-accueil-${String(t).padStart(3, '0')}ms.jpg`, type: 'jpeg', quality: 80 });
    }
  });
}

test('capture 320 × 568 (sombre)', async ({ page }) => {
  test.skip(!process.env.CAPTURES, 'captures à la demande');
  await page.setViewportSize({ width: 320, height: 568 });
  await page.route(/\/(assets\/index-[^/]*\.js|src\/main\.tsx)$/, r => r.abort());
  await page.goto('/');
  await page.evaluate(() => document.getAnimations().forEach(a => { a.pause(); a.currentTime = 700; }));
  await page.screenshot({ path: `${DOSSIER}/sombre-320-scene-700ms.jpg`, type: 'jpeg', quality: 80 });
});
