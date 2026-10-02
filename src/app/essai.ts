// Essai sans compte (#343, décision de Florian du 30/09, modèle chess.com).
//
// Sans compte, on garde le premier plaisir : 3 parties terminées contre l'ordi, les leçons 1 à 3, le Go du jour
// (et ses liens partagés, #332). Au-delà, et pour tout ce qui touche d'autres joueurs (défi par lien, jeu en ligne),
// il faut un compte avec un pseudo. Logique pure, testée par Vitest ; l'écran (App.tsx) garde le compteur sur l'appareil.
//
// Une session anonyme (ancien défi par lien, #81) compte comme « pas de compte » : elle doit lier un e-mail.
// Sans service de compte (Supabase non configuré, build de test), rien n'est limité : on ne peut pas créer de compte,
// bloquer l'essai rendrait l'app inutilisable.

/** Clé de l'appareil : parties terminées pendant l'essai. */
export const ESSAI_KEY = 'go.essai.v1';

/** Parties terminées contre l'ordi (partie guidée et partie à deux comprises) autorisées sans compte. */
export const PARTIES_ESSAI = 3;
/** Leçons ouvertes sans compte : les 3 premières du chemin. */
export const LECONS_ESSAI = 3;

/** Ce que le joueur veut faire. */
export type Acces =
  | { quoi: 'partie' }
  /** Leçon par son rang dans le chemin (0 = leçon 1). */
  | { quoi: 'lecon'; rang: number }
  | { quoi: 'go_du_jour' }
  /** Tout autre problème : « Continuer », grille, course, révision, série de fin de leçon. */
  | { quoi: 'probleme' }
  | { quoi: 'placement' }
  | { quoi: 'import' }
  | { quoi: 'defi' }
  | { quoi: 'en_ligne' };

/** Pourquoi l'écran « Crée ton compte » s'ouvre : c'est aussi la propriété `raison` de `essai_limite_atteinte`. */
export type Raison = 'parties' | 'lecons' | 'problemes' | 'placement' | 'import' | 'defi' | 'en_ligne';

/** État du compte du joueur. `sans_pseudo` : connecté, mais le pseudo n'est pas encore choisi. */
export type EtatCompte = 'chargement' | 'aucun' | 'anonyme' | 'sans_pseudo' | 'complet';

export type Decision = { ok: true } | { ok: false; raison: Raison };

export interface Essai {
  /** Parties terminées sur cet appareil depuis le début de l'essai. */
  terminees: number;
  /**
   * Vrai dès qu'une fin de partie a été notée par ce compteur : il fait foi, le bilan n'est plus relu.
   * Absent : appareil d'avant #343, ou aucune partie finie depuis.
   */
  suivi?: true;
}

type Bilan = Readonly<Record<string, { v: number; d: number }>>;

/** Relit l'essai gardé sur l'appareil, en ignorant ce qui est mal formé. */
export function lireEssai(raw: unknown): Essai {
  const r = raw as { terminees?: unknown; suivi?: unknown } | null;
  const n = Number(r?.terminees);
  const terminees = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  return r?.suivi === true ? { terminees, suivi: true } : { terminees };
}

/** Une partie de plus terminée (l'essai d'entrée n'est pas modifié). */
export function noterPartieTerminee(e: Essai, bilan: Bilan = {}): Essai {
  return noterFinDePartie(e, bilan, true);
}

/**
 * Fin d'une partie. `compte` faux : partie finie sur un plateau presque vide (#251), qui ne consomme pas une partie
 * d'essai. Recette du 02/10 au soir : le bilan contre l'ordi enregistre quand même cette partie ; tant que le compteur
 * relisait le bilan, elle était donc comptée. Le compteur part du total déjà connu (bilan des joueurs d'avant #343
 * compris), puis fait foi.
 */
export function noterFinDePartie(e: Essai, bilan: Bilan, compte: boolean): Essai {
  return { terminees: partiesTerminees(e, bilan) + (compte ? 1 : 0), suivi: true };
}

/**
 * Parties déjà terminées : le compteur de l'essai s'il est suivi ; sinon le compteur ou le bilan contre l'ordi s'il est
 * plus grand (joueurs d'avant #343, dont les parties n'étaient pas encore comptées).
 */
export function partiesTerminees(e: Essai, bilan: Bilan): number {
  if (e.suivi) return e.terminees;
  const duBilan = Object.values(bilan).reduce((s, b) => s + b.v + b.d, 0);
  return Math.max(e.terminees, duBilan);
}

/** Parties d'essai qu'il reste (jamais négatif). */
export const partiesRestantes = (terminees: number) => Math.max(0, PARTIES_ESSAI - terminees);

/** Ce qui est libre sans compte, quel que soit le compte. */
export function libreSansCompte(a: Acces, terminees: number): boolean {
  switch (a.quoi) {
    case 'partie': return terminees < PARTIES_ESSAI;
    case 'lecon': return a.rang < LECONS_ESSAI;
    case 'go_du_jour': return true;
    default: return false;
  }
}

const RAISON: Record<Exclude<Acces['quoi'], 'go_du_jour'>, Raison> = {
  partie: 'parties', lecon: 'lecons', probleme: 'problemes', placement: 'placement', import: 'import', defi: 'defi', en_ligne: 'en_ligne',
};

/**
 * Décide si le joueur peut faire `a`.
 * - `comptesDisponibles` faux (pas de Supabase) : tout est ouvert, sauf ce qui a besoin du serveur (défi, en ligne),
 *   que l'écran désactive déjà.
 * - Compte complet (e-mail et pseudo) : tout est ouvert.
 * - Pendant le chargement de la session (quelques centaines de millisecondes) : rien n'est bloqué. Un joueur connecté
 *   ne doit jamais voir « Crée ton compte » ; le serveur protège de toute façon ce qui compte (défi, en ligne).
 * - Sinon (aucun compte, session anonyme, pseudo à choisir) : l'essai.
 */
export function decider(a: Acces, compte: EtatCompte, terminees: number, comptesDisponibles = true): Decision {
  if (compte === 'complet' || compte === 'chargement') return { ok: true };
  if (!comptesDisponibles && a.quoi !== 'defi' && a.quoi !== 'en_ligne') return { ok: true };
  if (libreSansCompte(a, terminees)) return { ok: true };
  return { ok: false, raison: RAISON[a.quoi as keyof typeof RAISON] };
}

/** État du compte à partir de la session et du profil (pseudo). */
export function etatCompte(session: { anonyme: boolean } | null | undefined, pseudo: string | null | undefined): EtatCompte {
  if (session === undefined) return 'chargement';
  if (session === null) return 'aucun';
  if (session.anonyme) return 'anonyme';
  if (pseudo === undefined) return 'chargement';
  return pseudo ? 'complet' : 'sans_pseudo';
}
