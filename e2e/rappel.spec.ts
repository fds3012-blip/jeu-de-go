import { gunzipSync } from 'node:zlib';
import { expect, test, type Page, type Request, type Route } from '@playwright/test';
import { passer } from './plateau';

// Issue #36 : rappel quotidien du Go du jour par notification web.
// Sans vraie base ni vrai service de notification : Supabase est simulé par interception réseau (adresse lue dans
// `e2e.supabase`, voir src/data/supabase.ts), la clé publique VAPID est posée dans `e2e.vapid` (build de test seulement),
// l'API Notification est remplacée, et PushManager rend un abonnement factice.

const SUPABASE = 'https://supabase.e2e.test';
const CLE = 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM';
const JOUEUR = 'aaaaaaaa-0000-4000-8000-000000000001';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
// PostHog simulé (comme e2e/url-sensible.spec.ts) : on lit les événements envoyés.
const POSTHOG = 'https://posthog-e2e.test';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

interface Options { compte?: boolean; vapid?: boolean; reponse?: 'granted' | 'denied' }

/** Corps d'un envoi PostHog, quel que soit son encodage (gzip, base64 en formulaire, JSON brut). */
function lireEnvoi(r: Request): string {
  const brut = r.postDataBuffer();
  if (!brut) return '';
  if (new URL(r.url()).searchParams.get('compression') === 'gzip-js' || (brut[0] === 0x1f && brut[1] === 0x8b)) return gunzipSync(brut).toString('utf8');
  const texte = brut.toString('utf8');
  if (!texte.startsWith('data=')) return texte;
  const data = decodeURIComponent(texte.slice(5).split('&')[0].replace(/\+/g, ' '));
  try { return Buffer.from(data, 'base64').toString('utf8'); } catch { return data; }
}

/** Faux Supabase : session d'un vrai compte, profil, inscription et suppression de l'abonnement. */
function fauxServeur() {
  const appels: { chemin: string; methode: string; corps: unknown }[] = [];
  async function traiter(route: Route) {
    const req = route.request();
    const url = new URL(req.url());
    const json = (corps: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(corps),
      headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (req.method() === 'OPTIONS') return json({});
    let corps: unknown;
    try { corps = req.postDataJSON(); } catch { corps = null; }
    appels.push({ chemin: url.pathname + url.search, methode: req.method(), corps });
    if (url.pathname === '/auth/v1/user') return json(utilisateur());
    if (url.pathname === '/rest/v1/rpc/enregistrer_abonnement_rappel') return json('bbbbbbbb-0000-4000-8000-000000000009');
    if (url.pathname === '/rest/v1/profiles') {
      const ligne = { id: JOUEUR, username: 'Alice', rating: 800, puzzle_rating: 800, streak_days: 0, streak_last: null, gels: 0 };
      return json((req.headers()['accept'] ?? '').includes('vnd.pgrst.object') ? ligne : [ligne]);
    }
    if (url.pathname.startsWith('/rest/v1/rpc/')) return json(null);
    if (url.pathname.startsWith('/rest/v1/')) return json([]);
    return json({});
  }
  const evenements: string[] = [];
  return { traiter, appels, evenements };
}

function utilisateur() {
  return { id: JOUEUR, aud: 'authenticated', role: 'authenticated', is_anonymous: false, email: 'alice@exemple.test',
    app_metadata: {}, user_metadata: {}, identities: [], created_at: '2026-09-30T10:00:00Z' };
}

async function preparer(page: Page, { compte = true, vapid = true, reponse = 'granted' }: Options = {}) {
  const serveur = fauxServeur();
  await page.route(`${SUPABASE}/**`, route => serveur.traiter(route));
  await page.route(`${POSTHOG}/**`, async route => {
    if (route.request().method() === 'POST') serveur.evenements.push(lireEnvoi(route.request()));
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":1}' });
  });
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const expire = Math.floor(Date.now() / 1000) + 3600 * 24;
  const jeton = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: JOUEUR, role: 'authenticated', is_anonymous: false, exp: expire })}.signature`;
  const session = compte ? JSON.stringify({ access_token: jeton, refresh_token: 'r1', token_type: 'bearer', expires_in: 86400, expires_at: expire, user: utilisateur() }) : null;
  await page.addInitScript(({ adresse, cle, session, reponse, posthog }) => {
    localStorage.setItem('e2e.supabase', adresse);
    // posthog-js ignore les navigateurs pilotés : on se présente comme un navigateur ordinaire.
    localStorage.setItem('e2e.posthog.hote', posthog);
    Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false });
    Object.defineProperty(Navigator.prototype, 'userAgentData', { get: () => undefined });
    if (cle) localStorage.setItem('e2e.vapid', cle);
    // Clé de session de supabase-js : `sb-<premier mot de l'hôte>-auth-token`.
    if (session && !localStorage.getItem('e2e.session-posee')) {
      localStorage.setItem('sb-supabase-auth-token', session);
      localStorage.setItem('e2e.session-posee', '1');
    }
    const w = window as unknown as Record<string, unknown>;
    w.__demandes = 0;
    // API Notification simulée : la réponse du joueur à la fenêtre du navigateur est fixée par le test.
    class FausseNotification {
      static permission: string = 'default';
      static async requestPermission() {
        (w.__demandes as number)++;
        FausseNotification.permission = reponse;
        return reponse;
      }
    }
    Object.defineProperty(window, 'Notification', { value: FausseNotification, configurable: true, writable: true });
    // Abonnement factice : un vrai service de notification n'est pas joignable depuis le test.
    const abonnement = {
      endpoint: 'https://push.exemple.test/abonnement-1',
      toJSON: () => ({ endpoint: 'https://push.exemple.test/abonnement-1', keys: { p256dh: 'p'.repeat(87), auth: 'a'.repeat(22) } }),
      unsubscribe: async () => { w.__abonne = false; return true; },
    };
    if ('PushManager' in window) {
      const pm = (window as unknown as { PushManager: { prototype: Record<string, unknown> } }).PushManager.prototype;
      pm.getSubscription = async () => (w.__abonne ? abonnement : null);
      pm.subscribe = async (o: { applicationServerKey: ArrayBuffer | Uint8Array }) => {
        w.__cle = Array.from(new Uint8Array(o.applicationServerKey as ArrayBuffer)).length;
        w.__abonne = true;
        return abonnement;
      };
    }
  }, { adresse: SUPABASE, cle: vapid ? CLE : '', session, reponse, posthog: POSTHOG });
  return serveur;
}

