# Thème Encre & Jade (v2 : « le goban sous la lampe »)

Direction artistique : [`v2/direction.md`](v2/direction.md). Ce document décrit les jetons en place dans le code (`src/ui/tokens.css`) et dans Figma.

On joue la nuit, sous une lampe, sur un vrai goban. Le fond est une encre chaude (sumi), éclairée d'un halo doré en haut de l'écran. Le plateau en kaya est la seule matière vive. Trois couleurs ont chacune un sens :
- le **jade** sert à agir ;
- l'**or** marque les récompenses ;
- le **hanko** (vermillon des sceaux) signe les adversaires.

## Couleurs
| Rôle | Nom | Valeur |
|---|---|---|
| Fond | Sumi (encre chaude) | #1C1916, halo doré en haut |
| Tuiles, barres | Surface | #27221E |
| Coup courant, avatar | Surface 2 | #332D28 |
| Séparateurs | Trait | #3E3731 |
| Barre de navigation | Nuit chaude | #171411 |
| Texte principal | Papier | #F3EDE3 |
| Texte secondaire | Brume chaude | #A99F92 |
| Action principale | Jade | #3CC48E, tranche #1E8A5F, texte #07231A |
| Récompenses, séries | Or | #EFB84A |
| Adversaires, alertes | Hanko | #D2432C |
| Plateau | Kaya | #EDC27A à #C58D42 |

Mode clair « Papier » : fond washi #EFE8DC, tuiles #FBF8F2, texte sumi #1C1916, mêmes accents. Les titres restent en sans-serif.

## Typographie
- **Titres et chiffres** : Bricolage Grotesque, graisses 700 et 800, interlettrage −0,02 em. Elle est chaleureuse et joueuse, loin des serifs de prestige.
- **Interface** : Zen Kaku Gothic New, en 400, 500 et 700.
- **Polices auto-hébergées** (`@fontsource-variable/bricolage-grotesque`, `@fontsource/zen-kaku-gothic-new`), déclarées dans `src/ui/fonts.css` et importées par `src/main.tsx`.
  - Seul le sous-ensemble latin est embarqué : 4 fichiers `.woff2`, environ 70 Ko en tout.
  - Aucun appel à Google Fonts : la PWA marche hors ligne, et rien ne part vers un tiers (RGPD).
  - Le service worker (`public/sw.js`) met ces fichiers en cache comme tout fichier de `/assets/`.
- **Espaces fines insécables** avant `? ! : ;` et à l'intérieur de « » : fonction `fr()` de `src/ui/typo.ts`. Elle est déjà appliquée aux textes de l'accueil (`src/app/home.ts`). Les autres écrans suivront dans les phases suivantes.

## Principes
1. **Une seule action principale par écran**, en jade. C'est le **seul élément en relief de l'app** : ombre dure de 5 px (`--ombre-relief`), et le bouton s'enfonce de toute sa tranche à l'appui.
2. **Le goban est la seule audace.** Tout le reste est calme : tuiles sans bordure, barres sans cadre.
3. **Pas de kit de cartes identiques.**
   - Les tuiles qui se suivent forment un bloc groupé.
   - Le chemin des leçons est fait de pierres, pas de cartes.
   - Les retours sont des teintes, sans liseré de couleur.
4. **Mochi**, le chat coach, parle dans une bulle. Jamais plus de deux phrases.
5. **Les récompenses** (badges, séries) sont en or, avec une animation courte seulement au moment où on les obtient.

