import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test';
import { jouer, pierres, plateau } from './plateau';

// Issue #81 : défier un ami par lien. Parcours création → lien → ouverture dans un 2e contexte (un autre téléphone),
// sans vraie base : Supabase est simulé par interception réseau. Le build de test lit l'adresse simulée dans
// le stockage local (`e2e.supabase`, voir src/data/supabase.ts).

const SUPABASE = 'https://supabase.e2e.test';
const PARTIE = '11111111-1111-4111-8111-111111111111';
const JETON = 'Ab3_-xYz'.padEnd(32, 'Q');

interface Utilisateur { id: string; anonyme: boolean; email?: string }
interface Ligne { [k: string]: unknown }

/** Faux serveur partagé par les deux téléphones : auth anonyme, RPC du défi, tables, fonction game-action. */
function fauxServeur() {
  const jetons = new Map<string, Utilisateur>();
  let n = 0;
  const games: Ligne[] = [];
  const defis: Ligne[] = [];
  const appels: string[] = [];

  const jwt = (u: Utilisateur) => {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: u.id, role: 'authenticated', is_anonymous: u.anonyme, exp: Math.floor(Date.now() / 1000) + 3600 })}.signature`;
  };
  const userJson = (u: Utilisateur) => ({ id: u.id, aud: 'authenticated', role: 'authenticated', is_anonymous: u.anonyme, email: u.email ?? '',
    app_metadata: {}, user_metadata: {}, identities: [], created_at: new Date().toISOString() });
  const qui = (route: Route) => jetons.get((route.request().headers()['authorization'] ?? '').replace(/^Bearer /, ''));

  async function traiter(route: Route) {
    const req = route.request();
    const url = new URL(req.url());
    const chemin = url.pathname;
    const json = (corps: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(corps),
      headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (req.method() === 'OPTIONS') return json({});
    appels.push(`${req.method()} ${chemin}`);
    const u = qui(route);

    if (chemin === '/auth/v1/signup') {
      const nouveau: Utilisateur = { id: `00000000-0000-4000-8000-00000000000${++n}`, anonyme: true };
      const token = jwt(nouveau);
      jetons.set(token, nouveau);
      return json({ access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: `r${n}`, user: userJson(nouveau) });
    }
    if (chemin === '/auth/v1/user') {
      if (!u) return json({ message: 'no session' }, 401);
      if (req.method() === 'PUT') u.email = (req.postDataJSON() as { email?: string }).email;
      return json({ ...userJson(u), new_email: u.email });
    }
    if (chemin === '/rest/v1/rpc/creer_defi') {
      if (!u) return json({ message: 'Connexion requise' }, 401);
      games.push({ id: PARTIE, white_id: u.id, black_id: null, created_by: u.id, size: 9, komi: 6.5, rules: 'japanese', handicap: 0, moves: '',
        status: 'waiting', counting: false, dead_stones: null, dead_proposed_by: null, result: null, resumed_at: 0, prive: true, rated: false });
      defis.push({ partie_id: PARTIE, jeton: JETON, createur_id: u.id, invite_id: null, delai_coup: '3 days', date_limite: null,
        lien_expire_le: new Date(Date.now() + 7 * 864e5).toISOString(), cree_le: new Date().toISOString() });
      return json([{ partie_id: PARTIE, jeton: JETON }]);
    }
    if (chemin === '/rest/v1/rpc/rejoindre_defi') {
      const { p_jeton } = req.postDataJSON() as { p_jeton: string };
      const d = defis.find(x => x.jeton === p_jeton);
      if (!u || !d) return json({ message: 'Défi introuvable' }, 400);
      const g = games.find(x => x.id === d.partie_id)!;
      if (u.id !== d.createur_id && !d.invite_id) {
        d.invite_id = u.id; g.black_id = u.id; g.status = 'active';
        d.date_limite = new Date(Date.now() + 3 * 864e5).toISOString();
      }
      return json(d.partie_id);
    }
    if (chemin === '/rest/v1/rpc/victoire_au_temps') return json(null);
    if (chemin === '/functions/v1/game-action') {
      const { action, game_id, move } = req.postDataJSON() as { action: string; game_id: string; move: string };
      const g = games.find(x => x.id === game_id);
      if (action !== 'defi_coup' || !g || !u) return json({ error: 'Demande invalide' }, 400);
      const trait = (g.moves as string).length / 2 % 2 === 0 ? g.black_id : g.white_id;
      if (trait !== u.id) return json({ error: 'Ce n’est pas ton tour' }, 409);
      g.moves = (g.moves as string) + move;
      defis[0].date_limite = new Date(Date.now() + 3 * 864e5).toISOString();
      return json({ ok: true, game: g });
    }
    if (chemin.startsWith('/rest/v1/')) {
      const table = chemin.slice('/rest/v1/'.length);
      let lignes: Ligne[] = table === 'games' ? games : table === 'defis' ? defis : [];
      for (const [cle, val] of url.searchParams) {
        if (val.startsWith('eq.')) lignes = lignes.filter(l => String(l[cle]) === val.slice(3));
        if (val.startsWith('in.(')) { const ids = val.slice(4, -1).split(','); lignes = lignes.filter(l => ids.includes(String(l[cle]))); }
        if (cle === 'or') { const ids = [...val.matchAll(/eq\.([^,)]+)/g)].map(m => m[1]); lignes = lignes.filter(l => ids.includes(String(l.createur_id)) || ids.includes(String(l.invite_id))); }
      }
      // RLS simulée : seuls les joueurs lisent leur partie et leur défi.
      lignes = lignes.filter(l => !u ? false : [l.black_id, l.white_id, l.createur_id, l.invite_id].includes(u.id));
      const objet = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object');
      return json(objet ? lignes[0] ?? null : lignes);
    }
    return json({});
  }
  return { traiter, appels, games };
}

async function telephone(context: BrowserContext, serveur: ReturnType<typeof fauxServeur>): Promise<Page> {
  await context.addInitScript(adresse => {
    localStorage.setItem('e2e.supabase', adresse);
    // Pas de feuille de partage native : la copie prend le relais. Le presse-papiers est simulé.
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t: string) => { (window as unknown as { __copie: string }).__copie = t; } }, configurable: true });
  }, SUPABASE);
  await context.route(`${SUPABASE}/**`, route => serveur.traiter(route));
  return context.newPage();
}

test('défier un ami : lien créé, ouvert sur un 2e téléphone sans compte, premier coup, inscription proposée', async ({ browser, baseURL }) => {
  const serveur = fauxServeur();
  const erreurs: string[] = [];
  const options = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', baseURL,
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: 'go.consentement.v1', value: 'refuse' }] }] } };

  // Téléphone 1 : le créateur, depuis l'accueil. « Défier un ami » reste un lien secondaire, sous le bouton principal.
  const ctxA = await browser.newContext(options);
  const a = await telephone(ctxA, serveur);
  a.on('pageerror', e => erreurs.push(e.message));
  await a.goto('/');
  const lien = a.getByRole('button', { name: 'Défier un ami' });
  await expect(lien).toBeVisible();
  await expect(lien).not.toHaveClass(/cta|primary/);
  await expect(a.locator('.cta')).toHaveCount(1); // l'action principale de l'accueil reste « Jouer »
  const boite = await lien.boundingBox();
  expect(boite!.height).toBeGreaterThanOrEqual(44);
  await lien.click();
  await expect(a.getByText('Envoie un lien à un ami. Il joue tout de suite, sans compte.')).toBeVisible();
  await expect(a.getByText(/chacun a 3 jours pour jouer son coup/)).toBeVisible();
  await a.getByRole('button', { name: 'Envoyer un lien' }).click();
  await expect(a.getByText('Lien copié. Colle-le dans un message.')).toBeVisible();
  const adresse = await a.getByTestId('defi-lien').locator('input').inputValue();
  expect(adresse).toBe(`${baseURL}/#defi=${JETON}`);
  expect(await a.evaluate(() => (window as unknown as { __copie: string }).__copie)).toBe(adresse);
  // Session anonyme ouverte pour créer le défi, puis creer_defi.
  expect(serveur.appels).toContain('POST /auth/v1/signup');
  expect(serveur.appels).toContain('POST /rest/v1/rpc/creer_defi');
  await expect(a.getByRole('button', { name: /Partie du .*Lien pas encore ouvert/ })).toBeVisible();
  // Pas de défilement horizontal à 390 px.
  expect(await a.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  // Téléphone 2 : l'ami ouvre le lien. Aucun compte : il joue tout de suite, avec Noir.
  const ctxB = await browser.newContext(options);
  const b = await telephone(ctxB, serveur);
  b.on('pageerror', e => erreurs.push(e.message));
  await b.goto(adresse);
  await expect(b.getByText('Ton ami te défie ! Tu as les pierres noires : à toi de commencer.')).toBeVisible();
  await expect(plateau(b)).toBeVisible();
  // Le jeton ne reste pas dans l'adresse.
  expect(new URL(b.url()).hash).toBe('');
  await jouer(b, 'E5'); // à la souris : pas de seconde touche de confirmation
  await expect(pierres(b, 'noir')).toHaveCount(1);
  await expect(b.getByText(/Au tour de ton ami\. Il lui reste [23]\s+jours/)).toBeVisible();
  // Inscription proposée après son premier coup : e-mail lié à la session anonyme (même identifiant).
  await expect(b.getByText('Garde ta partie')).toBeVisible();
  await b.getByLabel('Ton e-mail').fill('ami@exemple.test');
  await b.getByRole('button', { name: 'Garder ma partie' }).click();
  await expect(b.getByTestId('lier-envoye')).toBeVisible();
  expect(serveur.appels).toContain('PUT /auth/v1/user');
  expect(await b.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  // Téléphone 1 : le créateur retrouve la partie, c'est à lui de jouer.
  await a.getByRole('button', { name: /Partie du/ }).click();
  await expect(a.getByText(/À toi de jouer\. Il te reste [23]\s+jours/)).toBeVisible();
  await expect(pierres(a, 'noir')).toHaveCount(1);
  await expect(a.getByText('Garde ta partie')).toHaveCount(0); // pas encore joué

  expect(erreurs).toEqual([]);
  await ctxA.close();
  await ctxB.close();
});

test('lien invalide : message clair et retour à l’accueil', async ({ page }) => {
  const serveur = fauxServeur();
  await page.addInitScript(adresse => localStorage.setItem('e2e.supabase', adresse), SUPABASE);
  await page.route(`${SUPABASE}/**`, route => serveur.traiter(route));
  await page.goto(`/#defi=${'Z'.repeat(32)}`);
  await expect(page.getByRole('alert')).toContainText('Défi introuvable');
  await page.getByRole('button', { name: 'Retour à l’accueil' }).click();
  await expect(page.getByTestId('lien-defi')).toBeVisible();
});
