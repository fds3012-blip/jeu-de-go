# Liens UTM par canal (#537)

Un lien par canal du plan d'acquisition (`docs/marketing/analyse-marche-acquisition-2026-10.md`, section 2.4). Copie le lien tel quel. Chaque lien est vérifié par un test (`outils/referencement/docsLancement.test.ts`) : page existante, paramètres complets, valeurs lisibles.

**Indicateur que ces liens font bouger** : la colonne « source » du tableau « Lancement » (`docs/marketing/tableau-lancement.md`, tuile 3). Sans eux, tous les joueurs venus d'un post arrivent en « direct » et on ne sait pas quel canal garder à la fin de la phase 1.

## Règles

- **`utm_source`** : le lieu précis (`reddit`, `reddit_chess`, `discord_echecs`, `club`…). C'est la colonne qu'on lit.
- **`utm_medium`** : le type de canal, parmi `social`, `forum`, `communaute`, `email`, `affiche`, `presse`, `video`, `partenariat`, `paid`.
- **`utm_campaign`** : la phase du plan (`p1-go`, `p1-echecs`, `p1-clubs`, `show-hn`, `p2-presse`, `p2-video`, `p2-createurs`, `go-du-jour`, `p3-paid`, `p3-ecoles`) ou la ville pour une affiche de club.
- **`utm_content`** (facultatif) : la variante (une vidéo, un créateur, une affiche). Sur une page d'entrée, il est rempli tout seul avec le nom de la page.
- Valeurs : minuscules, chiffres, `_`, `-` et `.` seulement, 64 caractères au plus, sans accent ni espace. Une valeur hors de ces règles est ignorée par les pages d'entrée.
- Un même lien pour un même lieu, pendant toute la phase : sinon les chiffres se dispersent.
- Pour un média, un créateur ou une ville, remplace la partie entre `<…>` (exemple : `presse_<media>` devient `presse_numerama`).

## Où mène chaque lien

- **Page d'entrée** quand la cible a la sienne : joueurs d'échecs, fans de *Hikaru no Go*, parents. La page explique, puis « Jouer maintenant » ouvre l'app avec les mêmes UTM (`outils/referencement/relais-utm.js`).
- **L'app directement** (`/` ou `/en`) pour les joueurs de go et les publics techniques : ils veulent jouer tout de suite.
- **Le Go du jour** (`/j/<N>`, N = numéro du jour) pour les posts quotidiens : l'aperçu du lien montre le défi, puis l'app s'ouvre sur lui en gardant les UTM.

## Liens

| Canal du plan | Lieu | Lien |
|---|---|---|
| A. Go | r/baduk | `https://mochi-go.app/en?utm_source=reddit&utm_medium=social&utm_campaign=p1-go` |
| A. Go | Forum OGS | `https://mochi-go.app/en?utm_source=ogs&utm_medium=forum&utm_campaign=p1-go` |
| A. Go | Life in 19x19 | `https://mochi-go.app/en?utm_source=l19&utm_medium=forum&utm_campaign=p1-go` |
| A. Go | Discord de go francophone | `https://mochi-go.app/?utm_source=discord&utm_medium=communaute&utm_campaign=p1-go` |
| B. Échecs | r/chess, r/chessbeginners | `https://mochi-go.app/en/go-for-chess-players?utm_source=reddit_chess&utm_medium=social&utm_campaign=p1-echecs` |
| B. Échecs | Discords d'échecs (FR) | `https://mochi-go.app/go-pour-joueurs-echecs?utm_source=discord_echecs&utm_medium=communaute&utm_campaign=p1-echecs` |
| C. Hacker News | Show HN | `https://mochi-go.app/en?utm_source=hn&utm_medium=social&utm_campaign=show-hn` |
| C. Product Hunt | Fiche Product Hunt | `https://mochi-go.app/en?utm_source=producthunt&utm_medium=social&utm_campaign=p2-producthunt` |
| D. FFG et clubs | Courriel à la FFG | `https://mochi-go.app/?utm_source=ffg&utm_medium=email&utm_campaign=p1-clubs` |
| D. FFG et clubs | Courriel aux clubs | `https://mochi-go.app/?utm_source=club&utm_medium=email&utm_campaign=p1-clubs` |
| D. FFG et clubs | Affiche A4 (QR code), une par ville | `https://mochi-go.app/?utm_source=club&utm_medium=affiche&utm_campaign=<ville>` |
| D. FFG et clubs | Affiche pour l'initiation des jeunes | `https://mochi-go.app/go-pour-enfants?utm_source=club&utm_medium=affiche&utm_campaign=<ville>` |
| E. Presse | Un lien par média | `https://mochi-go.app/?utm_source=presse_<media>&utm_medium=presse&utm_campaign=p2-presse` |
| G. Vidéo courte | Lien en bio TikTok | `https://mochi-go.app/?utm_source=tiktok&utm_medium=video&utm_campaign=p2-video` |
| G. Vidéo courte | Lien en bio Instagram (Reels) | `https://mochi-go.app/?utm_source=reels&utm_medium=video&utm_campaign=p2-video` |
| G. Vidéo courte | Description YouTube Shorts | `https://mochi-go.app/?utm_source=shorts&utm_medium=video&utm_campaign=p2-video` |
| G. Vidéo courte | Vidéo « Hikaru no Go » | `https://mochi-go.app/hikaru-no-go?utm_source=tiktok&utm_medium=video&utm_campaign=p2-video&utm_content=hikaru` |
| G. Vidéo courte | Vidéo « joueur d'échecs vs go » | `https://mochi-go.app/go-pour-joueurs-echecs?utm_source=tiktok&utm_medium=video&utm_campaign=p2-video&utm_content=echecs` |
| H. Créateurs | Créateur de go (EN) | `https://mochi-go.app/en?utm_source=createur_<nom>&utm_medium=partenariat&utm_campaign=p2-createurs` |
| H. Créateurs | Créateur d'échecs (FR) | `https://mochi-go.app/go-pour-joueurs-echecs?utm_source=createur_<nom>&utm_medium=partenariat&utm_campaign=p2-createurs` |
| H. Créateurs | Créateur manga ou anime | `https://mochi-go.app/hikaru-no-go?utm_source=createur_<nom>&utm_medium=partenariat&utm_campaign=p2-createurs` |
| I. Go du jour | Bluesky | `https://mochi-go.app/j/<N>?utm_source=bluesky&utm_medium=social&utm_campaign=go-du-jour` |
| I. Go du jour | Mastodon | `https://mochi-go.app/j/<N>?utm_source=mastodon&utm_medium=social&utm_campaign=go-du-jour` |
| I. Go du jour | X | `https://mochi-go.app/j/<N>?utm_source=x&utm_medium=social&utm_campaign=go-du-jour` |
| I. Go du jour | Instagram | `https://mochi-go.app/j/<N>?utm_source=instagram&utm_medium=social&utm_campaign=go-du-jour` |
| J. Payant (tests) | Meta, ciblage échecs | `https://mochi-go.app/go-pour-joueurs-echecs?utm_source=meta&utm_medium=paid&utm_campaign=p3-paid&utm_content=<video>` |
| J. Payant (tests) | Reddit Ads | `https://mochi-go.app/en/go-for-chess-players?utm_source=reddit_ads&utm_medium=paid&utm_campaign=p3-paid&utm_content=<video>` |
| L. Écoles | Fiche enseignant | `https://mochi-go.app/go-pour-enfants?utm_source=ecole&utm_medium=email&utm_campaign=p3-ecoles` |

