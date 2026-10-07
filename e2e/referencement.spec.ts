import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// #472 : pages de référencement statiques (outils/referencement/pages.ts), servies comme sur Vercel (réécritures de
// vercel.json appliquées par `vite preview`, outils/apercus.ts). Balises, démo jouable, version sans JS, une seule action
// principale qui ouvre l'app, accessibilité (axe, 44 px, 320 px), poids. Le générateur est testé par Vitest (pages.test.ts).

const PAGES = [
  { chemin: '/apprendre-le-go', langue: 'fr', h1: 'Apprends le go en jouant, gratuitement', cta: 'Jouer maintenant', autre: '/en/learn-go' },
  { chemin: '/regles-du-go', langue: 'fr', h1: 'Les règles du go, simplement', cta: 'Jouer maintenant', autre: '/en/go-rules' },
  { chemin: '/en/learn-go', langue: 'en', h1: 'Learn Go by playing, for free', cta: 'Play now', autre: '/apprendre-le-go' },
  { chemin: '/en/go-rules', langue: 'en', h1: 'The rules of Go, simply', cta: 'Play now', autre: '/regles-du-go' },
] as const;

const point = (page: Page, nom: string) => page.locator('.goban-points').getByRole('button', { name: new RegExp(`^${nom},`) });

for (const p of PAGES) {
  test(`${p.chemin} : servie en HTML statique, balises de référencement, une action principale`, async ({ page }) => {
    const erreurs: string[] = [];
    page.on('pageerror', e => erreurs.push(e.message));
    const scripts: string[] = [];
    page.on('request', r => { if (r.resourceType() === 'script') scripts.push(r.url()); });
    const rep = await page.goto(p.chemin);
    expect(rep!.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', p.langue);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(p.h1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://mochi-go.app${p.chemin}`);
    await expect(page.locator(`link[rel="alternate"][hreflang="${p.langue === 'fr' ? 'en' : 'fr'}"]`)).toHaveAttribute('href', `https://mochi-go.app${p.autre}`);
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
    // Pas le JS de l'app : aucun script chargé par la page.
    expect(scripts).toEqual([]);
    // Une seule action en relief à l'écran, de 44 px au moins.
    const ctas = page.locator('a.cta');
    await expect(ctas).toHaveCount(2);
    await expect(ctas.first()).toHaveText(p.cta);
    await expect(ctas.first()).toBeInViewport();
    await expect(ctas.last()).not.toBeInViewport();
    expect((await ctas.first().boundingBox())!.height).toBeGreaterThanOrEqual(44);
    // Le lien vers l'autre langue mène à la page traduite.
    await page.locator('a.langue').click();
    await expect(page).toHaveURL(new RegExp(`${p.autre}$`));
    await expect(page.locator('html')).toHaveAttribute('lang', p.langue === 'fr' ? 'en' : 'fr');
    expect(erreurs).toEqual([]);
  });
}

test('démo : un mauvais coup, Blanc s’échappe ; puis les trois défis réussis, au doigt et au clavier', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/apprendre-le-go');
  const demo = page.locator('#demo');
  const statut = demo.getByRole('status');
  // Version JS : la solution écrite de la version sans JS est cachée, le défi est posé.
  await expect(demo.locator('.sans-js')).toBeHidden();
  await expect(demo.locator('.demo-defi')).toHaveText('Défi 1 sur 3 · Capture la pierre blanche');
  await expect(point(page, 'E5')).toHaveAccessibleName('E5, pierre blanche');

  await point(page, 'A1').click();
  await expect(statut).toHaveText('Blanc s’échappe en E4 : son groupe a maintenant 3 libertés. Réessaie.');
  await expect(point(page, 'E4')).toHaveAccessibleName('E4, pierre blanche');
  await demo.getByRole('button', { name: 'Réessayer' }).click();
  await expect(point(page, 'E4')).toHaveAccessibleName('E4, vide');

  await point(page, 'E4').click();
  await expect(statut).toHaveText('Capturée ! Une pierre sans liberté quitte le plateau.');
  await expect(point(page, 'E5')).toHaveAccessibleName('E5, vide');
  await expect(page.locator('#demo .pierre[data-point="E5"]')).toHaveCount(0);
  await demo.getByRole('button', { name: 'Défi suivant' }).click();

  // Défi 2 au clavier : depuis E5, flèche à droite (F5) puis en bas (F4), Entrée.
  await expect(demo.locator('.demo-defi')).toHaveText('Défi 2 sur 3 · Capture les deux pierres');
  await point(page, 'E5').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await expect(point(page, 'F4')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(statut).toHaveText('Deux d’un coup ! Un groupe sans liberté est capturé en entier.');
  await demo.getByRole('button', { name: 'Défi suivant' }).click();

  await expect(demo.locator('.demo-defi')).toHaveText('Défi 3 sur 3 · Sauve ta pierre');
  await point(page, 'E4').click();
  await expect(statut).toHaveText('Sauvée ! Ton groupe a maintenant 3 libertés.');
  await expect(demo.getByText('Tu connais déjà les libertés, l’atari et la capture')).toBeVisible();
  // Toujours une seule action en relief : la fin de la démo n'en ajoute pas.
  await expect(demo.locator('.cta')).toHaveCount(0);
  await demo.getByRole('button', { name: 'Recommencer' }).click();
  await expect(demo.locator('.demo-defi')).toHaveText('Défi 1 sur 3 · Capture la pierre blanche');
});

test('démo : sauver sa pierre, un mauvais coup la fait capturer ; point occupé refusé (anglais)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/en/learn-go');
  const demo = page.locator('#demo');
  await point(page, 'D5').click();
  await expect(demo.getByRole('status')).toHaveText('This point is taken. Pick an empty one.');
  await point(page, 'E4').click();
  await demo.getByRole('button', { name: 'Next challenge' }).click();
  await point(page, 'F4').click();
  await demo.getByRole('button', { name: 'Next challenge' }).click();
  await point(page, 'J9').click();
  await expect(demo.getByRole('status')).toHaveText('White plays E4 and captures your stone. Try again.');
  await expect(point(page, 'E5')).toHaveAccessibleName('E5, empty');
});

