# Introduction des règles v2 : expliquer, puis faire, puis fêter (octobre 2026)

Retour de Florian, 24/10, test sur iPhone de « Les règles du go » : le texte de Mochi donnait une consigne périmée après le geste (« pose ta pierre au point vert » alors qu'il n'y a plus de point vert, et seul « Continuer » est actif) ; les libertés étaient demandées avant d'être montrées ; il manque le plateau et ses lettres, l'objectif et la fin de partie ; un mot ne dit pas ce qu'on apprend ; « on peut aller plus loin dans les explications » ; et surtout : « on me dit souvent "je comprends rien au go" : il faut que le cours permette de faire des parties où on prend du plaisir directement ».

Ce document fixe le parcours cible, écran par écran. Il est livré en trois PR indépendantes (section 5). Règle absolue : aucun conseil de go faux ; chaque phrase est relue comme par un professeur exigeant, et chaque chiffre ou coordonnée est rejoué par le moteur (`src/go/introRegles.test.ts`).

## 1. Principes

1. **Expliquer, puis faire.** Une phrase et le goban montrent, puis on demande le geste. Quand le goban doit d'abord bouger (les libertés qui s'allument, le territoire qui se colorie), la démonstration se joue avant la demande (`geste.apres`).
2. **La bulle de Mochi décrit toujours l'écran tel qu'il est.** Trois états au plus par écran : avant (ce qu'on voit), à toi (le geste demandé, une fois la démonstration finie), après (ce qui vient de se passer). Jamais une consigne périmée. Un test lit chaque écran et refuse « point vert » dans un texte « après ».
3. **Chaque geste réussi répond tout de suite** : la bulle change (verdict jade, Mochi content), un anneau de jade s'ouvre sur le point touché, le son et la vibration des préférences partent, le point de progression s'allume.
4. **L'écran suivant s'enchaîne sans chercher le bouton** : « Continuer » arrive en relief, son anneau pulse deux fois (pas en mouvements réduits), et la bulle le dit (« Touche Continuer »).
5. **Un mot-notion par écran**, en étiquette « Mot du go » au-dessus de la bulle. Le mot est défini dans la phrase de l'écran où il apparaît pour la première fois (CLAUDE.md, règle 5).
6. **Une bulle = deux phrases au plus** (épure E5). Le pointeur « Touche Continuer » n'est pas une phrase de Mochi : c'est le libellé du bouton, rappelé. Exception assumée : l'écran du compte (3 phrases, il porte le komi).
7. **Un écran ne change pas de taille quand le texte change.** Les trois états d'un écran ont des phrases de longueur voisine (la pose, 76 caractères après le geste) ; le test de parcours vérifie à 390 × 844 et 320 × 568 que rien ne défile, état par état. Le compte, qui défilait à 320 × 568 avant cette refonte, tient maintenant (PR 2) : Mochi se fait plus petit et la coche du verdict cède sa place au texte sur les très petits téléphones.
8. **Une touche répond à « touches-en une ».** Toucher une liberté ou un territoire ne pose pas de pierre : dans l'introduction, un goban 7 × 7 répond à une seule touche, sans pierre fantôme ni seconde touche (la pose d'une pierre se confirme comme en partie). Les leçons gardent la double touche : même défaut possible, à traiter à part.
9. **Du plaisir tout de suite** : à la fin des règles, une mini-partie que le joueur gagne (PR 3).

## 2. Parcours cible (10 écrans, plateau 7 × 7)

« Avant » = texte tant que rien n'est fait ; « à toi » = demande après la démonstration ; « après » = texte une fois le geste réussi. Textes de la version complète (« Jamais joué ») ; la version express (« Un peu ») a les mêmes écrans et gestes, avec des phrases plus courtes (`court`). Anglais : mêmes clés `intro.*` dans `src/content/i18n/en.ts`.

