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

## Appliquer une migration

Sans CLI liée, on passe par les outils MCP Supabase : `apply_migration` (le nom en snake_case devient le suffixe de la version), puis on écrit le même SQL dans `migrations/<version>_<nom>.sql` avec la version renvoyée par `list_migrations`. Après chaque changement de schéma : `get_advisors` (sécurité) et régénération des types (`generate_typescript_types` vers `src/data/database.types.ts`).

Avec la CLI : `supabase link --project-ref xjvsalkvpgcjrznznxoi`, puis `supabase db push` et `supabase gen types typescript --linked > src/data/database.types.ts`.

## Alertes de sécurité connues

`get_advisors` signale 5 avertissements « SECURITY DEFINER exécutable par authenticated » pour `find_match`, `join_game`, `play_move`, `record_puzzle_attempt` et `resign_game`. C'est voulu : ce sont les fonctions serveur appelées par l'application, qui vérifient elles-mêmes `auth.uid()`.

## Authentification

Connexion par lien e-mail (magic link). À régler dans le tableau de bord Supabase, Authentication > URL Configuration : `Site URL` (l'adresse Vercel de production) et `Redirect URLs` (production, `https://*-<équipe>.vercel.app/**` pour les aperçus, `http://localhost:5173`).

## Tests réalisés à la création

Comptes fictifs supprimés ensuite : rejoindre par code, coup hors tour refusé, coup hors plateau refusé, partie trouvée puis abandon avec mise à jour des cotes, problème résolu avec mise à jour de la cote et de la série, modification de sa propre cote refusée, isolation des données entre joueurs.

## À faire

Validation complète des coups (captures, ko) dans une fonction serveur, fin de partie aux points avec accord des deux joueurs.
