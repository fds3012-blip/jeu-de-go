# Rappel quotidien du Go du jour (issue #36)

Écart n° 1 de la veille du 29/09 : rien ne fait revenir un joueur qui n'ouvre pas l'app. Le rappel est une notification web (Web Push, clés VAPID), une par jour au plus, réservée aux joueurs avec un compte (#343).

**Tout est dans le dépôt, rien n'est déployé ni activé.** Aucune dépense : Web Push est gratuit, la fonction tourne 24 fois par jour (720 appels par mois, loin des 500 000 de l'offre gratuite de Supabase), pg_cron et pg_net sont inclus.

## Indicateurs qu'il doit faire bouger

| Indicateur | Lecture | Cible |
|---|---|---|
| **Rétention J7** (charte : 25 %) | Cohorte `rappel_accepte` contre les autres joueurs avec compte, même semaine d'inscription | +5 points chez les joueurs avec rappel |
| Rétention J1 (charte : 45 %) | Effet indirect : le rappel part dès le lendemain de l'acceptation | À surveiller |
| Taux d'acceptation | `rappel_accepte` / `rappel_propose` | 40 % |
| Taux d'ouverture | `rappel_ouvert` / `envoyes` (réponse de `envoyer-rappels`, journaux Supabase) | 10 % |
| Go du jour réussi après un rappel | `go_du_jour_resolu` dans la session qui suit `rappel_ouvert` | 70 % des ouvertures |
| Garde-fou | Part des refus par le navigateur (`rappel_refuse.raison = navigateur`) | Sous la moitié des refus ; sinon revoir le texte de la carte |

Entonnoir PostHog à créer : `premiere_partie_terminee` → `rappel_propose` → `rappel_accepte` → `rappel_ouvert` → `go_du_jour_resolu`.

## Ce que voit le joueur

