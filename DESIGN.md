---
version: 1
name: Mochi-Go-Encre-et-Jade
description: Mochi Go est une PWA de go grand public, en français d'abord. Thème Encre & Jade v2, « le goban sous la lampe » - fond d'encre chaude ({colors.sumi}) éclairé par un halo doré, plateau en kaya comme seule matière vive, un seul bouton jade en relief ({colors.jade}) par écran, l'or ({colors.or}) pour les récompenses, le hanko ({colors.hanko}) pour les adversaires. Titres en Bricolage Grotesque 800, texte en Zen Kaku Gothic New. Mobile d'abord (390 × 844), sombre par défaut, clair « Papier », mouvements réduits respectés.

colors:
  # Palette (primitives, identiques dans les deux modes) : src/ui/tokens.css
  sumi: "#1C1916"
  sumi-2: "#27221E"
  sumi-3: "#332D28"
  trait: "#3E3731"
  nuit-chaude: "#171411"
  papier: "#F3EDE3"
  washi: "#EFE8DC"
  brume: "#A99F92"
  jade: "#3CC48E"
  jade-bord: "#1E8A5F"
  or: "#EFB84A"
  or-fonce: "#A0680A"
  hanko: "#D2432C"
  tampon-encre: "#B23520"
  tampon-papier: "#F7E9DA"
  indigo: "#2F4B8A"
  kaya: "#EDC27A"
  kaya-2: "#C58D42"
  grille: "#3A2912"
  bois-tranche: "#7A4A1C"
  encre-jade: "#07231A"
  blanc: "#FFFFFF"
  # Rôles, mode sombre (défaut)
  bg: "#1C1916"
  surface: "#27221E"
  surface-2: "#332D28"
  line: "#3E3731"
  barre: "#171411"
  text: "#F3EDE3"
  muted: "#A99F92"
  accent: "#3CC48E"
  accent-bord: "#1E8A5F"
  accent-press: "#34B07F"
  on-accent: "#07231A"
  accent-texte: "#3CC48E"
  danger: "#D2432C"
  on-danger: "#FFFFFF"
  danger-texte: "#EC735A"
  recompense: "#EFB84A"
  recompense-texte: "#EFB84A"
  # Rôles, mode clair « Papier »
  bg-clair: "#EFE8DC"
  surface-clair: "#FBF8F2"
  surface-2-clair: "#E6DDCF"
  line-clair: "#D8CDBC"
  barre-clair: "#F7F2E9"
  text-clair: "#1C1916"
  muted-clair: "#675D53"
  accent-texte-clair: "#126541"
  danger-texte-clair: "#B23520"
  recompense-texte-clair: "#7A5000"

typography:
  # Bricolage Grotesque = --font-titre ; Zen Kaku Gothic New = --font-ui
  ecran-titre: { fontFamily: Bricolage Grotesque, fontSize: 32px, fontWeight: 800, lineHeight: 1.15, letterSpacing: -0.02em }  # --fs-3xl
  victoire: { fontFamily: Bricolage Grotesque, fontSize: 56px, fontWeight: 800, letterSpacing: -0.02em }  # --fs-display-xl, 44px sur petit écran
  chiffre-fort: { fontFamily: Bricolage Grotesque, fontSize: 28.8px, fontWeight: 800, lineHeight: 1.15 }  # --fs-2xl
  section: { fontFamily: Bricolage Grotesque, fontSize: 20px, fontWeight: 700, lineHeight: 1.15 }  # --fs-xl
  bouton-principal: { fontFamily: Bricolage Grotesque, fontSize: 20px, fontWeight: 800, lineHeight: 1.15, letterSpacing: -0.01em }  # --fs-cta
  tuile-titre: { fontFamily: Bricolage Grotesque, fontSize: 16px, fontWeight: 700, lineHeight: 1.15 }
  corps: { fontFamily: Zen Kaku Gothic New, fontSize: 16px, fontWeight: 400, lineHeight: 1.5 }  # --fs-base, --lh-base
  bulle: { fontFamily: Zen Kaku Gothic New, fontSize: 15px, fontWeight: 400, lineHeight: 1.4 }  # --fs-corps-s
  secondaire: { fontFamily: Zen Kaku Gothic New, fontSize: 14px, fontWeight: 400 }  # --fs-s
  legende: { fontFamily: Zen Kaku Gothic New, fontSize: 13px, fontWeight: 400 }  # --fs-legende
  navigation: { fontFamily: Zen Kaku Gothic New, fontSize: 12.5px, fontWeight: 500, lineHeight: 1.2 }  # --fs-xs, 700 si actif
  mini: { fontFamily: Zen Kaku Gothic New, fontSize: 12px, fontWeight: 600 }  # --fs-mini

rounded:
  xs: 4px          # --radius-xs : coin de bulle côté personnage, jointure des tuiles groupées
  plateau: 10px    # --radius-plateau
  s: 12px          # --radius-s : segments, champs, retours
  bouton: 16px     # --radius-bouton
  tuile: 16px      # --radius
  feuille: 22px    # --radius-feuille : haut des feuilles qui montent du bas
  pill: 999px      # --radius-pill : pastilles, badges, série

spacing:
  space-1: 4px
  space-2: 8px
  space-3: 12px
  space-4: 16px
  space-5: 20px
  space-6: 24px
  space-8: 32px
  space-10: 40px
  gouttiere: 16px

sizes:
  cible-min: 44px
  cible-bouton: 48px
  cible-cta: 56px
  nav-h: 60px
  relief: 5px
  icone-nav: 28px
  icone-attente: 22px
  largeur-max: 560px
  maquette: 390x844

