# Inventaire de la version anglaise (#473, 8 octobre 2026)

État de l'anglais de Mochi Go sur `main` (après #466, #469, #470, #471, #472), ce que #473 a traduit ou corrigé, et
ce qui reste. Chiffres comptés par script dans le dépôt (et par une lecture seule de la table `puzzles`).

## Résumé

| Domaine | Textes français | En anglais avant #473 | Après #473 | Où |
|---|---|---|---|---|
| Interface, catalogue principal | 1 496 clés | 1 495 | 1 496 | `src/content/i18n/fr.ts`, `frEcrans.ts`, `en.ts` |
| Interface, catalogues à part (amis, club, cote, direct, émulation, parties lentes, partage, sécurité) | 542 clés | 542 | 542 | `src/content/i18n/*.ts` |
| Refus du serveur (`game-action`) | 25 codes + 1 message générique | 12 (défis seulement) | 26 | `src/content/i18n/refus.ts` (nouveau) |
| Leçons (35, l1 à l36 sans l28) | 166 étapes, 515 textes | 515 | 515 | `content/lessons.fr.js`, `content/lessons.en.js` |
| Chapitres | 6 | 6 | 6 | idem |
| Phrases de fin de leçon (« ce que tu sais faire ») | 35 | 35 | 35 | `src/content/acquis.ts`, clés `acquis.*` |
| Problèmes (231, autant que la table `puzzles`) | 912 textes | 912 | 912 | `src/content/puzzles.ts`, `lots/`, `problemes.en.ts` |
| Mochi : coach en partie, bilan, conseils, répliques, revue | (dans le catalogue) | tout | tout | clés `coach.*`, `bilan.*`, `conseil.*`, `replique.*`, `revue.*`, `cle.*` |
| Rappels du Go du jour (notifications) | 4 | 4 | 4 | `supabase/functions/envoyer-rappels/logique.ts` |
| E-mails de connexion (3 modèles + 3 objets) | 6 | 0 | 6 | `supabase/auth/modeles/*.html`, `reglages.json` |
| Manifeste de la PWA, description de la page | 2 | 0 | 2 | `public/manifest.en.webmanifest`, clé `meta.description` |
| Pages de référencement | 2 pages | 2 pages | 2 pages | `outils/referencement` (#472) |
| Fiches des stores | v2 | v2, dépassée | v3 | `docs/marketing/fiches-stores.md` |
| Glossaire | | leçons 1 à 8, problèmes | + leçons 9 à 36, écrans récents | `docs/localisation/glossaire.md` |

Total interface : 2 064 textes (1 496 + 542 + 26), plus 1 427 textes de contenu (leçons et problèmes). Aucun texte
anglais vide, aucun resté en français, aucune clé d'un côté sans l'autre (test ci-dessous).

## Ce qui n'était pas traduit (et l'est maintenant)

1. **Refus du serveur.** La fonction `game-action` répond un code et un message en français. Les défis traduisaient
   12 codes ; les parties en direct et les parties lentes (`src/data/games.ts`) affichaient le message français tel
   quel (« Coup interdit : cette position s'est déjà produite (superko). », « La partie a changé entre-temps… »).
   Désormais l’app traduit les 25 codes émis (plus un message générique) (`src/content/i18n/refus.ts`) ; en français, le message du serveur reste
   identique. **Aucune fonction Edge modifiée.**
2. **E-mails de connexion** (code à 6 chiffres, création de compte, « Garde ta partie ») et leurs objets : français
   seulement. Ils ont maintenant une branche anglaise, choisie par `user_metadata.langue` (envoyé à la création du
   compte, tenu à jour à l'ouverture connectée). Comptes sans `langue` : français, comme avant.
   **S'applique en production à la fusion** (workflow `config-auth.yml`, #414).
3. **Manifeste et description de la page** : en français pour tout le monde. Un joueur en anglais installe maintenant
   « Mochi Go: learn and play Go ».
4. **Fiches des stores** : la fiche anglaise v2 disait « 7 lessons », « over 100 puzzles », « play without creating an
   account » (faux depuis #343) et ne devait pas être publiée tant que l'interface était en français. v3 recomptée,
   française et anglaise ; la fiche anglaise est publiable.
5. **Glossaire** : complété des termes des leçons 9 à 36 (tiger's mouth, bamboo joint, watari, shortage of liberties…)
   et des écrans récents (coach, révisions, thèmes, Rush, correspondence game).

## Ce qui était déjà traduit, et vérifié

- **Écrans** : tous passent par `t()` ; `Catalogue` impose les mêmes clés en anglais. 52 textes anglais sont identiques
  au français, tous légitimes (Atari, Seki, Komi, Tesuji, Kaya, Version {v}, « 5 min »…).
- **Leçons 1 à 36** : relues sur l'ensemble ; vocabulaire conforme au glossaire, 12 mots par consigne, nombres et
  coordonnées identiques (tests existants). Positions, réponses et preuves inchangées (aucune modification de contenu).
- **Problèmes** : 231 sur 231 (la table `puzzles` en compte 231, tous publics, mêmes identifiants).
- **Mochi** : coach #470 (atari, un seul œil, prise ratée, coin libre), bilan, conseils, revue, répliques.
- **Rappels** : 4 textes anglais, choisis par la langue de l'abonnement.

## Test ajouté

`src/content/anglais-complet.test.ts` (37 tests) échoue si :
- une clé française n'a pas d'anglais, ou une clé anglaise n'a pas de français, dans **tous** les catalogues (le
  principal et les 9 catalogues à part, refus compris) ;
- un texte anglais est vide, n'a pas les mêmes variables ou la même forme (texte / pluriel), contient un accent
  français, ou recopie le français (hors mots invariables du glossaire) ;
- une leçon, un chapitre, une phrase de fin de leçon ou un problème n'a pas son anglais, ou l'inverse ;
- un code de refus émis par le serveur n'a pas son anglais, ou le français du catalogue s'écarte du message du serveur ;
- les rappels n'ont pas autant de textes dans les deux langues.

`scripts/config-auth.test.mjs` vérifie en plus que chaque e-mail et chaque objet a ses deux branches, avec le code.

## Captures et débordements

- `e2e/anglais-ecrans.spec.ts` (nouveau) : accueil, partie avec la bulle du coach, comptage, bilan, Apprendre, leçon,
  Problèmes, problème, Profil, Réglages, en anglais, à 390 et 320 px, sombre et clair. Aucun défilement horizontal,
  aucun texte hors de l'écran, aucun texte coupé. 40 captures (hors dépôt).
- Audit visuel complet en anglais (`e2e/audit-visuel.spec.ts`, 126 écrans par largeur, 390 × 844 et 320 × 568, sombre
  et clair) : aucun défilement, aucun texte coupé, aucun texte hors écran. Une étape échoue en anglais comme en
  français (28c, liste des défis : le sélecteur cherche « Partie du / Game of », la ligne affiche maintenant le pseudo
  de l'ami) : sélecteur de test à mettre à jour, l'écran est correct.
- Specs existantes repassées : `langue.spec.ts`, `langue-parcours.spec.ts`, `anglais-a-la-demande.spec.ts`,
  `coach-mochi.spec.ts`.

## Budget

`node scripts/budget-bundle.mjs` : JS initial 160,3 Ko / 175 Ko, CSS 24,7 Ko / 26 Ko. Les textes anglais restent dans
le morceau `anglaisContenu` chargé à la demande ; les refus arrivent avec l'écran de partie en ligne. Seule la clé
`meta.description` (une phrase) entre dans le JS initial.

## Ce qui reste

1. **Relecture par un anglophone natif** : interface (2 064 textes), 35 leçons et 231 problèmes. Points à trancher
   dans le glossaire (« À signaler »), dont *review* pour la revue et pour les révisions.
2. **Fiches stores** : à copier dans App Store Connect et la Play Console (rien n'est publié par le dépôt). Captures
   anglaises des stores à produire : `e2e/captures-stores.spec.ts` ne joue que le français (ses aides cherchent des
   libellés français).
3. **Aperçus des liens partagés et balises Open Graph** de `index.html` : en français (les robots ne lisent pas le JS).
   Les pages `/en/j/N`, `/en/defi`, `/en/partie` ont leur aperçu anglais (#285) ; la page d'accueil `/en` non.
4. **Noms des adversaires** (Pomme, Caillou…) : gardés en français comme des prénoms ; décision avec le design.
5. **Coréen, japonais, chinois** : après relecture de l'anglais (même socle : `Langue`, catalogues, contenus).
6. **Textes français ambigus** signalés dans le glossaire (n03, n13, n14, c4, d05, d10, d12, k01, q03, r04) :
   à reprendre par l'agent pédagogie.

## Recouvrements avec d'autres périmètres

- `src/data/games.ts`, `src/data/defi.ts` (en ligne) : affichage des refus, comportement français inchangé.
- `src/data/account.ts`, `src/data/reglages.ts` (compte) : langue envoyée dans `user_metadata` ; un appel
  `updateUser` de plus à l'ouverture connectée, seulement si la langue a changé.
- `supabase/auth` (connexion, #414) : modèles et objets bilingues, appliqués en production à la fusion.
- `docs/marketing/fiches-stores.md` (marketing) : v3, chiffres et promesse du compte corrigés aussi en français.
- Aucune migration, aucune fonction Edge modifiée.
