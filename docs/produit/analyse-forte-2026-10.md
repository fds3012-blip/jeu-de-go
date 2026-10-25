# C8 : analyse plus forte à la demande, étude (#728)

Étude du chantier C8 de `docs/produit/constat-2026-10-22.md`. Aucune ligne du jeu ne change dans cette PR : un outil de
mesure (`outils/analyseForte.ts`), ses résultats figés (`outils/analyseForte.mesures.json`) et ce document.
Contraintes de Florian respectées : aucun service payant, aucun fichier lourd sur Vercel ou Supabase, aucune licence
incertaine embarquée.

## 1. Conclusion

1. **Une option gratuite et sûre existe, pour un seul candidat : `g170e-b10c128-s1141046784-d204142634`** (10,6 Mio).
   - Licence vérifiée : le fichier est dans le dépôt KataGo (`cpp/tests/models/`), sous la même licence MIT que le
     b6c96 déjà livré.
   - Hébergement : l'hébergement d'origine, `raw.githubusercontent.com`, déjà autorisé par notre CSP (`connect-src`)
     et déjà utilisé comme repli du b6c96. Aucun octet chez nous, aucune modification de Vercel ni de Supabase.
2. **Le gain est réel mais modeste, et il est ciblé.** Sur 84 problèmes de vie et mort prouvés (9 × 9) :
   - le b10 voit la réfutation d'une faute dans **75 % des cas contre 54 %** pour le b6 (20 positions que seul le b10
     lit juste, 3 que seul le b6 lit juste, p = 0,0005). C'est précisément la propriété que l'analyse expliquée lit
     pour dire « groupe mort » ;
   - le meilleur coup local est déjà trouvé par les deux (99 % contre 98 %) : aucune différence mesurable ;
   - à visites égales, KataGo publie +1 484 Elo pour le b10 (voir 3).
3. **Ce n'est pas « le niveau dan ».** Le b10 est un réseau de 3 millions de paramètres, à 64 visites sur un téléphone.
   Il ne remplace ni KaTrain ni AI Sensei. Un joueur de club le verra se tromper moins souvent sur les petites formes,
   pas disparaître les erreurs. Le message du réglage doit rester honnête (« plus fiable sur la vie et la mort »).
4. **Les réseaux plus gros (b15, b18) ne sont pas livrables ici** : licence non vérifiable (sites inaccessibles depuis
   cet environnement), 37 à 98 Mo, 5 à 12 fois plus lents par visite (voir 2 et 4).

### Décisions de Florian requises

- **D1. Dépendance d'hébergement.** Accepter de servir le b10 depuis le dépôt de KataGo (gratuit, mais un tiers : le
  fichier pourrait être déplacé, ou limité en débit si l'usage devenait très fort). Repli prévu : le petit réseau, avec
  empreinte SHA-256 vérifiée. L'alternative (une copie chez nous) ajoute 10,6 Mo à chaque déploiement Vercel et au
  transfert du quota gratuit, voir 5 : **non recommandée**.
- **D2. Faut-il le faire ?** Gain mesuré sur 9 × 9 seulement (voir 6). Si le but est « niveau dan », ce réseau ne
  suffit pas et la seule voie est un b18 (licence à confirmer sur katagotraining.org par quelqu'un qui y accède, 98 Mo,
  inutilisable sur un téléphone moyen).
- Si D1 et D2 sont oui, la PR d'implémentation peut partir (plan en 7).

## 2. Réseaux candidats

Sources : `docs/NetworkArchitectures.md` et `TrainingHistory.md` du dépôt KataGo (lus le 25/10/2026), tailles mesurées
pour b6 et b10 (en-têtes HTTP), estimées pour les autres à 3,72 octets par paramètre (rapport exact à 0,1 % pour b6 et
b10).

