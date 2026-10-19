# Analyse expliquée : pourquoi c'est une erreur, pourquoi le bon coup est meilleur (#673)

Demande de Florian (18/10) : « Pour l'analyse des parties, il faut expliquer pourquoi c'est un mauvais coup, et
expliquer pourquoi le bon coup est le bon coup. » Règle absolue : aucun conseil de go faux. Chaque phrase découle d'un
fait calculé (règles de `src/go` et analyse de KataGo) ; sans fait sûr, on le dit.

## 1. État des lieux de départ

Ce que la revue (`src/app/Revue.tsx`) disait d'une erreur avant #673, dans la bulle de Mochi du parcours
(`src/app/parcours.ts`) :

- un titre (« G7 est une gaffe ») ou, jusqu'à 15 kyu, une catégorie (`categoriesRevue.ts`) ;
- la perte chiffrée et le meilleur coup : « Tu perds environ 8 points. Mieux : D4, la pierre verte. » ;
- deux faits tactiques seulement : pierres que tu pouvais prendre (« coup manqué ») et pierres prises juste après une
  gaffe (`prisesManquees`, `prisesApres` de la note) ;
- sur une erreur rejouable, le bon coup caché jusqu'à un essai ou « Voir le bon coup » (#77).

Ailleurs, sans rapport direct avec le parcours : « Rejouer mes erreurs » (#428) et « Tes erreurs à rejouer » expliquent
le bon coup après coup (`src/app/pourquoi.ts`, #492 et #497 : motifs tactiques d'un coup, zone de propriété, riposte) ;
les réfutations locales des problèmes (#554, `outils/refutationsLocales.ts`, `comprendreErreur.ts`) sont des lectures
exactes de vie et mort, propres aux problèmes. Le moteur (`analyseRevue`) donnait déjà la variante principale (PV), les
visites et la propriété après le meilleur coup ; le conseil du parcours (`meilleurCoup`) ne donnait que le coup et
l'avance, sans la règle de la partie. Rien ne comparait la suite après ton coup à la suite après le bon coup.

## 2. Méthode

Moteur : `analyseErreur` (`src/engine/index.ts`), pour chaque perte de tes coups clés, à la place de `meilleurCoup`.
Deux recherches de 64 visites (komi et règle de la partie) : la position avant l'erreur (meilleur coup, sa PV, ses
visites, la propriété après lui) et la position après l'erreur (réponse de l'adversaire, sa PV, ses visites, la
propriété). KataGo seulement, jamais le moteur simple.

Générateur : `expliquerErreur` (`src/go/explication.ts`), module pur, sans texte. Il joue deux suites avec les règles :
ton coup puis la PV de l'adversaire, et le bon coup puis sa PV (5 coups au plus chacune, coupées au premier coup
illégal ou à la première passe). Il compare ensuite les prises de chaque suite, les libertés (règles) et la propriété
après chacun des deux coups. Un fait n'est gardé que si deux sources s'accordent.

Phrases : `textesExplication` (`src/app/analyseExpliquee.ts`), catalogue FR et EN à part
(`src/content/i18n/analyse.ts`, chargé avec la revue). Une phrase par raison, deux raisons au plus ; atari, sente,
gote et couper expliqués entre parenthèses à leur première apparition dans une explication ouverte de la revue
(`glosesDesErreurs`, nourri par la revue des seules explications ouvertes avec « Pourquoi ? »).

## 3. Types de raisons et seuils

Propriété : de -1 à +1, du point de vue du joueur qui s'est trompé. `b` : après le bon coup ; `j` : après ton coup.

