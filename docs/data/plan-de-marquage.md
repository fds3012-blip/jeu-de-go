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
| `lecon_terminee` | `lecon`, `rang` | Dernière étape d'une leçon (`src/app/Learn.tsx`) | Activation (chemin des leçons), entonnoir leçon 1 → 6 |
| `lien_connexion_envoye` | aucune | Lien magique envoyé (`src/app/Account.tsx`) | Entonnoir de création de compte (étape 1) |
| `inscription` | aucune | Premier pseudo enregistré (`src/app/Account.tsx`) | Entonnoir de création de compte (étape 2), base de la future conversion |
| `probleme_resolu` | `probleme`, `du_jour` | Problème réussi pour la première fois sur l'appareil (`src/app/Puzzles.tsx`) | Engagement (problèmes), future limite Premium « problèmes illimités » |
| `revue_ouverte` | `coups`, `taille`, `mode` | Ouverture de la revue d'une partie (#34, `src/app/Revue.tsx`) | Usage de l'analyse (future limite « une analyse par jour ») |
| `revue_rejouer` | `coup` (position reprise, 0 = plateau vide), `cle` (depuis le moment clé ou non), `perte` (points perdus au moment clé, arrondis), `taille`, `mode` | « Rejouer d'ici » touché dans la revue (#186, `src/app/Revue.tsx`). **Nouveau (#186)** | Revue utile : `revue_rejouer` / `revue_ouverte`, cible 30 % (analyse UX du 28/09, C11-C12) |
| `go_du_jour_resolu` | `numero`, `essais`, `serie`, `arrivee_par_lien`, `vu` (résolu après avoir vu la réponse, #197) | Go du jour résolu, une fois par jour (#75, `src/app/Puzzles.tsx`). Aussi quand il est « Vu » : la série tient | Habitude quotidienne, rétention ; réussite sans aide (`vu = false`) |
| `go_du_jour_partage` | `numero`, `essais`, `methode` (`partage`/`copie`) | Partage du Go du jour (`src/app/Puzzles.tsx`) | Acquisition par partage (coefficient viral) |
| `arrivee_par_partage` | `numero_demande`, `numero_du_jour` | Ouverture de l'app par un lien partagé, une fois par session (`src/app/App.tsx`) | Nouveaux joueurs venus par partage |
| `erreur_rejouee` | `reussi`, `taille`, `coup`, `rates`, `reponses` | Premier essai sur une erreur rejouée (#77, `src/ui/MesErreurs.tsx`) | Usage de « Rejoue tes erreurs » (distinction n° 3 de la charte) |
| `gel_gagne` | `serie`, `gels` | Gel de série gagné (tous les 7 jours, #76, `src/app/gelAppareil.ts`) | Rétention (séries longues) |
| `gel_utilise` | `jour`, `serie`, `gels_restants` | Jour manqué couvert par un gel (`src/app/gelAppareil.ts`) | Rétention (séries sauvées) |
| `serie_perdue` | `jours` (longueur de la série perdue), `record` (plus longue série après la perte), `jours_manques` (jours sans Go du jour, hors aujourd'hui), `gels` (gels restés en réserve) | Ouverture de l'app après une série perdue (gels insuffisants), une seule fois par série (`src/app/gelAppareil.ts`). Mochi accueille le retour sans reproche dès 2 jours perdus. **Nouveau (#212)** | Retour à J+7 des joueurs qui ont perdu une série de 3 jours ou plus (analyse UX du 28/09, R1) ; part des séries perdues avec `record` > `jours` |
| `xp_gagne` | `points`, `gains`, `sources`, `xp_total`, `niveau` | Gains d'XP agrégés sur quelques secondes (#109, `src/app/xp.ts`) | Engagement par source d'XP |
| `niveau_atteint` | `niveau`, `xp_total`, `source`, `recompense` | Niveau franchi (#109, `src/app/xp.ts`) | Progression, paliers de récompense |
| `installation_proposee` | `plateforme` (`chrome` : invite native ; `ios` : consigne Safari), `moment` (`premiere_victoire`/`go_du_jour`) | Carte « Installe l'app » montrée, une seule fois par appareil, juste après une première victoire contre l'ordi ou un Go du jour réussi (#178, `src/ui/ProposerInstallation.tsx`). **Nouveau (#178)** | Taux d'installation (`installation_acceptee` / `installation_proposee`), part des joueurs actifs qui ont l'app (`app_ouverte.installee`) : condition du futur rappel quotidien sur iPhone |
| `installation_acceptee` | `plateforme` (`chrome` seulement), `moment` | Le joueur accepte l'invite native de Chrome (`userChoice` = `accepted`, #178, `src/ui/ProposerInstallation.tsx`). Sur iPhone, Safari ne dit pas si l'ajout a été fait : on le lit après coup dans `app_ouverte.installee = true`. **Nouveau (#178)** | Taux d'installation (Chrome), rétention J7/J30 des joueurs qui ont installé comparée aux autres |
| `solution_vue` | `probleme`, `du_jour`, `essais` (coups faux avant) | « Voir la réponse » touché, dernière marche de l'aide après un échec (indice, réfutation, réponse ; #197, `src/app/Puzzles.tsx`). Le problème résolu ensuite est « Vu » : ni XP, ni palier, ni `probleme_resolu`. **Nouveau (#197)** | Réussite sans aide (`probleme_resolu` / problèmes ouverts), part des problèmes trop durs (`solution_vue` par problème), difficulté du Go du jour |

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

## Limites connues des nouveaux événements

- `partie_commencee` part au premier coup d'une partie : annuler ce premier coup puis rejouer le renvoie. Effet faible, à surveiller.
- `comptage_manuel` part dès l'entrée en comptage manuel, même si le joueur reprend la partie ensuite. C'est voulu : on mesure combien de fins de partie passent par cet écran.
