import { gunzipSync } from 'node:zlib';
import { expect, test, type Request } from '@playwright/test';

// Écart E14 de la politique de confidentialité : l'adresse envoyée à PostHog ne doit porter ni le fragment `#`
// (jetons de session au retour du lien de connexion par e-mail) ni les paramètres sensibles (`?code=`…).
// Le build e2e n'a pas de clé PostHog : le repère `e2e.posthog.hote` (lu seulement quand VITE_E2E est défini)
// pointe le SDK vers un hôte fictif, intercepté ici. Mesure anonyme (sans consentement) : PostHog est actif.

// posthog-js jette les événements des robots (navigateur piloté : `navigator.webdriver`, « HeadlessChrome ») :
// on se présente comme un navigateur ordinaire.
test.use({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });

const HOTE = 'https://posthog-e2e.test';
const SECRETS = ['JETON_ACCES_SECRET', 'JETON_RAFRAICHI_SECRET', 'CODE_PKCE_SECRET', 'DEFI_SECRET'];

/** Corps d'un envoi PostHog, quel que soit son encodage (gzip, base64 en formulaire, JSON brut). */
function lireEnvoi(r: Request): string {
  const brut = r.postDataBuffer();
  if (!brut) return '';
  const url = new URL(r.url());
  if (url.searchParams.get('compression') === 'gzip-js' || (brut[0] === 0x1f && brut[1] === 0x8b)) return gunzipSync(brut).toString('utf8');
  const texte = brut.toString('utf8');
  if (texte.startsWith('data=')) {
    const data = decodeURIComponent(texte.slice(5).split('&')[0].replace(/\+/g, ' '));
    try { return Buffer.from(data, 'base64').toString('utf8'); } catch { return data; }
  }
  return texte;
}

test('retour du lien de connexion : ni jetons ni code dans ce que reçoit PostHog', async ({ page }) => {
  const envois: string[] = [];
  await page.route(`${HOTE}/**`, async route => {
    const r = route.request();
    if (r.method() === 'POST') envois.push(lireEnvoi(r));
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":1}' });
  });
  await page.addInitScript(hote => {
    localStorage.setItem('e2e.posthog.hote', hote);
    Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false });
    Object.defineProperty(Navigator.prototype, 'userAgentData', { get: () => undefined });
  }, HOTE);

  await page.goto(
    '/?lang=fr&code=CODE_PKCE_SECRET&defi=DEFI_SECRET'
    + '#access_token=JETON_ACCES_SECRET&expires_in=3600&refresh_token=JETON_RAFRAICHI_SECRET&token_type=bearer&type=magiclink',
  );
  await expect(page.locator('.cta')).toBeVisible();
  // Le test a du sens : l'adresse porte toujours les jetons (pas de Supabase dans le build e2e pour les effacer).
  expect(await page.evaluate(() => location.href)).toContain('JETON_ACCES_SECRET');

  // `app_ouverte` part au démarrage ; le SDK groupe ses envois (quelques secondes).
  await expect.poll(() => envois.join('\n'), { timeout: 15_000 }).toContain('app_ouverte');
  const tout = envois.join('\n');
  for (const s of SECRETS) expect(tout).not.toContain(s);
  expect(tout).not.toContain('access_token');
  // L'adresse est bien envoyée, mais propre : seul `lang` reste.
  expect(tout).toMatch(/"\$current_url":"http:\/\/localhost:\d+\/\?lang=fr"/);
});
