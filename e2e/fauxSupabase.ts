import type { BrowserContext, Page, Route, WebSocketRoute } from '@playwright/test';

// Supabase simulé par interception réseau, partagé par les parcours du compte (#343) et du défi par lien (#81).
// Le build de test lit l'adresse simulée dans le stockage local (`e2e.supabase`, voir src/data/supabase.ts).
// Auth : code à 6 chiffres (`/otp` puis `/verify`), le seul bon code est CODE. Tables : profiles, games, defis,
// notifications (#367). Temps réel : le WebSocket de Supabase Realtime (protocole Phoenix, sérialisation 2.0.0) est
// simulé ; seules les notifications sont poussées, à leur seul destinataire (RLS simulée).

export const SUPABASE = 'https://supabase.e2e.test';
export const CODE = '123456';
export const PARTIE = '11111111-1111-4111-8111-111111111111';
export const JETON = 'Ab3_-xYz'.padEnd(32, 'Q');

interface Utilisateur { id: string; anonyme: boolean; email?: string; nom?: string }
type Ligne = Record<string, unknown>;
/** Un abonné au temps réel : son jeton (donc son compte) et ses canaux, avec les filtres `postgres_changes` joints. */
interface Abonne {
  ws: WebSocketRoute;
  canaux: Map<string, { joinRef: string; filtres: { id: number; event: string; table?: string; filter?: string }[]; jeton?: string }>;
}

