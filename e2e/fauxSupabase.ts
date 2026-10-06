import type { BrowserContext, Page, Route, WebSocketRoute } from '@playwright/test';
import { parseActionRequest, planAction, type GameRow } from '../src/go/server';
import { fusionner, nettoyer } from '../src/app/reglagesCompte';

// Supabase simulé par interception réseau, partagé par les parcours du compte (#343) et du défi par lien (#81).
// Le build de test lit l'adresse simulée dans le stockage local (`e2e.supabase`, voir src/data/supabase.ts).
// Auth : code à 6 chiffres (`/otp` puis `/verify`), le seul bon code est CODE. Tables : profiles, games, defis,
// notifications (#367), parties_perso (#358 : `enregistrer_parties_perso`, sans doublon, compte avec pseudo exigé),
// parties partagées (#364 : `partager_partie`, `lire_partie_partagee` sans compte, `retirer_partie_partagee`).
// Temps réel : le WebSocket de Supabase Realtime (protocole Phoenix, sérialisation 2.0.0) est simulé. Sont poussées :
// les notifications, à leur seul destinataire ; et (#425) les UPDATE de `games`, `defis` et `parties_direct`, aux seuls
// joueurs de la partie (RLS simulée). `ralentirLectures(ms)` retarde les relectures (parties, pendule) : un coup qui
// s'affiche quand même vite est arrivé par l'événement. `figerTempsReel()` simule la connexion à demi ouverte d'un
// iPhone sorti de veille : plus rien ne passe, sans fermeture.
// Amis (#359) : `mes_amis`, `demander_ami`, `repondre_ami`, `retirer_ami`, `defier_ami`, mêmes règles et mêmes codes
// d'erreur que supabase/migrations/20261002010100_amis.sql (sauf les limites de temps).
// Cote de jeu (#417) : `rating_history` (lu par son seul titulaire), `choisir_depart_cote` (mêmes valeurs et mêmes
// codes que supabase/migrations/20261004120100_cote_glicko.sql). Le calcul Glicko-2 reste au serveur : un test sème
// directement l'historique d'une partie classée (`ratingHistory`).
// Partie en direct (#360) : `find_match` (file par taille, cadence et comptage ; celui qui attendait prend Noir ;
// #436 : après 30 s d'attente, les autres réglages sont acceptés, avec ceux de qui attendait le plus),
// `refuser_partie_direct` (#436 : partie annulée tant que le joueur n'y a pas joué),
// `quitter_file_attente`, `pendule_direct` (pendule simplifiée : temps décompté au coup, chute constatée à la lecture),
// actions `move`, `propose_dead`, `accept`, `resume` de game-action par la vraie logique (`planAction`, src/go/server.ts),
// `resign_game`. Fin classée : ±162 dans l'historique des deux joueurs, comme deux nouveaux (#417).
// Parties lentes (#440) : `chercher_partie_lente` (mêmes taille et délai ; celui qui attendait prend Noir et garde la
// partie dans sa ligne de `file_lente`), `quitter_file_lente`, lecture de `file_lente` (sa seule ligne), délai par coup
// de la partie (`defis.delai_coup`), perte au temps constatée au coup, à la lecture (`victoire_au_temps`) et par
// `tacheLentes()` (la tâche pg_cron), sur une horloge du serveur qu'un test avance (`avancerHorloge`). Classée :
// ±162 ; annulée sans cote si personne n'a vraiment joué.
// Sécurité (#363, #373) : `signaler`, `bloquer_joueur`, `debloquer_joueur`, `mes_blocages`, `dire_en_partie` (mêmes
// règles et mêmes codes que supabase/migrations/20261005220100_securite_signalements.sql, sauf la fin de partie depuis
// plus de 10 minutes) ; les INSERT de `messages_partie` sont poussés aux deux joueurs, sauf à celui qui a bloqué
// l'auteur ; `find_match` n'apparie jamais deux joueurs dont l'un a bloqué l'autre.
// Émulation entre amis (#369) : `noter_go_du_jour` (le numéro envoyé fait foi : l'horloge du navigateur est figée),
// `classement_go_du_jour`, `rappeler_go_du_jour` (notification `go_du_jour`), `bilan_semaine` (toutes les parties finies
// entre humains comptent pour la semaine en cours), `mes_records` (historique de cote du joueur). Mêmes règles et mêmes
// codes que supabase/migrations/20261005230100_emulation_amis.sql (sauf les limites de temps).
// Réglages du compte (#448) : `enregistrer_reglages`, « dernier changement gagne » clé par clé (à égalité, la valeur
// gardée reste), vrai compte exigé ; liste blanche de supabase/migrations/20261006123100_reglages_compte.sql
// (src/app/reglagesCompte.ts). `reglages` : réglages gardés par compte.

export const SUPABASE = 'https://supabase.e2e.test';
export const CODE = '123456';
export const PARTIE = '11111111-1111-4111-8111-111111111111';
export const JETON = 'Ab3_-xYz'.padEnd(32, 'Q');

interface Identite { identity_id: string; provider: string; email?: string }
interface Utilisateur { id: string; anonyme: boolean; email?: string; nom?: string; identites?: Identite[] }
/** Compte chez un fournisseur (#411) : `annule` : le joueur ferme la fenêtre du fournisseur. */
interface CompteSocial { email: string; nom: string; annule?: boolean }
type Ligne = Record<string, unknown>;
/** Un abonné au temps réel : son jeton (donc son compte) et ses canaux, avec les filtres `postgres_changes` joints. */
interface Abonne {
  ws: WebSocketRoute;
  /** Connexion à demi ouverte (#425) : plus rien ne passe dans un sens ni dans l'autre, sans fermeture. */
  fige?: boolean;
  canaux: Map<string, { joinRef: string; filtres: { id: number; event: string; table?: string; filter?: string }[]; jeton?: string }>;
}

