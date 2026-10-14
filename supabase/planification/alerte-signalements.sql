-- Planification de l'alerte à l'équipe (issue #531) : pg_cron appelle la fonction serveur `alerte-signalements` chaque
-- matin à 5 h 55 UTC (7 h 55 à Paris l'été, 6 h 55 l'hiver), par pg_net. Un e-mail seulement s'il y a du nouveau.
--
-- Ne pas placer dans supabase/migrations : ce fichier dépend de secrets propres au projet (Vault) et ne doit pas
-- s'appliquer tout seul. Florian le lance à la main dans l'éditeur SQL de Supabase, une fois la fonction déployée et
-- ses secrets posés. Étapes complètes : docs/architecture/securite.md, section « Alerte à l'équipe ».
--
-- Prérequis (une fois, dans l'éditeur SQL ; les valeurs ne sont jamais écrites dans le dépôt) :
--   select vault.create_secret('https://xjvsalkvpgcjrznznxoi.supabase.co/functions/v1/alerte-signalements', 'alerte_url');
--   select vault.create_secret('<le même ALERTE_SECRET que celui de la fonction>', 'alerte_secret');
--
-- Deux appels le même jour ne comptent pas deux fois les mêmes signalements : `reclamer_resume_signalements` part de
-- la fin du résumé précédent.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'alerte-signalements',
  '55 5 * * *',
  $tache$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'alerte_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'alerte_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $tache$
);

-- Vérifier :    select jobid, jobname, schedule, active from cron.job where jobname = 'alerte-signalements';
--               select status, return_message, start_time from cron.job_run_details
--                 where jobid = (select jobid from cron.job where jobname = 'alerte-signalements') order by start_time desc limit 10;
-- Réponses :    select status_code, content from net._http_response order by created desc limit 10;
-- Essayer tout de suite : la même requête net.http_post que ci-dessus, lancée seule.
-- Retirer :     select cron.unschedule('alerte-signalements');
