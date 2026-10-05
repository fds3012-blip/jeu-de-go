# Partie en direct contre un humain (issue #360)

Jouer maintenant contre quelqu'un de son niveau : file d'attente, appariement par la cote, pendule tenue par le serveur, partie classée qui fait bouger la cote Glicko-2 (#417, `docs/game-design/cote.md`).

## Parcours

1. Accueil → « Jouer en ligne », l'action principale dès le début (#432 ; tuile « En ligne » au tout premier lancement, hors ligne, et absente sans comptes configurés). Sans compte ou sans pseudo : « Crée ton compte » (raison `en_ligne`), puis l'écran s'ouvre de lui-même.

   Règle de l'action principale (`src/app/modes.ts`) : la partie en ligne classée, sauf hors ligne, sans Supabase, ou au tout premier lancement (aucune partie, aucune leçon), qui garde son propre écran « Joue ta première partie » contre Pomme. Avant #432, il fallait avoir battu Pomme et fini les 3 premières leçons (#429). « Contre l'ordi » est une tuile pour tous, avec l'adversaire en cours.
2. Choix (#440 : en tête, la bascule « En direct » / « Partie lente », mémorisée ; voir `docs/game-design/partie-lente.md`) : taille (9 × 9, 13 × 13, 19 × 19), temps de jeu, comptage. Une action : « Trouver un adversaire ». Depuis #436, l'écran part toujours de la file par défaut (9 × 9, normal, japonais), quelle que soit la taille réglée pour l'ordi.
3. Attente : Mochi dit « Je cherche quelqu'un de ton niveau… », le temps d'attente défile. Une action : « Annuler ».
   Au bout de 25 s (#436) : « Personne de ton niveau pour l'instant. Joue contre Caillou en attendant : je te préviens si quelqu'un arrive. » L'IA est celle de l'échelle dont le rang est le plus proche de la cote du joueur (3000 − 100 × kyu ; sans cote, 800). Action principale « Jouer contre Caillou », lien « Continuer d'attendre ». Voir « Repli contre l'IA » plus bas.
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

`find_match(taille, cadence, comptage)` (forme de #436, `supabase/migrations/20261005090100_file_jamais_vide.sql`) :

- partie en direct déjà en cours : elle est rendue (une seule à la fois) ;
- file par défaut : 9 × 9, normal, japonais (valeurs par défaut de l'écran et de la fonction). Avant #436, l'appariement était coupé en 18 files (taille × temps × comptage) et la file restait vide ;
- même taille, même temps, même comptage : appariés tout de suite. Dès que l'un des deux attend depuis 30 s (la plus longue des deux attentes), les réglages peuvent différer : la partie prend la taille, le temps et le comptage de celui qui attendait depuis le plus longtemps. L'écran le dit avant le premier coup (« Ton adversaire attendait avant toi : la partie se joue en 13 × 13, 5 min + 3 × 20 s. ») ;
- la cote, inchangée : écart accepté = 100 + √(RD₁² + RD₂²) / 2 + 10 points par seconde d'attente (la plus longue des deux). Le plus proche en cote d'abord, puis les mêmes réglages, puis le plus ancien dans la file ;
- trouvé : partie classée (komi 6,5, handicap 0), couleurs tirées au sort, pendules pleines, celle de Noir part ;
- pas trouvé : le joueur entre dans la file. Il rappelle `find_match` toutes les 2,5 s : il garde sa place et son ancienneté, et retrouve la partie dès qu'un adversaire l'a créée.

Une attente sans nouvelles depuis 30 s (écran fermé) ou de plus de 10 minutes est retirée de la file. « Annuler » appelle `quitter_file_attente`, qui rend la partie si un adversaire vient de la créer : l'écran l'ouvre au lieu d'annuler.

## Repli contre l'IA (#436)

- Proposé une fois par attente, au bout de 25 s, en ligne. Honnête : l'IA garde son nom et son portrait de l'échelle, « Caillou est une IA. Cette partie n'est pas classée. » Jamais d'IA déguisée en humain, pas de compteur de joueurs en ligne.
- Accepté : la partie contre l'IA s'ouvre (taille de la file), et le joueur **reste dans la file**. Une bande au-dessus de la partie (`src/app/VeilleFile.tsx`) rappelle `find_match` toutes les 2,5 s (présence `vu_le`) : « Je cherche toujours un joueur pour toi. », lien « Ne plus chercher ».
- Un humain arrive (la partie classée est créée comme d'habitude) : la bande devient « Un joueur est prêt ! », avec « Rejoindre » (action principale) et « Rester ». Non bloquant : la partie contre l'IA continue dessous.
  - « Rejoindre » : la partie en direct s'ouvre, la partie contre l'IA est quittée.
  - « Rester », ou quitter la partie contre l'IA sans répondre : `refuser_partie_direct` annule la partie en direct (statut `aborted`, aucune cote ne bouge), tant que le joueur n'y a pas joué, et le sort de la file. L'adversaire voit « Partie annulée : personne n'a vraiment joué. Ta cote ne bouge pas. » et peut « Rejouer ». Sans réponse ni départ (onglet en veille), la règle d'absence de 60 s l'annule de même.
- La partie contre l'IA n'est jamais classée (#417) ; elle compte pour l'échelle comme toute partie contre l'ordi.

## Comptage

Japonais par défaut, chinois en option au moment du choix. Deux joueurs aux comptages différents ne sont appariés qu'après 30 s d'attente (comptage de qui attendait le plus).

## Sécurité

- Compte avec pseudo exigé (`exiger_compte_avec_pseudo`, JGC01 et JGP01).
- Table `parties_direct` (pendule) : RLS, lecture par les deux joueurs, aucune écriture directe ; publiée en temps réel.
- Fonctions `security definer` à `search_path` vide ; `cadence_direct`, `pendule_apres`, `direct_constater`, `direct_en_cours` et le déclencheur sont fermés à l'app.
- `refuser_partie_direct` (#436) : un des deux joueurs seulement, avant d'avoir joué ; fermée à anon.
- Tests : `supabase/tests/partie_en_direct.test.sql`, `supabase/tests/file_jamais_vide.test.sql`, `src/app/fileJamaisVide.test.tsx`, `e2e/file-jamais-vide.spec.ts`, `src/go/pendule.test.ts`, `src/app/direct.test.ts`, `src/data/migrationDirect.test.ts`, `e2e/partie-en-direct.spec.ts` (deux téléphones).

## Mesure

`partie_en_ligne_commencee` (`taille`, `cadence`, `regles`, `attente_s` : délai d'appariement, pour la médiane) et `partie_en_ligne_terminee` (`taille`, `cadence`, `issue`, `raison`, `coups`). Jamais la partie ni l'adversaire. #436 : `file_repli_ia` (`accepte` : partie contre l'IA lancée, ou « Continuer d'attendre » / « Annuler » pendant la proposition), une fois par attente. Une partie rejointe depuis le repli envoie aussi `partie_en_ligne_commencee` (avec `attente_s`).

## Limites connues

- Sans tâche planifiée, une partie dont les deux joueurs sont partis reste « en cours » jusqu'au retour de l'un d'eux (son premier appel constate l'absence de l'autre).
- Pas de spectateurs ni de discussion pour l'instant.
