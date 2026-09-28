# Consentement : obtenir un maximum d'accords, sans dark pattern (issue #64)

Rédigé par le responsable juridique (non-avocat) le 27 septembre 2026. Les points marqués **À valider** doivent être relus par un avocat ou un DPO avant la mise en production.

## La question de Florian

« J'ai peur que les gens disent non. L'objectif est d'avoir un maximum de validations. »

Réponse courte : le levier le plus fort n'est pas de pousser vers « Oui ». C'est de **ne plus avoir besoin de demander** pour la mesure d'audience de base. La CNIL l'exempte de consentement si elle est réglée d'une certaine façon. La fenêtre ne sert alors plus qu'à ce qui exige vraiment un accord (rapports de bugs, suivi d'un joueur dans le temps). Un refus ne nous rend plus aveugles : on continue à compter les parties.

> **Limite de la recherche.** Le site cnil.fr n'était pas joignable depuis l'environnement de travail. Les liens vers les PDF de la CNIL, l'EDPB, PostHog, Lichess et Apple proviennent de résultats de recherche ou ont été ouverts. Trois liens CNIL (dossier cookies, fiche « outils de mesure d'audience », communiqué sur les sanctions Google et Facebook) sont cités de mémoire : **à ouvrir pour vérifier l'adresse et le texte** avant de s'y référer.

## 1. Le cadre

