# Plan de marquage

Issue #166. Source unique : `src/data/analytics.ts` (constante `EVENTS`). Un test Vitest (`src/data/analytics.test.ts`) échoue si un événement de `EVENTS` n'a pas sa ligne ici : aucun événement sans indicateur.

## Règles communes

- **Consentement** (détail : `docs/juridique/consentement.md`). Trois niveaux :
  - `anonyme` (par défaut) : mesure exemptée. Rien sur l'appareil, aucun profil, identifiant neuf à chaque chargement de page.
  - `complet` (après « Oui ») : identifiant persistant, lien avec le compte Supabase (jamais l'e-mail).
  - `aucun` (opposition) : rien ne part.
- **Propriétés ajoutées à chaque événement** : `version` (commit ou version), `environnement` (`production`, `preview`, `development`) et, depuis #166, `mesure` (`anonyme` ou `complet`) : le niveau au moment de l'envoi.
- **`trackOnce`** : une fois par appareil avec accord (repère `go.evenement.<nom>` en localStorage), une fois par session sans accord.
- **Aucune donnée personnelle** : pas d'e-mail, pas de pseudo, pas de texte libre. Les identifiants envoyés sont ceux du contenu (leçon, problème, adversaire).
- **Noms** : minuscules, tirets bas, en français. Stables : ne jamais renommer un événement déjà en production (les entonnoirs casseraient).

## Événements

| Événement | Propriétés | Déclencheur (fichier) | Indicateur servi |
|---|---|---|---|
| `app_ouverte` | `installee` (PWA lancée depuis l'écran d'accueil) | Chaque chargement de l'app (`src/main.tsx`) | Joueurs actifs (dénominateur), nouveaux joueurs, rétention J1/J7/J30 (population `complet`), part des installations PWA |
| `premiere_pierre` | `secondes` (depuis l'ouverture de la page), `mode` (`ordi`/`deux`), `adversaire`, `taille` | Premier coup d'une partie, une seule fois (`trackOnce`, `src/app/Game.tsx`) | **Première pierre dans la minute** (`secondes <= 60`) |
| `partie_commencee` | `mode`, `adversaire`, `taille` | Chaque premier coup d'une partie (`src/app/Game.tsx`). **Nouveau (#166)** | Taux de parties finies (`partie_terminee` / `partie_commencee`), abandon en cours de partie |
| `comptage_manuel` | `mode`, `adversaire`, `taille`, `mortes` (pierres marquées mortes), `incertains` (groupes incertains) | Deux passes, puis comptage non automatique : le joueur doit corriger les pierres mortes à la main (`src/app/Game.tsx`). **Nouveau (#166)** | Part des fins de partie en comptage manuel (#159, piste P7 de l'analyse UX du 27/09) |
| `partie_terminee` | `mode`, `adversaire`, `taille`, `coups`, `fin` (`score`/`abandon`), `gagnant` (`noir`/`blanc`) | Passage à l'écran de fin (`src/app/Game.tsx`) | **Parties terminées par joueur actif et par semaine** |
| `premiere_partie_terminee` | `adversaire`, `taille`, `coups`, `fin`, `indices`, `secondes` | Première partie contre l'ordi finie, une fois (`trackOnce`, #35, `src/app/Game.tsx`) | Activation : part des nouveaux joueurs qui finissent une partie |
| `lecon_commencee` | `lecon`, `rang`, `etape` (étape d'ouverture, 1 = début ; plus : reprise) | Ouverture du lecteur d'une leçon, depuis le chemin, l'accueil ou « Leçon suivante » (`src/app/Learn.tsx`). **Nouveau (#198)** | Taux de leçons finies (`lecon_terminee` / `lecon_commencee`), abandon en cours de leçon, J1 |
| `lecon_terminee` | `lecon`, `rang` | Dernière étape d'une leçon (`src/app/Learn.tsx`). Depuis #199, une leçon terminée est aussi le défi du jour (fait vivre la série de l'appareil si `SERIE_UN_DEFI`) ; l'événement ne porte pas la série | Activation (chemin des leçons, étape 5 de l'entonnoir, `tableaux-de-bord.md` 7.1), taux de leçons finies, entonnoir leçon 1 → 7 |
| `lien_connexion_envoye` | aucune | Lien magique envoyé (`src/app/Account.tsx`) | Entonnoir de création de compte (étape 1) |
| `inscription` | aucune | Premier pseudo enregistré (`src/app/Account.tsx`) | Entonnoir de création de compte (étape 2), base de la future conversion |
| `probleme_resolu` | `probleme`, `du_jour` | Problème réussi pour la première fois sur l'appareil (`src/app/Puzzles.tsx`) | Engagement (problèmes), future limite Premium « problèmes illimités » |
| `probleme_termine` | `probleme`, `cote_joueur` (cote interne avant l'essai, arrondie ; jamais affichée), `cote_probleme` (difficulté du problème), `premier_essai_reussi` | Premier essai d'un problème noté par « Continuer » à ta mesure (#284, `src/app/Puzzles.tsx`) : ni Go du jour, ni lien partagé, ni problème déjà réussi ou vu. Un indice, la réponse ou « Rejouer » n'envoient rien. **Nouveau (#284)** | Réussite au premier essai sur « Continuer » (cible : 85 %), par tranche de `cote_joueur` ; écart entre `cote_joueur` et `cote_probleme` |
| `revue_ouverte` | `coups`, `taille`, `mode` (`ordi`, `deux` ; `import` depuis #286) | Ouverture de la revue d'une partie (#34, `src/app/Revue.tsx`) | Usage de l'analyse (future limite « une analyse par jour ») |
| `revue_rejouer` | `coup` (position reprise, 0 = plateau vide), `cle` (depuis le moment clé ou non), `perte` (points perdus au moment clé, arrondis), `taille`, `mode` | « Rejouer d'ici » touché dans la revue (#186, `src/app/Revue.tsx`). **Nouveau (#186)** | Revue utile : `revue_rejouer` / `revue_ouverte`, cible 30 % (analyse UX du 28/09, C11-C12) |
| `import_sgf_commence` | `source` (`fichier`, `texte`, `ogs` : lien de partie OGS) | « Lire la partie » touché ou fichier choisi dans « Analyser une partie » (#286, `src/app/ImportSgf.tsx`). **Nouveau (#286)** | Dénominateur des imports réussis ; part des imports venus d'OGS |
| `import_sgf_reussi` | `source`, `octets` (taille du texte SGF), `coups`, `taille` (9, 13 ou 19), `handicap` (0 sans handicap) | SGF lu et validé coup par coup, avant le choix du camp (#286, `src/app/ImportSgf.tsx`). Aucun nom de joueur, aucun coup, aucun numéro de partie OGS n'est envoyé. Remplace `sgf_importe` (première version de #286, PR #305). **Nouveau (#286)** | Imports par semaine, part des imports venus d'OGS (`source` = `ogs`) ; J7 des joueurs qui importent (second cercle de la charte) ; `revue_ouverte` (`mode` = `import`) / `import_sgf_reussi` |
| `import_sgf_erreur` | `source`, `raison` (`vide`, `trop-gros`, `format`, `pas-go`, `taille`, `sans-coups`, `trop-long`, `installation`, `illegal`, `coordonnee`, `lecture`, `ogs-introuvable`, `ogs-privee`, `ogs-injoignable`), `coup` (coup refusé, sinon vide) | Import refusé, avec le message montré au joueur (#286, `src/app/ImportSgf.tsx`). **Nouveau (#286)** | Qualité de la lecture : `import_sgf_erreur` / `import_sgf_commence` par raison ; `ogs-injoignable` élevé : l'API d'OGS refuse l'appel du navigateur |
| `go_du_jour_resolu` | `numero`, `essais`, `serie` (série de l'appareil après coup ; depuis #199, elle compte aussi les leçons et révisions), `arrivee_par_lien`, `vu` (résolu après avoir vu la réponse, #197) | Go du jour résolu, une fois par jour (#75, `src/app/Puzzles.tsx`). Aussi quand il est « Vu » : la série tient. Depuis #199, ne part pas si le Go du jour du jour est déjà coché sur l'appareil | Habitude quotidienne, J7 (étape 6 de l'entonnoir d'activation) ; réussite sans aide (`vu = false`) ; séries perdues (`serie` qui repart à 1, `tableaux-de-bord.md` 7.7) |
| `go_du_jour_partage` | `numero`, `essais`, `methode` (`partage`/`copie`) | Partage du Go du jour (`src/app/Puzzles.tsx`), action secondaire sous « Problème suivant » depuis #75 (branche `go-du-jour-partage`). `numero` est celui du défi partagé, même ancien | Acquisition par partage (coefficient viral) |
| `arrivee_par_partage` | `numero_demande`, `numero_du_jour` | Ouverture de l'app par un lien partagé `?go-du-jour=N` (ou `?godujour=N`), une fois par session (`src/app/App.tsx`). Depuis la PR de `go-du-jour-partage` (#75), un numéro passé ouvre ce Go du jour-là, sans série ni XP du jour ; `numero_demande < numero_du_jour` le repère | Nouveaux joueurs venus par partage |
| `erreur_rejouee` | `reussi`, `source` (`revue` : « Rejoue cette erreur » dans la revue ; `problemes` : révision dans « Tes erreurs à rejouer »), `taille`, `coup`, `rates`, `reponses` (coups acceptés : le meilleur et ceux qui perdent moins de 1 point) | Premier essai sur une erreur rejouée (#77, `src/app/Revue.tsx`, `src/ui/MesErreurs.tsx`). Ratée dans la revue, l'erreur revient à J+1, puis J+3 et J+7. **`source` nouveau (#77)** | Usage de « Rejoue tes erreurs » (distinction n° 3 de la charte) : `erreur_rejouee` (source `revue`) / `revue_ouverte` |
| `erreur_maitrisee` | `taille`, `coup`, `rates` (échecs avant la maîtrise) | Deuxième réussite en révision : l'erreur est maîtrisée et ne revient plus (#77, `src/ui/MesErreurs.tsx`). **Nouveau (#77)** | Apprentissage réel : erreurs maîtrisées / erreurs gardées ; J7 des joueurs qui rejouent leurs erreurs comparé aux autres |
| `gel_gagne` | `serie`, `gels` | Gel de série gagné (tous les 7 jours, #76, `src/app/gelAppareil.ts`) | Rétention (séries longues) |
| `gel_utilise` | `jour`, `serie`, `gels_restants` | Jour manqué couvert par un gel (`src/app/gelAppareil.ts`) | Rétention (séries sauvées) |
| `serie_perdue` | `jours` (longueur de la série perdue), `record` (plus longue série après la perte), `jours_manques` (jours sans Go du jour, hors aujourd'hui), `gels` (gels restés en réserve) | Ouverture de l'app après une série perdue (gels insuffisants), une seule fois par série (`src/app/gelAppareil.ts`). Mochi accueille le retour sans reproche dès 2 jours perdus. **Nouveau (#212)** | Retour à J+7 des joueurs qui ont perdu une série de 3 jours ou plus (analyse UX du 28/09, R1) ; part des séries perdues avec `record` > `jours` |
| `xp_gagne` | `points`, `gains`, `sources`, `xp_total`, `niveau` | Gains d'XP agrégés sur quelques secondes (#109, `src/app/xp.ts`) | Engagement par source d'XP |
| `niveau_atteint` | `niveau`, `xp_total`, `source`, `recompense` | Niveau franchi (#109, `src/app/xp.ts`) | Progression, paliers de récompense |
| `installation_proposee` | `plateforme` (`chrome` : invite native ; `ios` : consigne Safari), `moment` (`premiere_victoire`/`go_du_jour`) | Carte « Installe l'app » montrée, une seule fois par appareil, juste après une première victoire contre l'ordi ou un Go du jour réussi (#178, `src/ui/ProposerInstallation.tsx`). **Nouveau (#178)** | Taux d'installation (`installation_acceptee` / `installation_proposee`), part des joueurs actifs qui ont l'app (`app_ouverte.installee`) : condition du futur rappel quotidien sur iPhone |
| `installation_acceptee` | `plateforme` (`chrome` seulement), `moment` | Le joueur accepte l'invite native de Chrome (`userChoice` = `accepted`, #178, `src/ui/ProposerInstallation.tsx`). Sur iPhone, Safari ne dit pas si l'ajout a été fait : on le lit après coup dans `app_ouverte.installee = true`. **Nouveau (#178)** | Taux d'installation (Chrome), rétention J7/J30 des joueurs qui ont installé comparée aux autres |
| `solution_vue` | `probleme`, `du_jour`, `essais` (coups faux avant) | « Voir la réponse » touché, dernière marche de l'aide après un échec (indice, réfutation, réponse ; #197, `src/app/Puzzles.tsx`). Le problème résolu ensuite est « Vu » : ni XP, ni palier, ni `probleme_resolu`. **Nouveau (#197)** | Réussite sans aide (`probleme_resolu` / problèmes ouverts), part des problèmes trop durs (`solution_vue` par problème), difficulté du Go du jour |
| `revision_faite` | `exercices` (exercices du jour, 3 au plus), `du_premier_coup` (réussis du premier coup et sans aide dans cette visite), `serie` (série de l'appareil après coup), `compte_serie` (vrai si la révision fait vivre la série : constante `SERIE_UN_DEFI`) | Dernier exercice de la Révision du jour résolu, une fois par jour (#199, `src/ui/RevisionDuJour.tsx`). Les exercices sont des problèmes déjà réussis, repris à J+1, J+3 et J+7. **Nouveau (#199)** | J7 et J30 (analyse UX du 28/09, A5) ; réussite des révisions (`du_premier_coup` / `exercices`) ; test A/B « un défi par jour » (`docs/data/tableaux-de-bord.md`, section 3) |
| `course_terminee` | `score` (problèmes résolus), `erreurs` (0 à 3), `duree` (secondes jouées, 180 au plus), `raison` (`temps`, `erreurs` ou `epuise`) | Fin d'une course aux problèmes : 3 minutes écoulées, 3e erreur ou plus de problème (#287, `src/app/CourseProblemes.tsx`). Une course quittée avant la fin n'envoie rien. **Nouveau (#287)** | Part des joueurs actifs qui font une course dans la semaine, courses par joueur, durée de session ; J7 et J30 des joueurs qui font une course |
| `course_partagee` | `score`, `meilleur` (meilleur score de l'appareil, après la course), `methode` (`partage`/`copie`) | « Partager » touché sur l'écran de fin de la course (#287, `src/app/CourseProblemes.tsx`). Le texte n'a pas de spoiler : score, durée et meilleur score. **Nouveau (#287)** | Partages de course par semaine (acquisition) |
| `placement_commence` | `refait` (vrai si un placement était déjà fait ou passé) | Lien « Je sais déjà jouer » de l'accueil (premier lancement) ou ligne du Profil (#283, `src/app/App.tsx`). **Nouveau (#283)** | Part des nouveaux qui choisissent « Je sais déjà jouer » (second cercle) |
| `placement_termine` | `kyu` (niveau estimé, `null` si les 3 problèmes sont ratés) | Troisième problème de placement joué (#283, `src/app/Placement.tsx`). **Nouveau (#283)** | J1 des joueurs placés (cible : au moins 45 %) ; répartition des kyu |
| `placement_saute` | `etape` (problèmes déjà joués, 0 à 2) | « Passer » pendant le placement (#283). **Nouveau (#283)** | Abandon du placement, par étape |
| `defi_cree` | `partage` (`web_share` : feuille de partage ; `copie` : presse-papiers ; `manuel` : lien à copier à la main ; `annule` : feuille fermée), `anonyme` (créateur sans compte) | Lien de défi créé par « Envoyer un lien » (#81, `src/app/Defis.tsx`), après la tentative de partage. Ni le lien ni la partie ne sont envoyés. **Nouveau (#81)** | Numérateur du coefficient viral ; défis créés par joueur actif et par semaine ; part des partages natifs |
| `defi_ouvert` | `anonyme` (l'ami a ouvert le lien sans compte : session anonyme), `deja_joueur` (le créateur rouvre son propre lien) | Lien de défi ouvert et partie rejointe (`rejoindre_defi` réussi), une fois par ouverture (#81, `src/app/Defis.tsx`). Ni le jeton ni la partie ne sont envoyés ; le jeton quitte l'adresse avant tout événement (constat E14, `src/app/adresseDefi.ts`). **Nouveau (#81)** | **Coefficient viral** : `uniq(defi_ouvert sans deja_joueur) / uniq(defi_cree)` par semaine ; part des amis arrivés sans compte |
| `defi_inscription` | `coups` (coups joués par ce joueur avant l'inscription ; `null` depuis le Profil), `moment` (`apres_coup` : carte « Garde ta partie » de l'écran du défi ; `profil` : carte du compte d'une session sans compte) | E-mail lié à une session anonyme (`updateUser`, le lien de confirmation part) (#81, `src/app/Defis.tsx`, `src/app/Account.tsx`). **Nouveau (#81)** | Conversion des amis venus par un défi : `defi_inscription / defi_ouvert (anonyme)` |

`identify(id)` (`src/app/Account.tsx`) relie les événements au compte, seulement au niveau `complet`.

## Indicateurs de la charte : ce qu'on mesure et ce qu'on ne mesure pas

| Indicateur (cible à 6 mois) | Mesurable aujourd'hui ? | Pourquoi |
|---|---|---|
| Nouveaux joueurs par semaine (10 000) | **Partiellement** | Sans accord, chaque chargement de page a un identifiant neuf : on ne distingue pas un nouveau joueur d'un joueur qui revient. On ne compte les nouveaux que dans la population `complet` (première apparition d'une personne), ce qui sous-estime le total. En `anonyme`, `app_ouverte` donne un plafond (des visites, pas des joueurs). |
| Première pierre dans la minute (90 %) | **Oui, avec biais** | `premiere_pierre.secondes`. Sans accord, l'événement repart à chaque session : des joueurs qui reviennent entrent dans la mesure. `secondes` compte depuis l'ouverture de la page, pas depuis la toute première visite. Lecture fiable : filtrer sur `mesure = 'complet'`, ou accepter le biais et le dire. |
| Rétention J1 / J7 / J30 (45 / 25 / 12 %) | **Seulement avec accord** | Il faut un identifiant persistant. Mesure limitée aux joueurs qui ont dit « Oui » : population auto-sélectionnée, probablement plus engagée. |
| Parties terminées par joueur actif et par semaine (5) | **Partiellement** | Numérateur (`partie_terminee`) complet. Dénominateur (joueurs actifs distincts) fiable seulement en `complet`. Les parties en ligne ne sont pas encore marquées (pas d'écran). |
| Conversion en Premium (3 % des actifs mensuels) | **Non** | Premium n'existe pas encore : aucun événement `premium_*`. À ajouter avec l'offre (voir plus bas). |
| Note moyenne sur les stores (4,7) | **Non (hors PostHog)** | L'app n'est pas encore sur les stores (Capacitor à venir). La note se lira dans App Store Connect et Google Play Console, pas dans PostHog. |

## À ajouter plus tard (pas encore d'écran ou de fonction)

- `premium_vu`, `premium_essai`, `premium_achat` (propriété `offre` : `mois`/`an`) : conversion, dès que l'offre existe.
- `limite_atteinte` (`type` : `analyse`, `probleme`, `lecon`) : combien de joueurs gratuits touchent une limite.
- `partie_en_ligne_terminee` : quand les parties en ligne auront leur écran.
- `note_demandee` / `note_donnee` : invite à noter l'app, quand l'app sera sur les stores.

## Vérification du 28/09 (#222)

- **Couverture** : les 33 événements de `EVENTS` ont leur ligne (test `analytics.test.ts`). Événements ajoutés la nuit du 27 au 28/09 : `lecon_commencee` (#198), `revue_rejouer` (#186), `installation_proposee` et `installation_acceptee` (#178), `solution_vue` (#197), `revision_faite` (#199). Propriétés et déclencheurs relus dans le code : conformes au tableau.
- **Réception dans PostHog** (lecture seule, 28/09 vers 03 h 30) : aucun de ces six événements n'a encore été reçu, ni `partie_commencee`, `comptage_manuel`, ni la propriété `mesure` (#166). Dernier événement reçu : 28/09 à 00 h 06. Soit aucun trafic depuis les déploiements, soit un souci de version : à revérifier au premier trafic réel.
- **Requêtes** : chaque événement cité dans `tableaux-de-bord.md` existe dans `EVENTS` ou dans la liste « À ajouter plus tard » (test `src/data/tableauxDeBord.test.ts`).

## Propriétés à ajouter pour les tests A/B (#222)

Proposées, **pas encore dans le code** (issue d'instrumentation à ouvrir) :

| Événement | Propriété | Pourquoi |
|---|---|---|
| `partie_commencee`, `partie_terminee` | `komi` (komi réellement compté) | Test du komi réduit (`tableaux-de-bord.md` 8.3). Aujourd'hui le komi se devine par le rang, mal |
| `partie_commencee`, `partie_terminee` | `rang` (parties contre l'ordi déjà lancées sur l'appareil, celui de `equilibrage`) | Victoires des 3 premières parties (7.2) : le rang recalculé dans PostHog compte les parties terminées, pas lancées |
| `partie_commencee`, `partie_terminee` | `respire` (booléen) | Test `POMME_RESPIRE` (8.2), tiré par partie |
| Tous les événements des bras testés | `variante` | Séparer les bras d'un test. Les drapeaux PostHog sont coupés aujourd'hui (`advanced_disable_feature_flags`) |
| `lecon_terminee` | `serie` | Voir une série reprise par une leçon (7.7) |
| nouveau `probleme_ouvert` | `probleme`, `du_jour` | Dénominateur de la réussite sans aide (7.4) |

## Limites connues des nouveaux événements

- `partie_commencee` part au premier coup d'une partie : annuler ce premier coup puis rejouer le renvoie. Effet faible, à surveiller.
- `comptage_manuel` part dès l'entrée en comptage manuel, même si le joueur reprend la partie ensuite. C'est voulu : on mesure combien de fins de partie passent par cet écran.
