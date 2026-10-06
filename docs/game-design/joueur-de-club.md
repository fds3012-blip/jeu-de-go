# Joueur de club : réglages, statistiques, étude (#365, #368, #372)

Décision de Florian du 05/10 : donner de la profondeur au joueur de club (second cercle, J7), sans rien retirer au débutant. Tout est rangé dans le Profil, chargé à la demande.

## #365 Réglages du plateau et du rythme

Profil › Réglages, un seul écran qui défile, groupé par titres. Un aperçu du goban (9 × 9, six coups) en tête montre le thème, les coordonnées, le dernier coup et les numéros.

| Réglage | Clé (`go.settings.v1`) | Défaut | Effet |
|---|---|---|---|
| Coordonnées | `coordonnees` | oui | Lettres A à T sans I, lignes depuis le bas, autour du goban des parties (ordi, en ligne, entre amis), de la revue et de l'étude. Les leçons et les problèmes gardent toujours leurs coordonnées (leurs textes en parlent). |
| Dernier coup marqué | `dernierCoup` | oui | Rond sur la dernière pierre, mêmes écrans. |
| Numéros des coups | `numerosRevue` | non | Dans la revue (et la variante de l'étude) : numéro du coup sur chaque pierre ; le dernier coup est alors cerclé autour de la pierre. Chiffres clairs sur les noires, foncés sur les blanches. |
| Temps de jeu en ligne | `cadence` | `normale` (10 min) | Temps proposé d'abord dans « Jouer en ligne ». « Normale » reste la file par défaut (#436). |
| Montrer la série | `serieVisible` | oui | Éteint : ni flamme ni gels dans l'en-tête, ni annonce de série, ni « Garde ta série » dans « À faire », ni série sur la réussite du Go du jour et dans son partage, ni record ni badge « 7 jours » dans le Profil. La série continue d'être comptée. |

Réglages gardés sur l'appareil ; avec un compte, synchronisés entre ses appareils depuis #448 (table `reglages_compte`, lisible par son seul propriétaire, plutôt qu'une colonne de `profiles`, lisible par tous ; écrite par la fonction `enregistrer_reglages`, liste blanche de clés et de valeurs, « dernier changement gagne » clé par clé : `supabase/migrations/20261006123100_reglages_compte.sql`).

Le goban partagé (`src/ui/Board.tsx`) reçoit deux options désactivées par défaut : `coordonnees` (vrai par défaut) et `numeros` (absent par défaut). Les écrans lisent les préférences par `usePreferences()` (`src/app/settings.ts`), sans prop à faire descendre.

## #368 Mes statistiques (recadrée après #417)

Profil › « Statistiques » (moitié de la ligne des Réglages : le Profil tient toujours sans défiler en 390 × 844). Une seule action principale : « Revoir une partie » (ouvre Mes parties ; la revue avec KataGo nourrit les chiffres).

Retiré de l'issue depuis #417 : le « niveau estimé » recalculé côté client (formule douce, historique d'estimations, migration). La cote Glicko calculée par le serveur le remplace ; aucune nouvelle table.

| Bloc | Source | Règle |
|---|---|---|
| Ta cote | `profiles.rating`, `rating_history` (types `game` et `depart`, RLS) | Courbe sur 90 jours, bornes écrites, phrase pour le lecteur d'écran. Sans compte : une phrase. Jamais `puzzle` (#137). |
| Précision moyenne | revues avec KataGo gardées sur l'appareil (`go.stats.revues.v1`, 50 au plus) | Moyenne des 20 dernières revues, précision honnête de la revue (`precisionHonnete`). Une partie revue deux fois compte une fois. |
| Erreurs par phase | mêmes revues | Erreurs = notes Erreur, Coup manqué, Gaffe du joueur. Ouverture : coups 1 à ⌊taille²/7⌉ (12, 24, 52) ; fin de partie (yose) : dernier quart des coups, jamais avant la fin de l'ouverture ; milieu entre les deux. Moyenne par partie. |
| Bilan | historique de l'appareil, parties du compte, défis entre amis, parties classées (`rating_history.ecart`, taille lue dans `games`) | Victoires, défaites et part gagnée, par taille et par mode (contre l'IA, avec Mochi, entre amis, en ligne classées). Parties à deux et importées exclues. |

Mochi dit en une phrase où le joueur perd le plus (phase à au moins 0,5 erreur par partie), sinon sa précision, sinon l'invite à revoir une partie.

## #372 Étudier une position

Profil › Mes parties › « Étudier une position » (sous « Analyser une partie jouée ailleurs »). Goban 9, 13 ou 19 ; outils Noir, Blanc, Effacer, Jouer (44 px) ; « Au trait » ; « Annuler » ; « Revenir » (efface la variante, la position de départ reste intacte). Action principale : « Analyser ».

- Position posée : légale (une pierre qui laisserait un groupe sans liberté est refusée, rien n'est capturé en posant).
- Variante : une seule branche, jouée avec les règles (prises, ko, suicide), numérotée sur les pierres.
- Analyse : `analyseEtude` (`src/engine/index.ts`), KataGo seulement, une recherche par geste (96 visites). Trois meilleurs coups au plus en pierres vertes avec leurs chances de gain, filtrés par `conseilFiable` (jamais un coup illégal ni un coup de première ligne sans raison), et qui mène. Sans KataGo en cache : « Télécharge l'IA pour analyser » (3,8 Mo, une fois), aucun conseil.
- Gardée sur l'appareil (`go.etude.v1`, en SGF) ; export SGF (AB, AW, PL, coups) relu par l'import.

Reste à faire : « Partager » l'étude (réutiliser le partage de partie de #364 quand il sera fusionné), komi réglable, arbre de variantes à plusieurs branches.

## Mesure

`reglage_change`, `statistiques_ouvertes`, `etude_ouverte`, `analyse_demandee` : voir `docs/data/plan-de-marquage.md`.
