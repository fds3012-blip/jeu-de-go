# Base de données Supabase

Projet `jeu-de-go` (réf. `xjvsalkvpgcjrznznxoi`, région Paris, plan gratuit).

Le dossier `migrations/` contient toutes les migrations appliquées en production, une par fichier `<version>_<nom>.sql`. Les cinq premières ont été rapatriées depuis `supabase_migrations.schema_migrations` (contenu identique, vérifié par empreinte md5). Toute modification passe par une nouvelle migration, jamais par la modification d'un fichier existant, et chaque table garde RLS activé.

| Migration | Contenu |
|---|---|
| `20260926235151_profils_joueurs` | Profils créés à l'inscription, cotes modifiables uniquement côté serveur |
| `20260926235220_parties_et_coups` | Parties, historique des cotes, fonctions `join_game`, `play_move`, `resign_game`, temps réel |
| `20260926235230_correction_passe_tt` | Autorise la passe `tt` dans le format des coups |
| `20260926235244_amis_et_recherche_adversaire` | Amis, file d'attente, fonction `find_match` |
| `20260926235308_progression_problemes_lecons_badges` | Problèmes, essais et `record_puzzle_attempt`, leçons, badges, vue `leaderboard`, 6 problèmes de base |
| `20260927003136_pseudo_unique_sans_casse` | Pseudo unique sans tenir compte des majuscules (index sur `lower(username)`) |
| `20260927073943_validation_serveur_et_comptage` | Colonnes du comptage (`counting`, `dead_stones`, `dead_proposed_by`, `resumed_at`, `score_black`, `score_white`), garde à la création d'une partie, `apply_game_rating` (cotes communes), `finish_game_by_score` (serveur seulement), `play_move` retirée des clients |

## Appliquer une migration

Sans CLI liée, on passe par les outils MCP Supabase : `apply_migration` (le nom en snake_case devient le suffixe de la version), puis on écrit le même SQL dans `migrations/<version>_<nom>.sql` avec la version renvoyée par `list_migrations`. Après chaque changement de schéma : `get_advisors` (sécurité) et régénération des types (`generate_typescript_types` vers `src/data/database.types.ts`).

Avec la CLI : `supabase link --project-ref xjvsalkvpgcjrznznxoi`, puis `supabase db push` et `supabase gen types typescript --linked > src/data/database.types.ts`.

## Alertes de sécurité connues

`get_advisors` signale 4 avertissements « SECURITY DEFINER exécutable par authenticated » pour `find_match`, `join_game`, `record_puzzle_attempt` et `resign_game`. C'est voulu : ce sont les fonctions serveur appelées par l'application, qui vérifient elles-mêmes `auth.uid()`. (`play_move` n'est plus exécutable par les clients depuis l'issue #9.) Côté performance, l'index `games_dead_proposed_by_idx` est signalé « inutilisé » tant qu'aucune partie n'a été comptée : il couvre la clé étrangère, on le garde.

## Authentification

Connexion par lien e-mail (magic link). À régler dans le tableau de bord Supabase, Authentication > URL Configuration : `Site URL` (l'adresse Vercel de production) et `Redirect URLs` (production, `https://*-<équipe>.vercel.app/**` pour les aperçus, `http://localhost:5173`).

## Tests réalisés à la création

Comptes fictifs supprimés ensuite : rejoindre par code, coup hors tour refusé, coup hors plateau refusé, partie trouvée puis abandon avec mise à jour des cotes, problème résolu avec mise à jour de la cote et de la série, modification de sa propre cote refusée, isolation des données entre joueurs.

## Parties en ligne : fonction serveur `game-action` (issue #9)

Les parties entre humains ne s'écrivent plus depuis le client. Toutes les actions passent par l'Edge Function `game-action` (`supabase/functions/game-action/index.ts`, JWT exigé), appelée depuis `src/data/games.ts` (`playMove`, `proposeDeadStones`, `acceptScore`, `resumeGame`). L'abandon reste la RPC `resign_game`.

- **Coup** `{ action: 'move', gameId, move }` : la fonction rejoue toute la partie avec les règles de `src/go` (pierres de handicap, captures, suicide, ko ; superko positionnel en règles chinoises) et refuse tout coup illégal (422) ou hors tour (409). L'écriture est conditionnelle (`moves` inchangé depuis la lecture), sinon 409.
- **Comptage** : deux passes de suite (depuis la dernière reprise) mettent `counting = true` et bloquent les coups. Un joueur propose les pierres mortes `{ action: 'propose_dead', dead: 'aabb…' }` (groupes entiers, SGF concaténé) ; l'autre accepte `{ action: 'accept' }` ou reprend `{ action: 'resume' }`. Une nouvelle proposition remplace la précédente et c'est alors à l'autre joueur d'accepter.
- **Fin** : à l'acceptation, le score est calculé par `src/go/score.ts` (komi et règles de la partie) puis `finish_game_by_score` (exécutable seulement par `service_role`) vérifie sous verrou que rien n'a changé, termine la partie et met à jour les cotes si elle est classée (même Elo que l'abandon, via `apply_game_rating`). Égalité (`0`) : pas de changement de cote.

La clé service n'existe que dans l'environnement de la fonction (`SUPABASE_SERVICE_ROLE_KEY`, fournie par Supabase) : jamais dans le dépôt ni côté client.

### Code partagé avec Deno

La logique pure est dans `src/go/server.ts` (`validateMove`, `finalScore`, `planAction`…), testée par Vitest. Deno exige l'extension `.ts` dans les imports : `npm run sync:functions` copie `src/go/{coords,rules,score,sgf,replay,server}.ts` dans `supabase/functions/game-action/go/` en ajoutant les extensions. Un test échoue si la copie n'est pas à jour.

Déploiement : avec la CLI, `supabase functions deploy game-action` ; avec l'outil MCP `deploy_edge_function`, envoyer `index.ts` et les fichiers `go/*.ts` (`verify_jwt: true`).

### Essais

En production (dans une transaction annulée, aucune donnée conservée) : `play_move` et `finish_game_by_score` refusés (42501) pour `authenticated` ; écriture directe d'une partie entre humains sans effet (0 ligne) ; partie créée par un client toujours vierge ; acceptation de sa propre proposition et coups périmés refusés ; acceptation par l'autre joueur : `W+7.5`, scores enregistrés, cotes 800 → 816 / 784 et deux lignes d'historique ; abandon pendant un comptage toujours correct.

Essai HTTP de bout en bout (à refaire depuis un poste qui peut joindre `*.supabase.co`) avec deux comptes de test dans une partie active :

```sh
URL=https://xjvsalkvpgcjrznznxoi.supabase.co
KEY=<clé publishable>   # celle de .env.example
TOKEN=<access_token du joueur au trait>   # par ex. supabase.auth.getSession() dans la console du navigateur
# Coup illégal (intersection occupée) : 422 { error: 'occupe' }
curl -s -X POST "$URL/functions/v1/game-action" -H "apikey: $KEY" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"action":"move","gameId":"<id>","move":"<coup déjà joué>"}'
# Ancienne voie directe : refusée (permission denied for function play_move)
curl -s -X POST "$URL/rest/v1/rpc/play_move" -H "apikey: $KEY" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"p_game":"<id>","p_move":"aa"}'
```
