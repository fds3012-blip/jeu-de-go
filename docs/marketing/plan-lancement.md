# Plan de lancement sans budget, sur 4 semaines (#112)

Budget : **0 €**. Tout repose sur le temps de l'équipe, les communautés existantes et le Go du jour comme boucle de partage. Cible de la charte : débutants et curieux (joueurs d'échecs, de jeux de société), puis joueurs de club.

## Principes

- **On respecte chaque communauté.** On lit ses règles avant de poster, on demande l'accord des modérateurs quand l'autopromotion est encadrée, on poste une fois, on répond à tout, on ne relance pas. Pas de faux comptes, pas de votes achetés, pas de messages privés non sollicités.
- **On dit la vérité.** On présente ce qui existe (voir `docs/marketing/fiches-stores.md`), on dit que l'app est jeune et on demande des retours.
- **Un seul lien** : le Go du jour du jour (`?go-du-jour=N`) ou l'accueil. Le Go du jour s'ouvre sans compte : c'est la meilleure porte d'entrée.

## Semaine 1 : clubs et Fédération française de go (bêta)

| Action | Détail | Coût |
|---|---|---|
| Courriel à la FFG | Présenter l'app, proposer une bêta aux clubs, demander s'ils acceptent un mot dans leur lettre ou sur leurs réseaux. Proposer l'app comme outil d'initiation gratuit pour les animations en club et en école. | 0 € |
| 20 clubs contactés | Les clubs listés sur le site de la FFG, en commençant par Paris, Lyon, Toulouse, Lille, Grenoble. Message court : « Vous initiez des débutants ? Voici un outil gratuit, sans pub, qu'ils peuvent continuer chez eux. » | 0 € |
| Formulaire de retours | Un formulaire simple (3 questions : ce qui plaît, ce qui bloque, un bug). | 0 € |
| Relecture des contenus | Proposer à 2 ou 3 joueurs dan de club de relire les leçons et les problèmes. Crédit dans l'app s'ils le souhaitent. | 0 € |

Objectif : 5 clubs qui testent, 50 joueurs en bêta, 30 retours écrits.

## Semaine 2 : Reddit r/baduk

- Lire les règles de r/baduk (autopromotion, jours dédiés, étiquettes). Si l'autopromotion est limitée, écrire d'abord aux modérateurs.
- **Un seul post**, en anglais, écrit par le fondateur en son nom : « I built a free, no-ads Go app for complete beginners, with KataGo running on your phone. Feedback welcome. » Contenu : ce qui marche, ce qui manque, capture de la revue de partie, lien vers le Go du jour.
- Répondre à chaque commentaire dans les 24 h, noter chaque critique dans une issue GitHub.
- Condition : l'interface anglaise doit être prête, sinon le dire clairement dans le post (« interface in French for now »).
- En parallèle : r/boardgames et r/chess seulement si leurs règles le permettent, et sous forme de question sincère (« Chess players who tried Go: what made it click? »), pas d'annonce.

Objectif : 1 post, 300 visites depuis Reddit, 20 retours.

## Semaine 3 : Discord

- Serveurs visés : les serveurs de go francophones et anglophones, et quelques serveurs de jeux de société ou d'échecs qui ont un salon « autres jeux ».
- Pour chaque serveur : lire les règles, demander aux modérateurs, poster seulement dans le salon prévu (annonces de projets, promo, feedback).
- Format : un message court et le Go du jour. Proposer de rester pour répondre aux questions.
- Idée à proposer aux serveurs qui acceptent : un fil « Go du jour » où chacun colle son résultat de partage. C'est la communauté qui partage, pas nous.

Objectif : 5 serveurs, 150 visites, 3 fils Go du jour vivants à la fin de la semaine.

## Semaine 4 : le Go du jour comme boucle de partage

La boucle : un joueur résout le Go du jour → il partage « Go du jour n° N · résolu en 2 essais · série 5 🔥 » → un ami clique → le problème s'ouvre sans compte → il le résout et partage à son tour.

