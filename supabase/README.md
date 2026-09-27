# Base de données Supabase

Projet `jeu-de-go` (réf. `xjvsalkvpgcjrznznxoi`, région Paris, plan gratuit).

Les migrations de ce dossier sont celles déjà appliquées en production, dans l'ordre. Toute modification passe par une nouvelle migration, jamais par une modification d'un fichier existant.

| Migration | Contenu |
|---|---|
| profils_joueurs | Profils créés à l'inscription, cotes modifiables uniquement côté serveur |
| parties_et_coups | Parties, historique des cotes, fonctions `join_game`, `play_move`, `resign_game`, temps réel |
| correction_passe_tt | Autorise la passe `tt` dans le format des coups |
| amis_et_recherche_adversaire | Amis, file d'attente, fonction `find_match` |
| progression_problemes_lecons_badges | Problèmes, essais et `record_puzzle_attempt`, leçons, badges, vue `leaderboard`, 6 problèmes de base |

Tests réalisés à la création (comptes fictifs supprimés ensuite) : rejoindre par code, coup hors tour refusé, coup hors plateau refusé, partie trouvée puis abandon avec mise à jour des cotes, problème résolu avec mise à jour de la cote et de la série, modification de sa propre cote refusée, isolation des données entre joueurs.

À faire : validation complète des coups (captures, ko) dans une fonction serveur, fin de partie aux points avec accord des deux joueurs.
