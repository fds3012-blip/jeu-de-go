# Politique de confidentialité (issues #111 et #223)

Projet rédigé par le responsable juridique (non-avocat). Première version le 27 septembre 2026, mise à jour le 28 septembre 2026 (#223) après les ajouts de la nuit : nouveaux événements de mesure, envoi de la série de l'appareil à la connexion, nouvelles données gardées sur l'appareil, proposition d'installer l'app, suppression du compte dans l'app (#114). **À faire relire par un avocat ou un DPO avant la mise en production.**

Elle décrit ce que l'app fait réellement le 28/09 : code de `src/data` et `src/app`, schéma de `supabase/migrations`, plan de marquage `docs/data/plan-de-marquage.md`, analyse `docs/juridique/consentement.md`, et les propriétés réellement reçues par PostHog (lues le 28/09 dans le projet PostHog). Un test (`src/data/politiqueConfidentialite.test.ts`) échoue si une clé de stockage de l'appareil ou un événement de mesure n'est pas cité ici.

## Pour Florian : champs à compléter avant publication

Aucune adresse ni identité n'a été inventée. Tant que ces champs sont vides, l'app affiche « Contact : bientôt disponible ».

1. **Responsable du traitement** : nom et prénom (personne physique) ou raison sociale et forme (société).
2. **Adresse postale** du responsable du traitement.
3. **Numéro SIREN / RCS** (si société ou entrepreneur individuel).
4. **Adresse e-mail de contact « données personnelles »** (dédiée de préférence, par exemple une adresse sur le domaine du jeu).
5. **Délégué à la protection des données** : nom et contact, ou mention qu'aucun DPO n'est désigné (non obligatoire à ce stade, à confirmer par l'avocat).
6. **Date d'entrée en vigueur** de la politique.
7. **Durée de conservation des rapports de bugs** réglée dans Sentry.

Points à vérifier en parallèle (des preuves à conserver, pas des champs) : DPA signés avec Supabase, PostHog, Sentry et Vercel ; adhésion de ces sociétés au Data Privacy Framework ; région Sentry réellement choisie (UE, Francfort) ; réglage de la géolocalisation dans PostHog (section 3.3) ; adresse réelle d'où l'app télécharge le réseau de KataGo en production (section 4).

---

## 1. Qui est responsable de tes données ?

Le responsable du traitement est **[À COMPLÉTER PAR FLORIAN : nom ou raison sociale]**, **[À COMPLÉTER PAR FLORIAN : adresse postale]**, **[À COMPLÉTER PAR FLORIAN : SIREN / RCS, le cas échéant]**.

Contact pour toute question sur tes données : **[À COMPLÉTER PAR FLORIAN : adresse e-mail de contact]**.

Délégué à la protection des données : **[À COMPLÉTER PAR FLORIAN : nom et contact du DPO, ou « aucun DPO désigné »]**.

## 2. En bref

- Tu peux jouer **sans compte**. Tes réglages et ta progression restent alors **sur ton appareil**. Nous n'y avons pas accès.
- L'IA (KataGo) calcule **sur ton appareil** : tes parties contre l'ordinateur ne sont pas envoyées.
- Si tu crées un compte, ta progression est gardée **sur notre serveur** (Supabase, Paris). À la connexion, la **série de jours** de ton appareil y est envoyée pour ne pas la perdre.
- Par défaut, nous comptons ce qui se passe dans le jeu de façon **anonyme** : sans cookie, sans identifiant qui dure, sans lien avec ton compte. **Ce comptage part sans demander ton accord** (la CNIL l'autorise pour la mesure d'audience ainsi réglée). Tu peux **t'y opposer** d'un geste.
- Les **rapports de bugs** et le **suivi détaillé** (savoir si tu reviens jouer) ne démarrent **qu'avec ton accord**.
- Tu peux **supprimer ton compte depuis l'app** (dans Profil, sous ton compte).
- **Aucune vente de données. Aucune publicité.** Aucune donnée n'est utilisée pour du profilage publicitaire.

## 3. Quelles données, pourquoi, sur quelle base, combien de temps

### 3.1 Sur ton appareil (stockage local du navigateur ou de l'app)

Ces données sont écrites dans le stockage local (`localStorage`) de ton navigateur ou de l'app. Elles ne nous sont **pas envoyées**, sauf la série de jours, envoyée au serveur à la connexion si tu as un compte (section 3.2), et les valeurs jointes à certains événements de mesure (section 3.3).

- **Finalité** : faire fonctionner le jeu sans compte et garder ta progression d'une visite à l'autre.
- **Base légale** : exécution du service que tu demandes (art. 6.1.b RGPD). Écrire et lire ces données est **strictement nécessaire** au service (exemption de consentement, art. 82 loi Informatique et Libertés).
- **Durée** : jusqu'à ce que tu effaces les données du site ou désinstalles l'app. Supprimer ton compte **n'efface pas** ces données : elles sont sur ton appareil, pas chez nous.

| Données | Clé de stockage | Contenu |
|---|---|---|
| Réglages | `go.settings.v1`, `go.themeGoban.v1` | Thème, taille du plateau, son, vibrations, fêtes, aide, confirmation du coup, décor du plateau |
| Choix sur la mesure | `go.consentement.v1`, `go.mesure.opposition.v1` | Ta réponse à la fenêtre (« Oui » ou « Non merci ») et ton opposition au comptage anonyme |
| Repères d'événements | `go.evenement.<nom>` (par exemple `go.evenement.premiere_pierre`) | « Déjà envoyé une fois » pour certains événements. **Écrits seulement si tu as dit « Oui »** |
| Leçons | `go.lecons.v1` | Leçons commencées et terminées |
| Problèmes | `go.problemes.v1`, `go.problemes.vus.v1` | Problèmes réussis, et problèmes dont tu as vu la réponse |
| Révision espacée | `go.revision.v1` | Pour chaque problème réussi : jour de référence et prochaine échéance (J+1, J+3, J+7) |
| Go du jour et série | `go.go-du-jour.v1`, `go.go-du-jour.fait.v1`, `go.gel.v1` | Dernier défi du jour réussi, nombre de jours de suite, gels de série en réserve |
| Record de série | `go.serie-record.v1` | Plus longue série, et dernière série perdue déjà annoncée (#212) |
| Visites | `go.visite.v1` | Jour de la dernière visite et nombre de jours d'absence, pour l'accueil au retour (#213) |
| XP et niveau | `go.xp.v1`, `go.xp.premieres.v1` | Total d'XP, premières fois déjà récompensées |
| Badges | `go.badges.v1`, `go.paliers-fetes.v1` | Badges gagnés sur l'appareil, paliers déjà fêtés |
| Parties contre l'ordi | `go.parties.v1`, `go.bilan.v1`, `go.adversaire.v1` | Nombre de parties, victoires et défaites par adversaire, dernier adversaire choisi |
| Partie guidée | `go.guidee.v1` | Niveau de force atteint par Mochi à la fin de la dernière partie guidée (un nombre de 0 à 10), pour reprendre au même niveau |
| Revue et erreurs | `go.revue.v1`, `go.erreurs.v1` | Dernière partie terminée (coups au format SGF, date), jusqu'à 30 erreurs à rejouer (position, coups acceptés, date du prochain passage, réussites et échecs) |
| Explications déjà vues | `go.intro-but.v1`, `go.atari-explique.v1`, `go.komi-explique.v1`, `go.passer-explique.v1` | Pour ne pas répéter une explication |
| Installation | `go.installation.v1`, `go.premiere-victoire.v1`, `go.retours.v1`, `go.annonce-du-jour.v1` | Proposition d'installer l'app déjà montrée, refusée ou acceptée ; repère de première victoire ; nombre de jours d'ouverture, pour proposer l'installation au 2e retour (#214) ; jour de la dernière annonce de Mochi, pour ne pas proposer l'installation le même jour (#236) |
| Réseau de l'IA | Cache du navigateur `katago-reseaux-v1` | Le réseau de KataGo (fichier public), gardé pour jouer hors ligne. Aucune donnée personnelle |
| Suivi détaillé (PostHog) | Stockage géré par PostHog (`ph_…_posthog`) | Identifiant tiré au hasard. **Écrit seulement si tu as dit « Oui »** (section 3.3) |

**Proposer d'installer l'app.** À partir de ton 2e jour de visite, l'app peut te proposer, **une seule fois** sur l'accueil, de l'installer sur ton écran d'accueil ; une ligne « Installer l'app » reste aussi dans le Profil. Pour savoir si c'est possible, elle lit sur l'appareil le type de navigateur et si l'app est déjà installée. Ces informations restent sur l'appareil ; seuls le fait que la carte a été montrée et, sur Chrome, ta réponse partent dans le comptage (section 3.3).

### 3.2 Sur notre serveur (Supabase, Paris), si tu crées un compte

| Traitement | Données | Finalité | Base légale (art. 6 RGPD) | Durée de conservation |
|---|---|---|---|---|
| **Compte joueur** | Adresse e-mail, pseudo, cote et historique de cote | Te connecter par lien e-mail, t'identifier auprès des autres joueurs | Exécution du contrat (CGU) | Tant que le compte existe. **À valider** : durée maximale pour un compte inactif (section 9). |
| **Série de jours** | Nombre de jours de suite et dernier jour réussi, gels de série | Garder ta série d'un appareil à l'autre | Exécution du contrat | Tant que le compte existe. |
| **Envoi de la série de l'appareil** | À chaque connexion : nombre de jours de suite et date du dernier jour réussi, lus sur l'appareil (`importer_serie_appareil`) | Ne pas perdre la série faite avant de créer ton compte ou sur un autre appareil | Exécution du contrat | Le serveur ne garde que la plus longue des deux séries, dans ton profil. Il refuse une série impossible (plus de jours que depuis le lancement, ou dernier jour trop ancien). |
| **Parties en ligne** | Parties, coups (format SGF), résultats, adversaires, file d'attente de recherche d'adversaire | Jouer en ligne, calculer la cote, revoir tes parties | Exécution du contrat | Tant que le compte existe. À la suppression du compte, les parties contre un autre joueur restent pour lui, **anonymisées** (section 6). |
| **Progression** | Leçons terminées, essais de problèmes, badges, amis | Garder ta progression d'un appareil à l'autre, afficher tes badges et tes amis | Exécution du contrat | Tant que le compte existe. |

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
- problèmes : `probleme_resolu`, `solution_vue`, `erreur_rejouee`, `erreur_maitrisee`, `revision_faite` ;
- revue : `revue_ouverte`, `revue_rejouer` ;
- Go du jour et série : `go_du_jour_resolu`, `go_du_jour_partage`, `arrivee_par_partage`, `gel_gagne`, `gel_utilise`, `serie_perdue` ;
- progression : `xp_gagne`, `niveau_atteint` ;
- installation : `installation_proposee`, `installation_acceptee` ;
- compte : `lien_connexion_envoye`, `inscription`.

Chaque événement porte aussi la version de l'app, l'environnement (`production`…) et le niveau de mesure en vigueur (`mesure` : `anonyme` ou `complet`). Certains portent des valeurs tirées de ta progression sur l'appareil : série de jours, record, jours manqués, gels, total d'XP, niveau.

**Ce que le navigateur transmet en plus.** La bibliothèque PostHog ajoute d'elle-même des informations techniques : navigateur et version, système et version, type d'appareil, taille de l'écran et de la fenêtre, langue, adresse de la page (avec ses paramètres, par exemple le numéro d'un Go du jour partagé), page d'où tu viens et, dans une app comme Facebook ou Instagram, le nom de cette app.

**Adresse IP et localisation.** PostHog ne conserve **pas** ton adresse IP (réglage « Discard client IP data » activé, vérifié le 27/09). Depuis le 28/09 (#227), chaque événement porte aussi la consigne `$geoip_disable` : PostHog **ne déduit plus de localisation** de l'adresse IP. Les événements reçus avant cette date peuvent contenir une localisation approximative (pays, région). Par sécurité, la transformation GeoIP peut aussi être coupée dans le projet PostHog (section 9, E2).

| Traitement | Finalité | Base légale | Durée |
|---|---|---|---|
| **Comptage anonyme** (niveau anonyme) | Statistiques d'usage anonymes : combien de parties, de leçons, d'abandons | Intérêt légitime (améliorer le jeu), art. 6.1.f RGPD ; accès à l'appareil couvert par l'exemption CNIL de mesure d'audience (art. 82 loi Informatique et Libertés, délibération 2020-091). **À valider** (voir `consentement.md` et section 9) | **1 an** (durée fixée par l'offre gratuite de PostHog Cloud), dans la limite CNIL de 25 mois. |
| **Suivi détaillé** (niveau complet) | Savoir si les joueurs reviennent (rétention), améliorer l'apprentissage | Consentement (art. 6.1.a RGPD et art. 82 loi Informatique et Libertés) | **1 an** pour les événements. L'identifiant sur l'appareil reste jusqu'au retrait de l'accord ou à l'effacement des données du site. |

### 3.4 Rapports de bugs (Sentry, avec ton accord)

| Données | Finalité | Base légale | Durée |
|---|---|---|---|
| Message et pile d'erreur, version de l'app, navigateur et système, page concernée, identifiant technique du compte si tu es connecté. Jamais ton e-mail (`sendDefaultPii: false`). | Corriger les plantages | Consentement | **[À COMPLÉTER PAR FLORIAN : durée réglée dans Sentry, 30 ou 90 jours selon l'offre]** |

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

Les autres joueurs voient ton **pseudo**, ta **cote**, tes **badges** et les parties que vous jouez ensemble. Ils ne voient jamais ton e-mail.

Nous ne vendons, ne louons et ne partageons tes données avec **aucun** annonceur ni courtier en données. L'app n'affiche **aucune publicité**.

## 5. Mineurs

- En France, un mineur peut consentir seul au traitement de ses données pour un service en ligne **à partir de 15 ans** (art. 45 loi Informatique et Libertés, art. 8 RGPD).
- **Règle retenue :**
  - Jouer **sans compte** est ouvert à tous, sans limite d'âge : ta progression reste sur l'appareil ; seul le comptage anonyme part (et tu peux t'y opposer).
  - **Créer un compte** : à partir de 15 ans seul ; **avant 15 ans, avec l'accord d'un parent** (ou du titulaire de l'autorité parentale), qui consent pour l'enfant.
  - Le **suivi détaillé et les rapports de bugs** reposent sur le consentement : avant 15 ans, ils doivent être acceptés avec un parent.
- Les profils ne montrent que le pseudo, la cote et les badges ; il n'y a ni photo, ni âge, ni localisation, ni messagerie libre.
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

**Réclamation** : si tu estimes que tes droits ne sont pas respectés, tu peux saisir la **CNIL** (3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07, www.cnil.fr).

## 7. Sécurité

Connexions chiffrées (HTTPS). Accès à la base limité par des règles de sécurité au niveau des lignes (RLS) : chaque joueur ne peut modifier que ses propres données. Les colonnes sensibles (cote, série) ne s'écrivent que par des fonctions serveur qui vérifient les valeurs. Aucune clé d'administration côté app. Pas de mot de passe stocké : la connexion se fait par lien envoyé par e-mail.

## 8. Changements

Si cette politique change de façon importante, nous te prévenons dans l'app avant l'entrée en vigueur. Date d'entrée en vigueur : **[À COMPLÉTER PAR FLORIAN : date]**.

---

## 9. Pour Florian et l'avocat : écarts entre le code et un RGPD strict (28/09)

Cette section n'est pas destinée aux joueurs : à retirer de la version publiée. Aucun code n'a été modifié ; chaque point demande une décision.

| # | Écart constaté | Où | Risque | Piste |
|---|---|---|---|---|
| E1 | **Des événements partent vers PostHog sans accord**, dès l'ouverture et même après « Non merci » (niveau anonyme). C'est le choix de #64, fondé sur l'exemption CNIL de mesure d'audience, mais PostHog n'est pas un outil examiné par la CNIL et le CEPD (lignes directrices 2/2023) lit largement l'« accès au terminal ». | `track()` n'est bloqué qu'au niveau `aucun` | Moyen : l'exemption doit être démontrée par nous (outil d'auto-évaluation CNIL) | Faire l'auto-évaluation CNIL et la garder ; ou n'envoyer qu'après accord (perte de la mesure de base). |
| E2 | **Localisation déduite de l'IP** (pays, région, coordonnées approchées) gardée par PostHog sur tous les événements, y compris anonymes. L'ancienne politique disait « ni ta localisation ». | Réglage du projet PostHog (transformation GeoIP) | Moyen à fort pour l'exemption : la CNIL admet une géolocalisation limitée à la ville ; des coordonnées, même approchées, vont au-delà du besoin | **Corrigé dans le code le 28/09 (#227)** : `$geoip_disable` sur chaque envoi. Reste à couper aussi la GeoIP dans le projet PostHog, par sécurité. |
| E3 | **Informations techniques envoyées par défaut** par la bibliothèque PostHog (navigateur, système, taille d'écran, langue, adresse complète de la page, page précédente, app hôte), sans accord. | `POSTHOG_ANONYME` ne les filtre pas (`property_denylist` absent) ; `save_referrer: false` n'empêche pas l'envoi de `$referrer` | Faible à moyen : minimisation (art. 5.1.c) | Filtrer au minimum utile (par exemple garder type d'appareil et système, retirer `$referrer`, `$current_url`, `$raw_user_agent`). |
| E4 | **Valeurs lues dans le stockage de l'appareil et envoyées sans accord** : série, record, jours manqués, gels, total d'XP, niveau. Elles décrivent le joueur d'un jour à l'autre, alors que le niveau anonyme est censé ne rien relier entre deux visites. | `serie_perdue`, `revision_faite`, `go_du_jour_resolu`, `gel_*`, `xp_gagne`, `niveau_atteint` | Faible : pas d'identifiant, mais cela affaiblit l'argument « statistiques anonymes » | Arrondir en tranches (1, 2-6, 7-29, 30+) au niveau anonyme, ou n'envoyer ces propriétés qu'au niveau complet. |
| E5 | **Retrait de l'accord : l'identifiant PostHog et les repères `go.evenement.*` restent sur l'appareil.** `ph.reset()` change l'identifiant et la persistance repasse en mémoire, mais rien n'efface explicitement les clés déjà écrites. | `appliquer()`, `trackOnce()` | Faible | **Corrigé le 28/09 (#227)** : `effacerTraces()` retire `ph_*`, `__ph_opt_in_out_*` et `go.evenement.*` au retrait. Reste à vérifier dans un vrai navigateur. |
| E6 | **La suppression du compte ne se propage pas à PostHog ni à Sentry** : les événements liés à l'identifiant du compte (niveau complet) restent un an. | `delete_my_account()` ne touche que Supabase | Moyen : droit à l'effacement (art. 17) | Supprimer la « personne » PostHog de ce compte (API PostHog, depuis une fonction serveur) ; à défaut, traiter la demande à la main et le dire (fait dans cette politique). |
| E7 | **Aucune durée maximale pour un compte inactif.** Tout est gardé « tant que le compte existe ». La CNIL recommande de supprimer ou d'anonymiser après une période d'inactivité (souvent 2 à 3 ans). | Schéma Supabase | Moyen : limitation de la conservation (art. 5.1.e) | Fixer une durée (par exemple 3 ans sans connexion, avec e-mail d'avertissement un mois avant) et une tâche planifiée. |
| E8 | **Pas de question d'âge à l'inscription.** Les CGU et cette politique exigent l'accord d'un parent avant 15 ans, mais l'écran de compte ne le demande pas. | `src/app/Account.tsx` | Moyen (art. 8 RGPD, art. 45 LIL) | Case déclarative « J'ai 15 ans ou plus, ou l'accord d'un parent » à l'inscription (minimum). |
| E9 | **Aucun moyen d'exercer ses droits aujourd'hui** : le contact affiché est « bientôt disponible », et il n'y a pas d'export des données (accès, portabilité). | `src/app/Confidentialite.tsx` | Fort dès l'ouverture au public | Remplir l'adresse de contact avant tout lancement public. Export SGF et progression plus tard. |
| E10 | **Réseau de KataGo téléchargé chez GitHub** par défaut : l'IP du joueur part chez un tiers américain non cité jusqu'ici. | `DEFAULT_MODEL_URL` dans `src/engine/katago/loader.ts` | Faible | Servir le fichier depuis Vercel (`npm run fetch-model` et `VITE_KATAGO_MODEL_URL`), ou citer GitHub. |
| E11 | **Texte de l'app à réaligner** : la page « Conditions et confidentialité » dit « Sans cookie, sans identifiant, sans ton adresse IP » (juste pour l'IP conservée, mais muet sur la localisation déduite), et « Tu peux le faire effacer » alors que le bouton existe maintenant. | `src/app/Confidentialite.tsx` (périmètre du front) | Faible | **Corrigé le 28/09 (#227)** : texte réaligné (mesure anonyme, pas de localisation, suppression depuis le Profil). |
| E12 | **Durées encore non définies** : Sentry (champ 7), journaux Vercel. | Réglages des services | Faible | Relever les deux durées et les écrire ici. |
