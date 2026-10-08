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
- Captures : `docs/design/v2/captures/consentement-v2-clair.png`, `consentement-v2-sombre.png` (fenêtre d'avant #485).

## 8. Compteurs anonymes de la première visite (#437, 5 octobre 2026)

**Le besoin.** Sur 30 jours, PostHog compte 24 « limite de l'essai atteinte » pour 2 comptes créés, mais l'entonnoir de la première visite reste aveugle : au niveau anonyme, l'identifiant de PostHog change à chaque ouverture, et rien ne relie la première pierre à la création du compte. Plutôt que d'élargir PostHog, on ajoute la mesure la plus pauvre possible : six totaux par jour.

**Le dispositif** (`src/data/compteurs.ts`, migration `20261005120100_compteurs_entonnoir.sql`) :
- Serveur : table `compteurs_entonnoir (jour, etape, n)`, une ligne par jour (Europe/Paris) et par étape, écrite seulement par la fonction `compter_etape(p_etape)` (`security definer`, liste blanche de six étapes, incrément atomique). La fonction ignore la session : elle ne lit ni `auth.uid()` ni le jeton. RLS sans politique : aucune lecture par l'app, lecture par la clé service seulement (tableau de bord SQL).
- Appareil : un repère par étape, `go.entonnoir.<étape>`, dont la valeur est le mois de l'écriture (`AAAA-MM`). Il sert seulement à ne pas recompter l'étape. Pas d'identifiant, pas d'heure, rien de commun à deux étapes.
- Requête : clé publique seule (`apikey`), `credentials: 'omit'` (aucun cookie), `referrerPolicy: 'no-referrer'` (pas d'adresse de page), corps `{ "p_etape": "…" }`. Envoyée après le premier écran, jamais attendue.

**Confrontation aux conditions de l'exemption (section 2) :**

| Condition CNIL | Ce que fait le dispositif | Appréciation |
|---|---|---|
| 1. Finalité unique : mesure d'audience pour l'éditeur | Totaux de l'entonnoir, lus par l'équipe seulement ; aucune autre utilisation, aucun tiers | Remplie |
| 2. Statistiques anonymes seulement | Le serveur ne reçoit qu'un nom d'étape et ne garde qu'un total par jour. Aucun lien possible entre deux étapes d'un même appareil (pas d'identifiant, même commun) | Remplie. Les totaux ne sont pas des données personnelles |
| 3. Ni suivi global, ni croisement, ni transmission | Aucun croisement avec PostHog, le compte ou la session (la fonction ne lit pas la session) | Remplie |
| 4. Traceur de 13 mois au plus, non prolongé ; données 25 mois au plus | Le repère porte le mois de son écriture, n'est jamais réécrit tant qu'il est valide, est ignoré puis **effacé** au-delà de 13 mois (`purgerReperesExpires`, à chaque lancement) | Remplie pour le traceur. Les totaux, anonymes, ne sont pas soumis à la limite de 25 mois ; une purge à 25 mois reste possible si l'avocat le souhaite |
| 5. IP non conservée | La table ne contient pas d'IP. La passerelle de Supabase journalise l'IP de toute requête (journaux techniques, durée selon l'offre) | **À valider** : même situation que n'importe quelle requête vers l'API ; journaux non utilisés pour la mesure (E23 de la politique) |
| 6. Information et droit d'opposition | Politique (sections 2, 3.1, 3.3) et page Conditions de l'app (« Comptage anonyme » : une phrase ajoutée) ; l'interrupteur « Comptage anonyme des parties » coupe aussi les compteurs et **efface les repères** | Remplie |

**Pourquoi un repère sur l'appareil plutôt que rien.** Sans lui, chaque étape serait recomptée à chaque ouverture (la première pierre de chaque partie, l'écran de chaque lancement) : les totaux ne mesureraient plus des appareils et l'entonnoir serait faux. Un repère par étape, sans identifiant, est le minimum pour compter « au plus une fois par appareil ». Il n'est **pas** strictement nécessaire au service demandé par le joueur : il relève de l'exemption de mesure d'audience, pas de l'exemption « service ». En navigation privée stricte (stockage refusé), rien n'est écrit : l'étape est comptée au plus une fois par page.

**Seuls les nouveaux appareils.** `premier_ecran` n'est compté qu'au tout premier lancement (aucune partie, aucun jour de retour), et les étapes suivantes seulement sur un appareil dont le premier écran a été compté. Les joueurs d'avant #437 ne sont donc jamais comptés : pas de « première pierre » qui n'en est pas une.

**Appareils de l'équipe.** `go.equipe.v1`, posé par un membre de l'équipe sur son propre appareil (`?equipe=1`, ou 7 touchers sur la version dans Profil > Réglages), coupe PostHog et les compteurs. C'est un choix de l'utilisateur de l'appareil, sans identifiant : aucune question de consentement. Sentry n'est pas concerné (il suit toujours l'accord).

**Abus.** L'appel est ouvert à tous (clé publique) : n'importe qui peut ajouter 1. Faute d'identifiant (voulu), la limite ne peut pas viser un appelant. Deux plafonds par étape : **60 par minute** et **20 000 par jour** ; au-delà, l'appel est refusé sans erreur et compté dans `compteurs_entonnoir_fenetre.refus` (un jour pollué se voit). Ordre de grandeur actuel : quelques dizaines par jour. Plafonds à relever par migration si l'audience approche de 60 nouveaux joueurs par minute.

**À valider par un avocat :** l'appréciation des conditions 4 et 5 ci-dessus, et l'ajout de ces compteurs à l'auto-évaluation CNIL prévue pour PostHog (E1).

## 9. Bandeau bas compact au premier écran (#485, 8 octobre 2026)

**Le constat (#466, P8).** La fenêtre modale de #64 (58 mots, boutons compris) couvrait l'accueil au tout premier écran et cachait l'action principale « Joue ta première partie ». Le joueur devait lire avant de jouer.

**La nouvelle forme.** Un bandeau bas, non modal, sans voile (`ConsentModal` dans `src/app/Confidentialite.tsx`, styles dans `src/ui/profil.css`) :
- posé au-dessus de la barre de navigation ; sur les écrans bas (hauteur ≤ 640 px, par exemple 320 × 568), il se pose sur la barre du bas plutôt que sur le bouton « jouer » ;
- l'accueil reste visible et utilisable : on peut jouer sans répondre. Le bandeau se retire pendant une partie et revient à l'accueil, comme avant ;
- la page garde de quoi défiler au-dessus du bandeau (rien n'est caché pour de bon).

**Le texte (fr, 24 mots titre compris, 51 avant ; 29 avec les boutons, 58 avant) :**

> **Tu m'aides à chasser les bugs ?** Si oui, on reçoit les rapports de bug et on voit si tu reviens. Change d'avis dans Profil.
> [Détails] [Oui, j'aide] [Non merci]

En anglais : « **Will you help us catch bugs?** If yes, we get bug reports and see if you come back. Change your mind in Profile. [Details] [Yes, I'll help] [No thanks] ».

**Ce qui a été retiré du bandeau, et où le trouver.** « Jamais ton e-mail ni tes coups » et « Sans ton accord, on compte juste les parties » sont dans la page Conditions (« Seulement si tu dis oui », « Comptage anonyme »), ouverte par « Détails ». La mesure exemptée n'a pas à figurer dans le bandeau : la CNIL demande qu'elle soit mentionnée dans la politique, avec un droit d'opposition (section 2). Coût possible : un peu moins de réassurance au moment du choix, donc un taux d'accord à surveiller (`docs/data/plan-de-marquage.md`).

**Confrontation aux lignes directrices et à la recommandation CNIL de 2020 (délibérations 2020-091 et 2020-092) :**

| Exigence | Bandeau #485 | Appréciation |
|---|---|---|
| Refuser aussi simple qu'accepter, au même niveau | « Oui, j'aide » et « Non merci » côte à côte, même classe, même taille, même style calculé (testé : `e2e/consentement-bandeau.spec.ts`, `e2e/confidentialite.spec.ts`). Focus d'ouverture sur le titre, aucun choix mis en avant | Rempli |
| Pas de case pré-cochée, le silence ne vaut pas accord | Aucune case. Sans réponse (on joue, on ferme avec Échap), rien de non essentiel n'est chargé : le chargement de Sentry et du suivi détaillé n'a pas changé (`src/data/analytics.ts`) | Rempli |
| Finalités claires avant le choix | « rapports de bug » (Sentry) et « on voit si tu reviens » (identifiant persistant, lien avec le compte). Détail par finalité dans Conditions | Rempli. **À valider** : le lien de l'identifiant avec le compte n'est dit que dans Conditions (« un numéro gardé sur ton téléphone… »). Un avocat peut juger que « on voit si tu reviens » suffit au premier niveau, la recommandation admettant une information en deux niveaux |
| Lien vers le détail | « Détails » (44 px) ouvre la page Conditions et confidentialité ; le bandeau revient au retour | Rempli |
| Retrait aussi simple que l'accord, et information sur le retrait avant le choix (art. 7.3 RGPD) | « Change d'avis dans Profil » dans le bandeau ; un interrupteur dans Profil, Conditions et confidentialité | Rempli |
| Durée de conservation du choix | Inchangée (`go.consentement.v1`, sans limite) | **À valider** : la CNIL recommande de garder le choix pendant une durée limitée, puis de redemander (6 mois cités comme bonne pratique). Hors du périmètre de #485 |
| Mineurs | Inchangé : sous 15 ans, le consentement est fragile ; seuls Sentry et le suivi détaillé en dépendent | Inchangé (section 1) |

**Accessibilité.** Boîte de dialogue **non modale** (`<dialog>` ouverte par `show()`) : la page n'est pas rendue inerte ; nom = titre, description = texte. Le focus va au titre à l'ouverture (lu en premier), Tab parcourt Détails, Oui, Non puis ressort vers la page ; Échap, focus dans le bandeau, ferme sans choix (il revient au lancement suivant). Cibles de 44 px, contrastes AA en clair et en sombre, mouvements réduits : simple fondu.

**Fichiers.** `src/app/Confidentialite.tsx`, `src/ui/profil.css`, `src/content/i18n/fr.ts`, `src/content/i18n/en.ts` ; tests : `src/app/consentement.test.ts` (longueur, finalités, retrait, tutoiement), `e2e/consentement-bandeau.spec.ts`, `e2e/confidentialite.spec.ts`.
