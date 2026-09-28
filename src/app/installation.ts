// Proposer d'installer l'app (PWA) au bon moment (issue #178, suite de #162).
// Une seule fois, refus mémorisé, jamais pendant une partie. Déjà installée : rien.
// #214 : plus au-dessus du plateau résolu du Go du jour. La carte vient sur l'accueil au 2e retour (3e jour
// d'ouverture, ou le suivant si l'installation n'était pas encore possible), ou après la première victoire contre l'ordi.
// Le Profil garde une ligne permanente « Installer l'app » tant qu'elle est installable et pas installée.
// - Chrome (Android, ordinateur) : l'invite `beforeinstallprompt` est capturée au chargement, puis `prompt()` sur « Installer ».
// - iPhone et iPad, Safari : pas d'invite possible ; une carte montre « Partager », puis « Sur l'écran d'accueil ».
// Condition, plus tard, d'un rappel quotidien sur iPhone (les notifications web n'y existent que pour une app installée).

/** Ce qui a été fait de la proposition. Absent : jamais proposée. Préférence d'interface, sans lien avec la mesure. */
export const INSTALLATION_KEY = 'go.installation.v1';
/** Repère posé à la première victoire contre l'ordi (sur cet appareil). */
export const PREMIERE_VICTOIRE_KEY = 'go.premiere-victoire.v1';

export type EtatInstallation = 'proposee' | 'refusee' | 'acceptee';
/** `chrome` : invite capturée (Android ou ordinateur) ; `ios` : Safari sur iPhone ou iPad ; `aucune` : rien à proposer. */
export type Plateforme = 'installee' | 'chrome' | 'ios' | 'aucune';
/**
 * `go_du_jour` : ancien moment (#178), ignoré depuis #214 (la carte couvrait le plateau résolu).
 * `retour` : accueil d'un retour ; `profil` : demandée par le joueur depuis le Profil.
 */
export type Moment = 'premiere_victoire' | 'go_du_jour' | 'retour' | 'profil';

/** Jours d'ouverture de l'app sur cet appareil (#214) : dernier jour vu, et nombre de retours (jours distincts après le premier). */
export const RETOURS_KEY = 'go.retours.v1';
export interface Retours { jour: number; retours: number }
/** La carte se propose sur l'accueil à partir de ce retour (le 2e : le joueur revient, il n'est plus de passage). */
export const RETOUR_PROPOSITION = 2;

export interface Appareil {
  userAgent: string;
  /** `navigator.platform` : les iPad récents se déclarent « MacIntel ». */
  platform?: string;
  maxTouchPoints?: number;
  /** `navigator.standalone` (Safari iOS) : vrai si l'app a été lancée depuis l'écran d'accueil. */
  standalone?: boolean;
  /** `(display-mode: standalone)` : vrai dans l'app installée (Chrome, Safari récent). */
  affichageApp: boolean;
  /** Une invite `beforeinstallprompt` a été capturée. */
  invite: boolean;
}

// Navigateurs iOS autres que Safari, et navigateurs intégrés (Instagram, Facebook…) : la consigne ne s'y applique pas.
const IOS_AUTRE_NAVIGATEUR = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|GSA\/|FBAN|FBAV|Instagram|Line\/|Snapchat|TikTok|musical_ly/i;

export function detecterPlateforme(a: Appareil): Plateforme {
  if (a.standalone === true || a.affichageApp) return 'installee';
  if (a.invite) return 'chrome';
  const ios = /iPhone|iPad|iPod/.test(a.userAgent) || (a.platform === 'MacIntel' && (a.maxTouchPoints ?? 0) > 1);
  const safari = /Safari\//.test(a.userAgent) && !IOS_AUTRE_NAVIGATEUR.test(a.userAgent);
  return ios && safari ? 'ios' : 'aucune';
}

export function lireEtat(brut: string | null): EtatInstallation | null {
  return brut === 'proposee' || brut === 'refusee' || brut === 'acceptee' ? brut : null;
}

/** L'installation est possible ici et pas encore faite : la ligne « Installer l'app » du Profil se montre. */
export function installable(plateforme: Plateforme, etat: EtatInstallation | null): boolean {
  return (plateforme === 'chrome' || plateforme === 'ios') && etat !== 'acceptee';
}

/**
 * Montrer la proposition ? Seulement à un bon moment, hors partie, sur une plateforme où l'installation est possible,
 * et si elle n'a jamais été montrée (une seule fois : même sans réponse, elle ne revient pas).
 * Depuis le Profil (`profil`), c'est le joueur qui la demande : elle se montre tant que l'app n'est pas installée.
 */
export function doitProposer(c: { plateforme: Plateforme; etat: EtatInstallation | null; moment: Moment | null; enPartie: boolean }): boolean {
  if (c.enPartie || c.moment === null || c.moment === 'go_du_jour') return false;
  if (c.moment === 'profil') return installable(c.plateforme, c.etat);
  if (c.etat !== null) return false;
  return c.plateforme === 'chrome' || c.plateforme === 'ios';
}

