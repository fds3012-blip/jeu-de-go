# Parties lentes classées (issue #440)

On joue quand on veut, sans être connecté en même temps que l'adversaire : 1, 2 ou 3 jours par coup, plusieurs parties à la fois, appariées par la cote Glicko-2 (#417), et elles **comptent pour la cote** (décision de Florian, 05/10). Modèle : OGS et les parties « Daily » de chess.com.

## Parcours

1. Accueil → « Jouer en ligne » (action principale, ou tuile « En ligne »). En tête de l'écran, une bascule **« En direct » / « Partie lente »**. Le choix est mémorisé sur l'appareil (`go.enLigne.v1`) : la fois suivante, « Jouer en ligne » rouvre la même façon de jouer. Sans compte ou sans pseudo : « Crée ton compte » d'abord, comme pour le direct.
2. Écran « Partie lente » (`src/app/Lentes.tsx`, chargé à la demande) :
   - taille : 9 × 9 par défaut, 13 × 13 ou 19 × 19 ;
   - temps par coup : 1 jour par défaut, 2 ou 3 jours (« Tu as 1 jour pour jouer chaque coup. Passé ce délai, tu perds au temps. ») ;
   - une action : « Trouver un adversaire ».
3. Quelqu'un de ton niveau attendait : la partie s'ouvre tout de suite. Sinon, la recherche **reste ouverte**, des heures ou des jours s'il le faut. Mochi : « Je te cherche un adversaire de ton niveau. Ça peut prendre du temps. » ; lien « Annuler la recherche ». On peut quitter l'écran.
4. Accueil :
   - recherche en cours : tuile « Partie lente · Je cherche ton adversaire… », avec « Annuler » ;
   - adversaire trouvé pendant ton absence : tuile « Adversaire trouvé ! · Ouvre ta partie » ;
   - « **À toi de jouer (N)** » : les parties lentes où c'est ton coup (une seule : la tuile ouvre la partie ; sinon, la liste) ; **point d'or** sur « Jouer en ligne » (bouton ou tuile).
