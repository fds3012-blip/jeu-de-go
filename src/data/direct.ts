// Partie en direct contre un humain (issue #360) : file d'attente, partie classée, pendule tenue par le serveur.
// Toute la sécurité est côté serveur (supabase/migrations/20261004180100_partie_en_direct.sql) :
// - `find_match` : entre dans la file, ou crée la partie classée (taille, cadence, comptage, cote Glicko-2) ;
// - `quitter_file_attente` : annule l'attente (rend la partie si un adversaire l'a déjà créée) ;
// - `refuser_partie_direct` (#436) : refuse la partie trouvée pendant le repli contre l'IA, avant d'y avoir joué ;
// - `pendule_direct` : signe de présence, constat de la perte au temps, état de la pendule et de la partie ;
// - les coups, le comptage et l'acceptation passent par la fonction serveur `game-action` (src/data/games.ts),
//   l'abandon par `resign_game`. La cote bouge une seule fois, par le serveur (`apply_game_rating`, #417).
// Écran : src/app/Direct.tsx (chargé à la demande).
import { CODE_COMPTE_REQUIS, CODE_PSEUDO_REQUIS } from './compteRequis';
import type { Game } from './games';
import type { Db } from './supabase';
import { suivreLignes } from './tempsReel';
import { lireEtatDirect, penduleApresCoup, type Cadence, type EtatDirect } from '../go/pendule';

export type Regles = 'japanese' | 'chinese';
export type Taille = 9 | 13 | 19;

/** Refus connus, traduits par l'écran. `miseAJour` : le serveur n'a pas encore la nouvelle `find_match`. */
export type RefusDirect = 'compte' | 'miseAJour' | 'introuvable' | 'serveur';

export function refusDirect(erreur: unknown): RefusDirect {
  const code = (erreur as { code?: unknown } | null | undefined)?.code;
  if (code === CODE_COMPTE_REQUIS || code === CODE_PSEUDO_REQUIS) return 'compte';
  // PostgREST : fonction inconnue avec ces paramètres (migration pas encore appliquée).
  if (code === 'PGRST202') return 'miseAJour';
  if (code === 'P0002') return 'introuvable';
  return 'serveur';
}

/** Résultat d'un appel : la valeur, ou un refus connu. */
export type Result<T, E = RefusDirect> = { ok: true; value: T } | { ok: false; error: E };

const refus = (error: unknown): { ok: false; error: RefusDirect } => ({ ok: false, error: refusDirect(error) });

/**
 * Cherche un adversaire. Renvoie l'identifiant de la partie dès qu'elle existe (créée par cet appel, par un adversaire
 * pendant l'attente, ou partie en direct déjà en cours), sinon null : le joueur attend, et rappelle cette fonction.
 */
export async function chercherAdversaire(db: Db, taille: Taille, cadence: Cadence, regles: Regles): Promise<Result<string | null, RefusDirect>> {
  const { data, error } = await db.rpc('find_match', { p_size: taille, p_cadence: cadence, p_regles: regles });
  if (error) return refus(error);
  return { ok: true, value: data ?? null };
}

/** Quitte la file. Renvoie la partie si un adversaire l'a déjà créée (l'écran l'ouvre au lieu d'annuler). */
export async function annulerAttente(db: Db): Promise<Result<string | null, RefusDirect>> {
  const { data, error } = await db.rpc('quitter_file_attente');
  if (error) return refus(error);
  return { ok: true, value: data ?? null };
}

/**
 * Refuse une partie en direct trouvée pendant le repli contre l'IA (#436, « Rester ») : annulée par le serveur tant que
 * le joueur n'y a pas joué (aucune cote ne bouge), et il sort de la file. Vrai si la partie a été annulée.
 */
export async function refuserPartieDirect(db: Db, partieId: string): Promise<Result<boolean, RefusDirect>> {
  const { data, error } = await db.rpc('refuser_partie_direct', { p_partie: partieId });
  if (error) return refus(error);
  return { ok: true, value: data === true };
}

/** État de la partie lu avec l'heure du client à l'envoi et à la réception (pour caler la pendule affichée). */
export interface Lecture { etat: EtatDirect; envoi: number; reception: number }

/** Pendule et partie : vaut aussi signe de présence ; le serveur y constate la perte au temps. */
export async function lirePendule(db: Db, partieId: string, horloge: () => number = Date.now): Promise<Result<Lecture, RefusDirect>> {
  const envoi = horloge();
  const { data, error } = await db.rpc('pendule_direct', { p_partie: partieId });
  const reception = horloge();
  if (error) return refus(error);
  const etat = lireEtatDirect(data);
  return etat ? { ok: true, value: { etat, envoi, reception } } : { ok: false, error: 'serveur' };
}

/** Ligne fixe de la partie (joueurs, taille, règles) : lue une fois, sous la RLS des parties. */
export async function lirePartieDirect(db: Db, partieId: string): Promise<Result<Game, RefusDirect>> {
  const { data, error } = await db.from('games').select('*').eq('id', partieId).maybeSingle();
  if (error) return refus(error);
  return data ? { ok: true, value: data } : { ok: false, error: 'introuvable' };
}