| Réseau | Paramètres | Taille | Coût par évaluation (b6 = 1) | Elo, visites égales | Licence | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| g170 b6c96 (actuel) | 1,03 M | 3 827 339 o (3,7 Mio) | 1 | -1 184 | MIT, vérifiée (dépôt, `LICENSE`) | référence |
| **g170e b10c128** | 3,0 M | **11 138 361 o (10,6 Mio)** | 1,75 (KataGo) ; **1,6 à 1,95 mesuré** | **+300** (+1 484 sur b6) | **MIT, vérifiée** (même dépôt) | **candidat** |
| g170e b15c192 | 9,9 M | ≈ 37 Mo (estimé) | 5 | +876 à +935 | non vérifiable ici (hébergé sur katagoarchive.org, inaccessible) | écarté |
| kata1 b18c384nbt | 26,3 M | ≈ 98 Mo (estimé) | 12,5 | (autre échelle : ≈ +3 660 sur b6) | à confirmer sur katagotraining.org (inaccessible ici) | écarté |

Notes :
- Les Elo viennent de deux tableaux de KataGo à échelles différentes (1 200 visites, visites fixes, pas temps fixe). Les
  écarts, pas les valeurs, sont comparables : b10 − b6 = 1 484 (g170) ou 1 560 (kata1).
- Les noms `kata1-b10`, `kata1-b15` n'existent pas comme fichiers dans le dépôt KataGo : les b6 à b20 de la liste sont
  les réseaux g170 mis en ligne sur le site d'entraînement. Seul le b10 étendu est dans le dépôt, avec sa licence.
- Compatibilité : `src/engine/katago/parse.ts` lit déjà le b10 (même format) ; l'outil l'a chargé et évalué.

## 3. Licence

- `LICENSE` du dépôt KataGo : licence de type MIT « pour tout le contenu autre que les bibliothèques de `cpp/external/`
  et `sha2.cpp` ». Copie du texte déjà dans `public/reseaux/LICENSE-KataGo.txt`. Le b10 étendu est un fichier de
  `cpp/tests/models/` : il tombe sous cette licence, comme le b6c96.
- Il n'y a pas de licence séparée pour `cpp/tests/models/` (pas de `README` ni de `LICENSE` dans ce dossier).
- Non vérifiable depuis cet environnement (le proxy refuse `katagotraining.org`, `katagoarchive.org`, la page des
  versions GitHub) : la licence des réseaux publiés sur le site d'entraînement. **Je ne la déclare pas.** Ne rien
  embarquer de ces réseaux tant que quelqu'un n'a pas lu la mention sur le site.
- À faire dans la PR d'implémentation : ajouter le nom du réseau et sa source à `public/reseaux/LICENSE-KataGo.txt` et à
  `src/engine/katago/README.md`, et la mention dans les Conditions si elles citent le réseau.

## 4. Mesures

