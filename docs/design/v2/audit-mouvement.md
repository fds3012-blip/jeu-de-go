# Audit du mouvement (issue #60)

Référence : skills `improve-animations` (AUDIT.md), `review-animations` (STANDARDS.md) et `animate`.
Règles appliquées : on n'anime que `transform` et `opacity` ; ease-out pour les entrées et sorties, jamais de ease-in sur une interaction ; moins de 300 ms pour l'interface ; `:active` entre 100 et 160 ms ; transitions (interruptibles) plutôt que keyframes pour ce qui se répète ; pas de `will-change` inutile ; `prefers-reduced-motion` respecté partout.

Méthode : recherche de `@keyframes`, `transition`, `animation`, `requestAnimationFrame`, `will-change`, `:hover` et `prefers-reduced-motion` dans `src/`.

## Ce qui est déjà conforme

- **Mouvements réduits** : toutes les animations CSS sont sous `@media (prefers-reduced-motion: no-preference)`. En mode réduit, les jetons de durée passent à 0 ms (`tokens.css`), les pierres prises disparaissent sans animation (`board.css`), la fenêtre de consentement garde un simple fondu de 150 ms, l'indicateur « Reflexion » passe d'une orbite à un clignotement d'opacité, les confettis ne sont ni montés ni calculés (`Confettis.tsx` ne rend rien et appelle seulement `onFin`, en plus des gardes de `FinPartie.tsx`, `Puzzles.tsx` et `Learn.tsx`), le défilement de l'écart et le défilement de page sont instantanés (`defilement.ts`, `Defile.tsx`), et le minutage de la leçon est ramené à 0 (`Learn.tsx`).
- **Boutons en relief** (`app.css`, `accueil.css`, `apprendre.css`, `fin.css`) : `:active` en `transform` seulement (enfoncement de la tranche, `scale(.98)` pour les secondaires), transition de 100 ms avec la courbe de sortie des jetons, donc interruptible. En mode réduit, l'appui se voit à la couleur.
- **Fenêtre de consentement** (`profil.css`) : `@starting-style` + transition (interruptible), 200 ms, `scale(.96)` et non `scale(0)`, centrée (exemptée de l'origine au déclencheur).
- **Goban** : pose de la pierre en 140 ms (léger rebond, `transform` seulement), pierre fantôme sans animation (elle suit le doigt ou la souris, ce qui est correct pour une action répétée des centaines de fois), tremblement du coup interdit en 300 ms ease-in-out (mouvement sur place, courbe correcte).
- **Onglets** (`nav.css`) : 160 ms, `transform` seulement.
- **Fin de partie** (`fin.css`, `Confettis.tsx`) : moment rare, orchestré (feuille 240 ms, tampon 280 ms, coup du sceau 180 ms ease-out). Les confettis sont dessinés dans un canvas, la boucle `requestAnimationFrame` est annulée au démontage.
- **Aucun `will-change`**, aucun `transition: all`, aucune règle `:hover` qui déplace un élément.

## Écarts trouvés

| Gravité | Où | Écart | État |
| --- | --- | --- | --- |
| Haute | `board.css`, `.partante` | Pierres prises : courbe `cubic-bezier(.4, 0, .7, .2)`, un ease-in, sur la réponse directe à un coup du joueur. La prise démarre lentement au moment même où on la regarde. | Corrigé : `var(--ease)` (ease-out), 220 ms inchangés. |
| Haute | `board.css`, `.partante.vers-couvercle` | Pierres qui glissent vers le couvercle : ease-in `cubic-bezier(.5, 0, .75, .4)` et 340 ms, au-dessus des 300 ms. | Corrigé : `var(--ease)`, 280 ms. Le nettoyage JS (`Board.tsx`, 380 ms + 30 ms par pierre) reste plus long que l'animation. |
| Moyenne | `partie.css`, `.avantage-barre i` | La barre d'avantage animait `width` (recalcul de mise en page à chaque image) pendant 500 ms. | Corrigé : la portion noire fait toute la largeur et glisse en `translateX` (`Partie.tsx`), transition `transform` de 300 ms. Rendu identique grâce à `overflow: hidden`. |
| Moyenne | `partie.css`, `.couvercle.plein` | Pulsation du couvercle en 360 ms, au-dessus des 300 ms pour un retour d'interface. | Corrigé : 240 ms. |
| Basse | `board.css`, `.drop` | Courbe de pose écrite en dur alors que le jeton `--ease-pose` existe (même valeur). | Corrigé : `var(--ease-pose)`. |
| Basse | `apprendre.css`, `.marque .trait` | `stroke-dashoffset` animé (repeint, hors `transform`/`opacity`). Tracé SVG minuscule, 340 ms, une fois par réponse. | Laissé : c'est le seul moyen de « dessiner » le trait, coût négligeable. |
| Basse | `apprendre.css`, `.fin-sceau` | 360 ms avec dépassement. | Laissé : célébration rare de fin de leçon, la règle autorise plus long. |
| Basse | `accueil.css`, `.feuille[open]` | Entrée en `@keyframes` (non interruptible) et pas d'animation de sortie. | Corrigé (#62) : `@starting-style` + transition (200 ms, interruptible), sortie de 160 ms ease-out ; en mouvements réduits, simple fondu de 150 ms sans glissement. |
| Basse | `nav.css`, `nav-point` | Le point de l'onglet part de `scale(.4)`, plus bas que 0,9–0,97. | Corrigé (#62) : part de `scale(.8)`. |
| Basse | `apprendre.css` / `Confettis.tsx` | En mode réduit, les confettis de fin de leçon sont masqués en CSS mais la boucle canvas tourne quand même 1,5 s. | Corrigé (#62) : `Confettis` ne rend rien et ne lance aucune boucle en mode réduit (il appelle seulement `onFin`) ; la règle CSS de masquage est retirée. Test : `Confettis.test.tsx`. |
| Basse | `apprendre.css`, `.etapes span` | Transition de couleur de 300 ms. | Laissé : couleur seule, en limite haute, conforme. |

## Ce qui reste

1. Vérifier au téléphone la nouvelle courbe des prises vers les couvercles (glissement plus vif au départ).

## Vérifications

- `npm run lint` et `npm run typecheck` : sans erreur.
- `npm test` : 389 tests passés, 2 ignorés.
- `npm run build` : construit.
- `PW_PORT=4322 npx playwright test` : 45 passés.
- Capture 390 × 844 de l'écran de partie en clair et en sombre : la barre d'avantage s'affiche comme avant (coins arrondis, portion noire coupée net), sans défilement horizontal.
