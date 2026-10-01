# Compte obligatoire avec pseudo : analyse juridique (issue #343)

> **Relecture obligatoire avant la mise en production.** Ce document est une analyse préparée par le responsable juridique, qui n'est pas avocat. Il doit être relu et validé par un **avocat** ou un **DPO** avant d'être appliqué comme position définitive. Les points marqués **À valider** et les décisions **D1 à D8** attendent Florian.

Rédigé le 30 septembre 2026, sur `main` au commit `2428248`. Les branches front (`compte-obligatoire-343`) et serveur (`serveur-compte-343`) de la même issue n'avaient encore aucun commit : cette analyse décrit donc **la cible** de #343, pas le code en place. Elle ne modifie aucun fichier de l'app.

## 1. La décision de Florian (30/09)

| | Sans compte (essai) | Avec compte (pseudo obligatoire) |
|---|---|---|
| Jouer | Quelques parties contre l'ordi | Parties illimitées, jeu en ligne, défi par lien |
| Apprendre | Premières leçons, Go du jour | Tout le reste |
| Progression | Sur l'appareil seulement | Gardée sur le serveur (série, leçons, badges, cote) |
| Défi par lien | Voir le plateau et qui t'invite | Jouer : compte (e-mail + pseudo) **avant le premier coup** |
| Sessions anonymes | Plus aucune nouvelle | — |

## 2. Âge minimum : ce que dit le droit

| Règle | Source | Ce que ça change pour nous |
|---|---|---|
| Quand un service en ligne proposé à un enfant repose sur son **consentement** (art. 6.1.a), il faut l'accord d'un parent avant **15 ans** en France. | Art. 8 RGPD, art. 45 loi Informatique et Libertés (LIL) | **Certain.** Vaut pour le **suivi détaillé et les rapports de bugs** (consentement). |
| Le compte joueur repose sur l'**exécution du contrat** (art. 6.1.b), pas sur le consentement. L'art. 8 ne s'applique donc pas directement à la création du compte. | Art. 6 et 8 RGPD ; politique, section 3.2 | **Interprétation, à valider.** Reste la capacité du mineur à conclure le contrat. |
| Un mineur peut conclure seul les **actes courants** autorisés par l'usage, à des conditions normales. | Art. 1148 du Code civil | **Interprétation, à valider** : un compte gratuit de jeu, sans achat, est très probablement un acte courant. Un abonnement Premium ne l'est pas forcément (voir D7). |
| La CNIL recommande, pour les mineurs, une vérification d'âge **proportionnée** au risque, sans collecter plus que nécessaire, et d'associer les parents avant 15 ans. | CNIL, 8 recommandations pour les droits des mineurs en ligne (juin 2021) | Pour un jeu de go sans messagerie ni achat : une **déclaration** suffit très probablement. Pas de pièce d'identité, pas de date de naissance. |
| Loi « majorité numérique » : autorisation parentale avant 15 ans pour les **réseaux sociaux**. | Loi n° 2023-566 du 7 juillet 2023 | **Pas appliquée** : son décret n'a jamais été pris. La loi de 2026 interdisant les réseaux sociaux avant 15 ans a été censurée par le Conseil constitutionnel le 14/08/2026. Le jeu n'est de toute façon **pas un réseau social** tant qu'il n'y a ni messagerie ni contenu publié par les joueurs, hors pseudo. **À revérifier** avant toute messagerie ou tout chat. |
| Plateformes accessibles aux mineurs : haut niveau de sécurité et de vie privée. | Art. 28 DSA et lignes directrices de la Commission (juillet 2025) | **À valider** : un pseudo public suffit-il à faire de l'app une « plateforme » ? Probablement non. Les bonnes pratiques restent utiles : profil minimal, pas de messagerie libre, signalement. |
| États-Unis : accord parental **vérifiable** avant 13 ans (COPPA). | COPPA | Pas concerné au lancement (France). **À traiter avant l'ouverture aux États-Unis** : une case « un parent est d'accord » ne suffit pas pour la COPPA. |

**Conclusion.** Créer un compte : seul à partir de 15 ans ; avant 15 ans, avec l'accord d'un parent. La case déclarative est la mesure proportionnée. Aucune vérification lourde, aucune date de naissance.

