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
| `loader.ts` | Choix du backend (WebGPU, puis WebGL, puis CPU), téléchargement (repli, progression, empreinte) et cache du réseau (Cache API) |
| `prechargement.ts` | Règle du préchargement après une partie (données mobiles), backend mémorisé, affichage en Mo (#475) |
| `worker.ts` | Le Web Worker : importe TensorFlow.js dynamiquement, hors du bundle principal |
| `client.ts` | Pilote du Worker côté page, avec délais et état (`inactif`, `chargement`, `pret`, `indisponible`) |
| `fakeNet.ts` | Petit réseau factice au bon format, pour les tests |

L'API publique est dans `src/engine/index.ts` : `bestMove(position, niveau)`, `analyze(position, options)`,
`ownership(position)`, `preloadKataGo()`, `kataGoInfo()`, `ecouterKataGo(f)` (état et progression du téléchargement),
`prechargerApresPartie(partiesLancees)` (préchargement discret, #475).

## Réseau

- Servi par l'app depuis #475 : `public/reseaux/g170-b6c96-s175395328-d26788732.f5d32604.bin.gz` (empreinte SHA-256 dans
  le nom, cache d'un an dans vercel.json), 3,8 Mo. Versionné dans le dépôt, avec sa licence (`LICENSE-KataGo.txt`).
- Repli : la copie du dépôt KataGo (`raw.githubusercontent.com/lightvector/KataGo/master/cpp/tests/models/…`), l'adresse
  par défaut avant #475. L'empreinte est vérifiée dans les deux cas.
- `VITE_KATAGO_MODEL_URL` remplace notre adresse (sans vérification d'empreinte : ce peut être un autre réseau).
- Le réseau est téléchargé une fois puis lu depuis le cache `katago-reseaux-v1`. Jamais sans action du joueur ou sans
  le contexte de préchargement décrit dans `prechargement.ts` (règle des données mobiles).
- Tests avec le vrai réseau : `npm run fetch-model` le recopie dans `public/models/` (ignoré par git), ce qui active
  `real.test.ts`, `e2e/revue-katago.spec.ts` et les autres tests facultatifs.
- Mesures avant/après et limites iOS : `docs/qa/katago-demarrage-475.md`.

## Repli

Si le Worker, le backend ou le réseau manquent, `bestMove` joue avec le moteur simple (réglages de Caillou)
et `analyze` renvoie une estimation simple (`engine: 'simple'`). Pomme et Caillou n'utilisent jamais KataGo.

## Licence

`parse.ts`, `net.ts` et `features.ts` sont adaptés de web-katrain (https://github.com/Sir-Teo/web-katrain,
commit `8dd813a`, licence MIT, copie dans `LICENSE-web-katrain`). Le réseau g170 vient du projet KataGo
(https://github.com/lightvector/KataGo).
