// Adresses nettoyées avant tout envoi à PostHog ou Sentry (écart E14 de la politique de confidentialité).
//
// Pourquoi : l'adresse de la page peut porter des secrets.
// - Fragment `#` : jetons de session Supabase au retour du lien de connexion par e-mail
//   (`#access_token=…&refresh_token=…`), erreurs d'authentification (`#error_description=…`),
//   jeton du défi par lien (`/defi#<jeton>`, src/data/defi.ts). supabase-js n'efface le fragment
//   qu'après avoir validé le jeton auprès du serveur, et jamais en cas d'erreur.
// - Paramètres de requête : `?code=` (flux PKCE, OAuth), `?token_hash=&type=` (confirmation d'e-mail),
//   et bientôt le code d'un défi ou d'une invitation.
//
// Règle : le fragment est toujours retiré en entier (l'app n'a pas de routes par `#`), et les paramètres
// de PARAMS_SENSIBLES sont retirés de la requête. Une adresse sans rien de sensible reste identique,
// caractère pour caractère (pas de normalisation par `new URL`).

/**
 * Paramètres de requête retirés (comparaison sans tenir compte de la casse).
 * - Jetons de session et d'identité : access_token, refresh_token, provider_token, provider_refresh_token,
 *   id_token, expires_at, expires_in, token_type.
 * - Échanges d'authentification : code (PKCE/OAuth), sb_flow_id (identifiant de flux PKCE de supabase-js),
 *   state (OAuth), token, token_hash, type (magiclink, signup, recovery, email_change…), otp.
 * - Erreurs d'authentification (peuvent citer l'adresse e-mail) : error, error_code, error_description.
 * - Données personnelles : email.
 * - Défis et invitations (écrans à venir) : defi, invite, invitation, jeton.
 * - apikey : clé publique Supabase (URL du temps réel) ; publique, mais inutile dans les rapports.
 */
export const PARAMS_SENSIBLES: readonly string[] = [
  'access_token', 'refresh_token', 'provider_token', 'provider_refresh_token', 'id_token',
  'expires_at', 'expires_in', 'token_type',
  'code', 'sb_flow_id', 'state', 'token', 'token_hash', 'type', 'otp',
  'error', 'error_code', 'error_description',
  'email',
  'defi', 'invite', 'invitation', 'jeton',
  'apikey',
];
const SENSIBLES = new Set(PARAMS_SENSIBLES.map(p => p.toLowerCase()));

function cleSensible(paire: string): boolean {
  const brute = paire.split('=')[0];
  let cle = brute;
  try { cle = decodeURIComponent(brute.replace(/\+/g, ' ')); } catch { /* clé mal encodée : lue telle quelle */ }
  return SENSIBLES.has(cle.trim().toLowerCase());
}

/**
 * Retire le fragment et les paramètres sensibles d'une adresse (absolue ou relative, ex. `$pathname`,
 * breadcrumbs de navigation Sentry). Toute autre valeur est rendue telle quelle.
 */
export function nettoyerUrl(url: string): string {
  const diese = url.indexOf('#');
  const sansFragment = diese >= 0 ? url.slice(0, diese) : url;
  const q = sansFragment.indexOf('?');
  if (q < 0) return sansFragment;
  const base = sansFragment.slice(0, q);
  const paires = sansFragment.slice(q + 1).split('&');
  const gardees = paires.filter(p => p !== '' && !cleSensible(p));
  if (gardees.length === paires.length) return sansFragment;
  return gardees.length ? `${base}?${gardees.join('&')}` : base;
}