**Sans UTM, et c'est voulu** :

- **Référencement (F)** : les visiteurs arrivent par Google sur les pages d'entrée sans UTM. Le bouton « Jouer maintenant » porte alors `utm_source=mochi-go&utm_medium=page&utm_campaign=<page>` (par exemple `go-echecs`, `hikaru-no-go`, `go-enfants`, `vocabulaire`). Dans le tableau, la source `mochi-go` veut dire « venu d'une page du site », presque toujours par un moteur de recherche. La Search Console donne le détail des recherches.
- **Partages entre joueurs** (Go du jour, défi, partie, « Partager Mochi Go ») : mesurés par leurs propres événements (`arrivee_par_partage`, `defi_ouvert`), pas par des UTM.
- **Stores (K)** : les stores ont leur propre suivi des sources.

## Les UTM arrivent-ils dans PostHog ? Oui (vérifié le 14/10/2026)

Rien à coder : posthog-js lit `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` et `utm_term` dans l'adresse (réglage `save_campaign_params`, actif par défaut) et les ajoute comme propriétés à **chaque événement** de la visite.

- **Sans accord (mesure anonyme)** : les UTM sont gardés en mémoire pendant la visite. Tous les événements de la visite les portent (`app_ouverte`, `premier_ecran_vu`, `premier_geste`, `premiere_pierre`…). Rien n'est écrit sur l'appareil.
- **Avec accord (mesure complète)** : en plus, PostHog garde les premiers UTM sur la personne (`$initial_utm_source`…), ce qui permet de suivre J1 et J7 par canal.
- **Nettoyage des adresses** (`src/data/urlSensible.ts`) : les UTM ne sont pas des paramètres sensibles, ils restent.
- **Pages d'entrée** : elles ne mesurent rien elles-mêmes. Leur bouton transmet les UTM à l'app.
- **Preuve** : le test `e2e/venir-jouer.spec.ts` arrive sur `/go-pour-joueurs-echecs?utm_source=reddit&utm_medium=social&utm_campaign=lancement`, touche « Jouer maintenant », puis lit ce que reçoit PostHog : `app_ouverte` porte `utm_source=reddit`, `utm_medium=social`, `utm_campaign=lancement`, `utm_content=go-echecs` et `mesure=anonyme`.

**Limite** : sans accord, chaque chargement de page est une nouvelle visite. Un joueur venu de Reddit qui revient le lendemain par son écran d'accueil n'a plus d'UTM. Les nouveaux joueurs par canal sont justes. Pour la rétention par canal, il faut lire la population avec accord.