5. Partie : l'écran du défi (`DefiPartie`, #81, #393), avec le pseudo, le grade et la cote de l'adversaire, le temps qui reste pour le coup en cours. Coups en temps réel (#425) si les deux sont là, sinon au retour.
6. Fin : aux points (deux passes, pierres mortes proposées puis acceptées), à l'abandon ou au temps. Phrase de fin, « +14 » et le grade (`GainCote`, #417), « Nouvelle partie lente » (action principale), « Revoir la partie » (revue, avec « Rejouer mes erreurs » #428).

Sous la recherche : « Tes parties lentes », d'abord celles où c'est à toi (point d'or, la plus pressée en premier), puis celles où c'est à l'autre, puis les 5 dernières finies.

Les défis entre amis (#81) restent amicaux et gardent leur écran : leur liste ne montre plus les parties lentes.

## Le serveur décide

Migration `supabase/migrations/20261005200100_parties_lentes.sql`. Une partie lente **est un défi classé** : une ligne de `games` (`rated = true`, komi 6,5, handicap 0, privée, jamais d'IA) et une ligne de `defis` (délai par coup, date limite du coup en cours), créées comme le fait `defier_ami` (#359). Tout le reste existe déjà :

- **Coups** : fonction serveur `game-action` (action `defi_coup`, **non modifiée**), qui rejoue la partie (captures, suicide, ko), puis `jouer_coup_defi` (clé service), qui revérifie le joueur, le tour, le délai. Chaque coup relance le délai.
- **Comptage et acceptation** : `game-action` puis `finish_game_by_score` ; **abandon** : `resign_game`. Les deux comptent la cote d'une partie classée.
- **Perte au temps** (`defi_constater_temps`, branche des parties classées) :
  - constatée à la lecture (`victoire_au_temps`, à l'ouverture de la partie), au coup suivant (coup refusé), et par la **tâche pg_cron `parties-lentes`** toutes les 10 minutes (`lentes_tache`), sans que personne n'ouvre la partie ;
  - le joueur au trait perd (`B+T` / `W+T`), et la cote bouge une fois (`apply_game_rating`) ;
  - au comptage, le délai continue : il porte sur qui doit répondre (l'autre joueur quand des pierres mortes sont proposées, sinon le joueur au trait), et repart à chaque proposition ;
  - avant que chacun ait joué un coup, la partie est **annulée** (`aborted`), sans effet sur la cote (comme le direct).
- **Heure** : celle de la base (`now()`), jamais celle du client.

## File lente et appariement

Table `file_lente`, à part de la file du direct (`match_queue`, purgée à 30 s et 10 min) : on y attend sans limite.

- Une recherche par joueur (taille, délai, cote et RD au moment de la demande). Redemander la même chose garde l'ancienneté.
- Mêmes taille et délai d'abord. Dès que l'un des deux attend depuis **1 heure**, les réglages peuvent différer : la partie prend ceux de qui attendait depuis le plus longtemps.
- Écart de cote accepté = 100 + √(RD₁² + RD₂²) / 2 + **50 points par heure** d'attente (la plus longue des deux). Le plus proche en cote d'abord, puis les mêmes réglages, puis le plus ancien.
- Jamais deux parties lentes en cours entre les deux mêmes joueurs ; **10 parties lentes en cours au plus** par joueur (code `JGL10`).
- L'appariement se tente à chaque recherche, et par la tâche planifiée (deux joueurs qui attendent, devenus compatibles avec le temps, sont appariés sans revenir).
- Couleurs tirées au sort. Le joueur absent garde la partie dans sa ligne (`partie_id`) : l'accueil dit « Adversaire trouvé ! » ; l'ouvrir efface la ligne (`quitter_file_lente`). Noir absent reçoit aussi la notification « À toi de jouer » (#367).

## Parties laissées expirer (#442)

Une partie lente dont le délai passe sans coup fait attendre l'adversaire des jours. Une seule, c'est la vie (vacances, oubli) ; plusieurs, c'est prendre plus de parties qu'on n'en peut mener. La règle réduit donc le **nombre de parties lentes à la fois**, jamais la cote.

- **Compté** : délai dépassé par le joueur qui devait jouer (ou répondre au comptage) : perte au temps, ou partie annulée avant un coup chacun. **Pas compté** : abandon propre, compte accepté, défi entre amis.
- **Fenêtre** : 30 jours glissants.
- **Plafond de parties lentes en cours** : 0 ou 1 expirée → 10 (inchangé) ; 2 → 5 ; 3 et plus → 2. Les parties déjà en cours continuent ; seules les nouvelles recherches sont limitées (`chercher_partie_lente` refuse avec `JGL11`, `detail` = le plafond) et la file ne l'apparie pas au-delà (`lente_apparier`, redéfinie à partir de la forme de #363).
- **Ce que voit le joueur** (écran Parties lentes) : à 1 partie expirée, « Si une autre partie expire, tu pourras en mener 5 à la fois pendant 30 jours. » ; au plafond réduit, « Tu as laissé expirer plusieurs parties. Pendant 30 jours, tu peux en mener 2 à la fois. » (avec « Finis-en une pour en commencer une autre. » quand il est atteint). Français et anglais (`src/content/i18n/lente.ts`).
- Le direct et les parties lentes ont chacun leur compteur : une partie lente expirée n'ajoute pas d'attente au direct.

Migration : `supabase/migrations/20261006100100_abandons_repetes.sql`. Règle du direct : `docs/game-design/partie-en-direct.md` (« Parties quittées »). Mesure : `lente_plafond_reduit` (`plafond`, `atteint`).

## Sécurité

- Compte avec pseudo exigé (`exiger_compte_avec_pseudo`, JGC01 / JGP01).
- `file_lente` : RLS, chacun lit sa seule ligne ; aucune écriture directe.
- Fonctions `security definer` à `search_path` vide ; `lente_apparier`, `lentes_en_cours`, `lentes_tache`, `defi_constater_temps` fermées à l'app (la tâche tourne sous le rôle `postgres`).
- Aucune suppression de données hors de la file lente.
- #363 : jamais apparié avec un joueur bloqué (dans un sens ou dans l’autre) ; `lente_apparier` est redéfinie dans `supabase/migrations/20261005220100_securite_signalements.sql`. « Dire » et « Signaler ce joueur » sont aussi dans une partie lente (écran du défi).

## Mesure

`partie_lente_commencee` (`taille`, `delai_jours`, `attente_h`) et `partie_lente_terminee` (`taille`, `delai_jours`, `issue`, `raison`, `coups`). Jamais la partie ni l'adversaire. Voir `docs/data/plan-de-marquage.md`.

## Hors périmètre, limites

- Pas de rappel poussé ni d'e-mail (décision de Florian attendue) : le seul signal est l'accueil (tuiles, point d'or) et la notification dans l'app.
- `partie_lente_terminee` n'est envoyé que si le joueur voit la fin sur l'écran de la partie (une perte au temps constatée par la tâche pendant que personne ne regarde n'est pas mesurée côté client).

## Tests

`supabase/tests/parties_lentes.test.sql`, `supabase/tests/abandons_repetes.test.sql` (#442), `src/app/lente.test.ts`, `src/data/lente.test.ts`, `e2e/parties-lentes.spec.ts` (deux téléphones, horloge du serveur simulée).
