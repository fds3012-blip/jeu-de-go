---
name: impeccable-extraits
description: Niveau de finition minimum, moments de plaisir, accueil des nouveaux joueurs et passe de finition finale d'une interface. Use when polishing a screen before release, adding delight (celebrations, micro-interactions, personality), designing first-run onboarding or empty states, or checking that a UI clears the craft floor.
---

# Impeccable (extraits)

Extraits de [pbakaus/impeccable](https://github.com/pbakaus/impeccable) (Apache 2.0, voir `LICENSE` et `NOTICE.md`). Seules quatre références sont reprises, sans les scripts ni l'outil en ligne de commande.

| Besoin | Fichier à lire |
|---|---|
| Vérifier qu'un écran atteint le niveau minimum de qualité | `reference/craft-floor.md` |
| Ajouter du plaisir : célébrations, personnalité, micro-interactions | `reference/delight.md` |
| Premier lancement, états vides, découverte des fonctions | `reference/onboard.md` |
| Passe de finition avant livraison | `reference/polish.md` |

Règles d'adaptation à ce projet :
- Ignore toute commande `impeccable …`, `{{scripts_path}}` ou `{{command_prefix}}` : l'outil n'est pas installé. Fais la vérification à la main, sur des captures 390 × 844 en sombre et en clair.
- La direction artistique de `docs/design/v2/direction.md` et les règles de `CLAUDE.md` priment en cas de conflit : une seule action en relief par écran, textes courts au tutoiement, 44 px, contraste AA, mouvements réduits.
- Pour le mouvement, utilise plutôt les skills `animate` et `emil-design-eng`.