| # | Mot-notion | Écran et geste | Texte FR | Retour du geste | Preuve go |
|---|---|---|---|---|---|
| 1 (PR 2, livré) | **Croisement** | Goban vide, lettres en haut, chiffres à gauche. Toucher C3. | Avant : « Chaque croisement a un nom : sa colonne (lettre) et sa ligne (chiffre, compté depuis le bas). Touche C3. » Faux point : « Cherche la colonne C, en haut, puis la ligne 3, sur le côté. » Après : « Oui, C3 : colonne C, ligne 3. Une pierre se pose sur un croisement, là où deux lignes se croisent. » | La colonne C et la ligne 3 s'allument. | `fromLabel('C3', 7)` : colonne 2, ligne 3 depuis le bas ; lettres A à G, chiffres de bas en haut (convention CLAUDE.md). |
| 2 | **Tour de jeu** | Goban vide, point vert en D4. Poser une pierre (deux touches si « Confirmer au doigt » est actif). | Avant : « Une pierre se pose sur un croisement des lignes. Noir commence : touche le point vert, puis touche-le encore. » (sans confirmation : « …touche le point vert. ») Après : « Bien joué ! Chacun son tour : une pierre posée ne bouge plus, sauf capture. » | Pierre noire, claquement, Blanc répond en E5 (la bulle n'a pas besoin de le dire : on le voit), anneau jade. | `play` : D4 noir puis E5 blanc, tour alterné. |
| 3 (PR 2, livré ; ancien écran 7) | **Territoire** | Position finale (mur noir en D, mur blanc en E). Le territoire noir se colorie, puis toucher un de ses croisements. | Avant : « Le but : entourer plus de territoire que l'autre. Ici, tes pierres entourent des croisements vides : ton territoire. » À toi : « Les croisements vides que tes pierres entourent sont ton territoire : chacun vaut 1 point. À toi : touches-en un. » Après : « Oui ! Le but : entourer plus de territoire que Blanc (14 points). » | Compteur jusqu'à 21, anneau jade. | `score` : territoire noir 21 (A à C), blanc 14 (F et G). En mouvements réduits, « Avant » n'est jamais lu : « À toi » définit le territoire et « Après » redit le but. |
| 4 (aujourd'hui 2) | **Liberté** | Une pierre noire en D4. Ses 4 libertés s'allument une à une avec le compteur, puis toucher une liberté. | Avant : « Regarde les libertés de cette pierre : ce sont les croisements vides qui la touchent. » À toi : « Les libertés sont les croisements vides collés à une pierre : celle-ci en a 4. À toi : touches-en une. » Diagonale : « Une liberté touche ta pierre par une ligne, pas en diagonale. » Après : « Oui, c'est une liberté ! Une pierre qui n'en a plus est capturée. » | Anneau jade sur le point. | `groupAt` : libertés de D4 = D5, C4, E4, D3. |
| 5 (aujourd'hui 3) | **Capture** | La pierre blanche D4 n'a plus qu'une liberté (point vert D3). Jouer D3. | Avant : « Pour capturer une pierre, on lui prend toutes ses libertés. La blanche n'en a plus qu'une : joue sur le point vert. » Après : « Capturée ! Elle quitte le plateau et devient ton prisonnier. » | La pierre tombe, +1 prisonnier. | D3 est le seul coup qui capture ; `captures[1] = 1`. |
| 6 (aujourd'hui 4) | **Atari** | Une pierre noire marquée n'a qu'une liberté. La sauver. | Avant : « Une pierre qui n'a plus qu'une liberté est en atari : Blanc peut la capturer. Ici, tu sauves la tienne en jouant sur sa liberté. » Après : « Sauvée ! Collées, tes deux pierres partagent 3 libertés : plus d'atari. » | Verdict jade. | D3 donne 3 libertés au groupe ; tout autre coup laisse l'atari et Blanc prend. « Ici » : sauver en prolongeant ne marche pas toujours, l'écran ne le généralise pas. |
| 7 (aujourd'hui 5) | **Coup interdit** | A1 refusé, G5 permis (il capture). | Avant : « On ne pose pas une pierre sans liberté, comme en A1 ici, sauf si elle capture. Prends les pierres marquées. » A1 : « Interdit : en A1, ta pierre n'aurait aucune liberté et ne capture rien. » Après : « Permis : ta pierre capture 2 pierres et gagne 2 libertés. » | Verdict jade ; A1 : croix. | `play(A1)` = suicide ; G5 capture G4 et G6, 2 libertés ensuite. |
| 8 (aujourd'hui 6) | **Ko** | Capturer en C4. | Avant : « Capture au point vert : Blanc ne pourra reprendre qu'après avoir joué ailleurs. C'est le ko. » Après : « Blanc ne peut pas reprendre en D4 (la croix) : il doit jouer ailleurs d'abord. » | La croix apparaît en D4. | `play` rend `ko` en D4 ; légal après deux coups ailleurs. |
| 9 (PR 2, livré) | **Passer** | Position finale, question à deux choix. | Avant : « Chaque camp a fermé sa zone. Quand tu ne vois plus de coup utile, que fais-tu ? » Choix : « Je passe » / « Je joue encore ». Après : « Oui, on passe. Quand les deux joueurs passent de suite, la partie s'arrête. » Faux : « Quand aucun coup n'est utile, on peut passer son tour. » | Verdict jade. | Aucun croisement neutre (21 + 14 = 35 croisements vides, tous à un camp) ; passer est un coup permis ; deux passes laissent plateau, prisonniers et vainqueur inchangés. |
| 10 (PR 2, livré ; ancien écran 8) | **Compte** | Même position, quiz « Qui gagne ? ». | Avant : « Noir : 21 + 2 prisonniers = 23. Blanc : 14 + 1 + 6,5 de komi (compensation, car Noir a commencé). Qui gagne ? » Après : « Noir : 21 + 2 = 23. Blanc : 14 + 1 + 6,5 = 21,5. Noir gagne de 1,5 point ! » | Verdict jade, fin des règles. | `score` : 23 contre 21,5, marge 1,5 ; komi = `KOMI_NORMAL`. La question donne les totaux : la leçon est de les additionner, komi compris, pas de compter 35 croisements. |

Choix de conception, pour le professeur exigeant : la position finale a deux grandes zones (3 × 7 et 2 × 7). Elles servent de diagramme, comme dans tous les manuels pour débutants ; l'écran ne prétend jamais qu'aucun coup n'y rapporterait (« quand tu ne vois plus de coup utile »), parce qu'un joueur fort pourrait y chercher une invasion. L'objectif est dit comme un but (« entourer plus de territoire »), pas comme une stratégie.

Ordre : l'objectif vient en 3e position, avant les libertés, pour que « capturer » et « atari » aient un sens (on capture pour entourer plus). La fin de partie et le compte restent à la fin, où on les rejoue sur la même position.

## 3. Ce que la v1 faisait mal, et la réponse

| Retour de Florian | Cause dans le code | Réponse |
|---|---|---|
| Texte « pose ta pierre au point vert » après le geste | `LessonPlayer` gardait `step.text` après `gesteFait` | Champ `fait` : la bulle change dès le geste (verdict jade) |
| « Continuer » sans que le texte le dise | L'action n'apparaissait que dans le pied d'écran | Pointeur « Touche Continuer » dans la bulle + anneau pulsé sur le bouton |
| Libertés demandées avant d'être montrées | `geste.touche` attendait avec l'écran figé | `geste.apres` : la démonstration se joue, puis `demande` |
| Poser une pierre mal expliqué | Une seule phrase | Phrase « croisement » + « touche, puis touche encore » selon le réglage |
| Plateau, lettres, objectif, fin de partie absents | Non écrits | Écrans 1, 3 et 9 |
| Un mot pour dire ce qu'on apprend | Aucun libellé | Étiquette « Mot du go » (écrans 1 à 10) |

## 4. Boucle de jeu et indicateurs

| Boucle (docs/game-design/boucle.md) | Ce que l'intro v2 y apporte | Indicateur de la charte visé | Mesure |
|---|---|---|---|
| Minute | Chaque geste réussi répond en moins de 100 ms (son, vibration, anneau, point) | Première pierre dans la minute : 90 % (`premiere_pierre`) | Existant |
| Session | L'intro finit sur une victoire, pas sur un cours | Part des premières parties menées à la fin (`premiere_partie_terminee`) ; `intro_regles_finie` ÷ `intro_regles_etape` (index 1) | Existants ; PR 3 ajoute `mini_partie_*` |
| Jour | Série allumée dès la première session, « encore une partie » proposé | Rétention J1 : 45 % | Cohorte PostHog sur `app_ouverte` |

Chute par écran : `intro_regles_etape` porte déjà `index` (1 à 10 après la PR 2) et `parcours`. Le taux d'abandon par écran se lit sans nouvel événement. Valeur de départ à relever dans PostHog avant la PR 2 (v1 : 8 écrans) pour comparer.

Éthique : pas de fausse urgence, pas de perte punitive, aucune récompense qui se retire. Un mauvais geste n'a jamais de coût : la bulle explique, on rejoue. Aucune notification, aucun minuteur. Le public inclut des enfants : vocabulaire simple, ton calme.

## 5. Livraison

1. **PR 1 (fluidité).** Champs `fait`, `demande` et `apres`, bulle toujours à jour, pointeur « Touche Continuer » et anneau pulsé, anneau jade sur le point touché, point de progression allumé au geste, étiquette « Mot du go » ; textes réécrits des 8 écrans actuels (expliquer puis faire, `libs` montrées avant la capture). Ce document.
2. **PR 2 (plateau, objectif, fin).** Écrans 1, 3 (territoire déplacé et enrichi du but) et 9 ; l'écran 10 devient « Compte » ; 8 écrans deviennent 10.
3. **PR 3 (première mini-partie).** Voir ci-dessous.

### PR 3 : « Ta première partie » (5 × 5 contre Pomme, juste après les règles)

Idée : le go qu'on a appris se joue tout de suite, et on gagne. Variante de capture, nommée telle quelle (« le premier qui capture 3 pierres gagne ») : c'est la variante d'initiation la plus courante (atari-go), pas une partie truquée ni un faux go.

- **Plateau** 5 × 5 (`MINI_TAILLE`), le joueur a Noir, Pomme Blanc. Départ : deux pierres noires et une blanche posées, une blanche à une liberté de l'atari (l'aide du départ, dite à voix haute par Mochi).
- **Victoire facile garantie, honnêtement** : (a) Pomme joue un adversaire de débutant, sans lire les ataris (choix pondéré, constantes nommées), dit dans sa présentation ; (b) Mochi montre un point vert sur le coup qui met en atari ou capture après `MINI_AIDE_APRES` coups sans progrès (l'aide est annoncée : « Mochi t'aide ») ; (c) test Vitest : un joueur qui suit toujours l'aide gagne dans 100 % de 1000 parties simulées ; la durée maximale est bornée (`MINI_COUPS_MAX`).
- **Récompenses** (sobres, sans culpabilité) : première capture : la pierre prise tombe dans le couvercle, Mochi content, +XP (`XP_MINI_CAPTURE`), un point d'objectif s'allume (trois pierres à prendre) ; victoire : fête sobre (sceau, confettis seulement si les célébrations sont actives), +XP (`XP_MINI_VICTOIRE`), série du jour allumée. Défaite possible mais sans coût : « Encore une ? » avec une aide plus visible.
- **Enchaînement** : dixième écran → mini-partie → fin de l'intro (« Partie de découverte avec Mochi » reste l'action principale, #677/#681) avec « Encore une mini-partie » en lien. `Game.tsx` n'est pas touché (la mini-partie est dans le morceau de l'intro).
- **Mesure** : `mini_partie_commencee`, `mini_partie_capture` (coups jusque-là), `mini_partie_finie` (`gagnee`, `aides`, `coups`). Garde-fou comme #160 : si plus de 90 % des mini-parties sont gagnées sans aucune aide, on retire le départ avantageux.

Chaque PR a son issue, sa branche et ses tests ; les captures 390 × 844 avant et après sont dans `docs/design/captures/intro-v2-<n>/`.
