# Parcours du nouveau joueur — octobre 2026 (#559)

Rejoué comme Florian : un nouveau joueur, sur iPhone, en navigation privée (stockage vide au départ). Branche `qa-nouveau-559`, partie de `main` à `3f4b619` (#554).

Build `VITE_E2E=1`, servi par `vite preview --port 4759`, Chromium de `/opt/pw-browsers` (viewport iPhone, écran tactile, mouvements réduits). Supabase simulé par `e2e/fauxSupabase.ts` pour l'essai limité et le compte ; sans service de compte ailleurs. Chaque écran a été capturé en **390 × 844** et **320 × 568**, **sombre et clair**, en français ; en **320 × 568 anglais** (`go.langue.v1 = "en"`) pour les parcours dont les aides de test parlent anglais (étapes 1 à 5 et 7) : 3 configurations × 2 thèmes, 448 captures relues.

Captures gardées dans le dépôt (`docs/qa/captures/parcours-nouveau/`, 41 fichiers, ≈ 1,1 Mo) : le **jeu de référence du parcours en 390 × 844, clair, français** (une capture par écran clé, `NN-ecran-390-clair-fr.jpg`), plus **chaque capture citée dans le tableau des défauts** et les 4 captures `avant-*` des défauts corrigés. Le jeu complet (320 × 568, sombre, anglais) se régénère avec `e2e/parcours-nouveau-559.spec.ts`.

Script : `e2e/parcours-nouveau-559.spec.ts` (lancement manuel : `PARCOURS_559=<dossier des mesures> PW_PORT=4759 npx playwright test parcours-nouveau-559 --workers 1`). À chaque capture, `e2e/mesures.ts` mesure le défilement horizontal, les cibles sous 44 px, le contraste de chaque texte visible, les textes coupés, les éléments hors écran et le nombre d'actions principales ; les erreurs JavaScript sont relevées. Chaque capture est ensuite relue à l'œil (checklist `mobile-pro-rules` : icônes, retour tactile, contraste des deux thèmes, zones sûres, états vides, erreurs, chargement).

Gravité : **1** bloque ou fait fuir · **2** gêne nette, à corriger avant diffusion large · **3** finition visible · **4** détail.

## Verdict

**Aucun parcours clé cassé : pas de blocage de mise en production.** Les 8 parcours demandés passent de bout en bout en 390 × 844 et 320 × 568, clair et sombre, sans erreur JavaScript, sans défilement de côté, sans texte sous AA (hors un faux positif sur le bois du plateau), avec une seule action principale par écran.

**3 défauts corrigés ici** (1 de gravité 2, 2 de gravité 3), chacun avec un test qui échouait avant et passe après. **6 défauts laissés ouverts** (gravité 3 et 4), avec la raison.

## Parcours joués

| # | Parcours | 390 fr | 320 fr | 320 en | Résultat |
|---|---|---|---|---|---|
| 1 | Premier lancement : « Tu connais le go ? » avec le bandeau de consentement, puis seule ; « Un peu » (rappel express, « Je sais ») ; « Jamais joué » | ✓ | ✓ | ✓ | OK |
| 2 | Les règles en 8 gestes (mauvais geste puis bon geste à chaque écran), « Tu connais les règles ! », découverte avec Mochi jusqu'au comptage et à « Victoire ! », retour à l'accueil | ✓ | ✓ | jusqu'au groupe mort | OK (P-2 corrigé) |
| 3 | « Je sais jouer » → accueil épuré → « Je sais déjà jouer » : 3 problèmes (un raté, deux réussis), « Tu es environ 19 kyu. », « Joue contre Pomme » | ✓ | ✓ | ✓ | OK |
| 4 | Accueil : une action ; Apprendre ; leçon 1 étape par étape (une erreur douce) ; « Leçon terminée » ; retour au chemin puis à l'accueil (flamme 1, Pomme change de phrase) | ✓ | ✓ | ✓ | OK (P-2 corrigé) |
| 5 | Go du jour : raté (A1), indice, « Voir pourquoi » (réfutation #549/#554 : « Blanc se relie en E5… »), « Voir la réponse », rejoué → « vu, pas réussi » ; puis réussi sur un autre appareil (+40 XP, série 1), tuile « Réussi », série « Capturer » avec sa barre de maîtrise | ✓ | ✓ | ✓ | OK |
| 6 | Pomme jusqu'au score (`?komi=-100` : « Victoire de 100 points » vient de là), écran de fin (« Défier Caillou »), revue sans KataGo, revue avec KataGo factice et « Rejouer mes erreurs (2) » | ✓ | ✓ | — | OK (P-1 corrigé) |
| 7 | 3ᵉ partie d'essai (abandon) → 4ᵉ partie → « Crée ton compte » (erreurs du formulaire) ; Profil ; Conditions ; Mentions légales ; Aide › Questions › « Ton avis sur Mochi Go » (erreur « Choisis une réponse ») ; « Partager » du Profil (« Lien copié ») ; accueil hors ligne (#538) | ✓ | ✓ | ✓ | OK |
| 8 | Partie à deux : 14 coups, deux passes, « Valider le score », « Blanc gagne », fête « Niveau 2 ! », puis « Rejouer » | ✓ | ✓ | — | **Bug reproduit et corrigé (P-0)** |

## Défauts trouvés

| # | Écran | Taille | Thème | Gravité | Capture | Corrigé |
|---|---|---|---|---|---|---|
| P-0 | Partie à deux, « Rejouer » depuis l'écran de fin : la fête « Niveau 2 ! » reste posée sur le plateau de la partie suivante (et toute fête en attente s'y poserait) ; `partieFinie` restait à vrai dans `App.tsx`. | 390, 320 | les deux | **2** | `avant-08d-rejouer-plateau-390-clair-fr.jpg` → `08d-rejouer-plateau-390-clair-fr.jpg` | **Oui** : `Game.onRestart` (« Rejouer » et « Rejouer d'ici ») remet `partieFinie` à faux ; la partie redevient un exercice, la fête s'efface. Test `e2e/rejouer-fete-559.spec.ts`. |
| P-1 | Revue sans KataGo : la case de précision coupe « 100 % » sur deux lignes (« 100 » / « % »), seule case de l'écran à deux lignes. | 390, 320 | les deux | 3 | `avant-06f-revue-bilan-390-clair-fr.jpg` → `06f-revue-bilan-390-clair-fr.jpg` | **Oui** : `white-space: nowrap` sur `.bilan-score` (`revue.css`). Test P-1 de `e2e/parcours-nouveau-559-correctifs.spec.ts`. |
| P-2 | Règles en 8 gestes et leçon 1, après le geste : « Revoir » (lien sous « Continuer ») à moitié sous la barre du bas (21 px cachés sur 44), sans possibilité de défiler. Le bloc `.lecon-actions` se tassait à sa hauteur minimale (celle du seul bouton) et « Revoir » débordait dans la réserve de la barre. | 320 | les deux | 3 | `avant-02c-regles-1-fait-320-clair-fr.jpg`, `avant-04d-lecon1-etape1-faite-320-clair-fr.jpg` → `02c-regles-1-fait-320-clair-fr.jpg`, `04d-lecon1-etape1-faite-320-clair-fr.jpg` | **Oui** : `flex: none` sur `.lecon-actions` (`lecon.css`, feuille chargée avec la leçon) : le plateau cède d'abord (plancher 200 px), puis la page défile (#458). « Continuer » reste visible sans défiler. Tests P-2 et P-2 bis. |
| O-1 | Revue sans KataGo, thème clair : la courbe d'avantage est une bande grise vide, sans légende ni mot (le texte « KataGo n'a pas pu se télécharger » est 300 px plus bas). Déjà relevé le 02/10 (n° 4). | 390, 320 | clair surtout | 3 | `06f-revue-bilan-390-clair-fr.jpg` | Non : demande une refonte du bloc (état vide dessiné, légende « Qui mène, coup par coup ») dans `Revue.tsx` + CSS initial. Propriétaire : revue. |
| O-2 | Création de compte : « Entre une adresse e-mail valide. » s'affiche sous « Tu as moins de 15 ans ? » et « Lire les conditions », à 180 px du champ en faute. Déjà relevé le 02/10 (n° 10). | 390, 320 | les deux | 3 | `07e-creer-compte-erreur-390-clair-fr.jpg` | Non : le même paragraphe porte l'erreur du champ et celle de la case ; séparer les deux touche `CreerCompte.tsx` et son test unitaire (périmètre compte). |
| O-3 | Écran de fin après un abandon : « Rejouer contre Pomme » tient sur deux lignes dans le bouton principal. | 320 | les deux | 4 | `07b-abandon-3e-partie-320-clair-fr.jpg` | Non : libellé de produit (« Rejouer » tout court contre un adversaire déjà nommé au-dessus ?) à décider ; un raccourci CSS ferait un bouton différent des autres. |
| O-4 | Accueil complet (après la découverte ou la leçon 1) : « Je sais déjà jouer » affleure la barre du bas au premier affichage ; il faut défiler de quelques pixels. L'action principale, elle, est entière à l'écran. | 320 | les deux | 4 | `02p-accueil-apres-decouverte-320-clair-fr.jpg`, `04i-accueil-apres-lecon-320-clair-fr.jpg` | Non : la page défile normalement (vérifié par `boutons-non-recouverts`) ; gagner 20 px demanderait de réduire le plateau d'accueil en 320 (CSS initial). |
| O-5 | Mentions légales : les liens « vercel.com » et « supabase.com » font 24 px de haut. Liens dans une phrase (exception WCAG 2.5.8), lisibles et espacés. | 390, 320 | les deux | 4 | `07h-mentions-legales-390-clair-fr.jpg` | Non : conforme ; un bouton de 44 px au milieu d'un paragraphe serait pire. |
| O-7 | Anglais, 320 : « Your feedback on Mochi Go » (titre du formulaire d'avis) passe sur deux lignes à côté de « Back » ; en 390 il tient. Lisible, rien de coupé. | 320 en | les deux | 4 | `07k-ton-avis-320-clair-en.jpg` | Non : un titre plus court (« Your feedback ») est un choix de texte ; parité fr/en à garder. |
| O-6 | « Ton avis sur Mochi Go » : les boutons radio mesurent 22 px. La ligne entière (`label.retours-choix`, 44 px) est la cible, vérifiée par `venir-jouer.spec.ts`. | 390, 320 | les deux | 4 | `07k-ton-avis-390-clair-fr.jpg` | Non : faux positif de la mesure (l'`input` seul est mesuré). |

Constats sans défaut (relus pour ne pas les confondre avec des bugs) :
- Règles en 8 gestes, anglais 320 (`02c-regles-1-fait-320-clair-en.jpg`) : la bulle de Mochi fait 5 lignes, « Review » commence sous la barre au premier affichage, mais la page défile maintenant (correctif P-2) et le lien est entier après un défilement ; « Continue » reste visible sans défiler.
- « Victoire de 100 points », « −100 komi pour Pomme » : paramètre de test `?komi=-100` pour finir la partie vite.
- Le contraste 2,48 relevé sur « 4 » et « 1 » (compteur de libertés posé sur le bois du plateau) : fond incertain pour la mesure, pastille jade à texte blanc lisible à l'œil, non-texte au sens WCAG.
- La fête « Niveau 2 ! » sur l'écran de fin (`08c-fin-a-deux-fete-390-clair-fr.jpg`) couvre le haut du plateau estompé : c'est sa place (#544).
- Le « 2 » de la fête mesuré à 1,1 : chiffre blanc sur la pierre noire (image de fond), lisible.
- Écrans chargés à la demande (Apprendre, Profil, Problèmes) : le contenu arrive en 180 à 250 ms en local ; pendant ce temps, l'en-tête seul. Rien à voir à l'œil nu ici ; sur un réseau lent, un squelette serait mieux qu'un vide (à discuter, pas mesuré sur un vrai réseau).

## Ce qui va bien (à garder)

- Première ouverture : la question et le bandeau de consentement tiennent ensemble même en 320 × 568 ; trois réponses de même poids, « Plus tard » en lien.
- Les 8 gestes : chaque mauvais geste a une aide d'une phrase, le bon geste donne « Continuer » ; les mots du go (liberté, atari, ko, komi, territoire) sont expliqués à leur première apparition.
- Découverte : « 1 / 15 notions », une bulle courte à chaque moment, « Passer » n'apparaît que quand il faut ; la fin donne +50 XP et ramène à l'accueil.
- Accueil : une seule action en relief, lisible en 3 secondes (« Joue ta première partie »), Pomme présentée en une phrase.
- Go du jour : la réfutation jouée sur le plateau avec sa phrase (« Blanc se relie en E5. Le groupe marqué a 5 libertés. »), puis la réponse coup par coup ; « vu, pas réussi » dit clairement ; la barre de maîtrise par thème se lit sous chaque vignette.
- Fin de partie : sceau tamponné « BATTUE », bilan, Mochi, une action ; « Revoir ma partie » et « Accueil » en liens.
- Compte, mentions légales, avis, partage, hors ligne : textes courts, tutoiement, erreurs de formulaire en rouge sous la question ; hors ligne, « En ligne » et « Un ami » disent « Il faut internet ».

## Ce que je n'ai pas pu vérifier

- Un vrai iPhone (Safari) : zones sûres, feuille de partage native, retour haptique, clavier qui masque un champ, installation sur l'écran d'accueil. Ici : Chromium à la taille d'un iPhone, partage simulé (« Lien copié »).
- L'analyse KataGo réelle de la revue et « Rejouer mes erreurs » : moteur factice (`e2e/revueFactice.ts`) ; la revue sans KataGo est la vraie (téléchargement refusé hors ligne).
- Le compte réel (e-mail, code) et une partie en ligne entre deux comptes : Supabase simulé ; le parcours « Crée ton compte » s'arrête à l'écran et à ses erreurs.
- L'anglais pour la partie contre Pomme jusqu'au score, la revue et la partie à deux (étapes 6 et 8) : les aides de test du plateau (`passer`, `partieADeux`, `passerJusquAuScore`) parlent français ; ces écrans sont couverts en anglais par `e2e/anglais-ecrans.spec.ts`.
- Le mode hors ligne au-delà de l'accueil (déjà couvert par `e2e/hors-ligne-clair.spec.ts`).
- Le lecteur d'écran (VoiceOver) : seuls les rôles et noms vérifiés par axe (`e2e/a11y-axe.spec.ts`, vert).

## Filets de sécurité relancés

- `npx playwright test e2e/a11y-axe.spec.ts` : vert.
- `npx playwright test e2e/boutons-non-recouverts.spec.ts` : vert.
- `npx playwright test e2e/lecon-lecteur.spec.ts e2e/fete-niveau-fin-partie.spec.ts` (écrans touchés) : vert.
- `npx tsc -b`, `npm run lint` (0 erreur), `npx vitest run` (282 fichiers), `node scripts/budget-bundle.mjs` : verts.
