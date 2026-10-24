# Notifications poussées : ce qu'il reste à poser (issue #699)

Deux notifications, **gratuites** (Web Push), **éteintes par défaut** : chaque joueur les allume lui-même dans Profil > Rappels.

- **Rappel du Go du jour** : une par jour au plus, à l'heure choisie (18 h par défaut), jamais la nuit. Détail : `docs/growth/rappel-quotidien.md`.
- **À toi de jouer** : quand l'adversaire a joué dans une **partie lente classée**. Une par partie et par heure, trois par jour au plus, de 8 h à 20 h à l'heure de l'appareil, jamais pour un tour déjà vu dans l'appli, jamais pour un défi entre amis.

Rien ne part tant que les clés ne sont pas posées : le code se dégrade sans elles (la ligne Rappels n'apparaît pas dans le Profil, la fonction refuse de s'exécuter, la tâche est en pause).

## Florian : 3 gestes

1. **Créer et ranger les clés** (sur ton ordinateur, rien n'est envoyé ; je ne les génère pas pour toi). Dans un terminal : `npx web-push generate-vapid-keys --json`, puis `openssl rand -base64 48 | tr -d '=+/' | cut -c1-48` pour le secret de la tâche. Garde les trois valeurs dans ton gestionnaire de mots de passe, **jamais dans le dépôt**.
2. **Les poser** : dans Supabase (Edge Functions > Secrets, projet `xjvsalkvpgcjrznznxoi`) : `VAPID_CLE_PUBLIQUE`, `VAPID_CLE_PRIVEE`, `VAPID_SUJET` (`mailto:` + une adresse de contact du projet), `RAPPELS_SECRET`. Dans Vercel (Production et Preview) : `VITE_VAPID_PUBLIC_KEY` = la clé **publique** seulement. Ensuite, redéployer.
3. **Appliquer et activer** (après relecture de la PR) : appliquer la migration `20261025090000_notification_a_toi_de_jouer` (avec `20261001000100_abonnements_rappel`, **jamais appliquée en production à ce jour**) ; déployer la fonction `envoyer-rappels` ; créer la tâche planifiée avec `supabase/planification/envoyer-rappels.sql` (elle naît en pause) ; essai réel ; puis activer la tâche.

Les étapes détaillées, dans l'ordre, sont ci-dessous. Chacune se défait.

## Détail, dans l'ordre

| # | Étape | Qui | Commande ou lieu |
|---|---|---|---|
| 1 | Clés VAPID | Florian | `npx web-push generate-vapid-keys --json` |
| 2 | Secret de la tâche | Florian | `openssl rand -base64 48 \| tr -d '=+/' \| cut -c1-48` |
| 3 | Secrets de la fonction | Florian | Supabase > Edge Functions > Secrets, ou `supabase secrets set --project-ref xjvsalkvpgcjrznznxoi VAPID_CLE_PUBLIQUE=… VAPID_CLE_PRIVEE=… VAPID_SUJET=mailto:… RAPPELS_SECRET=…` |
| 4 | Variable côté app | Florian | Vercel > Settings > Environment Variables : `VITE_VAPID_PUBLIC_KEY` (Production et Preview), puis redéployer |
| 5 | Migrations | Florian (après relecture) | `supabase db push`, ou l'outil MCP `apply_migration`. Puis `get_advisors` (sécurité) : aucune alerte nouvelle attendue |
| 6 | Fonction | automatique ou Florian | Le workflow `deployer-fonctions` la déploie sur `main` si `SUPABASE_ACCESS_TOKEN` est un secret GitHub (`docs/architecture/deploiement-fonctions.md`) ; sinon `supabase functions deploy envoyer-rappels --project-ref xjvsalkvpgcjrznznxoi --no-verify-jwt` |
| 7 | Tâche planifiée, en pause | Florian | Éditeur SQL : les deux secrets Vault (en tête de `supabase/planification/envoyer-rappels.sql`), puis ce fichier |
| 8 | Essai réel | Florian | voir ci-dessous |
| 9 | Activer | Florian | `select cron.alter_job((select jobid from cron.job where jobname = 'envoyer-rappels'), active := true);` |

La même fonction et la même tâche (toutes les heures, à la 5e minute) envoient les deux familles de notifications : il n'y a rien de plus à planifier pour « À toi de jouer ».

### Essai réel avant d'activer

1. **Fonction vivante** : `curl -s -X POST https://xjvsalkvpgcjrznznxoi.supabase.co/functions/v1/envoyer-rappels -H "Authorization: Bearer <RAPPELS_SECRET>"`. Réponse attendue hors des heures dues : `{"ok":true,"dus":0,"envoyes":0,"supprimes":0,"echecs":0,"tours":{"dus":0,…}}`. Sans le secret : `401`. Sans clés posées : `500` `configuration`.
2. **Rappel du jour** : Android, Chrome, compte connecté : Profil > Rappels > « Un rappel chaque jour ». Dans l'éditeur SQL : `update abonnements_rappel set dernier_envoi = null;` puis, pendant l'heure du moment choisi, appeler la fonction.
3. **À toi de jouer** : Profil > Rappels > « À toi de jouer » (la permission du navigateur est demandée à ce geste). Avec un second compte, jouer un coup dans une partie lente contre toi, entre 8 h et 20 h. La notification arrive à la prochaine exécution de la tâche (au plus une heure) ; pour l'avoir tout de suite, appeler la fonction à la main (étape 1). Toucher la notification ouvre la partie.
4. **iPhone** (iOS 16.4 ou plus) : installer l'appli depuis Safari (Partager > Sur l'écran d'accueil), l'ouvrir depuis l'écran d'accueil, puis mêmes essais.
5. **PostHog** : `tours_active`, `notification_ouverte` (`source` = `push`) arrivent.

### Tout arrêter

- Plus aucun envoi : `select cron.alter_job((select jobid from cron.job where jobname = 'envoyer-rappels'), active := false);`.
- Plus de réglage visible dans le Profil : retirer `VITE_VAPID_PUBLIC_KEY` de Vercel et redéployer.
- Un joueur coupe tout en un geste : Profil > Rappels, les deux interrupteurs (l'abonnement est supprimé du serveur et du navigateur quand les deux sont coupés).
- Nouvelle paire de clés : les anciens abonnements ne marchent plus ; les joueurs rallument les réglages (aucune donnée supprimée en production par ce document).

## Ce qui est décidé dans le code

| Règle | Où elle est appliquée |
|---|---|
| Éteint par défaut, permission demandée au geste seulement | `src/app/rappel.ts`, `src/ui/ProposerRappel.tsx` ; colonne `tour` à `false` par défaut |
| Jamais la nuit (8 h à 20 h, heure de l'appareil) | `reclamer_rappels`, `reclamer_tours` (base) |
| Une par partie et par heure ; trois par 24 h | `reclamer_tours` |
| Pas de tour déjà vu, pas de tour plus vieux que 3 jours, pas de tour antérieur à l'activation | `reclamer_tours` |
| Aucune donnée personnelle dans le texte | `chargeTour` : ni pseudo, ni adversaire, ni délai, ni compte à rebours (test Vitest) |
| Liste blanche des services de notification (SSRF) | `endpointAutorise` et contrainte de base (#578) |
| Désinscription en un geste | deux interrupteurs, abonnement supprimé quand les deux sont coupés ; un abonnement dit disparu (404, 410) est supprimé à l'envoi |
| Mineurs : aucun ciblage | mêmes règles pour tous, aucune donnée d'âge lue ; textes sobres |
| Dégradation sans clé | pas de ligne dans le Profil, fonction en `500 configuration`, tâche en pause |

## Limites connues

- Les textes partent dans la langue de l'interface au moment où le joueur a allumé le réglage ; changer de langue ensuite ne met pas l'abonnement à jour avant le prochain changement de réglage.
- Une poussée perdue (appareil éteint plus d'une heure : TTL de 3 600 s, par choix, pour ne pas notifier la nuit) n'est pas renvoyée : le tour reste visible dans l'appli (point d'or, « À toi de jouer (N) »).
- Les défis entre amis (non classés) ne sont pas poussés : seulement les parties lentes classées. À étendre sur décision.
- Les réglages sont par appareil, non synchronisés entre les appareils d'un compte (une permission de navigateur est par appareil).
- L'export de données (`exporter_mes_donnees`) liste le moment, le fuseau et la langue de chaque appareil ; il ne dit pas encore lequel des deux réglages est allumé.
