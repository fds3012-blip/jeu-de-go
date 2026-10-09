---
name: impeccable-extraits
description: Revue et finition d'interface selon Impeccable 4.5.2 - niveau de finition minimum, critique UX notée, audit technique (a11y, perf, responsive), robustesse (erreurs, i18n, cas limites), textes d'interface, simplification, mise en page, typographie, couleur, ton plus calme ou plus affirmé, adaptation aux écrans et à iOS/Android, performance, plaisir, premier lancement, passe de finition. Use when critiquing, auditing, hardening, polishing or refining a screen, writing UI copy, adapting to small screens or native platforms, or checking that a UI clears the craft floor.
---

# Impeccable (références choisies, version 4.5.2)

Extraits de [pbakaus/impeccable](https://github.com/pbakaus/impeccable) (Apache 2.0, voir `LICENSE` et `NOTICE.md`), mis à jour le 09/10/2026 (#507). Seules les références utiles à une app de jeu sont reprises, **sans les scripts, le binaire téléchargé ni les crochets** : l'outil en ligne de commande n'est pas installé, volontairement (il télécharge et exécute un binaire au premier lancement).

| Besoin | Fichier à lire |
|---|---|
| Avant toute modification d'interface : niveau minimum et interdits | `reference/craft-floor.md` |
| Écran d'app (tâche à accomplir, lisibilité, cohérence) | `reference/operate.md` |
| Critique UX notée d'un écran ou d'un parcours | `reference/critique.md` |
| Audit technique : accessibilité, performance, responsive, thèmes | `reference/audit.md` |
| Robustesse : erreurs, hors ligne, textes longs, i18n, cas limites | `reference/harden.md` |
| Textes d'interface, libellés, messages d'erreur | `reference/clarify.md` |
| Simplifier un écran trop chargé | `reference/distill.md` |
| Espacements, rythme, hiérarchie visuelle | `reference/layout.md` |
| Typographie et hiérarchie des textes | `reference/typeset.md` |
| Couleur stratégique | `reference/colorize.md` |
| Écran trop criard / trop terne | `reference/quieter.md` · `reference/bolder.md` |
| Petits écrans, zoom, appareils | `reference/adapt.md` |
| App iOS / Android (Capacitor, plus tard) | `reference/ios.md` · `reference/android.md` |
| Performance de l'interface | `reference/optimize.md` |
| Plaisir : célébrations, personnalité, micro-interactions | `reference/delight.md` |
| Premier lancement, états vides, découverte | `reference/onboard.md` |
| Passe de finition avant livraison | `reference/polish.md` |

Règles d'adaptation à ce projet :
- Ignore toute commande `impeccable …`, `${CLAUDE_SKILL_DIR}/scripts/…`, `live`, `hooks`, `doctor` ou le « skill-base-dir » : l'outil n'est pas installé. Suis la voie « Launcher unavailable » d'Impeccable : lis le contexte du projet directement (`CLAUDE.md`, `docs/design/v2/direction.md`, `docs/ux/base-de-connaissances.md`) et fais les vérifications à la main, sur des captures 390 × 844 (et 320 × 568) en sombre et en clair.
- Il n'y a pas de PRODUCT.md ni de DESIGN.md : la direction artistique `docs/design/v2/direction.md` (Encre & Jade) en tient lieu, et les règles de `CLAUDE.md` priment en cas de conflit : une seule action en relief par écran, compris en 3 secondes, textes courts au tutoiement, vocabulaire du go expliqué, 44 px, contraste AA, mouvements réduits, français puis anglais.
- Mode Impeccable : l'app est en **Operate** (le joueur accomplit une tâche) ; les pages de référencement (`/apprendre-le-go`, `/regles-du-go`) sont en **Read**, les fiches stores en **Persuade**.
- Mouvement : utilise plutôt les skills `animate`, `emil-design-eng` et `review-animations`. Personnages : `personnages-go`.
- Règle d'or de Florian pour tout texte lié au jeu : aucun conseil de go faux.
