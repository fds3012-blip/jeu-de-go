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
    // Compter les points : un boulier, trois pierres comptées, une à compter.
    case 'l7': return (<>
      <path d="M24 34H76M24 50H76M24 66H76" stroke={W} strokeWidth="3" strokeLinecap="round" />
      <g fill={W}><circle cx="34" cy="34" r="7" /><circle cx="48" cy="34" r="7" /><circle cx="34" cy="50" r="7" /><circle cx="66" cy="66" r="7" /></g>
      <circle cx="66" cy="50" r="6" fill={C} stroke={W} strokeWidth="2.6" />
    </>);
    // Les premiers coups : le goban et ses coins pris d'abord ; le centre, encore vide, vient après.
    case 'l8': return (<>
      <rect x="24" y="24" width="52" height="52" rx="3" stroke={W} strokeWidth="3" fill="none" />
      <path d="M50 24V76M24 50H76" stroke={W} strokeWidth="1.6" opacity=".6" />
      <g fill={W}><circle cx="33" cy="67" r="7" /><circle cx="67" cy="33" r="7" /></g>
      <circle cx="33" cy="33" r="6.5" fill={C} stroke={W} strokeWidth="2.6" />
      <circle cx="50" cy="50" r="4" fill="none" stroke={W} strokeWidth="2.2" />
    </>);
    // Le filet : la pierre adverse enfermée sous un arc, sans être touchée.
    case 'l9': return (<>
      <path d="M27 62A23 23 0 0 1 73 62" stroke={W} strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M38 44 44 51M50 39V48M62 44 56 51" stroke={W} strokeWidth="2.2" strokeLinecap="round" opacity=".8" />
      <circle cx="50" cy="61" r="8.5" fill={C} stroke={W} strokeWidth="2.8" />
      <g fill={W}><circle cx="27" cy="62" r="7" /><circle cx="73" cy="62" r="7" /></g>
    </>);
    // La prise en retour : une pierre donnée en bas, trois reprises en haut ; la flèche revient.
    case 'l10': return (<>
      <g fill={C} stroke={W} strokeWidth="2.6"><circle cx="31" cy="37" r="7.5" /><circle cx="50" cy="37" r="7.5" /><circle cx="69" cy="37" r="7.5" /></g>
      <circle cx="40" cy="66" r="8.5" fill={W} />
      <path d="M52 68C66 70 74 62 73 51" stroke={W} strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M66 53 73 45 79 54Z" fill={W} />
    </>);
    // La course aux libertés : deux chaînes face à face, chacune ses libertés comptées.
    case 'l11': return (<>
      <path d="M40 34V66M60 34V66" stroke={W} strokeWidth="3" />
      <g fill={W}><circle cx="40" cy="38" r="8" /><circle cx="40" cy="62" r="8" /></g>
      <g fill={C} stroke={W} strokeWidth="2.6"><circle cx="60" cy="38" r="7.5" /><circle cx="60" cy="62" r="7.5" /></g>
      <g fill={W}><circle cx="24" cy="38" r="3.5" /><circle cx="24" cy="62" r="3.5" /><circle cx="76" cy="38" r="3.5" /><circle cx="76" cy="62" r="3.5" /></g>
    </>);
    // Le faux œil : un œil entouré, mais un coin pris par l'adversaire.
    case 'l12': return (<>
      <g fill={W}>
        <circle cx="50" cy="31" r="8" /><circle cx="31" cy="50" r="8" /><circle cx="69" cy="50" r="8" /><circle cx="50" cy="69" r="8" />
        <circle cx="31" cy="31" r="7" /><circle cx="69" cy="31" r="7" /><circle cx="31" cy="69" r="7" />
      </g>
      <circle cx="69" cy="69" r="6.5" fill={C} stroke={W} strokeWidth="2.6" />
      <circle cx="50" cy="50" r="3.5" fill="none" stroke={W} strokeWidth="2" opacity=".75" />
    </>);
    // Le point vital : trois points en ligne, la pierre au milieu, visée.
    case 'l13': return (<>
      <path d="M24 56H76" stroke={W} strokeWidth="3" strokeLinecap="round" />
      <g fill="none" stroke={W} strokeWidth="2.2" opacity=".8"><circle cx="30" cy="56" r="4.5" /><circle cx="70" cy="56" r="4.5" /></g>
      <circle cx="50" cy="56" r="17" fill="none" stroke={W} strokeWidth="2.4" />
      <path d="M50 26V34" stroke={W} strokeWidth="3" strokeLinecap="round" />
      <circle cx="50" cy="56" r="9.5" fill={W} />
    </>);
    // Le seki : une pierre de chaque camp, deux libertés partagées, que personne ne remplit.
    case 'l14': return (<>
      <path d="M50 27 37 50 50 73 63 50Z" stroke={W} strokeWidth="2.4" strokeLinejoin="round" fill="none" opacity=".8" />
      <circle cx="37" cy="50" r="9.5" fill={W} />
      <circle cx="63" cy="50" r="9" fill={C} stroke={W} strokeWidth="2.8" />
      <g fill="none" stroke={W} strokeWidth="2.4"><circle cx="50" cy="27" r="4.5" /><circle cx="50" cy="73" r="4.5" /></g>
    </>);
    // Finir la partie : la frontière fermée, pierre contre pierre ; un seul point neutre (dame) reste.
    case 'l15': return (<>
      <g fill={W}><circle cx="43" cy="27" r="7" /><circle cx="43" cy="50" r="7" /><circle cx="43" cy="73" r="7" /></g>
      <g fill={C} stroke={W} strokeWidth="2.6"><circle cx="59" cy="27" r="6.5" /><circle cx="59" cy="73" r="6.5" /></g>
      <circle cx="59" cy="50" r="4" fill="none" stroke={W} strokeWidth="2.2" />
      <g fill={W} opacity=".85"><rect x="23" y="35" width="8" height="8" rx="1.5" /><rect x="23" y="57" width="8" height="8" rx="1.5" /></g>
    </>);
    // Compter une partie : le territoire, plus les prisonniers.
    case 'l16': return (<>
      <g fill={W}>
        <rect x="24" y="26" width="10" height="10" rx="2" /><rect x="38" y="26" width="10" height="10" rx="2" />
        <rect x="24" y="40" width="10" height="10" rx="2" /><rect x="38" y="40" width="10" height="10" rx="2" />
      </g>
      <path d="M66 31V45M59 38H73" stroke={W} strokeWidth="3.4" strokeLinecap="round" />
      <g fill={C} stroke={W} strokeWidth="2.6"><circle cx="40" cy="66" r="7.5" /><circle cx="60" cy="66" r="7.5" /></g>
    </>);
    // Les formes d'yeux : un espace en T, trois points vides et le centre qui les touche tous.
    case 'l17': return (<>
      <path d="M28 62H72M50 62V38" stroke={W} strokeWidth="3" strokeLinecap="round" />
      <g fill="none" stroke={W} strokeWidth="2.4"><circle cx="28" cy="62" r="5" /><circle cx="72" cy="62" r="5" /><circle cx="50" cy="36" r="5" /></g>
      <circle cx="50" cy="62" r="10" fill={W} />
    </>);
    // Les bonnes formes : la bouche du tigre, trois pierres autour d'un point vide.
    case 'l18': return (<>
      <g fill={W}><circle cx="50" cy="30" r="9" /><circle cx="30" cy="52" r="9" /><circle cx="70" cy="52" r="9" /></g>
      <circle cx="50" cy="52" r="4.5" fill="none" stroke={W} strokeWidth="2.2" />
      <circle cx="50" cy="72" r="7" fill={C} stroke={W} strokeWidth="2.6" />
    </>);
    // Les pierres qui coupent : le diamant (ponnuki) qui reste après la prise.
    case 'l19': return (<>
      <path d="M50 30 30 50 50 70 70 50Z" stroke={W} strokeWidth="2.4" strokeLinejoin="round" fill="none" opacity=".8" />
      <g fill={W}><circle cx="50" cy="28" r="8.5" /><circle cx="28" cy="50" r="8.5" /><circle cx="72" cy="50" r="8.5" /><circle cx="50" cy="72" r="8.5" /></g>
    </>);
    // Relier et mourir : trois pierres blanches reliées, toutes prises par une seule pierre noire.
    case 'l20': return (<>
      <path d="M26 46H74" stroke={W} strokeWidth="3" strokeLinecap="round" />
      <g fill={C} stroke={W} strokeWidth="2.6"><circle cx="30" cy="46" r="8" /><circle cx="50" cy="46" r="8" /><circle cx="70" cy="46" r="8" /></g>
      <circle cx="50" cy="70" r="9" fill={W} />
    </>);
    // Le manque de libertés : deux pierres qui se touchent presque, et la dernière liberté entre elles.
    case 'l21': return (<>
      <g fill={C} stroke={W} strokeWidth="2.6"><circle cx="32" cy="50" r="9" /><circle cx="68" cy="50" r="9" /></g>
      <circle cx="50" cy="50" r="5" fill="none" stroke={W} strokeWidth="2.4" />
      <g fill={W}><circle cx="32" cy="28" r="7" /><circle cx="68" cy="28" r="7" /><circle cx="50" cy="72" r="7" /></g>
    </>);
    // Sente et gote : la pierre qui garde la main, et la flèche de l'initiative.
    case 'l22': return (<>
      <circle cx="38" cy="50" r="12" fill={W} />
      <path d="M56 50H76M68 41 77 50 68 59" stroke={W} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="38" cy="74" r="7" fill={C} stroke={W} strokeWidth="2.6" />
    </>);
    // Le hane au premier rang : sur le bord, la pierre qui contourne.
    case 'l23': return (<>
      <path d="M22 74H78" stroke={W} strokeWidth="3" strokeLinecap="round" />
      <circle cx="40" cy="52" r="9" fill={W} />
      <circle cx="60" cy="52" r="9" fill={C} stroke={W} strokeWidth="2.6" />
      <circle cx="60" cy="74" r="9" fill={W} />
    </>);
    // Agrandir ou réduire : un espace, et les deux flèches qui le poussent ou le serrent.
    case 'l24': return (<>
      <path d="M34 50H66" stroke={W} strokeWidth="3" strokeDasharray="4 5" strokeLinecap="round" />
      <path d="M28 40 18 50 28 60M72 40 82 50 72 60" stroke={W} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <g fill={W}><circle cx="50" cy="30" r="7" /><circle cx="50" cy="70" r="7" /></g>
    </>);
    // Les groupes du coin : l'angle du goban et la pierre au point du coin.
    case 'l25': return (<>
      <path d="M26 24V76H76" stroke={W} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="26" cy="58" r="8" fill={W} />
      <g fill={C} stroke={W} strokeWidth="2.6"><circle cx="46" cy="58" r="7" /><circle cx="46" cy="76" r="7" /></g>
    </>);
    // La course avec un œil : deux groupes face à face ; l'œil noir, cerclé, compte en dernier.
    case 'l26': return (<>
      <g fill={W}><circle cx="30" cy="40" r="8" /><circle cx="46" cy="40" r="8" /><circle cx="46" cy="58" r="8" /></g>
      <circle cx="30" cy="58" r="5" fill="none" stroke={W} strokeWidth="2.4" />
      <g fill={C} stroke={W} strokeWidth="2.6"><circle cx="66" cy="40" r="8" /><circle cx="66" cy="58" r="8" /></g>
      <path d="M30 76H70" stroke={W} strokeWidth="3" strokeLinecap="round" />
    </>);
    default: return <circle cx="50" cy="50" r="14" fill={W} />;
  }
}

interface Props {
  /** Identifiant de la leçon (l1 à l20). */
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
