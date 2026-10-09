# Skills du projet

Compétences partagées par tous les agents (chargées automatiquement par Claude Code).

| Skill | Origine | Licence | Usage |
|---|---|---|---|
| `frontend-design` | [anthropics/skills](https://github.com/anthropics/skills) | Apache 2.0 | Direction visuelle distinctive, anti-« rendu générique », méthode en deux passes |
| `design-critique` | [anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins) (plugin design) | Apache 2.0 | Critique structurée d'un écran : 1re impression, usage, hiérarchie, cohérence, accessibilité |
| `design-system` | idem | Apache 2.0 | Audit et extension du design system (tokens, composants, états) |
| `ux-copy` | idem | Apache 2.0 | Textes d'interface |

| `animate`, `review-animations`, `improve-animations`, `emil-design-eng` | [emilkowalski/skill](https://github.com/emilkowalski/skill) | MIT | Méthode d'animation (faut-il animer, propriété, courbe, durée, interruption), revue et audit du mouvement, finition d'interface |
| `motion-design` | [LottieFiles/motion-design-skill](https://github.com/LottieFiles/motion-design-skill) | MIT | Mouvement et émotion : chorégraphie, tables de durées, principes Disney pour l'interface (victoires, badges) |
| `impeccable-extraits` | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | Apache 2.0 | Références de la version 4.5.2 (mise à jour #507) : niveau minimum, critique notée, audit, robustesse, textes, simplification, mise en page, typographie, couleur, ton, adaptation iOS/Android, performance, plaisir, premier lancement, finition |
| `mobile-pro-rules` | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | MIT | Checklist avant livraison d'un écran mobile |
| `icon-system` | [Owl-Listener/designer-skills](https://github.com/Owl-Listener/designer-skills) | MIT | Charte d'icônes : grille, tailles, trait, nommage |
| `web-design-guidelines` | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | MIT | Revue d'un écran contre les Web Interface Guidelines (accessibilité, formulaires, focus, mouvement), sortie `fichier:ligne`. Récupère les règles à jour sur GitHub à chaque revue |
| `redesign-skill` | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | MIT | Audit d'un écran existant : repérer les motifs génériques et les états manquants, améliorer sans réécrire |
| `taste-skill` | idem | MIT | Anti « rendu générique » pour les pages vitrines (site, page d'accueil marketing, fiches stores) |

Les quatre premières skills sont copiées sans modification, sauf la ligne de renvoi vers `CONNECTORS.md`, retirée (le fichier est absent ici). Les suivantes, validées par Florian le 27/09 (#52), sont copiées telles quelles avec leur `LICENSE`.
- `impeccable-extraits` et `mobile-pro-rules` n'ont qu'une partie des fichiers d'origine : sans scripts, sans binaire téléchargé et sans base de données. Leur `SKILL.md` est écrit ici.
- En cas de conflit, `CLAUDE.md` et `docs/design/v2/direction.md` priment.

## Skills ajoutées le 27/09 au soir (validées par Florian)

| Skill | Origine | Licence | Usage |
|---|---|---|---|
| `dual-coding-designer`, `cognitive-load-analyser`, `worked-example-fading-designer`, `cpa-sequence-designer`, `retrieval-practice-generator`, `spaced-practice-scheduler` | [GarethManning/education-agent-skills](https://github.com/GarethManning/education-agent-skills) | CC BY-SA 4.0 (attribution dans chaque dossier) | Leçons où l'image explique et le texte appuie, charge cognitive, retrait progressif de l'aide, du concret à l'abstrait, révisions espacées |
| `gamification-patterns` | [houke/nexus](https://github.com/houke/nexus) | MIT | XP, niveaux, badges, séries, récompenses, avec les anti-patterns à éviter |
| `peak-end-rule`, `zeigarnik-effect`, `heuristic-evaluation`, `journey-map`, `usability-test-plan`, `illustration-style` | [Owl-Listener/designer-skills](https://github.com/Owl-Listener/designer-skills) | MIT | Fin mémorable, envie de revenir, audit Nielsen, parcours du débutant, tests, style d'illustration |
| `accessibility-review`, `user-research`, `research-synthesis` | [anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins) | Apache 2.0 | Audit WCAG AA, recherche et synthèse des retours joueurs (renvoi `CONNECTORS.md` retiré) |
| `personnages-go` | écrite ici | projet | Charte des 9 adversaires et de Mochi |

Ajoutées le 28/09 sur proposition de Florian, copiées telles quelles avec leur licence :
- `taste-skill` et `redesign-skill` visent surtout les sites vitrines. Pour les écrans du jeu, on garde notre design system : ne jamais installer de librairie d'interface (shadcn, Material, Tailwind…) ni changer de police sans décision du designer.
- Écartées : `image-to-code` (il faut générer des images de maquette, outil que nous n'avons pas), `awesome-design-md` (fiches de style de marques connues : on ne copie pas une autre marque ; à consulter comme source d'étude seulement), le MCP 21st Magic (clé d'API d'un service tiers, décision de Florian) et Playwright CLI (Playwright est déjà installé et utilisé par les agents).

## Mise à jour du 09/10 (#507, reel « 3 skills pour Claude Code » envoyé par Florian)

- Emil Kowalski (`emil-design-eng`, `animate`, `review-animations`, `improve-animations`) et Taste (`taste-skill`, `redesign-skill`) : déjà installés, identiques à la dernière version publiée (vérifié le 09/10).
- `impeccable-extraits` passe de 4 à 19 références de la version 4.5.2, toujours sans scripts, sans binaire téléchargé (le lanceur d'Impeccable télécharge et exécute un binaire au premier lancement) et sans crochets. Écartées : `live`, `generate`, `hooks`, `doctor` (dépendent de l'outil), `new-work`, `shape`, `overdrive` (refonte ou création d'un nouvel univers visuel : notre direction Encre & Jade est fixée), `animate` (nos skills de mouvement le couvrent).
- Ajoutées depuis [emilkowalski/skill](https://github.com/emilkowalski/skill) (MIT, copiées telles quelles avec leur `LICENSE`) : `break-ui` (pousser un écran dans ses pires cas : pseudos longs, textes anglais, zéro élément, grands nombres), `find-animation-opportunities` (repérer ce qui gagnerait à bouger, et refuser le reste), `apple-design` (gestes, ressorts, feuilles, sensation iOS, utile avant Capacitor). Écartées : `write-swift`, `animate-expo`, `mobile-native` (pas de code natif ici), `ask-sonner`, `pick-ui-library` (pas de librairie d'interface), `prototype`, `animation-vocabulary`.