Outil : `outils/analyseForte.ts` (mode d'emploi en tête du fichier). Résultats figés :
`outils/analyseForte.mesures.json`. Test de cohérence : `outils/analyseForte.test.ts` (CI, sans réseau).

### 4.1 Force relative

84 problèmes « joue et vit / tue » (`ALL_PUZZLES`), tous prouvés par recherche exhaustive (les réponses sont exactement
les coups gagnants). Komi 6,5, visites 16 et 64 (64 = celle de l'analyse expliquée), puis 192 sur 21 problèmes.

| Mesure (sur 84 problèmes) | b6c96 | b10c128 | Écart apparié |
| --- | --- | --- | --- |
| Meilleur coup **dans la zone du groupe** est un coup prouvé (64 visites) | 82 (98 %) | 83 (99 %) | 2 contre 1, p = 1 |
| Idem, 16 visites | 82 | 83 | 2 contre 1, p = 1 |
| Propriété du groupe juste **après la bonne réponse** | 79 (94 %) | 79 (94 %) | 1 contre 1, p = 1 |
| Propriété juste **après une faute** (la réfutation est vue) | 44 / 81 (54 %) | **61 / 81 (75 %)** | **20 contre 3, p = 0,0005** |
| Idem, 192 visites (21 problèmes) | | | 6 contre 0, p = 0,03 |
| Meilleur coup sur tout le plateau est un coup prouvé | 27 (32 %) | 23 (27 %) | non significatif |

Lecture :
- « Zone » : l'espace du groupe (`zoneDuGroupe`). Le critère « tout le plateau » est écarté : sur un plateau presque vide,
  jouer ailleurs n'est pas une erreur de lecture (les deux réseaux le font la plupart du temps).
- « Propriété » : moyenne de la propriété du réseau sur les pierres du groupe, comme le fait l'analyse expliquée. Elle
  vient d'**une seule évaluation** à la racine : elle ne dépend pas du nombre de visites (résultats identiques à 16 et
  64). C'est donc une propriété du réseau seul. La « faute » est le meilleur coup de la zone qui n'est pas une réponse
  prouvée (donc perdant).
- Plafond : les problèmes du dépôt sont faciles pour les deux réseaux sur le choix du coup. La différence se voit dans
  la compréhension (propriété), pas dans le coup.
- Cas connus de `src/go/explications-cas.ts` (64 visites, perte estimée de l'erreur jouée, b6 puis b10) : atari ignoré
  5,6 puis 5,7 ; capture ratée 13,4 puis 15,6 ; territoire 13,0 puis 15,5 ; coupe 8,2 puis 13,5 ; ouverture ambiguë
  1,7 puis 1,1. **Les chiffres changent et deux coups proposés changent** (territoire : C4 puis F4 ; ouverture : D4 puis
  C5). Une explication produite avec le b10 serait donc différente de la figée.

### 4.2 Temps par visite

Mesuré ici (Xeon 2,8 GHz, 4 cœurs, sans GPU), plateau vide, ms par visite :

| | b6c96 | b10c128 | Rapport |
| --- | --- | --- | --- |
| tfjs-node 9 × 9 | 17,5 | 28,5 | 1,63 |
| tfjs-node 19 × 19 | 26,7 | 52,0 | 1,95 |
| tfjs JS pur (CPU du navigateur) 9 × 9 | 360 | 917 | 2,54 |
| tfjs JS pur 19 × 19 | 1 683 | 4 167 | 2,48 |

**Téléphone : estimé, non mesuré.** Aucun appareil n'est accessible dans cet environnement, et Chromium sans GPU ne
représente pas un téléphone. Base : l'analyse expliquée mesure environ 2,5 s pour 64 visites du b6 en WebGL sur un
téléphone (≈ 40 ms par visite), et `src/engine/delais.ts` compte 60 ms par visite pour un téléphone lent.

| Appareil | b6c96, 64 visites | b10c128, 64 visites (× 1,6 à 2,5) |
| --- | --- | --- |
| Téléphone moyen, WebGL (≈ 40 ms/visite) | 2,5 s | 4 à 6 s |
| Téléphone lent, CPU (≈ 60 ms/visite) | 3,8 s | 6 à 10 s |

Une erreur expliquée fait deux recherches : **8 à 12 s** au lieu de 5 s sur téléphone moyen. Acceptable en arrière-plan
après le bilan, pas pour une partie contre l'ordi. Le b10 ne doit donc servir qu'à la revue et à l'étude (comme
prévu par C8), jamais aux adversaires. À confirmer sur appareils réels dans la recette C10. Pour le b15 (×5) on serait à
20 s et plus par recherche, pour le b18 (×12,5) à plus de 30 s, avec 100 Mo de poids : hors de portée d'un téléphone.

## 5. Hébergement : options gratuites et limites

| Option | Gratuit | Limites | Verdict |
| --- | --- | --- | --- |
| **A. Dépôt KataGo, `raw.githubusercontent.com`** (hébergement d'origine) | oui | CORS `*` vérifié (en-têtes lus le 25/10), cache 5 min côté GitHub, pas de quota publié mais limitation possible si l'abus est fort ; dépend d'un tiers ; déjà notre repli pour le b6c96 ; CSP déjà bonne | **recommandé**, avec empreinte SHA-256 et repli sur le b6 |
| B. Fichier dans `public/` (Vercel) | oui, dans le quota du plan | +10,6 Mo à chaque déploiement et dans le dépôt (pour toujours) ; consomme le transfert du plan (à relire sur Vercel, non vérifié ici) ; un dépassement de quota gratuit peut suspendre **tout le site** ; le plan gratuit est réservé à un usage non commercial (point juridique si Premium) | non recommandé |
| C. GitHub Releases de notre dépôt | oui | téléchargement redirigé vers un autre domaine, CORS réputé absent pour les navigateurs (non vérifié : github.com refusé par le proxy), CSP à modifier (donc `vercel.json`) | écarté |
| D. GitHub Pages | oui | quotas souples, interdit comme hébergement d'un service commercial | écarté |
| E. Autres (Hugging Face, katagotraining.org) | | inaccessibles ici, licence et conditions non lues | non étudiés |

Coût éventuel : **0 €** pour A. Débit : 10,6 Mo par joueur et par appareil, une seule fois (cache). À 1 000 joueurs
actifs par mois qui l'activent, 10 Go chez GitHub, 0 chez nous.

Le b6c96 sert déjà de précédent : tous les joueurs ont téléchargé 3,8 Mo depuis cette même adresse jusqu'à #475.

## 6. Limites de l'étude

- 9 × 9 seulement, formes simples (le dépôt n'a pas de problèmes 19 × 19 prouvés). Le gain sur de vraies parties de
  club n'est pas mesuré. Les parties relues (`PARTIES_RELUES`) n'ont pas de vérité terrain.
- La propriété « après une faute » est une mesure indirecte de la compréhension, pas une note de force en kyu.
- Le p du test des signes suppose des problèmes indépendants ; les problèmes d'un même lot se ressemblent.
- Temps sur téléphone estimé. Mémoire GPU et plafonds iOS du b10 non mesurés (3 M de paramètres flottants ≈ 12 Mo, sans
  doute sans risque, à confirmer).
- Licences des réseaux du site d'entraînement non lues.

## 7. Plan de la PR d'implémentation (si D1 et D2 sont oui)

- `src/engine/katago/cacheReseau.ts` / `loader.ts` : second réseau `analyse-approfondie`, même cache
  `katago-reseaux-v1`, empreinte SHA-256 de `1a8e05a4ea3fca20dab79410cbb566c760767fcdd2fa0b701cfe259a84cc8b04`
  (fichier mesuré ici), téléchargement avec progression, annulation (`AbortSignal`) et reprise (le téléchargement
  repart de zéro ; le fichier n'est rangé qu'entier et vérifié), espace annoncé « 10,6 Mo », conseil Wi-Fi, jamais de
  préchargement (`prechargement.ts` ne le connaît pas).
- Réglage « Analyse approfondie » dans Réglages › Analyse (FR + EN), désactivable, avec suppression du cache. Bouton
  équivalent dans la revue.
- Utilisé seulement par la revue et l'étude, jamais par les adversaires. Repli propre sur le b6c96 si absent, refusé ou
  hors ligne sans cache.
- **Les instantanés d'explication restent ceux du b6c96** : `src/go/explication-katago.test.ts` ne change pas. En
  mode approfondi, l'explication est générée à la volée par le même `explication.ts`, sans toucher à
  `explications-katago.json`. Comme les coups et pertes diffèrent (4.1), la légende de l'explication dit quel réseau l'a
  produite, et un test vérifie qu'aucune raison n'est donnée sans que la propriété la confirme.
- Aucun octet dans le JS initial (149,9/150 Ko) ni le CSS initial (20,36/22 Ko) : le réglage vit dans l'écran Réglages
  chargé à la demande, le réseau n'est jamais dans le service worker (`sw.js` ignore déjà `*.bin.gz`).
- Tests : Vitest de la logique de téléchargement et de cache avec `fetch` et `caches` simulés (succès, annulation,
  empreinte fausse, quota plein, hors ligne), e2e Playwright avec réseau simulé.
- Clause de sortie : si `raw.githubusercontent.com` répond mal, le réglage affiche « indisponible pour l'instant » et
  rien d'autre ne casse.

## 8. Reproduire

```
npm run fetch-model
curl -L -o public/models/g170e-b10c128-s1141046784-d204142634.bin.gz \
  https://raw.githubusercontent.com/lightvector/KataGo/master/cpp/tests/models/g170e-b10c128-s1141046784-d204142634.bin.gz
sha256sum public/models/g170e-b10c128-*.bin.gz     # 1a8e05a4…8b04
TFJS_NODE_DIR=<dossier avec @tensorflow/tfjs-node> npx vite-node outils/analyseForte.ts -- --modele g170e-b10c128-s1141046784-d204142634 --visites 64 --cas tout --sortie /tmp/b10.json
npx vite-node outils/analyseForte.ts -- --comparer /tmp/b6.json /tmp/b10.json
```

`public/models/` est ignoré par git. Compter 6 à 8 minutes par réseau avec TensorFlow natif, plusieurs heures sans.
