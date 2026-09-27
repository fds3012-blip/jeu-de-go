// Fonction serveur des parties en ligne entre humains (issue #9).
// POST { action: 'move', gameId, move } | { action: 'propose_dead', gameId, dead } | { action: 'accept', gameId } | { action: 'resume', gameId }
// Toute la logique de jeu vient de src/go (copie dans ./go, voir scripts/sync-functions.mjs).
// La clé service (SUPABASE_SERVICE_ROLE_KEY) est fournie par l'environnement Supabase : elle n'est jamais dans le dépôt.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { parseActionRequest, planAction, type GameRow } from './go/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const refuse = (status: number, error: string, message: string) => json(status, { ok: false, error, message });

const COLUMNS = 'id, black_id, white_id, bot_id, size, rules, komi, handicap, moves, status, counting, dead_stones, dead_proposed_by, resumed_at';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return refuse(405, 'methode', 'Méthode non autorisée.');

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return refuse(500, 'configuration', 'Serveur mal configuré.');
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: auth, error: authError } = token ? await admin.auth.getUser(token) : { data: null, error: true };
  const userId = auth?.user?.id;
  if (authError || !userId) return refuse(401, 'connexion', 'Connexion requise.');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return refuse(400, 'format', 'Demande invalide.');
  }
  const action = parseActionRequest(body);
  if (!action) return refuse(400, 'format', 'Demande invalide.');

  const { data: game, error: readError } = await admin.from('games').select(COLUMNS).eq('id', action.gameId).maybeSingle();
  if (readError) return refuse(500, 'lecture', 'Impossible de lire la partie.');
  if (!game) return refuse(404, 'introuvable', 'Partie introuvable.');

  const plan = planAction(game as GameRow, userId, action);
  if (!plan.ok) return refuse(plan.status, plan.error, plan.message);

  if (plan.kind === 'finish') {
    const { data: result, error } = await admin.rpc('finish_game_by_score', {
      p_game: action.gameId, p_user: userId, p_moves: plan.expect.moves, p_dead: plan.expect.dead_stones ?? '',
      p_result: plan.result, p_black: plan.black, p_white: plan.white
    });
    if (error) return refuse(409, 'conflit', error.message);
    return json(200, { ok: true, result, black: plan.black, white: plan.white });
  }

  // Écriture conditionnelle : refusée si un autre coup ou une autre action est passé entre la lecture et l'écriture.
  let q = admin.from('games').update(plan.patch).eq('id', action.gameId).eq('status', 'active')
    .eq('moves', plan.expect.moves).eq('counting', plan.expect.counting);
  q = plan.expect.dead_stones === null ? q.is('dead_stones', null) : q.eq('dead_stones', plan.expect.dead_stones);
  const { data: rows, error: writeError } = await q.select(COLUMNS);
  if (writeError) return refuse(500, 'ecriture', 'Impossible d’enregistrer.');
  if (!rows?.length) return refuse(409, 'conflit', 'La partie a changé entre-temps. Recharge-la.');
  return json(200, { ok: true, game: rows[0] });
});
