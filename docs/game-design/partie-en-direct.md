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
- jamais avec un joueur qu'on a bloqué, ou qui nous a bloqué (#363, `supabase/migrations/20261005220100_securite_signalements.sql`, qui redéfinit `find_match` à partir de la forme de #436, et `lente_apparier` de #440 pour les parties lentes) ;
- pas trouvé : le joueur entre dans la file. Il rappelle `find_match` toutes les 2,5 s : il garde sa place et son ancienneté, et retrouve la partie dès qu'un adversaire l'a créée.

Une attente sans nouvelles depuis 30 s (écran fermé) ou de plus de 10 minutes est retirée de la file. « Annuler » appelle `quitter_file_attente`, qui rend la partie si un adversaire vient de la créer : l'écran l'ouvre au lieu d'annuler.

## Repli contre l'IA (#436)

- Proposé une fois par attente, au bout de 25 s, en ligne. Honnête : l'IA garde son nom et son portrait de l'échelle, « Caillou est une IA. Cette partie n'est pas classée. » Jamais d'IA déguisée en humain, pas de compteur de joueurs en ligne.
- Accepté : la partie contre l'IA s'ouvre (taille de la file), et le joueur **reste dans la file**. Une bande au-dessus de la partie (`src/app/VeilleFile.tsx`) rappelle `find_match` toutes les 2,5 s (présence `vu_le`) : « Je cherche toujours un joueur pour toi. », lien « Ne plus chercher ».
- Un humain arrive (la partie classée est créée comme d'habitude) : la bande devient « Un joueur est prêt ! », avec « Rejoindre » (action principale) et « Rester ». Non bloquant : la partie contre l'IA continue dessous.
  - « Rejoindre » : la partie en direct s'ouvre, la partie contre l'IA est quittée.
  - « Rester », ou quitter la partie contre l'IA sans répondre : `refuser_partie_direct` annule la partie en direct (statut `aborted`, aucune cote ne bouge), tant que le joueur n'y a pas joué, et le sort de la file. L'adversaire voit « Partie annulée : personne n'a vraiment joué. Ta cote ne bouge pas. » et peut « Rejouer ». Sans réponse ni départ (onglet en veille), la règle d'absence de 60 s l'annule de même.
- La partie contre l'IA n'est jamais classée (#417) ; elle compte pour l'échelle comme toute partie contre l'ordi.

## Parties quittées (#442)

Quitter une partie en direct fait attendre l'adversaire pour rien et vide la file des joueurs fiables. La règle freine ceux qui le font souvent, jamais celui qui perd le réseau une fois. Elle ne coûte **jamais de cote en plus** : seulement un temps d'attente avant la prochaine recherche en direct. Migration : `supabase/migrations/20261006100100_abandons_repetes.sql`.

**Ce qui compte comme une partie quittée** (journal `abandons`, écrit par le serveur seul) :

| Cas | Compté ? |
|---|---|
| Perte au temps d'un joueur **absent** (aucun signe de vie depuis plus de 60 s quand elle est constatée) | Oui (« absence ») |
| Partie annulée parce que le joueur qui devait jouer **n'est jamais venu** | Oui (« jamais venu ») ; l'autre joueur, non |
| Partie trouvée puis refusée pendant le repli contre l'IA (« Rester », ou partie IA quittée sans répondre, #436) | Seulement **à partir du 3e refus** (« refus répété ») |
| Abandon propre (« Abandonner ») | Non : c'est la bonne façon de partir |
| Pendule tombée d'un joueur **présent** (il a donné signe de vie depuis moins de 60 s) | Non : il a joué lentement, il n'est pas parti |
| Compte accepté, partie contre l'IA, défi entre amis | Non |

**Compteur** : parties quittées des **7 derniers jours**, parmi les **10 dernières parties en direct** du joueur. Dix parties jouées jusqu'au bout effacent donc tout ; une partie quittée sort aussi du compte au bout de 7 jours.

**Attente** (à partir de la dernière partie quittée) :

| Parties quittées comptées | Attente avant de rejouer en direct |
|---|---|
| 0 à 2 | Aucune (déconnexion rare, imprévu) |
| 3 | 5 minutes |
| 4 | 30 minutes |
| 5 et plus | 24 heures |

Pourquoi ces nombres : deux imprévus par semaine ne doivent rien coûter (60 s de tolérance par partie, en plus) ; à la troisième, 5 minutes suffisent à dire « on l'a vu » sans punir ; la marche suivante (30 min, puis 24 h) ne touche que ceux qui recommencent juste après. Le délai part de la dernière partie quittée : il est prévisible et se lit d'un coup d'œil.

**Pendant l'attente** : `find_match` refuse (code `JGD01`, `detail` = fin de l'attente, `hint` = minutes) ; personne n'est apparié avec ce joueur ; une partie en direct déjà en cours lui est toujours rendue. Les parties lentes, les défis entre amis et les parties contre l'ordi restent ouverts.

**Ce que voit le joueur** (écran Direct, `src/app/Direct.tsx`) :

- à 2 parties quittées, sous les réglages, sans bloquer : « Encore une partie quittée, et tu attendras 5 min avant de rejouer en direct. Si tu dois partir, abandonne : ça ne compte pas. » ;
- pendant l'attente, à la place de « Trouver un adversaire » : « Tu as quitté plusieurs parties. » / « Tu peux rejouer en direct dans 4 min. » (compte à rebours calé sur l'heure du serveur) / « Quand une partie est quittée, l'adversaire attend pour rien. Ta cote, elle, ne bouge pas. » / la règle en une ligne. Une seule action : « Jouer contre l'ordi en attendant » (l'IA la plus proche de sa cote, partie non classée). À la fin de l'attente, l'écran relit l'état et « Trouver un adversaire » revient. Textes en français et en anglais (`src/content/i18n/direct.ts`).

État lu par l'écran : `etat_abandons()` (compteur, fin de l'attente, délai de la prochaine, plafond des parties lentes, heure du serveur).

