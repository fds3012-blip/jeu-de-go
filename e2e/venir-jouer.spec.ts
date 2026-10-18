import { gunzipSync } from 'node:zlib';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Request } from '@playwright/test';
import { SUPABASE, brancher, fauxServeur } from './fauxSupabase';

// #537 « Venir jouer » : une page d'entrée par cible (statique, outils/referencement/textesVenir.ts) et le formulaire de
// retours en 3 questions (src/ui/Retours.tsx). Le générateur des pages et la logique d'envoi sont testés par Vitest.

// posthog-js jette les événements des navigateurs pilotés : on se présente comme un navigateur ordinaire
// (même méthode que e2e/url-sensible.spec.ts ; le build e2e pointe PostHog vers un hôte intercepté).
const HOTE = 'https://posthog-e2e.test';
test.use({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });

/** Événements d'un envoi PostHog, quel que soit son encodage (gzip, base64 en formulaire, JSON brut). */
function evenements(r: Request): { event: string; properties: Record<string, unknown> }[] {
  const brut = r.postDataBuffer();
  if (!brut) return [];
  let texte: string;
  if (new URL(r.url()).searchParams.get('compression') === 'gzip-js' || (brut[0] === 0x1f && brut[1] === 0x8b)) texte = gunzipSync(brut).toString('utf8');
  else {
    texte = brut.toString('utf8');
    if (texte.startsWith('data=')) texte = Buffer.from(decodeURIComponent(texte.slice(5).split('&')[0].replace(/\+/g, ' ')), 'base64').toString('utf8');
  }
  try {
    const v = JSON.parse(texte) as unknown;
    const liste = Array.isArray(v) ? v : (v as { batch?: unknown[] }).batch ?? [v];
    return liste as { event: string; properties: Record<string, unknown> }[];
  } catch { return []; }
}

