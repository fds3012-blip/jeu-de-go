# Revue honnête : précision, bilan et moment clé (issue #186)

Constat de l'analyse UX du 28/09 (`docs/ux/analyses/2026-09-28-partie.md`, C11 et C12) : après une défaite de 20,5 points,
la revue affichait « Précision Toi 97 % » et « Aucune erreur ». Elle s'ouvrait au coup 1, et « Rejouer d'ici » y
relançait une partie vide. Code : `src/app/revue.ts` (logique), `src/app/Revue.tsx` (écran). Tests : `src/app/revueHonnete.test.ts`.

## 1. La précision ne contredit jamais le score

La précision des notes (`precision`) reste la même formule : 100 / (1 + m / 4), m = perte moyenne par coup.
Sans KataGo, le moteur simple ne voit que les pertes sûres : une défaite peut donc sembler « précise ».
La précision **affichée** (`precisionHonnete`) est plafonnée par l'écart final.

| Défaite, en points ramenés au 9 × 9 | Précision maximale |
|---|---|
| moins de 3 (partie serrée) | pas de plafond |
| 3 à 10 | 80 % |
| 10 à 20 | 65 % |
| 20 et plus | 50 % |

- Une victoire n'est jamais plafonnée. Le plafond ne remonte jamais une précision plus basse.
- Écart ramené au 9 × 9 : on divise par taille / 9 (13 × 13 : 1,44 ; 19 × 19 : 2,11).
- Écart final : le résultat du SGF (`RE[W+20.5]`) quand il est chiffré, sinon l'estimation du moteur sur la dernière
  position (cas actuel : `Game.tsx` n'écrit pas encore `RE`). Un abandon garde l'estimation, jamais avec le mauvais signe.
- Exemples de l'analyse : défaite de 20,5 → 50 % (au lieu de 97 %) ; défaite de 61,5 → 50 % (au lieu de 99 %) ;
  victoires de 1,5 et 38,5 → précision calculée.

Pourquoi ces paliers : 50 % correspond à 4 points perdus par coup en moyenne dans la formule, ce qu'un écart de 20 points
en 9 × 9 (un quart du plateau) rend plausible pour un débutant. Les paliers sont simples à expliquer et testés un par un.

## 2. Le bilan de Mochi

Défaite nette (3 points ou plus, ramenés au 9 × 9) : jamais « Très belle partie », « plus juste que » ni « Aucune erreur ».
Mochi dit l'écart, puis :
- le moment clé s'il existe (« Tu perds de 20,5 points. Ta passe au coup 26 t'a coûté 12 points : rejoue-le. ») ;
- sinon la plus grosse erreur notée ;
- sinon « Pas de grosse erreur isolée : les points se sont perdus petit à petit. »

## 3. Le moment clé

- C'est le coup du joueur, **passes comprises**, où il a perdu le plus de points. Un coup se juge avec la réponse de
  l'adversaire : une passe ne change pas le plateau, c'est le coup gratuit suivant qui coûte.
- Perte : chute de l'avance du joueur entre la position avant son coup et celle après la réponse ; on garde la plus
  petite des mesures brute et lissée. Seuil : 3 points avec KataGo, 4 sans (seuils « Imprécision »).
- Ignorés : le premier coup (on relancerait une partie vide) et la passe de fin de partie quand il ne reste rien à prendre.
- Une passe non finale est aussi notée avec cette perte (elle n'est plus « Solide » quand elle offre des pierres).
- Une passe suivie de la passe de l'adversaire (fin de partie) n'est jamais le moment clé : le plateau n'a pas bougé,
  tout écart d'estimation n'est que du bruit. Sans KataGo, elle n'est plus notée comme une perte non plus.
- Écran : dès l'analyse finie, la revue saute au coup du moment clé, pierre jouée visible (sauf si le joueur a déjà navigué), avec la phrase de Mochi
  (« Moment clé : ici, tu as passé. Pomme a pris 6 pierres. Rejoue ce coup ! ») et « Revenir au début ».
  Une puce « Moment clé » y ramène. « Rejouer d'ici » repart de la position juste avant ce coup, Noir au trait.
- Mesure : `revue_rejouer` (`cle` vrai depuis le moment clé). Cible : 30 % des revues.
