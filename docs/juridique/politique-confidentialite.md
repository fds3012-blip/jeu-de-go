# Politique de confidentialité (issues #111 et #223)

> **Relecture obligatoire avant la mise en production.** Ce document est un projet préparé par le responsable juridique, qui n'est pas avocat. Il doit être relu et validé par un **avocat** ou un **DPO** avant d'être publié ou montré aux joueurs comme texte définitif. Les champs « À COMPLÉTER PAR FLORIAN » doivent être remplis, et la section 9 retirée de la version publiée.

Première version le 27 septembre 2026. Mise à jour le 28 septembre 2026 (#223) : nouveaux événements de mesure, envoi de la série de l'appareil à la connexion, nouvelles données sur l'appareil, proposition d'installer l'app, suppression du compte dans l'app (#114). Mise à jour le 29 septembre 2026 (#223, #111) : défi par lien (#81), sessions sans compte limitées (#316) et supprimées après 60 jours sans activité (#318), session de connexion gardée sur l'appareil, cache hors ligne de l'app, qui voit quoi sur le serveur, adresse de la page envoyée à PostHog.

Elle décrit ce que l'app fait réellement sur `main` le 29/09 : code de `src/data` et `src/app`, schéma de `supabase/migrations`, `public/sw.js`, plan de marquage `docs/data/plan-de-marquage.md`, analyse `docs/juridique/consentement.md`. Un test (`src/data/politiqueConfidentialite.test.ts`) échoue si une clé de stockage de l'appareil, un cache ou un événement de mesure du code n'est pas cité dans la partie destinée aux joueurs (sections 1 à 8), ou si la politique cite une clé qui n'existe plus.

## Pour Florian : champs à compléter avant publication

Aucune adresse ni identité n'a été inventée. Tant que ces champs sont vides, l'app affiche « Contact : bientôt disponible ».

1. **Responsable du traitement** : nom et prénom (personne physique) ou raison sociale et forme (société).
2. **Adresse postale** du responsable du traitement.
3. **Numéro SIREN / RCS** (si société ou entrepreneur individuel).
4. **Adresse e-mail de contact « données personnelles »** (dédiée de préférence, par exemple une adresse sur le domaine du jeu).
5. **Délégué à la protection des données** : nom et contact, ou mention qu'aucun DPO n'est désigné (non obligatoire à ce stade, à confirmer par l'avocat).
6. **Date d'entrée en vigueur** de la politique.
7. **Durée de conservation des rapports de bugs** réglée dans Sentry.

Points à vérifier en parallèle (des preuves à conserver, pas des champs) : DPA signés avec Supabase, PostHog, Sentry et Vercel ; adhésion de ces sociétés au Data Privacy Framework ; région Sentry réellement choisie (UE, Francfort) ; réglage de la géolocalisation dans PostHog (section 3.3) ; adresse réelle d'où l'app télécharge le réseau de KataGo en production (section 4) ; tâche `purger-anonymes-inactifs` bien planifiée en production (E13) ; fragment de l'adresse retiré avant l'envoi à PostHog et Sentry (E14).

---

## 1. Qui est responsable de tes données ?

Le responsable du traitement est **[À COMPLÉTER PAR FLORIAN : nom ou raison sociale]**, **[À COMPLÉTER PAR FLORIAN : adresse postale]**, **[À COMPLÉTER PAR FLORIAN : SIREN / RCS, le cas échéant]**.

Contact pour toute question sur tes données : **[À COMPLÉTER PAR FLORIAN : adresse e-mail de contact]**.

Délégué à la protection des données : **[À COMPLÉTER PAR FLORIAN : nom et contact du DPO, ou « aucun DPO désigné »]**.

## 2. En bref

- Tu peux jouer **sans compte**. Tes réglages et ta progression restent alors **sur ton appareil**. Nous n'y avons pas accès.
- L'IA (KataGo) calcule **sur ton appareil** : tes parties contre l'ordinateur ne sont pas envoyées.
- Si tu crées un compte, ta progression est gardée **sur notre serveur** (Supabase, Paris). À la connexion, la **série de jours** de ton appareil y est envoyée pour ne pas la perdre.
- Si tu joues un **défi par lien** sans compte, le serveur crée une **session sans compte** (ni e-mail, ni pseudo). Elle est **effacée après 60 jours sans activité**.
- Par défaut, nous comptons ce qui se passe dans le jeu de façon **anonyme** : sans cookie, sans identifiant qui dure, sans lien avec ton compte. **Ce comptage part sans demander ton accord** (la CNIL l'autorise pour la mesure d'audience ainsi réglée). Tu peux **t'y opposer** d'un geste.
- Les **rapports de bugs** et le **suivi détaillé** (savoir si tu reviens jouer) ne démarrent **qu'avec ton accord**.
- Tu peux **supprimer ton compte depuis l'app** (dans Profil, sous ton compte).
- **Aucune vente de données. Aucune publicité.** Aucune donnée n'est utilisée pour du profilage publicitaire.

## 3. Quelles données, pourquoi, sur quelle base, combien de temps

### 3.1 Sur ton appareil (stockage local du navigateur ou de l'app)

Ces données sont écrites dans le stockage local (`localStorage`) de ton navigateur ou de l'app, ou dans son cache. Elles ne nous sont **pas envoyées**, sauf la série de jours, envoyée au serveur à la connexion si tu as un compte (section 3.2), la session de connexion, présentée au serveur à chaque échange, et les valeurs jointes à certains événements de mesure (section 3.3).

- **Finalité** : faire fonctionner le jeu sans compte et garder ta progression d'une visite à l'autre.
- **Base légale** : exécution du service que tu demandes (art. 6.1.b RGPD). Écrire et lire ces données est **strictement nécessaire** au service (exemption de consentement, art. 82 loi Informatique et Libertés).
- **Durée** : jusqu'à ce que tu effaces les données du site ou désinstalles l'app. Supprimer ton compte **n'efface pas** ces données : elles sont sur ton appareil, pas chez nous.

| Données | Clé de stockage | Contenu |
|---|---|---|
| Réglages | `go.settings.v1`, `go.themeGoban.v1`, `go.langue.v1` | Thème, taille du plateau, son, vibrations, fêtes, aide, confirmation du coup, décor du plateau, langue de l’interface choisie dans le Profil (`"fr"` ou `"en"`) |
| Choix sur la mesure | `go.consentement.v1`, `go.mesure.opposition.v1` | Ta réponse à la fenêtre (« Oui » ou « Non merci ») et ton opposition au comptage anonyme |
| Repères d'événements | `go.evenement.<nom>` (par exemple `go.evenement.premiere_pierre`) | « Déjà envoyé une fois » pour certains événements. **Écrits seulement si tu as dit « Oui »** |
| Leçons | `go.lecons.v1` | Leçons commencées et terminées |
| Problèmes | `go.problemes.v1`, `go.problemes.vus.v1` | Problèmes réussis, et problèmes dont tu as vu la réponse |
| Problèmes à ta mesure | `go.cote-joueur.v1` | Une cote estimée d'après tes premiers essais, jamais affichée, pour choisir le prochain problème (#284) ; nombre d'essais, réussites d'affilée, dernier problème joué et problèmes déjà faits aujourd'hui |
| Course aux problèmes | `go.course-meilleur.v1` | Ton meilleur score à la course de 3 minutes (un nombre), pour l'afficher à la fin de la course et dans le texte partagé (#287) |
| Niveau de départ | `go.placement.v1` | Résultat du placement « Je sais déjà jouer » (#283) : niveau estimé en kyu, cote de départ, adversaire conseillé et date ; ou seulement « passé » et la date |
| Révision espacée | `go.revision.v1` | Pour chaque problème réussi : jour de référence et prochaine échéance (J+1, J+3, J+7) |
| Go du jour et série | `go.go-du-jour.v1`, `go.go-du-jour.fait.v1`, `go.gel.v1` | Dernier défi du jour réussi, nombre de jours de suite, gels de série en réserve |
| Record de série | `go.serie-record.v1` | Plus longue série, et dernière série perdue déjà annoncée (#212) |
| Visites | `go.visite.v1` | Jour de la dernière visite et nombre de jours d'absence, pour l'accueil au retour (#213) |
| XP et niveau | `go.xp.v1`, `go.xp.premieres.v1` | Total d'XP, premières fois déjà récompensées |
| Badges | `go.badges.v1`, `go.paliers-fetes.v1` | Badges gagnés sur l'appareil, paliers déjà fêtés |
| Parties contre l'ordi | `go.parties.v1`, `go.bilan.v1`, `go.adversaire.v1` | Nombre de parties, victoires et défaites par adversaire, dernier adversaire choisi |
| Partie guidée | `go.guidee.v1` | Niveau de force atteint par Mochi à la fin de la dernière partie guidée (un nombre de 0 à 10), pour reprendre au même niveau |
| Revue et erreurs | `go.revue.v1`, `go.erreurs.v1` | Dernière partie terminée ou importée (coups au format SGF, date ; pour une partie importée : les noms des joueurs et le résultat tirés du fichier, et ta couleur), rien n'est envoyé au serveur, jusqu'à 30 erreurs à rejouer (position, coups acceptés, date du prochain passage, réussites et échecs) |
| Explications déjà vues | `go.intro-but.v1`, `go.atari-explique.v1`, `go.komi-explique.v1`, `go.passer-explique.v1` | Pour ne pas répéter une explication |
| Installation | `go.installation.v1`, `go.premiere-victoire.v1`, `go.retours.v1`, `go.annonce-du-jour.v1` | Proposition d'installer l'app déjà montrée, refusée ou acceptée ; repère de première victoire ; nombre de jours d'ouverture, pour proposer l'installation au 2e retour (#214) ; jour de la dernière annonce de Mochi, pour ne pas proposer l'installation le même jour (#236) |
| Session de connexion | Clé gérée par Supabase (`sb-<réf. du projet>-auth-token`) | Seulement si tu te connectes, ou si tu ouvres un défi par lien sans compte : jetons de session, identifiant technique du compte, e-mail s'il y en a un. Sert à rester connecté. Effacée à la déconnexion ou avec les données du site |
| Réseau de l'IA | Cache du navigateur `katago-reseaux-v1` | Le réseau de KataGo (fichier public), gardé pour jouer hors ligne. Aucune donnée personnelle |
| App hors ligne | Cache du navigateur `go-shell-v1` (service worker, site en production) | Pages, images et polices de l'app, pour l'ouvrir sans réseau. Aucune donnée personnelle |
| Suivi détaillé (PostHog) | Stockage géré par PostHog (`ph_…_posthog`) | Identifiant tiré au hasard. **Écrit seulement si tu as dit « Oui »** (section 3.3) |

**Proposer d'installer l'app.** À partir de ton 2e jour de visite, l'app peut te proposer, **une seule fois** sur l'accueil, de l'installer sur ton écran d'accueil ; une ligne « Installer l'app » reste aussi dans le Profil. Pour savoir si c'est possible, elle lit sur l'appareil le type de navigateur et si l'app est déjà installée. Ces informations restent sur l'appareil ; seuls le fait que la carte a été montrée et, sur Chrome, ta réponse partent dans le comptage (section 3.3).

### 3.2 Sur notre serveur (Supabase, Paris), si tu crées un compte ou joues un défi par lien

| Traitement | Données | Finalité | Base légale (art. 6 RGPD) | Durée de conservation |
|---|---|---|---|---|
| **Compte joueur** | Adresse e-mail, dates de création et de dernière connexion, pseudo, cote de partie, cote des problèmes, historique de ces cotes, date de création du profil | Te connecter par lien e-mail, t'identifier auprès des autres joueurs | Exécution du contrat (CGU) | Tant que le compte existe. **À valider** : durée maximale pour un compte inactif (section 9, E7). |
| **Série de jours** | Nombre de jours de suite et dernier jour réussi, gels de série et jours gelés | Garder ta série d'un appareil à l'autre | Exécution du contrat | Tant que le compte existe. |
| **Envoi de la série de l'appareil** | À chaque connexion : nombre de jours de suite et date du dernier jour réussi, lus sur l'appareil (`importer_serie_appareil`) | Ne pas perdre la série faite avant de créer ton compte ou sur un autre appareil | Exécution du contrat | Le serveur ne garde que la plus longue des deux séries, dans ton profil. Il refuse une série impossible (plus de jours que depuis le lancement, ou dernier jour trop ancien). |
| **Parties en ligne** | Parties, coups (format SGF), résultats, adversaires, dates, file d'attente de recherche d'adversaire (taille du plateau et cote, effacée après 10 minutes) | Jouer en ligne, calculer la cote, revoir tes parties | Exécution du contrat | Tant que le compte existe. À la suppression du compte, les parties contre un autre joueur restent pour lui, **anonymisées** (section 6). |
| **Défi par lien** | Jeton du lien (32 caractères tirés au hasard), qui l'a créé, qui l'a rejoint, délai par coup (3 jours), date limite du coup en cours, date limite du lien, date de création, coups et résultat de la partie (9 × 9, non classée) | Jouer une partie en différé avec un ami, constater la victoire au temps | Exécution du contrat | Tant que le compte (ou la session sans compte) existe. Le lien ne sert plus après l'arrivée de l'ami, ni au-delà de 7 jours. La partie et le défi ne sont visibles que par leurs deux joueurs. Le jeton est placé après le `#` de l'adresse : il n'est pas envoyé à notre hébergeur (voir toutefois section 3.3). |
| **Session sans compte** | Quand tu ouvres ou crées un défi sans être inscrit : un compte technique « anonyme » chez Supabase (identifiant, dates de création, de connexion et de dernière activité), avec un profil sans pseudo (cote de départ) | Te laisser jouer tout de suite, puis garder ta partie si tu t'inscris | Exécution du contrat | **60 jours sans activité**, puis suppression automatique (tâche quotidienne, `purger_anonymes_inactifs`). L'activité est la plus récente de : création, connexion, rafraîchissement de la session, coup joué dans une de tes parties. Tes parties contre un autre joueur restent pour lui, **anonymisées**, comme à la suppression d'un compte ; les autres sont effacées. Si tu t'inscris avant (en reliant ton e-mail), tout est gardé dans ton compte. |
| **Progression** | Leçons commencées et terminées, essais de problèmes (réussi ou non, cote après l'essai), badges, amis | Garder ta progression d'un appareil à l'autre, afficher tes badges et tes amis | Exécution du contrat | Tant que le compte existe. |

**Ce qu'une session sans compte peut faire.** Seulement le défi par lien : créer un défi (3 en attente au plus), rejoindre un défi, y jouer, l'abandonner, constater la victoire au temps. Elle ne peut pas choisir de pseudo, jouer en ligne hors défi, ajouter des amis, gagner une cote ou des badges sur le serveur, ni y enregistrer ses leçons ou sa série : sans compte, ta progression reste sur ton appareil (section 3.1). Ces limites sont appliquées par le serveur.

*Note pour la relecture, à retirer de la version publiée :* le défi par lien et les parties en ligne sont prêts côté serveur ; leurs écrans ne sont pas encore dans l'app. Cette section les décrit pour qu'elle reste juste à leur arrivée.

### 3.3 Mesure d'audience (PostHog, Union européenne)

**Ce qui est envoyé, et quand.** Le code (`src/data/analytics.ts`) a trois niveaux :

| Niveau | Quand | Ce qui part |
|---|---|---|
| **Anonyme** | Par défaut, dès l'ouverture de l'app, **avant même ta réponse à la fenêtre**, et si tu réponds « Non merci » | Les événements ci-dessous, avec un identifiant tiré au hasard **gardé en mémoire seulement** : il change à chaque ouverture de l'app. Rien n'est écrit sur l'appareil. Pas de profil, jamais ton compte. |
| **Complet** | Seulement après « Oui » | Les mêmes événements, avec un identifiant tiré au hasard **gardé sur l'appareil**, et, si tu es connecté, l'identifiant technique de ton compte (jamais ton e-mail ni ton pseudo). |
| **Aucun** | Si tu t'opposes au comptage anonyme (interrupteur dans Profil, Conditions et confidentialité) | Rien. PostHog n'est pas chargé. S'opposer retire aussi ton « Oui ». |

**Événements envoyés** (détail des propriétés : `docs/data/plan-de-marquage.md`) :

- ouverture de l'app : `app_ouverte` (avec « app installée ou non ») ;
- parties : `premiere_pierre`, `partie_commencee`, `comptage_manuel`, `partie_terminee`, `premiere_partie_terminee` (taille, adversaire, nombre de coups, résultat, secondes écoulées) ;
- leçons : `lecon_commencee`, `lecon_terminee` ;
- problèmes : `probleme_resolu`, `probleme_termine` (premier essai réussi ou non, cote estimée du joueur et difficulté du problème), `solution_vue`, `erreur_rejouee`, `erreur_maitrisee`, `revision_faite` ;
- course aux problèmes : `course_terminee` (score, erreurs, durée, raison de la fin), `course_partagee` (score, meilleur score, partage ou copie) ;
- placement « Je sais déjà jouer » : `placement_commence`, `placement_termine` (niveau estimé en kyu), `placement_saute` (étape où tu l'as passé) ;
- revue : `revue_ouverte`, `revue_rejouer`, `import_sgf_commence`, `import_sgf_reussi`, `import_sgf_erreur` (partie importée : source — fichier, texte collé ou lien OGS —, taille du fichier, nombre de coups, taille du plateau, handicap, raison d'un refus ; jamais les noms, les coups ni le numéro de la partie OGS) ;
- Go du jour et série : `go_du_jour_resolu`, `go_du_jour_partage`, `arrivee_par_partage`, `gel_gagne`, `gel_utilise`, `serie_perdue` ;
- progression : `xp_gagne`, `niveau_atteint` ;
- installation : `installation_proposee`, `installation_acceptee` ;
- compte : `lien_connexion_envoye`, `inscription`.
- défi par lien : `defi_cree` (lien créé, avec ou sans compte), `defi_ouvert` (lien ouvert par l'ami, avec ou sans compte), `defi_inscription` (e-mail ajouté à une partie commencée sans compte) ; jamais le lien, ni l'identifiant de la partie, ni l'e-mail.

Chaque événement porte aussi la version de l'app, l'environnement (`production`…) et le niveau de mesure en vigueur (`mesure` : `anonyme` ou `complet`). Certains portent des valeurs tirées de ta progression sur l'appareil : série de jours, record, jours manqués, gels, total d'XP, niveau, meilleur score de la course.

Aucun événement ne contient ton e-mail, ton pseudo, tes coups, le jeton d'un défi ni l'identifiant d'une partie. Les parties en ligne et le défi par lien n'envoient pas encore d'événement.

**Ce que le navigateur transmet en plus.** La bibliothèque PostHog ajoute d'elle-même des informations techniques : navigateur et version, système et version, type d'appareil, taille de l'écran et de la fenêtre, langue, adresse complète de la page (avec ses paramètres, par exemple le numéro d'un Go du jour partagé, et, dans la version actuelle, la partie après le `#`), page d'où tu viens et, dans une app comme Facebook ou Instagram, le nom de cette app. **À corriger avant l'ouverture du défi par lien** : la partie après le `#` peut contenir le jeton d'un défi ou, au retour du lien de connexion reçu par e-mail, des jetons de session ; elle doit être retirée avant l'envoi (section 9, E14).

**Adresse IP et localisation.** PostHog ne conserve **pas** ton adresse IP (réglage « Discard client IP data » activé, vérifié le 27/09). Depuis le 28/09 (#227), chaque événement porte aussi la consigne `$geoip_disable` : PostHog **ne déduit plus de localisation** de l'adresse IP. Les événements reçus avant cette date peuvent contenir une localisation approximative (pays, région). Par sécurité, la transformation GeoIP peut aussi être coupée dans le projet PostHog (section 9, E2).

| Traitement | Finalité | Base légale | Durée |
|---|---|---|---|
| **Comptage anonyme** (niveau anonyme) | Statistiques d'usage anonymes : combien de parties, de leçons, d'abandons | Intérêt légitime (améliorer le jeu), art. 6.1.f RGPD ; accès à l'appareil couvert par l'exemption CNIL de mesure d'audience (art. 82 loi Informatique et Libertés, délibération 2020-091). **À valider** (voir `consentement.md` et section 9) | **1 an** (durée fixée par l'offre gratuite de PostHog Cloud), dans la limite CNIL de 25 mois. |
| **Suivi détaillé** (niveau complet) | Savoir si les joueurs reviennent (rétention), améliorer l'apprentissage | Consentement (art. 6.1.a RGPD et art. 82 loi Informatique et Libertés) | **1 an** pour les événements. L'identifiant sur l'appareil reste jusqu'au retrait de l'accord ou à l'effacement des données du site. |

### 3.4 Rapports de bugs (Sentry, avec ton accord)

| Données | Finalité | Base légale | Durée |
|---|---|---|---|
| Message et pile d'erreur, version de l'app, navigateur et système, adresse de la page concernée, identifiant technique du compte si tu es connecté, et le fil des dernières actions techniques avant l'erreur, que Sentry note par défaut (pages visitées, éléments touchés, adresses des requêtes au serveur, messages de la console). Jamais ton e-mail (`sendDefaultPii: false`). | Corriger les plantages | Consentement | **[À COMPLÉTER PAR FLORIAN : durée réglée dans Sentry, 30 ou 90 jours selon l'offre]** |

Sans ton « Oui », Sentry n'est pas chargé ; si tu retires ton accord, il est arrêté.

### 3.5 Hébergement (Vercel)

| Données | Finalité | Base légale | Durée |
|---|---|---|---|
| Adresse IP et données techniques de la requête (journaux du serveur) | Afficher le site et l'app, sécurité | Intérêt légitime (sécurité et fonctionnement) | Durée des journaux fixée par Vercel (quelques jours sur l'offre actuelle). **À vérifier.** |

Nous ne collectons **ni** ton nom, **ni** ta date de naissance, **ni** ta position précise, **ni** tes contacts. Aucune localisation n'est déduite de ton adresse IP (section 3.3). Il n'y a pas de messagerie entre joueurs à ce jour.

## 4. Qui reçoit tes données ?

Seulement nous et nos sous-traitants techniques, qui agissent sur nos instructions (art. 28 RGPD) :

| Sous-traitant | Rôle | Lieu des serveurs | Transfert hors UE |
|---|---|---|---|
| Supabase Inc. | Base de données, connexion, temps réel | Union européenne (Paris, `eu-west-3`) | Société américaine : accès possible depuis les États-Unis pour le support. Encadré par le DPA de Supabase et les clauses contractuelles types. **À vérifier.** |
| PostHog Inc. | Mesure d'audience | Union européenne (Francfort) | Société américaine : même remarque. DPA et Data Privacy Framework **à vérifier**. |
| Functional Software Inc. (Sentry) | Rapports de bugs | Union européenne (Francfort) | Société américaine : même remarque. **À vérifier.** |
| Vercel Inc. | Hébergement et diffusion du site | Réseau mondial (le site est servi depuis le point le plus proche de toi) | Oui, possible. Encadré par le DPA de Vercel (clauses contractuelles types, Data Privacy Framework). **À vérifier.** |

**Téléchargement du réseau de l'IA.** Au premier lancement de l'IA, l'app télécharge le réseau de KataGo (un fichier public). Par défaut, le code le prend sur GitHub (`raw.githubusercontent.com`, GitHub Inc., États-Unis), qui voit alors ton adresse IP comme pour toute page web. **À vérifier** : si la production sert ce fichier depuis notre propre hébergement (variable `VITE_KATAGO_MODEL_URL`), cette ligne disparaît ; sinon, GitHub doit être cité ici comme destinataire.

**Lien de partie OGS.** Si tu colles un lien `online-go.com/game/…` pour analyser une partie, ton appareil demande le fichier SGF de cette partie directement à OGS (Online Go Server), qui voit alors ton adresse IP et le numéro de la partie, comme si tu ouvrais la page. Rien ne passe par nos serveurs et la partie reste sur ton appareil. Avec un fichier ou un texte collé, aucun tiers n'est contacté.

**Ce que les autres voient** (règles de sécurité de la base, état du 29/09) :

- **Ton profil** : pseudo, cote de partie, cote des problèmes, série de jours, gels et jours gelés, date de création. Il peut être lu par n'importe qui avec l'app, **même sans être connecté** (section 9, E16).
- **Tes badges** : visibles par les joueurs connectés, y compris une session sans compte.
- **Tes parties en ligne entre humains**, en cours ou finies : visibles par les joueurs connectés, y compris une session sans compte. **Sauf les défis par lien**, visibles seulement par leurs deux joueurs.
- **Jamais** ton e-mail, tes leçons, tes essais de problèmes, ton historique de cote, tes amis, tes parties contre l'ordinateur.

Nous ne vendons, ne louons et ne partageons tes données avec **aucun** annonceur ni courtier en données. L'app n'affiche **aucune publicité**.

## 5. Mineurs

- En France, un mineur peut consentir seul au traitement de ses données pour un service en ligne **à partir de 15 ans** (art. 45 loi Informatique et Libertés, art. 8 RGPD).
- **Règle retenue :**
  - Jouer **sans compte** est ouvert à tous, sans limite d'âge : ta progression reste sur l'appareil ; seul le comptage anonyme part (et tu peux t'y opposer).
  - Jouer un **défi par lien sans compte** crée une session sans compte sur le serveur, sans e-mail ni pseudo, effacée après 60 jours sans activité. **À valider** : l'ouvrir aussi avant 15 ans sans accord d'un parent (section 9, E19).
  - **Créer un compte** : à partir de 15 ans seul ; **avant 15 ans, avec l'accord d'un parent** (ou du titulaire de l'autorité parentale), qui consent pour l'enfant.
  - Le **suivi détaillé et les rapports de bugs** reposent sur le consentement : avant 15 ans, ils doivent être acceptés avec un parent.
- Les profils montrent le pseudo, les cotes, la série et les badges (section 4) ; l'app ne demande ni photo, ni âge, ni localisation, et il n'y a pas de messagerie libre. Le défi par lien se partage hors de l'app (message, copie du lien) : aucun échange libre entre joueurs dans l'app.
- Un parent peut demander l'accès ou la suppression du compte de son enfant (section 6).
- **À valider** : mode de recueil de l'accord parental. **L'écran de création de compte ne pose aujourd'hui aucune question sur l'âge** (section 9). Vérifier aussi l'état d'application de la loi du 7 juillet 2023 sur la majorité numérique, qui vise surtout les réseaux sociaux : ne pas l'appliquer sans avis.

## 6. Tes droits

Tu disposes des droits suivants (art. 15 à 22 RGPD) :

- **Accès** : savoir quelles données nous avons sur toi et en obtenir une copie.
- **Rectification** : corriger une donnée inexacte (ton pseudo, par exemple).
- **Effacement** : faire supprimer ton compte et les données associées.
- **Limitation** et **opposition** : notamment t'opposer au comptage anonyme, avec l'interrupteur « Comptage anonyme des parties » dans Profil, Conditions et confidentialité.
- **Retrait du consentement** à tout moment, aussi simplement que tu l'as donné, avec l'interrupteur « Rapports de bugs et suivi détaillé ». Le retrait ne remet pas en cause ce qui a été fait avant.
- **Portabilité** : recevoir tes parties (SGF) et ta progression dans un format lisible.
- **Directives après ton décès** (art. 85 loi Informatique et Libertés).

**Comment faire :** écris à **[À COMPLÉTER PAR FLORIAN : adresse e-mail de contact]**. Nous répondons dans un délai d'**un mois** (prolongeable de deux mois si la demande est complexe, en te prévenant). Nous pouvons te demander de confirmer ta demande depuis l'adresse e-mail de ton compte.

**Supprimer ton compte depuis l'app** (dans Profil, sous ton compte : « Supprimer mon compte », puis taper SUPPRIMER) : la suppression est immédiate et définitive, en une seule opération sur le serveur.

- **Supprimés** : ton compte de connexion (e-mail), ton profil (pseudo, cote, série, gels), l'historique de ta cote, tes leçons, tes essais de problèmes, tes badges, tes amitiés, ta place dans la file d'attente, tes parties contre l'ordinateur et tes parties sans adversaire.
- **Gardées, anonymisées** : les parties jouées contre un autre joueur restent pour lui ; ta place y devient « joueur supprimé ».
- **Non touchées par ce bouton** : les données de ton appareil (effacer les données du site ou désinstaller l'app), les événements de mesure déjà envoyés (sans lien avec toi au niveau anonyme ; liés à l'identifiant technique de ton compte si tu avais dit « Oui » : ils s'effacent au bout d'un an, ou plus tôt sur demande à l'adresse ci-dessus), et les rapports de bugs (effacés à la fin de leur durée de conservation).

**Sans compte** : effacer les données du site dans ton navigateur, ou désinstaller l'app, supprime tout ce qui est sur ton appareil.

**Session sans compte (défi par lien)** : elle est effacée d'elle-même après 60 jours sans activité, avec les mêmes règles que « Supprimer mon compte » (parties contre un autre joueur gardées pour lui, anonymisées ; les autres effacées). Pour l'effacer plus tôt, écris-nous à l'adresse ci-dessus. Effacer les données du site retire la session de ton appareil, mais pas du serveur avant ces 60 jours.

**Réclamation** : si tu estimes que tes droits ne sont pas respectés, tu peux saisir la **CNIL** (3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07, www.cnil.fr).

## 7. Sécurité

Connexions chiffrées (HTTPS). Accès à la base limité par des règles de sécurité au niveau des lignes (RLS) : chaque joueur ne peut modifier que ses propres données. Les colonnes sensibles (cote, série) ne s'écrivent que par des fonctions serveur qui vérifient les valeurs. Aucune clé d'administration côté app. Pas de mot de passe stocké : la connexion se fait par lien envoyé par e-mail.

## 8. Changements

Si cette politique change de façon importante, nous te prévenons dans l'app avant l'entrée en vigueur. Date d'entrée en vigueur : **[À COMPLÉTER PAR FLORIAN : date]**.

---

## 9. Pour Florian et l'avocat : écarts entre le code et un RGPD strict (28/09, revu le 29/09)

Cette section n'est pas destinée aux joueurs : à retirer de la version publiée. La relecture juridique ne modifie pas la logique de l'app ; chaque point ouvert demande une décision ou une issue confiée à l'agent concerné.

**Bilan au 29/09** : corrigés E5, E11, E13, E15 ; E2 corrigé dans le code (reste le réglage PostHog) ; ouverts E1, E3, E4, E6 à E10, E12, E14, E16 à E18 ; à valider par l'avocat E19 ; à faire à l'arrivée du code E20. **Priorité avant l'ouverture du défi par lien : E14** (jetons dans l'adresse envoyée à PostHog et Sentry).

| # | Écart constaté | Où | Risque | Piste et état |
|---|---|---|---|---|
| E1 | **Des événements partent vers PostHog sans accord**, dès l'ouverture et même après « Non merci » (niveau anonyme). C'est le choix de #64, fondé sur l'exemption CNIL de mesure d'audience, mais PostHog n'est pas un outil examiné par la CNIL et le CEPD (lignes directrices 2/2023) lit largement l'« accès au terminal ». | `track()` n'est bloqué qu'au niveau `aucun` | Moyen : l'exemption doit être démontrée par nous (outil d'auto-évaluation CNIL) | **Ouvert.** Faire l'auto-évaluation CNIL et la garder ; ou n'envoyer qu'après accord (perte de la mesure de base). |
| E2 | **Localisation déduite de l'IP** (pays, région, coordonnées approchées) gardée par PostHog sur tous les événements, y compris anonymes. L'ancienne politique disait « ni ta localisation ». | Réglage du projet PostHog (transformation GeoIP) | Moyen à fort pour l'exemption : la CNIL admet une géolocalisation limitée à la ville ; des coordonnées, même approchées, vont au-delà du besoin | **Corrigé dans le code le 28/09 (#227)** : `$geoip_disable` sur chaque envoi (`sansLocalisation`, test dans `analytics.test.ts`). **Reste** à couper aussi la GeoIP dans le projet PostHog, par sécurité, et à vérifier les événements reçus. |
| E3 | **Informations techniques envoyées par défaut** par la bibliothèque PostHog (navigateur, système, taille d'écran, langue, adresse complète de la page, page précédente, app hôte), sans accord. | `POSTHOG_ANONYME` ne les filtre pas (`property_denylist` absent) ; `save_referrer: false` n'empêche pas l'envoi de `$referrer` | Faible à moyen : minimisation (art. 5.1.c) | **Ouvert.** Filtrer au minimum utile (par exemple garder type d'appareil et système, retirer `$referrer`, `$current_url`, `$raw_user_agent`). Voir aussi E14, plus urgent. |
| E4 | **Valeurs lues dans le stockage de l'appareil et envoyées sans accord** : série, record, jours manqués, gels, total d'XP, niveau. Elles décrivent le joueur d'un jour à l'autre, alors que le niveau anonyme est censé ne rien relier entre deux visites. | `serie_perdue`, `revision_faite`, `go_du_jour_resolu`, `gel_*`, `xp_gagne`, `niveau_atteint`, `course_partagee` (meilleur score) | Faible : pas d'identifiant, mais cela affaiblit l'argument « statistiques anonymes » | **Ouvert.** Arrondir en tranches (1, 2-6, 7-29, 30+) au niveau anonyme, ou n'envoyer ces propriétés qu'au niveau complet. |
| E5 | **Retrait de l'accord : l'identifiant PostHog et les repères `go.evenement.*` restent sur l'appareil.** | `appliquer()`, `trackOnce()` | Faible | **Corrigé le 28/09 (#227)** : `effacerTraces()` retire `ph_*`, `__ph_opt_in_out_*` et `go.evenement.*` au retrait. Reste à vérifier dans un vrai navigateur. |
| E6 | **La suppression du compte ne se propage pas à PostHog ni à Sentry** : les événements liés à l'identifiant du compte (niveau complet) restent un an. Même chose pour la purge des sessions sans compte (#318). | `delete_my_account()` et `purger_anonymes_inactifs()` ne touchent que Supabase | Moyen : droit à l'effacement (art. 17) | **Ouvert.** Supprimer la « personne » PostHog de ce compte (API PostHog, depuis une fonction serveur) ; à défaut, traiter la demande à la main et le dire (fait dans cette politique, section 6). |
| E7 | **Aucune durée maximale pour un compte inactif.** Tout est gardé « tant que le compte existe ». La CNIL recommande de supprimer ou d'anonymiser après une période d'inactivité (souvent 2 à 3 ans). | Schéma Supabase | Moyen : limitation de la conservation (art. 5.1.e) | **Ouvert.** #318 ne couvre que les sessions sans compte. Fixer une durée pour les vrais comptes (par exemple 3 ans sans connexion, avec e-mail d'avertissement un mois avant) ; la tâche planifiée de #318 peut servir de modèle. |
| E8 | **Pas de question d'âge à l'inscription.** Les CGU et cette politique exigent l'accord d'un parent avant 15 ans, mais l'écran de compte ne le demande pas. | `src/app/Account.tsx` | Moyen (art. 8 RGPD, art. 45 LIL) | **Ouvert.** Case déclarative « J'ai 15 ans ou plus, ou l'accord d'un parent » à l'inscription (minimum), y compris quand un invité relie son e-mail après un défi (`garderMonCompte`). |
| E9 | **Aucun moyen d'exercer ses droits aujourd'hui** : le contact affiché est « bientôt disponible », et il n'y a pas d'export des données (accès, portabilité). | `src/app/Confidentialite.tsx` | Fort dès l'ouverture au public | **Ouvert.** Remplir l'adresse de contact avant tout lancement public. Export SGF et progression plus tard. |
| E10 | **Réseau de KataGo téléchargé chez GitHub** par défaut : l'IP du joueur part chez un tiers américain. | `DEFAULT_MODEL_URL` dans `src/engine/katago/loader.ts` | Faible | **Ouvert.** Servir le fichier depuis Vercel (`npm run fetch-model` et `VITE_KATAGO_MODEL_URL`), ou citer GitHub comme destinataire. La page de l'app ne dit plus « personne d'autre » (29/09). |
| E11 | **Texte de l'app à réaligner** avec cette politique. | `src/app/Confidentialite.tsx`, catalogue `src/content/i18n` | Faible | **Corrigé le 28/09 (#227)**, puis le 29/09 (#223) : la page ne dit plus « Personne d'autre ne reçoit tes données » (faux : prestataires, GitHub, autres joueurs) ; elle cite les prestataires, les infos techniques envoyées au comptage, la série et la progression gardées avec un compte, et la session sans compte du défi (60 jours). FR et EN. |
| E12 | **Durées encore non définies** : Sentry (champ 7), journaux Vercel. | Réglages des services | Faible | **Ouvert.** Relever les deux durées et les écrire ici. |
| E13 | **Sessions sans compte (défi par lien, #81) gardées sans limite.** | `rejoindre_defi`, `signInAnonymously` | Faible : aucune donnée directe, mais conservation sans fin | **Corrigé le 29/09 (#318)** : les utilisateurs anonymes sans activité depuis 60 jours (décision de Florian) sont supprimés chaque nuit par `purger_anonymes_inactifs` (pg_cron, 03:17 UTC, 500 au plus par passage) ; les parties partagées restent anonymisées comme à la suppression du compte. **Reste** à vérifier en production que la tâche `purger-anonymes-inactifs` est bien planifiée (`cron.job`). |
| E14 | **La partie de l'adresse après le `#` part chez PostHog (et Sentry)**. PostHog envoie `$current_url` avec le fragment (`disable_capture_url_hashes` est faux par défaut dans posthog-js 1.434, sans réglage `defaults` récent) ; Sentry note aussi l'adresse de la page. Or le fragment porte : 1) le **jeton d'un défi** (`/defi#<jeton>`, #81), qui donne la place de l'invité à qui le détient ; 2) au retour du lien de connexion par e-mail, les **jetons de session Supabase** (connexion en mode `implicit` par défaut : `#access_token=…&refresh_token=…`), si l'événement `app_ouverte` part avant que Supabase ait nettoyé l'adresse. Sans accord, au niveau anonyme. | `POSTHOG_ANONYME` (`src/data/analytics.ts`), `createClient` sans `flowType` (`src/data/supabase.ts`), `lienDefi` (`src/data/defi.ts`) | **Fort** (sécurité et minimisation) : un jeton de session permet d'agir au nom du joueur ; un jeton de défi permet de prendre la place de l'ami | **Ouvert, à corriger avant l'écran du défi** (périmètre data/front, pas de la relecture juridique) : ajouter `disable_capture_url_hashes: true` à `POSTHOG_ANONYME` (ou retirer le fragment dans `sansLocalisation`/`before_send`) ; côté Sentry, retirer le fragment dans `beforeSend` et `beforeBreadcrumb` ; envisager `flowType: 'pkce'`. Vérifier dans un vrai navigateur, puis purger de PostHog les événements déjà reçus avec un fragment. |
| E15 | **Deux stockages de l'appareil n'étaient pas cités** : la session de connexion Supabase (`sb-<réf.>-auth-token`, dans `localStorage`) et le cache hors ligne du service worker (`go-shell-v1`). | `@supabase/supabase-js` (réglages par défaut), `public/sw.js` | Faible : les deux sont strictement nécessaires (exemption de consentement) | **Corrigé le 29/09 (#223)** : cités en section 3.1 ; le test vérifie désormais les caches et la session. |
| E16 | **Profils lisibles par tous, sans connexion** : la règle « Profils visibles par tous » (`to anon, authenticated using (true)`) expose à quiconque a la clé publique la table entière : pseudo, cotes, série, gels, jours gelés, date de création, pour tous les comptes. L'ancienne politique disait « pseudo, cote, badges ». | Migration `20260926235151_profils_joueurs.sql` | Moyen : minimisation, et aspiration facile de la liste des joueurs | **Ouvert.** Décrit honnêtement en section 4. Piste (backend) : lecture réservée aux joueurs connectés et vue publique limitée au pseudo et à la cote ; série et gels lisibles seulement par leur titulaire. |
| E17 | **Parties en ligne entre humains lisibles par tout joueur connecté**, y compris une session sans compte créée en un clic par un inconnu. Seuls les défis sont privés. | Politique de lecture de `games` (`20260929003100_defi_par_lien.sql`) | Faible à moyen : pas de donnée directe, mais les parties sont reliées aux identifiants des joueurs | **Ouvert.** Décrit en section 4. Décider si c'est voulu (parties publiques comme sur les serveurs de go) ; sinon, réserver aux vrais comptes ou aux joueurs de la partie. |
| E18 | **Colonnes `avatar_url` et `country` modifiables par chaque joueur** par l'API, non utilisées par l'app. Un joueur pourrait y mettre l'adresse d'une image non modérée, lisible par tous (E16). | Droit `update (username, avatar_url, country)` sur `profiles` | Faible aujourd'hui (rien ne l'affiche), moyen si un écran l'affiche un jour | **Ouvert.** Retirer ce droit tant qu'aucun écran ne s'en sert (nouvelle migration), ou encadrer (images hébergées et modérées par nous). La politique dit que l'app ne demande ni photo ni localisation. |
| E19 | **Session sans compte ouverte à tout âge** : un enfant de moins de 15 ans qui ouvre un défi crée une donnée sur le serveur (identifiant, parties) sans accord d'un parent. Base retenue : exécution du contrat, pas le consentement. | `assurerSession` (`src/data/defi.ts`) | Faible : ni e-mail, ni pseudo, 60 jours au plus | **À valider par l'avocat.** Si l'écran du défi arrive, y mettre une ligne courte (« Tu joues sans compte : ta partie est gardée 60 jours ») et le lien vers les conditions. |
| E20 | **Événements à venir, pas encore dans le code** : des propriétés enrichies pour `arrivee_par_partage` et un futur `probleme_termine`. | `EVENTS` | Faible | **À faire à leur arrivée** : les citer en section 3.3 (le test échoue sinon). **Fait le 29/09 pour le défi par lien (#81)** : `defi_cree`, `defi_ouvert`, `defi_inscription` sont cités en 3.3 ; aucun ne porte le jeton, l'identifiant de partie ni l'e-mail (test `src/app/adresseDefi.test.ts`), et le jeton quitte l'adresse avant tout événement. |