## 3. Ce que l'app doit faire : option recommandée

Trois options comparées :

| Option | Simplicité | Conformité | Données en plus |
|---|---|---|---|
| **A. Une case à cocher** « J'ai 15 ans ou plus, ou un parent est d'accord » | Une seule case, sur l'écran « Crée ton compte » | Suffisante pour un service gratuit à faible risque (**à valider**) | Aucune, sauf la date d'acceptation (D2) |
| B. Demander l'année de naissance | Un champ de plus, un écran de plus pour les moins de 15 ans | Même niveau de preuve (déclaratif) | Une donnée de plus à protéger, contraire à la minimisation |
| C. Accord parental vérifié (e-mail du parent) | Lourd : deux e-mails, attente, abandon | Plus forte | E-mail du parent, lien parent-enfant |

**Recommandation : option A.** C'est la plus simple et elle est conforme pour notre usage, à condition que :

1. la case **ne soit pas cochée d'avance** ;
2. le bouton « Créer mon compte » reste inactif tant qu'elle n'est pas cochée, avec une aide qui dit pourquoi ;
3. elle soit posée **partout où un compte naît** : écran « Crée ton compte », défi par lien (avant le premier coup), et ancien invité qui relie son e-mail (`garderMonCompte`) ;
4. la même case serve à **accepter les conditions** (lien vers les CGU et la politique), pour ne pas ajouter une deuxième case ;
5. le serveur garde la **preuve** : date d'acceptation et version des conditions (D2) ;
6. rien ne soit demandé en plus pendant l'**essai sans compte** : aucune donnée ne part sur le serveur.

**Écueil à éviter** : ne pas afficher « Tu dois avoir 15 ans » en gros avec un refus sec. Un enfant coche alors sans réfléchir. La formule avec « ou un parent est d'accord » est plus honnête et invite à en parler.

### Textes prêts à l'emploi (catalogue `src/content/i18n`)

Clés proposées au front (le nom exact est à son choix). Tutoiement, phrases courtes.

| Clé proposée | Français | English |
|---|---|---|
| `compte.age.case` | J'ai 15 ans ou plus, ou un parent est d'accord. J'accepte les {conditions} et la {confidentialite}. | I'm 15 or older, or a parent has agreed. I accept the {conditions} and the {confidentialite}. |
| `compte.age.conditions` (lien) | conditions d'utilisation | terms of use |
| `compte.age.confidentialite` (lien) | politique de confidentialité | privacy policy |
| `compte.age.aide` (si le bouton est touché sans la case) | Coche la case pour créer ton compte. | Tick the box to create your account. |
| `compte.age.moins15` (lien discret sous la case, ouvre une courte explication) | Tu as moins de 15 ans ? | Under 15? |
| `compte.age.moins15Detail` | Montre cet écran à un parent. S'il est d'accord, coche la case avec lui. Tu peux aussi continuer l'essai sans compte : rien ne quitte ton téléphone. | Show this screen to a parent. If they agree, tick the box together. You can also keep trying without an account: nothing leaves your phone. |
| `compte.pseudo.conseil` (sous le champ pseudo) | Ton pseudo est visible par tous. Évite ton vrai nom. | Everyone can see your nickname. Don't use your real name. |
| `compte.garde` (ce qui est gardé, écran « Crée ton compte ») | Ta série, tes leçons et tes parties sont gardées sur ton compte. Pas de mot de passe : on t'envoie un code par e-mail. | Your streak, lessons and games are saved to your account. No password: we email you a code. |
| `defi.compteAvant` (défi par lien) | Pour jouer, crée ton compte. C'est rapide : ton e-mail et un pseudo. | To play, create your account. It's quick: your email and a nickname. |

Pour la version anglaise servie hors de France, voir D5.

## 4. Conséquences sur les données

