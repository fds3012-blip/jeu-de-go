# Fiches App Store et Google Play (v3, #473 ; v2 : #208)

Textes prêts à coller dans App Store Connect et la Play Console, en français puis en anglais. Version 3, mise à jour le 08/10/2026 avec la version anglaise complète (#473) ; version 2 du 28/09/2026 (#208), v1 : #112. L'app sortira sur les stores avec Capacitor ; ces fiches décrivent uniquement ce qui existe dans la PWA de `main` à cette date.

## Ce qui a changé depuis la v1

| v1 (27/09) | v2 (28/09) | Preuve dans le dépôt |
|---|---|---|
| « Des leçons animées » | 7 leçons où tu poses ta pierre dès le premier écran | `content/lessons.fr.js` (l1 à l7), #177, #198, `e2e/apprendre.spec.ts` |
| « 74 problèmes vérifiés en paliers » | Plus de 100 problèmes prouvés, sans fin visible | 117 dans `ALL_PUZZLES` (`src/content/puzzles.ts` et `src/content/lots/`), un test de preuve par lot, #147, `e2e/problemes-sans-fin.spec.ts` |
| « Chaque coup reçoit une note » | La revue s'ouvre sur le moment clé, dit combien de points il a coûté et propose de rejouer ce coup ; pas de faux compliment | #186, `e2e/revue.spec.ts` |
| (rien) | Première victoire possible : komi de 0,5 annoncé pour les 3 premières parties | #160, `src/app/equilibrage.ts`, `e2e/premiere-victoire.spec.ts` |
| « Grandes cibles, mouvements réduits » | Plus : partie jouable au clavier avec annonces pour lecteur d'écran, zoom 200 % | #116, #121, `e2e/clavier.spec.ts`, `e2e/zoom.spec.ts` |
| Série protégée pour un compte | Série dès le premier jour, même sans compte, avec gel | #161, `src/app/gelAppareil.ts` |

## Ce qui a changé en v3 (08/10/2026, #473)

Les faits de la v2 étaient dépassés. Chiffres recomptés dans le dépôt le 08/10/2026 :

| v2 (28/09) | v3 (08/10) | Preuve dans le dépôt |
|---|---|---|
| 7 leçons | 35 leçons en 6 chapitres, sur 9 × 9, 13 × 13 et 19 × 19 | `content/lessons.fr.js` (l1 à l36, sans l28), `src/content/lessons.en.test.ts` |
| « Plus de 100 problèmes » | Plus de 200 problèmes prouvés (231), classés par thème | `ALL_PUZZLES` (231, autant que la table `puzzles`), #471 |
| « Tu joues sans créer de compte » | **Faux depuis #343** : sans compte, 3 parties d'essai, les leçons 1 à 3 et le Go du jour ; ensuite un compte gratuit | `creer.raison.parties`, #343 |
| (rien) | Mochi coach en partie, révisions espacées des erreurs, Rush de 3 minutes | #470, #469, `course.*` |
| Parties en ligne « pas encore » | Parties avec tes amis par un lien, 3 jours par coup (le direct existe, non mis en avant) | #81, #359, #440 |
| Fiche anglaise « pas avant l'interface » | Interface, leçons, problèmes, e-mails et rappels en anglais | #473, `src/content/anglais-complet.test.ts` |

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

Chaque texte indique son nombre de caractères (espaces compris), compté par script.

## Règles d'écriture

- Tutoiement, phrases courtes, chaleureux (charte, CLAUDE.md règle 5). Anglais : termes du glossaire `docs/localisation/glossaire.md` (*Puzzles*, *Daily Go*, *streak*, *freeze*, *Game review*, *Who's ahead?*).
- Aucune promesse que l'app ne tient pas. Pas de « n° 1 », « meilleure app », « le plus fort ». Aucun nom de concurrent (Apple le refuse aussi).
- Aucun chiffre inventé. Les seuls chiffres sont comptés dans le dépôt : 35 leçons, plus de 200 problèmes (231 aujourd'hui ; on écrit « plus de 200 » pour ne pas changer la fiche à chaque lot), 9 adversaires, komi de 0,5 pour 3 parties, zoom 200 %. Pas de nombre de joueurs, pas de note, pas d'avis tant qu'ils n'existent pas.
- « Hors ligne » : vrai une fois le réseau de KataGo téléchargé et mis en cache. On écrit « même hors ligne, une fois l'IA téléchargée », jamais « sans connexion » tout court.
- « Gratuit » : vrai aujourd'hui. On n'écrit pas « toujours gratuit » : un Premium est à l'étude (charte).
- Ce que l'on ne dit pas encore : Premium, cote affichée comme argument, « jouer contre des inconnus » en avant (le direct existe, mais dépend du nombre de joueurs en ligne).
- Le compte : ne jamais écrire « sans compte » tout court (#343). On dit ce qui est ouvert sans compte : 3 parties, les leçons 1 à 3, le Go du jour.

---

# Français

## Nom et sous-titre

L'appli s'appelle **Mochi Go** (#416) ; site : https://mochi-go.app. URL de la politique de confidentialité à donner aux stores : https://mochi-go.app/confidentialite.

| Champ | Texte | Car. |
|---|---|---|
| Nom (Apple et Google) | Mochi Go : apprendre le go | 26 |
| Sous-titre (Apple) | Leçons jouables et IA gratuite | 30 |
| Texte promotionnel (Apple) | 35 leçons où tu joues dès le premier écran. Plus de 200 problèmes prouvés. Et Mochi qui t'explique tes coups pendant la partie. | 127 |

Variante de sous-titre à tester (Product Page Optimization) : « Le jeu de go, pas à pas » (23, sous-titre v1).

## Catégorie

- App Store : **Jeux**, sous-catégories **Stratégie** (principale) et **Société** (secondaire).
- Google Play : **Jeux > Société**. Balises : Stratégie, Réflexion, Jeu de plateau, Un joueur, Hors ligne.
- Classification d'âge : 4+ (Apple), PEGI 3 (Google). Aucun achat intégré à déclarer en 1.0.

## Description courte (Google Play)

> Apprends le go en jouant : 35 leçons, 200+ problèmes, une IA forte. Sans pub.

(77 caractères)

## Mots-clés (App Store)

```
baduk,weiqi,igo,goban,échecs,stratégie,plateau,réflexion,tsumego,règles,débutant,katago,IA,problème
```

(99 caractères.) On ne répète ni « go », ni « jeu », ni « apprendre », ni « leçon » : ils sont déjà indexés par le nom et le sous-titre. « débutant » remplace « apprendre » (v1), en double avec le nom. Pas de pluriel en double : Apple rapproche singulier et pluriel.

## Description longue

```
Le go se joue depuis plus de 2 500 ans. Les règles tiennent en une minute. Ici, tu les découvres en jouant.

TU JOUES DÈS LE PREMIER ÉCRAN
35 leçons courtes, avec Mochi, en 6 chapitres : les bases, l'ouverture, capturer et sauver, la vie et la mort, la fin de partie, la forme. Pas de page à lire : tu poses ta pierre et tu vois ce qui se passe. Chaque mot du go (atari, ko, komi) est expliqué la première fois qu'il apparaît.

MOCHI T'ACCOMPAGNE EN PARTIE
Pendant tes premières parties, Mochi te prévient quand ton groupe est en atari ou qu'une prise t'a échappé. Il ne joue jamais à ta place, et tu peux le faire taire.

TA PREMIÈRE VICTOIRE EST POSSIBLE
Ta première partie se joue contre Pomme, qui débute comme toi, sur un petit plateau 9 × 9. Pour tes 3 premières parties, le komi (les points donnés à Blanc, qui joue en second) est de 0,5 au lieu de 6,5.

PLUS DE 200 PROBLÈMES, PAR THÈME
Capturer, sauver, vie et mort, relier et couper, fin de partie, tesuji. Chaque solution est prouvée contre toutes les défenses : si ta réponse est bonne, elle marche vraiment. Tes erreurs reviennent au bon moment, pour que ça reste.

LE GO DU JOUR ET TA SÉRIE
Un même problème pour tout le monde, chaque jour. Partage ton résultat sans dévoiler la réponse. Un jour manqué ? Un gel peut protéger ta série.

9 ADVERSAIRES, ET TES AMIS
De Pomme (20 kyu) à Sensei (1 dan), chacun avec son portrait et son caractère. Défie aussi tes amis par un lien, à ton rythme : 3 jours par coup.

UNE IA FORTE, SUR TON APPAREIL
Les adversaires les plus forts sont joués par KataGo, une IA de go open source. Elle tourne sur ton téléphone, même hors ligne une fois l'IA téléchargée.

UNE REVUE HONNÊTE
À la fin, la revue va droit au moment clé : le coup qui t'a coûté le plus, avec les points perdus. Rejoue-le depuis cette position. Pas de faux compliment.

POUR TOUT LE MONDE
- Gratuit et sans publicité.
- Essaie sans compte : 3 parties, les 3 premières leçons et le Go du jour. Ensuite, un compte gratuit garde ta progression.
- Partie jouable au clavier, annonces pour lecteur d'écran, zoom à 200 %.
- Mode sombre et mode clair, grandes cibles tactiles, mouvements réduits respectés.
- En français et en anglais.

Tu joues aux échecs ou aux jeux de société ? Le go va te plaire. Pose ta première pierre.
```

(2 285 caractères, loin des 4 000.)

## Les 6 captures d'écran

Fichiers : `docs/marketing/stores/captures/fr/*.jpg`, 1290 × 2796 (iPhone 6,7 pouces, accepté par App Store Connect ; Google Play accepte aussi ce format portrait), mode sombre Encre, JPEG qualité 86 (220 à 270 Ko). Chaque capture est l'écran réel de l'app à 390 × 844 (×3), posé sous sa légende sur le fond encre.

Pour les régénérer (après `VITE_E2E=1 npm run build` et un serveur sur `PW_PORT`) :

```
CAPTURES_STORES=1 npx playwright test captures-stores
```

Le script est `e2e/captures-stores.spec.ts`. Il est ignoré en CI sans la variable. Il vérifie chaque écran avant la photo (komi 0,5 annoncé, moment clé ouvert, pas de défilement horizontal).

| # | Fichier | Écran montré | Légende | Mots |
|---|---|---|---|---|
| 1 | `01-accueil.jpg` | Accueil d'un nouveau joueur : Pomme, bouton unique « Joue ta première partie », Go du jour et première leçon | Apprends le go en jouant | 5 |
| 2 | `02-lecon.jpg` | Leçon 1, premier écran : la pierre vient d'être posée, ses 4 libertés s'allument | Tu joues dès le premier écran | 6 |
| 3 | `03-premiere-partie.jpg` | Première partie contre Pomme : Mochi dit le but et annonce le komi de 0,5 | Ta première victoire est possible | 5 |
| 4 | `04-adversaires.jpg` | Les 9 adversaires illustrés, Pomme et Caillou battus | Neuf adversaires, à ton rythme | 5 |
| 5 | `05-revue.jpg` | Revue ouverte sur le moment clé : Mochi dit combien de points ce coup a coûté et propose de le rejouer | La revue va droit au moment clé | 7 |
| 6 | `06-go-du-jour.jpg` | Go du jour résolu, bouton « Partager » | Un Go du jour à partager | 5 |

Pourquoi cet ordre : dans les résultats de recherche, seules les premières captures sont visibles. Elles montrent l'action principale et le premier geste, la promesse de la charte (« apprendre en jouant »).

À surveiller sur la capture 5 : la puce du coup clé porte encore la coche « Solide » et la précision affiche 100 %, alors que Mochi compte des points perdus sur ce coup. C'est l'état réel de l'app ; signalé à l'équipe revue. À régénérer une fois corrigé.

Vidéo d'aperçu (facultative, 15 à 30 s) : première pierre posée en leçon, libertés qui s'allument, capture avec glissement vers le couvercle, moment clé en revue, partage du Go du jour. Pas de texte parlé, sous-titres courts.

## Nouveautés de la version 1.0

Apple (champ « Nouveautés ») et Google (500 caractères max) :

```
Bienvenue ! Voici la première version :
- 35 leçons où tu joues dès le premier écran ;
- plus de 200 problèmes prouvés, par thème ;
- Mochi qui t'explique tes coups en partie ;
- le Go du jour et ta série ;
- 9 adversaires, de Pomme à Sensei, et tes amis ;
- une revue qui va droit au moment clé.
Gratuit, sans publicité. Bonne première pierre !
```

(345 caractères.)

---

# English

Same rules: warm, direct ("you"), no false claims, no invented numbers, no competitor names. Terms from the glossary
(`docs/localisation/glossaire.md`). Version 3 (#473): the whole app is now in English (interface, 35 lessons, 231
puzzles, Mochi's coach, emails, reminders), so this listing can be published. Device language is detected
(`DETECTION_APPAREIL = true`), and it can be changed in Profile.

## Name and subtitle

| Field | Text | Chars |
|---|---|---|
| Name (Apple and Google) | Mochi Go: Learn Go | 18 |
| Subtitle (Apple) | Playable lessons and free AI | 28 |
| Promotional text (Apple) | 35 lessons where you play from the very first screen. Over 200 proven puzzles. And Mochi explains your moves during the game. | 125 |

"Go" alone is hard to find in English search. Alternative name to test: "Mochi Go: Learn Baduk, Weiqi" (28).

## Category

- App Store: **Games**, subcategories **Strategy** (primary) and **Board** (secondary).
- Google Play: **Games > Board**. Tags: Strategy, Puzzle, Board game, Single player, Offline.
- Age rating: 4+ (Apple), PEGI 3 / Everyone (Google).

## Short description (Google Play)

> Learn Go by playing: 35 lessons, 200+ puzzles and a strong AI. Free, no ads.

(76 characters)

## Keywords (App Store)

```
baduk,weiqi,igo,board game,chess,strategy,tsumego,puzzle,rules,beginner,katago,AI,tutorial,offline
```

(98 characters.) "learn" and "play" are already in the name.

## Full description

```
Go has been played for over 2,500 years. The rules take a minute. Here, you learn them by playing.

PLAY FROM THE VERY FIRST SCREEN
35 short lessons with Mochi, in 6 chapters: the basics, the opening, capturing and saving, life and death, the endgame, good shape. No pages to read: you place your stone and see what happens. Every Go word (atari, ko, komi) is explained the first time it shows up.

MOCHI HAS YOUR BACK DURING THE GAME
In your first games, Mochi tells you when your group is in atari or when you missed a capture. Mochi never plays for you, and you can turn the coach off.

YOUR FIRST WIN IS WITHIN REACH
Your first game is against Pomme, a beginner like you, on a small 9 × 9 board. For your first 3 games, komi (the points given to White, who plays second) is 0.5 instead of 6.5.

OVER 200 PUZZLES, BY THEME
Capture, save, life and death, connect and cut, endgame, tesuji. Every solution is proven against every defense: if your answer is right, it really works. Your mistakes come back at the right time, so they stick.

DAILY GO AND YOUR STREAK
One puzzle for everyone, every day. Share your result without spoiling the answer. Missed a day? A freeze can protect your streak.

9 OPPONENTS, AND YOUR FRIENDS
From Pomme (20 kyu) to Sensei (1 dan), each with a portrait and a personality. Challenge your friends with a link too, at your own pace: 3 days per move.

A STRONG AI, ON YOUR DEVICE
The strongest opponents are played by KataGo, an open-source Go AI. It runs on your phone, even offline once the AI is downloaded.

AN HONEST GAME REVIEW
After the game, the review goes straight to the key moment: the move that cost you the most, with the points lost. Replay it from that position. No fake praise.

FOR EVERYONE
- Free, with no ads.
- Try it without an account: 3 games, the first 3 lessons and the Daily Go. Then a free account keeps your progress.
- Play with the keyboard, with screen reader announcements, and zoom up to 200%.
- Dark and light modes, large touch targets, reduced motion respected.
- In English and French.

Do you play chess or board games? You'll love Go. Place your first stone.
```

(2 128 characters.)

## The 6 screenshots

Captions below. Images: same screens as the French set, with `?lang=en` (`e2e/captures-stores.spec.ts`, French only
for now: add `en` to its loop, then save to `docs/marketing/stores/captures/en/`). The English screens were checked on
08/10/2026 at 390 and 320 px, dark and light (`e2e/anglais-ecrans.spec.ts`): nothing overflows or gets cut.

| # | Screen | Caption | Words |
|---|---|---|---|
| 1 | Home: Pomme, single button "Play your first game", Daily Go, first lesson | Learn Go by playing | 4 |
| 2 | Lesson 1, first screen: stone placed, its 4 liberties light up | Play from the very first screen | 6 |
| 3 | First game vs Pomme: Mochi explains the goal and the 0.5 komi | Your first win is within reach | 6 |
| 4 | The 9 illustrated opponents, Pomme and Caillou beaten | Nine opponents, at your pace | 5 |
| 5 | Review opened on the key moment: Mochi says how many points the move cost and offers to replay it | Review goes straight to the key moment | 7 |
| 6 | Daily Go solved, "Share" button | A Daily Go to share | 5 |

## What's New in version 1.0

```
Welcome! Here's our first version:
- 35 lessons where you play from the very first screen;
- over 200 proven puzzles, by theme;
- Mochi explains your moves during the game;
- Daily Go and your streak;
- 9 opponents, from Pomme to Sensei, and your friends;
- a game review that goes straight to the key moment.
Free, no ads. Enjoy your first stone!
```

(347 characters.)

---

## Mesure

| Action | Coût | Indicateur visé | Mesure |
|---|---|---|---|
| Fiches v3 FR et EN (interface anglaise complète, #473) | 0 € (temps interne) | Conversion de la fiche (vues vers installations) : viser 30 % sur l'App Store | App Store Connect > Analytics ; Play Console > Acquisition de la fiche |
| Test du sous-titre v2 contre v1 (A/B) | 0 € | + 10 % de conversion relative | « Product Page Optimization » (Apple), « Tests de fiche » (Google), 2 semaines par test |
| Captures 1 et 2 en tête (premier geste) | 0 € | Part des installations qui posent une première pierre dans la minute : 90 % (charte) | PostHog, événement `premiere_pierre` (propriété secondes) |
| Capture 3 et texte « première victoire » | 0 € | Part des 3 premières parties gagnées, puis rétention J1 (45 %, charte) | PostHog : résultat des parties contre l'ordi (rang 0 à 2), cohortes J1 |
| Réponses aux avis | 0 € | Note moyenne 4,7 (charte) | Console des deux stores, chaque semaine |
