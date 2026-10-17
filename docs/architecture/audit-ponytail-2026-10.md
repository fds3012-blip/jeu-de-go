# Audit « ponytail » et performance mobile (#577, 17/10)

**Ce que fait le dépôt :** Mochi Go, une PWA (Vite, React, TypeScript) pour apprendre et jouer au go. Tout le jeu
tourne sur le téléphone (règles, moteur simple et KataGo dans des Web Workers) ; Supabase garde les comptes, les
parties en ligne et la progression.
**Charge supposée :** beaucoup de joueurs, chacun sur un téléphone moyen, souvent en 3G ou 4G lente. Le coût qui
compte : ce que chaque téléphone télécharge et calcule, et le nombre de requêtes par joueur vers Supabase.

Skills appliquées : `ponytail-audit`, `ponytail` (le plus petit changement complet), `performance-optimization`
(mesurer, corriger une chose, remesurer, garder ou annuler). CLAUDE.md prime en cas de conflit.

Hors champ, comme demandé : `src/content/lots`, `content/lessons*`, preuves `src/go/*preuve*`, `lot-*.test.ts`,
fichiers générés `*.gen.ts`. Non touchés : `supabase/`, `vercel.json`, `outils/csp.ts`, `src/data/supabase.ts`
(sécurité, #578) ; `src/go` hors tests (copié dans `supabase/functions` par `npm run sync:functions`).

## Résultat en bref

| | avant (`8828849`) | après |
| --- | --- | --- |
| Lignes de `src/` | | −498, +27 |
| Fichiers supprimés | | 3 (`ui/Defile.tsx`, `ui/defile.ts`, `ui/defile.test.ts`) |
| Clés de traduction (fr + en) | | −59 clés, −118 lignes |
| JS total du build (gzip) | 1 283,0 Ko | 1 281,2 Ko (−1,8 Ko ; brut −6,8 Ko) |
| Textes des écrans (`secondaires-*.js`, gzip) | 27,8 Ko | 26,9 Ko |
| JS initial / CSS initial (budget) | 149,3 / 21,4 Ko | 149,3 / 21,4 Ko (inchangés : budgets gardés à 150 et 22) |
| Temps des parcours mesurés | | inchangés (aucune correction de performance n'a battu le bruit, voir le journal) |
| Dépendances npm | 9 + 21 | inchangées (toutes utilisées) |

## Méthode

### Code mort et doublons

1. **Exports jamais lus** : script hors dépôt qui charge le programme TypeScript complet (`tsconfig.json` : `src`,
   `content`, `e2e`, `outils`), résout chaque import et alias jusqu'à sa déclaration, et classe chaque export de
   `src/` : *mort* (aucun lecteur), *tests seulement* (lu seulement par des `*.test.ts`), *local* (lu dans son
   fichier seulement). Résultat sur `main` : 35 morts, 512 « tests seulement », 460 locaux.
2. Chaque candidat est **revérifié par grep** dans `src`, `e2e`, `outils`, `scripts`, `content`, `supabase/functions`,
   en comptant les chaînes et les imports dynamiques : 21 des 35 « morts » étaient des écrans chargés par
   `import()` (`ecrans.ts`, `App.tsx`), donc vivants.
3. **Clés de traduction** : une clé de `fr.ts`, `frEcrans.ts` ou des petits catalogues est morte si aucun fichier
   de code ne la cite en littéral, ni par un préfixe dynamique (`` `note.phrase.${n}` ``, `'revue.' + x`), ni par
   un suffixe après interpolation. Les tests ne comptent pas comme lecteurs.
4. **CSS** : une classe d'une feuille de `src/` est morte si aucun fichier ts, tsx, html ou e2e ne contient ce mot,
   ni un préfixe construit (`` `theme-${id}` ``). Méthode large (un mot cité en commentaire suffit à garder la
   règle) : elle ne trouve que les cas sûrs.
5. **Dépendances npm** : chaque paquet de `package.json` cherché dans le code, la config et les scripts.

Après chaque suppression : `npx tsc -b` (avec `noUnusedLocals`), puis les deux scripts relancés, pour les morts en
cascade (une clé lue seulement par une fonction supprimée, par exemple).

### Performance

`scripts/mesurer-parcours.mjs` (nouveau) : Chromium par Playwright, 390 × 844, **CPU 4× plus lent, réseau « Fast 3G »**
de DevTools (562,5 ms, 1,44 Mbit/s, comme `scripts/mesurer-perf.mjs`), contexte neuf à chaque parcours. Il relève FCP,
LCP, bouton principal, polices, longues tâches (> 50 ms, `PerformanceObserver('longtask')`), plus longue interaction
(Event Timing), et sait dire si le coup de l'ordi vient de KataGo (sinon la console écrit « KataGo indisponible »).

- `vite preview` (demandé) sert en **HTTP/1.1** : 6 connexions au plus. `--h2` sert le même build en **HTTP/2**,
  comme Vercel. La différence compte : en HTTP/1.1, la réponse de Pomme au premier coup prend 3,5 s parce que le
  Worker du moteur fait la queue derrière les ≈ 60 morceaux préchargés ; en HTTP/2, 0,9 s. Les décisions se prennent
  sur HTTP/2.
- À côté, hors dépôt : profil CPU (build non minifié), trace Chrome des longues tâches, cascade réseau, compteur de
  rendus React (crochet des DevTools posé avant la page), et un parcours e2e temporaire qui liste les requêtes
  Supabase par écran (faux Supabase de `e2e/fauxSupabase.ts`, compte connecté).

## Constats

Numérotés. Chacun : fichier, preuve, risque, ce que j'ai fait.

### À corriger (hors de ce périmètre : issues à créer)

1. **La preuve d'acceptation des conditions n'est jamais écrite** (`src/data/conditions.ts`)
   - Preuve : `accepterConditions` et `conditionsAJour` ne sont lus que par `conditions.test.ts` ; aucune autre
     mention de `accepter_conditions` dans `src/` ni dans les migrations après `20261002000100_preuve_conditions.sql`.
     L'en-tête du fichier le dit : « Branchement attendu (front, pas fait ici) ».
   - Risque : la décision D2 (`docs/juridique/compte-obligatoire.md`) suppose la date et la version gardées par le
     serveur. Aujourd'hui, aucun compte ne les a.
   - Fait : rien (écrans de connexion, périmètre frontend). Issue à créer : appeler `accepterConditions(db)` après
     `verifierCode` réussi et au retour de Google, comme le décrit l'en-tête.

2. **Premier coup contre Bambou (KataGo) sans réseau en cache : 16 s d'attente, puis un coup du moteur simple**
   (`src/engine/index.ts`, `analyserGarde`)
   - Preuve : `mesurer-parcours`, 3 passages sur 3 : 16,0 s, et la console écrit « KataGo indisponible, repli sur le
     moteur simple ». Le réseau (3,8 Mo) et TensorFlow.js (≈ 1,2 Mo) ne passent pas en 16 s à 180 Ko/s. Réseau en
     cache : 3,2 s, coup de KataGo.
   - Risque : un joueur qui débloque Bambou en 3G attend 16 s son premier coup, et ce coup n'est pas celui de Bambou.
   - Fait : rien (règle de l'IA, #475). À décider : jouer le moteur simple tout de suite tant que KataGo charge, et
     afficher la progression (« 2,1 / 3,8 Mo ») comme dans la revue.

3. **Garde-fou du serveur ancien jamais branché** (`src/data/versionServeur.ts`)
   - Preuve : le module n'est importé que par son test ; son en-tête : « Branchement prévu (src/data/defi.ts) ».
   - Risque : l'incident de #344 (fonction `game-action` pas redéployée, chaque coup refusé) se reverrait sans
     message clair.
   - Fait : rien. Brancher dans `defi.ts`, ou supprimer le module (67 lignes et son test) si le déploiement
     automatique suffit.

### À améliorer

4. **Composant `Defile` et son double** (`src/ui/Defile.tsx`, `src/ui/defile.ts`) : **supprimés**
   - Preuve : `grep -rn "<Defile\|from './defile'" src` ne trouve plus que le test qui vérifie son absence
     (`sansCote.test.ts`) ; plus rendu depuis #284. `src/ui/defilement.ts` fait la même chose (`valeurDefilee`,
     mouvements réduits) et sert à `Cote.tsx` et `FinPartie.tsx`.
   - Risque : aucun, rien ne l'importait. −67 lignes.

5. **Fonctions que seuls leurs tests lisaient** : **supprimées avec leurs tests**
   - Preuve (compilateur, puis grep) : `grossesErreurs`, `phraseErreur`, `phraseNote`, `phraseMomentCle`,
     `AUCUNE_ERREUR`, `SANS_KATAGO`, `Erreur` (`app/revue.ts`, revue v1-v2 remplacée par #405) ; `puzzleOfDay`
     (`data/puzzles.ts`, remplacé par le Go du jour, #75) ; `proposeDead` (`engine`, remplacé par `proposeComptage`,
     #117) ; `palierRecommande` (`app/paliers.ts`, plus de cote affichée, #284) ; `ligneCompteur` (`app/score.ts`) ;
     `phraseMontre` (`app/rejouerErreurs.ts`, remplacée par `phraseMontrePourquoi`, #492) ; `noterPartieTerminee`,
     `partiesRestantes` (`app/essai.ts`) ; `elementDeLOnglet` (`app/aFaire.ts`) ; `cumuler`, `hautPastille`,
     `HAUT_XP*` (`ui/gainXp.ts`) ; alias `envoyerCode` (`data/account.ts`) et `chargerDefis` (`app/aFaireCharge.ts`).
   - Risque : aucun pour l'app. Les tests des deux alias passent maintenant par `sendMagicLink` et `chargerAFaire` :
     la couverture du vrai code reste.

6. **59 clés de traduction jamais lues** (fr et en) : **supprimées**
   - Preuve : script des clés (méthode 3), puis `grep -F "'clé'"` sur tout le dépôt. Anciennes revues (`revue.*`,
     `cle.*`), lien magique remplacé par le code à 6 chiffres (`compte.lienEnvoye`…), inscription du défi par e-mail,
     `seance.chargement`, `import.coller`, `entete.apprendre` (seule clé morte de `fr.ts`, donc du JS initial)…
   - Risque : aucun ; le test « en a exactement les clés du français » reste vert. Textes des écrans : −0,9 Ko gzip.

7. **Exports et règle CSS sans lecteur** : **supprimés**
   - `preloadKataGo` (et sa mention dans `engine/katago/README.md`), `hapticsEnabled`, `CAMPS_DEUX`, `IdQuestion`,
     `_reinitialiserFile` (aide de test qu'aucun test n'appelle) ; `.adversaire-cote` (`ui/cote.css`, depuis #417).

8. **Lien du Go du jour : 5,1 s pour voir le problème, contre 2,6 s pour l'accueil** (`src/main.tsx`, `src/app/Puzzles.tsx`) : **essayé, annulé**
   - Preuve : cascade réseau du lien `/?go-du-jour=1` : `prechargerPartie()` lance ≈ 20 morceaux (`Game`, `Revue`,
     sons, partage… ≈ 80 Ko gzip) en même temps que les ≈ 30 de l'écran Problèmes. Le plateau du problème s'affiche
     à 5,1 s (HTTP/2) ou 9,2 s (HTTP/1.1), contre 2,6 s pour l'accueil.
   - Essai : sur un lien du Go du jour, ne plus lancer `prechargerPartie()` au chargement (2 lignes). Gain net en
     HTTP/1.1 (9,19 → 8,15 s), mais en HTTP/2, A/B alterné sur 8 paires : médiane 5 140 → 5 093 ms, 7 paires sur 8
     en faveur de l'essai, écarts −632 à +105 ms. Gain dans le bruit sur le serveur de production : **annulé**
     (commits `475087a` puis son annulation), comme le veut la règle « neutre = annulé ».
   - Le vrai poids : l'écran Problèmes tire à lui seul ≈ 30 morceaux et 230 Ko gzip, dont les leçons complètes
     (18 Ko), l'émulation, la sécurité, les sons. Les charger à l'usage est un découpage d'écran (frontend), pas une
     correction sûre : issue à créer, à mesurer avec `mesurer-parcours.mjs --h2`.

9. **Requêtes Supabase en double à l'ouverture** (`src/app/hooks.ts`, `src/data/lectureProfil.ts`)
   - Preuve (parcours e2e temporaire, compte connecté, rechargement de l'accueil) : `mon_profil` est appelé
     4 fois, dont **2 fois à l'identique** (`useProfil` et `usePseudo` lisent tous deux `fetchProfile`), plus
     `fetchStreak` et `fetchGels` qui relisent des colonnes de la même ligne. Et à **chaque changement d'onglet**,
     la liste « À faire » relit `defis`, `notifications`, `file_lente` et `mes_amis` (4 requêtes).
   - Risque : à grande échelle, ≈ 3 requêtes de trop par ouverture et 4 par onglet, par joueur connecté.
   - Fait : rien. Fusionner les lectures du profil dans un seul hook est un changement d'écran (`App.tsx`). Une
     promesse partagée dans `fetchProfile` serait plus courte mais pourrait rendre un profil lu avant une écriture
     (`account.ts` le relit juste après avoir changé le pseudo). Issue à créer pour le frontend : `usePseudo` tiré de
     `useProfil` ; « À faire » relu au plus toutes les 30 s, et sur les événements temps réel déjà reçus.

### Petits gains écartés après mesure (journal)

| Idée | Mesure | Verdict | Pourquoi |
| --- | --- | --- | --- |
| Lien du Go du jour sans préchargement de la partie (constat 8) | HTTP/2, A/B alterné ×8 : 5 140 → 5 093 ms (médianes) ; HTTP/1.1 : 9 187 → 8 152 ms | annulé | Dans le bruit en HTTP/2 (production). |
| Mémoïser le plateau (`React.memo` sur `Board`) | 6 à 7 rendus de `Board` par coup (coup + réponse), 2 utiles ; ≈ 4 ms par rendu à CPU ×4 (profil, build non minifié) ; interaction la plus longue 70-220 ms, dont `Board` < 10 % | écarté | Gain ≈ 20 ms par coup, dans le bruit ; il faudrait stabiliser `marks`, `noms` et les rappels dans `Game.tsx` (refonte). Accueil, partie immobile : 0 rendu. |
| Créer le Worker du moteur à l'ouverture de la partie | Réponse de Pomme : 3,5 s en HTTP/1.1, mais 0,9-1,2 s en HTTP/2 (délai voulu 0,5-1,2 s, #187) | écarté | Le retard ne vient que de la file HTTP/1.1 de `vite preview` ; Vercel sert en HTTP/2. |
| TensorFlow.js réduit (`tfjs-core` + `backend-webgl` + `backend-cpu` au lieu de `@tensorflow/tfjs`) | Build d'essai : 233 → 182 Ko gzip (−51 Ko, brut 944 → 680 Ko) | écarté | −0,3 s sur ≈ 21 s de téléchargement de KataGo en 3G ; ajoute 3 dépendances directes et touche le moteur. À reprendre si KataGo passe au démarrage. |
| Précharger les polices dans `index.html` | déjà mesuré (docs/qa/perf-2026-09-29.md) | écarté | Elles passeraient avant le JS : le bouton principal arriverait plus tard. |

Longues tâches de l'accueil : 3-4 tâches, 400-670 ms au total, la plus longue 160-250 ms (CPU ×4). C'est
l'évaluation du JS initial et le premier rendu React (≈ 360 ms de JS, le reste en analyse, styles et mise en page) :
rien d'isolable sans découper le JS initial, déjà au budget.

Images et polices : l'app n'affiche que des SVG en ligne ; deux `<img>` de 44 px (`icon-192.png`). Polices :
68,7 Ko woff2 (budget 80), sous-ensemble latin, `font-display: swap`. Rien à faire.

Consentement refusé : ni Sentry (152 Ko gzip) ni PostHog (102 Ko) ne sont téléchargés (vérifié sur 20 s de visite).

### Laissé tel quel, et pourquoi

- **Constantes « texte d'origine »** (`ALERTE_ATARI`, `PERTES_DIFFUSES`, `legendeSerie`, `EXPLICATION_KOMI`…,
  ≈ 40 exports lus seulement par des tests) : choix de #167, elles vérifient que le catalogue garde le texte
  français validé. Supprimées seulement quand leur clé était morte (`AUCUNE_ERREUR`, `SANS_KATAGO`).
- **Aides de test** (`_resetForTests`, `_reinitialiser*`, `setKataGo`, `fakeNet.ts`, fixtures) : utilisées.
- **Accès lus par des tests de contenu** : `themeDe` (cohérence des thèmes de 500 problèmes), `recompensesDebloquees`
  (équilibre de l'économie), `OUVERT_DEBUTANT`, `CALENDRIER_GO_DU_JOUR`, `memePosition`.
- **Miroirs du serveur** : `MAX_SERVEUR` (`data/partiesPerso.ts`), `TypeSignalement` (`data/securite.ts`), et les
  aides de refus prêtes mais pas branchées : `finSuspension` (#531), `plafondDuRefus` (#442), `apercuDefi`,
  `compteRequis` (#343). Elles décrivent un contrat écrit dans les migrations ; à brancher ou supprimer avec le
  périmètre sécurité (#578), qui travaille dessus.
- **`src/go`** : `Cell` (rules.ts), `compterEtude`, `partieClassee`, `estProvisoire`, `avantMiseAJour`,
  `empreinteTextes`, `defi-action.ts`. `src/go` est copié dans `supabase/functions` (périmètre #578 en cours) ou sert
  aux preuves des lots.
- **`src/data/database.types.ts`** : généré par Supabase (`TablesInsert`, `Enums`…).
- **`profil.cote`** : seule clé morte restante ; `i18n.test.ts` s'en sert comme exemple de variable.
- **460 exports lus seulement dans leur fichier** : enlever le mot `export` ne retire aucun code ; bruit.
- **Avertissements ESLint** (`react-refresh/only-export-components`, 5) : déjà sur `main`.

## Mesures

`node scripts/mesurer-parcours.mjs --runs 3 [--h2] --dist <build>`, médiane de 3 (passages entre parenthèses dans
la sortie). Téléphone émulé : CPU 4×, Fast 3G. « avant » : `main` (`8828849`) ; « après » : cette branche.

### HTTP/2 (comme Vercel)

| Parcours | avant | après |
| --- | --- | --- |
| Accueil : bouton principal affiché | 2 634 ms | 2 663 ms (bruit) |
| Accueil : polices affichées | 4 087 ms | 4 040 ms |
| Accueil : longues tâches au chargement | 4, max 247 ms | 4, max 252 ms |
| Toucher « Jouer » → plateau | 628 ms | 584 ms (bruit) |
| Premier coup → réponse de Pomme | 887 ms | 1 082 ms (bruit : délai voulu tiré entre 500 et 1 200 ms, #187) |
| Problème par lien du Go du jour → plateau | 5 077 ms | 5 134 ms (mesuré avec l'essai du constat 8, annulé depuis) |
| Onglet Problèmes → plateau | 718 ms | 1 205 ms (658-1 715 : écrans encore en préchargement, bruit) |
| Premier coup contre Bambou, rien en cache | 16 045 ms, coup du moteur simple (0/3 KataGo) | 16 086 ms, idem |
| Même chose, réseau en cache | 3 188 ms (3/3 KataGo) | 3 287 ms |
| Revue (réseau en cache) : écran / KataGo prêt | 146 ms / 2 286 ms | 175 ms / 2 504 ms |

Le code de l'app n'a perdu que du code mort : les écarts de ces lignes sont du bruit (même ordre de grandeur que
l'écart entre passages). La colonne « après » a été mesurée avec l'essai du constat 8 (lien du Go du jour), annulé
ensuite.

**A/B du lien du Go du jour** (`/?go-du-jour=1`, builds alternés pour que la charge de la machine pèse autant sur
chacun, ms) :

| Paire | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | médiane |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sans l'essai | 5 257 | 5 115 | 5 300 | 5 117 | 5 113 | 5 164 | 5 329 | 5 101 | 5 140 |
| avec l'essai | 5 124 | 5 220 | 4 668 | 4 752 | 5 092 | 5 082 | 5 125 | 5 093 | 5 093 |

### `vite preview` (HTTP/1.1)

| Parcours | avant | après |
| --- | --- | --- |
| Accueil : bouton principal | 2 754 ms | 2 718 ms |
| Toucher « Jouer » → plateau | 1 075 ms | 1 059 ms |
| Premier coup → réponse de Pomme | 3 549 ms | 3 395 ms |
| Problème par lien du Go du jour (avec l'essai annulé) | 9 187 ms (9 174-9 290) | 8 152 ms (8 136-8 216) |
| Onglet Problèmes → plateau | 688 ms | 634 ms |
| Premier coup contre Bambou, rien en cache / en cache | 16 075 / 3 086 ms | 16 065 / 3 044 ms |
| Revue : KataGo prêt | 2 238 ms | 2 361 ms |

## Garde-fous

- Budget du JS et du CSS initiaux : `scripts/budget-bundle.mjs` (CI), inchangé (149,3 / 150 Ko, 21,4 / 22 Ko).
- Parcours mobiles : `scripts/mesurer-parcours.mjs` à relancer avant et après un changement de chargement ;
  comparer sur `--h2` et alterner les builds (une seule différence à la fois). Une seule série de 5 passages avait
  montré −405 ms pour le constat 8 ; l'A/B alterné ne l'a pas confirmé : toujours alterner.
- Code mort : relancer la méthode 1 à 3 avant un audit ; ce document liste ce qui a été gardé exprès.

**Verdict :** sain côté code (peu de code mort, aucune dépendance inutile) ; à corriger d'abord : la preuve
d'acceptation des conditions (1), puis la première partie contre Bambou en 3G (2).
**Lean :** −471 lignes nettes dans `src/` ; ≈ −150 possibles de plus (constat 3, aides de refus non branchées).

**Pas vérifié :** Safari et un vrai iPhone (Chromium seulement) ; le vrai Supabase (faux serveur de `e2e/`) ;
la suite e2e complète (seulement les parcours des écrans touchés) ; `supabase/` et `src/go` hors tests.

## #584 : les trois corrections (constats 2 et 9)

Mesures : `node scripts/mesurer-parcours.mjs --h2 --runs 3` (CPU 4×, Fast 3G, 390 × 844, HTTP/2, médiane de 3 ;
passages entre parenthèses), « avant » = `main` (`de7e736`), « après » = cette branche. Requêtes : faux Supabase,
`e2e/requetes-accueil.spec.ts` (compte connecté ; « avant » mesuré sur `main` avec `MESURE_AVANT=1`). Ce document et
l'outil de mesure viennent de #577 (PR #582, pas encore fusionnée) : repris tels quels, cette section ajoutée.

### 1. Premier coup contre Bambou en 3G, réseau pas encore en cache

**Cause.** `KataGoClient.analyze` attend le démarrage de KataGo au plus `initWaitMs` = 15 s, puis lève « KataGo pas
encore prêt » ; `bestMoveExplique` attrape l'erreur et joue le coup du moteur simple, sans rien dire à l'écran (la
bulle dit « Bambou réfléchit… »). En Fast 3G, le réseau (3,83 Mo) et TensorFlow.js (≈ 1,2 Mo) mettent ≈ 24 s : le
délai de 15 s tombe à chaque fois (15 s + ≈ 1 s de moteur simple = 16 s). Rien n'était préchargé : le préchargement
de #475 ne part qu'en fin de partie, à partir de la 2e, et jamais en données mobiles (`type: 'cellular'`), donc
jamais en 3G.

**Correction.**
- `bestMoveExplique` attend le démarrage de KataGo (`start`, borné par `DELAI_DEMARRAGE_MS` = 120 s du client) au lieu
  des 15 s. S'il échoue (réseau coupé, appareil), le coup du moteur simple est marqué `sansIA` et Mochi le dit, une
  fois par partie : « Sans l'IA (pas chargée), Bambou joue E7. »
- Pendant l'attente, la bulle de Mochi dit « L'IA se prépare… 2,0 / 3,8 Mo » (pas de 0,5 Mo : la bulle est une zone
  `aria-live`), puis « L'IA se prépare… » pendant le démarrage. Texte seul, dans la bulle existante ; l'animation
  d'attente est celle de « réfléchit » (mouvements réduits déjà respectés).
- KataGo démarre dès l'ouverture d'une partie contre un adversaire KataGo (le téléchargement avance pendant le premier
  coup du joueur).
- Préchargement « à l'approche de Bambou » (`prechargerPourAdversaire`) : quand Bambou (ou plus fort) est choisi dans
  « Changer », et 3 s après une victoire contre Caillou. Règles de #475 sauf deux : la première partie et les données
  mobiles ne bloquent plus (le joueur va en avoir besoin) ; l'économie de données (`saveData`) et la 2G bloquent
  toujours, comme une page cachée. Hors ligne : rien ne change (#538 propose Caillou avant la partie).
- Placé dans les morceaux chargés à la demande (partie, carrousel), pas dans `App.tsx` : JS initial inchangé.

| Parcours (HTTP/2) | avant | après |
| --- | --- | --- |
| Toucher « Jouer » tout de suite, premier coup → réponse de Bambou | 16 040 ms (16 024-16 123), **0/3 coups de KataGo**, rien à l'écran | 26 713 ms (26 362-26 990), **3/3 KataGo** ; « L'IA se prépare » après 413 ms |
| Bambou choisi dans « Changer », 20 s sur la feuille, puis le premier coup | 16 046 ms (16 007-16 068), 0/3 KataGo | **5 653 ms** (5 320-5 774), 3/3 KataGo ; « L'IA se prépare » après 223 ms |
| Même chose, réseau en cache | 3 115 ms | 3 187 ms (bruit) |
| Accueil : bouton principal | 2 712 ms | 2 730 ms (bruit) |

Le cas « tout de suite » est plus long (le coup est celui de Bambou, pas celui du moteur simple) : le téléchargement de
≈ 5 Mo à 180 Ko/s ne descend pas sous ≈ 24 s. Il est visible, avec la progression, au lieu de 16 s muettes. Le cas
courant (Bambou choisi, ou débloqué après une victoire, puis quelques secondes ailleurs) passe de 16 s à 5,7 s, avec
le vrai Bambou. À décider si 27 s restent trop : jouer le moteur simple *en le disant* tant que KataGo charge (réponse
immédiate, mais Bambou plus faible sur ses premiers coups, et l'échelle compterait une victoire contre un Bambou affaibli).

### 2. `mon_profil` lu 4 fois à l'ouverture de l'accueil

**Cause.** Quatre crochets lisaient la même ligne, chacun pour soi : `useProfil` et `usePseudo` (`fetchProfile`, à
l'identique), `useSerie` (`fetchStreak`) et `useGelsServeur` (`fetchGels`), plus `useProfil` de l'écran de partie.

**Correction.** `lireMonProfil` (`src/data/lectureProfil.ts`) : une lecture partagée, clé = client, compte et `cle` de
relecture de l'appelant (le pseudo qui vient d'être choisi force une relecture), gardée 30 s au plus, oubliée en cas
d'erreur et après chaque écriture qui change le profil (`invaliderProfil` : pseudo, départ de la cote, problème, coup
ou abandon de partie ; la série importée de l'appareil fait relire `useSerie`). Un écran qui vient d'écrire relit par
`fetchProfile`, jamais par la lecture partagée (le risque relevé par #577). `fetchStreak` et `fetchGels` supprimés.

| Ouverture de l'accueil, compte connecté | avant | après |
| --- | --- | --- |
| Appels `mon_profil` | 4 | **1** (2 quand la série de l'appareil est envoyée au serveur, pour relire après l'écriture) |

### 3. « À faire » relu à chaque changement d'onglet

**Cause.** `useAFaire` relisait défis, notifications et recherche lente à chaque changement de `cle` (onglet, vue), et
`useDemandesAmis` relisait `mes_amis` de même : 4 requêtes par onglet.

**Correction.** Une lecture gardée 60 s par compte (`chargerAFaireFrais`, `src/app/aFaireCharge.ts`, chargé à la
demande), demandes d'ami comprises (`useDemandesAmis` supprimé, ses demandes lues avec le reste). Relue avant la minute
si : notification en temps réel, retour sur l'app, minuterie d'une minute, retour d'une partie, `relire()`, erreur, ou
écriture du joueur qui change « À faire » (`invaliderAFaire`, `src/data/fraicheurAFaire.ts` : défi créé, rejoint, joué
ou abandonné, notifications lues, demande d'ami, recherche lente).

| Compte connecté | avant | après |
| --- | --- | --- |
| Requêtes « À faire » à l'ouverture | 4 | 4 |
| Requêtes « À faire » sur 5 changements d'onglet en une minute | **20** | **0** |
| Changement d'onglet juste après une demande d'ami | 4 | 4 (relu, comme voulu) |

### Garde-fous et budget

- Vitest : `src/engine/premierCoupKataGo.test.ts` (attente du démarrage au-delà de 15 s, repli annoncé, règles du
  préchargement), `src/data/lectureProfil.test.ts`, `src/app/aFaireFrais.test.ts`.
- Playwright : `e2e/bambou-premier-coup.spec.ts`, `e2e/requetes-accueil.spec.ts`.
- JS initial : 149,3 Ko (152 847 o, 24 o de moins que `main`). CSS initial inchangé (21,4 Ko).

### Journal

| Idée | Mesure | Verdict |
| --- | --- | --- |
| Préchargement depuis l'accueil (`App.tsx`) quand le bouton principal propose Bambou | +209 o gzip de JS initial | déplacé dans le carrousel et la fin de partie (morceaux à la demande) |
| `useDemandesAmis` avec sa propre fraîcheur | +≈ 130 o de JS initial | fusionné dans la lecture de « À faire » (−24 o au total) |
