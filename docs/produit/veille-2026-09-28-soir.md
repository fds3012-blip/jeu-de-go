# Veille du 28 septembre 2026 (soir) : où on en est après 24 h de livraisons

Agent : produit. Suite de `docs/produit/veille-2026-09-27.md`.

**Question** : est-ce qu'un débutant comprend chaque écran en 3 secondes, et est-ce qu'un joueur de club y trouve la profondeur qu'il attend ?

**Livré depuis la veille du 27** (PR fusionnées le 28/09, voir `docs/journal.md`) :
- Vie et mort prouvée : outil de preuve (`src/go/preuve-vie-mort.ts`, yeux de Benson), lots Q et R (#271, #280).
- **171 problèmes** en production, tous prouvés (lots O à R).
- Leçons et problèmes en anglais, avec `?lang=en` (#269, #273, #278, #281).
- « Rejoue cette erreur » depuis la revue, révision espacée jusqu'à la maîtrise, bon coup caché tant que l'erreur n'est pas rejouée (#275, #277).
- Go du jour commun, numéroté, partageable sans spoiler, lien ancien qui ouvre le bon défi (#274).
- Partie guidée : Mochi ajuste sa force pour garder la partie serrée (#279).
- Confirmation avant de quitter une partie, nom accessible du bouton suivant, focus sous le verdict (#270).
- Accessibilité 320 px et police doublée (#252, #255, #256), 0 cible sous 44 px sur 37 moments du parcours.
- Économie de progression : carte, simulation sur 30 jours, révision récompensée (#239, #261).
- Une fête à la fois, un appel à la fois (#243, #254).

**Nouveautés récentes des concurrents** (recherche du 28/09) :
- chess.com : le problème du jour passe à **5 vies** au lieu d'un seul essai, se renouvelle à l'heure locale et reçoit un nouveau format de partage. Source : [chess.com, State of Chess.com, septembre 2026](https://www.chess.com/article/view/chesscom-update-september-2026), [Daily Puzzle Lives](https://www.chess.com/news/view/announcing-daily-puzzle-lives-system).
- BadukPop 1.44 (14/09/2026) : lien du compte mobile vers la version web par QR code, plus de limite de temps sur les problèmes du niveau 1, explications détaillées dans les nouvelles leçons. Source : [AppBrain, BadukPop](https://www.appbrain.com/app/go-game-badukpop/com.coreplane.badukpop.prod), [App Store](https://apps.apple.com/us/app/badukpop-go/id1472684271).
- OGS : refonte annoncée de la page de partie et des revues IA ; GoTV (flux de parties commentées en direct). Source : [forum OGS, Game page and AI reviews](https://forums.online-go.com/t/upcoming-interface-changes-to-the-game-page-and-ai-reviews/60811), [forum OGS, GoTV](https://forums.online-go.com/t/introducing-gotv/52130).
- KaTrain : versions 1.19 et 1.20 (août 2026), toujours un outil de bureau pour joueurs de club. Source : [GitHub, releases KaTrain](https://github.com/sanderland/katrain/releases), [PyPI](https://pypi.org/project/KaTrain/).

---

## 1. Tableau fonction par fonction

Légende, pour chaque concurrent : **+** nous sommes en avance, **=** à parité, **−** nous sommes en retard, *n/a* le concurrent ne fait pas cette fonction et n'y prétend pas.

### Accueil du débutant

| Fonction | Chez nous | chess.com | BadukPop | OGS | KaTrain |
|---|---|---|---|---|---|
| Première pierre sans compte | Oui, 4 taps, consentement encore sur le chemin | = | = | + | + |
| Leçons jouables sur le plateau | 8 leçons « je montre / on fait / tu fais », dès le 1er écran | = | = (explications ajoutées en 1.44) | + | + |
| Première partie gagnable | Komi 0,5, Pomme passe quand tu passes, partie guidée | = | = | + | + |
| Comprendre le score | Récit « Toi / Pomme », frontières, défaite au komi expliquée | n/a | + | + | + |
| Choisir son niveau à l'arrivée | **Non** : tout le monde commence contre Pomme | − | − (niveau choisi) | − (rang déclaré) | − (bots en rang) |
| Anglais | Leçons et problèmes, interface avec `?lang=en` seulement | − | − | − | − |

### Boucle quotidienne et rétention

| Fonction | Chez nous | chess.com | BadukPop | OGS | KaTrain |
|---|---|---|---|---|---|
| Problème du jour commun | Go du jour numéroté, même défi pour tous | = | + (le sien varie selon le niveau) | + | n/a |
| Partage sans spoiler | Texte façon Wordle, lien sans compte, **sans aperçu riche** | − (nouveau partage, aperçu image) | + | + | n/a |
| Série protégée | Tolérance, gels gagnés, record, un défi par jour | = | + | + | n/a |
| Révision espacée | Révision du jour, erreurs qui reviennent | + | + | + | + |
| Rappel hors de l'app | **Aucun** (ni notification ni e-mail) | − | − | − (e-mail de correspondance) | n/a |
| Difficulté des problèmes qui suit le joueur | **Non** : « Continuer » suit l'ordre des paliers, la cote n'est pas utilisée | − (cote de puzzles) | − (niveau choisi) | n/a | n/a |
| Format court rejouable (course) | **Aucun** | − (Puzzle Rush, Battle) | = | n/a | n/a |
| XP, niveaux, une fête à la fois | Oui, simulée sur 30 jours | = | = | + | + |

### Profondeur (joueur de club)

| Fonction | Chez nous | chess.com | BadukPop | OGS | KaTrain |
|---|---|---|---|---|---|
| IA forte sur l'appareil, hors ligne | KataGo dans le navigateur, gratuit | n/a | + | + | = (bureau seulement) |
| Revue avec note par coup et moment clé | Oui (#71, #186) | = | + | + | − (KaTrain plus fin) |
| Rejouer ses erreurs | Oui, espacé jusqu'à la maîtrise | = | + | + | + |
| Partie guidée (force ajustée) | Oui (#279) | + | + | + | = (annulation auto) |
| Problèmes prouvés | 171, preuve automatique par test | n/a | − (5 000 relus) | = | n/a |
| Rang ou cote visible | **Non** | − | − | − | − |
| Import SGF et analyse d'une partie externe | **Non** (le moteur SGF existe) | n/a | = | − | − |
| 13 × 13 et 19 × 19 contre l'IA | Oui | n/a | = | = | = |

### Social et acquisition

| Fonction | Chez nous | chess.com | BadukPop | OGS | KaTrain |
|---|---|---|---|---|---|
| Jouer contre un humain | Serveur prêt (`game-action`), **aucun écran** | − | − | − | n/a |
| Défier un ami par lien | **Non** (#81) | − | − | − | n/a |
| Classement entre amis | Non | − | − | − | n/a |
| Page qui recrute (aperçu de lien, SEO) | **Aucune balise d'aperçu** dans `index.html` | − | − | − | n/a |
| Accessibilité (clavier, lecteur d'écran, 320 px, zoom 200 %) | Goban au clavier, 0 cible < 44 px | + | + | + | + |

**Lecture**
- Nous sommes à parité ou en avance sur tout ce qui se passe **dans** l'app pour un débutant : leçons, première victoire, score, série, révision, revue. Les livraisons du 28 ont fermé les écarts 2, 3, 4 et 5 de la veille du 27.
- Nous sommes en retard sur tout ce qui fait **revenir** ou **arriver** un joueur : aucun rappel, aucun humain, un partage sans image, aucune page qui se montre bien.
- Le joueur de club trouve une IA solide mais ne sait pas **où il se situe** (ni rang, ni niveau de départ) et ne peut pas apporter ses parties.

---

## 2. Les 5 écarts qui comptent le plus

Classés par effet attendu sur les indicateurs de la charte (J1 45 %, J7 25 %, J30 12 %, 10 000 nouveaux joueurs par semaine).

### 1. Rien ne fait revenir un joueur qui n'ouvre pas l'app (J7, J30)
- **Constat** : ni notification, ni e-mail. La série protégée et le Go du jour ne servent qu'à ceux qui pensent à revenir.
- **Chez les autres** : chess.com et Duolingo rappellent chaque jour ; OGS envoie un e-mail à chaque coup de correspondance.
- **Preuves publiques** : choisir le texte des rappels par bandit a donné +2 % de rétention des nouveaux joueurs chez Duolingo ([Yancey et Settles, KDD 2020](https://research.duolingo.com/papers/yancey.kdd20.pdf)). Un rappel calé sur un moment de la journée forme mieux l'habitude qu'un rappel seul ([Stawarz et al., CHI 2015](https://dl.acm.org/doi/10.1145/2702123.2702230)). Sur iPhone, la notification web exige l'app installée et une demande après un geste ([WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)).
- **Issue** : #36 (existe, à remonter en tête).

### 2. Aucun humain à qui jouer ni à défier (acquisition, J30)
- **Constat** : le serveur de parties en ligne est prêt (`src/go/server.ts`, fonction `game-action`), mais aucun écran ne l'ouvre. Pas de lien de défi.
- **Chez les autres** : OGS et Fox vivent de leurs parties entre humains ; BadukPop et chess.com (Daily) proposent la correspondance entre amis.
- **Pourquoi c'est l'écart d'acquisition** : chaque défi envoyé est une invitation ; c'est la seule boucle virale après le partage du Go du jour.
- **Issue** : #81 (existe), avec #10.

### 3. Le joueur de club ne sait pas où il se situe (J1 du second cercle)
- **Constat** : tout le monde commence contre Pomme et aux problèmes « Facile ». Aucun rang ni cote visible. Un joueur de 10 kyu qui arrive d'OGS doit traverser le programme du débutant.
- **Chez les autres** : chess.com demande le niveau à l'inscription ; OGS et BadukPop font choisir un rang ou un niveau ; KaTrain affiche ses bots en kyu. Source : [aide chess.com, Ratings](https://support.chess.com/en/collections/13178555-ratings-stats), [BadukPop](https://badukpop.com/).
- **Issue** : #283, placement en 3 problèmes et niveau en kyu estimé.

### 4. Les problèmes ne suivent pas le niveau (J7)
- **Constat** : 171 problèmes, mais « Continuer » avance dans l'ordre des paliers. La cote de chaque problème existe (`difficulte`), elle ne sert qu'à afficher « Facile / Moyen / Difficile ».
- **Chez les autres** : chess.com donne une cote de puzzles au joueur et choisit à sa mesure ; Tsumego Pro a un mode progression. Un apprentissage par essais est le plus rapide autour de 85 % de réussite ([Wilson et al., Nature Communications 2019](https://www.nature.com/articles/s41467-019-12552-4)). Trop de niveaux durs d'affilée fait baisser la rétention ([Game Developer](https://www.gamedeveloper.com/design/rethinking-progression-in-mobile-puzzle-games)).
- **Issue** : #284, « Continuer » à ta mesure.

### 5. Le partage ne recrute pas encore (acquisition)
- **Constat** : le texte du Go du jour est bon, mais `index.html` n'a aucune balise Open Graph. Dans WhatsApp, Messages ou Discord, le lien s'affiche nu, sans image ni titre. Le lien partagé ouvre ensuite l'app entière, pas un écran d'arrivée.
- **Chez les autres** : chess.com vient de refaire le partage de son problème du jour ([State of Chess.com, septembre 2026](https://www.chess.com/article/view/chesscom-update-september-2026)). La grille de Wordle a porté sa croissance de quelques centaines de milliers à des millions de joueurs début 2022 ([TechCrunch](https://techcrunch.com/2022/01/12/josh-wardle-interview-wordle/)).
- **Issue** : #285, aperçu riche du lien et arrivée sur le défi.

**Écarts suivants** (hors top 5) : import SGF pour le joueur de club (#286), course aux problèmes de 3 minutes (#287), interface anglaise sans `?lang=en` (#167), coach en phrases simples (#80), classement entre amis (après #81).

---

## 3. Issues créées ce soir

| Issue | Sujet | Écart |
|---|---|---|
| #283 | Je sais déjà jouer : placement en 3 problèmes et niveau en kyu | 3 |
| #284 | « Continuer » à ta mesure : cote du joueur, cible 85 % | 4 |
| #285 | Aperçu riche du lien partagé et arrivée sur le Go du jour | 5 |
| #286 | Importer une partie (SGF) et l'analyser avec KataGo | Club, acquisition depuis OGS et Fox |
| #287 | Course aux problèmes : 3 minutes, 3 erreurs, partageable | J7, format court |

Pas de nouvelle issue pour les écarts 1 et 2 : #36 et #81 existent et sont précises. Elles montent dans la feuille de route.

## Sources

- chess.com : [State of Chess.com, septembre 2026](https://www.chess.com/article/view/chesscom-update-september-2026), [Daily Puzzle Lives](https://www.chess.com/news/view/announcing-daily-puzzle-lives-system), [Puzzle Rush](https://www.chess.com/puzzles/rush), [Ratings & Stats](https://support.chess.com/en/collections/13178555-ratings-stats)
- BadukPop : [site](https://badukpop.com/), [App Store](https://apps.apple.com/us/app/badukpop-go/id1472684271), [AppBrain, version 1.44](https://www.appbrain.com/app/go-game-badukpop/com.coreplane.badukpop.prod)
- OGS : [annonces](https://forums.online-go.com/c/announcements/ogs-announcements/12), [page de partie et revues IA](https://forums.online-go.com/t/upcoming-interface-changes-to-the-game-page-and-ai-reviews/60811), [GoTV](https://forums.online-go.com/t/introducing-gotv/52130)
- KaTrain : [releases](https://github.com/sanderland/katrain/releases), [PyPI](https://pypi.org/project/KaTrain/)
- Recherche : [Yancey et Settles 2020](https://research.duolingo.com/papers/yancey.kdd20.pdf), [Stawarz et al. 2015](https://dl.acm.org/doi/10.1145/2702123.2702230), [WebKit Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [Wilson et al. 2019](https://www.nature.com/articles/s41467-019-12552-4), [TechCrunch, Wordle](https://techcrunch.com/2022/01/12/josh-wardle-interview-wordle/)

Les chiffres des concurrents viennent des éditeurs ou d'analyses publiques : ce sont des ordres de grandeur, pas des prévisions pour nous.
