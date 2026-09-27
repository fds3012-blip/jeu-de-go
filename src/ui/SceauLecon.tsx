// Sceaux des leçons (issue #54) : même grammaire que les sceaux des adversaires (src/ui/Sceau.tsx),
// mais en jade, l'encre de Mochi, puisque c'est lui qui enseigne.
// Pictogrammes sur une grille 100 × 100, zone utile 22–78 ; W = motif (papier), C = détails creusés (jade foncé).
import { useId, type ReactElement } from 'react';

const FOND = '#3CC48E', TRAIT = '#1E8A5F', PAPIER = '#F7E9DA';

/** Pictogramme de chaque leçon, dessiné avec le vocabulaire du go qu'elle enseigne. */
function motif(id: string, W: string, C: string): ReactElement {
  switch (id) {
    // Libertés et capture : une pierre et ses quatre libertés, sur les lignes.
    case 'l1': return (<>
      <path d="M50 26V74M26 50H74" stroke={W} strokeWidth="3" strokeLinecap="round" />
      <circle cx="50" cy="50" r="12.5" fill={W} />
      <g fill={W}><circle cx="50" cy="26" r="5" /><circle cx="74" cy="50" r="5" /><circle cx="50" cy="74" r="5" /><circle cx="26" cy="50" r="5" /></g>
    </>);
    // Atari : trois voisines adverses, une seule liberté.
    case 'l2': return (<>
      <path d="M50 50H75" stroke={W} strokeWidth="3" strokeLinecap="round" />
      <circle cx="50" cy="50" r="12" fill={W} />
      <g fill={C} stroke={W} strokeWidth="3.2"><circle cx="50" cy="27" r="9.5" /><circle cx="27" cy="50" r="9.5" /><circle cx="50" cy="73" r="9.5" /></g>
      <circle cx="75" cy="50" r="5" fill={W} />
    </>);
    // Techniques de capture : l'échelle, qui descend en escalier.
    case 'l3': return (<>
      <path d="M25 30H39V44H53V58H67V72" stroke={W} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <g fill={W}><circle cx="25" cy="30" r="6.5" /><circle cx="39" cy="44" r="6.5" /><circle cx="53" cy="58" r="6.5" /><circle cx="67" cy="72" r="6.5" /></g>
      <g fill={C} stroke={W} strokeWidth="2.6"><circle cx="39" cy="30" r="6" /><circle cx="53" cy="44" r="6" /><circle cx="67" cy="58" r="6" /></g>
    </>);
    // Le ko : la flèche qui tourne en rond, barrée.
    case 'l4': return (<>
      <path d="M69 40A21 21 0 1 0 71 57" stroke={W} strokeWidth="7" strokeLinecap="round" fill="none" />
      <path d="M61 27 76 37 60 45Z" fill={W} />
      <circle cx="50" cy="50" r="8" fill={W} />
    </>);
    // Vivre et mourir : un groupe autour de deux yeux.
    case 'l5': return (<>
      <g fill={W}>
        <circle cx="36" cy="35" r="8" /><circle cx="50" cy="35" r="8" /><circle cx="64" cy="35" r="8" />
        <circle cx="23" cy="50" r="8" /><circle cx="50" cy="50" r="8" /><circle cx="77" cy="50" r="8" />
        <circle cx="36" cy="65" r="8" /><circle cx="50" cy="65" r="8" /><circle cx="64" cy="65" r="8" />
      </g>
      <g fill="none" stroke={W} strokeWidth="2" opacity=".75"><circle cx="36.5" cy="50" r="3" /><circle cx="63.5" cy="50" r="3" /></g>
    </>);
    // Territoire et ouverture : un coin du goban, une pierre, le territoire marqué.
    case 'l6': return (<>
      <path d="M26 24V74H76" stroke={W} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="54" cy="46" r="10" fill={W} />
      <g fill={W}><rect x="34" y="55" width="8" height="8" rx="1.5" /><rect x="34" y="37" width="8" height="8" rx="1.5" /><rect x="52" y="62" width="8" height="8" rx="1.5" /></g>
    </>);
    default: return <circle cx="50" cy="50" r="14" fill={W} />;
  }
}

interface Props {
  /** Identifiant de la leçon (l1 à l6). */
  id: string;
  /** Côté en pixels. */
  taille?: number;
  /** Leçon pas encore commencée : sceau pâli. */
  pale?: boolean;
  className?: string;
}

/** Sceau jade d'une leçon. Décoratif : le titre de la leçon est toujours écrit à côté. */
export function SceauLecon({ id, taille = 36, pale = false, className }: Props) {
  const filtre = `sceau-lecon-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  // Graine stable par leçon : chaque sceau garde son grain d'un écran à l'autre.
  const graine = 20 + (parseInt(id.replace(/\D/g, ''), 10) || 0);
  const classes = ['sceau', 'sceau-lecon', pale && 'sceau-pale', className].filter(Boolean).join(' ');
  return (
    <span className={classes} style={{ width: taille, height: taille }} aria-hidden="true" data-lecon={id}>
      <svg viewBox="0 0 100 100" width="100%" height="100%" focusable="false">
        <defs>
          <filter id={filtre} x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="1.3" numOctaves="2" seed={graine} />
            <feDisplacementMap in="SourceGraphic" scale="3" />
          </filter>
        </defs>
        <g filter={`url(#${filtre})`}>
          <rect x="6" y="6" width="88" height="88" rx="22" fill={FOND} />
          <rect x="12" y="12" width="76" height="76" rx="17" fill="none" stroke={PAPIER} strokeWidth="2.2" opacity=".85" />
          {motif(id, PAPIER, TRAIT)}
        </g>
      </svg>
    </span>
  );
}