/** Partie à jour : la ligne fixe, avec les coups, le comptage et le résultat lus dans l'état de la pendule. */
export function avecEtat(g: Game, e: EtatDirect): Game {
  return { ...g, moves: e.coups, counting: e.comptage, dead_stones: e.mortes, dead_proposed_by: e.mortesPar, status: e.statut, result: e.resultat };
}

/** Ce que l'écran d'une partie en direct fait des événements temps réel (#425). */
export interface SuiviDirect {
  /** Ligne `games` : coups, comptage, résultat. Affichée tout de suite, sans attendre la pendule. */
  surPartie: (ligne: Record<string, unknown>) => void;
  /** Ligne `parties_direct` : la pendule (temps restants, début du coup en cours, présence). */
  surPendule: (ligne: Record<string, unknown>) => void;
  /** Relecture complète (`pendule_direct`) : abonnement (re)confirmé, retour au premier plan ou du réseau. */
  rattraper: () => void;
}

/**
 * Suit la partie en temps réel : coups (table `games`) et pendule (table `parties_direct`, lue par ses deux joueurs).
 * #425 : la ligne reçue est appliquée telle quelle. Avant, chaque événement relançait `pendule_direct`, qui écrit la
 * présence dans `parties_direct`, donc un nouvel événement chez les deux joueurs : une boucle de relectures.
 * Renvoie la fonction qui arrête le suivi.
 */
export function abonnerDirect(db: Db, partieId: string, suivi: SuiviDirect): () => void {
  return suivreLignes(db, `direct-${partieId}`, [
    { table: 'games', filtre: `id=eq.${partieId}`, surLigne: suivi.surPartie },
    { table: 'parties_direct', filtre: `partie_id=eq.${partieId}`, surLigne: suivi.surPendule }
  ], { rattraper: suivi.rattraper });
}

/**
 * Applique à l'état affiché la pendule poussée par le temps réel (ligne `parties_direct`). Les colonnes absentes ou
 * mal formées gardent leur valeur. L'heure du serveur (`maintenant`) reste celle de la dernière lecture.
 */
export function fusionnerPendule(e: EtatDirect, ligne: Record<string, unknown>): EtatDirect {
  const entier = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  const date = (cle: string, d: number | null): number | null => {
    if (!(cle in ligne)) return d;
    const v = ligne[cle];
    if (v === null) return null;
    const t = typeof v === 'string' ? Date.parse(v) : NaN;
    return Number.isNaN(t) ? d : t;
  };
  return {
    ...e,
    periodeMs: entier(ligne.periode_ms, e.periodeMs),
    noir: { ms: entier(ligne.noir_ms, e.noir.ms), periodes: entier(ligne.noir_periodes, e.noir.periodes), vuLe: date('noir_vu_le', e.noir.vuLe) },
    blanc: { ms: entier(ligne.blanc_ms, e.blanc.ms), periodes: entier(ligne.blanc_periodes, e.blanc.periodes), vuLe: date('blanc_vu_le', e.blanc.vuLe) },
    traitDepuis: date('trait_depuis', e.traitDepuis),
  };
}

/**
 * Applique à l'état affiché la ligne `games` poussée par le temps réel ; null si elle a moins de coups que l'affichage
 * (événement en retard, ou coup affiché d'avance chez qui joue). `heureServeur` : heure du serveur estimée par le client.
 */
export function fusionnerEtatPartie(e: EtatDirect, ligne: Record<string, unknown>, heureServeur: number): EtatDirect | null {
  const coups = typeof ligne.moves === 'string' ? ligne.moves : e.coups;
  if (coups.length < e.coups.length) return null;
  const statut = ligne.status;
  // Un coup de plus : la pendule de l'autre part tout de suite (estimation, remplacée par la ligne `parties_direct`).
  const base = coups.length === e.coups.length + 2 ? penduleApresCoup(e, heureServeur) : e;
  return {
    ...base,
    coups,
    comptage: typeof ligne.counting === 'boolean' ? ligne.counting : e.comptage,
    mortes: 'dead_stones' in ligne && (ligne.dead_stones === null || typeof ligne.dead_stones === 'string') ? ligne.dead_stones : e.mortes,
    mortesPar: 'dead_proposed_by' in ligne && (ligne.dead_proposed_by === null || typeof ligne.dead_proposed_by === 'string') ? ligne.dead_proposed_by : e.mortesPar,
    statut: statut === 'active' || statut === 'finished' || statut === 'aborted' || statut === 'waiting' ? statut : e.statut,
    resultat: 'result' in ligne && (ligne.result === null || typeof ligne.result === 'string') ? ligne.result : e.resultat,
  };
}

/** Abandonne la partie (le serveur compte la cote). Renvoie le résultat (`W+R` ou `B+R`). */
export async function abandonnerDirect(db: Db, partieId: string): Promise<Result<string, RefusDirect>> {
  const { data, error } = await db.rpc('resign_game', { p_game: partieId });
  if (error || !data) return refus(error);
  return { ok: true, value: data };
}