motion:
  duree-rapide: 100ms
  duree: 200ms
  duree-pose: 160ms
  duree-recompense: 600ms
  duree-orbite: 1100ms
  ease: cubic-bezier(.2, .8, .2, 1)
  ease-pose: cubic-bezier(.2, .8, .3, 1.2)

components:
  bouton-principal:
    className: ".cta, .btn.primary"
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.bouton-principal}"
    rounded: "{rounded.bouton}"
    height: "{sizes.cible-cta}"
    shadow: "var(--ombre-relief)"
  bouton-principal-inactif:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.muted}"
    shadow: none
  bouton-secondaire:
    className: ".btn"
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.bouton}"
    height: "{sizes.cible-bouton}"
    border: "1.5px solid transparent"
  lien:
    className: ".lien, .link"
    textColor: "{colors.text}"
    underline: "2px var(--accent-trait)"
    minHeight: "{sizes.cible-min}"
  tuile:
    className: ".card, .tuile"
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.tuile}"
    border: none
  choix-exclusif:
    className: ".seg"
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.s}"
    actif: "{colors.text} sur {colors.bg}"
  barre-navigation:
    className: ".nav"
    backgroundColor: "{colors.barre}"
    height: "{sizes.nav-h}"
  pastille-xp:
    className: ".pastille-xp"
    backgroundColor: "{colors.or}"
    textColor: "{colors.encre-jade}"
    rounded: "{rounded.pill}"
---

## Overview

Mochi Go est un jeu de go grand public : il doit attirer des débutants complets, et chaque écran doit se comprendre en 3 secondes, avec une seule action principale bien visible. La référence de niveau est l'app chess.com.

La direction artistique s'appelle **Encre & Jade v2, « le goban sous la lampe »** (`docs/design/v2/direction.md`). On joue la nuit, sous une lampe, sur un vrai goban :
- le fond est une encre chaude, brune et non bleue (`--sumi` {colors.sumi}) ;
- un halo doré (`--halo`) éclaire le haut de l'écran ;
- le plateau en kaya est la seule matière vive, avec ses pierres d'ardoise et de coquillage ;
- les adversaires sont des personnages signés d'un sceau (hanko).

**La seule audace : le goban.** Il sert d'image d'accueil, il prend toute la largeur en partie, et il a une matière, un son et un toucher. Tout le reste est calme : tuiles sans bordure, barres sans cadre, une seule chose en relief.

**Trois couleurs, trois sens :**
- **jade** {colors.jade} : agir (le bouton principal, et lui seul en aplat) ;
- **or** {colors.or} : récompenser (série, XP, records, bilan) ;
- **hanko** {colors.hanko} : les adversaires (sceaux, tampon « BATTUE »), et les alertes.

**Caractéristiques clés :**
- Un seul élément en relief dans toute l'app : le bouton principal jade, avec une tranche dure de 5 px qui s'enfonce à l'appui.
- Mode sombre par défaut, mode clair « Papier » sur washi {colors.washi}, mêmes rôles, mêmes accents.
- Deux polices auto-hébergées (aucun appel à Google Fonts) : Bricolage Grotesque 800 pour les titres et les chiffres, Zen Kaku Gothic New pour le texte.
- Mochi, un petit chat jade, est le coach. Il parle dans une bulle, une phrase à la fois. Il ne joue jamais.
- Icônes dessinées à la main à partir du logo « deux pierres », jamais tirées d'une bibliothèque.
- Aucune librairie d'interface : React, CSS à la main et les jetons de `src/ui/tokens.css`.

Sources de vérité, par ordre : `src/ui/tokens.css` (valeurs), `src/ui/app.css` (composants de base), `docs/design/encre-et-jade.md` (règles), `docs/design/v2/direction.md` et `identite.md` (direction), `.claude/skills/personnages-go` (personnages), `docs/ux/loi-de-hick-2026-10.md` (nombre de choix). En cas de désaccord, le code gagne, et ce fichier doit être corrigé.

## Colors

> Les écrans n'utilisent que les **rôles** (`--bg`, `--surface`, `--text`…), jamais les primitives ni un hex en dur. Changer une primitive suffit. `src/ui/tokens.test.ts` vérifie le contraste AA de chaque paire texte/fond dans les deux modes, et 3:1 pour les éléments graphiques.