| Raison | Ce qui doit être vrai | Phrase (FR) |
|---|---|---|
| Pierres perdues | Dans ta suite, l'adversaire prend des pierres à toi (prise jouée avec les règles). Confirmation : propriété moyenne de ces pierres `j ≤ -0,3` ; sans propriété, seulement une prise immédiate (sa réponse). Avec le bon coup, elles ne sont pas prises et `b ≥ 0,3`. Cause : **atari ignoré** (une seule liberté avant ton coup **et encore une seule après** : ton coup ne les touche pas et ne prend pas de pierre voisine qui leur redonnerait des libertés), **auto-atari** (ton coup se met à une liberté), sinon prise plus loin dans la suite. | « Tes 2 pierres en D6 étaient en atari (il ne leur restait qu'une liberté) et tu n'as pas répondu : Blanc les prend en D4. » / « Avec D4, tes 2 pierres en D6 ne sont pas prises. » (seules les pierres déjà là avant ton coup : après un auto-atari, « Ton coup met tes 2 pierres en atari… » puis « Avec E1, ta pierre en E2 n'est pas prise. ») |
| Prise manquée | Dans la suite du bon coup, tu prends des pierres adverses ; dans ta suite, elles ne sont pas prises. Confirmation : `b ≥ 0,3` et `j ≤ 0` ; sans propriété, seulement si le bon coup prend lui-même. | « Sa pierre en E5 était en atari : tu pouvais la prendre. » / « F5 prend une pierre tout de suite. » Prise plus loin dans la suite, dite prudemment : « Selon KataGo, tu laisses passer la prise de sa pierre en E5. » / « Avec F5, dans la suite de KataGo, tu prends sa pierre en E5 (coup 3). » |
| Groupe | Un groupe à toi (pierres voisines, diagonales non coupées, sauts d'un point vide ; au moins 2 pierres), moyennes sur tout le groupe : `b ≥ 0,6`, `j ≤ 0,2`, `b - j ≥ 0,8`. « Meurt » si `j ≤ -0,6`, sinon « n'est plus sûr de vivre ». | « Après ton coup, ton groupe en E4 n'est plus sûr de vivre. » / « Avec G4, ce groupe vit, selon KataGo. » (sans nombre de pierres : le groupe est compté avant ton coup, qui peut s'y ajouter) |
| Groupe adverse | Même règle pour un groupe adverse, mort après le bon coup. « Vit » si `j ≤ -0,6`, sinon « peut encore s'en sortir ». | « … son groupe de 3 pierres en E4 peut encore s'en sortir. » / « Avec G3, son groupe de 3 pierres en E4 ne peut plus vivre, selon KataGo. » |
| Coupe | La réponse de l'adversaire touche au moins 2 de tes chaînes, ne prend rien, garde 2 libertés, et aucun coup ne les relie ensuite (règles). Elle coûte : perte moyenne de propriété des pierres coupées `≥ 0,4`, ou une prise dans la suite. Le bon coup la pare : il occupe le point, relie, ou rend la coupe en atari. | « Blanc répond en C4 et coupe tes pierres (couper : séparer des pierres pour qu'elles ne puissent plus se relier). » / « C4 prend le point de coupe : tes pierres restent ensemble. » / « Après F4, si Blanc coupe en E4, sa pierre est en atari (une seule liberté). » (on ne dit pas que la coupe « ne marche plus » : une pierre en atari peut parfois encore servir) |
| Territoire | Écart de propriété sur les points vides concentré dans une zone : coin, bord ou centre (tiers du plateau), sinon un quart, sinon une moitié ; la zone porte 70 % du total (sinon 50 % au niveau le moins précis), au moins 2 points, **au moins la moitié des points perdus**, et pas plus que les points perdus + 2 (sans marge si d'autres raisons ont déjà compté des pierres, 2 points par pierre). Le nombre dit ne dépasse jamais la perte de la revue. | « Tu perds environ 4 points dans le coin en bas à gauche. » / « Avec C4, tu as environ 9 points de plus à gauche. » |
| Initiative | Démontrée par les deux PV (premier coup d'au moins 16 visites) : après le bon coup, l'adversaire répond à 2 intersections au plus, puis tu joues à 4 au moins (sente) ; après ton coup, il joue tout de suite à 4 au moins (gote). Seulement en appoint (si moins de 2 raisons). | « Selon KataGo, ton coup est gote (…) : Blanc joue tout de suite ailleurs, en C7. » / « Selon KataGo, C3 est sente (…) : Blanc répond en D3, puis tu joues ailleurs, en G7. » (« selon KataGo » : les 2e et 3e coups de la PV sont peu explorés à 64 visites) |
| Point commun | Sans raison sûre, la réponse de l'adversaire est le bon coup lui-même (fait lu dans la PV). | « Noir répond en F6 : c'est justement le coup que KataGo te conseillait (environ 17 points de mieux). » |
| Sans raison sûre | Rien ne passe les seuils. « Rien n'est pris et aucun groupe ne change de sort » seulement si c'est vérifié (aucune prise dans les deux suites, aucune pierre dont la propriété bouge de 0,6). Sans ce calme vérifié, on ne qualifie pas la raison : on renvoie aux deux suites. | « KataGo préfère D4, d'environ 2 points. Rien n'est pris et aucun groupe ne change de sort : c'est une question de placement. » (calme vérifié) / « KataGo préfère D4, d'environ 2 points. Compare les deux suites pour voir la différence. » (moins de 5 points) / « KataGo préfère F5, d'environ 11 points. Je ne trouve pas de raison simple et sûre : regarde les deux suites. » |

Seuils communs (`SEUILS`) : pas d'explication sous 1 point perdu ; une PV n'est lue au-delà de son premier coup que si
ce coup a au moins 16 visites ; 5 coups par suite. Ordre : prises, puis coupe et groupes, puis zone, les plus lourdes
d'abord ; deux raisons au plus.

## 4. Dans la revue

Sur ton erreur, une fois le bon coup montré (après un essai ou « Voir le bon coup » : rien n'est dévoilé avant), un lien
« Pourquoi ? » apparaît dans la bulle de Mochi. Il déplie l'explication **dans la bulle**, à la place du commentaire :
deux onglets (`.seg`) « Ton coup » / « Le bon coup », le titre « Pourquoi c'est une erreur » ou « Pourquoi D4 est
meilleur », une ou deux phrases. Le goban montre la suite de l'onglet : coups numérotés (1 : ton coup, ou le bon coup),
pierres concernées entourées tant qu'elles sont là, zone en carrés (bon coup) ou en cadre (ton coup) à la dernière
étape, croix sur ton coup dans la suite du bon coup. Sous le goban, la bande des coups laisse la place à « Coup 2 sur
5 de la suite » et aux mêmes boutons ‹ › (flèches du clavier aussi, Échap ferme). La courbe et « Rejouer d'ici » se
replient. Action principale inchangée : « Suivant », seul aplat jade (E1) ; « Fermer » rend le parcours tel quel.

Épure : au premier regard rien n'est ajouté sauf un lien (E14 : le détail est replié derrière « Pourquoi ? », E12) ;
ouvert, la bulle garde une ou deux phrases (E5) et l'écran perd deux blocs (courbe, rejouer). Captures 390 × 844 :
`docs/design/captures/revue-pourquoi-673/` (sombre et clair).

## 5. Vérité : tests

- `src/go/explication.test.ts` (41 tests) : positions construites dont la raison se compte sur le diagramme : atari
  ignoré, ton coup qui prend une pierre voisine et redonne des libertés (jamais « atari ignoré »), auto-atari, prise manquée, groupe qui meurt ou faiblit, groupe adverse tué, coupe (et diagonale qui n'en est
  pas une), territoire (coin, quart, plafond, part minimale), initiative, et les cas où il faut **se taire** : propriété
  qui contredit la prise de la suite, PV trop peu explorée, pierres perdues aussi avec le bon coup, coupe qui ne coûte
  rien, écart réparti, propriété mal formée.
- `src/go/explication-katago.test.ts` : analyses du vrai réseau g170-b6c96 figées dans
  `src/go/explications-katago.json` par `outils/explicationsKataGo.ts` (tfjs-node, 1,7 min ; aucun calcul long en CI).
  Cinq positions de vérité connue (`src/go/explications-cas.ts`) : atari ignoré, capture ratée, territoire, coupe,
  ouverture ambiguë (aucune raison inventée). Puis deux vraies parties : six raisons vérifiées à la main sur
  le plateau (coups 24, 25, 27, 28, 41, 42 de la partie #424) ; pour chaque erreur, chaque fait rejoué avec les règles
  (une prise annoncée est une prise jouée, au point et au coup annoncés ; atari = une liberté) ; instantané des phrases
  FR et EN.
- `src/app/analyseExpliquee.test.ts` : phrases exactes FR et EN, gloses une seule fois, clés EN complètes avec les mêmes
  variables, plateau de la suite (numéros, cibles, croix, zone).
- `src/engine/analyseErreur.test.ts` : deux recherches, règle et komi transmis, repli sans la seconde recherche.
- `e2e/revue-pourquoi.spec.ts` : parcours complet à 390 px, sombre et clair.
- `e2e/revue-pourquoi.spec.ts`, avec le vrai réseau (sauté sans `public/models`) : la partie #424 revue dans Chromium
  par le vrai KataGo, « Pourquoi ? » ouvert sur une vraie erreur de Florian (coup 41, D1 ; KataGo G3). Texte affiché,
  identique à l'analyse figée : « Après ton coup, son groupe de 3 pierres en E4 peut encore s'en sortir. Tu perds
  environ 16 points à droite. » / « Avec G3, son groupe de 3 pierres en E4 ne peut plus vivre, selon KataGo. Avec G3,
  tu as environ 16 points de plus à droite. » Captures 390 × 844, sombre : `docs/produit/captures-673/`.

## 6. Relecture écrite (deux vraies parties)

Sortie complète : `npx vite-node outils/relectureExplications.ts` (`-- --en` pour l'anglais) ; instantané dans
`src/go/__snapshots__/explication-katago.test.ts.snap`. Relu coup par coup sur le plateau (Claude, expert go du
projet), les deux camps, 56 erreurs (celles dont la revue montre le bon coup).

**Partie entre amis de Florian (#424, 9 × 9).**

- Coup 24, Blanc J6 (KataGo F5) : « Sa pierre en E5 était en atari (il ne lui restait qu'une liberté) : tu pouvais la
  prendre. » / « F5 prend une pierre tout de suite. » Juste : E5 noir touche D5, E6, E4 blancs, seule liberté F5.
- Coup 25, Noir C9 : « Ta pierre en E5 était en atari et tu n'as pas répondu : Blanc la prend en F5. » Juste ; la
  glose n'est plus répétée.
- Coup 27, Noir B8 : « Après ton coup, ton groupe en F6 meurt, selon KataGo. Tu perds environ 4 points en
  bas à droite. » Juste : E5 (une liberté) et F6 (deux libertés, F7 et E6 blancs) ne peuvent plus sortir ; F5 les reliait.
- Coup 28, Blanc J8 : « Tes 8 pierres en C8 étaient en atari et tu n'as pas répondu : Noir les prend en E8. Sa pierre en
  E5 était en atari : tu pouvais la prendre. » / « Avec F5, tes 8 pierres en C8 ne sont pas prises. F5 prend une
  pierre tout de suite. » Juste, et c'est la vraie leçon de la partie : F5 prend E5 et redonne des libertés aux 8 pierres. L'ordre
  idéal serait « F5 prend une pierre, et tes 8 pierres sont sauvées » ; les deux phrases restent vraies.
- Coups 14, 15, 16 : « Noir répond en F6 : c'est justement le coup que KataGo te conseillait (environ 17 points de mieux). »
  Juste et utile : les deux joueurs ont ignoré F6 trois fois de suite.
- Coups 41 et 42 : la chaîne blanche E4-E3-E2 « peut encore s'en sortir » (après D1 noir), puis « ton groupe en E4 n'est
  plus sûr de vivre » (après E1 blanc ; plus de « 3 pierres » : E1 fait une chaîne de 4). Juste : elle a le champ libre vers F3 et G3, que KataGo prend en premier.
- Coup 11, Noir E7 (11 points) : « Je ne trouve pas de raison simple et sûre : regarde les deux suites. » Honnête : la
  propriété bouge sur des pierres sans franchir les seuils.
- Coups 30 à 36 : « Tu perds environ 17 points à droite. » Vrai selon la propriété ; on aimerait dire que les pierres
  blanches de droite deviennent faibles, mais KataGo ne les donne pas vivantes après G4 (propriété moyenne 0,5), donc on
  ne le dit pas.

**Partie en ligne florian_go contre Takumi88 (9 × 9).** Erreurs d'ouverture et de bord de 2 à 6 points : « Tu perds
environ 3 points sur le bord du haut. » (coups 7, 8), « Tu perds environ 6 points en bas. » (coup 16), et « Blanc répond
en E2. KataGo préfère D2, d'environ 3 points. Rien n'est pris… c'est une question de placement. » (coup 13). Aucune phrase fausse
relevée ; les zones correspondent au côté où se joue la PV.

**Relecture d'un professeur de go (19/10).** Corrections appliquées :

- « atari ignoré » exigeait seulement une liberté avant ton coup : si ton coup prend une pierre voisine, tes pierres
  regagnent des libertés et « tu n'as pas répondu » devient faux. La cause exige maintenant une seule liberté aussi
  après ton coup (test dédié). Aucune phrase des deux vraies parties ne change de cause.
- Prises lues seulement dans la suite de KataGo : dites prudemment (« Selon KataGo, tu laisses passer… », « Avec F5,
  dans la suite de KataGo, tu prends… »).
- Sans raison sûre et sans calme vérifié : plus de « la raison est surtout positionnelle », mais « Compare les deux
  suites pour voir la différence ». Avec calme vérifié : « c'est une question de placement ».
- Groupe à toi : sans nombre de pierres (compté avant ton coup, faux quand ton coup s'y ajoute, coup 42).
- « tue son groupe » → « son groupe … ne peut plus vivre, selon KataGo » ; « reste vivant » → « vit, selon KataGo ».
- Coupe : « … et coupe tes pierres (couper : séparer des pierres pour qu'elles ne puissent plus se relier). »
- Bon coup après pierres perdues : « tes 2 pierres en D6 ne sont pas prises » (le lieu lève l'écart apparent après un
  auto-atari : ta pierre jouée n'existe pas avec le bon coup).
- Coupe parée par un atari : « sa pierre est en atari » (l'adversaire n'est pas genré).
- Vocabulaire : « sur le bord droit/gauche », « te conseillait (environ 17 points de mieux) », « tu as environ
  9 points de plus à gauche » ; anglais : « may no longer live », « can still escape », « no group’s status changes »,
  « Show line ».
- Gloses : données à la première explication réellement ouverte, plus à la première calculée.

Verdict : aucune affirmation fausse sur les 56 erreurs. Les explications sont souvent modestes (zone, placement) :
c'est voulu, la règle prime sur la richesse.

## 7. Limites

- La propriété vient d'une seule évaluation du réseau (pas d'une moyenne de la recherche) : sur les formes de vie et
  mort serrées, le petit réseau b6c96 se trompe, et l'explication suit KataGo. Exemple essayé : un groupe d'angle en
  « trois en ligne » (B1 vit, sinon mort), que b6c96 voit mort dans les deux cas : aucune raison « groupe » n'est
  alors donnée (le fait n'est pas sûr), et cette position n'a pas pu servir de cas connu.
- Les PV au-delà du premier coup sont peu explorées à 64 visites : 5 coups au plus, et une prise lointaine n'est dite
  que si la propriété la confirme.
- Les chiffres de zone viennent de la propriété, pas du score : on les borne par la perte de la revue, mais ce sont des
  ordres de grandeur (« environ »).
- Sente et gote sont lus dans la PV de KataGo, pas démontrés : la phrase le dit (« Selon KataGo »).
- Ko, seki, échelles et menaces ne sont pas nommés : ils peuvent apparaître dans la suite montrée, sans phrase.
- Un coup de l'adversaire (contre l'ordi) n'est pas expliqué ; seulement tes erreurs dont le bon coup est montré.
- Deux recherches de plus par erreur expliquée (environ 2 × 2,5 s sur un téléphone en WebGL), en arrière-plan après le
  bilan ; elles remplacent la recherche de `meilleurCoup`.
- La relecture couvre deux vraies parties en 9 × 9 seulement.
- Gloses : un mot est expliqué dans la première explication ouverte, dans l'ordre de la partie. Si tu ouvres le coup 30
  puis le coup 10, les deux donnent la glose (le mot est expliqué deux fois, jamais zéro), et revenir au coup 30
  l'affiche ensuite sans glose.
- Dans un navigateur sans GPU et chargé (conteneur de test, rendu CPU), la recherche bornée en temps (2,6 s) ne fait
  que 2 à 5 visites : les deux PV ne sont alors pas lues (moins de 16 visites), la suite montrée se réduit au premier
  coup, et seules les raisons tirées des règles et de la propriété restent. La légende le dit (« Ton coup seul : suite peu
  explorée. ») au lieu d'annoncer une réponse absente.
