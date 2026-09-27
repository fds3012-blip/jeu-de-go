# Politique de confidentialité (issue #111)

Projet rédigé par le responsable juridique (non-avocat) le 27 septembre 2026. **À faire relire par un avocat ou un DPO avant la mise en production.** Il décrit ce que l'app fait réellement à cette date (code de `src/data`, schéma de `supabase/migrations`, analyse de `docs/juridique/consentement.md`).

## Pour Florian : champs à compléter avant publication

Aucune adresse ni identité n'a été inventée. Tant que ces champs sont vides, l'app affiche « Contact : bientôt disponible ».

1. **Responsable du traitement** : nom et prénom (personne physique) ou raison sociale et forme (société).
2. **Adresse postale** du responsable du traitement.
3. **Numéro SIREN / RCS** (si société ou entrepreneur individuel).
4. **Adresse e-mail de contact « données personnelles »** (dédiée de préférence, par exemple une adresse sur le domaine du jeu).
5. **Délégué à la protection des données** : nom et contact, ou mention qu'aucun DPO n'est désigné (non obligatoire à ce stade, à confirmer par l'avocat).
6. **Date d'entrée en vigueur** de la politique.

Points à vérifier en parallèle (pas des champs, mais des preuves à conserver) : DPA signés avec Supabase, PostHog, Sentry et Vercel ; adhésion de ces sociétés au Data Privacy Framework ; région Sentry réellement choisie (UE, Francfort).

---

## 1. Qui est responsable de tes données ?

Le responsable du traitement est **[À COMPLÉTER PAR FLORIAN : nom ou raison sociale]**, **[À COMPLÉTER PAR FLORIAN : adresse postale]**, **[À COMPLÉTER PAR FLORIAN : SIREN / RCS, le cas échéant]**.

Contact pour toute question sur tes données : **[À COMPLÉTER PAR FLORIAN : adresse e-mail de contact]**.

Délégué à la protection des données : **[À COMPLÉTER PAR FLORIAN : nom et contact du DPO, ou « aucun DPO désigné »]**.

## 2. En bref

- Tu peux jouer **sans compte**. Tes réglages et ta progression restent alors sur ton appareil.
- L'IA (KataGo) calcule **sur ton appareil** : tes parties contre l'ordinateur ne sont pas envoyées.
- Nous comptons les parties de façon **anonyme**, sans cookie ni identifiant. Tu peux t'y opposer.
- Les rapports de bugs et le suivi détaillé ne démarrent **qu'avec ton accord**.
- **Aucune vente de données. Aucune publicité.** Aucune donnée n'est utilisée pour du profilage publicitaire.

## 3. Quelles données, pourquoi, sur quelle base, combien de temps

| Traitement | Données | Finalité | Base légale (art. 6 RGPD) | Durée de conservation |
|---|---|---|---|---|
| **Stockage local** (localStorage de ton navigateur ou de l'app) | Réglages, choix de consentement et d'opposition, progression dans les leçons, parties et revues locales, série et gels, bilan | Faire fonctionner le jeu sans compte | Exécution du service demandé ; stockage strictement nécessaire (art. 82 loi Informatique et Libertés) | Sur ton appareil jusqu'à ce que tu effaces les données du site ou désinstalles l'app. Nous n'y avons pas accès. |
| **Compte joueur** (Supabase) | Adresse e-mail, pseudo, cote et historique de cote | Te connecter par lien e-mail, t'identifier auprès des autres joueurs | Exécution du contrat (CGU) | Tant que le compte existe. Suppression sur demande (section 6). |
| **Parties en ligne** (Supabase) | Parties, coups (format SGF), résultats, adversaires, file d'attente de recherche d'adversaire | Jouer en ligne, calculer la cote, revoir tes parties | Exécution du contrat | Tant que le compte existe. **À valider** : sort des parties partagées avec un autre joueur quand l'un des deux supprime son compte (anonymisation proposée). |
| **Progression** (Supabase) | Leçons terminées, essais de problèmes, badges, série de jours, amis | Garder ta progression d'un appareil à l'autre, afficher tes badges et tes amis | Exécution du contrat | Tant que le compte existe. |
| **Mesure d'audience anonyme** (PostHog, sans consentement) | Quelques événements nommés (ouverture de l'app, première pierre, partie terminée avec taille, adversaire et résultat, leçon terminée, création de compte…), version de l'app. Rien n'est écrit sur l'appareil, aucun identifiant persistant, pas de profil, IP non conservée | Statistiques d'usage anonymes | Intérêt légitime (améliorer le jeu) ; exemption de consentement CNIL pour la mesure d'audience (art. 82 loi Informatique et Libertés). **À valider** (voir `consentement.md`) | **1 an** (durée fixée par l'offre gratuite de PostHog Cloud), dans la limite CNIL de 25 mois. |
| **Suivi détaillé** (PostHog, avec ton accord) | Les mêmes événements, plus un identifiant tiré au hasard gardé sur ton appareil et, si tu es connecté, l'identifiant de ton compte (jamais ton e-mail ni tes coups) | Savoir si les joueurs reviennent, améliorer l'apprentissage | Consentement (art. 6.1.a RGPD et art. 82 loi Informatique et Libertés) | **1 an** pour les événements. L'identifiant local reste sur ton appareil jusqu'au retrait de l'accord ou à l'effacement des données du site. |
| **Rapports de bugs** (Sentry, avec ton accord) | Message et pile d'erreur, version de l'app, navigateur et système, page concernée, identifiant de compte si connecté | Corriger les plantages | Consentement | **[À COMPLÉTER PAR FLORIAN : durée réglée dans Sentry, 30 ou 90 jours selon l'offre]** |
| **Hébergement** (Vercel) | Adresse IP et données techniques de la requête (journaux du serveur) | Afficher le site et l'app, sécurité | Intérêt légitime (sécurité et fonctionnement) | Durée des journaux fixée par Vercel (quelques jours sur l'offre actuelle). **À vérifier.** |