### Action, récompense, adversaire
| Rôle | Sombre | Clair | Usage |
|---|---|---|---|
| `--accent` | {colors.jade} `#3CC48E` | `#3CC48E` | Fond du bouton principal. Rien d'autre en aplat jade. |
| `--accent-bord` | `#1E8A5F` | `#1E8A5F` | Tranche du bouton en relief. |
| `--accent-press` | `#34B07F` | `#34B07F` | Bouton pressé quand les mouvements sont réduits (pas d'enfoncement). |
| `--on-accent` | `#07231A` | `#07231A` | Texte posé sur jade ou sur or (7,5:1 sur jade). |
| `--accent-texte` | `#3CC48E` | `#126541` | Jade utilisé comme texte ou icône. |
| `--accent-trait` | `#3CC48E` | `#1E8A5F` | Soulignés de lien, point « à toi de jouer », pastille d'onglet. |
| `--focus` | `#3CC48E` | `#1E8A5F` | Contour de focus clavier (3 px, décalage 2 px). |
| `--recompense` | `#EFB84A` | `#EFB84A` | Fond des badges, séries, pastille XP. |
| `--recompense-texte` | `#EFB84A` | `#7A5000` | Or utilisé comme texte. |
| `--danger` | `#D2432C` | `#D2432C` | Sceaux, pastilles, bordures d'alerte. Jamais comme texte. |
| `--on-danger` | `#FFFFFF` | `#FFFFFF` | Texte posé sur hanko. |
| `--danger-texte` | `#EC735A` | `#B23520` | Hanko lisible comme texte (erreurs, « Abandonner »). |

### Surfaces
| Rôle | Sombre | Clair | Usage |
|---|---|---|---|
| `--bg` | `#1C1916` | `#EFE8DC` | Fond d'écran, sous `--halo`. |
| `--surface` | `#27221E` | `#FBF8F2` | Tuiles, barres, bulles, boutons secondaires, feuilles. |
| `--surface-2` | `#332D28` | `#E6DDCF` | Coup courant, avatar, pierre du chemin, état pressé. |
| `--line` | `#3E3731` | `#D8CDBC` | Séparateurs, bord haut des barres. |
| `--barre` | `#171411` | `#F7F2E9` | Barre de navigation et barre d'actions de la partie. |
| `--voile` / `--voile-fort` | `rgba(12,10,8,.62)` / `.78` | idem | Derrière une feuille / une fenêtre qui attend une réponse. |

### Texte
| Rôle | Sombre | Clair | Contraste mesuré |
|---|---|---|---|
| `--text` | `#F3EDE3` | `#1C1916` | 15,0:1 sur `--bg` sombre, 14,4:1 en clair. |
| `--muted` | `#A99F92` | `#675D53` | Sombre : 6,7 (bg), 6,0 (surface), 5,2 (surface-2). Clair : 5,3 (bg), 6,1 (surface), 4,8 (surface-2). |

### Matière et personnages
- Plateau : `--kaya` `#EDC27A` vers `--kaya-2` `#C58D42`, lignes `--grille` `#3A2912`, tranche `#6B3F16`.
- Pierres hors goban : `--matiere-noire` (radial `#676B69` → `#151716` → `#050606`) et `--matiere-blanche` (`#FFFFFF` → `#E9E3D6` → `#BDB3A0`), reflet en haut à gauche.
- Sceaux (`src/ui/Sceau.tsx`) : trois paliers d'encre selon la force. Vermillon `#D2432C` (Pomme, Caillou, Bambou), indigo `#2F4B8A` (Renard, Rivière, Tigre), noir `#1B1A18` et or `#E9B949` (Montagne, Dragon, Sensei). Mochi a son sceau jade. Papier du sceau `#F7E9DA`.
- Bulle papier de la vedette (identique dans les deux modes) : fond `--papier`, texte `--sur-papier` `#1B1A18`, `--sur-papier-texte` `#3A342D`, `--sur-papier-doux` `#5E5448`.
- Onglets de la barre du bas (`--onglet-*`, 3:1 au moins sur `--barre`) : Jouer jade, Apprendre or (`#A0680A` en clair), Problèmes hanko, Profil indigo éclairé `#8FA6E6` (`#2F4B8A` en clair).

### Règles de couleur
- Le hanko pur `#D2432C` n'atteint pas 4,5:1 comme texte sur le sumi : pour du texte, `--danger-texte`.
- Le jade pur ne se détache pas du washi : en clair, soulignés et focus passent à `--accent-trait` et `--focus` (jade foncé).
- Le texte secondaire est en `--muted`, jamais en baissant l'opacité de `--text`, jamais en gris en dur.
- Alias v1 encore présents pour les styles en ligne (`--encre`, `--encre-2`, `--ardoise`, `--nuit`, `--jade-fonce`, `--vermillon`) : ne pas en ajouter de nouveaux usages.

## Typography

### Familles
- **`--font-titre`** : Bricolage Grotesque (variable, 200 à 800), pour les titres, les chiffres et le bouton principal. Interlettrage `--tracking-titre` −0,02 em.
- **`--font-ui`** : Zen Kaku Gothic New, en 400, 500 et 700, pour tout le reste.
- Repli : `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.
- Polices servies par l'app (`src/ui/fonts.css`, paquets `@fontsource`), sous-ensemble latin seulement : 4 fichiers `.woff2`, environ 70 Ko, budget 80 Ko. `font-display: swap`.

### Échelle (jetons réels)
| Jeton | Valeur | Usage |
|---|---|---|
| `--fs-display-xl` | 56px | « Victoire » |
| `--fs-display-l` | 44px | Titre de victoire sur petit écran |
| `--fs-3xl` | 2rem (32 px) | Titre d'écran, marque |
| `--fs-2xl` | 1.8rem (28,8 px) | Chiffres forts : cote, score (`.big`) |
| `--fs-display-m` | 28px | Résultat d'une séance, précision de la revue |
| `--fs-display-s` | 22px | Proverbe de l'attente, titre de bulle forte |
| `--fs-xl` / `--fs-cta` | 1.25rem (20 px) | Titres de section, bouton principal |
| `--fs-l` | 1.1rem (17,6 px) | Choix, titres de tuile, CTA dans `.dock` |
| `--fs-m` / `--fs-base` | 1rem / 16px | Texte courant |
| `--fs-corps-s` | .9375rem (15 px) | Bulles, coach, bilan |
| `--fs-s` | .88rem (14 px) | Texte secondaire |
| `--fs-legende` | .8125rem (13 px) | Légendes, sous-titre de tuile, réplique |
| `--fs-xs` | .78rem (12,5 px) | Libellés de la barre de navigation |
| `--fs-mini` | .75rem (12 px) | Pastilles, étiquettes sous une vignette |

Graisses : `--fw-regular` 400, `--fw-medium` 500, `--fw-bold` 700, `--fw-titre` 800. Interlignes : `--lh-base` 1.5, `--lh-titre` 1.15.

### Principes
- Pas de serif, nulle part (abandonné en v2 : rendu « prestige » générique).
- Pas de majuscules d'étiquette. Seule exception : « BATTUE », parce que c'est le texte d'un tampon.
- Pas de libellés « A · B » ni de flèches « → ». Une phrase ou un mot.
- Chiffres en `font-variant-numeric: tabular-nums` quand ils changent (scores, compteurs, records).
- Typographie française : espaces fines insécables avant `? ! : ;` et dans « », avec `fr()` de `src/ui/typo.ts`. Signe moins « − », pas de tiret.

## Layout

### Espacement
Grille de 4 px, vérifiée par `tokens.test.ts` : `--space-1` 4, `--space-2` 8, `--space-3` 12, `--space-4` 16, `--space-5` 20, `--space-6` 24, `--space-8` 32, `--space-10` 40. Marge latérale des écrans : `--gouttiere` 16 px.

### Colonne et cadre
- Colonne unique centrée, `max-width: var(--largeur-max)` (560 px). Les maquettes sont en 390 × 844 (`--maquette-l`, `--maquette-h`).
- `.app` : `padding: 12px 16px`, plus 150 px en bas pour le bouton fixe et la barre.
- Le bouton principal seul (`.cta`) est fixé en bas, au-dessus de la barre : `bottom: calc(74px + var(--relief) + env(safe-area-inset-bottom))`, largeur `min(528px, 100% − 32px)`. Avec des actions secondaires, il vit dans `.dock` (grille, écart `8px + relief`).
- En partie, le plateau déborde la gouttière (`margin: 0 calc(4px − var(--gouttiere))`) : il prend presque toute la largeur.

### En-tête et barre du bas (`docs/ux/navigation.md`)
| Famille d'écran | En-tête | Barre du bas |
|---|---|---|
| Accueil, Apprendre, Problèmes, Profil | Logo « Mochi Go » | Oui |
| Écran de tâche (en ligne, défi, revue, réglages, sous-vues du Profil) | Barre « ‹ titre » (`EnteteEcran`, `BoutonRetour.tsx`) | Oui |
| Leçon, problème | Barre du lecteur | Oui |
| Partie (ordi, à deux, en ligne) et sa fin, sa revue | Aucun : plein écran | Non |
| Compte bloquant | Aucun, une seule action | Non |

La barre du bas a quatre onglets : Jouer, Apprendre, Problèmes, Profil. Deux écrans de la même famille suivent toujours la même règle.

### Espace blanc
Le vide sert à isoler l'action principale et le goban. Un vide qui ne sépare rien est un défaut (l'audit #509 a relevé 150 px de vide sans intention dans la leçon) : soit le contenu remonte, soit le goban grandit.

## Elevation & Depth

| Niveau | Traitement | Usage |
|---|---|---|
| 0 (à plat) | Aucune ombre, aucune bordure | Tuiles, barres, bulles, boutons secondaires |
| Trait | `inset 0 0 0 1.5px` de `--text` à 22 % | Tuiles de mode (choix secondaires « au trait ») |
| Relief | `--ombre-relief` : `0 5px 0 var(--accent-bord), 0 14px 28px -12px rgba(60,196,142,.55)` (clair : `0 14px 24px -14px rgba(30,138,95,.5)`) | **Le bouton principal, et rien d'autre** |
| Plateau | `.board-wrap` : `0 4px 0 #6B3F16, 0 20px 32px -10px rgba(0,0,0,.72), 0 2px 6px rgba(0,0,0,.35)`, chanfrein clair en `inset` | Le goban posé sur la table |
| Plateau (jeton) | `--ombre-plateau` : `0 14px 28px -16px rgba(0,0,0,.7)` (clair `rgba(60,40,15,.45)`) | Plateaux secondaires |
| Flottant | `0 6px 18px -8px rgba(0,0,0,.55)` | Pastille « +N XP » annoncée en haut |
| Voile | `--voile` (.62), `--voile-fort` (.78) | Sous une feuille ou une fenêtre modale |

Lumière : `--halo`, un dégradé radial doré en haut de `body` (11 % d'or en sombre, 22 % en clair). Le reflet des pierres est toujours en haut à gauche : la lampe éclaire toujours du même côté.

## Shapes

| Jeton | Valeur | Usage |
|---|---|---|
| `--radius-xs` | 4px | Coin de la bulle côté personnage, jointure de deux tuiles groupées |
| `--radius-plateau` | 10px | Goban |
| `--radius-s` | 12px | Choix segmentés, champs, retours, vignettes de thème |
| `--radius-bouton` | 16px | Boutons principal et secondaire |
| `--radius` | 16px | Tuiles |
| `--radius-feuille` | 22px | Haut des feuilles qui montent du bas |
| `--radius-pill` | 999px | Pastilles, badges, série, couvercles |

- Tuiles qui se suivent : un seul bloc groupé (coins intérieurs de 4 px, 2 px d'écart), jamais une pile de cartes identiques.
- Une tuile « à faire plus tard » (leçon suivante) a une bordure en pointillés.
- Portraits : cadre arrondi à 22 % de la taille, viewBox 100 × 100. Bouton retour : rond de 44 px.

## Components

> Composants de base dans `src/ui/app.css`, composants React dans `src/ui/`. Réutilise-les ; n'en crée pas un nouveau pour une variante.

### Boutons
**Bouton principal** (`.cta`, `.btn.primary`) : une seule action par écran.
- Fond `--accent`, texte `--on-accent`, Bricolage 800 en 20 px, rayon 16 px, hauteur 56 px (`--cible-cta`), ombre `--ombre-relief`.
- Appui : `translateY(5px)` et plus d'ombre, en 100 ms (`--duree-rapide`). Mouvements réduits : pas de déplacement, le fond passe à `--accent-press`.
- Pas encore utilisable : à plat, fond `--surface-2`, texte `--muted`, sans ombre (il ne doit pas ressembler à l'actif). Pendant un envoi (`aria-busy`), il garde sa couleur.
- Sur l'accueil, il porte le sceau de l'adversaire (`.cta-sceau`) : « Jouer contre Pomme ».

**Bouton secondaire** (`.btn`) : à plat sur `--surface`, sans cadre visible (bordure transparente de 1,5 px que les écrans colorent pour un état), texte 700, hauteur 48 px. Appui : `scale(.98)` et `--surface-2`. Désactivé : opacité .4.

**Lien** (`.lien`, `.link`) : texte `--text` 700, souligné de 2 px en `--accent-trait`, cible de 44 × 44 px. Pour « Changer », « Revoir ma partie », « Plus tard ».

**Retour** (`BoutonRetour`, `.retour`) : rond de 44 px, chevron de 24 px en encre pleine, aligné sur la gouttière. Un seul style dans toute l'app (#509).

### Tuiles et choix
- **`.card`** : `--surface`, rayon 16 px, `padding: 14px 16px`, sans bordure.
- **`.tuile`** (accueil, « Aujourd'hui ») : hauteur 68 px au moins, titre Bricolage 700 en 16 px, détail en `--muted` 13 px, vignette (mini-goban 44 ou 60 px) à gauche.
- **`.mode`** (autres façons de jouer) : au trait, sans fond, icône en `--accent-texte`, nom en Bricolage 700 14 px. Un point d'or de 9 px quand un ami attend ton coup.
- **`.seg`** (choix exclusif) : rail `--surface`, rayon 12 px ; le choix actif est une pastille inversée (`--text` sur `--bg`), 44 px de haut. Jamais pour deux bascules indépendantes.
- **`.feedback`, `.notice`** : une teinte mêlée à la surface (`color-mix`, jade 16 %, hanko 16 % ou or 12 %), rayon 12 px, sans liseré.

### Pastilles et badges
- **Pastille XP** (`PastilleXp`, `.pastille-xp`) : fond or, texte `--encre-jade`, pilule, chiffre Bricolage 800. Annoncée en haut, au-dessus de tout (z-index 59), ne capte aucun toucher.
- **État du Go du jour** (`.tuile-etat`) : pilule dans le coin, « À faire » sur or, « Fait » cerné de jade sur `--surface-2`.
- **Série** (`.serie`) : pilule or à 16 %, flamme creuse tant que le Go du jour reste à faire, pleine après.
- **Badges du Profil** (`.badge-bouton`) : rond de 44 px ; choisi : double anneau `--bg` puis `--accent-bord`.
- **Pastille d'onglet** : point `--accent-trait` de 10 px sur l'icône, liseré de la couleur de la barre.

### Partie
- **Bandeau joueur** (`.joueur`, `src/ui/Partie.tsx`) : 60 px de haut, portrait 44 px, nom en Bricolage 800, sans cadre. Point « au trait » de 14 px en `--accent-trait`. Le joueur qui n'a pas le trait s'efface (opacité .78 sur le portrait et le nom). Couvercle des prises en pilule.
- **Barre d'avantage** (`.avantage`) : 8 px, Blanc en haut, Noir en bas, la portion noire glisse en `translateX` (300 ms).
- **Coach** (`.coach`) : `--surface`, rayon 16 px, 60 px de haut au moins, une phrase en 15 px.
- **Barre d'actions** (`.actions`, `IconesActions.tsx`) : sur `--barre`, boutons de 64 px, 5 actions au plus, aides à gauche et décisions à droite séparées par un filet. Désactivé : encre `--muted`, sans voile d'opacité.
- **Goban** (`Board.tsx`, `board.css`) : bois rendu une seule fois, pierres en symboles SVG, dernier coup marqué d'un anneau clair (sur noire) ou foncé (sur blanche), jamais en vermillon.

### Mochi et personnages (`.claude/skills/personnages-go`)
- **`<Bubble voix="interface">`** : sceau jade de Mochi. L'app te parle : bandeaux, aides, états vides, attentes, confirmations, accueil.
- **`<Bubble voix="coach">`** : portrait de Mochi (`PortraitMochi`, 44 px) avec une humeur (`neutre`, `content`, `surpris`, `fier`, `pensif`). Mochi parle de ta partie ou de ton exercice.
- Dans le doute : si la phrase cite un coup, une pierre ou un résultat du joueur, c'est le portrait. La règle est figée écran par écran par `src/ui/mochiRegle.test.ts`.
- Bulle (`.bubble p`) : `--surface`, coins `4px 16px 16px 16px` (le petit coin côté personnage), `padding: 10px 14px`.
- **Adversaires** : 9 personnages par force, Pomme, Caillou, Bambou (vermillon), Renard, Rivière, Tigre (indigo), Montagne, Dragon, Sensei (noir et or). Un trait de caractère chacun. Portrait (`Portrait.tsx`) lisible à 44 px, beau à 160 px ; sceau (`Sceau.tsx`) en signature.
- Choix d'adversaire : `CarrouselAdversaires` ; adversaire suivant verrouillé mais visible (grisé, cadenas) ; tampon « BATTU » quand il est battu.
- **Un seul personnage mis en avant par écran.**

### Navigation et feuilles
- **Barre du bas** (`.nav`, `IconesNav.tsx`) : `--barre`, 60 px, icônes de 28 px. Inactif : encre `--muted`, pierres à plat. Actif : pierres en matière, libellé 700 en `--text`, une pièce d'accent et un point de 5 px de la couleur de l'onglet, `aria-current="page"`.
- **Feuille** (`.feuille`, `<dialog>`) : monte du bas, `--surface`, rayon haut 22 px, `max-height: 92dvh`, voile `--voile`.

### Attente et célébration
- **`Reflexion`** : le logo qui tourne (un tour en 1,1 s). Toute attente l'utilise, jamais un rond de chargement générique. Mouvements réduits : les deux pierres s'allument l'une après l'autre.
- **Fin de partie** (`FinPartie.tsx`, `fin.css`) : sceau, tampon « BATTUE », « Victoire » en 56 px, bilan en une phrase, la leçon de Mochi, un bouton en relief, un lien « Revoir ma partie ».
- **`Confettis`** : 1,5 s (jade, or, hanko, papier), seulement à la victoire. En mouvements réduits, le composant ne rend rien.

### Mouvement
| Moment | Durée | Courbe |
|---|---|---|
| Appui sur un bouton | 100 ms (`--duree-rapide`) | `--ease` |
| Transition d'interface | 200 ms (`--duree`) | `--ease` `cubic-bezier(.2,.8,.2,1)` |
| Pose d'une pierre (échelle 1,12 → 1) | 140 ms | `--ease-pose` `cubic-bezier(.2,.8,.3,1.2)` |
| Onglet activé (1,15 → 1) | 160 ms (`--duree-pose`) | `--ease-pose` |
| Pierres prises / vers le couvercle | 220 ms / 280 ms, 30 ms de décalage | `--ease` |
| Coup interdit (tremblement) | 300 ms | `ease-in-out` |
| Feuille : entrée / sortie | 200 ms / 160 ms (mouvements réduits : fondu 150 ms) | `--ease` |
| Pastille XP : entrée / sortie | 220 ms / 160 ms | `cubic-bezier(.23,1,.32,1)` |
| Fin : feuille, tampon, coup du sceau | 240 ms, 280 ms (à 360 ms), 180 ms (à 560 ms) | orchestré |
| Badge, série, flamme | 600 ms (`--duree-recompense`) | `--ease` |

Règles (`docs/design/v2/audit-mouvement.md`) : on n'anime que `transform` et `opacity` ; ease-out pour entrer et sortir, jamais d'ease-in sur une interaction ; moins de 300 ms pour l'interface ; transitions interruptibles plutôt que keyframes pour ce qui se répète ; pas de `will-change`, pas de `transition: all`. Le mouvement répond à un geste ; un seul moment orchestré : la victoire. Avec `prefers-reduced-motion: reduce`, toutes les durées passent à 0 ms et l'état final s'affiche directement.

## Épure

Retour de Florian, 17/10 : « on met beaucoup d'informations à chaque fois sur les écrans alors que ça pourrait être épuré et bien plus léger, pour que le regard amène là où on souhaite que la personne clique ».

Le but : le regard tombe d'abord sur l'action principale (ou sur le goban quand c'est lui qu'on touche). Tout ce qui le détourne doit justifier sa place. Chaque règle ci-dessous se vérifie sur une capture 390 × 844, en sombre et en clair, au premier regard (sans défiler, au-dessus de la barre du bas), avec la méthode de comptage de `docs/ux/loi-de-hick-2026-10.md`.

| # | Règle | Comment on vérifie |
|---|---|---|
| E1 | **Une seule action principale** par écran : le seul aplat jade, le seul relief. En partie, l'action est de poser une pierre : aucun bouton jade. | Compter les `.cta` et `.btn.primary` visibles : 1 au plus (contrôle déjà automatisé dans la passe #509). |
| E2 | **5 blocs au plus au premier regard**, hors en-tête et barre du bas. Un bloc = un groupe séparé des autres par du vide (le goban, un bandeau, un groupe de tuiles, une bulle, le bouton). | Compter les blocs sur la capture. L'accueil complet à 8 blocs a été jugé trop chargé (#509). |
| E3 | **4 choix de même poids au plus dans un groupe** ; 5 est un plafond (barre de la partie), jamais dépassé. Au-delà : grouper, ou replier derrière un résumé et « Changer ». | Colonne « plus grand groupe » de la méthode de Hick. |
| E4 | **Un titre d'écran tient sur une ligne** à 390 px. **Un sous-titre fait 6 mots au plus**, ou il n'y en a pas. | Compter les mots ; capture 390 et 320. |
| E5 | **Une bulle de Mochi = une phrase** au premier regard (deux au maximum, règle Encre & Jade). Une seule voix parle à l'écran. | Compter les phrases et les bulles. |
| E6 | **Pas de ligne de détail sous un libellé qui se suffit.** Le détail utile au lecteur d'écran va dans `aria-label`, pas à l'écran. | Chaque `small` sous un nom de tuile ou de mode doit apporter une information qui change le choix. |
| E7 | **Pas de durée ni de compteur à côté de chaque élément** d'une liste (« 2 min », « 3/12 », « 0 XP »). Au plus un chiffre par bloc, seulement s'il change la décision ou fête un progrès (une série, un record). | Compter les chiffres par bloc. |
| E8 | **Jamais deux fois la même information** sur un écran (« 9 × 9 » dans le réglage et dans le bouton, par exemple). | Relire la capture de haut en bas. |
| E9 | **Pas de titre de section visible quand le groupe se comprend seul.** Le groupe garde son nom pour le lecteur d'écran (`role="group"` et `aria-label`). | Un titre visible doit séparer deux groupes de nature différente. |
| E10 | **Texte secondaire en `--muted`**, qui reste AA : 6,7:1 sur le fond sombre, 5,3:1 sur le washi, 4,8:1 au pire (`--surface-2` clair). Jamais d'opacité sur du texte, jamais de gris en dur. | `tokens.test.ts` ; chercher `opacity` sur un texte dans le diff. |
| E11 | **Une couleur d'accent par bloc**, avec son sens : jade pour agir, or pour récompenser, hanko pour l'adversaire. Pas d'icône colorée pour décorer. | Regarder la capture en vision floutée : la zone la plus contrastée doit être l'action principale ou le goban. |
| E12 | **Révélation progressive** : les réglages sûrs par défaut sont repliés derrière une ligne de résumé et « Changer » (modèle : jouer en ligne, #571). | Aucune décision obligatoire avant l'action principale. |
| E13 | **Un seul personnage mis en avant**, une seule image forte (le goban d'abord). | Compter portraits et illustrations de plus de 44 px. |
| E14 | **Retirer avant d'ajouter.** Une PR qui ajoute un bloc au premier regard dit lequel elle retire, ou pourquoi aucun. | Revue de PR. |

Audit d'épure (#592) : `docs/ux/epure-2026-10.md`. Il applique ces règles sans en changer les seuils, et donne le tableau avant / après de chaque écran (blocs, plus grand groupe, phrases, lignes de détail, chiffres). Sur l'accueil : E5, E6 et E9 (tuiles de mode sans ligne de détail, détail gardé dans l'`aria-label` ; « Aujourd'hui » devenu le nom du groupe pour le lecteur d'écran ; bulle de la partie classée en une phrase ; promesse de Mochi seulement avant la première pierre), et E2 (le réglage « Plateau 9 × 9 » rangé sous l'adversaire, dans le même bloc : 6 blocs → 5). Dans Problèmes : E4, E6, E7, E8 et E13.

Ce qu'on garde quand même : le libellé visible de chaque onglet et de chaque action (l'icône seule ne suffit pas), la phrase qui explique un mot du go là où il apparaît (atari, ko, komi, byo-yomi), et les états (à faire, fait, verrouillé) qui ne reposent jamais sur la couleur seule.

## Do's and Don'ts

### Do
- Utilise les rôles de `tokens.css` (`var(--surface)`, `var(--muted)`…) et les composants de `app.css`.
- Mets une seule action en relief, en jade, et écris-la avec un verbe qui dit ce qui arrive (« Jouer contre Pomme », « Défier Caillou »).
- Laisse le goban prendre la place : il est l'image de l'accueil et de la partie.
- Groupe les tuiles qui se suivent en un seul bloc ; varie leur nature (vignette, chemin, pointillés).
- Fais parler Mochi en une phrase, avec le bon visage (sceau ou portrait).
- Tutoie, une idée par phrase, un mot par objet (`docs/design/vocabulaire.md`). Explique un mot du go la première fois.
- Vérifie chaque écran en 390 × 844 et 320 × 568, sombre et clair, avec les mouvements réduits.
- Donne un titre accessible à tout portrait, et un `aria-label` à tout groupe sans titre visible.

### Don't
- Pas de deuxième bouton jade, pas de deuxième relief, pas d'ombre sur une tuile.
- Pas de hex ni de taille de police en dur dans un nouvel écran (l'audit #509 en a compté 100 et 90 : ne pas en ajouter).
- Pas de bordure ni de liseré coloré sur les tuiles et les retours : une teinte suffit.
- Pas de serif, pas de majuscules d'étiquette, pas de « A · B », pas de flèche « → » ni de chevron « › » décoratif.
- Pas d'icône d'une bibliothèque (Lucide, Material), pas de pastille de couleur derrière l'icône active.
- Pas de vermillon pour autre chose que les adversaires, les problèmes et les alertes.
- Pas de rond de chargement générique : `Reflexion`.
- Pas d'animation qui ne répond pas à un geste, pas d'animation de `width`, `left` ou `top`.
- Pas de « Continuer » hors de la leçon ; pas de « défi » pour la boucle quotidienne.
- Pas de dégradés multiples, de visages réalistes, de clichés nationaux, ni de texte dans un portrait.

## Responsive

### Cibles
- **Référence** : 390 × 844 (iPhone 12 à 15). Les captures de revue et les maquettes Figma sont à cette taille.
- **Plancher** : 320 × 568 (iPhone SE) sans défilement horizontal ; aucun débord à 195 px de large ni à 200 % de texte.
- **Plafond** : la colonne s'arrête à 560 px et se centre.

### Points de rupture réellement utilisés
| Requête | Ce qui change |
|---|---|
| `max-width: 359px` | Petits téléphones : moins d'air entre les blocs, libellés resserrés (15 feuilles). |
| `max-height: 640px` / `700px` / `600px` | Petite hauteur : les pictogrammes et les détails des modes cèdent leur place, les noms restent. |
| `min-height: 760px` | Écran haut : Mochi plus grand dans la leçon (88 ou 96 px) et bulle en `--fs-l`. |
| `min-width: 600px` | Large : le plateau de la partie et le fond de la fin ne débordent plus la gouttière. |
| `@container (max-width: 5.4em)` sur un onglet | Libellé court (« Appr. », « Probl. ») au zoom 200 % ; le nom entier reste lu. |
| `hover: hover` et `pointer: fine` | Survol, seulement à la souris. |

### Zones sûres
`env(safe-area-inset-top)` sur `body`, `env(safe-area-inset-bottom)` sous la barre du bas, la barre d'actions, le bouton fixe et les feuilles. `scroll-padding-bottom` garde un élément focalisé au-dessus de la barre (WCAG 2.4.11).

### Stratégie
On ne cache pas l'action principale : on réduit d'abord le vide, puis les détails (E6), puis la taille du goban, qui suit la place restante. Le Profil doit tenir sans défiler en 390 × 844 (vérifié par les tests).

## Contraintes du projet

- **Cibles tactiles** : 44 × 44 px au moins (`--cible-min`) ; 48 px pour un bouton secondaire, 56 px pour le bouton principal, 60 px pour un onglet, 64 px pour une action de partie. Seules les intersections du goban y échappent (le clavier et la confirmation au doigt prennent le relais).
- **Contraste** : AA, 4,5:1 pour le texte, 3:1 pour les éléments graphiques, dans les deux modes. Vérifié par `src/ui/tokens.test.ts` : toute nouvelle paire y entre.
- **Sombre et clair** : sombre par défaut ; clair par `prefers-color-scheme: light` ou par `data-theme="light"` (et `data-theme="dark"` pour forcer le sombre). Les deux blocs de `tokens.css` doivent rester identiques.
- **Mouvements réduits** : chaque animation est sous `prefers-reduced-motion: no-preference`, ou s'annule sous `reduce`. Les jetons de durée passent à 0.
- **Focus clavier** : `outline: 3px solid var(--focus)`, décalage 2 px, sur tout élément interactif.
- **Aucune librairie d'interface** : ni kit de composants, ni bibliothèque d'icônes, ni framework CSS. Dépendances d'exécution : React, les deux polices, Supabase, TensorFlow.js, PostHog, Sentry.
- **Budget initial** (`npm run build && npm run budget`, gzip) : JS initial 150 Ko (149,3 Ko le 16/10), CSS initial 22 Ko (21,4 Ko), polices 80 Ko, 60 Ko par écran chargé à la demande. Un nouvel écran charge sa feuille de style avec lui. Relever un budget est une décision à justifier dans la PR.
- **Langue** : français d'abord, puis anglais (`src/content/i18n/fr.ts`, `en.ts`) ; un texte n'est jamais écrit en dur dans un composant.

## Agent prompt guide

### Avant de toucher un écran
1. Lis ce fichier, puis le CSS de l'écran et ses tests e2e.
2. Nomme l'action principale de l'écran en une phrase. S'il y en a deux, simplifie d'abord.
3. Compte les blocs et les choix au premier regard (Épure, E1 à E3).

### Pendant
- Couleurs : seulement les rôles. Tailles : seulement les jetons `--fs-*`, `--space-*`, `--radius-*`, `--cible-*`.
- Un nouveau composant ? Vérifie d'abord `app.css` et `src/ui/` : bouton, tuile, `.seg`, `.lien`, `Bubble`, `BoutonRetour`, `Reflexion`, `PastilleXp` existent.
- Mochi : choisis `voix="interface"` ou `voix="coach"`, et ajoute l'écran à `src/ui/mochiRegle.test.ts`.
- Mouvement : un jeton de durée, `transform` et `opacity` seulement, et la version réduite.

### Avant de livrer
- Captures 390 × 844 et 320 × 568, sombre et clair.
- Tableau Épure rempli pour l'écran touché (avant et après).
- `npx vitest run src/ui/tokens.test.ts`, les e2e de l'écran, et `npm run budget` si le chargement initial change.
- Skills : `frontend-design`, `design-critique`, `mobile-pro-rules`, `accessibility-review`.

### Exemples de demandes
- « Ajoute une tuile au bloc “Aujourd'hui” de l'accueil : `.tuile` sur `--surface`, titre Bricolage 700 16 px, sans détail sous le titre, groupée avec les autres (coins intérieurs `--radius-xs`). Retire un bloc au premier regard ou explique pourquoi aucun. »
- « Écran de fin de série : une bulle `voix="coach"` en humeur `fier`, une phrase, un `.cta` “Problème suivant”, la pastille XP en or. Aucun autre chiffre. Confettis seulement hors mouvements réduits. »
- « Écran de réglage : résumé sur une ligne, lien “Changer” de 44 px qui déplie des `.seg`, aucune décision avant le bouton principal. »

## Known Gaps

- Le Figma « Jeu de go : Encre & Jade » a encore des titres en Shippori Mincho sur les pages Composants et Écrans : le code fait foi.
- `docs/design/encre-et-jade.md` cite un bandeau `.strip` ; dans le code, le bandeau joueur est `.joueur` (`partie.css`).
- Il reste des hex et des tailles de police en dur dans des feuilles d'écran (audit #509) et des alias v1 dans les styles en ligne.
- Les durées de pose (140 ms sur le goban) et de quelques animations d'écran sont écrites en dur, sans jeton.
- Les seuils de l'Épure (E2, E3, E4) sont fixés ici ; l'audit #592 les a appliqués sans les changer. Deux tensions restent à trancher par Florian : grade et cote affichés ensemble sur l'accueil (E7, E8, décision #432), et les modes « En ligne » et « Un ami » visibles avant la première partie finie (E2, décision #429).
