// Fonction serveur `alerte-signalements` (issue #531) : résumé quotidien des signalements, envoyé par e-mail à
// l'équipe par Resend. Appelée une fois par jour par pg_cron (supabase/planification/alerte-signalements.sql), jamais
// par l'app. POST, en-tête `Authorization: Bearer <ALERTE_SECRET>`. Réponse : { ok, rien, envoye, nouveaux }.
//
// Variables d'environnement (secrets de la fonction, jamais dans le dépôt : docs/architecture/securite.md) :
// - RESEND_API_KEY : clé d'API Resend (droit « Sending access » seulement) ;
// - ALERTE_EMAIL : adresse de l'équipe qui reçoit le résumé ;
// - ALERTE_EXPEDITEUR (facultatif) : « Mochi Go <jeu@mochi-go.app> » par défaut (domaine déjà vérifié chez Resend) ;
// - ALERTE_SECRET : jeton partagé avec la tâche planifiée (32 caractères au moins) ;
// - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY : fournies par Supabase.
// Déploiement sans vérification du JWT (fichier `.sans-jwt` lu par le workflow) : l'accès est contrôlé par ALERTE_SECRET.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { alerter, autorise, lienTableau, type Resume } from './logique.ts';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'methode' });
  if (!autorise(req.headers.get('Authorization'), Deno.env.get('ALERTE_SECRET'))) return json(401, { ok: false, error: 'acces' });

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const cle = Deno.env.get('RESEND_API_KEY');
  const destinataire = Deno.env.get('ALERTE_EMAIL');
  const expediteur = Deno.env.get('ALERTE_EXPEDITEUR') || 'Mochi Go <jeu@mochi-go.app>';
  if (!url || !serviceKey || !cle || !destinataire) return json(500, { ok: false, error: 'configuration' });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    const bilan = await alerter({
      async reclamer() {
        const { data, error } = await admin.rpc('reclamer_resume_signalements');
        if (error) throw new Error(error.message);
        return data as Resume;
      },
      async envoyer(e) {
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: expediteur, to: [destinataire], subject: e.sujet, text: e.texte, html: e.html }),
        });
        return { ok: r.ok, statut: r.status };
      },
    }, lienTableau(url));
    const ok = bilan.rien || bilan.envoye;
    return json(ok ? 200 : 502, { ok, ...bilan });
  } catch (e) {
    console.error('alerte-signalements', e);
    return json(500, { ok: false, error: 'resume' });
  }
});