test('page « joueurs d’échecs » : une action, les UTM d’arrivée relayés jusqu’à PostHog dans l’app', async ({ page }) => {
  const recus: { event: string; properties: Record<string, unknown> }[] = [];
  await page.route(`${HOTE}/**`, async route => {
    if (route.request().method() === 'POST') recus.push(...evenements(route.request()));
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":1}' });
  });
  await page.addInitScript(hote => {
    localStorage.setItem('e2e.posthog.hote', hote);
    Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false });
    Object.defineProperty(Navigator.prototype, 'userAgentData', { get: () => undefined });
  }, HOTE);

  const scripts: string[] = [];
  page.on('request', r => { if (r.resourceType() === 'script') scripts.push(r.url()); });
  await page.goto('/go-pour-joueurs-echecs?utm_source=reddit&utm_medium=social&utm_campaign=lancement');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tu joues aux échecs ? Essaie le go');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://mochi-go.app/go-pour-joueurs-echecs');
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute('href', 'https://mochi-go.app/en/go-for-chess-players');
  expect(scripts).toEqual([]);
  // Une seule action en relief à l'écran (répétée en bas), de 44 px au moins, qui porte les UTM de l'arrivée.
  const cta = page.locator('a.cta');
  await expect(cta).toHaveCount(2);
  await expect(cta.first()).toBeInViewport();
  expect((await cta.first().boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(cta.first()).toHaveAttribute('href', '/?lang=fr&utm_source=reddit&utm_medium=social&utm_campaign=lancement&utm_content=go-echecs');

  // Clair et sombre : contraste AA (axe), pas de défilement horizontal en 320 px.
  await page.setViewportSize({ width: 320, height: 640 });
  for (const theme of ['dark', 'light'] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    const aplat = await page.addStyleTag({ content: `body { background: ${theme === 'dark' ? 'rgb(42, 35, 25)' : 'rgb(239, 226, 201)'} !important; }` });
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    await aplat.evaluate(el => (el as Element).remove());
    expect(violations.map(v => `${theme} ${v.id} : ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)).toEqual([]);
  }

  // Dans l'app (mesure anonyme, sans accord) : les événements portent la source, le canal, la campagne et la page.
  await cta.first().click();
  await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible();
  await expect.poll(() => recus.some(e => e.event === 'app_ouverte'), { timeout: 15_000 }).toBe(true);
  const ouverture = recus.find(e => e.event === 'app_ouverte')!;
  expect(ouverture.properties).toMatchObject({ utm_source: 'reddit', utm_medium: 'social', utm_campaign: 'lancement', utm_content: 'go-echecs', mesure: 'anonyme' });
});

test('retours en 3 questions : depuis l’aide, question 1 obligatoire, envoi sans compte, merci ; plafond du serveur', async ({ context }) => {
  const serveur = fauxServeur();
  const page = await brancher(context, serveur);
  const envois: Record<string, unknown>[] = [];
  let reponse = 'true';
  await context.route(`${SUPABASE}/rest/v1/rpc/envoyer_retour`, async route => {
    const r = route.request();
    envois.push(JSON.parse(r.postData() ?? '{}') as Record<string, unknown>);
    // Jamais le jeton du joueur : la seule clé publique.
    expect(r.headers().authorization).toBe(`Bearer ${r.headers().apikey}`);
    await route.fulfill({ status: 200, contentType: 'application/json', body: reponse });
  });

  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Profil' }).click();
  await page.getByRole('button', { name: 'Aide sur le jeu', exact: true }).click();
  const aide = page.locator('dialog.aide');
  await aide.getByRole('tab', { name: 'Questions' }).click();
  // Contact visible, en lien.
  await expect(aide.getByTestId('aide-contact').getByRole('link')).toHaveAttribute('href', /^mailto:.+@.+/);
  const ouvrir = aide.getByTestId('aide-donner-avis');
  expect((await ouvrir.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await ouvrir.click();

  const form = aide.getByTestId('retours');
  await expect(form.getByRole('heading', { name: 'Ton avis sur Mochi Go' })).toBeFocused();
  // Sans réponse à la question 1 : erreur annoncée, focus sur le premier choix, rien d'envoyé.
  await form.getByRole('button', { name: 'Envoyer' }).click();
  await expect(form.getByRole('alert')).toHaveText('Choisis une réponse à la question 1.');
  await expect(form.getByRole('radio', { name: 'Oui' })).toBeFocused();
  expect(envois).toEqual([]);

  // Cibles de 44 px au moins : chaque choix (toute la ligne se touche) et chaque bouton.
  const petites = await form.locator('label.retours-choix, button, textarea').evaluateAll(els =>
    els.filter(e => (e as HTMLElement).getBoundingClientRect().height < 44).map(e => (e as HTMLElement).outerHTML.slice(0, 80)));
  expect(petites).toEqual([]);

  // Sombre et clair : contraste AA et rôles (axe), sur le formulaire.
  for (const theme of ['dark', 'light'] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    const { violations } = await new AxeBuilder({ page }).include('[data-testid="retours"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(violations.map(v => `${theme} ${v.id} : ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)).toEqual([]);
  }

  // Plafond atteint (le serveur répond « false ») : message clair, le formulaire reste rempli.
  await form.getByRole('radio', { name: 'Peut-être' }).check();
  await form.getByLabel('2. Qu’est-ce qu’on devrait améliorer en premier ?').fill('  Plus de problèmes en 13 × 13.  ');
  await form.getByRole('radio', { name: 'Réseau social ou forum' }).check();
  reponse = 'false';
  await form.getByRole('button', { name: 'Envoyer' }).click();
  await expect(form.getByRole('alert')).toContainText('Réessaie dans une minute');
  await expect(form.getByRole('radio', { name: 'Peut-être' })).toBeChecked();

  reponse = 'true';
  await form.getByRole('button', { name: 'Envoyer' }).click();
  const merci = aide.getByTestId('retours-merci');
  await expect(merci).toContainText('Merci ! On lit chaque avis.');
  expect(envois.at(-1)).toEqual({ p_conseil: 'peut_etre', p_ameliorer: 'Plus de problèmes en 13 × 13.', p_source: 'reseau', p_langue: 'fr' });
  // « Fermer » ramène aux questions fréquentes.
  await merci.getByRole('button', { name: 'Fermer' }).click();
  await expect(aide.getByTestId('aide-donner-avis')).toBeVisible();
});

test('sans compte, « Nous écrire » du Profil ouvre le formulaire (anglais)', async ({ context }) => {
  const page = await brancher(context, fauxServeur());
  await page.goto('/?lang=en');
  await page.getByRole('navigation').getByRole('button', { name: 'Profile' }).click();
  await page.getByTestId('ligne-ecrire').click();
  await page.getByTestId('ecrire-donner-avis').click();
  const form = page.locator('dialog.aide').getByTestId('retours');
  await expect(form.getByRole('heading', { name: 'Your feedback on Mochi Go' })).toBeVisible();
  await expect(form.getByRole('radio', { name: 'Yes' })).toBeVisible();
});