export function fauxServeur() {
  const jetons = new Map<string, Utilisateur>();
  const parEmail = new Map<string, Utilisateur>();
  let n = 0;
  const profiles: Ligne[] = [{ id: 'deja-la', username: 'Pris', rating: 1500, streak_days: 0, streak_last: null, streak_freezes: 0 }];
  const games: Ligne[] = [];
  const defis: Ligne[] = [];
  const notifications: Ligne[] = [];
  const abonnes = new Set<Abonne>();
  let idNotif = 0;
  let idFiltre = 0;
  const appels: string[] = [];
  const emailsEnvoyes: { email: string; type: string }[] = [];
  const autorisations: string[] = [];
  let google: { email: string; nom: string; annule?: boolean } | null = null;

  const jwt = (u: Utilisateur) => {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: u.id, role: 'authenticated', is_anonymous: u.anonyme, exp: Math.floor(Date.now() / 1000) + 3600, n: ++n })}.signature`;
  };
  const userJson = (u: Utilisateur) => ({ id: u.id, aud: 'authenticated', role: 'authenticated', is_anonymous: u.anonyme, email: u.email ?? '',
    app_metadata: u.nom ? { provider: 'google' } : {}, user_metadata: u.nom ? { full_name: u.nom, name: u.nom, avatar_url: 'https://lh3.googleusercontent.com/a/photo' } : {}, identities: [], created_at: new Date().toISOString() });
  const session = (u: Utilisateur) => {
    const token = jwt(u);
    jetons.set(token, u);
    return { access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: `r-${token}`, user: userJson(u) };
  };
  const qui = (route: Route) => jetons.get((route.request().headers()['authorization'] ?? '').replace(/^Bearer /, ''));

  /** Pousse un changement de `notifications` aux abonnés qui le voient (RLS : le destinataire seul) et l'ont filtré. */
  function pousser(type: 'INSERT' | 'UPDATE', n: Ligne) {
    for (const a of abonnes) {
      for (const [topic, c] of a.canaux) {
        if (jetons.get(c.jeton ?? '')?.id !== n.destinataire_id) continue;
        const ids = c.filtres.filter(f => f.table === 'notifications' && (f.event === '*' || f.event === type)
          && (!f.filter || f.filter === `destinataire_id=eq.${String(n.destinataire_id)}`)).map(f => f.id);
        if (!ids.length) continue;
        a.ws.send(JSON.stringify([c.joinRef, null, topic, 'postgres_changes', { ids, data: {
          schema: 'public', table: 'notifications', commit_timestamp: new Date().toISOString(), type, errors: null,
          columns: [], record: n, old_record: type === 'UPDATE' ? { id: n.id } : undefined } }]));
      }
    }
  }
  /** Comme le déclencheur `notifier` : une seule notification en attente par joueur, type et partie. */
  function notifier(destinataire: unknown, type: string, partie: string | null) {
    if (!destinataire) return;
    const deja = notifications.find(n => n.destinataire_id === destinataire && n.type === type && n.partie_id === partie && n.lue_le === null);
    if (deja) { deja.creee_le = new Date().toISOString(); pousser('UPDATE', deja); return; }
    const n = { id: ++idNotif, destinataire_id: destinataire, type, partie_id: partie, creee_le: new Date().toISOString(), lue_le: null };
    notifications.push(n);
    pousser('INSERT', n);
  }
  /** Marque lues les notifications qui répondent au filtre, et prévient leur destinataire. */
  function marquer(filtre: (n: Ligne) => boolean): number {
    const l = notifications.filter(n => n.lue_le === null && filtre(n));
    for (const n of l) { n.lue_le = new Date().toISOString(); pousser('UPDATE', n); }
    return l.length;
  }
  /** Simule Supabase Realtime pour un téléphone : rejoindre un canal, battement de cœur, quitter. */
  function brancherTempsReel(ws: WebSocketRoute) {
    const a: Abonne = { ws, canaux: new Map() };
    abonnes.add(a);
    ws.onClose(() => abonnes.delete(a));
    ws.onMessage(brut => {
      const [joinRef, ref, topic, event, payload] = JSON.parse(String(brut)) as [string, string, string, string, Record<string, unknown>];
      const repondre = (response: unknown = {}) => ws.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response }]));
      if (event === 'heartbeat') return repondre();
      if (event === 'phx_join') {
        const config = (payload.config ?? {}) as { postgres_changes?: { event: string; schema?: string; table?: string; filter?: string }[] };
        const filtres = (config.postgres_changes ?? []).map(f => ({ ...f, id: ++idFiltre }));
        a.canaux.set(topic, { joinRef, filtres, jeton: payload.access_token as string | undefined });
        return repondre({ postgres_changes: filtres });
      }
      if (event === 'access_token') { const c = a.canaux.get(topic); if (c) c.jeton = payload.access_token as string; return; }
      if (event === 'phx_leave') { a.canaux.delete(topic); return repondre(); }
    });
  }

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
    // #354 : « Continuer avec Google » simulé. Le navigateur arrive ici (redirection) ; on renvoie tout de suite vers
    // `redirect_to`, avec la session dans le fragment (flux implicite) ou l'erreur d'une connexion annulée.
    if (chemin === '/auth/v1/authorize') {
      const retour = url.searchParams.get('redirect_to') ?? '/';
      autorisations.push(url.searchParams.get('provider') ?? '');
      let fragment: string;
      if (!google || google.annule) fragment = 'error=access_denied&error_code=access_denied&error_description=The+user+denied+access';
      else {
        let v = parEmail.get(google.email);
        if (!v) {
          v = { id: '00000000-0000-4000-8000-000000000099', anonyme: false, email: google.email, nom: google.nom };
          parEmail.set(google.email, v);
          profiles.push({ id: v.id, username: null, rating: 1500, streak_days: 0, streak_last: null, streak_freezes: 0 });
        } else v.nom = google.nom;
        const ses = session(v);
        fragment = new URLSearchParams({ access_token: ses.access_token, refresh_token: ses.refresh_token, expires_in: '3600',
          expires_at: String(ses.expires_at), token_type: 'bearer', provider_token: 'jeton-google' }).toString();
      }
      return route.fulfill({ status: 200, contentType: 'text/html',
        body: `<!doctype html><title>Google</title><script>location.replace(${JSON.stringify(`${retour}#${fragment}`)})</script>` });
    }
    if (chemin === '/auth/v1/otp') {
      const { email, create_user } = req.postDataJSON() as { email: string; create_user?: boolean };
      // #353 : connexion seule (`shouldCreateUser: false`) à une adresse inconnue : refus, comme Supabase.
      if (create_user === false && !parEmail.has(email)) return json({ code: 422, error_code: 'otp_disabled', msg: 'Signups not allowed for otp' }, 422);
      emailsEnvoyes.push({ email, type: create_user === false ? 'connexion' : 'email' });
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
      if (req.method() === 'PUT' && parEmail.has((req.postDataJSON() as { email?: string }).email ?? '')) {
        // #353 : l'adresse a déjà un compte, comme Supabase (422 `email_exists`).
        return json({ code: 422, error_code: 'email_exists', msg: 'A user with this email address has already been registered' }, 422);
      }
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
    if (chemin === '/rest/v1/rpc/marquer_notifications_lues') {
      if (!u) return json({ message: 'Connexion requise' }, 401);
      const { p_partie, p_type } = req.postDataJSON() as { p_partie?: string; p_type?: string };
      return json(marquer(n => n.destinataire_id === u.id && (!p_partie || n.partie_id === p_partie) && (!p_type || n.type === p_type)));
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
      // Déclencheur `notifier_partie` : ce qui attendait est dépassé, l'adversaire est prévenu.
      marquer(n => n.partie_id === g.id && (n.type === 'tour' || n.type === 'comptage'));
      notifier(u.id === g.black_id ? g.white_id : g.black_id, 'tour', String(g.id));
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
      let lignes: Ligne[] = table === 'games' ? games : table === 'defis' ? defis : table === 'profiles' ? profiles
        : table === 'notifications' ? notifications : [];
      for (const [cle, val] of url.searchParams) {
        if (val.startsWith('eq.')) lignes = lignes.filter(l => String(l[cle]) === val.slice(3));
        if (val.startsWith('neq.')) lignes = lignes.filter(l => String(l[cle]) !== val.slice(4));
        if (val === 'is.null') lignes = lignes.filter(l => l[cle] === null || l[cle] === undefined);
        if (val.startsWith('ilike.')) { const motif = val.slice(6).replace(/\\(.)/g, '$1').toLowerCase(); lignes = lignes.filter(l => String(l[cle] ?? '').toLowerCase() === motif); }
        if (val.startsWith('in.(')) { const ids = val.slice(4, -1).split(','); lignes = lignes.filter(l => ids.includes(String(l[cle]))); }
        if (cle === 'or') { const ids = [...val.matchAll(/eq\.([^,)]+)/g)].map(m => m[1]); lignes = lignes.filter(l => ids.includes(String(l.createur_id)) || ids.includes(String(l.invite_id))); }
      }
      // RLS simulée : profils visibles par tous ; parties et défis par leurs seuls joueurs ; notifications par leur destinataire.
      if (table !== 'profiles') lignes = lignes.filter(l => !u ? false : [l.black_id, l.white_id, l.createur_id, l.invite_id, l.destinataire_id].includes(u.id));
      if (req.method() !== 'GET') return json(table === 'lesson_progress' ? [] : {});
      const objet = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object');
      return json(objet ? lignes[0] ?? null : lignes);
    }
    return json({});
  }
  /** Compte déjà créé (avec son pseudo), pour se connecter avec son adresse (#353). */
  function compteExistant(email: string, pseudo: string | null, id = '00000000-0000-4000-8000-0000000000ee') {
    const v: Utilisateur = { id, anonyme: false, email };
    parEmail.set(email, v);
    profiles.push({ id, username: pseudo, rating: 1500, streak_days: 0, streak_last: null, streak_freezes: 0 });
    return v;
  }
  /** Compte Google que « Continuer avec Google » renverra (#354) ; `annule` : le joueur annule chez Google. */
  function compteGoogle(c: { email: string; nom: string; annule?: boolean }) { google = c; }
  /** Session ouverte d'un compte complet (avec pseudo), à poser dans le stockage du navigateur (#367). */
  function sessionCompte(email: string, pseudo: string, id: string) { return session(compteExistant(email, pseudo, id)); }
  return { traiter, brancherTempsReel, notifier, appels, games, defis, notifications, profiles, emailsEnvoyes, sessionAnonyme, compteExistant,
    compteGoogle, sessionCompte, autorisations };
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
  await context.routeWebSocket(/\/realtime\/v1\/websocket/, ws => serveur.brancherTempsReel(ws));
  return context.newPage();
}

/** Crée un compte par le code reçu par e-mail, puis choisit le pseudo. */
export async function creerCompte(page: Page, email: string, pseudo: string): Promise<void> {
  await page.getByLabel('Ton adresse e-mail').fill(email);
  await page.getByRole('checkbox', { name: /J’ai 15\s+ans ou plus/ }).check();
  await page.getByRole('button', { name: 'Recevoir mon code' }).click();
  await page.getByLabel('Code à 6 chiffres').fill(CODE);
  await page.getByRole('textbox', { name: 'Pseudo' }).fill(pseudo);
  await page.getByText(`${pseudo} est libre.`).waitFor();
  await page.getByRole('button', { name: 'C’est mon pseudo' }).click();
}