## Composants de base (`src/ui/app.css`)
| Classe | Rôle | Détails |
|---|---|---|
| `.cta`, `.btn.primary` | Bouton principal en relief | Jade, texte `--on-accent`, Bricolage 800 20 px, rayon 16 px, hauteur 56 px, ombre `0 5px 0 var(--accent-bord)` + halo jade. À l'appui : `translateY(5px)` et plus d'ombre. En mouvements réduits : pas de déplacement, le fond passe à `--accent-press`. `.cta` seul est fixé en bas, au-dessus de la navigation. Dans `.dock`, il est en 17,6 px pour que les libellés longs tiennent sur une ligne. |
| `.btn` | Bouton secondaire | À plat sur `--surface`, sans cadre (bordure transparente, que les écrans peuvent colorer pour un état), texte 700, hauteur 48 px. |
| `.seg` | Choix exclusif | Rail `--surface` ; le choix actif est une pastille inversée (`--text` sur `--bg`). |
| `.card` | Tuile | `--surface`, rayon 16 px, sans bordure. Deux tuiles qui se suivent sont groupées (coins intérieurs de 4 px, 2 px d'écart). |
| `.strip` | Bandeau joueur | Sans cadre. Le joueur au trait est sur `--surface`, avec un point `--accent-trait`. Nom en Bricolage 800. |
| `.path` | Chemin de pierres | Pierres `--surface-2`, faites en jade. La prochaine leçon a un anneau or et une tuile ; les autres lignes sont nues. |
| `.feedback`, `.notice` | Retour, avis | Teinte de jade, de hanko ou d'or mêlée à la surface (`color-mix`). |
| `.nav` | Barre de navigation | `--barre`. L'onglet actif est en `--text` 700, avec des traits plus épais. |
| `.lien`, `.link` | Lien | Souligné `--accent-trait` de 2 px. |
| `.top h1` | Marque | Bricolage 800, précédée d'une pierre noire et d'une pierre blanche qui se touchent. |

## Fichier Figma
[Jeu de go : Encre & Jade](https://www.figma.com/design/9Ft0rUVY3lB7cY7pIyjNti) (plan Starter).

- Page **Tokens** : palette, rôles des deux modes, espacements, rayons, tailles, typographie, mouvement.
- Page **Composants** : Bouton principal, Carte, Bandeau joueur, Barre de navigation, Bulle de Mochi (et Mochi), Pastille, Badge. Chaque composant a une variante `Thème=Sombre|Clair`.
- Page **Écrans** : Accueil, Partie, Problèmes, Leçon, Profil en 390 × 844. Ligne du haut : mode sombre. Ligne du bas : mode clair.

**Mise à jour v2 (phase 2 de l'issue #40)** :
- Variables passées en v2, en gardant leurs identifiants (les liaisons existantes suivent) :
  - la palette est renommée (`palette/sumi`, `palette/hanko`, `palette/jade-bord`…) ;
  - les nouveaux rôles sont ajoutés (`role/surface-2`, `role/barre`, `role/accent-bord`, `role/accent-trait`, `role/on-danger`, `role/focus`) ;
  - les collections s'appellent « Couleurs · Sombre (Sumi) » et « Couleurs · Clair (Papier) ».
- Rayons et tailles mis à jour : `radius/plateau` 10, `radius/bouton` 16, `cible/bouton` 48, `cible/cta` 56, `relief` 5.
- Nouvelle collection **Typographie** : `font/titre`, `font/ui`, graisses, `tracking/titre`, tailles.
- Nouveaux styles de texte : `Titre/Écran`, `Titre/Victoire`, `Titre/Section`, `Chiffre/Fort`, `Bouton/Principal`, `Texte/Courant`, `Texte/Fort`, `Texte/Secondaire`, `Texte/Navigation`.
- Page Tokens : les titres en Shippori Mincho sont passés en Bricolage Grotesque.
- **Reste à faire** : les pages Composants et Écrans ont encore des titres en Shippori Mincho. La limite d'appels MCP du plan Starter a été atteinte, et elles seront refaites avec les écrans des phases 3 à 6.

Contraintes du plan Starter : un seul mode par collection de variables, et trois pages au maximum. Les couleurs sont donc réparties en deux collections, avec les mêmes noms de rôles (`role/bg`, `role/text`…). Chaque variable porte sa syntaxe CSS (`var(--bg)`…).

### Une seule action principale par écran
| Écran | Action principale (jade, en relief) | Onglet actif |
|---|---|---|
| Accueil | Jouer | Accueil |
| Partie | Poser une pierre sur le plateau (pas de bouton jade ; Passer, Annuler, Abandonner restent secondaires) | aucun (plein écran) |
| Problèmes | Résoudre le problème 4 | Problèmes |
| Leçon | Continuer (après la bonne réponse) | Apprendre |
| Profil | Inviter un ami | Profil |

La barre de navigation des maquettes a quatre onglets : Accueil, Apprendre, Problèmes, Profil. « Jouer » devient l'action principale de l'Accueil.

## Tokens (`src/ui/tokens.css`)
Le fichier CSS et les variables Figma portent les mêmes noms. `src/ui/tokens.test.ts` vérifie trois choses :
- chaque paire texte/fond atteint le contraste AA (4,5:1) dans les deux modes ;
- chaque élément graphique atteint 3:1 (tranche du bouton, soulignés, focus, hanko) ;
- les valeurs de la direction v2 sont bien en place.

### Couleurs : rôles
| Token | Sombre | Clair | Usage |
|---|---|---|---|
| `--bg` | #1C1916 | #EFE8DC | fond d'écran |
| `--surface` | #27221E | #FBF8F2 | tuiles, barres, bulles, boutons secondaires |
| `--surface-2` | #332D28 | #E6DDCF | coup courant, avatar, pierre du chemin, bouton secondaire pressé |
| `--line` | #3E3731 | #D8CDBC | séparateurs, bord des barres |
| `--barre` | #171411 | #F7F2E9 | barre de navigation |
| `--text` | #F3EDE3 | #1C1916 | texte principal |
| `--muted` | #A99F92 | #675D53 | texte secondaire |
| `--accent` | #3CC48E | #3CC48E | fond du bouton principal |
| `--accent-bord` | #1E8A5F | #1E8A5F | tranche du bouton en relief |
| `--accent-press` | #34B07F | #34B07F | bouton principal pressé (mouvements réduits) |
| `--on-accent` | #07231A | #07231A | texte posé sur jade ou sur or |
| `--accent-texte` | #3CC48E | #126541 | jade utilisé comme texte (foncé d’un cran en #465 : 5:1 ou plus sur tous les fonds clairs, halo compris) |
| `--accent-trait` | #3CC48E | #1E8A5F | soulignés, point « à toi de jouer » |
| `--danger` | #D2432C | #D2432C | sceaux, pastilles, bordures d'alerte |
| `--on-danger` | #FFFFFF | #FFFFFF | texte posé sur hanko |
| `--danger-texte` | #EC735A | #B23520 | hanko utilisé comme texte |
| `--recompense` | #EFB84A | #EFB84A | fond des badges et séries |
| `--recompense-texte` | #EFB84A | #7A5000 | or utilisé comme texte (foncé d’un cran en #465, même marge) |
| `--focus` | #3CC48E | #1E8A5F | contour de focus clavier |
| `--halo` | or à 11 % | or à 22 % | halo de lampe (dégradé radial sur `body`) |
| `--ombre-relief` | tranche + halo jade | tranche + halo jade | ombre du bouton principal |
| `--ombre-plateau` | noire | brune | ombre du plateau sur la table |

Palette brute (identique dans les deux modes) : `--sumi`, `--sumi-2`, `--sumi-3`, `--trait`, `--nuit-chaude`, `--papier`, `--washi`, `--brume`, `--jade`, `--jade-bord`, `--or`, `--hanko`, `--kaya`, `--kaya-2`, `--grille`, `--blanc`, `--encre-jade`.

Alias v1 gardés pour les styles en ligne des écrans : `--encre`, `--encre-2`, `--ardoise`, `--nuit`, `--jade-fonce`, `--vermillon`. `--vermillon` pointe désormais vers `--danger-texte`, pour que les messages d'erreur restent lisibles dans les deux modes. Ces alias seront retirés quand les écrans seront refaits.

Règles :
- Le hanko pur (#D2432C) n'atteint pas 4,5:1 comme texte sur le sumi. Pour du texte, utilise `--danger-texte`.
- Le jade pur ne se détache pas du washi : en mode clair, soulignés et focus passent au jade foncé (`--accent-trait`, `--focus`).

### Typographie
- Familles : `--font-titre` (Bricolage Grotesque) et `--font-ui` (Zen Kaku Gothic New).
- Graisses : `--fw-regular` 400, `--fw-medium` 500, `--fw-bold` 700, `--fw-titre` 800. Interlettrage des titres : `--tracking-titre` −0,02 em.
- Tailles : `--fs-xs` .78rem, `--fs-s` .88rem, `--fs-m` 1rem, `--fs-l` 1.1rem, `--fs-xl` 1.25rem, `--fs-cta` 1.25rem, `--fs-2xl` 1.8rem, `--fs-3xl` 2rem, `--fs-base` 16px.
- Interlignes : `--lh-base` 1.5, `--lh-titre` 1.15.

### Espacements, rayons, tailles
- Espacements (grille de 4 px) : `--space-1` 4, `--space-2` 8, `--space-3` 12, `--space-4` 16, `--space-5` 20, `--space-6` 24, `--space-8` 32, `--space-10` 40, `--gouttiere` 16.
- Rayons : `--radius-xs` 4 (coin de la bulle côté personnage, jointure des tuiles groupées), `--radius-plateau` 10, `--radius-s` 12 (segments, retours), `--radius-bouton` 16, `--radius` 16 (tuiles), `--radius-pill` 999.
- Tailles : `--cible-min` 44, `--cible-bouton` 48, `--cible-cta` 56, `--nav-h` 60, `--relief` 5, `--largeur-max` 560, `--maquette-l` 390, `--maquette-h` 844.

### Mouvement
- `--duree-rapide` 100ms (appui).
- `--duree` 200ms (transitions).
- `--duree-recompense` 600ms (badge, série).
- `--ease`.

Avec `prefers-reduced-motion: reduce`, toutes les durées passent à 0ms, et le bouton en relief ne s'enfonce plus.
