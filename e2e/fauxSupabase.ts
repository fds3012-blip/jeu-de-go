import type { BrowserContext, Page, Route } from '@playwright/test';

// Supabase simulé par interception réseau, partagé par les parcours du compte (#343) et du défi par lien (#81).
// Le build de test lit l'adresse simulée dans le stockage local (`e2e.supabase`, voir src/data/supabase.ts).
// Auth : code à 6 chiffres (`/otp` puis `/verify`), le seul bon code est CODE. Tables : profiles, games, defis.

export const SUPABASE = 'https://supabase.e2e.test';
export const CODE = '123456';
export const PARTIE = '11111111-1111-4111-8111-111111111111';
export const JETON = 'Ab3_-xYz'.padEnd(32, 'Q');

interface Utilisateur { id: string; anonyme: boolean; email?: string }
type Ligne = Record<string, unknown>;

export function fauxServeur() {
  const jetons = new Map<string, Utilisateur>();
  const parEmail = new Map<string, Utilisateur>();
  let n = 0;
  const profiles: Ligne[] = [{ id: 'deja-la', username: 'Pris', rating: 1500, streak_days: 0, streak_last: null, streak_freezes: 0 }];
  const games: Ligne[] = [];
  const defis: Ligne[] = [];
  const appels: string[] = [];
  const emailsEnvoyes: { email: string; type: string }[] = [];

  const jwt = (u: Utilisateur) => {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: u.id, role: 'authenticated', is_anonymous: u.anonyme, exp: Math.floor(Date.now() / 1000) + 3600, n: ++n })}.signature`;
  };
  const userJson = (u: Utilisateur) => ({ id: u.id, aud: 'authenticated', role: 'authenticated', is_anonymous: u.anonyme, email: u.email ?? '',
    app_metadata: {}, user_metadata: {}, identities: [], created_at: new Date().toISOString() });
  const session = (u: Utilisateur) => {
    const token = jwt(u);
    jetons.set(token, u);
    return { access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: `r-${token}`, user: userJson(u) };
  };
  const qui = (route: Route) => jetons.get((route.request().headers()['authorization'] ?? '').replace(/^Bearer /, ''));

  /** Ancienne session anonyme d'un défi (#81) : à poser dans le stockage du navigateur. */
  function sessionAnonyme(id = '00000000-0000-4000-8000-0000000000aa') {
    const u: Utilisateur = { id, anonyme: true };
    profiles.push({ id, username: null, rating: 1500, streak_days: 0, streak_last: null, streak_freezes: 0 });
    return session(u);
  }

  async function traiter(route: Route) {
    const req = route.request();
    const url = new URL(req.url());
    const chemin = url.pathname;
    const json = (corps: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(corps),
      headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (req.method() === 'OPTIONS') return json({});
    appels.push(`${req.method()} ${chemin}${url.search}`);
    const u = qui(route);

    if (chemin === '/auth/v1/signup') return json({ message: 'Anonymous sign-ins are disabled' }, 422);
    if (chemin === '/auth/v1/otp') {
      const { email } = req.postDataJSON() as { email: string };
      emailsEnvoyes.push({ email, type: 'email' });
      return json({});
    }
    if (chemin === '/auth/v1/verify') {
      const { email, token, type } = req.postDataJSON() as { email: string; token: string; type: string };
      if (token !== CODE) return json({ code: 'otp_expired', message: 'Token has expired or is invalid' }, 403);
      if (type === 'email_change') {
        const lie = [...jetons.values()].find(x => x.email === email);
        if (!lie) return json({ message: 'no user' }, 403);
        lie.anonyme = false;
        return json(session(lie));
      }
      let v = parEmail.get(email);
      if (!v) {
        v = { id: `00000000-0000-4000-8000-${String(parEmail.size + 1).padStart(12, '0')}`, anonyme: false, email };
        parEmail.set(email, v);
        profiles.push({ id: v.id, username: null, rating: 1500, streak_days: 0, streak_last: null, streak_freezes: 0 });
      }
      return json(session(v));
    }
    if (chemin === '/auth/v1/token') {
      const { refresh_token } = req.postDataJSON() as { refresh_token: string };
      const ancien = jetons.get(refresh_token.replace(/^r-/, ''));
      return ancien ? json(session(ancien)) : json({ message: 'invalid' }, 400);
    }
    if (chemin === '/auth/v1/user') {
      if (!u) return json({ message: 'no session' }, 401);
      if (req.method() === 'PUT') { u.email = (req.postDataJSON() as { email?: string }).email; emailsEnvoyes.push({ email: u.email ?? '', type: 'email_change' }); }
      return json({ ...userJson(u), new_email: u.email });
    }
    if (chemin === '/auth/v1/logout') return json({});
    if (chemin === '/rest/v1/rpc/creer_defi') {
      if (!u || u.anonyme) return json({ message: 'Compte requis' }, 401);
      games.push({ id: PARTIE, white_id: u.id, black_id: null, created_by: u.id, size: 9, komi: 6.5, rules: 'japanese', handicap: 0, moves: '',
        status: 'waiting', counting: false, dead_stones: null, dead_proposed_by: null, result: null, resumed_at: 0, prive: true, rated: false });
      defis.push({ partie_id: PARTIE, jeton: JETON, createur_id: u.id, invite_id: null, delai_coup: '3 days', date_limite: null,
        lien_expire_le: new Date(Date.now() + 7 * 864e5).toISOString(), cree_le: new Date().toISOString() });
      return json([{ partie_id: PARTIE, jeton: JETON }]);
    }
    if (chemin === '/rest/v1/rpc/rejoindre_defi') {
      const { p_jeton } = req.postDataJSON() as { p_jeton: string };
      const d = defis.find(x => x.jeton === p_jeton);
      if (!u || u.anonyme) return json({ message: 'Compte requis' }, 401);
      if (!d) return json({ message: 'Défi introuvable' }, 400);
      const g = games.find(x => x.id === d.partie_id)!;
      if (u.id !== d.createur_id && !d.invite_id) {
        d.invite_id = u.id; g.black_id = u.id; g.status = 'active';
        d.date_limite = new Date(Date.now() + 3 * 864e5).toISOString();
      }
      return json(d.partie_id);
    }
    if (chemin.startsWith('/rest/v1/rpc/')) return json(null);
    if (chemin === '/functions/v1/game-action') {
      const { action, game_id, move } = req.postDataJSON() as { action: string; game_id: string; move: string };
      const g = games.find(x => x.id === game_id);
      if (action !== 'defi_coup' || !g || !u) return json({ error: 'format' }, 400);
      if (u.anonyme) return json({ error: 'connexion' }, 401);
      const trait = (g.moves as string).length / 2 % 2 === 0 ? g.black_id : g.white_id;
      if (trait !== u.id) return json({ error: 'tour' }, 409);
      g.moves = (g.moves as string) + move;
      defis[0].date_limite = new Date(Date.now() + 3 * 864e5).toISOString();
      return json({ ok: true, game: g });
    }
    if (chemin === '/rest/v1/profiles' && req.method() === 'PATCH') {
      const id = url.searchParams.get('id')?.replace(/^eq\./, '');
      const { username } = req.postDataJSON() as { username: string };
      const p = profiles.find(x => x.id === id);
      if (!u || u.anonyme || !p || u.id !== id) return json({ code: '42501', message: 'denied' }, 403);
      if (profiles.some(x => x.id !== id && String(x.username ?? '').toLowerCase() === username.toLowerCase())) return json({ code: '23505', message: 'duplicate' }, 409);
      p.username = username;
      return json(p);
    }
    if (chemin.startsWith('/rest/v1/')) {
      const table = chemin.slice('/rest/v1/'.length);
      let lignes: Ligne[] = table === 'games' ? games : table === 'defis' ? defis : table === 'profiles' ? profiles : [];
      for (const [cle, val] of url.searchParams) {
        if (val.startsWith('eq.')) lignes = lignes.filter(l => String(l[cle]) === val.slice(3));
        if (val.startsWith('neq.')) lignes = lignes.filter(l => String(l[cle]) !== val.slice(4));
        if (val.startsWith('ilike.')) { const motif = val.slice(6).replace(/\\(.)/g, '$1').toLowerCase(); lignes = lignes.filter(l => String(l[cle] ?? '').toLowerCase() === motif); }
        if (val.startsWith('in.(')) { const ids = val.slice(4, -1).split(','); lignes = lignes.filter(l => ids.includes(String(l[cle]))); }
        if (cle === 'or') { const ids = [...val.matchAll(/eq\.([^,)]+)/g)].map(m => m[1]); lignes = lignes.filter(l => ids.includes(String(l.createur_id)) || ids.includes(String(l.invite_id))); }
      }
      // RLS simulée : profils visibles par tous ; parties et défis par leurs seuls joueurs.
      if (table !== 'profiles') lignes = lignes.filter(l => !u ? false : [l.black_id, l.white_id, l.createur_id, l.invite_id].includes(u.id));
      if (req.method() !== 'GET') return json(table === 'lesson_progress' ? [] : {});
      const objet = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object');
      return json(objet ? lignes[0] ?? null : lignes);
    }
    return json({});
  }
  return { traiter, appels, games, defis, profiles, emailsEnvoyes, sessionAnonyme };
}

export type FauxServeur = ReturnType<typeof fauxServeur>;

/** Branche un contexte de navigateur (un téléphone) sur le faux serveur, avec un stockage local de départ. */
export async function brancher(context: BrowserContext, serveur: FauxServeur, stockage: Record<string, string> = {}): Promise<Page> {
  await context.addInitScript(({ adresse, stockage }) => {
    if (sessionStorage.getItem('e2e.init')) return; // une seule fois : les rechargements gardent l'état
    sessionStorage.setItem('e2e.init', '1');
    localStorage.setItem('e2e.supabase', adresse);
    for (const [k, v] of Object.entries(stockage)) localStorage.setItem(k, v);
    // Pas de feuille de partage native : la copie prend le relais. Le presse-papiers est simulé.
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  }, { adresse: SUPABASE, stockage });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t: string) => { (window as unknown as { __copie: string }).__copie = t; } }, configurable: true });
  });
  await context.route(`${SUPABASE}/**`, route => serveur.traiter(route));
  return context.newPage();
}

/** Crée un compte par le code reçu par e-mail, puis choisit le pseudo. */
export async function creerCompte(page: Page, email: string, pseudo: string): Promise<void> {
  await page.getByLabel('Ton adresse e-mail').fill(email);
  await page.getByRole('checkbox', { name: /J’ai 15\s+ans ou plus/ }).check();
  await page.getByRole('button', { name: 'Recevoir mon code' }).click();
  await page.getByLabel('Code à 6 chiffres').fill(CODE);
  await page.getByLabel('Pseudo').fill(pseudo);
  await page.getByText(`${pseudo} est libre.`).waitFor();
  await page.getByRole('button', { name: 'C’est mon pseudo' }).click();
}