/** Relit le compteur de retours, en tolérant les valeurs abîmées. */
export function lireRetours(brut: unknown): Retours | null {
  if (typeof brut !== 'object' || brut === null) return null;
  const { jour, retours } = brut as Partial<Retours>;
  return Number.isInteger(jour) && Number.isInteger(retours) && (retours as number) >= 0 ? { jour: jour as number, retours: retours as number } : null;
}

/** Compte un jour d'ouverture : premier jour = 0 retour ; chaque nouveau jour ajoute un retour (un jour plus tôt, horloge reculée : rien). */
export function compterRetour(avant: Retours | null, jour: number): Retours {
  if (!avant) return { jour, retours: 0 };
  return jour > avant.jour ? { jour, retours: avant.retours + 1 } : avant;
}

/** Moment « retour » atteint : le 2e retour, ou un suivant si la carte n'a pas encore pu se montrer. */
export const estMomentRetour = (r: Retours): boolean => r.retours >= RETOUR_PROPOSITION;

/** Vrai la première fois seulement (le repère est lu avant d'être posé par l'appelant). */
export function estPremiereVictoire(repere: string | null): boolean {
  return repere === null;
}

// ---------- Navigateur ----------

/** Invite d'installation de Chrome (non standard, absente des types DOM). */
export interface InviteInstallation extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let invite: InviteInstallation | null = null;
let ecoute = false;
/** Écrans à prévenir quand l'invite de Chrome arrive ou disparaît (#214 : l'accueil peut s'afficher avant elle). */
const abonnes = new Set<() => void>();
const prevenir = () => abonnes.forEach(f => f());

/** S'abonne aux changements de l'invite ; rend la fonction de désabonnement. */
export function abonnerInvite(f: () => void): () => void {
  abonnes.add(f);
  return () => { abonnes.delete(f); };
}

function lire(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
}
function ecrire(k: string, v: string) {
  try { localStorage.setItem(k, v); } catch { /* stockage indisponible : la proposition pourra revenir à la session suivante */ }
}

/**
 * À appeler au démarrage, avant le rendu : Chrome envoie `beforeinstallprompt` tôt. On garde l'invite pour le bon moment
 * (et on empêche la mini-barre automatique de Chrome). Une installation faite par le menu du navigateur compte comme acceptée.
 */
export function ecouterInstallation(): void {
  if (ecoute || typeof window === 'undefined') return;
  ecoute = true;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    invite = e as InviteInstallation;
    prevenir();
  });
  window.addEventListener('appinstalled', () => {
    invite = null;
    ecrire(INSTALLATION_KEY, 'acceptee');
    prevenir();
  });
}

export function plateformeCourante(): Plateforme {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'aucune';
  const nav = navigator as Navigator & { standalone?: boolean };
  return detecterPlateforme({
    userAgent: nav.userAgent,
    platform: nav.platform,
    maxTouchPoints: nav.maxTouchPoints,
    standalone: nav.standalone,
    affichageApp: !!window.matchMedia?.('(display-mode: standalone)').matches,
    invite: invite !== null,
  });
}

export const etatInstallation = (): EtatInstallation | null => lireEtat(lire(INSTALLATION_KEY));
export const noterInstallation = (e: EtatInstallation): void => ecrire(INSTALLATION_KEY, e);

/** Note l'ouverture du jour (`jour` : numéro de jour, à Paris) et rend le compteur à jour. Une fois par chargement. */
export function noterOuverture(jour: number): Retours {
  let brut: unknown = null;
  try { brut = JSON.parse(lire(RETOURS_KEY) ?? 'null'); } catch { /* valeur abîmée : on repart de zéro */ }
  const avant = lireRetours(brut);
  const apres = compterRetour(avant, jour);
  if (apres !== avant) ecrire(RETOURS_KEY, JSON.stringify(apres));
  return apres;
}

/** Pose le repère de première victoire ; vrai si c'était la première. */
export function noterVictoire(): boolean {
  const premiere = estPremiereVictoire(lire(PREMIERE_VICTOIRE_KEY));
  if (premiere) ecrire(PREMIERE_VICTOIRE_KEY, '1');
  return premiere;
}

/** Ouvre l'invite de Chrome (utilisable une seule fois). `null` si elle n'est plus disponible. */
export async function ouvrirInvite(): Promise<'accepted' | 'dismissed' | null> {
  const i = invite;
  if (!i) return null;
  invite = null;
  prevenir();
  try {
    await i.prompt();
    return (await i.userChoice).outcome;
  } catch {
    return null;
  }
}

/** Réservé aux tests. */
export function _inviteDeTest(i: InviteInstallation | null): void { invite = i; }