## Comptage

Japonais par défaut, chinois en option au moment du choix. Deux joueurs aux comptages différents ne sont appariés qu'après 30 s d'attente (comptage de qui attendait le plus).

## Sécurité

- Compte avec pseudo exigé (`exiger_compte_avec_pseudo`, JGC01 et JGP01).
- Table `parties_direct` (pendule) : RLS, lecture par les deux joueurs, aucune écriture directe ; publiée en temps réel.
- Fonctions `security definer` à `search_path` vide ; `cadence_direct`, `pendule_apres`, `direct_constater`, `direct_en_cours` et le déclencheur sont fermés à l'app.
- `refuser_partie_direct` (#436) : un des deux joueurs seulement, avant d'avoir joué ; fermée à anon.
- #442 : table `abandons` (RLS : chacun lit ses lignes ; aucune écriture par l'app, seul le déclencheur `games_journal_abandons` écrit), gardée 90 jours (`purger_abandons`, chaque nuit) ; `abandons_direct`, `en_attente_abandons`, `plafond_lentes` fermées à l'app. Tests : `supabase/tests/abandons_repetes.test.sql`, `src/data/abandons.test.ts`, `e2e/abandons-repetes.spec.ts`.
- Tests : `supabase/tests/partie_en_direct.test.sql`, `supabase/tests/file_jamais_vide.test.sql`, `src/app/fileJamaisVide.test.tsx`, `e2e/file-jamais-vide.spec.ts`, `src/go/pendule.test.ts`, `src/app/direct.test.ts`, `src/data/migrationDirect.test.ts`, `e2e/partie-en-direct.spec.ts` (deux téléphones).

## Mesure

`partie_en_ligne_commencee` (`taille`, `cadence`, `regles`, `attente_s` : délai d'appariement, pour la médiane) et `partie_en_ligne_terminee` (`taille`, `cadence`, `issue`, `raison`, `coups`). Jamais la partie ni l'adversaire. #436 : `file_repli_ia` (`accepte` : partie contre l'IA lancée, ou « Continuer d'attendre » / « Annuler » pendant la proposition), une fois par attente. Une partie rejointe depuis le repli envoie aussi `partie_en_ligne_commencee` (avec `attente_s`). #442 : `file_delai_abandons` (`niveau` : 5, 30 ou 1440 min ; `abandons` ; `depuis` : ecran ou recherche), `file_delai_ordi` (« Jouer contre l'ordi en attendant »), `file_abandons_prevenu` (`prochain` : minutes).

## Limites connues

- Depuis #363, la tâche pg_cron `clore-parties-direct-abandonnees` (chaque minute, `direct_clore_abandonnees`) applique la règle d'absence quand les deux joueurs sont partis depuis plus de 60 s : celui qui devait jouer perd au temps (partie annulée si chacun n'a pas joué) ; au comptage, celui qui est parti le premier perd. Avant, la partie restait « en cours » jusqu'au retour de l'un d'eux. Détail : `docs/produit/signalements-et-blocage.md`.
- Pas de spectateurs. Pas de discussion libre : seulement des messages tout prêts et des émotes de Mochi (« Dire », #373), avec « Signaler » et « Bloquer » (#363).