| Sujet | Avant #343 | Après #343 | Effet juridique |
|---|---|---|---|
| Essai sans compte | Tout le jeu sans compte, progression sur l'appareil | Essai limité, progression sur l'appareil | Rien de nouveau : aucune donnée sur le serveur. **Compter l'essai avec les clés existantes** (`go.parties.v1`, `go.lecons.v1`) plutôt qu'une nouvelle clé. Si une clé est ajoutée, elle doit être citée en section 3.1 de la politique, sinon le test de cohérence échoue. |
| Pseudo | Facultatif, demandé après connexion | **Obligatoire**, public | Le pseudo devient une donnée publique de **tous** les comptes, y compris des 15-17 ans et des enfants avec accord parental. L'écart E16 (profils lisibles sans connexion) pèse plus lourd. |
| Défi par lien | Session anonyme créée à l'ouverture | Compte avant le premier coup | L'écart E19 (session à tout âge sans accord) disparaît pour les nouveaux défis. |
| Sessions anonymes déjà créées | Purgées après 60 jours sans activité | Plus aucune création ; celles qui existent restent jusqu'à la purge | La tâche `purger_anonymes_inactifs` **doit rester** : elle efface les dernières sessions au plus tard 60 jours après leur dernière activité. Voir D3. |
| Connexion | Lien magique par e-mail | Code à 6 chiffres par e-mail (`verifyOtp`), ou lien | Même donnée (e-mail). Le code est un secret court : il ne doit jamais partir dans la mesure ni dans Sentry (même règle que E14). |
| Mesure de l'entonnoir essai → compte | — | Nouveaux événements (agent data) | Chaque nouvel événement doit être cité en section 3.3 de la politique (le test échoue sinon). Aucun ne doit porter l'e-mail, le pseudo ni le code. |

## 5. Règles des stores

| Règle | Source | Point d'attention |
|---|---|---|
| Suppression du compte **depuis l'app**. | App Store 5.1.1(v) ; Google Play, règles sur la suppression des données | **Déjà fait** (#114). Google Play demande aussi une **page web** pour demander la suppression sans l'app : à prévoir avant la publication Android. |
| « Si l'app n'a pas de fonctions importantes liées au compte, laisse les gens l'utiliser sans connexion. » Les fonctions qui ne dépendent pas d'un compte doivent rester accessibles avant l'inscription. | [App Store 5.1.1(v)](https://developer.apple.com/app-store/review/guidelines/) | **Risque de refus, à valider.** Le jeu en ligne, le défi et la progression synchronisée justifient un compte. Mais bloquer des **leçons** ou des **parties contre l'ordi** (contenu local) derrière un compte peut être lu comme une inscription forcée. Voir D6. |
| Connexion avec Apple obligatoire si d'autres connexions sociales (Google, Facebook) sont proposées. | App Store 4.8 | Pas concerné tant que la connexion est par e-mail seul. |
| Âge de l'app et public visé. | Classification App Store ; Google Play, règles « Familles » | Ne **pas** déclarer les enfants comme public cible dans Google Play : cela imposerait les règles « Familles » (SDK certifiés, pas de PostHog par défaut). Public visé : 13 ans et plus, ou tous publics sans ciblage enfants. **À valider.** |

## 6. Décisions à prendre par Florian

| # | Question | Recommandation |
|---|---|---|
| **D1** | Âge : case déclarative (option A), année de naissance (B) ou accord parental vérifié (C) ? | **A**, avec le texte de la section 3. |
| **D2** | Garder une preuve de l'acceptation (date et version des conditions) sur le serveur ? | **Oui** : deux colonnes dans `profiles` (par exemple `conditions_acceptees_le`, `conditions_version`), écrites par une fonction serveur à la création du compte. Sert de preuve (art. 5.2 et 7.1 RGPD) et permet de redemander l'accord quand les conditions changent. À confier au backend (nouvelle migration). |
| **D3** | Sessions anonymes existantes : les laisser finir (purge à 60 jours) ou les supprimer tout de suite ? Peuvent-elles encore jouer leur défi en cours ? | Les **laisser finir** leur défi en cours sans en créer de nouveau, et garder la purge à 60 jours. Les supprimer d'un coup effacerait des parties en cours de vrais joueurs (anonymisées, mais interrompues). |
| **D4** | Profils lisibles sans connexion (E16), maintenant que tous les joueurs ont un pseudo public ? | Réserver la lecture aux joueurs connectés ; ne montrer aux autres que pseudo et cote ; série et gels lisibles par leur titulaire seul. |
| **D5** | Version anglaise : quel âge hors de France ? L'âge de l'art. 8 varie de 13 à 16 ans selon les pays de l'UE. | Tant que le compte repose sur le contrat, garder **15 ans** partout dans l'UE au lancement (texte identique), et revoir avec l'avocat avant l'ouverture au Royaume-Uni et aux États-Unis (COPPA). |
| **D6** | Limites de l'essai sur iPhone : combien de parties, quelles leçons ? | Pour limiter le risque App Store 5.1.1(v) : présenter le compte comme le moyen de **garder** sa progression et de jouer avec d'autres, et garder une porte d'essai généreuse (au moins les 6 premières leçons et le Go du jour). À faire relire avant la soumission. |
| **D7** | Premium et mineurs. | Hors de #343. Un achat par un mineur n'est pas forcément un acte courant : l'achat intégré passe par le compte Apple ou Google (contrôle parental des stores). À traiter avec les conditions de vente. |
| **D8** | Pseudo : liste de mots interdits, signalement ? | Minimum au lancement : règles des CGU (section 5), refus serveur des pseudos contenant une adresse e-mail ou un numéro de téléphone, adresse de signalement. Modération plus tard. |

