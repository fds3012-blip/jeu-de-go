-- Planification du rappel quotidien (issue #36) : pg_cron appelle la fonction serveur `envoyer-rappels` chaque heure,
-- à la 5e minute, par pg_net. Écrite, mais DÉSACTIVÉE : la tâche est créée puis mise en pause (`active := false`).
--
-- Ne pas placer dans supabase/migrations : ce fichier dépend de secrets propres au projet (Vault) et ne doit pas
-- s'appliquer tout seul. Florian le lance à la main dans l'éditeur SQL de Supabase, puis active la tâche quand tout est
-- prêt. Étapes complètes : docs/growth/rappel-quotidien.md.
--
-- Prérequis (une fois, dans l'éditeur SQL ; les valeurs ne sont jamais écrites dans le dépôt) :
--   select vault.create_secret('https://xjvsalkvpgcjrznznxoi.supabase.co/functions/v1/envoyer-rappels', 'rappels_url');
--   select vault.create_secret('<le même RAPPELS_SECRET que celui de la fonction>', 'rappels_secret');
--
-- La fonction ne fait rien de plus si elle est appelée deux fois dans l'heure : `reclamer_rappels` marque chaque rappel
-- envoyé au moment où il le choisit (un par jour au plus).

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'envoyer-rappels',
  '5 * * * *',
  $tache$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'rappels_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'rappels_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $tache$
);

-- Désactivée tant que Florian ne l'a pas activée (docs/growth/rappel-quotidien.md, étape 6) :
select cron.alter_job((select jobid from cron.job where jobname = 'envoyer-rappels'), active := false);

-- Activer :     select cron.alter_job((select jobid from cron.job where jobname = 'envoyer-rappels'), active := true);
-- Vérifier :    select jobid, jobname, schedule, active from cron.job where jobname = 'envoyer-rappels';
--               select status, return_message, start_time from cron.job_run_details
--                 where jobid = (select jobid from cron.job where jobname = 'envoyer-rappels') order by start_time desc limit 10;
-- Réponses :    select status_code, content from net._http_response order by created desc limit 10;
-- Retirer :     select cron.unschedule('envoyer-rappels');
