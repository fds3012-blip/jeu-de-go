---
name: personnages-go
description: Charte des personnages du jeu de go (les 9 adversaires et Mochi) - grille, palette, trait, expressions, humeurs et usages. Use when drawing, modifying or placing a character portrait, a mascot expression, an avatar, or any illustration of an opponent or of Mochi.
---

# Personnages du jeu de go

Skill écrite pour ce projet. Elle s'appuie sur `illustration-style` et sur `docs/design/v2/identite.md`.

## Distribution
- 9 adversaires, par ordre de force :
  - Pomme, Caillou, Bambou (encre vermillon) ;
  - Renard, Rivière, Tigre (encre indigo) ;
  - Montagne, Dragon, Sensei (encre noire et or).
- Mochi, le coach, est un petit chat en jade. Il encourage et explique, il ne joue jamais.
- Chacun est un animal, un objet ou un esprit stylisé. Un seul trait de caractère, lisible au premier coup d'œil.
  - Pomme : curieuse.
  - Caillou : têtu.
  - Bambou : joyeux.
  - Renard : rusé.
  - Rivière : calme.
  - Tigre : intense.
  - Montagne : sage.
  - Dragon : majestueux.
  - Sensei : bienveillant, sans caricature culturelle.

## Grille et trait
- Portrait en buste dans un cadre arrondi (rayon de 22 % de la taille). viewBox de 100 × 100, zone utile de 12 à 88.
- Trait d'encre de 2,5 unités, extrémités et jonctions arrondies, couleur sumi `#1C1916` ou encre du palier.
- Aplats, 3 à 4 couleurs par portrait prises dans les jetons (papier, kaya, jade, or, hanko, indigo), plus un reflet clair en haut à gauche, comme sur les pierres du goban.
- Le sceau de l'adversaire apparaît en petit dans un coin, comme une signature.
- Contrôle à deux tailles : lisible à 44 px (la silhouette et les yeux suffisent), et beau à 160 px.

## Humeurs
- `neutre` : état par défaut.
- `content` : l'adversaire vient de gagner.
- `surpris` : tu viens de le battre.
- Mochi a aussi `fier` et `pensif`.
- On change d'abord les yeux et la bouche, puis les sourcils. On ne touche jamais la silhouette : le personnage doit rester reconnaissable.

## Usages
- **Accueil** : grand portrait et bulle de réplique.
- **Partie** : petit portrait dans l'en-tête.
- **Fin de partie** : portrait en humeur `surpris` ou `content`, avec le tampon BATTUE.
- Un seul personnage mis en avant par écran.
- Avec les mouvements réduits, aucun rebond à l'entrée.

## À ne pas faire
- Pas de dégradés multiples.
- Pas de visages réalistes.
- Pas de clichés nationaux.
- Pas plus de 4 couleurs.
- Pas de texte dans l'illustration.
- Jamais de portrait sans titre accessible.
