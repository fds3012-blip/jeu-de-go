# Charte du vocabulaire de l'interface

Issue #237, partie N5. Source : `docs/ux/analyses/2026-09-28-premier-parcours-v2.md`, constat N5.
Textes : `src/content/i18n/fr.ts` (langue source) et `en.ts` (même sens).
Garde-fou : `src/content/i18n/vocabulaire.test.ts` lit tout le catalogue français et échoue si un terme banni revient.

Règle : **un mot par objet, un sens par mot.** Un débutant qui lit deux mots pense qu'il y a deux choses.
Le vocabulaire du go (atari, ko, komi, liberté) suit `docs/localisation/glossaire.md`.

## 1. La boucle quotidienne

| Objet | Terme retenu | Termes bannis | Exemples |
|---|---|---|---|
| Les jours d'affilée où tu as joué | **série** | « jours de suite », « jour de suite », « défi par jour » | « 3 jours de série », « Série de 6 jours. » |
| La plus longue série | **record**, seulement **à partir de 2 jours** | « 1 jour de record », « 0 jour de record » | Profil : « 7 jours, ton record ». Avec 0 ou 1 jour : « 1 jour de série ». |
| Le problème commun à tous, chaque jour | **Go du jour** | « défi », « le défi du jour », « le défi a changé » | « Le Go du jour a changé : voici celui d'aujourd'hui. » |
| Ce qui garde la série | on nomme les trois actions : **le Go du jour, une leçon ou une révision** | « un défi par jour », « défi du jour » | « Pour garder ta série, fais chaque jour le Go du jour, une leçon ou une révision. » |
| Les problèmes réussis que l'on refait | **révision** (« Révision du jour ») | — | « Révision faite. » |
| État de la tuile du Go du jour | **À faire** / **Fait** | — | Pastille de l'accueil. |

Pourquoi pas « défi du jour » comme mot chapeau : le débutant lirait deux noms quotidiens, « Go du jour » et « défi du jour », pour des choses presque pareilles. Trois actions concrètes se comprennent mieux qu'un mot de plus. La règle du code (`src/app/defi.ts`, « un défi par jour ») garde son nom interne ; il n'apparaît pas à l'écran.

« Défi » et « défier » sont réservés aux **adversaires** : « Défier Caillou », « Le dernier défi » (Sensei, en haut de l'échelle), et l'ami qu'on défie par lien (« Défier un ami », #81), qui est un adversaire humain.

Anglais : **streak** (« day streak », « days, your record »), **Daily Go**, **review**. Jamais « challenge » pour la boucle.

## 2. Les boutons : un verbe, une action

« Continuer » ne dit pas ce qui va se passer. Il garde **un seul sens** : l'étape suivante **dans une leçon**. Ailleurs, le bouton dit l'action.

| Écran | Avant | Après |
|---|---|---|
| Lecteur de leçon, étape suivante | Continuer | **Continuer** (seul usage gardé) |
| Chemin des leçons, leçon entamée | Continuer | **Reprendre** (lecteur d'écran : « Reprendre la leçon : Atari ») |
| Chemin des leçons, leçon pas commencée | Continuer | **Commencer** (« Commencer la leçon : Atari ») |
| Onglet Problèmes, prochain problème | Continuer · titre | **Problème suivant** · titre (même mot que sur la feuille de réussite) |
| Récit du score, fin | Continuer | **Voir le résultat** |
| Avertissement avant de passer | Continuer à jouer | **Jouer encore** (face à « Passer ») |

Anglais : Continue (leçon seulement), Resume, Start, Next puzzle, See the result, Play on.

Dans une phrase, le verbe « continuer » reste libre (« Continue comme ça ! », « Pomme continue : … ») : la règle vise les boutons.

## 3. Ton juste

| Cas | Banni | Retenu | Pourquoi |
|---|---|---|---|
| Revue sans KataGo | « joue contre Bambou ou plus fort » | « Pour voir le meilleur coup, affronte un adversaire plus fort. » | Le débutant ne connaît pas Bambou. On ne cite un adversaire que s'il l'a déjà rencontré. |
| Réplique de l'adversaire quand tu passes | « Tu es sûr ? », « Déjà fini ? », « On compte ? » | « Voyons voir… », « Je regarde. », « À moi. » | Mochi a déjà demandé confirmation avant la passe (#235). L'adversaire peut encore jouer : il ne doit ni douter de toi, ni annoncer une fin qui n'arrive pas. |

## 4. Règles d'écriture (rappel)

- Une idée par phrase. Tutoiement.
- Un mot du go est expliqué la première fois (atari, ko, komi, liberté).
- Un bouton commence par un verbe et dit ce qui arrive.
- Un chiffre sans valeur n'est pas fêté : pas de « record » d'un jour.
- Même objet, même mot, sur tous les écrans et dans les deux langues.
