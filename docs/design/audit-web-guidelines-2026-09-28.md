# Audit Web Interface Guidelines : écran de partie et écran Problèmes

Date : 28/09/2026. Branche : `audit-wig` (depuis `origin/skills-design-2`). Revue seulement : aucun code modifié.

## Méthode

- Skill appliquée : `web-design-guidelines` (vercel-labs).
- Règles récupérées avec WebFetch le 28/09 : `https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md`. Le réseau a répondu. La partie « Design Audit » de `redesign-skill` n'a donc pas servi de repli.
- Fichiers lus :
  - partie : `src/app/Game.tsx`, `src/ui/partie.css`, `src/ui/Board.tsx` ;
  - Problèmes : `src/app/Puzzles.tsx`, `src/ui/apprendre.css`, `src/ui/Lecteur.tsx`.
- Vérifiés en appui : `index.html`, `src/ui/app.css`, `src/ui/board.css`, `src/ui/nav.css`, `src/ui/tokens.css`, `src/content/i18n/fr.ts`.
- Gravité : 0 = cosmétique, 1 = mineur, 2 = gêne réelle pour certains joueurs, 3 = perte de travail ou blocage, 4 = écran inutilisable.

## Écran de partie

### src/app/Game.tsx

- `src/app/Game.tsx:388` : gravité 3. Le bouton retour quitte la partie en cours sans prévenir. Un toucher par erreur efface la partie. La règle « Unsaved changes: warn before navigation » s'applique.
  Correction : si au moins un coup est joué, Mochi demande « Quitter la partie ? » avec deux choix, comme l'avertissement avant un passe (lignes 506 à 514). Autre voie : garder la partie en cours et la proposer à l'accueil.