/** Une partie contre Pomme menée à son terme : deux passes sur plateau vide, défaite au komi. */
async function finirUnePartie(page: Page) {
  await page.goto('/');
  await page.locator('.cta').click();
  await expect(page.locator('svg.board[aria-label="Plateau de go 9 × 9"]')).toBeVisible();
  await passer(page);
  await expect(page.getByRole('heading', { level: 2, name: 'Défaite' })).toBeVisible({ timeout: 15_000 });
}

const carte = (page: Page) => page.locator('aside.rappel');
const demandes = (page: Page) => page.evaluate(() => (window as unknown as { __demandes: number }).__demandes);
const etat = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('go.rappel.v1') ?? 'null'));
const ouvrirProfil = (page: Page) => page.getByRole('navigation').getByRole('button', { name: 'Profil' }).click();

// Fuseau de l'appareil : envoyé au serveur pour que le rappel parte à l'heure du joueur.
test.use({ timezoneId: 'Europe/Paris', userAgent: ANDROID });
test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: 'reduce' }); });

test('après la première partie terminée : proposé une fois, heure simple, accepté, puis réglé dans le Profil', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', e => erreurs.push(e.message));
  const serveur = await preparer(page);
  await finirUnePartie(page);

  // La carte arrive sous l'action principale, qui reste unique : « Rejouer ».
  await expect(carte(page)).toBeVisible();
  await expect(carte(page).getByRole('heading', { name: 'Un rappel pour le Go du jour ?' })).toBeVisible();
  await expect(carte(page)).toContainText('Jamais la nuit');
  await expect(page.locator('.cta')).toHaveCount(1);
  const moments = carte(page).getByRole('group', { name: 'Quand ?' }).getByRole('button');
  await expect(moments).toHaveText(['Matin, 9 h', 'Midi', 'Soir, 18 h']);
  for (const b of await moments.all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(carte(page).getByRole('button', { name: 'Soir, 18 h' })).toHaveAttribute('aria-pressed', 'true');
  // La permission du navigateur n'est pas demandée avant le geste du joueur.
  expect(await demandes(page)).toBe(0);
  expect(await etat(page)).toMatchObject({ proposition: 'proposee' });

  await carte(page).getByRole('button', { name: 'Midi' }).click();
  await carte(page).getByRole('button', { name: 'Me le rappeler' }).click();
  await expect(carte(page).getByRole('status')).toHaveText(/un rappel par jour, vers midi/);
  expect(await demandes(page)).toBe(1);
  expect(await etat(page)).toEqual({ proposition: 'acceptee', actif: true, moment: 'midi' });
  // Inscription sur le serveur, pour ce compte : clé publique de 65 octets, fuseau et langue de l'appareil.
  expect(await page.evaluate(() => (window as unknown as { __cle: number }).__cle)).toBe(65);
  const inscription = serveur.appels.find(a => a.chemin.startsWith('/rest/v1/rpc/enregistrer_abonnement_rappel'));
  expect(inscription?.corps).toMatchObject({ p_endpoint: 'https://push.exemple.test/abonnement-1', p_moment: 'midi', p_langue: 'fr' });
  expect((inscription?.corps as { p_fuseau: string }).p_fuseau).toBe('Europe/Paris');

  // Mesure : proposition, puis acceptation avec le moment choisi (le SDK groupe ses envois).
  await expect.poll(() => serveur.evenements.join('\n'), { timeout: 15_000 }).toMatch(/"event":"rappel_accepte"/);
  const envoye = serveur.evenements.join('\n');
  expect(envoye).toMatch(/"event":"rappel_propose"/);
  expect(envoye).toMatch(/"moment_jour":"midi"/);

  // Une seule fois : la partie suivante ne propose plus rien.
  await page.getByRole('button', { name: /^Rejouer/ }).click();
  await passer(page);
  await expect(page.getByRole('heading', { level: 2, name: 'Défaite' })).toBeVisible({ timeout: 15_000 });
  await expect(carte(page)).toHaveCount(0);

  // Profil : la ligne dit le moment ; on le change, puis on coupe le rappel.
  await page.getByRole('button', { name: /accueil/i }).first().click();
  await ouvrirProfil(page);
  const ligne = page.getByRole('button', { name: /Rappel du Go du jour/ });
  await expect(ligne).toContainText('Midi');
  await ligne.click();
  await expect(page.getByRole('heading', { level: 2, name: 'Rappel du Go du jour' })).toBeVisible();
  const interrupteur = page.getByRole('switch', { name: /Un rappel chaque jour/ });
  await expect(interrupteur).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('group', { name: 'Quand ?' }).getByRole('button', { name: 'Matin, 9 h' }).click();
  await expect.poll(() => serveur.appels.filter(a => a.chemin.startsWith('/rest/v1/rpc/enregistrer_abonnement_rappel')).length).toBe(2);
  await expect(page.getByRole('group', { name: 'Quand ?' }).getByRole('button', { name: 'Matin, 9 h' })).toHaveAttribute('aria-pressed', 'true');
  expect(await etat(page)).toMatchObject({ actif: true, moment: 'matin' });
  await interrupteur.click();
  await expect(interrupteur).toHaveAttribute('aria-checked', 'false');
  await expect.poll(() => serveur.appels.some(a => a.methode === 'DELETE' && a.chemin.startsWith('/rest/v1/abonnements_rappel'))).toBe(true);
  expect(await page.evaluate(() => (window as unknown as { __abonne: boolean }).__abonne)).toBe(false);
  await expect.poll(() => etat(page)).toMatchObject({ actif: false });
  await page.getByRole('button', { name: 'Retour' }).click();
  await expect(page.getByRole('button', { name: /Rappel du Go du jour/ })).toContainText('Coupé');
  expect(erreurs).toEqual([]);
});

