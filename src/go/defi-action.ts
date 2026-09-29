// Action `defi_coup` de la fonction serveur game-action (issue #81) : un coup d'une partie « défi par lien ».
// Contrat avec le client : POST { action: 'defi_coup', game_id, move } (SGF deux lettres, `tt` = passe)
//   → 200 { ok: true, game } ou { ok: false, error, message } avec un statut HTTP clair.
// Ordre des contrôles : partie existante et bien un défi (404), joueur de la partie (403), partie en cours (409),
// tour (409), règles du go : format, hors plateau, occupé, suicide, ko (422). Puis `jouer_coup_defi` (clé service)
// revérifie sous verrou joueur, tour, délai de 3 jours et partie inchangée : délai dépassé → 409 `temps`.
// Les accès à la base sont injectés (`DefiCoupDeps`) : la logique est testée par Vitest sans Supabase.
import { defiMoveArgs, planAction, type GameRow } from './server';

export interface DefiCoupRequest {
  action: 'defi_coup';
  gameId: string;
  move: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lit la demande `defi_coup` ; null si elle est mal formée (400). */
export function parseDefiCoupRequest(body: unknown): DefiCoupRequest | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (b.action !== 'defi_coup') return null;
  if (typeof b.game_id !== 'string' || !UUID.test(b.game_id)) return null;
  if (typeof b.move !== 'string' || b.move.length !== 2) return null;
  return { action: 'defi_coup', gameId: b.game_id, move: b.move };
}

/** Réponse de `jouer_coup_defi` (jsonb). */
export interface JouerCoupDefiResult {
  ok: boolean;
  erreur?: string;
  resultat?: string;
  coups?: string;
  date_limite?: string | null;
}

export interface DbError {
  code?: string;
  message?: string;
}

/** Accès à la base utilisés par l'action (clé service, côté serveur uniquement). */
export interface DefiCoupDeps {
  /** Ligne `games` et présence d'une ligne `defis` ; `error` si la lecture a échoué. */
  lirePartie(gameId: string): Promise<{ game: GameRow | null; estDefi: boolean; error?: boolean }>;
  jouerCoupDefi(args: NonNullable<ReturnType<typeof defiMoveArgs>>): Promise<{ data: JouerCoupDefiResult | null; error: DbError | null }>;
  relirePartie(gameId: string): Promise<GameRow | null>;
}

export type DefiCoupResponse =
  | { status: 200; body: { ok: true; game: GameRow } }
  | { status: number; body: { ok: false; error: string; message: string; resultat?: string } };

const refuse = (status: number, error: string, message: string, extra: { resultat?: string } = {}): DefiCoupResponse =>
  ({ status, body: { ok: false, error, message, ...extra } });

/** Traduit un refus de `jouer_coup_defi` (codes d'erreur de la migration defi_par_lien) en réponse HTTP. */
export function refusDepuisSql(e: DbError): DefiCoupResponse {
  const m = e.message ?? '';
  switch (e.code) {
    case '42501':
      return /tour/i.test(m) ? refuse(409, 'tour', 'Ce n’est pas ton tour.') : refuse(403, 'spectateur', 'Tu ne joues pas dans cette partie.');
    case '40001':
      return refuse(409, 'conflit', 'La partie a changé entre-temps. Recharge-la.');
    case '55000':
      return /comptage/i.test(m)
        ? refuse(409, 'comptage', 'Comptage en cours : reprends la partie pour jouer.')
        : refuse(409, 'terminee', 'La partie n’est pas en cours.');
    case '22023':
      return refuse(422, 'format', 'Coup invalide.');
    case 'P0002':
      return refuse(404, 'introuvable', 'Partie introuvable.');
    default:
      return refuse(500, 'ecriture', 'Impossible d’enregistrer.');
  }
}

export async function defiCoup(deps: DefiCoupDeps, userId: string, req: DefiCoupRequest): Promise<DefiCoupResponse> {
  const lu = await deps.lirePartie(req.gameId);
  if (lu.error) return refuse(500, 'lecture', 'Impossible de lire la partie.');
  const game = lu.game;
  // Une partie qui n'est pas un défi est traitée comme introuvable : cette action ne sert qu'aux défis.
  if (!game || !lu.estDefi) return refuse(404, 'introuvable', 'Défi introuvable.');
  // Tiers : refusé avant tout autre contrôle, pour ne rien dire de l'état de la partie.
  if (userId !== game.black_id && userId !== game.white_id) return refuse(403, 'spectateur', 'Tu ne joues pas dans cette partie.');

  // Mêmes règles que les coups des parties en ligne (src/go/server.ts) : tour, format, occupé, suicide, ko.
  const plan = planAction(game, userId, { action: 'move', gameId: req.gameId, move: req.move });
  if (!plan.ok) return refuse(plan.status, plan.error, plan.message);
  const args = defiMoveArgs(req.gameId, userId, plan);
  if (!args) return refuse(500, 'partie-invalide', 'L’historique de la partie est invalide.');

  const { data, error } = await deps.jouerCoupDefi(args);
  if (error) return refusDepuisSql(error);
  if (!data?.ok) {
    if (data?.erreur === 'temps') {
      return refuse(409, 'temps', 'Temps écoulé : la partie est finie.', data.resultat ? { resultat: data.resultat } : {});
    }
    return refuse(500, 'ecriture', 'Impossible d’enregistrer.');
  }
  const apres = await deps.relirePartie(req.gameId);
  return {
    status: 200,
    body: { ok: true, game: apres ?? { ...game, moves: data.coups ?? args.p_coups_avant + args.p_coup, counting: args.p_comptage } }
  };
}