- **Quand** : à la fin de sa première partie terminée **avec un compte**, une seule fois, sous « Rejouer » (l'action principale reste « Rejouer »). Jamais sur l'écran où la carte d'installation est déjà montrée, jamais pendant une partie. La carte attend son tour après l'XP et le niveau.
- **Texte** : « Un rappel pour le Go du jour ? Une notification par jour, à l'heure que tu choisis. Jamais la nuit. Tu la coupes quand tu veux dans le Profil. » Trois choix : Matin 9 h, Midi, Soir 18 h (soir par défaut). « Me le rappeler » ou « Non merci ».
- **Permission du navigateur** : demandée seulement au toucher de « Me le rappeler ». Refusée : message qui explique comment l'autoriser. « Non merci » et un refus du navigateur sont **définitifs** pour la proposition.
- **Profil** : ligne « Rappel du Go du jour » (valeur : le moment, ou « Coupé »), visible dès que la clé publique VAPID est configurée. Interrupteur et moment. Sans compte : « réservé aux joueurs avec un compte » et « Mon compte ». iPhone ou iPad dans Safari : explication (l'app doit être installée sur l'écran d'accueil, iOS 16.4 et plus) et « Installer l'app ». Navigateur sans notification ou notifications bloquées : explication.
- **La notification** : un titre et une phrase calmes, qui changent chaque jour (4 textes, français ou anglais). Toucher ouvre le Go du jour du jour (`/?rappel=1`) et envoie `rappel_ouvert`. Le rappel du jour remplace celui de la veille (même étiquette).

## Règles de sécurité et de respect (public avec enfants)

- **Un par jour au plus** : `reclamer_rappels` choisit les rappels dus et les marque envoyés dans la même requête ; un second passage dans la même heure ne renvoie rien.
- **Jamais la nuit** : trois moments seulement (9 h, 12 h, 18 h à l'heure du joueur), rattrapage d'une heure si la tâche a manqué un passage, garde « entre 8 h et 20 h » dans la base, et un rappel non délivré dans l'heure est abandonné (TTL 3600 s).
- **Rien à rappeler, rien d'envoyé** : pas de rappel un jour où le joueur a déjà réussi un problème (`profiles.streak_last`).
- **Sans fausse urgence** : ni « vite », ni « dernière chance », ni « tu vas perdre ta série », ni point d'exclamation, ni flamme (test Vitest `src/data/envoyerRappels.test.ts`).
- **Données** : table `abonnements_rappel`, RLS (chacun ne voit, ne modifie et ne supprime que les siens ; anonymes et visiteurs refusés), inscription par `enregistrer_abonnement_rappel`, 20 appareils au plus par compte, suppression en cascade avec le compte. Un abonnement que le service de notification dit disparu (404 ou 410) est supprimé. Politique de confidentialité à jour (sections 3.1, 3.2, 3.3, 4 et 5).
- **Secrets** : la clé privée VAPID et le secret de la tâche ne sont que dans les secrets de la fonction et dans Vault. Côté app, seule la clé **publique** (`VITE_VAPID_PUBLIC_KEY`).

## Fichiers

| Fichier | Rôle |
|---|---|
| `supabase/migrations/20260930120100_abonnements_rappel.sql` | Table, RLS, `enregistrer_abonnement_rappel`, `reclamer_rappels` (clé service seulement) |
| `supabase/tests/abonnements_rappel.test.sql` | Tests SQL (`bash supabase/tests/lancer.sh`) |
| `supabase/functions/envoyer-rappels/index.ts`, `logique.ts` | Fonction serveur : envoi chiffré (web-push), suppression des 404/410 |
| `supabase/planification/envoyer-rappels.sql` | Tâche pg_cron + pg_net, créée **désactivée** ; hors des migrations |
| `src/app/rappel.ts`, `src/ui/ProposerRappel.tsx`, `src/ui/rappel.css` | Logique et écrans côté app |
| `public/sw.js` | Affiche la notification (`push`) et ouvre le Go du jour (`notificationclick`) |
| `e2e/rappel.spec.ts` | Parcours Playwright, Notification API et PushManager simulés |

## Étapes pour Florian (dans l'ordre)

Rien de payant. Chaque étape se défait (voir « Tout arrêter »).

1. **Créer la paire de clés VAPID**, sur ton ordinateur (rien n'est envoyé) :
   ```sh
   npx web-push generate-vapid-keys --json
   ```
   Garde les deux valeurs dans ton gestionnaire de mots de passe. **Ne les colle jamais dans le dépôt.**
2. **Créer le secret de la tâche** (48 caractères) :
   ```sh
   openssl rand -base64 48 | tr -d '=+/' | cut -c1-48
   ```
3. **Secrets de la fonction** (tableau de bord Supabase, Edge Functions > Secrets, ou la CLI) :
   ```sh
   supabase secrets set --project-ref xjvsalkvpgcjrznznxoi \
     VAPID_CLE_PUBLIQUE=<publicKey> VAPID_CLE_PRIVEE=<privateKey> \
     VAPID_SUJET=mailto:<adresse de contact> RAPPELS_SECRET=<secret de l'étape 2>
   ```
   `VAPID_SUJET` est exigé par Apple et Google pour te joindre en cas de problème ; une adresse de contact du projet suffit.
4. **Appliquer la migration** `20260930120100_abonnements_rappel` (après relecture de la PR) : `supabase db push`, ou l'outil MCP `apply_migration` avec le même SQL. Puis `get_advisors` (sécurité) : aucune alerte nouvelle attendue.
5. **Déployer la fonction** sans vérification du JWT (l'accès est contrôlé par `RAPPELS_SECRET`) :
   ```sh
   supabase functions deploy envoyer-rappels --project-ref xjvsalkvpgcjrznznxoi --no-verify-jwt
   ```
   Essai à la main (aucun rappel dû hors des heures : réponse `{"ok":true,"dus":0,…}`) :
   ```sh
   curl -s -X POST https://xjvsalkvpgcjrznznxoi.supabase.co/functions/v1/envoyer-rappels -H "Authorization: Bearer <RAPPELS_SECRET>"
   ```
   Sans le secret : `401`.
6. **Planifier, désactivé** : dans l'éditeur SQL de Supabase, créer les deux secrets Vault (commandes en tête de `supabase/planification/envoyer-rappels.sql`), puis exécuter ce fichier. La tâche `envoyer-rappels` existe, en pause.
7. **Côté app** : ajouter `VITE_VAPID_PUBLIC_KEY=<publicKey>` dans Vercel (Production et Preview, type « Config »), redéployer. La ligne « Rappel du Go du jour » apparaît dans le Profil ; la proposition de fin de partie aussi.
8. **Essai réel** avant d'activer :
   - Android, Chrome : compte connecté, Profil > Rappel du Go du jour > allumer, moment « Midi ». Dans l'éditeur SQL : `update abonnements_rappel set dernier_envoi = null;` puis, pendant l'heure du moment, appeler la fonction (étape 5). La notification arrive ; la toucher ouvre le Go du jour.
   - iPhone (iOS 16.4 ou plus) : installer l'app depuis Safari (Partager > Sur l'écran d'accueil), l'ouvrir depuis l'écran d'accueil, allumer le rappel, même essai.
   - PostHog : `rappel_accepte` puis `rappel_ouvert` arrivent.
9. **Activer** : `select cron.alter_job((select jobid from cron.job where jobname = 'envoyer-rappels'), active := true);` Suivi : requêtes en bas de `supabase/planification/envoyer-rappels.sql`.

### Tout arrêter

- Plus d'envoi : `select cron.alter_job(…, active := false);` (ou `cron.unschedule('envoyer-rappels')`).
- Plus de proposition ni de ligne dans le Profil : retirer `VITE_VAPID_PUBLIC_KEY` de Vercel et redéployer.
- Nouvelle paire de clés : les anciens abonnements ne marchent plus ; vider `abonnements_rappel`, les joueurs rallument le rappel depuis le Profil.

## Pas encore fait (issues à ouvrir)

- **Capacitor** (App Store, Google Play) : notifications natives (APNs, FCM) à brancher sur la même table, colonne `canal` à ajouter.
- **Arrêt automatique** après 14 rappels sans ouverture, annoncé une fois, gentiment (observé chez Duolingo ; à garder, sans la culpabilité).
- **Texte choisi par bandit** (Yancey et Settles, KDD 2020 : +2 % de rétention des nouveaux) : il faudrait savoir quel texte a été ouvert (`texte` en propriété de `rappel_ouvert`).
- **Proposer le rappel au bon moment** : la veille du 29/09 suggérait « après la 2e journée de série ». Ici : première partie terminée avec un compte (brief du 30/09). Test A/B possible sur `rappel_accepte` et J7.
