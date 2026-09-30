// Rappel quotidien du Go du jour par notification web (issue #36).
// - Réservé aux joueurs avec un compte (#343) : l'abonnement est gardé sur le serveur, lié au compte.
// - Proposé une seule fois, à la fin de la première partie terminée avec un compte ; « Non merci » est définitif.
//   Le Profil garde toujours le réglage (allumer, couper, changer le moment).
// - Trois moments simples : matin (9 h), midi (12 h), soir (18 h), à l'heure du joueur. Jamais la nuit, un par jour au plus,
//   et rien un jour où il a déjà réussi un problème (règles appliquées par le serveur : reclamer_rappels).
// - iPhone et iPad : notifications web seulement dans l'app installée sur l'écran d'accueil (iOS 16.4 et plus). Dans Safari,
//   on l'explique et on mène à « Installer l'app ».
// - Toucher la notification ouvre le Go du jour (`/?rappel=1`, public/sw.js) et envoie `rappel_ouvert`.
import type { Db } from '../data/supabase';
import { detecterPlateforme, type Plateforme } from './installation';
import { t } from '../content/i18n';

/** Choix du joueur sur cet appareil. Préférence d'interface ; l'abonnement lui-même est sur le serveur. */
export const RAPPEL_KEY = 'go.rappel.v1';

export type MomentRappel = 'matin' | 'midi' | 'soir';
export const MOMENTS: readonly MomentRappel[] = ['matin', 'midi', 'soir'];
/** Heure locale de chaque moment : la même que `heure_rappel` dans la migration abonnements_rappel. */
export const HEURES: Record<MomentRappel, number> = { matin: 9, midi: 12, soir: 18 };

export interface EtatRappel {
  /** La proposition de fin de partie : jamais montrée (null), montrée, refusée (définitif) ou acceptée. */
  proposition: 'proposee' | 'refusee' | 'acceptee' | null;
  /** Rappel allumé sur cet appareil. */
  actif: boolean;
  moment: MomentRappel;
}
export const ETAT_INITIAL: EtatRappel = { proposition: null, actif: false, moment: 'soir' };

/** Relit l'état en tolérant les valeurs abîmées. */
export function lireEtatRappel(brut: unknown): EtatRappel {
  if (typeof brut !== 'object' || brut === null) return ETAT_INITIAL;
  const b = brut as Partial<EtatRappel>;
  return {
    proposition: b.proposition === 'proposee' || b.proposition === 'refusee' || b.proposition === 'acceptee' ? b.proposition : null,
    actif: b.actif === true,
    moment: MOMENTS.includes(b.moment as MomentRappel) ? (b.moment as MomentRappel) : 'soir',
  };
}

/**
 * Ce que l'appareil permet :
 * `ok` ; `ios_installer` (Safari sur iPhone ou iPad : installer l'app d'abord) ; `bloque` (notifications refusées dans le
 * navigateur) ; `non` (navigateur sans notification web, ou rappel pas encore configuré : pas de clé publique VAPID).
 */
export type Support = 'ok' | 'ios_installer' | 'bloque' | 'non';

export interface Capacites {
  cleVapid: boolean;
  plateforme: Plateforme;
  notification: boolean;
  push: boolean;
  serviceWorker: boolean;
  permission: 'default' | 'granted' | 'denied' | null;
}

export function support(c: Capacites): Support {
  if (!c.cleVapid) return 'non';
  if (c.plateforme === 'ios') return 'ios_installer';
  if (!c.notification || !c.push || !c.serviceWorker) return 'non';
  return c.permission === 'denied' ? 'bloque' : 'ok';
}

/**
 * Montrer la proposition à la fin d'une partie ? Une seule fois, avec un compte, sur un appareil qui peut recevoir le
 * rappel, jamais sur l'écran où la carte d'installation est déjà montrée (un seul appel secondaire, #236).
 */
export function doitProposerRappel(c: { compte: boolean; support: Support; etat: EtatRappel; partieFinie: boolean; autreCarte: boolean }): boolean {
  return c.compte && c.partieFinie && !c.autreCarte && c.support === 'ok' && c.etat.proposition === null && !c.etat.actif;
}

/** Clé publique VAPID (base64url) en octets, pour `pushManager.subscribe`. */
export function octetsBase64Url(b64: string): Uint8Array {
  const propre = b64.trim().replace(/-/g, '+').replace(/_/g, '/');
  const brut = atob(propre + '='.repeat((4 - (propre.length % 4)) % 4));
  return Uint8Array.from(brut, c => c.charCodeAt(0));
}

/** Fuseau de l'appareil (IANA), pour envoyer le rappel à son heure ; Paris à défaut. */
export function fuseauAppareil(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris'; } catch { return 'Europe/Paris'; }
}

/** L'adresse vient d'un rappel touché (`?rappel=1`) : lu une fois au chargement. */
export const estArriveeRappel = (search: string): boolean => new URLSearchParams(search).get('rappel') === '1';