| Action | Détail | Coût |
|---|---|---|
| Rendez-vous quotidien | Publier chaque jour le Go du jour sur les comptes de l'app (Bluesky, Mastodon, X, Instagram), avec le lien seul, jamais la réponse. | 0 € |
| Vidéo de 30 s par semaine | Un concept du go en 30 secondes (l'atari, les deux yeux, le ko), qui se termine sur le Go du jour. Montage avec les captures de l'app. | 0 € |
| Article de référencement | « Règles du go en 5 minutes » et « Apprendre le go : par où commencer », avec le Go du jour intégré. | 0 € |
| Retour aux communautés | Un message de bilan sur r/baduk et dans les clubs : ce qu'on a corrigé grâce à eux. | 0 € |

Objectif : 1 partage pour 10 Go du jour résolus, et 1 arrivée par partage pour 2 partages.

## Indicateurs PostHog

Événements qui existent déjà dans `src/data/analytics.ts` :

| Événement | Ce qu'il mesure |
|---|---|
| `app_ouverte` | Visite de l'app |
| `premiere_pierre` | Première pierre posée, avec les secondes depuis l'ouverture |
| `partie_terminee`, `premiere_partie_terminee` | Parties finies, et première partie finie (une seule fois) |
| `lecon_terminee` | Leçon finie |
| `probleme_resolu` | Problème résolu |
| `go_du_jour_resolu`, `go_du_jour_partage`, `arrivee_par_partage` | La boucle du Go du jour |
| `revue_ouverte`, `erreur_rejouee` | Usage de la revue et des erreurs rejouées |
| `gel_gagne`, `gel_utilise` | Série protégée |
| `inscription`, `lien_connexion_envoye` | Comptes |

Tableau de bord : on complète « Croissance – jeu de go » avec ces indicateurs, chaque lundi.

| Indicateur | Calcul | Cible à 4 semaines |
|---|---|---|
| Nouveaux visiteurs par semaine | `app_ouverte` (visiteurs distincts de la session) | 2 000 en semaine 4 |
| Première pierre dans la minute | `premiere_pierre` avec secondes ≤ 60 / `app_ouverte` | 90 % (charte) |
| Première partie terminée | `premiere_partie_terminee` / `premiere_pierre` | 60 % |
| Taux de partage du Go du jour | `go_du_jour_partage` / `go_du_jour_resolu` | 10 % |
| Coefficient de la boucle | `arrivee_par_partage` / `go_du_jour_partage` | 0,5 |
| Engagement après une partie | `revue_ouverte` / `partie_terminee` | 30 % |
| Rétention J1 / J7 | Cohortes PostHog sur `app_ouverte` | 45 % / 25 % (charte) |

Limite de mesure à connaître : sans consentement, PostHog tourne en mode anonyme (`persistence: 'memory'`, aucun profil, décision #64). La rétention J1 / J7 ne se calcule donc que sur les joueurs qui ont accepté le suivi dans le temps ; c'est un échantillon, à lire comme une tendance. Les taux de la boucle, eux, se calculent sur tous les joueurs.

Source des visites : lire le référent et les paramètres UTM de l'URL (`?utm_source=reddit`, `discord`, `club`, `ffg`). À ajouter sur chaque lien posté, pour savoir quelle communauté amène des joueurs qui restent.

## Coûts et suivi

| Semaine | Coût | Indicateur principal | Mesure |
|---|---|---|---|
| 1 : clubs et FFG | 0 €, environ 8 h | 50 joueurs en bêta, 30 retours | Formulaire, `app_ouverte` avec `utm_source=club` |
| 2 : r/baduk | 0 €, environ 4 h | 300 visites, 20 retours | UTM `reddit`, commentaires |
| 3 : Discord | 0 €, environ 6 h | 150 visites, 3 fils vivants | UTM `discord`, messages dans les fils |
| 4 : Go du jour | 0 €, environ 6 h | Partage 10 %, boucle 0,5 | `go_du_jour_partage`, `arrivee_par_partage` |
