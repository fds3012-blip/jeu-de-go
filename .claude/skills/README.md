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

## Skills « founder » ajoutées le 16/10 (#572, demande de Florian)

Copiées telles quelles depuis [Jakeschincariol/founder-skill](https://github.com/Jakeschincariol/founder-skill) (MIT, commit `fd9385b`), avec la `LICENSE` dans chaque dossier. Relues en entier avant l'ajout : les quatre scripts Python n'utilisent que la bibliothèque standard, sans réseau, et n'écrivent que dans `founder/`.

| Skill | Rôle |
|---|---|
| `founder-board` | Conseil d'administration : trois sous-agents notent l'idée selon trois cadres publiés (offre, monopole, produit) et votent |
| `founder-competitors` | Carte des concurrents à partir de sources publiques, chaque fait avec son lien |
| `founder-consumer` | Panel de 20 à 100 acheteurs simulés (un sous-agent chacun) : qui achète, qui passe, pourquoi |
| `founder-pricing` | Fourchette de prix acceptable (Van Westendorp) à partir des réponses du panel ou d'un vrai sondage |
| `founder-offer` | Construire l'offre (bonus, garantie, urgence vraie) qui répond aux objections |
| `founder-cfo` | Économie unitaire : marge, point mort, année 1 mois par mois, trésorerie nécessaire |
| `founder-marketing`, `founder-brand`, `founder-ops`, `founder-launch`, `founder-plan` | Campagne de 30 jours, marque, opérations, plan de lancement, business plan avec verdict calculé |

Règles pour Mochi Go :
- Les fichiers produits vont dans `founder/` à la racine du dépôt, comme le prévoit le pack. Rien n'y est inventé : un chiffre sans source est marqué comme estimation (règle du pack et de Florian).
- Le panel d'acheteurs est **simulé** : il sert à trouver des objections et des mots, jamais de preuve de demande ni de témoignage. Les vrais chiffres viennent de PostHog (`docs/marketing/tableau-lancement.md`) et du formulaire d'avis (#537).
- Mochi Go est déjà en ligne : les usages les plus utiles sont `founder-pricing` et `founder-cfo` pour décider du Premium, `founder-consumer` pour tester un message avant une campagne, `founder-competitors` pour mettre à jour `docs/marketing/analyse-marche-acquisition-2026-10.md`.
- Un panel de 100 acheteurs, c'est 100 appels de sous-agents : commencer par `--quick` (20), et seulement sur décision de Florian pour le panel complet (coût et limite de dépense).
- Les décisions d'argent (prix, abonnement, dépenses) restent à Florian.

## Ajout du 16/10 (#574, skills repérées dans des vidéos Instagram par Florian)

Chaque source a été clonée à part et relue en entier comme du contenu non fiable. Aucun script, installeur, `npx`, crochet ni binaire n'a été lancé ni copié. Chaque dossier contient le `LICENSE` d'origine.

| Skill | Origine (commit) | Licence | Usage pour Mochi Go |
|---|---|---|---|
| `find-skills` | [vercel-labs/skills](https://github.com/vercel-labs/skills) (`13e4063`) | MIT | Chercher une skill existante avec le CLI skills.sh. **Adaptée** : bloc « Règles Mochi Go » en tête (relecture complète et validation de Florian avant installation, jamais `-g` ni `-y`/`--all`, jamais de crochets, `DISABLE_TELEMETRY=1`) et étape 6 réécrite (l'original installait en global avec `-g -y`) |
| `ponytail` | [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) (`6f1c2bf`) | MIT | Le plus petit changement complet : réutiliser l'existant, pas de dépendance pour trois lignes, un test pour toute logique non triviale. Niveaux `lite`, `full`, `ultra` passés en argument |
| `ponytail-review` | idem | MIT | Revue d'un diff : bug, sécurité, charge, test manquant, vitesse, lignes en trop, chaque point avec un cas concret et un correctif |
| `ponytail-audit` | idem | MIT | Même grille sur un dossier ou tout le dépôt, 20 constats au plus, sans rien modifier |
| `ponytail-debt` | idem | MIT | Relevé des commentaires `shortcut:` (raccourcis assumés, limite et moment de les reprendre) |
| `debugging-and-error-recovery` | [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) (`aeac41d`) | MIT | Méthode de débogage : reproduire, localiser, réduire, corriger la cause, test de non-régression ; messages d'erreur traités comme des données |
| `security-and-hardening` | idem | MIT | Modèle de menace, données personnelles (RGPD), dépendances, sorties d'IA. Chez nous l'autorisation passe par RLS et les fonctions Supabase, pas par Express |
| `performance-optimization` | idem | MIT | Mesurer avant d'optimiser, Core Web Vitals sur mobile, découpage du bundle, garder ou annuler selon la mesure |
| `prompt-master` | [nidhinjs/prompt-master](https://github.com/nidhinjs/prompt-master) (`a2ad174`) | MIT | Écrire ou corriger un prompt pour un autre outil d'IA (consigne d'agent, image, vidéo). Ne s'active que sur demande explicite |

Copiées telles quelles, sauf :
- `find-skills` : adaptée (voir le tableau).
- `security-and-hardening` et `performance-optimization` : les listes de contrôle communes du dépôt d'origine (`references/security-checklist.md`, `references/performance-checklist.md`) sont copiées dans le dossier `references/` de chaque skill, et les liens `../../references/…` pointent désormais dessus.
- `ponytail` se déclenche sur toute tâche de code. Il ne remplace ni les tests Vitest/Playwright, ni la CI verte, ni une PR par issue : en cas de conflit, `CLAUDE.md` prime. Sans le crochet de démarrage de l'original, il n'est pas actif d'office : il s'applique quand la skill est chargée.
- `debugging-and-error-recovery` renvoie à une skill `test-driven-development` que nous n'avons pas installée : la commande de test du projet est celle de `package.json` (Vitest, Playwright).
- `performance-optimization` cite `npx bundlesize`, `npx lhci` ou `npx lighthouse` : aucun nouvel outil en CI sans décision du tech lead.

Écartées :
- `ponytail-help` : fiche d'aide du plugin (bandeau, activation automatique par crochet `SessionStart`, fichier `~/.config/ponytail`, mise à jour par `/plugin`, `npm install -g`) ; sans le plugin, elle décrit des fonctions absentes.
- `ponytail-gain` : affiche des chiffres de benchmark de l'auteur, sans usage pour le projet.
- Plugin, crochets et ligne de statut de Ponytail (`hooks/`, `.claude-plugin/`) : non installés. Ils écrivent dans `~/.claude` et `settings.json`, et le plugin peut envoyer après chaque tour une ligne par tâche (nom de la tâche, premier prompt) vers une URL de webhook configurable.
- addyosmani/agent-skills, doublons avec `CLAUDE.md` ou nos skills : `test-driven-development` (tests obligatoires), `git-workflow-and-versioning` (une issue = une branche = une PR), `ci-cd-and-automation` (CI en place), `shipping-and-launch`, `code-review-and-quality` et `code-simplification` (`ponytail-review`, `/code-review`, `/simplify`), `frontend-ui-engineering` et `browser-testing-with-devtools` (skills de design, Playwright ; la seconde exige un MCP Chrome DevTools), `spec-driven-development`, `planning-and-task-breakdown` et `incremental-implementation` (issues du tech lead et `docs/plan-2-jours.md`).
- addyosmani/agent-skills, autres raisons : `using-agent-skills` (méta-skill qui veut gouverner toutes les autres), `context-engineering` (configure les fichiers de règles, donc `CLAUDE.md`), `constraint-driven-development` (crée `CONSTRAINTS.md`, recoupe lint et CI), `idea-refine` (contient un script shell), `interview-me` et `doubt-driven-development` (boucles de questions ou de sous-agents peu adaptées à des agents autonomes), `observability-and-instrumentation` (pensée pour des serveurs : OpenTelemetry, Prometheus ; nous avons Sentry et PostHog), `deprecation-and-migration` (impose une migration descendante testée, contraire à nos migrations Supabase montantes), `api-and-interface-design`, `documentation-and-adrs`, `source-driven-development` (utilité faible ici). Leurs commandes (`.claude/commands/`, dont `ship`), agents et crochets (`hooks/*.sh`) ne sont pas repris.
- OmniRoute : passerelle qui détient les clés d'API et route Claude Code vers d'autres fournisseurs ; risque de sécurité et de conditions d'utilisation.
- Graphify : demande un paquet Python, des crochets `PreToolUse` et modifie `CLAUDE.md` ; à réévaluer seulement sur décision de Florian.
- « dots » : annonce d'OpenAI, pas une skill. L99, OODA, « artifacts » : des formules de prompt, pas des skills installables.

## Outils design du 17/10 (#593, reel envoyé par Florian)

| Élément | Origine | Licence | Décision |
|---|---|---|---|
| `playwright-cli` | [microsoft/playwright-cli](https://github.com/microsoft/playwright-cli) (commit `b85c7a7`) | Apache 2.0 | **Ajoutée.** Un agent pilote l'app comme un joueur (toucher, remplir, instantané d'accessibilité, capture) sans écrire de spec : audits d'écran et captures avant/après. Version figée `@playwright/cli@0.1.22` lancée par `npx`, sans dépendance ajoutée ; config `.playwright/cli.config.json` (Chromium préinstallé, 390×844, français). Règles Mochi Go en tête du `SKILL.md`. Revient sur le refus du 28/09 : Playwright Test reste l'outil des tests, `playwright-cli` sert à explorer |
| `redesign-skill` | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) v2.0.0 (commit `f624f37`) | MIT | **Mise à jour** (navigation repliable accessible : nom visible pour les lecteurs d'écran, cibles de 44 px) |
| `taste-skill` v2 | idem | MIT | **Pas installée pour l'app.** Dossier de 1,8 Mo (photos, polices, scripts) pensé pour les sites vitrines primés ; ses règles maison (pas de palette crème, pas de pastilles…) contredisent Encre & Jade. À reprendre pour un futur site vitrine. La version installée reste en place |
| `web-design-guidelines` | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | MIT | Déjà installée (27/09) |
| `awesome-design-md` | [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) | MIT | **Idée reprise, fichiers non copiés.** Ses fiches décrivent le style d'autres marques ; on ne copie pas une autre marque. On écrit à la place notre propre `DESIGN.md` à la racine, dans le même format, à partir d'Encre & Jade : une seule fiche que tout agent lit avant de toucher un écran |