## 7. Ce qui a été mis à jour dans cette branche

- `docs/juridique/politique-confidentialite.md` : en bref, 3.1 (essai), 3.2 (compte avec pseudo obligatoire, sessions anonymes restantes), section 4 (ce que les autres voient), section 5 (mineurs), section 6 (sessions restantes), section 9 (E8, E16, E19 mis à jour ; E21 et E22 ajoutés).
- `docs/juridique/cgu.md` : service et essai (section 3), compte (section 4), pseudo (section 5), défi par lien (section 5 ter).

## 8. Ce que les autres agents doivent faire (hors périmètre juridique)

- **Front** : case d'âge et d'acceptation (section 3) sur tous les écrans où un compte naît ; conseil sous le pseudo ; page Confidentialité (`src/app/Confidentialite.tsx`) : retirer « tu peux jouer sans compte » tel quel et décrire l'essai, retirer la session sans compte des nouveaux défis ; tout nouveau stockage local cité en section 3.1.
- **Serveur** : refus de `creer_defi`, `rejoindre_defi` et du jeu en ligne sans vrai compte et sans pseudo ; colonnes de preuve (D2) ; garder `purger_anonymes_inactifs`. Si les sessions anonymes ne peuvent plus créer de défi, mettre à jour le test `décrit les limites des sessions sans compte (#316)` de `src/data/politiqueConfidentialite.test.ts` et la phrase « 3 en attente au plus » de la politique en même temps.
- **Data** : citer chaque événement de l'entonnoir en section 3.3 ; jamais l'e-mail, le pseudo ni le code à 6 chiffres.

## Sources

- [Majorité numérique : la loi est publiée (Actu-Juridique)](https://www.actu-juridique.fr/breves/ntic-medias-presse/378314/)
- [Lettre de la DAJ sur la loi n° 2023-566](https://www.economie.gouv.fr/daj/lettre-de-la-daj-la-loi-ndeg2023-566-du-7-juillet-2023-cree-une-majorite-numerique-fixee-15-ans)
- [Réseaux sociaux avant 15 ans : deux lois votées, aucune appliquée (NosParlementaires)](https://nosparlementaires.fr/actualites/reseaux-sociaux-15-ans-deux-lois-zero-application) — source de presse sur la censure du 14/08/2026 : **à vérifier sur conseil-constitutionnel.fr**.
- [Pourquoi l'interdiction des réseaux sociaux aux moins de 15 ans reste un casse-tête (Toute l'Europe)](https://www.touteleurope.eu/societe/pourquoi-l-interdiction-des-reseaux-sociaux-aux-moins-de-15-ans-voulue-par-la-france-est-un-casse-tete-europeen/)
- [App Review Guidelines, Apple](https://developer.apple.com/app-store/review/guidelines/) (5.1.1(v), 4.8)
- [Clarification on Apple Guideline 5.1.1(v), forum Apple](https://developer.apple.com/forums/thread/724336)
- Cités de mémoire, **à ouvrir pour vérifier** : art. 8 RGPD, art. 45 LIL, art. 1148 Code civil, recommandations CNIL sur les mineurs (juin 2021), lignes directrices de la Commission sur l'art. 28 DSA (juillet 2025).