Nous ne collectons **ni** ton nom, **ni** ta date de naissance, **ni** ta localisation, **ni** tes contacts. Il n'y a pas de messagerie entre joueurs à ce jour.

## 4. Qui reçoit tes données ?

Seulement nous et nos sous-traitants techniques, qui agissent sur nos instructions (art. 28 RGPD) :

| Sous-traitant | Rôle | Lieu des serveurs | Transfert hors UE |
|---|---|---|---|
| Supabase Inc. | Base de données, connexion, temps réel | Union européenne (Paris, `eu-west-3`) | Société américaine : accès possible depuis les États-Unis pour le support. Encadré par le DPA de Supabase et les clauses contractuelles types. **À vérifier.** |
| PostHog Inc. | Mesure d'audience | Union européenne (Francfort) | Société américaine : même remarque. DPA et Data Privacy Framework **à vérifier**. |
| Functional Software Inc. (Sentry) | Rapports de bugs | Union européenne (Francfort) | Société américaine : même remarque. **À vérifier.** |
| Vercel Inc. | Hébergement et diffusion du site | Réseau mondial (le site est servi depuis le point le plus proche de toi) | Oui, possible. Encadré par le DPA de Vercel (clauses contractuelles types, Data Privacy Framework). **À vérifier.** |

Les autres joueurs voient ton **pseudo**, ta **cote**, tes **badges** et les parties que vous jouez ensemble. Ils ne voient jamais ton e-mail.

Nous ne vendons, ne louons et ne partageons tes données avec **aucun** annonceur ni courtier en données. L'app n'affiche **aucune publicité**.

## 5. Mineurs

- En France, un mineur peut consentir seul au traitement de ses données pour un service en ligne **à partir de 15 ans** (art. 45 loi Informatique et Libertés, art. 8 RGPD).
- **Règle retenue :**
  - Jouer **sans compte** est ouvert à tous, sans limite d'âge : rien ne quitte l'appareil, sauf le comptage anonyme.
  - **Créer un compte** : à partir de 15 ans seul ; **avant 15 ans, avec l'accord d'un parent** (ou du titulaire de l'autorité parentale), qui consent pour l'enfant.
  - Le **suivi détaillé et les rapports de bugs** reposent sur le consentement : avant 15 ans, ils doivent être acceptés avec un parent.
- Les profils ne montrent que le pseudo, la cote et les badges ; il n'y a ni photo, ni âge, ni localisation, ni messagerie libre.
- Un parent peut demander l'accès ou la suppression du compte de son enfant (section 6).
- **À valider** : mode de recueil de l'accord parental (case déclarative à l'inscription au minimum). Vérifier aussi l'état d'application de la loi du 7 juillet 2023 sur la majorité numérique, qui vise surtout les réseaux sociaux : ne pas l'appliquer sans avis.

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

**Suppression du compte :** aujourd'hui sur demande à l'adresse ci-dessus. **À faire avant la publication sur l'App Store et Google Play** : un bouton « Supprimer mon compte » dans l'app (exigé par Apple, règle 5.1.1(v), et par Google Play).

**Sans compte** : effacer les données du site dans ton navigateur, ou désinstaller l'app, supprime tout ce qui est sur ton appareil.

**Réclamation** : si tu estimes que tes droits ne sont pas respectés, tu peux saisir la **CNIL** (3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07, www.cnil.fr).

## 7. Sécurité

Connexions chiffrées (HTTPS). Accès à la base limité par des règles de sécurité au niveau des lignes (RLS) : chaque joueur ne peut modifier que ses propres données. Aucune clé d'administration côté app. Pas de mot de passe stocké : la connexion se fait par lien envoyé par e-mail.

## 8. Changements

Si cette politique change de façon importante, nous te prévenons dans l'app avant l'entrée en vigueur. Date d'entrée en vigueur : **[À COMPLÉTER PAR FLORIAN : date]**.
