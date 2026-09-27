# KataGo dans le navigateur

KataGo (réseau `g170-b6c96-s175395328-d26788732`) tourne dans un Web Worker avec TensorFlow.js.
Il n'y a aucun coût serveur : le calcul se fait sur l'appareil du joueur.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `parse.ts` | Lecture du format `.bin` de KataGo (v8 à v14), décompression gzip |
| `net.ts` | Évaluation du réseau avec TensorFlow.js (politique, valeur, score, propriété) |
| `features.ts` | Entrées du réseau (22 plans, 19 valeurs globales) depuis une `Position` |
| `search.ts` | Recherche PUCT compacte : `search(evaluator, position, options)` |
| `choose.ts` | Choix du coup d'un niveau : tolérance de perte en points, style |
| `loader.ts` | Choix du backend (WebGPU, puis WebGL, puis CPU) et cache du réseau (Cache API) |
| `worker.ts` | Le Web Worker : importe TensorFlow.js dynamiquement, hors du bundle principal |
| `client.ts` | Pilote du Worker côté page, avec délais et état (`inactif`, `chargement`, `pret`, `indisponible`) |
| `fakeNet.ts` | Petit réseau factice au bon format, pour les tests |

L'API publique est dans `src/engine/index.ts` : `bestMove(position, niveau)`, `analyze(position, options)`,
`ownership(position)`, `preloadKataGo()`, `kataGoInfo()`.

## Réseau

- Par défaut : `https://raw.githubusercontent.com/lightvector/KataGo/master/cpp/tests/models/g170-b6c96-s175395328-d26788732.bin.gz`
  (3,8 Mo, servi avec `Access-Control-Allow-Origin: *`, vérifié le 27/09/2026). `media.katagotraining.org` n'a pas pu être vérifié.
- Pour l'héberger avec l'app : `npm run fetch-model` (écrit dans `public/models/`, ignoré par git), puis
  `VITE_KATAGO_MODEL_URL=/models/g170-b6c96-s175395328-d26788732.bin.gz` dans Vercel.
- Le réseau n'est jamais commité. Il est téléchargé une fois puis lu depuis le cache `katago-reseaux-v1`.

## Repli

Si le Worker, le backend ou le réseau manquent, `bestMove` joue avec le moteur simple (réglages de Caillou)
et `analyze` renvoie une estimation simple (`engine: 'simple'`). Pomme et Caillou n'utilisent jamais KataGo.

## Licence

`parse.ts`, `net.ts` et `features.ts` sont adaptés de web-katrain (https://github.com/Sir-Teo/web-katrain,
commit `8dd813a`, licence MIT, copie dans `LICENSE-web-katrain`). Le réseau g170 vient du projet KataGo
(https://github.com/lightvector/KataGo).