| Règle | Source | Statut |
|---|---|---|
| Toute lecture ou écriture sur le terminal exige le consentement, sauf si elle est strictement nécessaire au service demandé ou si elle a pour seul but de permettre la communication. | Art. 82 de la loi Informatique et Libertés, qui transpose l'art. 5(3) de la directive ePrivacy | Certain |
| « Lecture » s'entend largement : un script qui lit des informations de l'appareil (navigateur, écran, erreurs) et les envoie compte, même sans cookie. | [EDPB, lignes directrices 2/2023 sur le champ technique de l'art. 5(3), v2 d'octobre 2024](https://www.edpb.europa.eu/system/files/2024-10/edpb_guidelines_202302_technical_scope_art_53_eprivacydirective_v2_en_0.pdf) | Certain (position du CEPD) |
| Refuser doit être aussi simple qu'accepter ; pas de case pré-cochée ; le silence ne vaut pas accord. | Lignes directrices CNIL « cookies et autres traceurs » (délibération 2020-091) et recommandation (délibération 2020-092), [dossier CNIL cookies et traceurs](https://www.cnil.fr/fr/cookies-et-autres-traceurs) | Certain |
| Refus plus difficile que l'acceptation = sanction. | [CNIL, sanctions Google (150 M€) et Facebook (60 M€), janvier 2022](https://www.cnil.fr/fr/cookies-sanctions-de-150-millions-deuros-lencontre-de-google-et-de-60-millions-deuros-lencontre-de-facebook) | Certain |
| Mineurs : en France, un mineur consent seul à partir de 15 ans pour les services en ligne. | Art. 45 de la loi Informatique et Libertés, art. 8 RGPD | Certain. Conséquence : un consentement donné par un joueur de moins de 15 ans est fragile. La mesure exemptée évite le problème. |

## 2. La mesure d'audience exemptée (PostHog)

### Conditions de la CNIL

La CNIL admet sans consentement les traceurs de mesure d'audience qui ([fiche CNIL : outils de mesure d'audience](https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies-solutions-pour-les-outils-de-mesure-daudience), [fiche n°16 du guide développeur](https://www.cnil.fr/en/sheet-ndeg16-use-analytics-your-websites-and-applications), [outil d'auto-évaluation CNIL, juillet 2025](https://www.cnil.fr/sites/default/files/2025-07/outil_d_auto-evaluation_mesure_d_audience.pdf)) :

1. servent **uniquement** à la mesure d'audience, pour le compte exclusif de l'éditeur ;
2. produisent **seulement des statistiques anonymes** ;
3. ne permettent **ni suivi global** de la navigation sur d'autres sites ou applis, **ni croisement** avec d'autres traitements, ni transmission à des tiers ;
4. ont une durée de vie limitée à **13 mois** (non prolongée à chaque visite) et des données conservées **25 mois** au plus ;
5. tronquent ou ne conservent pas l'adresse IP ;
6. sont **mentionnés** dans la politique de confidentialité, avec un **droit d'opposition** simple.

Les guides de configuration publiés par la CNIL pour d'autres outils (par exemple [AT Internet](https://www.cnil.fr/sites/cnil/files/2024-11/atinternet_guide-de-configuration_solution-exemptee_public_2024.pdf), [Piwik PRO](https://www.cnil.fr/sites/default/files/atoms/files/exemption_pour_la_mesure_daudience_sans_consentement_piwik.pdf), [etracker](https://www.cnil.fr/sites/cnil/files/atoms/files/etracker_-_guide_de_configuration_solution_de_mesure_daudience_exemptee.pdf)) montrent que **c'est la configuration, pas la marque, qui compte**.

### PostHog peut-il y entrer ?

**Interprétation, À valider.** PostHog ne figure pas dans la liste des outils dont la CNIL a examiné la configuration. Rien n'interdit d'utiliser un autre outil : l'éditeur doit alors démontrer lui-même le respect des conditions (outil d'auto-évaluation ci-dessus). PostHog offre les réglages nécessaires ([persistance et cookies](https://posthog.com/docs/libraries/js/persistence), [suivi sans cookie](https://posthog.com/tutorials/cookieless-tracking), [contrôles de confidentialité](https://posthog.com/docs/product-analytics/privacy), [RGPD](https://posthog.com/docs/privacy/gdpr-compliance)) :

| Condition CNIL | Réglage appliqué (`src/data/analytics.ts`, `POSTHOG_ANONYME`) |
|---|---|
| Pas de traceur persistant | `persistence: 'memory'` : rien n'est écrit sur l'appareil ; l'identifiant change à chaque ouverture. Mieux que la limite de 13 mois. |
| Statistiques anonymes, pas de profil | `person_profiles: 'never'` ; `identify()` n'est jamais appelé sans accord ; le repère « première pierre déjà comptée » reste en mémoire. |
| IP non conservée | `ip: false` côté client **et** réglage projet « Discard client IP data » : **activé** (vérifié le 27/09 via l'API PostHog, `anonymize_ips: true`). |
| Pas de croisement, pas d'enregistrement | `autocapture`, pages vues, enregistrement de session, sondages, feature flags et scripts externes désactivés. Seuls des événements nommés partent (7 au 27/09 ; 25 au 28/09, 26 avec `serie_perdue` de #212 ; liste dans `docs/data/plan-de-marquage.md`). **Mise à jour du 28/09 (#223)** : PostHog ajoute des propriétés techniques (navigateur, écran, page, page précédente) et une localisation déduite de l'IP avant de l'effacer ; voir les écarts E2 à E4 de `politique-confidentialite.md`, section 9. |
| Droit d'opposition | Interrupteur « Comptage anonyme des parties » dans Conditions ; le choix est gardé dans `go.mesure.opposition.v1` (mémoriser un refus est lui-même exempté). |
| Hébergement | PostHog Cloud UE (Francfort). |

Coût assumé : sans accord, pas de rétention J1 par joueur (l'identifiant ne survit pas à la fermeture). Les volumes et les entonnoirs dans une même session restent mesurés. La rétention est mesurée sur les joueurs qui ont dit oui.

**Points À valider par un avocat :**
- PostHog Inc. est une société américaine : l'hébergement UE ne supprime pas tout risque d'accès extraterritorial. Vérifier le DPA signé et l'adhésion au Data Privacy Framework.
- La CNIL exige que le prestataire ne réutilise pas les données pour son propre compte : le vérifier dans le contrat PostHog.
- Le mode serveur « cookieless » de PostHog (hachage IP + navigateur avec sel quotidien) n'est **pas** utilisé ici : il ferait calculer un identifiant à partir de l'IP, moins facile à défendre.

## 3. Le suivi d'erreurs (Sentry)

**Interprétation.** Le SDK Sentry navigateur lit des informations du terminal (navigateur, pile d'erreurs, URL) et les envoie : c'est un « accès » au sens des lignes directrices 2/2023 du CEPD. L'exemption « strictement nécessaire au service demandé » vise ce sans quoi le service ne marche pas (panier, session, sécurité). Un rapport de bug aide l'éditeur, pas le joueur au moment où il joue. La CNIL ne cite pas le suivi d'erreurs parmi les exemptions. L'intérêt légitime (art. 6 RGPD) peut fonder le traitement **des données**, mais ne dispense pas du consentement de l'art. 82 pour **l'accès au terminal**.

**Décision : Sentry reste soumis au consentement.** C'est la position sûre. Une exemption est défendable par certains praticiens mais non tranchée : **À valider** si on veut aller plus loin. Alternative sûre : suivre les erreurs côté serveur (fonctions Supabase), qui ne touchent pas le terminal.

## 4. Ce que font les autres

| Service | Pratique | Statut |
|---|---|---|
| [Lichess](https://lichess.org/privacy) | Aucun traceur ni publicité, un seul cookie de session. Pas de fenêtre du tout. | Vérifié (politique publique) |
| Chess.com | Bandeau cookies de plateforme de gestion du consentement avec « Accepter » mis en avant et réglages sur un second écran. | Observation, non vérifiée dans cette session. Pratique **à ne pas copier** : refus au deuxième niveau, contraire à la recommandation CNIL. |
| Duolingo | Demandes contextuelles au moment où le bénéfice est évident (notifications après la première leçon), textes à la voix de la mascotte. | Observation, non vérifiée dans cette session. Transposable pour le **ton**, pas pour le moment (Florian a fixé la fenêtre au premier lancement). |
| Jeux mobiles (iOS) | « Pré-écran » maison expliquant le bénéfice avant la fenêtre système App Tracking Transparency. Apple l'autorise s'il n'imite pas la fenêtre système et ne récompense pas l'accord ([Apple, User Privacy and Data Use](https://developer.apple.com/app-store/user-privacy-and-data-use/)). | Certain pour la règle Apple ; le gain de taux relève de retours de l'industrie, non vérifiés ici. À prévoir pour la version Capacitor si on ajoute un SDK soumis à ATT (ce n'est pas le cas aujourd'hui). |

Ce qui augmente les acceptations **de façon licite** :
1. **Demander moins** : exempter ce qui peut l'être (fait).
2. **Un bénéfice concret et vrai** pour le joueur, dans ses mots : « l'équipe répare plus vite ».
3. **La voix de Mochi**, un texte court, au tutoiement.
4. **Un libellé positif** : « Oui, j'aide ».
5. **Rassurer** : « Jamais ton e-mail ni tes coups », et dire ce qui se passe sans accord.

Ce qui est **interdit** et écarté : bouton Refuser plus petit, grisé ou caché ; refus au deuxième écran ; culpabiliser (« Non, je ne veux pas aider ») ; récompense contre l'accord ; redemander à chaque lancement ; bloquer le jeu.

## 5. Le style des deux boutons : décision

La recommandation CNIL (2020-092) demande que refuser soit aussi simple qu'accepter et invite à ne pas utiliser de design trompeur ; elle cite comme bonne pratique des boutons **de même niveau et de même format**. Mettre Accepter seul en couleur d'accent n'est pas interdit en soi, mais c'est précisément ce qui est reproché dans les dossiers de sanction quand le contraste oriente le choix.

**Décision : deux boutons identiques** (même classe `accord-choix`, même taille, même fond, même bordure, même graisse), côte à côte, sans couleur d'accent. L'ancienne version (Accepter en accent avec relief, Refuser en contour) est retirée. Un test Playwright vérifie que la taille et le style calculé des deux boutons sont identiques. Le focus d'ouverture reste sur le titre, pour ne favoriser aucun choix.

Échap ferme sans choix : la fenêtre revient au lancement suivant (pas de consentement implicite). Pendant ce temps, seule la mesure exemptée tourne.

## 6. Recommandation

**Sûr, mis en œuvre :**
- Mesure d'audience anonyme sans consentement, PostHog en mode exempté (mémoire, aucun profil, IP non conservée, aucun croisement), avec droit d'opposition dans Conditions.
- Fenêtre au premier lancement limitée aux rapports de bugs (Sentry) et au suivi détaillé (identifiant persistant, lien avec le compte).
- Texte à la voix de Mochi, bénéfice concret et vrai, deux boutons strictement équivalents.

**À valider par un avocat avant production :**
- PostHog dans l'exemption (outil non examiné par la CNIL, société américaine, contrat).
- Toute exemption de Sentry (non retenue ici).
- La politique de confidentialité complète (durées de conservation : 25 mois maximum pour la mesure exemptée). PostHog Cloud gratuit garde les événements **1 an**, sans réglage possible : la limite est respectée.

**Configuration PostHog vérifiée le 27/09 :** « Discard client IP data » est activé (projet 285580). Les événements sont gardés 1 an, la durée fixée par l'offre gratuite. Les enregistrements de session sont désactivés (conservation 30 jours s'ils étaient activés). Si l'offre passe en payant, la conservation passe à 7 ans : il faudra alors purger les données à 25 mois.

## 7. Fichiers

- `src/data/analytics.ts` : trois niveaux (`aucun`, `anonyme`, `complet`), réglages `POSTHOG_ANONYME` et `POSTHOG_COMPLET`, `setOpposition`.
- `src/app/Confidentialite.tsx` : fenêtre réécrite, page Conditions avec deux interrupteurs.
- Tests : `src/data/analytics.test.ts`, `e2e/confidentialite.spec.ts`.
- Captures : `docs/design/v2/captures/consentement-v2-clair.png`, `consentement-v2-sombre.png`.
