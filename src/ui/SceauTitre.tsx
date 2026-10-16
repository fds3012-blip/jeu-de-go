// Sceau d'un titre mensuel (#561), dans la grammaire des sceaux des adversaires (Sceau.tsx, docs/design/v2/sceaux.html) :
// carré arrondi à l'encre, cadre intérieur, pictogramme au papier. Trois paliers d'encre, comme l'échelle des adversaires :
// vermillon (Habitué), indigo (Expert), noir et or (Maître). Le pictogramme compte les pierres : 1, 2, puis 3 en montagne.
// Un sceau, jamais un portrait : ce n'est pas Mochi qui parle (règle #527, src/ui/mochiRegle.test.ts).
// Décoratif : le nom du titre est porté par le texte voisin.
import type { Titre } from '../app/titres';

const PAPIER = '#F7E9DA', OR = '#E9B949';
const ENCRE: Record<Titre, { fond: string; motif: string; contour?: string }> = {
  habitue: { fond: '#D2432C', motif: PAPIER },
  expert: { fond: '#2F4B8A', motif: PAPIER },
  maitre: { fond: '#1B1A18', motif: OR, contour: OR },
};
const PIERRES: Record<Titre, [number, number, number][]> = {
  habitue: [[50, 50, 17]],
  expert: [[37, 50, 13], [63, 50, 13]],
  maitre: [[50, 36, 12], [36, 61, 12], [64, 61, 12]],
};

export function SceauTitre({ titre, taille = 32 }: { titre: Titre; taille?: number }) {
  const e = ENCRE[titre];
  return (
    <span className="sceau sceau-titre" data-titre={titre} style={{ width: taille, height: taille }} aria-hidden="true">
      <svg viewBox="0 0 100 100" width="100%" height="100%" focusable="false">
        <rect x="6" y="6" width="88" height="88" rx="22" fill={e.fond} stroke={e.contour ?? 'none'} strokeWidth="3" />
        <rect x="12" y="12" width="76" height="76" rx="17" fill="none" stroke={e.motif} strokeWidth="2.2" opacity=".85" />
        {PIERRES[titre].map(([cx, cy, r]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill={e.motif} />)}
      </svg>
    </span>
  );
}
