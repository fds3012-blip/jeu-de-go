// Fonction serveur `envoyer-rappels` (issues #36 et #699) : envoie par notification web le rappel quotidien du Go du jour
// et « à toi de jouer » des parties lentes.
// Appelée chaque heure par pg_cron (supabase/planification/envoyer-rappels.sql), jamais par l'app.
// POST, en-tête `Authorization: Bearer <RAPPELS_SECRET>`. Réponse : { ok, dus, envoyes, supprimes, echecs, tours: { dus, envoyes, supprimes, echecs } }.
// Sans clés VAPID ni secret (rien posé par Florian) : refus 401 ou 500 « configuration », aucune notification, aucune ligne touchée.
//
// Variables d'environnement (secrets de la fonction, jamais dans le dépôt : docs/growth/rappel-quotidien.md) :
// - VAPID_CLE_PUBLIQUE, VAPID_CLE_PRIVEE : paire de clés VAPID (la publique est aussi VITE_VAPID_PUBLIC_KEY côté app) ;
// - VAPID_SUJET : contact exigé par les services de notification (`mailto:…` ou `https://…`) ;
// - RAPPELS_SECRET : jeton partagé avec la tâche planifiée (32 caractères au moins) ;
// - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY : fournies par Supabase.
// Déploiement sans vérification du JWT (`--no-verify-jwt`) : l'accès est contrôlé par RAPPELS_SECRET.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { autorise, envoyerRappels, envoyerTours, type Abonnement, type Bilan, type Deps, type DepsTours, type Tour } from './logique.ts';

/** Un message non délivré dans l'heure est abandonné : pas de notification tardive, le soir ou la nuit. */
const TTL_SECONDES = 3600;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'methode' });
  if (!autorise(req.headers.get('Authorization'), Deno.env.get('RAPPELS_SECRET'))) return json(401, { ok: false, error: 'acces' });

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const publique = Deno.env.get('VAPID_CLE_PUBLIQUE');
  const privee = Deno.env.get('VAPID_CLE_PRIVEE');
  const sujet = Deno.env.get('VAPID_SUJET');
  if (!url || !serviceKey || !publique || !privee || !sujet) return json(500, { ok: false, error: 'configuration' });

  webpush.setVapidDetails(sujet, publique, privee);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const envoyer = async (a: { endpoint: string; p256dh: string; auth: string }, charge: string, tag: string) => {
    try {
      const r = await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, charge,
        { TTL: TTL_SECONDES, urgency: 'normal', topic: tag });
      return { statut: r.statusCode };
    } catch (e) {
      return { statut: typeof (e as { statusCode?: unknown }).statusCode === 'number' ? (e as { statusCode: number }).statusCode : 0 };
    }
  };
  const supprimer = async (ids: string[]) => {
    const { error } = await admin.from('abonnements_rappel').delete().in('id', ids);
    if (error) throw new Error(error.message);
  };
  const rappels: Deps = {
    async reclamer() {
      const { data, error } = await admin.rpc('reclamer_rappels');
      if (error) throw new Error(error.message);
      return (data ?? []) as Abonnement[];
    },
    envoyer, supprimer,
  };
  const tours: DepsTours = {
    async reclamer() {
      const { data, error } = await admin.rpc('reclamer_tours');
      if (error) throw new Error(error.message);
      return (data ?? []) as Tour[];
    },
    envoyer, supprimer,
  };

  // Les deux envois sont indépendants : l'échec de l'un n'empêche pas l'autre.
  const essayer = async (nom: string, f: () => Promise<Bilan>): Promise<Bilan | null> => {
    try { return await f(); } catch (e) { console.error(`envoyer-rappels (${nom})`, e); return null; }
  };
  const bilanRappels = await essayer('rappels', () => envoyerRappels(rappels));
  const bilanTours = await essayer('tours', () => envoyerTours(tours));
  if (!bilanRappels && !bilanTours) return json(500, { ok: false, error: 'envoi' });
  return json(200, { ok: !!bilanRappels && !!bilanTours, ...(bilanRappels ?? { erreur_rappels: true }), tours: bilanTours ?? { erreur: true } });
});
