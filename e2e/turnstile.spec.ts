import { expect, test, type Browser, type Page, type Request } from '@playwright/test';
import { toucherCta } from './plateau';
import { brancher, CODE, fauxServeur, type FauxServeur } from './fauxSupabase';

// Issue #531 : captcha Turnstile devant l'envoi du code. Sans clé (VITE_TURNSTILE_SITE_KEY absente) : aucun script de
// Cloudflare, aucun widget, l'envoi part comme avant. Avec une clé (ici `e2e.turnstile`, lu par les builds de test
// seulement) : le script de challenges.cloudflare.com est servi par un faux Turnstile, le jeton part avec la demande
// de code (`gotrue_meta_security.captcha_token`), un nouveau jeton pour chaque envoi ; tant que le jeton n'est pas
// là, une phrase claire ; refus du serveur, une autre. Le tout sous la CSP de vercel.json, sans violation.

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/** Faux Turnstile : rend un jeton numéroté peu après le rendu (ou jamais, `muet`). */
function fauxTurnstile(muet = false) {
  return `window.turnstile = { n: 0,
    render: function (el, o) { var t = this; var id = 'w' + (++t.n); var d = document.createElement('div'); d.textContent = 'Turnstile ' + id;
      d.style.minHeight = '65px'; el.append(d); ${muet ? '' : "setTimeout(function () { o.callback('jeton-e2e-' + t.n); }, 50);"} return id; },
    remove: function () {} };`;
}

async function ecranCompte(browser: Browser, baseURL: string | undefined, serveur: FauxServeur, cle: string | null, muet = false, horloge = false) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR', baseURL, colorScheme: 'dark',
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }, { name: 'go.connait-go.v1', value: '"sait"' }] }] },
  });
  const page = await brancher(ctx, serveur, { 'go.essai.v1': JSON.stringify({ terminees: 3 }), ...(cle ? { 'e2e.turnstile': cle } : {}) });
  const scripts: string[] = [];
  await page.route('https://challenges.cloudflare.com/**', route => {
    scripts.push(route.request().url());
    return route.fulfill({ status: 200, contentType: 'text/javascript', body: fauxTurnstile(muet) });
  });
  const violations: string[] = [];
  page.on('console', m => { if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text()); });
  const otp: Record<string, unknown>[] = [];
  page.on('request', (r: Request) => { if (/\/auth\/v1\/otp(\?|$)/.test(r.url()) && r.method() === 'POST') otp.push(r.postDataJSON()); });
  // Horloge simulée installée avant l'ouverture : installée après, le minuteur déjà armé du compte à rebours resterait réel.
  if (horloge) await page.clock.install();
  await page.goto('/');
  await toucherCta(page);
  await expect(page.getByRole('heading', { name: 'Crée ton compte' })).toBeVisible();
  return { page, scripts, violations, otp };
}

async function demanderCode(page: Page, email: string) {
  await page.getByLabel('Ton adresse e-mail').fill(email);
  await page.getByRole('checkbox', { name: /J’ai 15\s+ans ou plus/ }).check();
  await page.getByRole('button', { name: 'Recevoir mon code' }).click();
}

test('sans clé : ni script de Cloudflare, ni widget, la demande de code part sans jeton', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const { page, scripts, otp } = await ecranCompte(browser, baseURL, serveur, null);
  await expect(page.getByTestId('captcha')).toHaveCount(0);
  await demanderCode(page, 'sans-cle@exemple.test');
  await expect(page.getByLabel('Code à 6 chiffres')).toBeVisible();
  expect(scripts).toEqual([]);
  expect(otp).toHaveLength(1);
  expect((otp[0].gotrue_meta_security as { captcha_token?: string } | undefined)?.captcha_token).toBeUndefined();
});

test('avec clé : un jeton par envoi (code, puis renvoi), sous la CSP, et le compte se crée', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const { page, scripts, violations, otp } = await ecranCompte(browser, baseURL, serveur, '1x00000000000000000000AA', false, true);
  const widget = page.getByTestId('captcha');
  await expect(widget).toHaveAttribute('aria-label', 'Vérification anti-robot');
  await expect(widget).toContainText('Turnstile w1');
  await demanderCode(page, 'avec-cle@exemple.test');
  await expect(page.getByLabel('Code à 6 chiffres')).toBeVisible();
  expect(scripts).toEqual([SCRIPT]);
  expect(otp[0].gotrue_meta_security).toEqual({ captcha_token: 'jeton-e2e-1' });
  // Renvoi (après le délai d'une minute) : un nouveau widget, un nouveau jeton. #642 : le compte à rebours est une chaîne
  // de minuteurs d'une seconde réarmée après chaque rendu ; `fastForward` n'en sautait qu'un, la minute passait en vrai.
  for (let s = 0; s <= 60; s++) await page.clock.runFor(1000);
  await page.getByRole('button', { name: 'Renvoyer le code' }).click();
  await expect.poll(() => otp.length).toBe(2);
  expect((otp[1].gotrue_meta_security as { captcha_token: string }).captcha_token).toMatch(/^jeton-e2e-[2-9]$/);
  expect(otp[1].gotrue_meta_security).not.toEqual(otp[0].gotrue_meta_security);
  await page.getByLabel('Code à 6 chiffres').fill(CODE);
  await expect(page.getByTestId('pseudo-obligatoire')).toBeVisible();
  expect(violations).toEqual([]);
});

test('avec clé, jeton pas encore là : phrase claire, rien n’est envoyé', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const { page, otp } = await ecranCompte(browser, baseURL, serveur, '1x00000000000000000000AA', true);
  await expect(page.getByTestId('captcha')).toContainText('Turnstile w1');
  await demanderCode(page, 'muet@exemple.test');
  await expect(page.getByRole('alert')).toHaveText('Vérification anti-robot en cours. Réessaie dans un instant.');
  expect(otp).toHaveLength(0);
});

test('avec clé, jeton refusé par Supabase (captcha_failed) : phrase claire, nouveau jeton pour réessayer', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const { page, otp } = await ecranCompte(browser, baseURL, serveur, '1x00000000000000000000AA');
  await page.route(/\/auth\/v1\/otp(\?|$)/, route => route.fulfill({ status: 400, contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify({ code: 400, error_code: 'captcha_failed', msg: 'captcha protection: request disallowed (invalid-input-response)' }) }));
  await expect(page.getByTestId('captcha')).toContainText('Turnstile w1');
  await demanderCode(page, 'refuse@exemple.test');
  await expect(page.getByRole('alert')).toHaveText('La vérification anti-robot n’a pas marché. Recharge la page, puis réessaie.');
  expect(otp).toHaveLength(1);
  await expect(page.getByTestId('captcha')).toContainText('Turnstile w2');
});