const URL_DANS_TEXTE = /\b(?:https?|wss?):\/\/[^\s"'<>`]+/gi;
const PAIRE_DANS_TEXTE = /([?&#;,\s]|^)([A-Za-z_]+)=([^&#\s"'<>`]*)/g;

/**
 * Pour un texte libre (message d'erreur, breadcrumb de console) : chaque adresse est nettoyée, et toute paire
 * `clé=valeur` sensible restante (fragment déjà découpé, chemin relatif) voit sa valeur masquée.
 */
export function nettoyerTexte(texte: string): string {
  return texte
    .replace(URL_DANS_TEXTE, u => nettoyerUrl(u))
    .replace(PAIRE_DANS_TEXTE, (tout, avant: string, cle: string) =>
      SENSIBLES.has(cle.toLowerCase()) ? `${avant}${cle}=[filtré]` : tout);
}

/** Clés de propriétés qui portent une adresse (PostHog : `$current_url`, `$referrer`, `$pathname`, `$initial_*`, `$session_entry_*`…). */
const CLE_ADRESSE = /url|referrer|pathname|href/i;
const ADRESSE_ABSOLUE = /^(?:https?|wss?):\/\//i;

/**
 * Nettoie un objet de propriétés en profondeur (6 niveaux, garde-fou contre les cycles) : les valeurs sous une clé d'adresse, et toute
 * valeur qui ressemble à une adresse absolue (ex. `$initial_person_info.u`). Renvoie un nouvel objet.
 */
export function nettoyerProprietes<T>(valeur: T, cle = '', profondeur = 0): T {
  if (typeof valeur === 'string') {
    return (CLE_ADRESSE.test(cle) || ADRESSE_ABSOLUE.test(valeur) ? nettoyerUrl(valeur) : valeur) as T;
  }
  if (profondeur >= 6 || valeur === null || typeof valeur !== 'object') return valeur;
  if (Array.isArray(valeur)) return valeur.map(v => nettoyerProprietes(v, cle, profondeur + 1)) as T;
  const proto = Object.getPrototypeOf(valeur);
  if (proto !== Object.prototype && proto !== null) return valeur;
  const sortie: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(valeur as Record<string, unknown>)) sortie[k] = nettoyerProprietes(v, k, profondeur + 1);
  return sortie as T;
}

/** Événement PostHog tel que reçu par `before_send`. */
export interface EvenementPostHog {
  event?: string;
  properties?: Record<string, unknown>;
  $set?: Record<string, unknown>;
  $set_once?: Record<string, unknown>;
}

/** `before_send` PostHog : nettoie propriétés, `$set` et `$set_once` (où vivent les `$initial_*`). */
export function posthogSansUrlSensible<E extends EvenementPostHog | null>(ev: E): E {
  if (!ev) return ev;
  if (ev.properties) ev.properties = nettoyerProprietes(ev.properties);
  if (ev.$set) ev.$set = nettoyerProprietes(ev.$set);
  if (ev.$set_once) ev.$set_once = nettoyerProprietes(ev.$set_once);
  return ev;
}

/** Sous-ensemble de l'événement Sentry que l'on nettoie. */
export interface EvenementSentry {
  message?: string;
  request?: { url?: string; query_string?: unknown; headers?: Record<string, string>; [k: string]: unknown };
  exception?: { values?: { value?: string }[] };
  breadcrumbs?: BreadcrumbSentry[];
  transaction?: string;
  tags?: Record<string, unknown>;
  extra?: Record<string, unknown>;
  user?: { id?: unknown; [k: string]: unknown };
}
export interface BreadcrumbSentry {
  category?: string;
  message?: string;
  data?: Record<string, unknown>;
}

/**
 * `beforeBreadcrumb` Sentry : navigation (`data.from`, `data.to`), fetch et xhr (`data.url`), et tout texte.
 */
export function sentryBreadcrumbSansUrlSensible<B extends BreadcrumbSentry | null>(b: B): B {
  if (!b) return b;
  if (typeof b.message === 'string') b.message = nettoyerTexte(b.message);
  if (b.data) {
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(b.data)) {
      if (typeof v === 'string') data[k] = k === 'from' || k === 'to' || CLE_ADRESSE.test(k) ? nettoyerUrl(v) : nettoyerTexte(v);
      else data[k] = nettoyerProprietes(v, k);
    }
    b.data = data;
  }
  return b;
}

/**
 * `beforeSend` Sentry : `request.url` (adresse de la page), `query_string` et cookies (retirés), en-tête Referer,
 * utilisateur réduit à son identifiant (#474),
 * messages d'erreur, et breadcrumbs déjà attachés (filet si `beforeBreadcrumb` n'a pas vu passer l'un d'eux).
 */
export function sentrySansUrlSensible<E extends EvenementSentry | null>(ev: E): E {
  if (!ev) return ev;
  if (ev.request) {
    if (typeof ev.request.url === 'string') ev.request.url = nettoyerUrl(ev.request.url);
    delete ev.request.query_string;
    delete ev.request.cookies;
    const h = ev.request.headers;
    if (h) for (const k of Object.keys(h)) if (/^referr?er$/i.test(k)) h[k] = nettoyerUrl(h[k]);
  }
  if (typeof ev.message === 'string') ev.message = nettoyerTexte(ev.message);
  if (typeof ev.transaction === 'string') ev.transaction = nettoyerUrl(ev.transaction);
  for (const x of ev.exception?.values ?? []) if (typeof x.value === 'string') x.value = nettoyerTexte(x.value);
  if (ev.breadcrumbs) ev.breadcrumbs = ev.breadcrumbs.map(b => sentryBreadcrumbSansUrlSensible(b));
  if (ev.tags) ev.tags = nettoyerProprietes(ev.tags);
  if (ev.extra) ev.extra = nettoyerProprietes(ev.extra);
  // #474 : du joueur, seul l'identifiant de compte (pseudonyme, avec accord) part. Ni IP, ni e-mail, ni pseudo, ni lieu.
  if (ev.user) {
    if (typeof ev.user.id === 'string' && ev.user.id) ev.user = { id: ev.user.id };
    else delete ev.user;
  }
  return ev;
}
