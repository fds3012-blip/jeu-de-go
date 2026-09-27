# Thème Encre & Jade

## Couleurs
| Rôle | Nom | Valeur |
|---|---|---|
| Fond | Encre | #16202B |
| Cartes, barres | Encre claire | #1F2C3A |
| Séparateurs | Ardoise | #2E3D4E |
| Texte principal | Papier | #F4EFE6 |
| Texte secondaire | Brume | #9FB0BF |
| Action principale | Jade | #2EBD85 |
| Récompenses, séries | Or | #F2B84B |
| Alertes, pastilles | Vermillon | #E4572E |
| Plateau | Kaya | #DBAE62 à #C99550 |

Mode clair : fond #F4EFE6, cartes #FFFFFF, texte #16202B, mêmes accents.

## Typographie
- Titres et chiffres forts : Shippori Mincho (700).
- Interface : Zen Kaku Gothic New (400, 500, 700).

## Principes
1. Une seule action principale par écran, en jade, pleine largeur, collée au-dessus de la barre de navigation.
2. Le plateau est la seule matière chaude de l'écran : tout le reste est encre et papier.
3. Mochi, le chat coach, parle dans une bulle en haut des écrans de problèmes, de leçons et de partie d'entraînement. Jamais plus de deux phrases.
4. Le parcours d'apprentissage est un « chemin de pierres » : des pierres de gué numérotées dans un jardin zen qui se révèle au fil des leçons.
5. Récompenses (badges, séries) en or, avec une animation courte à l'obtention seulement.

## Fichier Figma
[Jeu de go : Encre & Jade](https://www.figma.com/design/9Ft0rUVY3lB7cY7pIyjNti) (brouillons de Florian, plan Starter).

- Page **Tokens** : palette, rôles des deux modes, espacements, rayons, tailles, typographie, mouvement.
- Page **Composants** : Bouton principal, Carte, Bandeau joueur, Barre de navigation, Bulle de Mochi (et Mochi), Pastille, Badge. Chaque composant a une variante `Thème=Sombre|Clair`.
- Page **Écrans** : Accueil, Partie, Problèmes, Leçon, Profil en 390 × 844. Ligne du haut : mode sombre. Ligne du bas : mode clair.

Contraintes du plan Starter : un seul mode par collection de variables et trois pages au maximum. Les couleurs sont donc réparties en deux collections, « Couleurs · Sombre » et « Couleurs · Clair », avec les mêmes noms de rôles (`role/bg`, `role/text`…). Chaque variable porte sa syntaxe CSS (`var(--bg)`…).

### Une seule action principale par écran
| Écran | Action principale (jade) | Onglet actif |
|---|---|---|
| Accueil | Jouer | Accueil |
| Partie | Poser une pierre sur le plateau (pas de bouton jade ; Passer, Annuler, Abandonner restent secondaires) | aucun (plein écran) |
| Problèmes | Résoudre le problème 4 | Problèmes |
| Leçon | Continuer (après la bonne réponse) | Apprendre |
| Profil | Inviter un ami | Profil |

La barre de navigation des maquettes a quatre onglets : Accueil, Apprendre, Problèmes, Profil. « Jouer » devient l'action principale de l'Accueil.

## Tokens (`src/ui/tokens.css`)
Le fichier CSS et les variables Figma portent les mêmes noms. `src/ui/tokens.test.ts` vérifie le contraste AA de chaque paire texte/fond dans les deux modes.

### Couleurs : rôles
| Token | Sombre | Clair | Usage |
|---|---|---|---|
| `--bg` | #16202B | #F4EFE6 | fond d'écran |
| `--surface` | #1F2C3A | #FFFFFF | cartes, barres, bulles |
| `--line` | #2E3D4E | #DDD5C7 | séparateurs, bordures |
| `--text` | #F4EFE6 | #16202B | texte principal |
| `--muted` | #9FB0BF | #5B6B7A | texte secondaire |
| `--accent` | #2EBD85 | #2EBD85 | fond du bouton principal |
| `--accent-press` | #1E9A6A | #1E9A6A | bouton principal pressé |
| `--on-accent` | #0B1117 | #0B1117 | texte posé sur jade, or ou vermillon |
| `--accent-texte` | #2EBD85 | #177A53 | jade utilisé comme texte |
| `--danger` | #E4572E | #E4572E | bordures d'alerte, pastilles |
| `--danger-texte` | #F07650 | #A83A18 | vermillon utilisé comme texte |
| `--recompense` | #F2B84B | #F2B84B | fond des badges et séries |
| `--recompense-texte` | #F2B84B | #8A5A00 | or utilisé comme texte |
| `--focus` | jade | jade | contour de focus clavier |

Palette brute (identique dans les deux modes) : `--encre`, `--encre-2`, `--ardoise`, `--papier`, `--brume`, `--jade`, `--jade-fonce`, `--or`, `--vermillon`, `--kaya`, `--kaya-2`, `--grille`, `--blanc`, `--nuit`.

Règle : le vermillon pur (#E4572E) n'atteint pas 4,5:1 comme texte, ni sur fond sombre ni sur fond clair. Pour du texte, utilise `--danger-texte`.

### Typographie
`--font-titre` (Shippori Mincho 700), `--font-ui` (Zen Kaku Gothic New), graisses `--fw-regular` 400, `--fw-medium` 500, `--fw-bold` 700.
Tailles : `--fs-xs` .78rem, `--fs-s` .88rem, `--fs-m` 1rem, `--fs-l` 1.1rem, `--fs-xl` 1.25rem, `--fs-2xl` 1.8rem, `--fs-3xl` 1.9rem, `--fs-base` 16px. Interlignes : `--lh-base` 1.5, `--lh-titre` 1.2.

### Espacements, rayons, tailles
- Espacements (grille de 4 px) : `--space-1` 4, `--space-2` 8, `--space-3` 12, `--space-4` 16, `--space-5` 20, `--space-6` 24, `--space-8` 32, `--space-10` 40, `--gouttiere` 16.
- Rayons : `--radius-xs` 4 (coin de la bulle côté Mochi), `--radius-plateau` 8, `--radius-s` 12, `--radius-bouton` 14, `--radius` 16 (cartes), `--radius-pill` 999.
- Tailles : `--cible-min` 44, `--cible-bouton` 46, `--cible-cta` 54, `--nav-h` 60, `--largeur-max` 560, `--maquette-l` 390, `--maquette-h` 844.

### Mouvement
`--duree-rapide` 100ms (appui), `--duree` 200ms (transitions), `--duree-recompense` 600ms (badge, série), `--ease`. Avec `prefers-reduced-motion: reduce`, toutes les durées passent à 0ms.