// ---------- Navigateur ----------

function lire(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
}

export function etatRappel(): EtatRappel {
  try { return lireEtatRappel(JSON.parse(lire(RAPPEL_KEY) ?? 'null')); } catch { return ETAT_INITIAL; }
}
export function noterRappel(patch: Partial<EtatRappel>): EtatRappel {
  const e = { ...etatRappel(), ...patch };
  try { localStorage.setItem(RAPPEL_KEY, JSON.stringify(e)); } catch { /* stockage indisponible : sans conséquence grave */ }
  return e;
}

/**
 * Clé publique VAPID de l'app (`VITE_VAPID_PUBLIC_KEY`, publique par nature). Sans elle, le rappel n'existe pas encore :
 * ni proposition, ni ligne dans le Profil. Build de test seulement : une clé posée par le test (`e2e.vapid`).
 */
export function clePubliqueVapid(): string {
  const env = (import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '').trim();
  if (env || !import.meta.env.VITE_E2E) return env;
  return (lire('e2e.vapid') ?? '').trim();
}

export function capacitesCourantes(): Capacites {
  const ok = typeof window !== 'undefined' && typeof navigator !== 'undefined';
  const nav = ok ? (navigator as Navigator & { standalone?: boolean }) : null;
  const plateforme: Plateforme = nav ? detecterPlateforme({
    userAgent: nav.userAgent, platform: nav.platform, maxTouchPoints: nav.maxTouchPoints, standalone: nav.standalone,
    affichageApp: !!window.matchMedia?.('(display-mode: standalone)').matches, invite: false,
  }) : 'aucune';
  const notification = ok && 'Notification' in window;
  return {
    cleVapid: clePubliqueVapid() !== '',
    // Chrome sans invite d'installation se déclare `aucune` : sans importance ici, seul `ios` compte.
    plateforme,
    notification,
    push: ok && 'PushManager' in window,
    serviceWorker: !!nav && 'serviceWorker' in nav,
    permission: notification ? Notification.permission : null,
  };
}

export const supportCourant = (): Support => support(capacitesCourantes());

/** Attend le service worker actif, sans bloquer si aucun n'est enregistré (développement). */
async function enregistrement(): Promise<ServiceWorkerRegistration | null> {
  const delai = new Promise<null>(r => setTimeout(() => r(null), 10_000));
  return Promise.race([navigator.serviceWorker.ready, delai]);
}

export type Resultat = 'ok' | 'refuse_navigateur' | 'erreur';

/** Abonne l'appareil (ou met à jour son moment) et l'inscrit sur le serveur, pour le compte connecté. */
async function inscrire(db: Db, moment: MomentRappel, langue: string): Promise<Resultat> {
  const reg = await enregistrement();
  if (!reg) return 'erreur';
  const sub = (await reg.pushManager.getSubscription())
    ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: octetsBase64Url(clePubliqueVapid()) as BufferSource }));
  const j = sub.toJSON();
  if (!j.endpoint || !j.keys?.p256dh || !j.keys?.auth) return 'erreur';
  const { error } = await db.rpc('enregistrer_abonnement_rappel', {
    p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_moment: moment, p_fuseau: fuseauAppareil(), p_langue: langue,
  });
  return error ? 'erreur' : 'ok';
}

/**
 * Allume le rappel. Doit suivre un geste du joueur (Safari l'exige pour demander la permission).
 * Refus du navigateur : `refuse_navigateur`.
 */
export async function activerRappel(db: Db, moment: MomentRappel, langue: string): Promise<Resultat> {
  try {
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (permission !== 'granted') return 'refuse_navigateur';
    const r = await inscrire(db, moment, langue);
    if (r === 'ok') noterRappel({ actif: true, moment });
    return r;
  } catch {
    return 'erreur';
  }
}

/** Change le moment d'un rappel déjà allumé. */
export async function changerMoment(db: Db, moment: MomentRappel, langue: string): Promise<Resultat> {
  try {
    const r = await inscrire(db, moment, langue);
    if (r === 'ok') noterRappel({ moment });
    return r;
  } catch {
    return 'erreur';
  }
}

/** Coupe le rappel : l'abonnement est retiré du serveur et du navigateur. */
export async function couperRappel(db: Db | null): Promise<Resultat> {
  noterRappel({ actif: false });
  try {
    const reg = await enregistrement();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return 'ok';
    const { error } = db ? await db.from('abonnements_rappel').delete().eq('endpoint', sub.endpoint) : { error: null };
    await sub.unsubscribe();
    return error ? 'erreur' : 'ok';
  } catch {
    return 'erreur';
  }
}

/** Valeur de la ligne du Profil : le moment choisi, ou « Coupé ». */
export function resumeRappel(): string {
  const e = etatRappel();
  return e.actif ? t(`rappel.${e.moment}`) : t('profil.rappelCoupe');
}
