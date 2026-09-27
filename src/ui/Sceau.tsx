// Sceaux (hanko) des adversaires et de Mochi. Référence validée : docs/design/v2/sceaux.html et sceaux.png.
// Pictogrammes dessinés sur une grille 100 × 100 (zone utile 22–78), trois paliers d'encre selon la force :
// vermillon (Pomme, Caillou, Bambou), indigo (Renard, Rivière, Tigre), noir et or (Montagne, Dragon, Sensei).
// Mochi, le coach, a son sceau jade.
import { useId, type ReactElement } from 'react';
import { battuAccorde, type SceauId } from './sceaux';

export type { SceauId };

interface Encre { fond: string; trait: string; motif: string; cadre: string; contour?: string }

const PAPIER = '#F7E9DA', OR = '#E9B949';
const VERMILLON: Encre = { fond: '#D2432C', trait: '#D2432C', motif: PAPIER, cadre: PAPIER };
const INDIGO: Encre = { fond: '#2F4B8A', trait: '#2F4B8A', motif: PAPIER, cadre: PAPIER };
const NOIR_OR: Encre = { fond: '#1B1A18', trait: '#1B1A18', motif: OR, cadre: OR, contour: OR };
const JADE: Encre = { fond: '#3CC48E', trait: '#1E8A5F', motif: PAPIER, cadre: PAPIER };

const ENCRE: Record<SceauId, Encre> = {
  pomme: VERMILLON, caillou: VERMILLON, bambou: VERMILLON,
  renard: INDIGO, riviere: INDIGO, tigre: INDIGO,
  montagne: NOIR_OR, dragon: NOIR_OR, sensei: NOIR_OR,
  mochi: JADE,
};

/** Pictogramme à l'encre : W = motif, C = détails creusés (couleur du fond). */
function motif(id: SceauId, W: string, C: string): ReactElement {
  switch (id) {
    case 'pomme': return (<>
      <path d="M50 38c-7-6-24-4-25 12-1 13 8 28 16 28 4 0 6-2 9-2s5 2 9 2c8 0 17-15 16-28-1-16-18-18-25-12Z" fill={W} />
      <path d="M50 38c0-6 2-10 6-13" stroke={W} strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M54 29c5-6 12-5 15-3-3 5-10 7-15 3Z" fill={W} />
    </>);
    case 'caillou': return (
      <g fill={W}><ellipse cx="50" cy="70" rx="24" ry="8" /><ellipse cx="49" cy="55" rx="17" ry="7" /><ellipse cx="51" cy="42" rx="11" ry="5.5" /><ellipse cx="50" cy="31" rx="6" ry="4" /></g>
    );
    case 'bambou': return (<>
      <g fill={W}><rect x="31" y="22" width="9" height="56" rx="3" /><rect x="47" y="30" width="9" height="48" rx="3" /></g>
      <path d="M31 40h9M31 58h9M47 46h9M47 63h9" stroke={C} strokeWidth="3" />
      <path d="M56 40c8-8 16-9 20-8-3 7-12 11-20 8Z" fill={W} /><path d="M40 33c-7-6-13-6-16-5 3 6 10 8 16 5Z" fill={W} />
    </>);
    case 'renard': return (<>
      <path d="M20 30 36 40 50 36 64 40 80 30 74 52 50 78 26 52Z" fill={W} />
      <path d="M34 50l9 3M66 50l-9 3" stroke={C} strokeWidth="3.6" strokeLinecap="round" />
      <path d="M45 70h10l-5 6Z" fill={C} /><path d="M27 34l8 5M73 34l-8 5" stroke={C} strokeWidth="2.6" strokeLinecap="round" />
    </>);
    case 'riviere': return (
      <g stroke={W} strokeWidth="5.2" strokeLinecap="round" fill="none">
        <path d="M22 38c7-7 14-7 21 0s14 7 21 0 11-6 14-4" /><path d="M22 52c7-7 14-7 21 0s14 7 21 0 11-6 14-4" /><path d="M22 66c7-7 14-7 21 0s14 7 21 0 11-6 14-4" />
      </g>
    );
    case 'tigre': return (<>
      <path d="M27 36l6-10 9 7h16l9-7 6 10c3 5 4 10 4 16 0 14-11 24-27 24S23 66 23 52c0-6 1-11 4-16Z" fill={W} />
      <path d="M50 33v9M42 34l2 7M58 34l-2 7M24 50h9M67 50h9M25 60l8-2M75 60l-8-2" stroke={C} strokeWidth="3.6" strokeLinecap="round" fill="none" />
      <circle cx="42" cy="52" r="3" fill={C} /><circle cx="58" cy="52" r="3" fill={C} /><path d="M45 61h10l-5 5Z" fill={C} />
    </>);
    case 'montagne': return (<>
      <circle cx="64" cy="38" r="10" fill={W} /><path d="M18 74 42 34l11 18 7-10 22 32Z" fill={W} />
    </>);
    case 'dragon': return (<>
      <path d="M72 50a22 22 0 1 1-10-18.5" fill="none" stroke={W} strokeWidth="8" strokeLinecap="round" />
      <g fill={W}><path d="M28 40l-7-4 8-2Z" /><path d="M34 29l-3-8 7 3Z" /><path d="M46 24l1-8 5 7Z" /><path d="M27 58l-8 2 6 5Z" /><path d="M36 70l-4 7 8-2Z" /><path d="M52 73l2 8 4-7Z" /></g>
      <path d="M60 30l13-6-3 9 6 2-10 7c-3-2-6-7-6-12Z" fill={W} /><circle cx="67" cy="31" r="1.8" fill={C} />
      <circle cx="50" cy="50" r="7" fill={W} />
    </>);
    case 'sensei': return (<>
      <path d="M50 72 20 40a42 42 0 0 1 60 0Z" fill={W} />
      <path d="M50 72 28 33M50 72 39 27M50 72V25M50 72 61 27M50 72 72 33" stroke={C} strokeWidth="2.4" />
      <circle cx="50" cy="72" r="4" fill={W} />
    </>);
    case 'mochi': return (<>
      <ellipse cx="50" cy="56" rx="26" ry="20" fill={W} /><path d="M28 44 32 28l10 12M72 44l-4-16-10 12" fill={W} />
      <circle cx="41" cy="54" r="3" fill={C} /><circle cx="59" cy="54" r="3" fill={C} />
      <path d="M46 62q4 3 8 0" stroke={C} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </>);
  }
}

