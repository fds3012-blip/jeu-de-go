# Fiches App Store et Google Play (#112)

Textes prêts à coller dans App Store Connect et la Play Console, en français puis en anglais. L'app sortira sur les stores avec Capacitor ; ces fiches décrivent uniquement ce qui existe déjà dans la PWA (voir `docs/journal.md`).

## Limites de caractères (vérifiées le 27/09/2026)

| Champ | App Store | Google Play |
|---|---|---|
| Nom / titre | 30 | 30 |
| Sous-titre | 30 | (n'existe pas) |
| Texte promotionnel | 170 (modifiable sans mise à jour) | (n'existe pas) |
| Description courte | (n'existe pas) | 80 |
| Description longue | 4 000 | 4 000 |
| Mots-clés | 100, séparés par des virgules, sans espace | (pas de champ : Google lit le titre et les descriptions) |
| Nouveautés | 4 000 | 500 |

Sources : [AppStyle, limites 2026](https://www.appstyle.dev/blog/app-store-character-limits/), [AppLaunchFlow, référence 2026](https://www.applaunchflow.com/blog/app-store-metadata-character-limits-2026), [Aide Play Console](https://support.google.com/googleplay/android-developer/answer/13393723?hl=en).

Chaque texte ci-dessous indique son nombre de caractères (espaces compris).

## Règles d'écriture

- Tutoiement, phrases courtes, chaleureux (charte, CLAUDE.md règle 5).
- Aucune promesse que l'app ne tient pas. Pas de « n° 1 », « meilleure app », « le plus fort ». Aucun nom de concurrent, ni dans les textes ni dans les mots-clés (Apple le refuse aussi).
- Ce que l'on peut dire, parce que c'est livré : leçons animées avec Mochi, 74 problèmes vérifiés en paliers, 9 adversaires illustrés, revue avec une note pour chaque coup, « Qui mène ? », Go du jour à partager, série protégée, KataGo sur l'appareil, gratuit, sans publicité.
- Ce que l'on ne dit pas encore : parties en ligne classées, Premium, coach Claude, plateau 19 × 19 contre toute l'échelle, « toujours gratuit ».
- « Hors ligne » : vrai une fois le réseau de KataGo téléchargé et mis en cache. On écrit donc « même hors ligne, une fois l'IA téléchargée » dans la description longue, et jamais « sans connexion » tout court.

---

# Français

## Nom et sous-titre

| Champ | Texte | Car. |
|---|---|---|
| Nom (Apple et Google) | Go : apprendre et jouer | 23 |
| Sous-titre (Apple) | Le jeu de go, pas à pas | 23 |
| Texte promotionnel (Apple) | Nouveau : le Go du jour. Un problème pour tout le monde, chaque jour. Résous-le et partage ton score sans dévoiler la réponse. | 126 |

Variante de sous-titre à tester plus tard (Apple permet des tests de fiche) : « Règles, leçons et IA gratuite » (29).

## Catégorie

- App Store : **Jeux**, sous-catégories **Stratégie** (principale) et **Société** (secondaire).
- Google Play : **Jeux > Société** (le go y est rangé avec les échecs). Balises : Stratégie, Réflexion, Jeu de plateau, Un joueur, Hors ligne.
- Classification d'âge : 4+ (Apple), PEGI 3 (Google). Aucun achat intégré à déclarer en 1.0.

## Description courte (Google Play)

> Apprends le go en jouant : leçons animées, problèmes et une IA forte, gratuit.

(78 caractères)

## Mots-clés (App Store)

```
baduk,weiqi,igo,goban,échecs,stratégie,plateau,réflexion,tsumego,règles,apprendre,katago,IA,problème
```

(100 caractères, la limite exacte.) On ne répète pas « go », « jeu » ni « jouer », déjà indexés par le nom et le sous-titre. « apprendre » est aussi dans le nom : à remplacer par « tutoriel » si un test montre qu'il ne rapporte rien. Pas de pluriel en double : Apple rapproche singulier et pluriel.

## Description longue

```
Le go se joue depuis plus de 2 500 ans. Les règles tiennent en une minute. Ici, tu les découvres en jouant.

APPRENDS AVEC MOCHI
Des leçons animées, courtes, sur le plateau. Mochi te montre une idée, puis c'est à toi de poser la pierre. Chaque mot du go (atari, ko, komi) est expliqué la première fois qu'il apparaît.

74 PROBLÈMES, DU DÉBUTANT AU CONFIRMÉ
Capturer, sauver, relier, faire deux yeux. Les problèmes sont rangés par paliers. Chaque solution a été vérifiée contre toutes les défenses : si ta réponse est bonne, elle marche vraiment.

LE GO DU JOUR
Un même problème pour tout le monde, chaque jour. Résous-le, garde ta série, et partage ton résultat avec tes amis sans dévoiler la réponse. Un jour manqué ? Ta série peut être protégée.

9 ADVERSAIRES, UN PAS APRÈS L'AUTRE
De Pomme, qui débute comme toi, jusqu'à Sensei. Chaque adversaire a son caractère et son style. Bats-le, et le suivant t'attend.

UNE IA FORTE, SUR TON TÉLÉPHONE
Les adversaires les plus forts sont joués par KataGo, une IA de go open source. Elle tourne sur ton appareil, même hors ligne une fois l'IA téléchargée.

COMPRENDS CHAQUE PARTIE
À la fin, revois ta partie coup par coup. Chaque coup reçoit une note, de « Brillant » à « Grosse erreur », avec une phrase de Mochi pour comprendre. Tes grosses erreurs deviennent des problèmes à rejouer. En pleine partie, « Qui mène ? » te montre les territoires.

PENSÉ POUR TOI
- Gratuit et sans publicité.
- Aide de Mochi en partie : il te prévient quand un de tes groupes est en atari.
- Mode sombre et mode clair, grandes cibles tactiles, mouvements réduits respectés.
- Tu peux jouer sans créer de compte.

Tu joues aux échecs ou aux jeux de société ? Le go va te plaire. Pose ta première pierre.
```

(1 729 caractères, loin des 4 000.)

## Les 6 captures d'écran

Format : iPhone 6,9 pouces (1320 × 2868) et Android 1080 × 1920, mode sombre Encre pour les captures 1 à 5, mode clair Papier pour la 6 (montrer les deux). L'accroche se place en haut, en Fraunces, sur le fond encre ; 5 mots au plus.

| # | Écran à montrer | Accroche | Mots |
|---|---|---|---|
| 1 | Accueil : Mochi, le bouton en relief « Joue ta première partie contre Pomme », plateau 9 × 9 | Apprends le go en jouant | 5 |
| 2 | Leçon animée : Mochi explique l'atari, pierre fantôme jade sur le plateau | Une idée, deux minutes | 4 |
| 3 | Échelle des 9 adversaires illustrés, de Pomme à Sensei, Pomme et Caillou marqués ✓ | Neuf adversaires, ton rythme | 4 |
| 4 | Revue de partie : sceaux de notes sur les pierres, courbe d'avantage, phrase de Mochi | Chaque coup expliqué | 3 |
| 5 | Go du jour résolu, avec la série et le bouton « Partager » | Un défi par jour | 4 |
| 6 | Partie contre Tigre (KataGo) en mode Papier, carte « Qui mène ? » affichée | Une IA forte, sans publicité | 5 |

Vidéo d'aperçu (facultative, 15 à 30 s) : première pierre posée, capture avec glissement vers le couvercle, sceau « Brillant » en revue, partage du Go du jour. Pas de texte parlé, sous-titres courts.

## Nouveautés de la version 1.0

Apple (champ « Nouveautés ») et Google (500 caractères max) :

```
Bienvenue ! Voici la première version :
- des leçons animées avec Mochi ;
- 74 problèmes, du débutant au confirmé ;
- le Go du jour à partager, avec ta série ;
- 9 adversaires, de Pomme à Sensei ;
- la revue de partie, avec une note pour chaque coup.
Gratuit, sans publicité. Bonne première pierre !
```

(299 caractères.)

---

# English

Same rules: warm, direct ("you"), no false claims, no competitor names.

## Name and subtitle

| Field | Text | Chars |
|---|---|---|
| Name (Apple and Google) | Go: Learn and Play | 18 |
| Subtitle (Apple) | The game of Go, step by step | 28 |
| Promotional text (Apple) | New: Daily Go. One puzzle for everyone, every day. Solve it and share your score without spoiling the answer. | 109 |

"Go" alone is hard to find in English search. Alternative name to test: "Go: Learn Baduk and Weiqi" (25).

## Category

- App Store: **Games**, subcategories **Strategy** (primary) and **Board** (secondary).
- Google Play: **Games > Board**. Tags: Strategy, Puzzle, Board game, Single player, Offline.
- Age rating: 4+ (Apple), PEGI 3 / Everyone (Google).

## Short description (Google Play)

> Learn Go by playing: animated lessons, puzzles and a strong AI. Free, no ads.

(77 characters)

## Keywords (App Store)

```
baduk,weiqi,igo,board game,chess,strategy,tsumego,puzzle,rules,beginner,katago,AI,learn,tutorial
```

(96 characters.)

## Full description

```
Go has been played for over 2,500 years. The rules take a minute. Here, you learn them by playing.

LEARN WITH MOCHI
Short animated lessons, right on the board. Mochi shows you an idea, then it's your turn to place the stone. Every Go word (atari, ko, komi) is explained the first time it shows up.

74 PUZZLES, FROM BEGINNER TO CONFIDENT
Capture, escape, connect, make two eyes. Puzzles are sorted into levels. Every solution has been checked against every defense: if your answer is right, it really works.

DAILY GO
One puzzle for everyone, every day. Solve it, keep your streak, and share your result with friends without spoiling the answer. Missed a day? Your streak can be protected.

9 OPPONENTS, ONE STEP AT A TIME
From Pomme, a beginner like you, all the way to Sensei. Each opponent has a personality and a style. Beat one, and the next is waiting.

A STRONG AI, ON YOUR PHONE
The strongest opponents are played by KataGo, an open-source Go AI. It runs on your device, even offline once the AI is downloaded.

UNDERSTAND EVERY GAME
After the game, replay it move by move. Every move gets a rating, from "Brilliant" to "Blunder", with a line from Mochi to explain it. Your big mistakes become puzzles you can replay. Mid-game, "Who's ahead?" shows you the territories.

MADE FOR YOU
- Free, with no ads.
- Mochi's in-game help: he warns you when one of your groups is in atari.
- Dark and light modes, large touch targets, reduced motion respected.
- Play without creating an account.

Do you play chess or board games? You'll love Go. Place your first stone.
```

Note : l'interface anglaise doit exister avant de publier cette fiche. Tant que l'app n'est qu'en français, la fiche anglaise doit le dire (« Interface in French for now ») ou attendre.

## The 6 screenshots

| # | Screen | Caption | Words |
|---|---|---|---|
| 1 | Home: Mochi, raised button "Play your first game vs Pomme", 9 × 9 board | Learn Go by playing | 4 |
| 2 | Animated lesson: Mochi explains atari, jade ghost stone | One idea, two minutes | 4 |
| 3 | Ladder of 9 illustrated opponents, Pomme and Caillou checked | Nine opponents, your pace | 4 |
| 4 | Game review: rating seals on stones, advantage graph, Mochi's line | Every move explained | 3 |
| 5 | Daily Go solved, streak and "Share" button | One challenge a day | 4 |
| 6 | Game vs Tigre (KataGo), light mode, "Who's ahead?" map | Strong AI, no ads | 4 |

## What's New in version 1.0

```
Welcome! Here's our first version:
- animated lessons with Mochi;
- 74 puzzles, from beginner to confident;
- Daily Go to share, with your streak;
- 9 opponents, from Pomme to Sensei;
- game review, with a rating for every move.
Free, no ads. Enjoy your first stone!
```

(266 characters.)

---

## Mesure

| Action | Coût | Indicateur visé | Mesure |
|---|---|---|---|
| Fiches FR puis EN | 0 € (temps interne) | Taux de conversion de la fiche (vues → installations) : viser 30 % sur l'App Store | App Store Connect > Analytics ; Play Console > Acquisition de la fiche |
| Test du sous-titre (A/B) | 0 € | + 10 % de conversion relative | « Product Page Optimization » (Apple), « Tests de fiche » (Google), 2 semaines par test |
| Captures 1 et 5 en tête | 0 € | Part des installations qui posent une première pierre dans la minute : 90 % (charte) | PostHog, événement `premiere_pierre` (propriété secondes) |
| Réponses aux avis | 0 € | Note moyenne 4,7 (charte) | Console des deux stores, chaque semaine |