test.describe('sans JS', () => {
  test.use({ javaScriptEnabled: false });
  test('le texte, la position et la solution de la démo restent lisibles ; le bouton mène à l’app', async ({ page }) => {
    await page.goto('/regles-du-go');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Les règles du go, simplement');
    await expect(page.locator('#demo .goban-svg')).toBeVisible();
    await expect(page.locator('#demo .marque')).toHaveCount(1);
    await expect(page.locator('#demo .sans-js')).toBeVisible();
    await expect(page.locator('#demo .sans-js')).toContainText('Si Noir joue en E4');
    await expect(page.locator('.goban-points')).toBeHidden();
    await expect(page.locator('.demo-statut')).toBeHidden();
    await expect(page.getByRole('heading', { name: '4. Le ko' })).toBeVisible();
    await expect(page.locator('figure.schema')).toHaveCount(2);
    await expect(page.locator('a.cta').first()).toHaveAttribute('href', /^\/\?lang=fr&utm_source=mochi-go&utm_medium=page&utm_campaign=regles-du-go$/);
  });
});

test('« Jouer maintenant » ouvre l’app, en français ; en anglais depuis la page anglaise', async ({ page }) => {
  await page.goto('/apprendre-le-go');
  await page.locator('a.cta').first().click();
  await expect(page).toHaveURL(/\/\?lang=fr&/);
  await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible();
  await page.goto('/en/learn-go');
  await page.locator('a.cta').first().click();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
});

test('sitemap.xml et robots.txt servis ; l’app et la 404 (qui ouvre l’app) inchangées', async ({ page, request }) => {
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  const xml = await sitemap.text();
  for (const p of PAGES) expect(xml).toContain(`<loc>https://mochi-go.app${p.chemin}</loc>`);
  const robots = await request.get('/robots.txt');
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain('Sitemap: https://mochi-go.app/sitemap.xml');
  await page.goto('/');
  await expect(page.locator('.cta')).toBeVisible();
  await page.goto('/apprendre-le-go-inconnu');
  await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible();
});

test('320 px, sombre et clair : pas de défilement horizontal, cibles de 44 px, axe sans violation', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  for (const chemin of ['/apprendre-le-go', '/en/go-rules']) {
    await page.goto(chemin);
    for (const theme of ['dark', 'light'] as const) {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
      // Le halo (dégradé) en aplat, sa couleur la plus forte : axe mesure alors le pire contraste (cf. a11y-axe.spec.ts).
      const aplat = await page.addStyleTag({ content: `body { background: ${theme === 'dark' ? 'rgb(42, 35, 25)' : 'rgb(239, 226, 201)'} !important; }` });
      const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      await aplat.evaluate(el => (el as Element).remove());
      expect(violations.map(v => `${theme} ${v.id} : ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)).toEqual([]);
    }
    // Liens et boutons hors du texte courant : 44 px de haut au moins.
    const petits = await page.locator('.entete a, .pied a, a.cta, .demo-actions button').evaluateAll(els =>
      els.filter(e => (e as HTMLElement).getBoundingClientRect().height < 44).map(e => (e as HTMLElement).outerHTML.slice(0, 80)));
    expect(petits).toEqual([]);
  }
});

test('poids et rendu : page légère, titre affiché vite', async ({ page }) => {
  const octets: Record<string, number> = {};
  page.on('response', async r => {
    const taille = Number(r.headers()['content-length'] ?? (await r.body().catch(() => Buffer.alloc(0))).length);
    octets[new URL(r.url()).pathname] = taille;
  });
  await page.goto('/apprendre-le-go', { waitUntil: 'networkidle' });
  const lcp = await page.evaluate(() => new Promise<number>(res => {
    new PerformanceObserver(l => { const e = l.getEntries(); res(e[e.length - 1].startTime); }).observe({ type: 'largest-contentful-paint', buffered: true });
  }));
  // Local, sans ralentissement : un garde-fou contre une régression grossière, pas une mesure de terrain (Lighthouse).
  expect(lcp).toBeLessThan(1500);
  const total = Object.values(octets).reduce((a, b) => a + b, 0);
  // HTML (non compressé par `vite preview`) + icône + 3 polices partagées avec l'app.
  expect(total).toBeLessThan(140 * 1024);
  expect(Object.keys(octets).filter(c => c.endsWith('.js'))).toEqual([]);
});
