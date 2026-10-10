/**
 * Compteurs anonymes de l'entonnoir de la première session (#437).
 *
 * Sans accord, PostHog ne voit presque rien de la première session. Ces compteurs disent seulement « combien
 * d'appareils ont franchi telle étape tel jour » (table `compteurs_entonnoir`, fonction `compter_etape`,
 * migration 20261005120100). Ils entrent dans l'exemption de consentement de la CNIL pour la mesure d'audience
 * (analyse : docs/juridique/consentement.md, section #437) :
 * - aucune donnée envoyée sur le joueur : le nom de l'étape, rien d'autre ; la requête part avec la seule clé publique
 *   (jamais le jeton de session), sans cookie (`credentials: 'omit'`) ni adresse d'origine (`no-referrer`) ;
 * - sur l'appareil, un repère par étape (`go.entonnoir.<étape>` = mois où elle a été comptée, `AAAA-MM`), sans
 *   identifiant, valable 13 mois au plus (jamais prolongé, effacé ensuite), pour ne compter chaque étape qu'une fois ;
 * - le joueur peut s'y opposer (page Conditions) : rien n'est compté, les repères sont effacés ;
 * - appareils de l'équipe (`estEquipe`), previews et développement local : rien n'est compté ;
 * - navigateurs pilotés (`navigator.webdriver === true` : Puppeteer, Playwright, Selenium) : rien n'est compté (#519,
 *   environ 87 % des premiers écrans comptés du 05 au 09/10 étaient des robots : docs/data/mesure-lancement-2026-10.md).
 *   Les tests e2e se présentent comme un navigateur ordinaire (e2e/compteurs-entonnoir.spec.ts) : aucun passe-droit ici.
 *
 * Seuls les appareils neufs entrent dans l'entonnoir : `premier_ecran` n'est compté qu'au tout premier lancement, et
 * les étapes suivantes seulement sur un appareil dont le premier écran a été compté (pas les joueurs d'avant #437).
 * L'envoi attend le premier écran (`apresPremierEcran`) et n'est jamais attendu : un échec est silencieux.
 *
 * Étapes ajoutées par #519 (migration 20261010180000) : `premier_geste` (première interaction réelle, src/app/premierGeste.ts :
 * dénominateur humain, les robots qui masquent `webdriver` ne touchent rien), `partie_ouverte` (écran de partie monté),
 * `premier_toucher_plateau` (premier toucher d'un point vide, fantôme compris). `premiere_pierre` compte désormais la
 * première pierre où qu'elle soit posée (partie, leçon, problème, placement : src/app/premierePierre.ts).
 */
import { apresPremierEcran } from '../premierEcran';
import { analyticsConfig, ENTONNOIR_PREFIX, estEquipe, getOpposition } from './analytics';
import { configSupabase, envDeTest } from './client';

export const ETAPES = [
  'premier_ecran', 'premiere_pierre', 'premiere_partie_finie', 'limite_essai', 'compte_cree', 'premiere_partie_en_ligne',
  'premier_geste', 'partie_ouverte', 'premier_toucher_plateau',
] as const;
export type Etape = (typeof ETAPES)[number];

/** Durée de vie d'un repère, en mois (CNIL : 13 mois au plus pour un traceur de mesure d'audience exempté). */
export const DUREE_REPERE_MOIS = 13;

const comptees = new Set<Etape>();

function mois(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Vrai si le repère (`AAAA-MM`) a moins de 13 mois à la date `maintenant`. */
export function repereValide(valeur: string | null, maintenant = new Date()): boolean {
  const m = valeur ? /^(\d{4})-(\d{2})$/.exec(valeur) : null;
  if (!m) return false;
  const ecart = (maintenant.getFullYear() - Number(m[1])) * 12 + (maintenant.getMonth() + 1 - Number(m[2]));
  return ecart >= 0 && ecart < DUREE_REPERE_MOIS;
}

function lireRepere(etape: Etape): string | null {
  try { return localStorage.getItem(ENTONNOIR_PREFIX + etape); } catch { return null; }
}

/** Vrai si l'étape a déjà été comptée sur cet appareil (repère valide) ou dans cette page. */
export function dejaComptee(etape: Etape): boolean {
  return comptees.has(etape) || repereValide(lireRepere(etape));
}

function poserRepere(etape: Etape) {
  comptees.add(etape);
  try { localStorage.setItem(ENTONNOIR_PREFIX + etape, mois(new Date())); } catch { /* repli : cette page seulement */ }
}

/**
 * Efface les repères de plus de 13 mois (ou illisibles) : un repère expiré ne reste pas sur l'appareil. Appelée à chaque
 * lancement (par le compteur du premier écran).
 */
export function purgerReperesExpires(maintenant = new Date()): void {
  try {
    const cles: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(ENTONNOIR_PREFIX) && !repereValide(localStorage.getItem(k), maintenant)) cles.push(k);
    }
    cles.forEach(k => localStorage.removeItem(k));
  } catch { /* stockage indisponible : rien à purger */ }
}

/** Navigateur piloté par un programme (WebDriver, CDP) : il le déclare dans `navigator.webdriver`. */
export function estPilote(): boolean {
  try { return typeof navigator !== 'undefined' && navigator.webdriver === true; } catch { return false; }
}

/**
 * Mesure possible : navigateur non piloté, site de production (les previews Vercel et le développement local partagent
 * la base : ils ne comptent pas ; les builds e2e, oui, vers leur faux serveur), pas d'opposition, pas un appareil de l'équipe.
 */
function permis(): boolean {
  if (typeof window === 'undefined' || typeof fetch !== 'function' || estPilote()) return false;
  if (analyticsConfig().environment !== 'production' && !import.meta.env.VITE_E2E) return false;
  return !getOpposition() && !estEquipe();
}

/**
 * Compte une étape, au plus une fois par appareil. `premier_ecran` seulement si `nouveau` (tout premier lancement) ;
 * les autres étapes seulement si le premier écran de cet appareil a été compté.
 */
export function compterEtape(etape: Etape, options: { nouveau?: boolean } = {}): void {
  if (etape === 'premier_ecran' && typeof window !== 'undefined') purgerReperesExpires();
  if (!permis() || dejaComptee(etape)) return;
  if (etape === 'premier_ecran' ? !options.nouveau : !dejaComptee('premier_ecran')) return;
  const config = configSupabase(envDeTest(import.meta.env));
  if (!config) return;
  poserRepere(etape);
  apresPremierEcran(() => {
    // Opposition ou drapeau de l'équipe posés pendant l'attente : rien ne part.
    if (!permis()) return;
    try {
      void fetch(`${config.url.replace(/\/+$/, '')}/rest/v1/rpc/compter_etape`, {
        method: 'POST',
        headers: { apikey: config.key, Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_etape: etape }),
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        cache: 'no-store',
        keepalive: true,
      }).catch(() => { /* hors ligne, plafond : la mesure n'est jamais bloquante */ });
    } catch { /* fetch indisponible */ }
  });
}

/** Réservé aux tests. */
export function _reinitialiserCompteurs(): void {
  comptees.clear();
}
