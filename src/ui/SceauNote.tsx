// Sceau de note d'un coup (issue #71), dans la grammaire des sceaux (Sceau.tsx) : carré arrondi à l'encre,
// posé un peu de travers comme un tampon. Le symbole (!!, ★, !, ✓, ?!, ?, ??) double la couleur.
import { NOTE_INFO, type Note } from '../app/revue';
import { NOTE_ENCRE } from './notes';

/** Petit sceau en HTML (liste des coups, bilan). Décoratif : le libellé est porté par le texte voisin ou l'aria-label. */
export function SceauNote({ note, taille = 22 }: { note: Note; taille?: number }) {
  const e = NOTE_ENCRE[note], s = NOTE_INFO[note].symbole;
  return (
    <span className="sceau-note" data-note={note} aria-hidden="true"
      style={{ width: taille, height: taille, background: e.fond, color: e.texte, fontSize: taille * (s.length > 1 ? 0.5 : 0.62) }}>
      {s}
    </span>
  );
}
