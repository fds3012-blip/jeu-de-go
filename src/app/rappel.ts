// Rappel quotidien du Go du jour par notification web (issue #36).
// - Réservé aux joueurs avec un compte (#343) : l'abonnement est gardé sur le serveur, lié au compte.
// - Proposé une seule fois, à la fin de la première partie terminée avec un compte ; « Non merci » est définitif.
//   Le Profil garde toujours le réglage (allumer, couper, changer le moment).
// - Trois moments simples : matin (9 h), midi (12 h), soir (18 h), à l'heure du joueur. Jamais la nuit, un par jour au plus,
//   et rien un jour où il a déjà réussi un problème (règles appliquées par le serveur : reclamer_rappels).
// - iPhone et iPad : notifications web seulement dans l'app installée sur l'écran d'accueil (iOS 16.4 et plus). Dans Safari,
//   on l'explique et on mène à « Installer l'app ».
// - Toucher la notification ouvre le Go du jour (`/?rappel=1`, public/sw.js) et envoie `rappel_ouvert`.
// - #699 : deuxième réglage indépendant, « À toi de jouer » (parties lentes classées). Même appareil, même abonnement,
//   deux interrupteurs côté serveur (`jour`, `tour`). Éteint par défaut ; allumé seulement par le joueur, dans le Profil
//   (la permission du navigateur est demandée à ce geste). Toucher la notification ouvre la partie (`/?tour=<id>`).
import type { Db } from '../data/supabase';
import { detecterPlateforme, type Plateforme } from './installation';
import { t } from '../content/i18n/secondaires';
// #563 : état local du rappel et arrivée par la notification dans rappelEtat.ts (JS initial), réexportés ici.
import { RAPPEL_KEY, etatRappel, type EtatRappel, type MomentRappel } from './rappelEtat';
export { ETAT_INITIAL, HEURES, MOMENTS, RAPPEL_KEY, estArriveeRappel, etatRappel, lireEtatRappel, partieDeNotification, type EtatRappel, type MomentRappel } from './rappelEtat';

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

// ---------- Navigateur ----------

function lire(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
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

/**
 * Abonne l'appareil (ou met à jour ses réglages) et l'inscrit sur le serveur, pour le compte connecté.
 * `jour` et `tour` : nouvelle valeur de l'interrupteur, ou null pour garder celle du serveur (envoyé tel quel : un argument
 * absent voudrait dire « allumé » pour p_jour ; les types générés ne connaissent pas null, d'où les conversions).
 */
async function inscrire(db: Db, moment: MomentRappel, langue: string, jour: boolean | null, tour: boolean | null): Promise<Resultat> {
  const reg = await enregistrement();
  if (!reg) return 'erreur';
  const sub = (await reg.pushManager.getSubscription())
    ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: octetsBase64Url(clePubliqueVapid()) as BufferSource }));
  const j = sub.toJSON();
  if (!j.endpoint || !j.keys?.p256dh || !j.keys?.auth) return 'erreur';
  const { error } = await db.rpc('enregistrer_abonnement_rappel', {
    p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_moment: moment, p_fuseau: fuseauAppareil(), p_langue: langue,
    p_jour: jour as boolean, p_tour: tour as boolean,
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
    const r = await inscrire(db, moment, langue, true, null);
    if (r === 'ok') noterRappel({ actif: true, moment });
    return r;
  } catch {
    return 'erreur';
  }
}

/** Change le moment d'un rappel déjà allumé. */
export async function changerMoment(db: Db, moment: MomentRappel, langue: string): Promise<Resultat> {
  try {
    const r = await inscrire(db, moment, langue, true, null);
    if (r === 'ok') noterRappel({ moment });
    return r;
  } catch {
    return 'erreur';
  }
}

/**
 * Éteint l'un des deux interrupteurs de cet appareil. Si l'autre est éteint aussi, l'abonnement est retiré du serveur et
 * du navigateur ; sinon il reste, avec l'autre interrupteur seul. Désinscription en un geste, sans autre confirmation.
 */
async function eteindre(db: Db | null, quoi: 'jour' | 'tour', langue: string): Promise<Resultat> {
  const reste = quoi === 'jour' ? etatRappel().tours : etatRappel().actif;
  noterRappel(quoi === 'jour' ? { actif: false } : { tours: false });
  try {
    const reg = await enregistrement();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return 'ok';
    if (reste && db) {
      const cles = sub.toJSON().keys;
      const { error } = await db.rpc('enregistrer_abonnement_rappel', {
        p_endpoint: sub.endpoint, p_p256dh: cles?.p256dh ?? '', p_auth: cles?.auth ?? '', p_moment: etatRappel().moment,
        p_fuseau: fuseauAppareil(), p_langue: langue, p_jour: (quoi === 'jour' ? false : null) as boolean, p_tour: (quoi === 'tour' ? false : null) as boolean,
      });
      // Le serveur n'avait pas l'autre interrupteur allumé (états écartés) : la ligne est retirée, rien ne doit continuer à partir.
      if (!error) return 'ok';
      noterRappel({ actif: false, tours: false }); // l'abonnement entier part : l'autre réglage aussi
    }
    const { error } = db ? await db.from('abonnements_rappel').delete().eq('endpoint', sub.endpoint) : { error: null };
    await sub.unsubscribe();
    return error ? 'erreur' : 'ok';
  } catch {
    return 'erreur';
  }
}

/** Coupe le rappel du Go du jour (l'abonnement part avec lui s'il n'y a plus rien d'autre à envoyer). */
export const couperRappel = (db: Db | null, langue = 'fr'): Promise<Resultat> => eteindre(db, 'jour', langue);

/** #699 : allume « À toi de jouer ». Comme `activerRappel` : à la suite d'un geste, permission du navigateur demandée ici. */
export async function activerTours(db: Db, moment: MomentRappel, langue: string): Promise<Resultat> {
  try {
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (permission !== 'granted') return 'refuse_navigateur';
    const r = await inscrire(db, moment, langue, null, true);
    if (r === 'ok') noterRappel({ tours: true });
    return r;
  } catch {
    return 'erreur';
  }
}

/** #699 : coupe « À toi de jouer ». */
export const couperTours = (db: Db | null, langue = 'fr'): Promise<Resultat> => eteindre(db, 'tour', langue);

/** Valeur de la ligne du Profil : le moment du rappel, « À toi de jouer », les deux, ou « Coupé ». */
export function resumeRappel(): string {
  const e = etatRappel();
  return e.actif && e.tours ? t('profil.rappelDeux') : e.actif ? t(`rappel.${e.moment}`) : e.tours ? t('rappel.tour.court') : t('profil.rappelCoupe');
}
