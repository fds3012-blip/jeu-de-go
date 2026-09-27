// Proposer d'installer l'app (PWA) au bon moment (issue #178, suite de #162).
// Juste après une première victoire contre l'ordi ou un Go du jour réussi, une seule fois, refus mémorisé,
// jamais pendant une partie. Déjà installée : rien.
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
export type Moment = 'premiere_victoire' | 'go_du_jour';

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

/**
 * Montrer la proposition ? Seulement à un bon moment, hors partie, sur une plateforme où l'installation est possible,
 * et si elle n'a jamais été montrée (une seule fois : même sans réponse, elle ne revient pas).
 */
export function doitProposer(c: { plateforme: Plateforme; etat: EtatInstallation | null; moment: Moment | null; enPartie: boolean }): boolean {
  if (c.enPartie || c.moment === null || c.etat !== null) return false;
  return c.plateforme === 'chrome' || c.plateforme === 'ios';
}

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
  });
  window.addEventListener('appinstalled', () => {
    invite = null;
    ecrire(INSTALLATION_KEY, 'acceptee');
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
  try {
    await i.prompt();
    return (await i.userChoice).outcome;
  } catch {
    return null;
  }
}

/** Réservé aux tests. */
export function _inviteDeTest(i: InviteInstallation | null): void { invite = i; }