interface Props {
  id: SceauId;
  /** Côté en pixels. */
  taille?: number;
  /** Adversaire pas encore débloqué : sceau grisé à 35 % et cadenas. */
  verrouille?: boolean;
  /** Adversaire déjà battu : tampon « BATTU » (grands sceaux) ou coche (petits). */
  battu?: boolean;
  className?: string;
}

/**
 * Sceau d'un adversaire ou de Mochi. Décoratif : le nom et l'état sont portés par le texte voisin.
 * La texture de tampon est un seul filtre léger (bruit fractal à 2 octaves + déplacement), avec un id propre à chaque instance.
 */
export function Sceau({ id, taille = 44, verrouille = false, battu = false, className }: Props) {
  const filtre = `sceau-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const e = ENCRE[id];
  // Graine stable par sceau : chaque adversaire garde son grain, d'un écran à l'autre.
  const graine = 4 + Object.keys(ENCRE).indexOf(id);
  const classes = ['sceau', verrouille && 'sceau-verrou', className].filter(Boolean).join(' ');
  return (
    <span className={classes} style={{ width: taille, height: taille }} aria-hidden="true">
      <svg viewBox="0 0 100 100" width="100%" height="100%" focusable="false">
        <defs>
          <filter id={filtre} x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="1.3" numOctaves="2" seed={graine} />
            <feDisplacementMap in="SourceGraphic" scale="3" />
          </filter>
        </defs>
        <g filter={`url(#${filtre})`}>
          <rect x="6" y="6" width="88" height="88" rx="22" fill={e.fond} stroke={e.contour ?? 'none'} strokeWidth="3" />
          <rect x="12" y="12" width="76" height="76" rx="17" fill="none" stroke={e.cadre} strokeWidth="2.2" opacity=".85" />
          {motif(id, e.motif, e.trait)}
        </g>
      </svg>
      {verrouille && (
        <span className="sceau-cadenas">
          <svg viewBox="0 0 16 16" width="100%" height="100%" focusable="false">
            <path d="M5 7V5.2a3 3 0 0 1 6 0V7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <rect x="3.2" y="7" width="9.6" height="7" rx="1.8" fill="currentColor" />
          </svg>
        </span>
      )}
      {battu && !verrouille && (taille >= 56
        ? <span className="sceau-tampon">{battuAccorde(id).toUpperCase()}</span>
        : (
          <span className="sceau-coche">
            <svg viewBox="0 0 16 16" width="100%" height="100%" focusable="false"><path d="M4 8.4 6.8 11 12 5.4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
        ))}
    </span>
  );
}
