/**
 * Écrans chargés à la demande (perf, 29/09) : le premier écran (l'accueil) n'attend pas le code
 * de la partie, des leçons, des problèmes ni du profil.
 *
 * - Chaque écran est un morceau JS séparé, chargé au premier affichage (React.lazy).
 * - Une fois l'accueil et ses polices affichés, `prechargerEcrans()` les télécharge tous en tâche de fond :
 *   toucher un onglet reste instantané en pratique, et le service worker les garde pour le hors-ligne.
 * - Si un morceau manque (nouvelle version déployée pendant que l'app était ouverte), la page se recharge
 *   une fois pour prendre la nouvelle version, au lieu de laisser un écran vide.
 *
 * Les styles de ces écrans restent dans la feuille principale (voir src/main.tsx) : rendu inchangé. Exception (#433) :
 * apprendre.css arrive avec Apprendre et Problèmes ; règles et précautions : docs/architecture/chargement-initial.md.
 */
import { lazy, type ComponentType } from 'react';

const RECHARGE_KEY = 'go.recharge-version.v1';

/** Recharge la page une seule fois par minute : jamais de boucle si le morceau manque vraiment. */
export function rechargerPourNouvelleVersion(maintenant = Date.now()): boolean {
  try {
    const avant = Number(sessionStorage.getItem(RECHARGE_KEY) ?? 0);
    if (maintenant - avant < 60_000) return false;
    sessionStorage.setItem(RECHARGE_KEY, String(maintenant));
  } catch {
    return false;
  }
  location.reload();
  return true;
}

/** Réseau mobile instable : quelques nouveaux essais espacés avant d'abandonner. */
export async function avecEssais<M>(importer: () => Promise<M>, delais: readonly number[] = [500, 1500, 3000]): Promise<M> {
  for (let i = 0; ; i++) {
    try {
      return await importer();
    } catch (err) {
      if (i >= delais.length) throw err;
      await new Promise(r => setTimeout(r, delais[i]));
    }
  }
}

function charger<M>(importer: () => Promise<M>): () => Promise<M> {
  let promesse: Promise<M> | null = null;
  return () => {
    promesse ??= avecEssais(importer).catch((err: unknown) => {
      promesse = null; // un nouvel essai reste possible (réseau revenu)
      if (rechargerPourNouvelleVersion()) return new Promise<M>(() => {}); // la page se recharge
      throw err;
    });
    return promesse;
  };
}

const partie = charger(() => import('./Game'));
const lecons = charger(() => import('./Learn'));
const problemes = charger(() => import('./Puzzles'));
const serie = charger(() => import('./SeriePratique'));
const profil = charger(() => import('./Profil'));
const placement = charger(() => import('./Placement'));
const defis = charger(() => import('./Defis'));
const compte = charger(() => import('./CreerCompte'));
const direct = charger(() => import('./Direct'));
// #429 : le carrousel des adversaires ne sert qu'à la feuille « Changer » : hors du JS initial.
const carrousel = charger(() => import('../ui/Carrousel'));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ecran<M, K extends keyof M>(importer: () => Promise<M>, nom: K): M[K] extends ComponentType<any> ? M[K] : never {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return lazy(() => importer().then(m => ({ default: m[nom] as ComponentType<any> }))) as never;
}

export const Game = ecran(partie, 'Game');
export const LearnHome = ecran(lecons, 'LearnHome');
export const LessonPlayer = ecran(lecons, 'LessonPlayer');
export const Puzzles = ecran(problemes, 'Puzzles');
export const SeriePratique = ecran(serie, 'SeriePratique');
export const Profil = ecran(profil, 'Profil');
export const Placement = ecran(placement, 'Placement');
export const DefisEcran = ecran(defis, 'DefisEcran');
export const DefiArrivee = ecran(defis, 'DefiArrivee');
export const DefiPartie = ecran(defis, 'DefiPartie');
export const CreerCompte = ecran(compte, 'CreerCompte');
export const PseudoObligatoire = ecran(compte, 'PseudoObligatoire');
export const Direct = ecran(direct, 'Direct');
// #436 : la bande « Je cherche toujours un joueur » pendant la partie contre l'IA, avec l'écran du direct.
export const VeilleFile = ecran(direct, 'VeilleFile');
export const CarrouselAdversaires = ecran(carrousel, 'CarrouselAdversaires');

/**
 * La partie est l'action principale de l'accueil : son code part tout de suite (≈ 20 Ko gzip avec la revue),
 * pour que « Jouer » ouvre le plateau sans attente, même touché dès l'affichage.
 */
export function prechargerPartie(): void {
  partie().catch(() => {});
}

/** Télécharge tous les écrans en tâche de fond. */
export function prechargerEcrans(): void {
  for (const f of [partie, problemes, lecons, profil, serie, placement, defis, compte, direct, carrousel]) f().catch(() => {});
}

// Moment « après le premier écran » : src/premierEcran.ts (partagé avec PostHog, #325).
export { apresPremierEcran } from '../premierEcran';