- `src/app/Game.tsx:370` : gravité 2. « Abandonner » s'arme puis se désarme seul au bout de 3 s. Un joueur lent ou un lecteur d'écran n'a pas le temps de confirmer. Le passage à « Confirmer ? » n'est pas annoncé.
  Correction : pas de délai (le bouton reste armé jusqu'au prochain coup ou à un autre toucher). Annoncer le changement dans une zone `aria-live="polite"`.
- `src/app/Game.tsx:496` : gravité 2. La phrase « Qui mène ? » porte `role="status"`, mais `key` la recrée à chaque fois. Une zone live insérée avec son texte n'est souvent pas lue (VoiceOver, TalkBack).
  Correction : une zone `role="status"` permanente et vide, dont seul le texte change.
- `src/app/Game.tsx:388` : gravité 1. L'icône retour est le caractère « ‹ » en 30 px. Son rendu dépend de la police. Ailleurs, le retour est une icône SVG (`src/ui/Lecteur.tsx:9`).
  Correction : réutiliser le composant `Retour`.
- `src/app/Game.tsx:492` : gravité 1. Tant que l'estimation n'est pas prête, la barre d'avantage a un libellé vide (`''`). Le lecteur d'écran lit une barre sans texte.
  Correction : un libellé d'attente court, par exemple « Calcul… ».
- `src/app/Game.tsx:533` et `:534` : gravité 1. Deux boutons sans `type="button"`. Tous les autres en ont un. Sans effet aujourd'hui (pas de formulaire), mais incohérent.
  Correction : ajouter `type="button"`.

### src/ui/partie.css

- `src/ui/partie.css:44`, `:158` : gravité 1. Aucun état de survol (`:hover`) sur les boutons de la barre d'actions ni sur le retour. Sur ordinateur (PWA), rien ne répond sous la souris.
  Correction : `@media (hover: hover) { .actions button:not(:disabled):hover { background: var(--surface); } }`. Même chose pour `.joueur .retour`. Le modèle existe déjà dans `src/ui/profil.css:193`.
- `src/ui/partie.css:57`, `:71`, `:76`, `:95`, `:97` : gravité 1. Couleurs écrites en dur (`#2a211a`, `#6b4a28`, `#C9B597`, `#F3EDE3`, `#0f0e0d`). Elles sont voulues (papier, bois, encre, identiques dans les deux thèmes), mais elles échappent aux tokens.
  Correction : les nommer dans `src/ui/tokens.css` (`--papier-encre`, `--bois-couvercle`, `--pierre-noire`…), sans changer leur valeur.

### src/ui/Board.tsx

- ✓ Rien de bloquant. Voir « Ce qui est déjà bon ».
- `src/ui/Board.tsx:341` : gravité 0. Le plateau jouable n'a pas de style `:focus-visible` propre. Le curseur clavier dessiné (ligne 391) joue ce rôle. C'est acceptable. À vérifier seulement : le curseur doit rester visible sur les deux bois, en clair comme en sombre (contraste 3:1).

## Écran Problèmes

### src/app/Puzzles.tsx

- `src/app/Puzzles.tsx:290` : gravité 2. Le texte visible est « Continuer {titre} ». Le nom accessible est « Problème suivant : {titre} ». Le mot visible n'est pas dans le nom (WCAG 2.5.3). Un joueur en commande vocale qui dit « Continuer » n'est pas compris.
  Correction : supprimer `aria-label`, ou le faire commencer par le mot visible (« Continuer : {titre} »).
- `src/app/Puzzles.tsx:411` : gravité 1. Un `<div>` porte `onClick` (anti-motif listé). Il est masqué aux aides (`aria-hidden`) et doublé par le bouton de la ligne 418. Pas de blocage, mais la cible n'existe qu'à la souris et au doigt.
  Correction : garder le doublon, c'est voulu. Ajouter un commentaire qui le dit, pour qu'on ne le « corrige » pas en ajoutant un deuxième bouton focalisable.
- `src/app/Puzzles.tsx:249`, `:289`, `:304` : gravité 2. Ouvrir un problème ou la liste « Tous » ne change pas l'URL et n'ajoute rien à l'historique. Le geste retour d'Android quitte l'onglet Problèmes au lieu de fermer le problème. Règle : « URL reflects state ».
  Correction : `history.pushState` à l'ouverture, `popstate` pour fermer. À signaler : cela touche aussi `src/app/App.tsx`, hors de ce périmètre.

### src/ui/apprendre.css

- `src/ui/apprendre.css:185` : gravité 2. La feuille de verdict est fixe au-dessus de la barre de navigation. `scroll-padding-bottom` (`src/ui/nav.css:8`) ne compte que la barre. Au clavier, un élément qui prend le focus peut passer sous le verdict. Règle : « Overlays must not obscure focused elements ».
  Correction : quand le verdict est ouvert, réserver sa hauteur en bas de page (`padding-bottom` et `scroll-padding-bottom` sur `.app:has(.verdict)`).
- `src/ui/apprendre.css:295` : gravité 1. `cursor: pointer` sur l'aperçu du Go du jour, lié au `<div>` cliquable ci-dessus. Cohérent avec le choix. Pas d'action si on garde le doublon.
- `src/ui/apprendre.css:136`, `:362`, `:403` : gravité 1. Comme pour la partie : `:active` présent, `:hover` absent.
  Correction : même règle `@media (hover: hover)`.
- `src/ui/apprendre.css:225` : gravité 0. `outline: none` sur `.fin-titre:focus`. C'est un titre qui reçoit le focus par script (`tabIndex=-1`), pas une commande. Le retrait du contour est justifié. Rien à faire.

### src/ui/Lecteur.tsx

- ✓ pass. Retour avec `aria-label`, SVG décoratifs cachés (`aria-hidden`, `focusable="false"`), progression en `role="progressbar"` avec texte, verdict en zone `aria-live`.

## Ce qui est déjà bon

- Mouvements réduits : chaque animation est sous `prefers-reduced-motion: no-preference`. Les boucles (`respire`, `demo-atari`, pulsation de « Passer ») s'arrêtent. `gain-capture` est masqué en mode réduit.
- Animations sur `transform` et `opacity`. La barre d'avantage glisse en `transform` et non en `width` (audit #60). Aucun `transition: all`.
- `transform-box: fill-box` sur le drapeau SVG (`src/ui/apprendre.css:394`).
- Plateau accessible au clavier : grille ARIA, `aria-activedescendant`, flèches, Entrée et Espace, annonce `aria-live` des coups et de la confirmation au doigt (`src/ui/Board.tsx:233` à `:257`, `:341` à `:401`).
- Plateau : `touch-action: manipulation` et pas de sélection de texte (`src/ui/board.css:21`).
- Chiffres en `tabular-nums` : couvercles, liste des coups, barre d'avantage, cote, numéro du jour.
- Nombres formatés par `nombre` (i18n), pas à la main.
- Points de suspension typographiques « … » dans tous les états d'attente (`fr.ts`).
- Zones sûres (`env(safe-area-inset-*)`) et `100dvh` partout.
- `color-scheme` et deux `theme-color` (clair, sombre) dans `index.html`. Pas de `user-scalable=no`.
- Cibles de 44 px au minimum, y compris à 320 px (`src/ui/partie.css:170` à `:184`).
- Chargement en squelette (`aria-busy`), erreurs avec « Réessayer ».
- Actions destructrices protégées : abandon en deux temps, bouton Annuler.
- Une seule action principale par état : « Passer » en relief pendant la partie, « Valider le score » au comptage, le CTA du verdict dans les Problèmes.

## Règles écartées, et pourquoi

- **« Title Case for headings/buttons »** : contraire au français. `CLAUDE.md` impose le français d'abord ; la typographie française met une capitale au premier mot seulement. `direction.md` (ligne 146) a supprimé les majuscules d'étiquette.
- **« Curly quotes " " »** : en français, ce sont les guillemets « » avec espaces insécables. Déjà fait via `fr()`.
- **« & over "and" »** : pas d'usage en français courant. Contraire à « phrases courtes et claires » (`CLAUDE.md`, règle 5).
- **Formulaires (`autocomplete`, `inputmode`, placeholders)** : aucun champ sur ces deux écrans.
- **Images `width`/`height`, `loading="lazy"`, vidéos, GIF** : pas d'image bitmap. Le bois est une `<image>` SVG en data URL, mise en cache (`direction.md`, ligne 66).
- **Virtualisation des listes > 50 éléments** : la grille est découpée par palier. À revoir seulement si un palier dépasse 50 problèmes.
- **Hydratation (`suppressHydrationWarning`, dates)** : application Vite côté client, sans rendu serveur.
- **`redesign-skill` (polices Geist ou Satoshi, bruit, dégradés, photos de fond)** : non appliquée. Le README des skills interdit de changer de police sans décision du designer, et `direction.md` fixe l'univers « Encre et jade ».

## Les 5 corrections les plus rentables

1. **Confirmer avant de quitter une partie** (`src/app/Game.tsx:388`, gravité 3). Réutiliser la bulle de Mochi à deux choix déjà écrite pour le passe.
2. **Nom accessible du bouton « Continuer »** (`src/app/Puzzles.tsx:290`, gravité 2). Une ligne à supprimer.
3. **Abandon sans délai de 3 s, changement annoncé** (`src/app/Game.tsx:370`, gravité 2). Retirer le `setTimeout`, ajouter une zone live.
4. **Zone live permanente pour « Qui mène ? »** (`src/app/Game.tsx:496`, gravité 2). Sortir `role="status"` de l'élément recréé.
5. **Le verdict ne cache plus le focus** (`src/ui/apprendre.css:185`, gravité 2). Réserver sa hauteur avec `scroll-padding-bottom` quand il est ouvert.

À suivre ensuite : états `:hover` sous `@media (hover: hover)`, et historique de navigation des Problèmes (touche `App.tsx`, à coordonner).