export function fauxServeur() {
  const jetons = new Map<string, Utilisateur>();
  const parEmail = new Map<string, Utilisateur>();
  let n = 0;
  const profiles: Ligne[] = [{ id: 'deja-la', username: 'Pris', rating: 1500, streak_days: 0, streak_last: null, streak_freezes: 0 }];
  const games: Ligne[] = [];
  const defis: Ligne[] = [];
  const amities: { de: string; a: string; etat: 'pending' | 'accepted'; le: string }[] = [];
  const notifications: Ligne[] = [];
  const abonnes = new Set<Abonne>();
  let lenteur = 0;
  /** Événements temps réel poussés (#425) : `table:id` et l'heure d'envoi. */
  const pousses: { table: string; id: string; le: number }[] = [];
  let idNotif = 0;
  let idFiltre = 0;
  const partiesPerso: Ligne[] = [];
  /** Parties partagées par lien (#364) : jeton, propriétaire, SGF minimal, camp, adversaire, moment clé. */
  const partagees: Ligne[] = [];
  const ratingHistory: Ligne[] = [];
  const file: { user: string; taille: number; cadence: string; regles: string; depuis: number }[] = [];
  const pendules: Ligne[] = [];
  let nDirect = 0;
  /** File lente (#440), comme `public.file_lente`. */
  const fileLente: Ligne[] = [];
  let nLente = 0;
  /** Décalage de l'horloge du serveur (#440) : la perte au temps se joue en jours. */
  let decalage = 0;
  const maintenant = () => Date.now() + decalage;
  const appels: string[] = [];
  const emailsEnvoyes: { email: string; type: string }[] = [];
  const autorisations: string[] = [];
  /** Comptes que chaque fournisseur renverra (#354 : Google ; #411 : Apple, Facebook). */
  const sociaux = new Map<string, CompteSocial>();
  /** Identité d'un fournisseur (`google:a@b`) → son compte du jeu, comme `auth.identities`. */
  const parIdentite = new Map<string, Utilisateur>();
  /** « Manual linking » de Supabase (#411) : désactivé, `linkIdentity` est refusé. */
  let liaisonManuelle = true;
  let nIdentite = 0;
  const codesRattachement = new Map<string, string>();
  /** Go du jour par joueur (#369) : numéro, état, essais, ordre de réussite. */
  const goDuJour: { user: string; numero: number; etat: 'en_cours' | 'reussi' | 'vu'; essais: number; le: number }[] = [];
  const rappels: { de: string; a: string; numero: number }[] = [];
  /** Réglages du compte (#448), par identifiant de compte. */
  const reglages = new Map<string, Record<string, { v: unknown; t: number }>>();
  const identite = (provider: string, email?: string): Identite => ({ identity_id: `identite-${++nIdentite}`, provider, email });

  const jwt = (u: Utilisateur) => {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: u.id, role: 'authenticated', is_anonymous: u.anonyme, exp: Math.floor(Date.now() / 1000) + 3600, n: ++n })}.signature`;
  };
  const userJson = (u: Utilisateur) => ({ id: u.id, aud: 'authenticated', role: 'authenticated', is_anonymous: u.anonyme, email: u.email ?? '',
    app_metadata: u.identites?.[0] ? { provider: u.identites[0].provider } : {}, user_metadata: u.nom ? { full_name: u.nom, name: u.nom, avatar_url: 'https://lh3.googleusercontent.com/a/photo' } : {},
    identities: (u.identites ?? []).map(i => ({ id: i.identity_id, identity_id: i.identity_id, user_id: u.id, provider: i.provider,
      identity_data: { email: i.email, sub: i.identity_id }, created_at: new Date().toISOString(), last_sign_in_at: new Date().toISOString(), updated_at: new Date().toISOString() })),
    created_at: new Date().toISOString() });
  const session = (u: Utilisateur) => {
    const token = jwt(u);
    jetons.set(token, u);
    return { access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: `r-${token}`, user: userJson(u) };
  };
  const qui = (route: Route) => jetons.get((route.request().headers()['authorization'] ?? '').replace(/^Bearer /, ''));

  /** Pousse un changement de `notifications` aux abonnés qui le voient (RLS : le destinataire seul) et l'ont filtré. */
  function pousser(type: 'INSERT' | 'UPDATE', n: Ligne) {
    for (const a of abonnes) {
      if (a.fige) continue;
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
  /**
   * Pousse un UPDATE de `games`, `defis` ou `parties_direct` (#425) aux abonnés qui voient la ligne (RLS : les joueurs
   * de la partie) et ont un filtre `postgres_changes` qui la prend.
   */
  function pousserLigne(table: 'games' | 'defis' | 'parties_direct', ligne: Ligne) {
    const id = String(table === 'games' ? ligne.id : ligne.partie_id);
    const g = games.find(x => x.id === id);
    if (!g) return;
    const cle = table === 'games' ? 'id' : 'partie_id';
    for (const a of abonnes) {
      if (a.fige) continue;
      for (const [topic, c] of a.canaux) {
        const qui = jetons.get(c.jeton ?? '')?.id;
        if (!qui || (qui !== g.black_id && qui !== g.white_id)) continue;
        const ids = c.filtres.filter(f => f.table === table && (f.event === '*' || f.event === 'UPDATE') && (!f.filter || f.filter === `${cle}=eq.${id}`)).map(f => f.id);
        if (!ids.length) continue;
        pousses.push({ table, id, le: Date.now() });
        a.ws.send(JSON.stringify([c.joinRef, null, topic, 'postgres_changes', { ids, data: {
          schema: 'public', table, commit_timestamp: new Date().toISOString(), type: 'UPDATE', errors: null,
          columns: [], record: { ...ligne }, old_record: { [cle]: id } } }]));
      }
    }
  }
  /** Après une écriture sur une partie : ses lignes `games`, `defis` et `parties_direct` changées sont poussées. */
  function pousserPartie(g: Ligne, autres: { defi?: boolean; pendule?: boolean } = {}) {
    pousserLigne('games', g);
    const d = defis.find(x => x.partie_id === g.id);
    if (autres.defi && d) pousserLigne('defis', d);
    const p = pendules.find(x => x.partie_id === g.id);
    if (autres.pendule && p) pousserLigne('parties_direct', p);
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
      if (a.fige) return;
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

  const CADENCES: Record<string, [number, number, number]> = { rapide: [300000, 3, 20000], normale: [600000, 3, 30000], lente: [1200000, 5, 30000] };
  // Sécurité (#363, #373)
  const signalements: Ligne[] = [];
  const blocages: { de: string; a: string; le: string }[] = [];
  const messagesPartie: Ligne[] = [];
  let idMessage = 0;
  const estBloque = (x: string, y: string) => blocages.some(b => (b.de === x && b.a === y) || (b.de === y && b.a === x));
  /** Pousse un INSERT de `messages_partie` aux joueurs de la partie (RLS : sauf à qui a bloqué l'auteur). */
  function pousserMessage(m: Ligne) {
    const g = games.find(x => x.id === m.partie_id);
    if (!g) return;
    for (const a of abonnes) {
      if (a.fige) continue;
      for (const [topic, c] of a.canaux) {
        const qui = jetons.get(c.jeton ?? '')?.id;
        if (!qui || (qui !== g.black_id && qui !== g.white_id)) continue;
        if (qui !== m.auteur_id && blocages.some(b => b.de === qui && b.a === m.auteur_id)) continue;
        const ids = c.filtres.filter(f => f.table === 'messages_partie' && (f.event === '*' || f.event === 'INSERT')
          && (!f.filter || f.filter === `partie_id=eq.${String(m.partie_id)}`)).map(f => f.id);
        if (!ids.length) continue;
        pousses.push({ table: 'messages_partie', id: String(m.partie_id), le: Date.now() });
        a.ws.send(JSON.stringify([c.joinRef, null, topic, 'postgres_changes', { ids, data: {
          schema: 'public', table: 'messages_partie', commit_timestamp: new Date().toISOString(), type: 'INSERT', errors: null,
          columns: [], record: { ...m } } }]));
      }
    }
  }
  const directEnCours = (uid: string) => games.find(g => g.status === 'active' && pendules.some(p => p.partie_id === g.id) && (g.black_id === uid || g.white_id === uid));
  /** Fin d'une partie classée en direct : résultat, pendule arrêtée, cote ±162 (deux nouveaux, #417). */
  function finir(g: Ligne, resultat: string) {
    Object.assign(g, { status: 'finished', result: resultat, counting: false });
    const p = pendules.find(x => x.partie_id === g.id);
    if (p) p.trait_depuis = null;
    pousserPartie(g, { pendule: true });
    if (!g.rated || !/^[BW]\+/.test(resultat)) return;
    const gagnant = resultat.startsWith('B') ? g.black_id : g.white_id;
    for (const id of [g.black_id, g.white_id]) {
      const ecart = id === gagnant ? 162 : -162;
      ratingHistory.push({ user_id: id, kind: 'game', rating: 800 + ecart, ecart, rd: 290.32, game_id: g.id, created_at: new Date().toISOString() });
    }
  }
  /** Délai par coup d'un défi en ms (« 1 day », « 3 days »). */
  const delaiMs = (d: Ligne | undefined) => Number(/(\d+)\s*day/.exec(String(d?.delai_coup ?? '3 days'))?.[1] ?? 3) * 864e5;
  /**
   * Comme `defi_constater_temps` (#440) : délai passé, le joueur au trait perd ; partie classée : aussi au comptage (qui
   * doit répondre), annulée sans cote avant un coup chacun, sinon cote comptée. Renvoie vrai si la partie a fini.
   */
  function constaterDefi(g: Ligne): boolean {
    const d = defis.find(x => x.partie_id === g.id);
    if (!d?.date_limite || Date.parse(String(d.date_limite)) >= maintenant() || g.status !== 'active' || (g.counting && !g.rated)) return false;
    const coups = String(g.moves);
    let perdantNoir = (coups.length / 2) % 2 === 0;
    if (g.rated && g.counting && g.dead_proposed_by) perdantNoir = g.dead_proposed_by !== g.black_id;
    if (g.rated && coups.length < 4) {
      Object.assign(g, { status: 'aborted', counting: false });
      pousserPartie(g);
    } else finir(g, perdantNoir ? 'W+T' : 'B+T');
    for (const id of [g.black_id, g.white_id]) notifier(id, 'fin', String(g.id));
    return true;
  }
  /** La tâche pg_cron des parties lentes (#440) : pertes au temps. Renvoie le nombre de parties finies. */
  function tacheLentes(): number {
    return games.filter(g => g.rated && defis.some(d => d.partie_id === g.id)).filter(constaterDefi).length;
  }
  /** Avance l'horloge du serveur (#440). */
  function avancerHorloge(ms: number) { decalage += ms; }

  /** Constat de la chute (simplifié : sans absence) à la lecture de la pendule. */
  function constater(g: Ligne) {
    const p = pendules.find(x => x.partie_id === g.id);
    if (!p || g.status !== 'active' || g.counting || !p.trait_depuis) return;
    const noir = (String(g.moves).length / 2) % 2 === 0;
    const ecoule = Date.now() - Date.parse(String(p.trait_depuis));
    const ms = Number(noir ? p.noir_ms : p.blanc_ms), per = Number(noir ? p.noir_periodes : p.blanc_periodes);
    if (ecoule >= ms + per * Number(p.periode_ms)) finir(g, noir ? 'W+T' : 'B+T');
  }
  /** Coup décompté sur la pendule de qui l'a joué (comme le déclencheur games_direct_pendule). */
  function decompter(g: Ligne, avant: string) {
    const p = pendules.find(x => x.partie_id === g.id);
    if (!p || !p.trait_depuis) return;
    const noir = (avant.length / 2) % 2 === 0;
    const ecoule = Date.now() - Date.parse(String(p.trait_depuis));
    const cle = noir ? 'noir_ms' : 'blanc_ms';
    p[cle] = Math.max(0, Number(p[cle]) - ecoule);
    p[noir ? 'noir_vu_le' : 'blanc_vu_le'] = new Date().toISOString();
    p.trait_depuis = g.counting ? null : new Date().toISOString();
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
    // #425 : relectures retardées (la partie, la pendule, le constat du temps), pas les écritures.
    if (lenteur && ((req.method() === 'GET' && chemin === '/rest/v1/games') || chemin === '/rest/v1/rpc/pendule_direct'
      || chemin === '/rest/v1/rpc/victoire_au_temps')) await new Promise(r => setTimeout(r, lenteur));

    if (chemin === '/auth/v1/signup') return json({ message: 'Anonymous sign-ins are disabled' }, 422);
    // #354, #411 : « Continuer avec Google / Apple / Facebook » simulé. `linkIdentity` demande d'abord l'adresse du
    // fournisseur (JSON), avec la session en place ; refusé si la liaison manuelle est fermée, comme Supabase.
    if (chemin === '/auth/v1/user/identities/authorize') {
      if (!u) return json({ code: 401, error_code: 'no_authorization', msg: 'no session' }, 401);
      if (!liaisonManuelle) return json({ code: 404, error_code: 'manual_linking_disabled', msg: 'Manual linking is disabled' }, 404);
      const suite = new URL(`${SUPABASE}/auth/v1/authorize`);
      suite.searchParams.set('provider', url.searchParams.get('provider') ?? '');
      suite.searchParams.set('redirect_to', url.searchParams.get('redirect_to') ?? '/');
      suite.searchParams.set('lier', u.id);
      return json({ url: suite.toString() });
    }
    // Le navigateur arrive ici (redirection) ; on renvoie tout de suite vers `redirect_to`, avec la session dans le
    // fragment (flux implicite) ou l'erreur : connexion annulée, identité déjà reliée à un autre compte.
    if (chemin === '/auth/v1/authorize') {
      const retour = url.searchParams.get('redirect_to') ?? '/';
      const provider = url.searchParams.get('provider') ?? '';
      const lier = url.searchParams.get('lier');
      autorisations.push(lier ? `lier:${provider}` : provider);
      const social = sociaux.get(provider);
      const erreur = (p: Record<string, string>) => new URLSearchParams(p).toString();
      let fragment: string;
      if (!social || social.annule) fragment = erreur({ error: 'access_denied', error_code: 'access_denied', error_description: 'The user denied access' });
      else {
        const cle = `${provider}:${social.email}`;
        const deja = parIdentite.get(cle);
        let v: Utilisateur | undefined;
        if (lier) {
          v = [...jetons.values()].find(x => x.id === lier);
          if (deja && deja.id !== lier) v = undefined;
          else if (v && !deja) {
            // Liaison : même identifiant (les parties d'une session sans compte restent à elle, donc au compte).
            v.identites = [...(v.identites ?? []), identite(provider, social.email)];
            v.email ??= social.email;
            v.anonyme = false;
            parIdentite.set(cle, v);
            if (!parEmail.has(social.email)) parEmail.set(social.email, v);
          }
        } else {
          // Connexion : identité connue, sinon liaison automatique au compte de même e-mail, sinon compte neuf.
          v = deja ?? parEmail.get(social.email);
          if (!v) {
            v = { id: `00000000-0000-4000-8000-0000000000${provider === 'apple' ? '9a' : provider === 'facebook' ? '9f' : '99'}`,
              anonyme: false, email: social.email, identites: [] };
            parEmail.set(social.email, v);
            profiles.push({ id: v.id, username: null, rating: 1500, streak_days: 0, streak_last: null, streak_freezes: 0 });
          }
          if (!deja) { v.identites = [...(v.identites ?? []), identite(provider, social.email)]; parIdentite.set(cle, v); }
          v.nom = social.nom;
        }
        if (!v) fragment = erreur({ error: 'server_error', error_code: 'identity_already_exists', error_description: 'Identity is already linked to another user' });
        else {
          const ses = session(v);
          fragment = new URLSearchParams({ access_token: ses.access_token, refresh_token: ses.refresh_token, expires_in: '3600',
            expires_at: String(ses.expires_at), token_type: 'bearer', provider_token: `jeton-${provider}` }).toString();
        }
      }
      return route.fulfill({ status: 200, contentType: 'text/html',
        body: `<!doctype html><title>${provider}</title><script>location.replace(${JSON.stringify(`${retour}#${fragment}`)})</script>` });
    }
    if (chemin.startsWith('/auth/v1/user/identities/') && req.method() === 'DELETE') {
      if (!u) return json({ message: 'no session' }, 401);
      const id = chemin.slice('/auth/v1/user/identities/'.length);
      if ((u.identites ?? []).length <= 1) return json({ code: 422, error_code: 'single_identity_not_deletable', msg: 'User must have at least 1 identity after unlinking' }, 422);
      const i = (u.identites ?? []).find(x => x.identity_id === id);
      if (!i) return json({ code: 404, error_code: 'identity_not_found', msg: 'Identity not found' }, 404);
      u.identites = u.identites!.filter(x => x !== i);
      parIdentite.delete(`${i.provider}:${i.email}`);
      return json({});
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
        lie.identites = [...(lie.identites ?? []), identite('email', email)];
        return json(session(lie));
      }
      let v = parEmail.get(email);
      if (!v) {
        v = { id: `00000000-0000-4000-8000-${String(parEmail.size + 1).padStart(12, '0')}`, anonyme: false, email, identites: [identite('email', email)] };
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
    // Amis (#359) : refus avec les codes SQLSTATE du serveur.
    if (chemin.startsWith('/rest/v1/rpc/') && /_amis?$/.test(chemin)) {
      const nom = chemin.slice('/rest/v1/rpc/'.length);
      const refus = (code: string) => json({ code, message: code, details: null, hint: null }, 400);
      if (!u || u.anonyme) return refus('JGC01');
      const moi = profiles.find(x => x.id === u.id);
      if (!moi?.username) return refus('JGP01');
      const corps = (req.postDataJSON() ?? {}) as { p_pseudo?: string; p_accepter?: boolean };
      const pseudoDe = (id: string) => String(profiles.find(x => x.id === id)?.username ?? '');
      const lien = (autre: string) => amities.find(f => (f.de === u.id && f.a === autre) || (f.de === autre && f.a === u.id));
      if (nom === 'mes_amis') {
        return json(amities.filter(f => f.de === u.id || f.a === u.id).map(f => {
          const autre = f.de === u.id ? f.a : f.de;
          return { pseudo: pseudoDe(autre), etat: f.etat === 'accepted' ? 'ami' : f.de === u.id ? 'envoyee' : 'recue', depuis: f.le };
        }));
      }
      const cible = profiles.find(x => String(x.username ?? '').toLowerCase() === String(corps.p_pseudo ?? '').trim().toLowerCase());
      if (!cible) return refus('JGA01');
      const autre = String(cible.id);
      const f = lien(autre);
      if (nom === 'demander_ami') {
        if (autre === u.id) return refus('JGA02');
        if (f?.etat === 'accepted') return refus('JGA03');
        if (f && f.de === u.id) return refus('JGA04');
        if (f) { f.etat = 'accepted'; return json('amis'); }
        amities.push({ de: u.id, a: autre, etat: 'pending', le: new Date().toISOString() });
        return json('envoyee');
      }
      if (nom === 'repondre_ami') {
        if (!f || f.etat !== 'pending' || f.de !== autre) return refus('JGA07');
        if (corps.p_accepter) { f.etat = 'accepted'; return json('amis'); }
        amities.splice(amities.indexOf(f), 1);
        return json('refusee');
      }
      if (nom === 'retirer_ami') { if (f) amities.splice(amities.indexOf(f), 1); return json(null); }
      if (nom === 'defier_ami') {
        if (f?.etat !== 'accepted') return refus('JGA08');
        const id = `22222222-2222-4222-8222-${String(games.length + 1).padStart(12, '0')}`;
        games.push({ id, white_id: u.id, black_id: autre, created_by: u.id, size: 9, komi: 6.5, rules: 'japanese', handicap: 0, moves: '',
          status: 'active', counting: false, dead_stones: null, dead_proposed_by: null, result: null, resumed_at: 0, prive: true, rated: false });
        defis.push({ partie_id: id, jeton: `ami${games.length}`.padEnd(32, 'A'), createur_id: u.id, invite_id: autre, delai_coup: '3 days',
          date_limite: new Date(Date.now() + 3 * 864e5).toISOString(), lien_expire_le: new Date().toISOString(), cree_le: new Date().toISOString() });
        return json(id);
      }
    }
    // Émulation entre amis (#369).
    if (['noter_go_du_jour', 'classement_go_du_jour', 'rappeler_go_du_jour', 'bilan_semaine', 'mes_records'].some(n => chemin === `/rest/v1/rpc/${n}`)) {
      const nom = chemin.slice('/rest/v1/rpc/'.length);
      const refus = (code: string) => json({ code, message: code, details: null, hint: null }, 400);
      if (!u || u.anonyme) return refus('JGC01');
      if (!profiles.find(x => x.id === u.id)?.username) return refus('JGP01');
      const corps = (req.postDataJSON() ?? {}) as { p_numero?: number; p_resultat?: string; p_pseudo?: string; p_precedente?: boolean };
      // Comme `est_bloque` (#363) : un ami bloqué, dans un sens ou dans l'autre, n'est plus listé ni rappelé.
      const amisDe = (id: string) => amities.filter(f => f.etat === 'accepted' && (f.de === id || f.a === id)).map(f => (f.de === id ? f.a : f.de))
        .filter(x => !blocages.some(b => (b.de === id && b.a === x) || (b.de === x && b.a === id)));
      const numeroDuJour = () => Math.max(0, ...goDuJour.filter(g => g.user === u.id).map(g => g.numero));
      if (nom === 'noter_go_du_jour') {
        if (!['rate', 'reussi', 'vu'].includes(String(corps.p_resultat))) return refus('JGJ04');
        const numero = Number(corps.p_numero);
        let g = goDuJour.find(x => x.user === u.id && x.numero === numero);
        if (!g) { g = { user: u.id, numero, etat: 'en_cours', essais: 0, le: Date.now() }; goDuJour.push(g); }
        if (g.etat === 'en_cours') {
          g.essais = Math.min(99, g.essais + 1); g.le = Date.now();
          if (corps.p_resultat !== 'rate') g.etat = corps.p_resultat as 'reussi' | 'vu';
        }
        if (g.etat !== 'en_cours') marquer(n => n.destinataire_id === u.id && n.type === 'go_du_jour');
        return json(g.etat);
      }
      if (nom === 'classement_go_du_jour') {
        const numero = Math.max(numeroDuJour(), ...goDuJour.map(g => g.numero));
        const rang = (e: string) => (e === 'reussi' ? 0 : e === 'vu' ? 1 : 2);
        const lignes = [...amisDe(u.id), u.id].flatMap(id => {
          const p = profiles.find(x => x.id === id);
          if (!p?.username) return [];
          const g = goDuJour.find(x => x.user === id && x.numero === numero);
          const etat = g && g.etat !== 'en_cours' ? g.etat : 'pas_encore';
          return [{ pseudo: String(p.username), etat, essais: etat === 'reussi' ? g!.essais : null, moi: id === u.id,
            rappele: rappels.some(r => r.de === u.id && r.a === id && r.numero === numero), le: g?.le ?? Infinity }];
        });
        lignes.sort((a, b) => rang(a.etat) - rang(b.etat) || (a.essais ?? 99) - (b.essais ?? 99) || a.le - b.le || a.pseudo.localeCompare(b.pseudo));
        return json(lignes.map(({ le: _le, ...l }) => l));
      }
      if (nom === 'rappeler_go_du_jour') {
        const cible = profiles.find(x => String(x.username ?? '').toLowerCase() === String(corps.p_pseudo ?? '').trim().toLowerCase());
        if (!cible) return refus('JGA01');
        const autre = String(cible.id);
        if (autre === u.id) return refus('JGA02');
        if (!amisDe(u.id).includes(autre)) return refus('JGA08');
        const numero = Math.max(numeroDuJour(), ...goDuJour.map(g => g.numero));
        if (goDuJour.some(g => g.user === autre && g.numero === numero && g.etat !== 'en_cours')) return refus('JGJ02');
        if (rappels.some(r => r.de === u.id && r.a === autre && r.numero === numero)) return json('deja');
        rappels.push({ de: u.id, a: autre, numero });
        notifier(autre, 'go_du_jour', null);
        return json('envoye');
      }
      if (nom === 'bilan_semaine') {
        const lundi = (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); })();
        if (corps.p_precedente) return json({ semaine: lundi, parties: 0, victoires: 0, parties_classees: 0, cote_ecart: 0, go_du_jour: 0, amis: [] });
        const parties = games.filter(g => g.status === 'finished' && !g.bot_id && g.black_id && g.white_id && (g.black_id === u.id || g.white_id === u.id));
        const gagne = (g: Ligne) => (String(g.result).startsWith('B+') && g.black_id === u.id) || (String(g.result).startsWith('W+') && g.white_id === u.id);
        const amis = amisDe(u.id).flatMap(id => {
          const contre = parties.filter(g => g.black_id === id || g.white_id === id);
          return contre.length ? [{ pseudo: String(profiles.find(x => x.id === id)?.username), victoires: contre.filter(gagne).length, defaites: contre.filter(g => !gagne(g)).length }] : [];
        }).sort((a, b) => b.victoires - a.victoires);
        const classees = ratingHistory.filter(h => h.user_id === u.id && h.kind === 'game');
        return json({ semaine: lundi, parties: parties.length, victoires: parties.filter(gagne).length, parties_classees: classees.length,
          cote_ecart: classees.reduce((s, h) => s + Number(h.ecart ?? 0), 0), go_du_jour: goDuJour.filter(g => g.user === u.id && g.etat !== 'en_cours').length, amis: amis.slice(0, 5) });
      }
      // mes_records : victoire = points gagnés (Glicko-2 : une victoire fait toujours monter).
      const h = ratingHistory.filter(x => x.user_id === u.id && x.kind === 'game').sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
      let meilleure: Ligne | null = null, serie = 0, record = 0;
      for (const x of h) {
        if (!meilleure || Number(x.rating) > Number(meilleure.rating)) meilleure = x;
        serie = Number(x.ecart) > 0 ? serie + 1 : 0;
        record = Math.max(record, serie);
      }
      return json({ parties: h.length, meilleure_cote: meilleure ? meilleure.rating : null, meilleure_cote_le: meilleure ? String(meilleure.created_at).slice(0, 10) : null,
        serie_victoires: record, serie_en_cours: serie });
    }
    if (chemin === '/rest/v1/rpc/marquer_notifications_lues') {
      if (!u) return json({ message: 'Connexion requise' }, 401);
      const { p_partie, p_type } = req.postDataJSON() as { p_partie?: string; p_type?: string };
      return json(marquer(n => n.destinataire_id === u.id && (!p_partie || n.partie_id === p_partie) && (!p_type || n.type === p_type)));
    }
    if (chemin === '/rest/v1/rpc/enregistrer_reglages') {
      if (!u || u.anonyme) return json({ code: 'JGC01', message: 'Crée ton compte pour garder tes réglages' }, 400);
      const { p_reglages } = req.postDataJSON() as { p_reglages: unknown };
      const r = fusionner(nettoyer(p_reglages), reglages.get(u.id) ?? {});
      reglages.set(u.id, r);
      return json(r);
    }
    if (chemin === '/rest/v1/rpc/enregistrer_parties_perso') {
      // Comme le serveur : compte avec pseudo, clé unique par joueur, clés rendues (ajoutées ou déjà là).
      if (!u || u.anonyme) return json({ code: 'JGC01', message: 'Crée ton compte' }, 400);
      if (!profiles.find(x => x.id === u.id)?.username) return json({ code: 'JGP01', message: 'Choisis ton pseudo' }, 400);
      const { p_parties } = req.postDataJSON() as { p_parties: Ligne[] };
      for (const l of p_parties) {
        if (!partiesPerso.some(x => x.user_id === u.id && x.cle === l.cle)) partiesPerso.push({ ...l, user_id: u.id });
      }
      return json(p_parties.map(l => l.cle));
    }
    // #364 : partie partagée par lien, comme 20261005213100_parties_partagees.sql (sans plafonds) : compte avec pseudo,
    // SGF minimal (aucun nom, aucun commentaire), même partie = même jeton ; lecture sans compte par le seul jeton.
    if (chemin === '/rest/v1/rpc/partager_partie') {
      if (!u || u.anonyme) return json({ code: 'JGC01', message: 'Crée ton compte' }, 400);
      if (!profiles.find(x => x.id === u.id)?.username) return json({ code: 'JGP01', message: 'Choisis ton pseudo' }, 400);
      const a = req.postDataJSON() as { p_sgf: string; p_taille: number; p_joueur: number | null; p_adversaire: string | null; p_coup: number };
      if (/(PB|PW|C|DT|PC|GC)\[/.test(a.p_sgf) || !a.p_sgf.includes(`SZ[${a.p_taille}]`)) return json({ code: '22023', message: 'Partie illisible' }, 400);
      const deja = partagees.find(x => x.user_id === u.id && x.sgf === a.p_sgf);
      if (deja) { Object.assign(deja, { coup: a.p_coup, joueur: a.p_joueur, adversaire: a.p_adversaire }); return json(deja.jeton); }
      const jeton = `P${String(partagees.length + 1).padStart(3, '0')}`.padEnd(32, 'x');
      partagees.push({ jeton, user_id: u.id, sgf: a.p_sgf, taille: a.p_taille, joueur: a.p_joueur, adversaire: a.p_adversaire, coup: a.p_coup });
      return json(jeton);
    }
    // #449 : étude partagée, comme 20261006134900_etudes_partagees.sql (sans plafonds) : même table, `objet` = `etude`,
    // 9, 13 ou 19 lignes, au moins une pierre ou un coup, sans résultat ; `lire_partage` rend aussi `objet`.
    if (chemin === '/rest/v1/rpc/partager_etude') {
      if (!u || u.anonyme) return json({ code: 'JGC01', message: 'Crée ton compte' }, 400);
      if (!profiles.find(x => x.id === u.id)?.username) return json({ code: 'JGP01', message: 'Choisis ton pseudo' }, 400);
      const a = req.postDataJSON() as { p_sgf: string; p_taille: number; p_coup: number };
      if (/(PB|PW|C|DT|PC|GC|RE)\[/.test(a.p_sgf) || ![9, 13, 19].includes(a.p_taille) || !a.p_sgf.includes(`SZ[${a.p_taille}]`)
        || !/(A[BW]\[[a-s]{2}\]|;[BW]\[)/.test(a.p_sgf)) return json({ code: '22023', message: 'Étude illisible' }, 400);
      const deja = partagees.find(x => x.user_id === u.id && x.sgf === a.p_sgf && x.objet === 'etude');
      if (deja) { deja.coup = a.p_coup; return json(deja.jeton); }
      const jeton = `E${String(partagees.length + 1).padStart(3, '0')}`.padEnd(32, 'x');
      partagees.push({ jeton, user_id: u.id, sgf: a.p_sgf, taille: a.p_taille, joueur: null, adversaire: null, coup: a.p_coup, objet: 'etude' });
      return json(jeton);
    }
    if (chemin === '/rest/v1/rpc/lire_partage') {
      const { p_jeton } = req.postDataJSON() as { p_jeton: string };
      const l = partagees.find(x => x.jeton === p_jeton);
      if (!l) return json([]);
      const pseudo = profiles.find(x => x.id === l.user_id)?.username ?? null;
      return json([{ objet: l.objet ?? 'partie', sgf: l.sgf, taille: l.taille, joueur: l.joueur, adversaire: l.adversaire, coup: l.coup, pseudo, cree_le: new Date().toISOString() }]);
    }
    if (chemin === '/rest/v1/rpc/lire_partie_partagee') {
      const { p_jeton } = req.postDataJSON() as { p_jeton: string };
      const l = partagees.find(x => x.jeton === p_jeton);
      if (!l) return json([]);
      const pseudo = profiles.find(x => x.id === l.user_id)?.username ?? null;
      return json([{ sgf: l.sgf, taille: l.taille, joueur: l.joueur, adversaire: l.adversaire, coup: l.coup, pseudo, cree_le: new Date().toISOString() }]);
    }
    if (chemin === '/rest/v1/rpc/retirer_partie_partagee') {
      if (!u) return json({ code: 'JGC01', message: 'Connexion requise' }, 400);
      const { p_jeton } = req.postDataJSON() as { p_jeton: string };
      const k = partagees.findIndex(x => x.jeton === p_jeton && x.user_id === u.id);
      if (k >= 0) partagees.splice(k, 1);
      return json(k >= 0);
    }
    // #355 : rattachement d'une session sans compte, comme 20261002001100_rattacher_session_anonyme.sql (sans empreinte).
    if (chemin === '/rest/v1/rpc/preparer_rattachement') {
      if (!u?.anonyme) return json({ code: '42501', message: 'Réservé aux sessions sans compte' }, 403);
      const code = `R${u.id.replace(/-/g, '')}`.slice(0, 32).padEnd(32, 'r');
      codesRattachement.set(code, u.id);
      return json(code);
    }
    if (chemin === '/rest/v1/rpc/rattacher_session_anonyme') {
      const { p_code } = req.postDataJSON() as { p_code: string };
      const ancien = codesRattachement.get(p_code);
      if (!u || u.anonyme || !ancien) return json({ code: '22023', message: 'Code invalide' }, 400);
      codesRattachement.delete(p_code);
      let n = 0;
      for (const g of games) for (const k of ['white_id', 'black_id', 'created_by'] as const) if (g[k] === ancien) { g[k] = u.id; n++; }
      for (const d of defis) for (const k of ['createur_id', 'invite_id'] as const) if (d[k] === ancien) d[k] = u.id;
      return json(n);
    }
    if (chemin === '/rest/v1/rpc/choisir_depart_cote') {
      const { p_depart, p_kyu } = req.postDataJSON() as { p_depart: string; p_kyu?: number };
      const moi = profiles.find(x => x.id === u?.id);
      if (!u || u.anonyme || !moi?.username) return json({ code: 'JGC01', message: 'Crée ton compte' }, 400);
      const cote = p_depart === 'decouvre' && p_kyu == null ? 300 : p_depart === 'regles' && p_kyu == null ? 800
        : p_depart === 'club' && Number.isInteger(p_kyu) && p_kyu! >= 0 && p_kyu! <= 25 ? 3000 - 100 * p_kyu! : null;
      if (cote === null) return json({ code: 'JGR02', message: 'Choix de départ invalide' }, 400);
      if (Number(moi.cote_parties ?? 0) > 0) return json({ code: 'JGR01', message: 'Ta cote est déjà lancée' }, 400);
      Object.assign(moi, { rating: cote, cote_rd: 350, cote_provisoire: true, cote_depart: p_depart, cote_depart_kyu: p_depart === 'club' ? p_kyu : null });
      ratingHistory.push({ user_id: u.id, kind: 'depart', rating: cote, rd: 350, ecart: null, game_id: null, created_at: new Date().toISOString() });
      return json(cote);
    }
    if (chemin === '/rest/v1/rpc/find_match') {
      const { p_size, p_cadence = 'normale', p_regles = 'japanese' } = req.postDataJSON() as { p_size: number; p_cadence?: string; p_regles?: string };
      if (!u || u.anonyme) return json({ code: 'JGC01', message: 'Crée ton compte' }, 400);
      if (!profiles.find(x => x.id === u.id)?.username) return json({ code: 'JGP01', message: 'Choisis ton pseudo' }, 400);
      const enCours = directEnCours(u.id);
      if (enCours) { file.splice(0, file.length, ...file.filter(f => f.user !== u.id)); return json(enCours.id); }
      const memes = (f: { taille: number; cadence: string; regles: string }) => f.taille === p_size && f.cadence === p_cadence && f.regles === p_regles;
      const moi = file.find(f => f.user === u.id && memes(f));
      const maintenant = Date.now();
      // #436 : mêmes réglages d'abord ; après 30 s d'attente (la plus longue des deux), les autres réglages aussi.
      const candidats = file.filter(f => f.user !== u.id && !estBloque(u.id, f.user) && (memes(f) || maintenant - Math.min(f.depuis, moi?.depuis ?? maintenant) >= 30_000));
      const autre = candidats.find(memes) ?? candidats.sort((a, b) => a.depuis - b.depuis)[0];
      if (autre) {
        file.splice(0, file.length, ...file.filter(f => f.user !== u.id && f.user !== autre.user));
        // Réglages de qui attendait depuis le plus longtemps.
        const r = moi && moi.depuis < autre.depuis ? moi : autre;
        const id = `33333333-3333-4333-8333-${String(++nDirect).padStart(12, '0')}`;
        games.push({ id, black_id: autre.user, white_id: u.id, created_by: u.id, bot_id: null, size: r.taille, komi: 6.5, rules: r.regles, handicap: 0, moves: '',
          status: 'active', counting: false, dead_stones: null, dead_proposed_by: null, result: null, resumed_at: 0, prive: false, rated: true, updated_at: new Date().toISOString() });
        const [m, n, pm] = CADENCES[r.cadence];
        pendules.push({ partie_id: id, cadence: r.cadence, main_ms: m, periodes: n, periode_ms: pm, noir_ms: m, blanc_ms: m, noir_periodes: n, blanc_periodes: n,
          trait_depuis: new Date().toISOString(), comptage_depuis: null, noir_vu_le: null, blanc_vu_le: new Date().toISOString() });
        return json(id);
      }
      if (!moi) {
        file.splice(0, file.length, ...file.filter(f => f.user !== u.id));
        file.push({ user: u.id, taille: p_size, cadence: p_cadence, regles: p_regles, depuis: maintenant });
      }
      return json(null);
    }
    if (chemin === '/rest/v1/rpc/chercher_partie_lente') {
      const { p_size = 9, p_delai_jours = 1 } = (req.postDataJSON() ?? {}) as { p_size?: number; p_delai_jours?: number };
      if (!u || u.anonyme) return json({ code: 'JGC01', message: 'Crée ton compte' }, 400);
      const moi = profiles.find(x => x.id === u.id);
      if (!moi?.username) return json({ code: 'JGP01', message: 'Choisis ton pseudo' }, 400);
      if (![9, 13, 19].includes(p_size) || ![1, 2, 3].includes(p_delai_jours)) return json({ code: '22023', message: 'Invalide' }, 400);
      const enCours = (id: unknown) => games.filter(g => g.rated && g.status === 'active' && defis.some(d => d.partie_id === g.id) && (g.black_id === id || g.white_id === id)).length;
      if (enCours(u.id) >= 10) return json({ code: 'JGL10', message: 'Tu as déjà 10 parties lentes en cours' }, 400);
      const autre = fileLente.find(f => f.user_id !== u.id && f.partie_id === null && f.size === p_size && f.delai_jours === p_delai_jours && enCours(f.user_id) < 10 && !estBloque(String(u.id), String(f.user_id)));
      fileLente.splice(0, fileLente.length, ...fileLente.filter(f => f.user_id !== u.id));
      if (!autre) {
        fileLente.push({ user_id: u.id, size: p_size, delai_jours: p_delai_jours, rating: moi.rating ?? 800, rd: 350, created_at: new Date(maintenant()).toISOString(), partie_id: null });
        return json(null);
      }
      const id = `44444444-4444-4444-8444-${String(++nLente).padStart(12, '0')}`;
      games.push({ id, black_id: autre.user_id, white_id: u.id, created_by: u.id, bot_id: null, size: p_size, komi: 6.5, rules: 'japanese', handicap: 0, moves: '',
        status: 'active', counting: false, dead_stones: null, dead_proposed_by: null, result: null, resumed_at: 0, prive: true, rated: true, updated_at: new Date().toISOString() });
      defis.push({ partie_id: id, jeton: `lente${nLente}`.padEnd(32, 'L'), createur_id: u.id, invite_id: autre.user_id,
        delai_coup: p_delai_jours === 1 ? '1 day' : `${p_delai_jours} days`, date_limite: new Date(maintenant() + p_delai_jours * 864e5).toISOString(),
        lien_expire_le: new Date().toISOString(), cree_le: new Date().toISOString() });
      autre.partie_id = id;
      notifier(autre.user_id, 'tour', id);
      return json(id);
    }
    if (chemin === '/rest/v1/rpc/quitter_file_lente') {
      if (!u) return json({ code: '42501', message: 'Connexion requise' }, 401);
      const ligne = fileLente.find(f => f.user_id === u.id);
      fileLente.splice(0, fileLente.length, ...fileLente.filter(f => f.user_id !== u.id));
      return json(ligne?.partie_id ?? null);
    }
    if (chemin === '/rest/v1/rpc/victoire_au_temps') {
      const { p_partie } = req.postDataJSON() as { p_partie: string };
      const g = games.find(x => x.id === p_partie);
      if (!u || !g || !defis.some(d => d.partie_id === p_partie) || (g.black_id !== u.id && g.white_id !== u.id)) return json({ code: 'P0002', message: 'Défi introuvable' }, 400);
      constaterDefi(g);
      return json(g.result ?? null);
    }
    if (chemin === '/rest/v1/rpc/quitter_file_attente') {
      if (!u) return json({ code: '42501', message: 'Connexion requise' }, 401);
      file.splice(0, file.length, ...file.filter(f => f.user !== u.id));
      return json(directEnCours(u.id)?.id ?? null);
    }
    if (chemin === '/rest/v1/rpc/refuser_partie_direct') {
      const { p_partie } = req.postDataJSON() as { p_partie: string };
      const g = games.find(x => x.id === p_partie);
      if (!u) return json({ code: '42501', message: 'Connexion requise' }, 401);
      if (!g || !pendules.some(p => p.partie_id === p_partie) || (g.black_id !== u.id && g.white_id !== u.id)) return json({ code: 'P0002', message: 'Partie introuvable' }, 400);
      file.splice(0, file.length, ...file.filter(f => f.user !== u.id));
      if (g.status !== 'active' || String(g.moves).length >= (g.black_id === u.id ? 2 : 4)) return json(false);
      Object.assign(g, { status: 'aborted', counting: false });
      const p = pendules.find(x => x.partie_id === g.id);
      if (p) p.trait_depuis = null;
      pousserPartie(g, { pendule: true });
      return json(true);
    }
    if (chemin === '/rest/v1/rpc/pendule_direct') {
      const { p_partie } = req.postDataJSON() as { p_partie: string };
      const g = games.find(x => x.id === p_partie);
      const p = pendules.find(x => x.partie_id === p_partie);
      if (!u || !g || !p || (g.black_id !== u.id && g.white_id !== u.id)) return json({ code: 'P0002', message: 'Partie introuvable' }, 400);
      if (g.status === 'active') { p[g.black_id === u.id ? 'noir_vu_le' : 'blanc_vu_le'] = new Date().toISOString(); pousserLigne('parties_direct', p); }
      constater(g);
      return json({ statut: g.status, resultat: g.result, coups: g.moves, comptage: g.counting, mortes: g.dead_stones, mortes_par: g.dead_proposed_by,
        ...p, maintenant: new Date().toISOString() });
    }
    if (chemin === '/rest/v1/rpc/resign_game') {
      const { p_game } = req.postDataJSON() as { p_game: string };
      const g = games.find(x => x.id === p_game);
      if (!u || !g || g.status !== 'active' || (g.black_id !== u.id && g.white_id !== u.id)) return json({ message: 'La partie n’est pas en cours' }, 400);
      const resultat = g.black_id === u.id ? 'W+R' : 'B+R';
      finir(g, resultat);
      return json(resultat);
    }
    // Sécurité (#363, #373) : mêmes règles et mêmes codes que la migration.
    if (['/rest/v1/rpc/signaler', '/rest/v1/rpc/bloquer_joueur', '/rest/v1/rpc/debloquer_joueur', '/rest/v1/rpc/mes_blocages', '/rest/v1/rpc/dire_en_partie'].includes(chemin)) {
      const corps = (req.postDataJSON() ?? {}) as Record<string, unknown>;
      if (chemin === '/rest/v1/rpc/dire_en_partie') {
        if (!u) return json({ code: '42501', message: 'Connexion requise' }, 401);
        const codes = ['bonne_partie', 'bien_joue', 'merci', 'joli_coup', 'oups', 'a_la_prochaine', 'mochi_salut', 'mochi_content', 'mochi_fier', 'mochi_pensif'];
        if (!codes.includes(String(corps.p_code))) return json({ code: 'JGM02', message: 'Message inconnu' }, 400);
        const g = games.find(x => x.id === corps.p_partie);
        if (!g || !g.black_id || !g.white_id || g.bot_id || (g.black_id !== u.id && g.white_id !== u.id)) return json({ code: 'P0002', message: 'Partie introuvable' }, 400);
        const miens = messagesPartie.filter(m => m.partie_id === g.id && m.auteur_id === u.id);
        if (miens.length >= 10) return json({ code: 'JGM01', message: '10 messages' }, 400);
        if (miens.some(m => Date.now() - Date.parse(String(m.envoye_le)) < 3000)) return json({ code: 'JGM03', message: 'Trop vite' }, 400);
        const autre = g.black_id === u.id ? g.white_id : g.black_id;
        if (blocages.some(b => b.de === autre && b.a === u.id)) return json(true);
        const m = { id: ++idMessage, partie_id: g.id, auteur_id: u.id, code: corps.p_code, envoye_le: new Date().toISOString() };
        messagesPartie.push(m);
        pousserMessage(m);
        return json(true);
      }
      if (!u || u.anonyme) return json({ code: 'JGC01', message: 'Crée ton compte' }, 400);
      if (!profiles.find(x => x.id === u.id)?.username) return json({ code: 'JGP01', message: 'Choisis ton pseudo' }, 400);
      const parPseudo = (p: unknown) => profiles.find(x => typeof p === 'string' && String(x.username ?? '').toLowerCase() === p.toLowerCase())?.id as string | undefined;
      const parPartie = (id: unknown) => {
        const g = games.find(x => x.id === id);
        if (!g || (g.black_id !== u.id && g.white_id !== u.id) || g.bot_id) return undefined;
        return (g.black_id === u.id ? g.white_id : g.black_id) as string | undefined;
      };
      if (chemin === '/rest/v1/rpc/mes_blocages') {
        return json(blocages.filter(b => b.de === u.id).map(b => ({ pseudo: profiles.find(x => x.id === b.a)?.username, depuis: b.le })));
      }
      if (chemin === '/rest/v1/rpc/debloquer_joueur') {
        const cible = parPseudo(corps.p_pseudo);
        const i = blocages.findIndex(b => b.de === u.id && b.a === cible);
        if (i >= 0) blocages.splice(i, 1);
        return json(i >= 0);
      }
      const visePersonne = chemin === '/rest/v1/rpc/bloquer_joueur' || corps.p_type === 'joueur';
      const cible = !visePersonne ? undefined : corps.p_partie ? parPartie(corps.p_partie) : parPseudo(corps.p_pseudo);
      if (visePersonne && !cible) return json(corps.p_partie ? { code: 'P0002', message: 'Partie introuvable' } : { code: 'JGA01', message: 'Aucun joueur' }, 400);
      if (chemin === '/rest/v1/rpc/bloquer_joueur') {
        if (cible === u.id) return json({ code: 'JGB02', message: 'Toi-même' }, 400);
        if (!blocages.some(b => b.de === u.id && b.a === cible)) blocages.push({ de: u.id, a: cible!, le: new Date().toISOString() });
        amities.splice(0, amities.length, ...amities.filter(f => !((f.de === u.id && f.a === cible) || (f.de === cible && f.a === u.id))));
        return json(true);
      }
      // signaler
      const type = String(corps.p_type);
      if (signalements.filter(x => x.auteur_id === u.id).length >= 10) return json({ code: 'JGS01', message: '10 signalements' }, 400);
      if (!['joueur', 'probleme', 'bug', 'idee', 'autre'].includes(type)) return json({ code: 'JGS02', message: 'Mal formé' }, 400);
      const texte = typeof corps.p_texte === 'string' ? corps.p_texte.trim() : null;
      if (texte && texte.length > 500) return json({ code: 'JGS02', message: 'Trop long' }, 400);
      if (type === 'joueur' && cible === u.id) return json({ code: 'JGS03', message: 'Toi-même' }, 400);
      if (['bug', 'idee', 'autre'].includes(type) && !texte) return json({ code: 'JGS02', message: 'Écris ton message' }, 400);
      signalements.push({ id: signalements.length + 1, auteur_id: u.id, type, cible_joueur_id: type === 'joueur' ? cible : null,
        partie_id: type === 'joueur' ? corps.p_partie ?? null : null, probleme_id: type === 'probleme' ? corps.p_probleme : null,
        motif: corps.p_motif ?? null, texte, version_app: corps.p_version ?? null, contexte: corps.p_contexte ?? null, cree_le: new Date().toISOString() });
      return json(true);
    }
    if (chemin.startsWith('/rest/v1/rpc/')) return json(null);
    if (chemin === '/functions/v1/game-action') {
      const corps = req.postDataJSON() as { action: string; game_id: string; move: string; gameId?: string };
      // Partie en direct (#360) : la même décision que la fonction serveur (planAction), écrite ici.
      if (corps.action !== 'defi_coup' && u) {
        const demande = parseActionRequest(corps);
        const partie = demande && games.find(x => x.id === demande.gameId);
        if (!demande || !partie) return json({ ok: false, error: 'format', message: 'Demande invalide.' }, 400);
        constater(partie);
        const plan = planAction(partie as unknown as GameRow, u.id, demande);
        if (!plan.ok) return json({ ok: false, error: plan.error, message: plan.message }, plan.status);
        if (plan.kind === 'finish') { finir(partie, plan.result); Object.assign(partie, { score_black: plan.black, score_white: plan.white }); return json({ ok: true, result: plan.result, black: plan.black, white: plan.white }); }
        const avant = String(partie.moves);
        const reprise = partie.counting && plan.patch.counting === false;
        Object.assign(partie, plan.patch);
        if (plan.patch.moves !== undefined) decompter(partie, avant);
        else if (reprise) { const p = pendules.find(x => x.partie_id === partie.id); if (p) p.trait_depuis = new Date().toISOString(); }
        pousserPartie(partie, { pendule: true, defi: true });
        return json({ ok: true, game: partie });
      }
      const { action, game_id, move } = corps;
      const g = games.find(x => x.id === game_id);
      if (action !== 'defi_coup' || !g || !u) return json({ error: 'format' }, 400);
      if (u.anonyme) return json({ error: 'connexion' }, 401);
      // #440 : délai dépassé : la perte au temps est enregistrée, le coup refusé (comme jouer_coup_defi).
      if (constaterDefi(g)) return json({ ok: false, error: 'temps', message: 'Temps écoulé : la partie est finie.' }, 409);
      if (g.status !== 'active') return json({ ok: false, error: 'terminee' }, 409);
      const trait = (g.moves as string).length / 2 % 2 === 0 ? g.black_id : g.white_id;
      if (trait !== u.id) return json({ error: 'tour' }, 409);
      const deuxPasses = move === 'tt' && String(g.moves).endsWith('tt') && String(g.moves).length % 2 === 0;
      g.moves = (g.moves as string) + move;
      if (deuxPasses) Object.assign(g, { counting: true, dead_stones: null, dead_proposed_by: null });
      const dDefi = defis.find(d => d.partie_id === game_id) ?? defis[0];
      dDefi.date_limite = new Date(maintenant() + delaiMs(dDefi)).toISOString();
      // Déclencheur `notifier_partie` : ce qui attendait est dépassé, l'adversaire est prévenu.
      marquer(n => n.partie_id === g.id && (n.type === 'tour' || n.type === 'comptage'));
      notifier(u.id === g.black_id ? g.white_id : g.black_id, 'tour', String(g.id));
      pousserPartie(g, { defi: true });
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
      let lignes: Ligne[] = table === 'games' ? games : table === 'defis' ? defis : table === 'profiles' ? profiles : table === 'file_lente' ? fileLente
        : table === 'notifications' ? notifications : table === 'parties_perso' ? partiesPerso : table === 'rating_history' ? ratingHistory : [];
      for (const [cle, val] of url.searchParams) {
        if (val.startsWith('eq.')) lignes = lignes.filter(l => String(l[cle]) === val.slice(3));
        if (val.startsWith('neq.')) lignes = lignes.filter(l => String(l[cle]) !== val.slice(4));
        if (val === 'is.null') lignes = lignes.filter(l => l[cle] === null || l[cle] === undefined);
        if (val.startsWith('ilike.')) { const motif = val.slice(6).replace(/\\(.)/g, '$1').toLowerCase(); lignes = lignes.filter(l => String(l[cle] ?? '').toLowerCase() === motif); }
        if (val.startsWith('gte.')) lignes = lignes.filter(l => String(l[cle]) >= val.slice(4));
        if (val.startsWith('in.(')) { const ids = val.slice(4, -1).split(','); lignes = lignes.filter(l => ids.includes(String(l[cle]))); }
        if (cle === 'or') { const ids = [...val.matchAll(/eq\.([^,)]+)/g)].map(m => m[1]); lignes = lignes.filter(l => ids.includes(String(l.createur_id)) || ids.includes(String(l.invite_id))); }
      }
      // RLS simulée : profils visibles par tous ; parties et défis par leurs seuls joueurs ; notifications par leur destinataire.
      if (table === 'parties_perso') lignes = lignes.filter(l => !!u && !u.anonyme && l.user_id === u.id)
        .sort((a, b) => Date.parse(String(b.joue_le)) - Date.parse(String(a.joue_le)));
      else if (table === 'rating_history' || table === 'file_lente') lignes = lignes.filter(l => !!u && l.user_id === u.id);
      else if (table !== 'profiles') lignes = lignes.filter(l => !u ? false : [l.black_id, l.white_id, l.createur_id, l.invite_id, l.destinataire_id].includes(u.id));
      if (req.method() !== 'GET') return json(table === 'lesson_progress' ? [] : {});
      const objet = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object');
      return json(objet ? lignes[0] ?? null : lignes);
    }
    return json({});
  }
  /** Compte déjà créé (avec son pseudo), pour se connecter avec son adresse (#353). */
  function compteExistant(email: string, pseudo: string | null, id = '00000000-0000-4000-8000-0000000000ee') {
    const v: Utilisateur = { id, anonyme: false, email, identites: [identite('email', email)] };
    parEmail.set(email, v);
    profiles.push({ id, username: pseudo, rating: 1500, streak_days: 0, streak_last: null, streak_freezes: 0 });
    return v;
  }
  /** Compte Google que « Continuer avec Google » renverra (#354) ; `annule` : le joueur annule chez Google. */
  function compteGoogle(c: CompteSocial) { sociaux.set('google', c); }
  /** Compte que renverra Google, Apple ou Facebook (#411). */
  function compteSocial(provider: 'google' | 'apple' | 'facebook', c: CompteSocial) { sociaux.set(provider, c); }
  /** Identité déjà reliée à un compte du jeu (pour « déjà relié à un autre compte », #411). */
  function relierIdentite(provider: string, email: string, v: Utilisateur) {
    v.identites = [...(v.identites ?? []), identite(provider, email)];
    parIdentite.set(`${provider}:${email}`, v);
  }
  /** « Manual linking » de Supabase ouvert ou fermé (#411). */
  function liaison(ouverte: boolean) { liaisonManuelle = ouverte; }
  /** Compte du jeu par son identifiant (vérifications des tests). */
  const utilisateur = (id: string) => [...jetons.values(), ...parEmail.values()].find(x => x.id === id);
  /** Session ouverte d'un compte complet (avec pseudo), à poser dans le stockage du navigateur (#367). */
  function sessionCompte(email: string, pseudo: string, id: string) { return session(compteExistant(email, pseudo, id)); }
  /** Relectures retardées de `ms` (#425) ; 0 : sans retard. */
  function ralentirLectures(ms: number) { lenteur = ms; }
  /** Connexions temps réel ouvertes à cet instant figées (#425) : un iPhone qui sort de veille. */
  function figerTempsReel() { for (const a of abonnes) a.fige = true; }
  /** Canaux rejoints sur une connexion qui marche, dont le sujet commence par `prefixe` (`defi-`, `direct-`). */
  const canauxActifs = (prefixe: string) => [...abonnes].filter(a => !a.fige).flatMap(a => [...a.canaux.keys()]).filter(t => t.startsWith(`realtime:${prefixe}`)).length;
  return { traiter, brancherTempsReel, notifier, fileLente, tacheLentes, avancerHorloge, ralentirLectures, figerTempsReel, canauxActifs, pousses, pousserPartie, appels, games, defis, notifications, partiesPerso, partagees, profiles, ratingHistory, emailsEnvoyes, sessionAnonyme, file, pendules,
    compteExistant, compteGoogle, compteSocial, relierIdentite, liaison, utilisateur, sessionCompte, autorisations, amities,
    signalements, blocages, messagesPartie, goDuJour, rappels, reglages };
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