test('« Non merci » est définitif, et la permission du navigateur n’est jamais demandée', async ({ page }) => {
  await preparer(page);
  await finirUnePartie(page);
  await carte(page).getByRole('button', { name: 'Non merci' }).click();
  await expect(carte(page)).toHaveCount(0);
  expect(await etat(page)).toMatchObject({ proposition: 'refusee', actif: false });
  await page.reload();
  await finirUnePartie(page);
  await expect(page.locator('.fin-liens')).toBeVisible();
  await expect(carte(page)).toHaveCount(0);
  expect(await demandes(page)).toBe(0);
});

test('refus dans la fenêtre du navigateur : le joueur sait comment revenir dessus', async ({ page }) => {
  await preparer(page, { reponse: 'denied' });
  await finirUnePartie(page);
  await carte(page).getByRole('button', { name: 'Me le rappeler' }).click();
  await expect(carte(page).getByRole('status')).toHaveText(/bloque les notifications/);
  expect(await etat(page)).toMatchObject({ proposition: 'refusee', actif: false });
});

test('sans compte : pas de proposition ; le Profil explique que le rappel demande un compte', async ({ page }) => {
  await preparer(page, { compte: false });
  await finirUnePartie(page);
  await expect(page.locator('.fin-liens')).toBeVisible();
  await expect(carte(page)).toHaveCount(0);
  await page.goto('/');
  await ouvrirProfil(page);
  await page.getByRole('button', { name: /Rappel du Go du jour/ }).click();
  await expect(page.getByText(/réservé aux joueurs avec un compte/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mon compte' })).toBeVisible();
});

test('rappel pas encore configuré (pas de clé VAPID) : ni proposition, ni ligne dans le Profil', async ({ page }) => {
  await preparer(page, { vapid: false });
  await finirUnePartie(page);
  await expect(page.locator('.fin-liens')).toBeVisible();
  await expect(carte(page)).toHaveCount(0);
  await page.goto('/');
  await ouvrirProfil(page);
  await expect(page.getByRole('button', { name: 'Réglages' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Rappel du Go du jour/ })).toHaveCount(0);
});

test('la notification touchée ouvre le Go du jour, et l’adresse est nettoyée', async ({ page }) => {
  const serveur = await preparer(page);
  await page.addInitScript(() => localStorage.setItem('go.rappel.v1', JSON.stringify({ proposition: 'acceptee', actif: true, moment: 'soir' })));
  await page.clock.setFixedTime(new Date('2026-09-27T12:00:00+02:00'));
  await page.goto('/?rappel=1');
  await expect(page.getByText(/^Go du jour n°\s1$/)).toBeVisible();
  await expect.poll(() => new URL(page.url()).search).toBe('');
  // `rappel_ouvert` est mesuré, avec le moment choisi ; ce n'est pas une arrivée par un lien partagé.
  await expect.poll(() => serveur.evenements.join('\n'), { timeout: 15_000 }).toMatch(/"event":"rappel_ouvert"/);
  expect(serveur.evenements.join('\n')).toMatch(/"moment_jour":"soir"/);
  expect(serveur.evenements.join('\n')).not.toMatch(/"event":"arrivee_par_partage"/);
});

test.describe('iPhone dans Safari', () => {
  test.use({ userAgent: IPHONE });
  test('pas de proposition ; le Profil explique qu’il faut installer l’app', async ({ page }) => {
    await preparer(page);
    await finirUnePartie(page);
    await expect(page.locator('.fin-liens')).toBeVisible();
    await expect(carte(page)).toHaveCount(0);
    await page.goto('/');
    await ouvrirProfil(page);
    await page.getByRole('button', { name: /Rappel du Go du jour/ }).click();
    await expect(page.getByText(/seulement dans l’app installée sur l’écran d’accueil/)).toBeVisible();
    await page.getByRole('button', { name: 'Installer l’app' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Installer l’app' })).toBeVisible();
  });
});

test.describe('petit écran, mode sombre', () => {
  test.use({ viewport: { width: 320, height: 640 }, colorScheme: 'dark' });
  test('la carte tient en 320 px, cibles de 44 px, sans défilement horizontal', async ({ page }) => {
    await preparer(page);
    await finirUnePartie(page);
    await expect(carte(page)).toBeVisible();
    await carte(page).scrollIntoViewIfNeeded();
    for (const b of await carte(page).getByRole('button').all()) {
      const boite = (await b.boundingBox())!;
      expect(boite.height).toBeGreaterThanOrEqual(44);
      expect(boite.x + boite.width).toBeLessThanOrEqual(320);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);  });
});
