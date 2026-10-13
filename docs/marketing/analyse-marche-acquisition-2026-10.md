# Mochi Go : analyse du marché et stratégie d'acquisition sur 90 jours

Responsable marketing, 13/10/2026. Demande de Florian : « une analyse du marché pour le jeu et une stratégie d'acquisition ». Travail de recherche et de rédaction, sans code.

Ce document met à jour `docs/marketing/plan-lancement.md` (#112, 0 €, 4 semaines), dont les faits ont vieilli : l'app a maintenant 35 leçons, plus de 200 problèmes prouvés, une version anglaise complète, des défis entre amis, des parties classées et le partage de l'app (#521).

**Règle de lecture.** Chaque chiffre a une source (liste numérotée en fin de document, renvois [n]). Quand un chiffre est **mon estimation**, c'est écrit. Les notes « impact, coût, délai » et les seuils de succès sont aussi des choix à moi, pas des faits.

**Limite de la recherche.** Depuis ce conteneur, le proxy refuse l'ouverture directe des pages (Wikipedia, chess.com, IGF…). Les chiffres viennent des extraits renvoyés par le moteur de recherche, pages citées. Avant tout usage public (presse, fiche, pitch), il faut ouvrir la source et vérifier le chiffre. Google Trends n'a pas pu être consulté : voir la section 1.5.

---

## Synthèse (10 lignes)

1. Le go est un grand jeu au petit marché hors d'Asie : plus de 46 millions de personnes connaissent les règles dans le monde (IGF, 2016) [1], mais la France compte environ 1 600 licenciés FFG et une centaine de clubs [5][6].
2. Le marché recule là où il est le plus grand : au Japon, le Livre blanc des loisirs compte 1,2 million de joueurs, plus bas historique [3][4]. Il n'y a aucun effet AlphaGo durable mesuré en Europe.
3. Les échecs montrent ce qui est possible : chess.com a 243 millions de membres et 8,7 millions de joueurs actifs par jour fin 2025 [12]. En France, la FFE est passée d'environ 50 000 à environ 80 000 licenciés [15][16].
4. Duolingo enseigne les échecs depuis 2025 et revendique des « millions » d'apprenants par jour [19][20]. L'apprentissage ludique d'un jeu de stratégie a un public massif, mais il n'existe pas encore pour le go.
5. Les concurrents directs sont anglophones, payants dès qu'on progresse (BadukPop Pro à 49,99 $/an [22], AI Sensei de 4,95 à 24,95 €/mois [25]) ou faits pour ceux qui savent déjà jouer (OGS, Fox, Tygem).
6. **La place libre** : un parcours débutant en français, gratuit et sans publicité, avec une IA forte qui tourne sur l'appareil. Aucun produit trouvé ne réunit ces quatre points.
7. Notre cible la plus rentable n'est pas le joueur de go, c'est **le joueur d'échecs curieux** : il y a 50 fois plus de licenciés d'échecs que de licenciés de go en France (mon calcul : 80 000 / 1 600), il connaît déjà les codes de chess.com, et nos canaux pour le toucher sont gratuits.
8. Aujourd'hui, l'app reçoit **1 à 2 humains par jour, et 0 première pierre mesurée** sans accord (`docs/data/mesure-lancement-2026-10.md`). Avant d'amener du trafic, il faut vérifier que l'entonnoir tient avec 5 vrais débutants.
9. Plan sur 90 jours en 3 phases : (1) prérequis, communautés go et échecs, clubs FFG, Hacker News ; (2) contenu court, créateurs, presse, SEO ; (3) petit test payant avec seuils d'arrêt, puis les stores si Capacitor est prêt.
10. Budget proposé (mon estimation) : environ 300 € de dépenses hors stores sur 90 jours, et 8 à 10 h par semaine de Florian. Objectif à J90 : 500 nouveaux humains par semaine, avec un coefficient de partage mesuré. C'est loin des 10 000 de la charte à 6 mois, mais lisible et réaliste.

---

## 1. Analyse du marché

### 1.1 Taille du go dans le monde

| Zone | Chiffre | Année | Source | Fiabilité |
|---|---|---|---|---|
| Monde | Plus de 46 millions de personnes qui connaissent les règles, plus de 20 millions de joueurs actuels, en majorité en Asie de l'Est | 2016 | Enquête de la Fédération internationale de go (IGF), 51 pays, estimations déclarées par chaque fédération [1] | Moyenne : déclaratif, déjà ancien |
| Monde | Plus de 24 millions de joueurs | 2002 | Recensement japonais cité par Wikipedia [2] | Ancienne |
| Japon | 1,2 million de joueurs (1,2 % de la population ; 2,2 % des hommes, 0,2 % des femmes), contre 1,3 million l'année précédente ; plus bas historique. Stable à 1,2 million dans l'édition 2025 | 2023-2024 | Livre blanc des loisirs (レジャー白書), Japan Productivity Center, cité par Yahoo! News Japon et par un lecteur de l'édition 2025 [3][4] | Bonne (enquête annuelle) |
| Corée du Sud | 25 % des Coréens disent savoir jouer en 2013, après un creux à 20 % en 2004 | 2013 | Sondages Gallup Korea, cités par NamuWiki (source secondaire) [7] | Faible à moyenne |
| Chine | Pas de chiffre officiel trouvé. Un responsable allemand cité par China Daily parle d'« environ 2 millions » de jeunes joueurs ; le go est une activité extrascolaire courante dans les villes | 2019 | China Daily, Jakarta Post [8][9] | Faible (ordre de grandeur) |
| Europe | 35 à 37 fédérations membres de la Fédération européenne (EGF) ; la base des tournois européens (EGD) recense 54 644 joueurs **cumulés depuis 1996** | 2018-2026 | EGF, EGD [10][11] | Bonne pour l'EGD, mais ce n'est pas un nombre d'actifs |
| France | Environ 1 600 licenciés et 100 clubs (octobre 2024) ; la FFG en comptait plus de 1 650 en 2006-2008 ; sa liste en ligne affiche 96 à 100 clubs | 2024 | Wikipedia FR, liste des clubs FFG [5][6] | Bonne |

**Lecture.**
- Le go compte des dizaines de millions de pratiquants, mais il est concentré en Asie de l'Est et vieillit au Japon.
- En France, la pratique organisée est stable et minuscule : environ 1 600 licenciés, contre environ 80 000 aux échecs (section 1.3). Le stock de « joueurs de go » français ne suffira jamais à faire une grande app. Il faut **créer** des joueurs, pas en capter.
- Le joueur de club français reste précieux : il initie les débutants, il anime des clubs et des écoles, et il est prescripteur.

### 1.2 Le go en ligne

| Plateforme | Ce qu'on sait | Source |
|---|---|---|
| **Fox (Yehu, 野狐)** | Souvent décrit comme le serveur le plus peuplé, utilisé par les pros (Ke Jie, Park Junghwan). Surtout chinois ; l'inscription par QQ bloque une partie des joueurs étrangers | [26][27] |
| **Tygem** | Deuxième serveur, surtout coréen, « environ 10 000 joueurs en ligne en moyenne » (chiffre non daté). Com2uS en a pris la majorité en 2020 | [26][28] |
| **OGS** (online-go.com) | Environ 400 000 inscrits et 2 000 connectés à un instant donné selon une page non datée ; GoMagic compte en moyenne 450 joueurs en direct et 3 200 en correspondance. Gratuit, option « Site Supporter » | [26][29][30] |
| **KGS** | Repris par l'American Go Foundation en 2017. En 2019, il ne couvrait plus ses coûts et ses événements payants sont devenus gratuits, avec des dons libres | [31][32] |
| **BadukPop** | App d'apprentissage anglophone. Note de 4,8 sur l'App Store américain (environ 6 400 notes). Plus de 4 000 problèmes relus par des pros, IA de 20 kyu à 7 dan et plus. Freemium : Pro à 6,99 $ ou 49,99 $ par an (prix US) | [21][22] |
| **SmartGo One** | iOS, 4,8 (environ 1 700 notes). Moteur basé sur KataGo, plus de 100 problèmes de tutoriel, base de parties pros. Pro à 2,99 $ par mois, pack de parties à 19,99 $ | [23] |
| **Go Quest** | Parties en ligne rapides, gratuites, cotes dan-kyu et Elo. Pas de note trouvée | [24] |
| **AI Sensei** | Analyse web avec KataGo pour joueurs de club : gratuit, Basic à 4,95 €, Dan à 9,95 €, Pro à 24,95 € par mois | [25] |
| **PVGo** | App gratuite disponible en français et 32 autres langues, avec un moteur basé sur GNU Go (plus faible que KataGo) | [33] |
| **GoMagic** | Cours « Les bases du go en 13 × 13 », partiellement en français ; vidéos gratuites sur YouTube, cours complet payant | [34] |

Projets techniques proches de notre approche, sans audience connue : Kaya (React, KataGo converti en ONNX, licence AGPL) et un jeu sur itch.io avec un réseau de type KataGo en TensorFlow.js [35][36].

**Lecture.**
- Aucun chiffre d'utilisateurs actifs publié n'a été trouvé pour Fox, Tygem, OGS ou BadukPop. Pour le go en ligne hors d'Asie, le seul ordre de grandeur est celui d'OGS : quelques milliers de connectés.
- **Mon estimation** : le go en ligne occidental actif se compte en dizaines de milliers de joueurs, pas en millions. Ce n'est pas un marché à prendre, c'est un vivier de prescripteurs.

### 1.3 Tendances

| Tendance | Ce que disent les sources | Effet pour nous |
|---|---|---|
| **AlphaGo (2016)** | 100 à 280 millions de spectateurs selon les sources, aucune mesure auditée [37]. Pic de recherches net en Asie, pas ailleurs [38]. En Occident, les clubs ont constaté « quelques demandes en plus » [38] | L'effet n'a pas duré hors d'Asie. Le récit « l'IA qui a battu l'homme » reste un bon crochet pour la presse tech et Hacker News |
| **IA de niveau pro accessible** | KataGo est open source ; AI Sensei, SmartGo et KaTrain l'utilisent. Mochi Go le fait tourner sur l'appareil, gratuitement | Argument technique fort, mais pas grand public en soi. Le débutant veut apprendre, pas une IA |
| **Hikaru no Go** (manga 1998-2003, anime 2001-2003, 75 épisodes) | Engouement fort chez les enfants au Japon vers 2000 : « des centaines de cours » ouverts, d'après Newsweek. Effet aussi hors du Japon, mais il n'a pas duré [39][40][41]. Pièce de théâtre à Tokyo en juillet 2024, à guichets fermés selon des fans [42] | Fans adultes nostalgiques, faciles à toucher par une référence. Aucune nouvelle série annoncée en 2025-2026 |
| **Manga et culture japonaise en France** | Environ 36 millions de mangas vendus en 2024 (309 M€), en baisse de 9 % en volume après le pic de 2021-2022 [43]. Japan Expo 2026 : plus de 222 000 visiteurs [44] | Grand public sensible à l'esthétique japonaise, cohérent avec Encre & Jade et Mochi |
| **Jeux de société en France** | 587 M€ et 34 millions de boîtes en 2024 [45] ; 624 M€ en 2025 selon Circana, cité par CB News [46] | Un public adulte qui aime les jeux de réflexion physiques : c'est la cible de la charte |
| **Échecs après *Le Jeu de la dame* (2020)** | Environ 2,5 millions d'inscrits sur chess.com dans les semaines qui ont suivi, et des inscriptions quotidiennes en hausse de 400 % [47]. Recherches « chess » au plus haut depuis 14 ans selon Google [48]. Environ 7 fois plus d'inscriptions au Royaume-Uni sur 4 mois [49] | Une œuvre grand public peut multiplier un marché de jeu. On ne la provoque pas, mais on doit être prêt (SEO, pages « Le go dans … ») |
| **Streamers et vidéos de go** | Chaînes anglophones de niche : New York Institute of Go (plus de 2 000 abonnés en 2019), Michael Redmond, Go Pro Yeonwoo, Dwyrin (plus de 5 millions de vues cumulées selon l'AGA) [50][51] | Petites audiences très qualifiées. Partenariats bon marché, mais volume faible |

### 1.4 Marchés voisins et références

| Référence | Chiffres | Ce qu'on en retient |
|---|---|---|
| **chess.com** | 243 millions de membres au 31/12/2025 et 8,7 millions d'actifs par jour en moyenne au T4 2025 (+17,5 % sur un an) [12]. 250 millions dépassés vers fin février 2026 [13]. Chiffre d'affaires de plus de 200 M$ selon un portrait du PDG, aucun chiffre audité [14] | Modèle freemium à paliers (Gold, Platinum, Diamond). Platinum ouvre la revue de partie illimitée ; Diamond ajoute les explications du coach sur chaque coup [52]. Prix par un site tiers non officiel : 5,99, 9,99 et 14,99 $ par mois [53] |
| **Lichess** | Gratuit, open source, géré par une association sans but lucratif [54]. 4 millions d'utilisateurs actifs confirmés en janvier 2023 (chiffre cité sur son forum) [55] | La preuve qu'une plateforme de jeu sans publicité vit des dons. Mais Lichess repose sur des bénévoles et une communauté déjà massive |
| **Échecs en France** | FFE : 76 100 licences en 2024 selon l'INSEE [15]. Selon son président, environ 80 000 licenciés en 2024, après 15 ans entre 50 000 et 55 000 [16]. Joueurs francophones sur chess.com : +143 % de juin 2024 à juin 2025 [16] | Le marché voisin le plus proche, en forte croissance en France |
| **Duolingo** | T2 2026 : 58,7 millions d'actifs par jour (+23 %), 140,6 millions par mois, 12,7 millions d'abonnés payants, 298,5 M$ de chiffre d'affaires sur le trimestre [17][18]. Cours d'échecs lancé en juin 2025 sur iOS, « des millions d'apprenants par jour » selon l'entreprise [19][20] | Calcul à moi : 12,7 / 140,6 = environ 9 % des actifs mensuels paient. La série, le rituel du jour et la gratuité du parcours de base fonctionnent. Point de vigilance : **Duolingo pourrait ajouter le go**. Rien ne l'annonce, mais il faut aller vite sur le français |
| **Jeux vidéo en France** | 37 millions de joueurs, âge moyen de 40 ans (étude SELL et Médiamétrie, relayée par Clubic) [56] | Ordre de grandeur du public qui joue sur écran |

### 1.5 Recherches Google

Google Trends n'a pas pu être consulté (accès refusé depuis le conteneur, et aucune série « go game » ou « jeu de go » dans les résultats). Il reste deux faits indirects : le pic AlphaGo surtout en Asie [38], et le pic « chess » de 2020 [48].

**À faire par Florian, 10 minutes** : sur trends.google.fr, comparer « jeu de go », « échecs » et « apprendre le go » en France sur 5 ans, et « go game », « baduk » et « learn go » dans le monde. Noter la saisonnalité (rentrée, Noël) pour caler les publications. La Search Console donnera ensuite les vrais volumes de nos pages.

### 1.6 Concurrents directs : forces, faiblesses, place libre

| | BadukPop | OGS | SmartGo One | AI Sensei | PVGo | **Mochi Go** |
|---|---|---|---|---|---|---|
| Public | Débutant à fort | Joueurs qui savent jouer | Joueur iOS sérieux | Joueur de club | Débutant | Débutant, puis kyu |
| Langue | Anglais (français non trouvé) | Multilingue (communauté) | Anglais, japonais… | Anglais | Français et 32 autres | **Français d'abord**, anglais complet |
| Prix | Freemium, Pro 49,99 $/an | Gratuit, dons | Freemium, 2,99 $/mois | 0 à 24,95 €/mois | Gratuit | Gratuit, sans pub (Premium à l'étude) |
| IA | Cloud, de 20 kyu à 7 dan et plus | Bots, revue IA | KataGo sur l'appareil | KataGo dans le cloud | GNU Go | **KataGo sur l'appareil, hors ligne** |
| Note des stores | 4,8 (US) | — | 4,8 | — | — | Pas encore sur les stores |
| Forces | 4 000 problèmes, finition, notoriété | Communauté, tournois, gratuité | Profondeur, base pro | Analyse précise | Gratuit, en français | Leçons jouables dès le 1er écran, revue honnête, Go du jour partageable, accessibilité |
| Faiblesses notées | Moitié des leçons et explications d'échec derrière le paiement, pièces et « clés » critiquées [22][21] | Austère pour un débutant | iOS, payant pour aller loin | Pas pour débutant | IA faible, interface datée | Jeune, aucune note ni avis, 1 à 2 humains par jour, pas encore sur les stores |

**La place libre**, en une phrase : *le premier parcours pour apprendre le go en français, gratuit, sans publicité, avec une IA forte qui tourne sur ton téléphone.* Sur les produits trouvés, BadukPop a le parcours mais pas le français ni la gratuité ; PVGo a le français et la gratuité mais pas l'IA ni le parcours moderne.

Ce qu'il ne faut pas promettre : « la meilleure app », « la plus forte IA » (règles de `docs/marketing/fiches-stores.md`).

### 1.7 Cibles (personas) et tailles

Pour chaque cible, je donne un chiffre sourcé qui sert d'**indicateur de taille** (pas le nombre de personnes prêtes à essayer le go). L'**estimation du public touchable en 90 jours** est la mienne, et c'est un ordre de grandeur.

| Persona | Qui | Indicateur de taille sourcé | Touchable en 90 j (mon estimation, ordre de grandeur) | Message | Canaux |
|---|---|---|---|---|---|
| **1. Le joueur d'échecs curieux** (cœur) | Adulte de 20 à 45 ans, joue sur chess.com ou Lichess, entend dire que le go est « plus profond » | France : environ 80 000 licenciés FFE [16], joueurs francophones sur chess.com en forte hausse [16]. Anglais : r/chess compte environ 1,8 million de membres [57] | Quelques milliers de visites via Reddit, Discord et les créateurs | « Tu connais les échecs ? Le go s'apprend en 5 minutes. Ta première partie se joue tout de suite, contre une IA qui t'attend. » | r/chess, r/chessbeginners, Discords d'échecs, créateurs d'échecs FR, page SEO « go et échecs » |
| **2. Le curieux de jeux de stratégie** (cœur) | Joueur de jeux de société ou de jeux de réflexion sur mobile, n'a jamais joué au go | Jeux de société : 587 M€ en France en 2024 [45] ; 37 millions de joueurs de jeux vidéo [56] | Le plus grand réservoir, mais le plus cher à toucher : contenu court, SEO, presse | « Un jeu de 2 500 ans, des règles en une minute. Apprends en jouant, pas en lisant. » | Vidéos courtes, SEO « règles du go », presse jeux, r/boardgames |
| **3. Le fan d'anime et de culture japonaise** | A vu *Hikaru no Go* ou aime l'esthétique japonaise | 36 millions de mangas vendus en France en 2024 [43] ; plus de 222 000 visiteurs à Japan Expo 2026 [44] | Faible sans créateur relais ; fort si un créateur manga ou anime en parle | « Tu as vu *Hikaru no Go* ? Pose ta première pierre en 10 secondes. » | TikTok et Reels, communautés d'anime, Japan Expo 2027 (plus tard) |
| **4. Le parent ou l'enseignant** | Cherche une activité de réflexion sans pub ni achats pour un enfant ou une classe | 6,27 millions d'élèves en primaire à la rentrée 2024 [58] ; 852 800 enseignants en tout [59]. Le go à l'école est étudié à l'IREM de Strasbourg (règles simplifiées) et la FFG a un dossier « go scolaire » [60][61] | Faible en 90 jours (cycle de l'année scolaire), fort ensuite | « Un jeu de logique sans pub ni achat, qu'un enfant apprend seul en 5 minutes. » | Clubs FFG qui interviennent en périscolaire, IREM, forums d'enseignants |
| **5. L'ancien joueur ou le joueur de club** (second cercle) | A joué il y a 10 ans, ou joue en club et veut une IA simple sur mobile | Environ 1 600 licenciés FFG [5] ; 54 644 joueurs cumulés dans l'EGD [11] ; r/baduk compte environ 50 000 membres [62] ; OGS environ 400 000 inscrits (non daté) [29] | Quelques centaines, mais prescripteurs | « Ton analyse KataGo sur ton téléphone, gratuite et hors ligne. Importe ta partie et rejoue tes erreurs. » | r/baduk, forums OGS et lifein19x19, clubs FFG, Discords de go |

**Conséquence.** Les personas 1 et 5 sont gratuits à toucher et rapides : ils ouvrent le plan. Le persona 2 est le volume de long terme (SEO, contenu). Le persona 4 se prépare pour janvier, avec les clubs.

### 1.8 Modèles économiques possibles (sans rien décider)

| Modèle | Qui le pratique | Prix pratiqués | Pour Mochi Go |
|---|---|---|---|
| **Freemium à abonnement** | chess.com, BadukPop, SmartGo, Duolingo | BadukPop : 6,99 $ ou 49,99 $ par an [22]. SmartGo : 2,99 $ par mois [23]. chess.com : environ 6 à 15 $ par mois selon le palier (source tierce) [53]. Duolingo : environ 9 % des actifs mensuels paient (mon calcul sur [17]) | Piste de la charte : 4,99 € par mois ou 39,99 € par an, dans la fourchette des concurrents. Ce qui se paie ailleurs : analyse illimitée, explications, problèmes illimités |
| **Abonnement à paliers d'analyse** | AI Sensei | 4,95 / 9,95 / 24,95 € par mois [25] | Notre IA est sur l'appareil, donc l'analyse ne nous coûte rien. On peut la donner plus largement que les concurrents : c'est un argument d'acquisition |
| **Dons** | Lichess, OGS (Site Supporter), KGS | Variables | Lichess prouve que ça marche à très grande échelle ; KGS montre la fragilité à petite échelle [32]. Compatible avec « sans pub », complément plutôt que modèle principal |
| **Achat unique** | SmartGo (pack à 19,99 $) [23] | 5 à 20 $ | Simple, mais peu de revenus récurrents |
| **B2B écoles et clubs** | Pas de cas trouvé pour le go en France ; aux échecs, la FFE s'appuie sur le scolaire [16] | — | Licence classe ou club (tableau de bord d'enseignant, comptes élèves sans e-mail). À explorer avec la FFG ; cycle de vente lent |

Contrainte à garder : **gratuit, sans publicité** est notre promesse d'acquisition. Toute piste qui la casse coûte des joueurs.

---

## 2. Stratégie d'acquisition sur 90 jours

### 2.1 Point de départ

| Fait | Source dans le dépôt |
|---|---|
| 1 à 2 humains par jour ; environ 87 % des « premiers écrans » comptés sont des robots | `docs/data/mesure-lancement-2026-10.md` |
| 0 première pierre mesurée sans accord depuis le 28/09, sur environ 8 humains : impossible à conclure, mais c'est un signal à vérifier | idem |
| Les rares humains ne sont presque pas francophones | idem |
| Pages de référencement en ligne : `/apprendre-le-go`, `/regles-du-go`, `/en/learn-go`, `/en/go-rules`, plus le sitemap | #472, `docs/growth/search-console.md` |
| Boucles déjà codées : Go du jour partageable (`/j/N`, #75, #285), défi par lien (#81), partage de partie et du moment clé (#364), partage de l'app (#521), aperçus des liens (#489) | `docs/data/plan-de-marquage.md` |
| Sans compte : 3 parties d'essai, leçons 1 à 3, Go du jour ; ensuite, un compte gratuit | #343, fiche des stores v3 |
| Rappel quotidien prêt mais **désactivé** | #351, `docs/journal.md` |
| Pas de Capacitor, compte Apple reporté | `docs/journal.md` (04/10) |

### 2.2 Prérequis bloquants (avant de pousser du trafic)

| # | Prérequis | Pourquoi c'est bloquant | Qui | Temps |
|---|---|---|---|---|
| P1 | **Régénérer la clé `sbp_` (Supabase) et la clé Resend**, toutes deux collées dans une conversation | Une clé exposée sur un produit qui gagne en visibilité est un risque réel | Florian | 15 min |
| P2 | **Search Console et Bing** : vérifier le domaine, envoyer le sitemap, demander l'indexation des 4 pages | Sans cela, pas de SEO mesurable ; les pages ont besoin de semaines pour monter | Florian, guide `docs/growth/search-console.md` | 20 min, plus l'attente DNS |
| P3 | **Aperçus des liens vérifiés** (debugger Facebook, LinkedIn, WhatsApp) | Le premier partage reste en cache plusieurs jours | Florian | 15 min |
| P4 | **Test avec 5 débutants réels** (amis, famille, collègues), observés sans aide : arrivent-ils à la première pierre en moins d'une minute ? à la fin de la première partie ? | 0 première pierre mesurée : avant de dépenser du temps ou de l'argent, il faut savoir si l'entonnoir fuit | Florian, 5 × 15 min | 1 h 30 |
| P5 | **Mesure par canal** : vérifier que `utm_source` et `utm_campaign` arrivent dans PostHog, même en mode anonyme, et créer le tableau « Lancement : premières minutes » (filtre robots) proposé dans `mesure-lancement` | Sans cela, impossible de savoir quel canal amène des joueurs qui restent | Agent données | 1 h d'agent |
| P6 | **Activer le rappel quotidien** (VAPID, déjà codé) | La rétention est la première condition pour que l'acquisition rapporte ; le rappel vise J7 à 25 % | Florian (décision), agent (activation) | 30 min |
| P7 | **Formulaire de retours** (3 questions) et une adresse de contact visible | Les communautés vont répondre ; il faut recueillir les retours | Agent | 30 min |
| P8 | **Décisions juridiques D1 à D8** : vérifier qu'aucune ne bloque une campagne (publicité payante, e-mail à la liste d'attente) | Évite de devoir couper une campagne en cours | Florian, avec l'agent juridique | 30 min |

Les prérequis P1 à P5 doivent être faits avant la semaine 1. P6 à P8 peuvent l'être pendant.

### 2.3 Canaux priorisés

Notes de 1 à 5, **attribuées par moi** : impact (5 = beaucoup de joueurs qui restent), coût (5 = gratuit), délai (5 = résultats en quelques jours). Score = produit des trois, sur 125.

| Rang | Canal | Impact | Coût | Délai | Score | Phase |
|---|---|---|---|---|---|---|
| 1 | Boucles dans l'app (Go du jour, défi, partage de l'app) | 4 | 5 | 4 | 80 | Toujours, multiplie les autres |
| 2 | Communautés d'échecs (r/chess, r/chessbeginners, Discords) | 4 | 5 | 4 | 80 | 1 |
| 3 | Communautés de go (r/baduk, forums OGS et lifein19x19, Discords) | 3 | 5 | 5 | 75 | 1 |
| 4 | Hacker News (Show HN) | 3 | 5 | 5 | 75 | 1 |
| 5 | FFG et clubs | 3 | 5 | 3 | 45 | 1, puis 3 (écoles) |
| 6 | Presse jeux et tech (FR) | 3 | 5 | 3 | 45 | 2 |
| 7 | Product Hunt | 2 | 5 | 4 | 40 | 2 |
| 8 | Créateurs (go, échecs, manga ; YouTube, TikTok, Reels) | 4 | 3 | 3 | 36 | 2 |
| 9 | Contenu court maison (« le go en 30 s », Go du jour en vidéo) | 4 | 4 | 2 | 32 | 2, puis continu |
| 10 | SEO (pages en place, articles) | 4 | 5 | 1 | 20 | Démarre en 0, paie après 90 j |
| 11 | Publicité payante (tests seulement) | 2 | 2 | 5 | 20 | 3, sous conditions |
| 12 | ASO (stores, via Capacitor) | 5 | 2 | 1 | 10 | 3 ou après 90 j |
| 13 | Écoles et enseignants | 3 | 4 | 1 | 12 | Préparé en 3, rentrée de janvier |

### 2.4 Fiche par canal

Temps de Florian : mon estimation. Indicateurs : événements existants (`docs/data/plan-de-marquage.md`). « Humain » = filtre robots du tableau « Lancement ». Les seuils de succès sont les miens. Ils servent à décider de continuer ou d'arrêter.

#### A. Communautés de go (r/baduk, forums OGS, lifein19x19, Discords de go)

- **Action** : lire les règles de chaque lieu, écrire aux modérateurs si l'autopromotion est encadrée, puis faire **un seul post** au nom de Florian. Répondre à tout sous 24 h et noter chaque critique dans une issue. Revenir 3 semaines plus tard avec un bilan : « voici ce qu'on a corrigé grâce à vous ».
- **Message (EN)** : « I'm a solo dev and I built a free, no-ads Go app for complete beginners: lessons you play from the first screen, a daily problem, and KataGo running on your device. French first, full English too. What would you change? »
- **Angle qui intéresse ce public** : KataGo sur l'appareil, revue honnête, import SGF, accessibilité clavier et lecteur d'écran. Ne pas vendre l'app comme « pour vous » : leur demander de **la recommander à des débutants**.
- **Coût** : 0 €. **Temps** : 4 h (post, puis réponses sur 3 jours).
- **Indicateur** : `premier_ecran_vu` humain avec `utm_source=reddit|ogs|l19|discord`, puis `premiere_pierre`, retours écrits.
- **Seuil de succès** : 300 visites humaines, 20 retours, au moins 1 club ou prof qui demande à l'utiliser.

#### B. Communautés d'échecs (r/chess, r/chessbeginners, r/AnarchyChess non ; Discords d'échecs FR et EN)

- **Action** : pas d'annonce. Une **question sincère**, là où les règles l'autorisent : « Chess players who tried Go: what made it click, or not? » Le lien vient seulement en réponse, si on le demande. Sur les Discords FR qui ont un salon « autres jeux », un message court avec le Go du jour.
- **Message (FR)** : « Tu joues aux échecs ? Le go se joue avec des règles plus simples et une partie plus longue. Mochi Go t'apprend en 5 minutes, gratuitement, sans pub. Le défi du jour : [lien /j/N] »
- **Prérequis produit** : une page « Le go pour les joueurs d'échecs » (SEO, voir F) et « Je sais déjà jouer » pour ceux qui connaissent le go (#283).
- **Coût** : 0 €. **Temps** : 3 h.
- **Indicateur** : visites humaines `utm_source=reddit_chess|discord_echecs`, taux de première partie terminée, J1.
- **Seuil** : 500 visites humaines, première partie terminée chez 30 % des visiteurs humains.

#### C. Hacker News (Show HN), puis Product Hunt

- **Action** : un « Show HN » un mardi ou mercredi matin, heure de New York, centré sur la technique, qui est ce qui intéresse ce public : « Show HN: Learn Go (the board game) in the browser, with KataGo running locally via TensorFlow.js ». Lien vers `/en`. Florian reste 6 h pour répondre. Product Hunt en phase 2, une fois les premiers retours intégrés.
- **Atouts** : IA sur l'appareil, aucun coût serveur, PWA, accessibilité, open source réutilisé (web-katrain, MIT). Le citer, c'est aussi une règle de la licence et de l'honnêteté.
- **Coût** : 0 €. **Temps** : 2 h de préparation et 6 h le jour J.
- **Indicateur** : visites humaines `utm_source=hn|producthunt`, `premiere_pierre`, retours techniques (bugs Sentry).
- **Seuil** : 1 000 visites humaines si le post atteint la page d'accueil ; sinon, ne pas reposter (règle de HN).

#### D. FFG et clubs

- **Action** : courriel à la FFG (présentation, bêta, proposition d'outil d'initiation gratuit pour les animations), puis 20 clubs, en commençant par ceux qui initient des jeunes ou font du périscolaire. Leur donner un kit : affiche A4 avec un QR code vers `/?utm_source=club&utm_campaign=<ville>`, un texte de 3 lignes pour leur lettre, et le Go du jour à projeter. Proposer à 2 ou 3 joueurs dan de relire les contenus, avec crédit dans l'app s'ils le souhaitent.
- **Message** : « Vous initiez des débutants ? Voici un outil gratuit et sans pub qu'ils peuvent continuer chez eux, avec 35 leçons et une IA qui tourne sur leur téléphone. Dites-nous ce qui manque pour vos séances. »
- **Coût** : environ 20 € d'impressions (affiches pour les clubs qui le demandent). **Temps** : 8 h.
- **Indicateur** : `utm_source=club|ffg`, retours, clubs qui l'utilisent en séance.
- **Seuil** : 5 clubs qui testent, 50 joueurs, 30 retours écrits.

#### E. Presse jeux et tech (FR)

- **Action** : un dossier de presse d'une page (ce qui existe, captures v3, Mochi, fondateur seul, IA sur l'appareil, gratuit sans pub) et 15 envois personnalisés : sites de jeux de société, rubriques tech et apps des quotidiens, blogs d'apps, médias culture japonaise. Angle : « un Français crée l'app pour apprendre le jeu qui a fait tomber l'humain face à l'IA ».
- **Coût** : 0 €. **Temps** : 6 h.
- **Indicateur** : articles publiés, `utm_source=presse_<media>` (lien dédié par média), référents.
- **Seuil** : 2 articles, 500 visites humaines.

#### F. SEO

- **Existant** : 4 pages (fr et en) et sitemap (#472). **Action** : Search Console (P2), puis un article de fond toutes les 2 semaines, sur les requêtes qu'on peut gagner :
  1. « go ou échecs : quelles différences ? » (persona 1)
  2. « *Hikaru no Go* : apprendre à jouer comme Hikaru » (persona 3)
  3. « le go pour les enfants » (persona 4)
  4. « atari, ko, komi : le vocabulaire du go » (glossaire déjà dans l'aide, #362)
  5. « comment compter les points au go »
  6. « problème de go du jour » (page qui change chaque jour, avec un lien vers `/j/N`)
- **Coût** : 0 €. **Temps** : 3 h par article (relecture du texte de l'agent contenu).
- **Indicateur** : impressions, clics et position dans la Search Console ; `premier_ecran_vu` avec `utm_campaign=seo`.
- **Seuil à 90 jours** : les 4 pages indexées, 1 000 impressions par semaine, `/apprendre-le-go` dans le top 20 sur « apprendre le go ». Le top 10 visé par `page-presentation.md` est plutôt à 6 mois.

#### G. Contenu court (TikTok, Reels, Shorts)

- **Format** : 30 à 45 s, vertical, captures de l'app et voix ou sous-titres. Fin systématique : « Le défi d'aujourd'hui est en lien. »
  - Série « Le go en 30 secondes » : la capture, l'atari, les deux yeux, le ko, le komi, compter.
  - « Le Go du jour » : la position, 5 s de suspense, jamais la réponse.
  - « Joueur d'échecs vs go » : ce qui surprend un joueur d'échecs.
- **Rythme** : 2 vidéos par semaine en phase 2, puis 3 si un format dépasse le seuil.
- **Coût** : 0 € (captures de l'app, montage avec un outil gratuit). **Temps** : 1 h 30 par vidéo.
- **Indicateur** : vues, taux de vision complète, clics vers le lien en bio (`utm_source=tiktok|reels|shorts`).
- **Seuil** : après 8 vidéos, un format à plus de 5 000 vues ou 50 visites humaines. Sinon, on arrête ce format et on garde les autres.

#### H. Créateurs (go, échecs, manga)

- **Action** : 10 créateurs contactés en phase 2 : chaînes de go anglophones, créateurs d'échecs francophones de taille moyenne, créateurs manga ou anime. Proposition : une vidéo « j'apprends le go en 10 minutes avec Mochi Go », sans script imposé, avec une mention claire de partenariat si c'est payé (obligation légale).
- **Coût** : 0 € (échange : accès, crédit, lien) à 150 € (un petit créateur payé, test unique). **Temps** : 5 h.
- **Indicateur** : `utm_source=createur_<nom>`, première partie terminée, J1.
- **Seuil** : pour une vidéo payée, coût par première pierre humaine inférieur à 1 €. Sinon, on ne renouvelle pas.

#### I. Parrainage et boucles dans l'app

- **Existant** : Go du jour partageable, défi par lien, partage de l'app aux moments forts (#521), image du moment clé (#364).
- **Action marketing** : publier le Go du jour chaque jour (Bluesky, Mastodon, X, Instagram), lien seul. Proposer aux Discords et aux clubs un fil « Go du jour » où chacun colle son résultat.
- **Coût** : 0 €. **Temps** : 10 min par jour, programmable.
- **Indicateurs** (déjà définis) : taux de partage du Go du jour = `go_du_jour_partage` / `go_du_jour_resolu` ; coefficient du défi = `defi_ouvert` (hors `deja_joueur`) / `defi_cree` ; `app_partagee` par joueur actif et par semaine.
- **Seuil** : partage du Go du jour à 10 % et 1 arrivée pour 2 partages (cibles du plan #112).

#### J. Publicité payante (tests seulement, phase 3)

- **Condition d'entrée** (mon seuil) : sur les visiteurs humains des phases 1 et 2, au moins 40 % posent une pierre et au moins 20 % terminent une partie. Sinon, la publicité achète des départs.
- **Repères de prix** : les coûts par installation des jeux mobiles se situent autour de 2 à 3 $ pour le puzzle et 4 à 5,5 $ pour la stratégie (marchés occidentaux, sources d'agences) [63][64]. Sur Meta, le coût par installation des jeux en France est inférieur de 66 % à la moyenne mondiale d'octobre 2024 à octobre 2025 (Meta seulement) [65]. Pour une PWA, on paie un clic, pas une installation : on mesure le **coût par première pierre humaine**.
- **Test** : 2 tests de 75 € chacun (Meta, ciblage « échecs » et « jeux de société », France ; Reddit, r/chess et r/boardgames si possible), avec 3 vidéos de la phase 2 comme créations.
- **Seuils d'arrêt** (les miens) : on coupe à 25 € dépensés si le coût par première pierre humaine dépasse 2 €. On garde si, à 75 €, il est sous 1 € et que J1 n'est pas plus bas que celui des canaux gratuits.
- **Temps** : 3 h.

#### K. ASO (stores), après Capacitor

- **Existant** : fiches FR et EN prêtes (v3), captures (#501). **Manque** : Capacitor, compte Apple (99 € par an, reporté), compte Google Play.
- **Action, si prêt en phase 3** : Google Play d'abord (moins cher et plus rapide), puis l'App Store. Mots-clés déjà dans `fiches-stores.md`. Demander une note dans l'app seulement après un moment fort (victoire, leçon finie), jamais au premier lancement.
- **Indicateur** : installations par jour, conversion de la page du store, note moyenne (charte : 4,7).
- **Seuil** : 50 notes à 4,5 ou plus dans le mois qui suit la sortie.

#### L. Écoles et enseignants (préparation)

- **Action** : en phase 3, avec 2 ou 3 clubs qui interviennent en périscolaire et l'IREM de Strasbourg, préparer une fiche enseignant d'une page (règles simplifiées, 3 séances, l'app en complément à la maison). Ne rien vendre : recueillir les besoins pour un éventuel B2B.
- **Coût** : 0 €. **Temps** : 4 h.
- **Indicateur** : enseignants qui testent en janvier, retours.
- **Seuil** : 3 classes en test à la rentrée de janvier.

### 2.5 Plan en 3 phases

| Phase | Dates | But | Canaux | Coût (mon estimation) | Objectif de sortie (mon choix) |
|---|---|---|---|---|---|
| **0. Prérequis** | 13 au 18/10 | Rendre le trafic sûr et mesurable | P1 à P5, test 5 débutants | 0 € | Clés changées, Search Console vérifiée, UTM lus, entonnoir vérifié |
| **1. Prescripteurs** | 19/10 au 15/11 (semaines 1 à 4) | Premiers vrais joueurs et retours | A, B, C (HN), D, I | 20 € | 1 500 visites humaines cumulées, 100 retours, 5 clubs |
| **2. Contenu et relais** | 16/11 au 13/12 (semaines 5 à 8) | Un rythme de publication et des relais | E, F, G, H, Product Hunt, I | 150 € (un créateur) | 300 nouveaux humains par semaine, un format vidéo qui marche |
| **3. Amplifier ce qui marche** | 14/12 au 17/01 (semaines 9 à 13) | Mettre de l'argent et du temps là où c'est rentable | J (si condition), K (si Capacitor), L | 150 € de tests, plus 99 € pour Apple et les frais Google si stores | 500 nouveaux humains par semaine, coefficient de partage mesuré, J7 lisible |

Total hors stores : environ 320 € sur 90 jours (mon estimation). Temps de Florian : 8 à 10 h par semaine, plus 6 h le jour du Show HN.

Les vacances de fin d'année tombent en phase 3 : c'est un bon moment pour le Go du jour et pour les cadeaux (« un jeu de 2 500 ans, gratuit »). C'est un mauvais moment pour la presse et les écoles.

### 2.6 Les 4 premières semaines, semaine par semaine

#### Semaine 0 (13 au 18/10) : prérequis

| Jour | Action | Qui | Temps |
|---|---|---|---|
| Mar-mer | P1 (clés), P2 (Search Console, Bing, sitemap), P3 (aperçus) | Florian | 1 h |
| Mer-jeu | P5 : UTM dans PostHog, tableau « Lancement », filtre robots | Agent données | — |
| Jeu-sam | P4 : 5 débutants observés ; corriger ce qui bloque avant la semaine 1 | Florian, puis agents produit | 1 h 30, puis correctifs |
| Sam | Préparer les textes A, B, C, D (FR et EN) et le kit club (affiche QR) | Florian, agent marketing | 2 h |

**Point d'arrêt** : si moins de 3 des 5 débutants posent une pierre sans aide, on corrige avant d'ouvrir la semaine 1.

#### Semaine 1 (19 au 25/10) : FFG, clubs, go francophone

| Action | Temps | Indicateur | Seuil de la semaine |
|---|---|---|---|
| Courriel à la FFG, 20 clubs, demande de relecture à 2 ou 3 joueurs dan | 6 h | Réponses, `utm_source=club|ffg` | 8 réponses, 3 clubs partants |
| Post sur le forum ou le Discord francophone de go, si les règles le permettent | 1 h | `utm_source=discord` | 50 visites humaines |
| Go du jour publié chaque jour sur 2 réseaux | 1 h | `arrivee_par_partage` | Premières arrivées mesurées |
| Lundi : lecture des chiffres (tableau « Lancement ») | 30 min | — | — |

#### Semaine 2 (26/10 au 01/11) : r/baduk et go anglophone

| Action | Temps | Indicateur | Seuil |
|---|---|---|---|
| Post r/baduk (après accord des modérateurs si besoin), forum OGS, lifein19x19 | 4 h | `utm_source=reddit|ogs|l19` | 300 visites humaines, 20 retours |
| Issues GitHub pour chaque critique récurrente ; correctifs rapides | — | Issues ouvertes et fermées | 5 correctifs annoncés |
| Go du jour quotidien | 1 h | Taux de partage | — |

#### Semaine 3 (02 au 08/11) : joueurs d'échecs et Hacker News

| Action | Temps | Indicateur | Seuil |
|---|---|---|---|
| Question sincère sur r/chess ou r/chessbeginners ; 3 Discords d'échecs FR | 3 h | `utm_source=reddit_chess|discord_echecs` | 500 visites humaines |
| Show HN (mardi ou mercredi) | 8 h | `utm_source=hn` | 1 000 visites humaines si page d'accueil |
| Article SEO n° 1 « Go ou échecs ? » publié | 3 h | Indexation | Page indexée |

#### Semaine 4 (09 au 15/11) : bilan et boucle

| Action | Temps | Indicateur | Seuil |
|---|---|---|---|
| Message de bilan sur r/baduk et aux clubs : « voici ce qu'on a corrigé grâce à vous » | 2 h | Retours, nouvelles visites | — |
| Lecture des cohortes par canal : quel canal donne la meilleure première partie terminée et le meilleur J1 ? | 2 h | Tableau « Lancement » | Classement des canaux |
| Préparer la phase 2 : dossier de presse, 10 créateurs, 4 premières vidéos | 4 h | — | — |
| **Décision de fin de phase 1** : on garde les 2 meilleurs canaux, on coupe les autres | 30 min | — | 1 500 visites humaines cumulées |

### 2.7 Ce qu'il faut dans l'app pour que l'acquisition marche

Liste courte, reliée à l'existant. Les priorités produit restent celles de la feuille de route ; ici, je dis seulement ce dont l'acquisition dépend.

1. **Première minute sans fuite** (#466, #487, #523, #524) : le test des 5 débutants (P4) doit confirmer que le premier écran mène à une pierre. C'est la condition de tout le reste.
2. **Rappel quotidien activé** (#36, #351, prêt) : sans lui, chaque joueur acquis repart. Cible : J7 à 25 %.
3. **Lien qui recrute** (#285, #489) : la personne qui arrive par un partage voit le Go du jour, puis « Apprends à jouer en 2 minutes ». À mesurer par canal (`arrivee_par_partage`, `nouveau_joueur`).
4. **Le mur du compte au bon moment** (#343) : 3 parties d'essai, puis un compte. Suivre `essai_limite_atteinte` → `compte_cree` par canal. Si la conversion est sous 30 % (mon seuil), tester 5 parties ou le compte après la première victoire.
5. **Une raison de partager au moment fort** : #521 invite à partager après une victoire ou une leçon. Piste (non décidée, à voir avec le game design) : un gel de série offert aux deux joueurs quand un ami invité termine sa première partie, dans l'économie existante (#233).
6. **Une porte pour chaque persona** : « Je sais déjà jouer » (#283) pour les anciens joueurs et les joueurs de club ; import SGF (#286) pour OGS et Fox ; page « go pour joueurs d'échecs » pour le persona 1.
7. **Demande de note sur les stores** seulement après un moment fort, quand Capacitor arrive (charte : 4,7).

### 2.8 Mesure : un tableau, lu chaque lundi

| Indicateur | Calcul (événements existants) | Cible à J90 (mon choix) | Cible de la charte à 6 mois |
|---|---|---|---|
| Nouveaux humains par semaine | `premier_ecran_vu` (nouveau, filtre robots), ou étape `premier_geste` (#519) | 500 | 10 000 |
| Première pierre | `premiere_pierre` / `premier_geste` | 60 % (objectif de `mesure-lancement`) | 90 % dans la minute |
| Première partie terminée | `premiere_partie_terminee` / `premiere_pierre` | 50 % | — |
| Partage du Go du jour | `go_du_jour_partage` / `go_du_jour_resolu` | 10 % | — |
| Coefficient du défi | `defi_ouvert` (hors `deja_joueur`) / `defi_cree` | 0,5 | — |
| J1 / J7 | Cohortes `mesure = complet`, avec la taille de la cohorte | Lisible (au moins 100 consentants) | 45 % / 25 % |
| Coût par première pierre humaine (payant) | Dépense / `premiere_pierre` du canal | Moins de 1 € | — |

Limite connue : sans accord, il n'y a pas de rétention individuelle. Il faut lire J1 et J7 comme une tendance sur les consentants (`docs/data/mesure-lancement-2026-10.md`).

---

## 3. Sources

Les pages ont été consultées par recherche web le 13/10/2026. L'ouverture directe était bloquée : il faut vérifier chaque chiffre sur la page avant tout usage public.

1. IGF, *2016 Go population report* : https://intergofed.org/wp-content/uploads/2025/01/2016_Go_population_report.pdf
2. Wikipedia, *List of Go players* (recensement japonais de 2002) : https://en.wikipedia.org/wiki/List_of_Go_players
3. Yahoo! News Japon, 古作登, 将棋人口は460万人で下げ止まり。囲碁人口は120万人に微減 (Livre blanc des loisirs 2024) : https://news.yahoo.co.jp/expert/articles/0d28359a902f6bedb272bb3bc086f0c914456889
4. Lecture du Livre blanc des loisirs 2024 et 2025 (X, @kanzouya) : https://x.com/kanzouya/status/1858119569170456950 et https://x.com/kanzouya/status/1992886900135530545
5. Wikipedia FR, *Fédération française de go* : https://fr.wikipedia.org/wiki/F%C3%A9d%C3%A9ration_fran%C3%A7aise_de_go
6. FFG, liste des clubs : https://ffg.jeudego.org/php/listeClubs.php ; présentation : https://ffg.jeudego.org/informations/officiel/presentation.php
7. NamuWiki, *Baduk/status by country* (sondages Gallup Korea) : https://en.namu.wiki/w/%EB%B0%94%EB%91%91/%EA%B5%AD%EA%B0%80%EB%B3%84%20%ED%98%84%ED%99%A9
8. China Daily, 29/09/2019 : https://www.chinadaily.com.cn/a/201909/29/WS5d900ad9a310cf3e3556e18d.html
9. The Jakarta Post, *In China, Go players rise to the challenge* (2019) : https://newgelora.thejakartapost.com/life/2019/05/07/in-china-go-players-rise-to-the-challenge
10. EGF, *About* : https://www.eurogofed.org/about/index.htm ; Wikipedia : https://en.wikipedia.org/wiki/European_Go_Federation
11. European Go Database : https://europeangodatabase.eu/EGD/
12. chess.com, rapports du conseil (T4 2025) : https://www.chess.com/article/view/reports
13. Wikipedia, *Chess.com* : https://en.wikipedia.org/wiki/Chess.com
14. StartupHub, *How Chess.com bootstrapped to $200M revenue and 250M users* (2026) : https://www.startuphub.ai/ai-news/startup-news/2026/how-chess-com-bootstrapped-to-200m-revenue-and-250m-users
15. INSEE, *Licences sportives par fédération agréée, 2024* : https://www.insee.fr/fr/statistiques/2408252
16. CIDJ, *En classe ou sur Internet, la passion pour les échecs ne se dément pas* : https://www.cidj.com/actualite/en-classe-ou-sur-internet-la-passion-pour-les-echecs-ne-se-dement-pas
17. Duolingo, formulaire 10-Q du T2 2026 (SEC) : https://www.sec.gov/Archives/edgar/data/0001562088/000162828026053603/duol-20260630.htm
18. Pulse 2.0, *Duolingo daily active users reach 58.7 million* (T2 2026) : https://pulse2.com/duolingo-daily-active-users-reach-58-7-million-as-retention-hits-record-84-and-social-accounts-top-1-billion-organic-impressions/
19. Duolingo, communiqué Duocon 2025 : https://www.nasdaq.com/press-release/duolingo-unveils-major-product-updates-turn-learning-real-world-power-duocon-2025
20. Fast Company, *How Duolingo vibe-coded its way to a hit chess game* : https://www.fastcompany.com/91429115/exclusive-how-duolingo-vibe-coded-its-way-to-a-hit-chess-game
21. App Store, *BadukPop Go* : https://apps.apple.com/us/app/badukpop-go/id1472684271 ; Google Play : https://play.google.com/store/apps/details?id=com.coreplane.badukpop.prod&hl=en_US
22. Avis et prix de BadukPop (App Store, SplitMetrics) : https://apps.apple.com/us/app/badukpop-go/id1472684271 ; https://splitmetrics.com/apps/badukpop-go/id1472684271
23. App Store, *SmartGo One* : https://apps.apple.com/app/smartgo-one/id1465746992
24. AppFollow, *Go Quest* : https://apps.appfollow.io/ios/goquest/834841918?country=ch
25. AI Sensei, tarifs et FAQ : https://ai-sensei.com/pricing ; https://ai-sensei.com/faq
26. GoMagic, *Top-7 Online Go Servers* : https://gomagic.org/play-go-online/
27. Life in 19x19, *Fox Go Server* : https://lifein19x19.com/viewtopic.php?p=259042
28. Wikipedia, *Tygem* : https://en.wikipedia.org/wiki/Tygem
29. RAWG, *Ancient Go* (chiffres OGS non datés) : https://rawg.io/games/ancient-go
30. SA Go Clubs, *SA Internet Go* (OGS, Site Supporter) : https://sagoclubs.co.za/sa-internet-go
31. Wikipedia, *KGS Go Server* : https://en.wikipedia.org/wiki/KGS_Go_Server
32. American Go E-Journal, KGS et AGF : https://www.usgo-archive.org/news/?p=211663
33. App Store, *PVGo* : https://apps.apple.com/us/app/pvgo-%EC%9B%A8%EC%9D%B4-%EC%B9%98-%EC%9D%B4%EB%8F%99-%EB%B0%94%EB%91%91-%ED%95%99%EC%8A%B5/id1475583944?l=fr-FR
34. GoMagic, *Les bases du go en 13 × 13* : https://gomagic.org/fr/courses/the-fundamentals-of-go-on-13x13/
35. Kaya (GitHub) : https://github.com/kaya-go/kaya
36. itch.io, *Go Game Online with KataNet AI* : https://pazoff.itch.io/go
37. Google, *AlphaGo's ultimate challenge* : https://blog.google/technology/ai/alphagos-ultimate-challenge/ ; autres estimations d'audience relevées dans les résultats de recherche, non auditées
38. AI Futures, *Was AlphaGo Asia's "Sputnik Moment"?* : https://www.aifutures.org/20190924
39. Wikipedia, *Hikaru no Go* : https://en.wikipedia.org/wiki/Hikaru_no_Go
40. Newsweek, *Going crazy for go* : https://www.newsweek.com/going-crazy-go-147073
41. Web Japan, *Nipponia* n° 22 : https://web-japan.org/nipponia/nipponia22/en/trend/index.html
42. Otaku USA, pièce *Hikaru no Go* (2024) : https://otakuusamagazine.com/?p=317173
43. Journal du Geek, *Le marché du manga est en baisse en France* (24/04/2025) : https://www.journaldugeek.com/2025/04/24/le-marche-du-manga-est-en-baisse-en-france-et-ce-nest-pas-bon-signe/
44. Livres Hebdo, *Japan Expo 2026 : plus de 222 000 visiteurs pour son 25e anniversaire* : https://www.livreshebdo.fr/article/japan-expo-2026-plus-de-222-000-visiteurs-pour-son-25e-anniversaire
45. Journal du Geek, *Voici le jeu de société le plus populaire de France* (2025) : https://www.journaldugeek.com/2025/04/24/voici-le-jeu-de-societe-le-plus-populaire-de-france/
46. CB News, *Les jeux de société : tendances et chiffres* : https://www.cbnews.fr/node/99112
47. Gulf Times (AFP), *Queen's Gambit accepted: hit show sparks chess frenzy* : https://www.gulf-times.com/story/678933/queens-gambit-accepted-hit-show-sparks-chess-frenzy
48. Sportico, *The Queen's Gambit and chess popularity* : https://www.sportico.com/business/media/2020/queens-gambit-chess-popularity-beth-harmon-chess-com-1234617271/
49. Towards Data Science, *How has The Queen's Gambit impacted the popularity of online chess?* : https://towardsdatascience.com/how-has-the-queens-gambit-impacted-the-popularity-of-online-chess-43594efe5a98
50. Wiki de r/baduk, chaînes YouTube (miroir) : https://lr.eu.psf.lt/r/baduk/wiki/youtube_channels
51. American Go E-Journal (NYIG, Dwyrin) : https://www.usgo-archive.org/news/?p=210577
52. chess.com, aide, *What does each level of membership get me* : https://support.chess.com/en/articles/8562418-what-does-each-level-of-membership-get-me
53. Stork, fiche chess.com (prix non officiels) : https://www.stork.ai/tools/chess-com
54. Wikipedia, *Lichess* : https://en.wikipedia.org/wiki/Lichess
55. Forum Lichess, *How many people in the world actually use lichess* : https://lichess.org/forum/off-topic-discussion/how-many-people-in-the-world-actually-use-lichess?page=3
56. Clubic, *Jeux vidéo : 37 millions de joueurs en France, et une moyenne d'âge de 40 ans* : https://www.clubic.com/mag/jeux-video/actualite-874076-jeu-video-37-joueurs-france-moyenne-age-40-ans.html
57. The Hive Index, *r/Chess* : https://thehiveindex.com/communities/r-chess/
58. DEPP, *Prévisions d'effectifs d'élèves du premier degré* : https://www.education.gouv.fr/depp/previsions-d-effectifs-d-eleves-du-premier-degre-452436
59. DEPP, *RERS 2025, chapitre 9 (les personnels)* : https://www.education.gouv.fr/sites/default/files/2025-07/rers2025-chapitre-9-441738.pdf
60. IREM de Strasbourg, go à l'école primaire (COPIRELEM) : https://bibnum.publimath.fr/IWO/IWO24023.pdf
61. FFG, *Pourquoi le jeu de go à l'école* : https://ffg.jeudego.org/informations/goscolaire/documents/Pourquoi%20le%20jeu%20de%20Go%20a%20l'ecole.pdf
62. GummySearch, *r/baduk* (service fermé fin novembre 2025, chiffre figé) : https://gummysearch.com/r/baduk/
63. Mapendo, *Mobile Games CPI Rates 2025* : https://mapendo.co/blog/mobile-games-cpi-2025
64. FoxData, *Coûts d'acquisition jeux mobiles 2026* : https://foxdata.com/fr/blogs/2026-mobile-game-user-acquisition-cost-benchmarks-how-much-should-you-spend/
65. Superads, *Facebook Ads cost per app install, gaming, France* : https://www.superads.ai/facebook-ads-costs/cost-per-app-install/gaming/france

Sources internes : `entreprise/charte.md`, `docs/marketing/plan-lancement.md`, `docs/marketing/fiches-stores.md`, `docs/marketing/page-presentation.md`, `docs/produit/feuille-de-route-2026-10.md`, `docs/produit/veille-2026-09-27.md`, `docs/data/mesure-lancement-2026-10.md`, `docs/data/plan-de-marquage.md`, `docs/growth/search-console.md`, `docs/growth/rappel-quotidien.md`, `docs/journal.md`.
