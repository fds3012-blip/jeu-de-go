// Index léger des leçons (#16, budget du chargement initial) : l'accueil n'a besoin que de l'identifiant, du titre et
// du nombre d'étapes de chaque leçon, et de la liste des chapitres. Le contenu complet (positions, démonstrations,
// consignes : content/lessons.fr.js) n'arrive qu'avec les écrans qui l'affichent (Apprendre, leçon, placement, aide).
//
// Régénérer après l'ajout ou la modification d'une leçon : `npm run index-lecons` (outils/leconsIndex.test.ts le
// rappelle sinon).

interface LeconSource { id: string; title: string; desc: string; taille?: number; steps: readonly unknown[] }
interface ChapitreSource { id: string; titre: string; intro: string; fin?: string; complet?: boolean; lecons: readonly string[] }

/** Contenu de src/content/leconsIndex.gen.ts : une ligne par leçon, dans l'ordre de content/lessons.fr.js. */
export function genererIndexLecons(lecons: readonly LeconSource[], chapitres: readonly ChapitreSource[]): string {
  const ids = new Set(lecons.map(l => l.id));
  for (const c of chapitres) for (const id of c.lecons) if (!ids.has(id)) throw new Error(`Chapitre ${c.id} : leçon ${id} absente`);
  const j = (v: unknown) => JSON.stringify(v);
  return [
    '// Fichier généré par outils/leconsIndex.ts (`npm run index-lecons`) depuis content/lessons.fr.js : ne pas modifier à la main.',
    '// Index léger des leçons (#16) : id, titre, description et nombre d’étapes, puis les chapitres. Le contenu complet',
    '// (positions, démonstrations, consignes) reste dans content/lessons.fr.js, chargé avec les écrans qui l’affichent.',
    '// prettier-ignore',
    // #454 : la taille du plateau n'est écrite que pour une leçon sur 13 × 13 ou 19 × 19 (9 × 9 par défaut).
    'export const LECONS_INDEX: readonly (readonly [id: string, titre: string, desc: string, etapes: number, taille?: 13 | 19])[] = [',
    ...lecons.map(l => `  [${j(l.id)}, ${j(l.title)}, ${j(l.desc)}, ${l.steps.length}${l.taille && l.taille !== 9 ? `, ${l.taille}` : ''}],`),
    '];',
    '',
    '// prettier-ignore',
    'export const CHAPITRES_INDEX: readonly { id: string; titre: string; intro: string; fin?: string; complet: boolean; lecons: readonly string[] }[] = [',
    ...chapitres.map(c => `  { id: ${j(c.id)}, titre: ${j(c.titre)}, intro: ${j(c.intro)}, ${c.fin ? `fin: ${j(c.fin)}, ` : ''}complet: ${c.complet !== false}, lecons: ${j(c.lecons)} },`),
    '];',
    '',
  ].join('\n');
}
