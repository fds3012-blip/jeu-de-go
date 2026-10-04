# Partie en direct contre un humain (issue #360)

Jouer maintenant contre quelqu'un de son niveau : file d'attente, appariement par la cote, pendule tenue par le serveur, partie classée qui fait bouger la cote Glicko-2 (#417, `docs/game-design/cote.md`).

## Parcours

1. Accueil → « Jouer en ligne », l'action principale dès le début (#432 ; tuile « En ligne » au tout premier lancement, hors ligne, et absente sans comptes configurés). Sans compte ou sans pseudo : « Crée ton compte » (raison `en_ligne`), puis l'écran s'ouvre de lui-même.

   Règle de l'action principale (`src/app/modes.ts`) : la partie en ligne classée, sauf hors ligne, sans Supabase, ou au tout premier lancement (aucune partie, aucune leçon), qui garde son propre écran « Joue ta première partie » contre Pomme. Avant #432, il fallait avoir battu Pomme et fini les 3 premières leçons (#429). « Contre l'ordi » est une tuile pour tous, avec l'adversaire en cours.
2. Choix : taille (9 × 9, 13 × 13, 19 × 19), temps de jeu, comptage. Une action : « Trouver un adversaire ».
3. Attente : Mochi dit « Je cherche quelqu'un de ton niveau… », le temps d'attente défile. Une action : « Annuler ».
4. Partie : pseudo, grade et cote de l'adversaire, pendule de chacun dans son bandeau.
5. Fin aux points (deux passes, pierres mortes proposées par un joueur, acceptées par l'autre), à l'abandon ou au temps.
6. Bilan : la phrase de fin, « +14 » et le grade (`GainCote`, #417). Action principale « Rejouer » (même taille, même temps, même comptage) ; « Revoir la partie » ouvre la revue.

Les parties contre l'IA ne sont jamais classées. Les défis entre amis restent amicaux. Seule la partie en direct entre humains est classée.

## Temps de jeu

| Choix | Temps principal | Byo-yomi |
|---|---|---|
| Rapide | 5 min | 3 × 20 s |
| Normal (par défaut) | 10 min | 3 × 30 s |
| Long | 20 min | 5 × 30 s |

Byo-yomi japonais : une fois le temps principal épuisé, chaque coup se joue dans une période. Jouer dans la période la garde entière pour le coup suivant ; la dépasser en coûte une. Dépasser la dernière fait perdre au temps. Pendant le comptage, la pendule est arrêtée ; elle repart à la reprise.

Calcul : `penduleApres` (`src/go/pendule.ts`) et `public.pendule_apres` (même calcul, mêmes cas testés des deux côtés). Tombée quand le temps écoulé sur le coup atteint le temps principal plus toutes les périodes restantes.

## Le serveur décide

- **Heure** : celle de la base (`now()`), jamais celle du client. Le client cale seulement son affichage sur l'heure du serveur renvoyée par `pendule_direct`.
- **Coup** : écrit par la fonction serveur `game-action` (inchangée), décompté par le déclencheur `games_direct_pendule`. Un coup arrivé après la chute n'est pas joué : la perte au temps est écrite à sa place.
- **Entre deux coups** : chaque joueur appelle `pendule_direct` toutes les 3 s quand c'est à l'adversaire, toutes les 10 s quand c'est à lui. C'est son signe de présence ; le serveur y constate la chute de la pendule et l'absence de l'adversaire. Quand une pendule affichée tombe, le client appelle aussitôt le serveur, qui tranche.
- **Cote** : `apply_game_rating` (#417), une seule fois par partie, appelée par la perte au temps, `resign_game` et `finish_game_by_score`.

## Déconnexion tolérée

- La pendule continue de tourner pendant une déconnexion : une coupure de 30 s ne fait pas perdre (sauf si la pendule tombe).
- Après 60 s sans signe de présence alors que c'est à lui d'agir (son coup, ou le comptage), le joueur perd au temps. C'est l'adversaire resté qui le constate, par `pendule_direct`.
- Avant que chacun ait joué un coup, la partie est annulée (`aborted`) au lieu d'être perdue : aucune cote ne bouge.
- L'écran dit « Léa n'est plus là. Encore 40 s pour revenir. » à partir de 15 s sans nouvelles, et « Tu es hors ligne. Ta pendule tourne : reviens vite. » quand le joueur perd le réseau.

## File d'attente et appariement

`find_match(taille, cadence, comptage)` :

- partie en direct déjà en cours : elle est rendue (une seule à la fois) ;
- sinon, même taille, même temps, même comptage, et la cote : écart accepté = 100 + √(RD₁² + RD₂²) / 2 + 10 points par seconde d'attente (la plus longue des deux). Le plus proche en cote d'abord, puis le plus ancien dans la file ;
- trouvé : partie classée (komi 6,5, handicap 0), couleurs tirées au sort, pendules pleines, celle de Noir part ;
- pas trouvé : le joueur entre dans la file. Il rappelle `find_match` toutes les 2,5 s : il garde sa place et son ancienneté, et retrouve la partie dès qu'un adversaire l'a créée.

Une attente sans nouvelles depuis 30 s (écran fermé) ou de plus de 10 minutes est retirée de la file. « Annuler » appelle `quitter_file_attente`, qui rend la partie si un adversaire vient de la créer : l'écran l'ouvre au lieu d'annuler.

## Comptage

Japonais par défaut, chinois en option au moment du choix. Deux joueurs ne sont appariés que s'ils ont choisi le même comptage.

## Sécurité

- Compte avec pseudo exigé (`exiger_compte_avec_pseudo`, JGC01 et JGP01).
- Table `parties_direct` (pendule) : RLS, lecture par les deux joueurs, aucune écriture directe ; publiée en temps réel.
- Fonctions `security definer` à `search_path` vide ; `cadence_direct`, `pendule_apres`, `direct_constater`, `direct_en_cours` et le déclencheur sont fermés à l'app.
- Tests : `supabase/tests/partie_en_direct.test.sql`, `src/go/pendule.test.ts`, `src/app/direct.test.ts`, `src/data/migrationDirect.test.ts`, `e2e/partie-en-direct.spec.ts` (deux téléphones).

## Mesure

`partie_en_ligne_commencee` (`taille`, `cadence`, `regles`, `attente_s` : délai d'appariement, pour la médiane) et `partie_en_ligne_terminee` (`taille`, `cadence`, `issue`, `raison`, `coups`). Jamais la partie ni l'adversaire.

## Limites connues

- Sans tâche planifiée, une partie dont les deux joueurs sont partis reste « en cours » jusqu'au retour de l'un d'eux (son premier appel constate l'absence de l'autre).
- Pas de spectateurs ni de discussion pour l'instant.
