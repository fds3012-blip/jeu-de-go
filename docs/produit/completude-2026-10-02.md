# Complétude de l'app : inventaire et écarts, 2 octobre 2026

Agent : produit. Mission de Florian : une app « complète », où un joueur grand public ne se sent jamais bloqué. Sources : `docs/journal.md`, issues fermées et ouvertes du dépôt, `src/app`, `src/ui`, `src/data`, `supabase/migrations`, veilles des 27, 28 et 29 septembre.

**Question** : est-ce qu'un débutant comprend chaque écran en 3 secondes, et est-ce qu'un joueur de club y trouve la profondeur qu'il attend ?

## 1. Ce que l'app a aujourd'hui (main du 1er octobre)

Par rubrique, selon le découpage de chess.com (Play, Puzzles, Learn, Social, Profile, Settings).

**Jouer**
- Contre l'ordi : 9 adversaires (Pomme et Caillou, moteur simple ; Bambou à Sensei, KataGo dans l'appareil), 9 × 9, 13 × 13 et 19 × 19, équilibrage pour les premières parties (komi 0,5), partie guidée contre Mochi (#79), indices limités, alerte d'atari, « Conseil » (#80, Pomme et Caillou), « Qui mène ? » (#94), passe au bon moment (#120, #235), frontières ouvertes montrées (#174), pierres mortes marquées seules (#117), score raconté (#78), bilan et adversaire suivant (#22), confirmation avant de quitter (#268).
- À deux sur le même appareil.
- Défi par lien en différé (#81, #327, #338) : création, arrivée, partie, comptage à deux, liste « Tes parties » ; compte obligatoire avant le premier coup (#343).
- Revue de la **dernière** partie (#34, #71, #186, #192) : moment clé, notes par coup, « Rejouer d'ici », « Rejoue cette erreur » (#77). Import SGF depuis OGS, Fox et KGS (#286).
- Serveur : validation des coups et fin aux points (#9), parties classées contraintes (#29), tables `games`, `friendships`, `match_queue` et `rating_history` depuis la première migration, **sans écran** pour les amis ni la file d'attente.

**Problèmes**
- 214 problèmes prouvés, Go du jour commun et partageable (#75), « Continuer » à ta mesure (#284, cible 85 %), aide graduée indice → réfutation → réponse (#197), révision du jour (#199), course de 3 minutes (#287), placement « Je sais déjà jouer » (#283). Aucun total ni cote affiché (décision #137).

**Apprendre**
- 12 leçons « je montre, on fait ensemble, tu fais seul » (#101, #193, #231, #341), chemin sur goban (#54), leçon puis pratique (#220), anglais (#167).

**Social**
- Partage du Go du jour et du score de la course, aperçu Open Graph (#285). Défi par lien. Rien d'autre : pas d'amis, pas de profil public, pas de message, pas de classement.

**Profil**
- « Ton parcours » : niveau et XP, série et record, leçons, adversaires battus, problèmes réussis, badges (#214) ; niveau en kyu du placement, une fois ; compte (pseudo, connexion par code à 6 chiffres, Google ; supprimer mon compte, #114) ; importer une partie ; installer l'app ; rappel quotidien (prêt, désactivé, #351) ; conditions.

**Réglages**
- Langue, thème clair/sombre/auto, thème de goban (par niveau), confirmation au doigt, sons, vibrations, célébrations, aide de Mochi. La taille du plateau se choisit dans « Changer » sur l'accueil.

**Socle**
- PWA installable, hors ligne fiable (#340), 320 px et zoom 200 %, clavier et lecteur d'écran (#116, en partie), FR et EN, PostHog anonyme, Sentry sur accord.

## 2. Tableau fonction par fonction

Colonnes : **Nous**, chess.com, BadukPop, OGS (Lichess cité quand il fait mieux). Légende : ✓ présent, ◐ partiel, ✗ absent, n/a le concurrent ne fait pas cette fonction. **Gravité** du manque pour J1 (premier jour) et J7 (première semaine) : B bloquant (le joueur est coincé), F fort, M moyen, f faible, – aucun manque. **Effort** de 1 (une journée d'agent) à 5 (plusieurs semaines, serveur compris).

### Jouer

| Fonction | Nous | chess.com | BadukPop | OGS | Gravité J1 / J7 | Effort | Issue |
|---|---|---|---|---|---|---|---|
| Jouer contre l'ordi, plusieurs niveaux | ✓ 9 adversaires, IA sur l'appareil | ✓ bots | ✓ | ✓ (faible) | – | – | fait |
| 13 × 13 et 19 × 19 contre l'ordi | ✓ dans « Changer » | n/a | ✓ | ✓ | – | – | fait |
| Handicap (ordi et à deux) | ✗ (moteur prêt, aucun écran) | n/a | ✓ | ✓ | f / F | 2 | #361 |
| Partie à deux sur un appareil | ✓ | ✓ | ✗ | ✗ | – | – | fait |
| Défier un ami par lien (différé) | ✓ (#81) | ✓ | ✗ | ✓ | – | – | fait, à finir |
| Recherche d'adversaire en direct, pendule, classé | ✗ (table `match_queue` sans écran) | ✓ premier bouton | ✓ | ✓ | M / F | 5 | #360 (précise #10) |
| Reprendre une partie interrompue contre l'ordi | ◐ (XP gardée, pas la position) | ✓ | ✓ | ✓ | M / M | 2 | #15 (ouverte) |
| Historique de mes parties avec revue | ✗ (dernière partie seulement) | ✓ | ✓ | ✓ | F / B | 3 | #358 |
| Revue d'une partie en ligne | ✗ | ✓ | n/a | ✓ | – / F | 1 (dans #358) | #358 |
| Revue avec moments clés et « Rejouer d'ici » | ✓ | ✓ | ✗ | ◐ | – | – | fait |
| Import SGF et analyse | ✓ | n/a | ✗ | ✓ | – | – | fait |
| Étudier une position libre avec l'IA | ✗ | ✓ (Analysis) | ✗ | ✓ (éditeur) | – / M (club) | 3 | #372 |
| Comptage chinois en option | ◐ (serveur et import) | n/a | ✗ | ✓ | f / f | 1 (dans #360) | #360 |
| Partager une partie (lien, SGF, image) | ✗ | ✓ image | ✗ | ✓ lien, SGF | f / F | 3 | #364 |

### Problèmes

| Fonction | Nous | chess.com | BadukPop | OGS | Gravité | Effort | Issue |
|---|---|---|---|---|---|---|---|
| Problème du jour commun, partageable | ✓ | ✓ | ✗ | ✗ | – | – | fait |
| Difficulté qui suit le joueur | ✓ (cote cachée) | ✓ | ✓ | n/a | – | – | fait |
| Aide graduée et explication de l'erreur | ✓ | ✓ | ◐ | n/a | – | – | fait |
| Format court (course) | ✓ | ✓ Puzzle Rush | ✓ | n/a | – | – | fait |
| Problèmes par thème | ✗ | ✓ | ✓ | n/a | – / M | 2 | #370 |
| Révision espacée | ✓ | ✗ | ✗ | n/a | – | – | avance |
| Signaler un problème faux | ✗ | ✓ | ✗ | n/a | f / f | 1 (dans #363) | #363 |

### Apprendre

| Fonction | Nous | chess.com | BadukPop | OGS | Gravité | Effort | Issue |
|---|---|---|---|---|---|---|---|
| Leçons interactives dès l'étape 1 | ✓ 12 leçons | ✓ | ✓ | ✗ | – | – | fait |
| Onboarding des règles (jouer avant d'apprendre) | ✓ partie guidée, Mochi, leçon 1 en 2 taps | ✓ | ✓ | ✗ | – | – | fait |
| Règles en une page, glossaire, FAQ consultables | ✗ | ✓ Help | ✓ fiche | ◐ wiki | **B** / F | 2 | #362 |
| Programme jusqu'au dan | ◐ (12 leçons, débutant) | ✓ | ◐ | ✗ | – / M | 5 | #16 (ouverte) |
| Coach pendant la partie | ◐ (Pomme et Caillou) | ✓ | ✗ | ✗ | – / M | 2 | #80, #307 |

### Social

| Fonction | Nous | chess.com | BadukPop | OGS | Gravité | Effort | Issue |
|---|---|---|---|---|---|---|---|
| Liste d'amis, profil d'un ami, défi depuis son profil | ✗ (table `friendships` sans écran) | ✓ | ◐ | ✓ | – / F | 4 | #359 |
| Notifications dans l'app (« C'est ton tour », demandes) | ✗ | ✓ | ◐ | ✓ | – / F | 3 | #367 |
| Rappel quotidien poussé | ◐ prêt, désactivé | ✓ | ✓ | ✗ | – / F | 1 (activer) | #36, #351 |
| Classement entre amis, bilan de la semaine | ✗ | ✓ | ✓ | ✗ | – / M | 3 | #369 |
| Classement mondial, ligues, tournois | ✗ (décision : pas pour l'instant) | ✓ | ✓ | ✓ | – | – | non prévu |
| Messages à l'adversaire | ✗ | ✓ chat | ✗ | ✓ chat | – / M | 3 | #373 |
| Signaler un joueur | ✗ | ✓ | ✗ | ✓ | – / F (stores) | 2 | #363 |
| Clubs, parties commentées | ✗ | ✓ | ✗ | ✓ | – | – | non prévu |

### Profil et compte

| Fonction | Nous | chess.com | BadukPop | OGS | Gravité | Effort | Issue |
|---|---|---|---|---|---|---|---|
| Compte, pseudo, connexion e-mail et Google | ✓ | ✓ | ✓ | ✓ | – | – | fait, #354 |
| Progression (niveau, XP, badges, série, record) | ✓ | ✓ | ✓ | ◐ | – | – | fait |
| Niveau estimé qui évolue, statistiques | ◐ (kyu du placement, figé) | ✓ courbe | ✓ | ✓ rang | – / F (club) | 3 | #368 |
| Supprimer mon compte | ✓ | ✓ | ✓ | ✓ | – | – | fait |
| Télécharger mes données | ✗ | ✓ | ✗ | ◐ | f / f (stores, RGPD) | 2 | #371 |
| Nous écrire | ✗ | ✓ | ✓ | ✓ | f / M (stores) | 1 (dans #363) | #363 |
| Installer l'app, rappel | ✓ | ✓ | ✓ | ✗ | – | – | fait |

### Réglages et socle

| Fonction | Nous | chess.com | BadukPop | OGS | Gravité | Effort | Issue |
|---|---|---|---|---|---|---|---|
| Sons, vibrations, célébrations | ✓ | ✓ | ✓ | ✓ | – | – | fait |
| Thème clair / sombre, thèmes de goban | ✓ | ✓ | ✓ | ✓ | – | – | fait |
| Taille du plateau | ✓ (accueil) | n/a | ✓ | ✓ | – | – | fait |
| Confirmer au doigt | ✓ | ✓ | ✓ | ✓ | – | – | fait |
| Langue | ✓ FR, EN | ✓ | ✓ | ✓ | – | – | fait |
| Coordonnées, dernier coup, numéros des coups | ✗ | ✓ | ◐ | ✓ | f / M (club) | 2 | #365 |
| Masquer la série | ✗ | ✓ | ✗ | n/a | – / f | 1 (dans #365) | #365 |
| Réglages suivis par le compte | ✗ (appareil seulement) | ✓ | ✓ | ✓ | – / f | 1 (dans #365) | #365 |
| Mode hors ligne clair (état, ce qui marche, IA prête) | ◐ (cache fiable, notices éparses) | ◐ | ✓ | ✗ | M / M | 2 | #366 |
| Accessibilité clavier et lecteur d'écran | ◐ | ◐ | ✗ | ✗ | – | – | #116 (ouverte) |
| App dans les stores | ✗ (PWA) | ✓ | ✓ | ✓ | – / M | 4 | après test utilisateur |

**Lecture.** Dans l'app, le débutant est bien servi : jouer, apprendre, problèmes, revue sont à parité ou en avance (IA sur l'appareil, révision espacée, Go du jour commun). Les trous sont de trois sortes :
1. **Ce qui bloque un débutant à J1** : pas d'aide consultable (« pourquoi la partie est finie ? »), pas d'historique (« où est ma partie d'hier ? »), un hors ligne qu'on devine.
2. **Ce qui fait partir le joueur à J7** : aucun humain à retrouver (amis, direct, notifications), pas de trace de sa progression de jeu, rien à partager hors du Go du jour.
3. **Ce que les stores exigeront** : nous écrire, signaler, télécharger ses données.

## 3. Ordre de livraison en 3 vagues

Le critère : d'abord ce qui coince un joueur seul (J1), puis ce qui le relie aux autres (J7), puis la profondeur du club et les exigences des stores.

### Vague 1, « jamais bloqué seul » (environ 2 semaines d'agents)

| Issue | Fonction | Gravité | Effort |
|---|---|---|---|
| #358 | Historique de mes parties, revue depuis le Profil et depuis un défi | F / B | 3 |
| #362 | Aide : règles en une page, « Comment on compte ? », glossaire, FAQ | B / F | 2 |
| #366 | Hors ligne clair, IA prête ou à télécharger | M / M | 2 |
| #36, #351 | Activer le rappel quotidien (décision de Florian) | – / F | 1 |
| #15 | Reprendre une partie interrompue contre l'ordi | M / M | 2 |

### Vague 2, « jamais seul » (environ 4 semaines)

| Issue | Fonction | Gravité | Effort |
|---|---|---|---|
| #367 | Notifications dans l'app, pastille « C'est ton tour » | – / F | 3 |
| #359 | Amis, profil d'un ami, défi depuis son profil | – / F | 4 |
| #363 | Nous écrire et signaler (bug, problème faux, joueur) : avant le direct | f / F | 2 |
| #360 | Jouer en direct : recherche d'adversaire, pendule, classé | M / F | 5 |
| #361 | Handicap | f / F | 2 |
| #364 | Partager une partie | f / F | 3 |
| #365 | Réglages du plateau, série masquable, réglages suivis par le compte | f / M | 2 |
| #368 | Niveau estimé qui évolue, statistiques | – / F | 3 |

### Vague 3, « profondeur et stores » (novembre)

| Issue | Fonction | Gravité | Effort |
|---|---|---|---|
| #369 | Classement entre amis du Go du jour, bilan de la semaine | – / M | 3 |
| #370 | Problèmes par thème | – / M | 2 |
| #372 | Étudier une position avec KataGo | – / M | 3 |
| #373 | Messages prédéfinis et émotes dans une partie | – / M | 3 |
| #371 | Télécharger mes données | f / f | 2 |
| #16 | Programme jusqu'au dan (suite des leçons) | – / M | 5 |
| — | Capacitor et stores, après le test utilisateur | – / M | 4 |

**Dépendances** : #363 (signalement) avant #360 (direct) et #373 (messages) ; #359 (amis) avant #369 (classement entre amis) ; #358 (historique) avant #364 (partage) ; #367 (notifications) réutilise les fonctions serveur de #81 et prépare le rappel « C'est ton tour ».

## 4. Ce qu'on ne fait pas, et pourquoi

- Classement mondial, ligues, tournois, clubs, parties commentées : trop tôt pour notre base de joueurs, et contraire à la décision « aucune cote affichée » (#137). Réévalué quand les parties en direct auront un mois de données.
- Chat libre : remplacé par des messages prédéfinis (#373), qui évitent la modération et sont traduits d'avance.
- Cœurs, vies, énergie : jamais (base UX, monétisation éthique).

## 5. Issues ouvertes avant cet inventaire (vérifiées pour éviter les doublons)

#354, #325, #324, #323, #285, #283, #223, #167, #116, #111, #103, #81, #80, #79, #77, #75, #40, #36, #34, #16, #15, #13, #10, #8. Aucune ne couvrait les 16 fonctions ci-dessus ; #10 (« Jouer : contre l'IA et en ligne ») est précisée par #360, #36 (rappel poussé) est distincte de #367 (notifications dans l'app), #81 (défi par lien) est distincte de #359 (amis).

## 6. Issues créées le 2 octobre

#358 historique des parties · #359 amis · #360 jouer en direct · #361 handicap · #362 aide et glossaire · #363 nous écrire et signaler · #364 partager une partie · #365 réglages du plateau · #366 hors ligne clair · #367 notifications dans l'app · #368 niveau estimé et statistiques · #369 classement entre amis · #370 problèmes par thème · #371 télécharger mes données · #372 étudier une position · #373 messages à l'adversaire.

Chaque issue suit le format du dépôt : agents, contexte, parcours, à faire, terminé quand, indicateurs. Labels : ceux des agents existants (`frontend`, `backend`, `moteur-go`, `pedagogie`, `growth`, `designer`, `juridique`, `contenu`), `priorité-haute` sur #358 et #362.

## Sources

- chess.com : [Game Review](https://www.chess.com/terms/game-review), [aide Streaks](https://support.chess.com/en/articles/9714718-what-are-streaks), [Daily Puzzle](https://support.chess.com/en/articles/8708990-how-do-i-find-the-daily-puzzle).
- Lichess : [Learn from your mistakes](https://lichess.org/@/lichess/blog/learn-from-your-mistakes/WFvLpiQA), [Puzzle Streak](https://lichess.org/streak), [Analysis board](https://lichess.org/analysis).
- BadukPop : [App Store](https://apps.apple.com/us/app/badukpop-go/id1472684271), [site](https://badukpop.com/).
- OGS : [forum, scoring](https://forums.online-go.com/t/stone-removal-and-scoring-updates/52055), [documentation](https://github.com/online-go/online-go.com).
- Nos données : `docs/journal.md`, `docs/ux/base-de-connaissances.md`, veilles des 27, 28 et 29 septembre, `docs/qa/recette-2026-09-30.md`.

Les informations sur les concurrents viennent de leurs pages publiques et de nos veilles précédentes ; elles donnent le niveau attendu, pas une prévision pour nous.
