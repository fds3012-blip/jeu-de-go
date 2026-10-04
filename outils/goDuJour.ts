// Go du jour léger (#433) : l'accueil ne montre que le titre et la position du problème du jour. Les ≈ 230 problèmes
// complets (consignes, explications, réfutations : ≈ 26 Ko gzip) sortent du JS initial ; l'accueil lit
// src/content/goDuJour.gen.ts, généré ici depuis src/content/puzzles.ts (≈ 5 Ko gzip) : id, titre et position seulement.
//
// Régénérer après l'ajout d'un lot de problèmes : `npm run go-du-jour` (outils/goDuJour.test.ts le rappelle sinon).
import { parsePuzzle, type PuzzleRow } from '../src/data/puzzles';

/** Contenu de src/content/goDuJour.gen.ts : un problème par ligne, dans l'ordre du calendrier du Go du jour. */
export function genererGoDuJour(problemes: readonly PuzzleRow[], calendrier: readonly string[]): string {
  const parId = new Map(problemes.map(p => [p.id, p]));
  const lignes = calendrier.map(id => {
    const p = parId.get(id);
    if (!p) throw new Error(`Go du jour : problème ${id} absent de ALL_PUZZLES`);
    if (!p.title) throw new Error(`Go du jour : problème ${id} sans titre`);
    // Problème illisible : écarté, comme parsePuzzles le fait pour la liste complète.
    const pz = parsePuzzle(p);
    return pz && `  [${JSON.stringify(id)}, ${JSON.stringify(p.title)}, ${JSON.stringify(pz.rows)}],`;
  }).filter(l => l !== null);
  return [
    '// Fichier généré par outils/goDuJour.ts (`npm run go-du-jour`) depuis src/content/puzzles.ts : ne pas modifier à la main.',
    '// Go du jour léger (#433) : id, titre français et position de chaque problème lisible, dans l’ordre du calendrier.',
    '// Les consignes et explications restent dans src/content/puzzles.ts, chargé avec l’écran des problèmes.',
    '// prettier-ignore',
    'export const GO_DU_JOUR: readonly (readonly [id: string, titre: string, rows: readonly string[]])[] = [',
    ...lignes,
    '];',
    '',
  ].join('\n');
}
