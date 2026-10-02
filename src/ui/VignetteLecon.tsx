// Vignettes des leçons (chemin Apprendre, v3) : une mini-position de go par leçon, dessinée sur une tuile de kaya.
// Identité Encre & Jade : bois pour la tuile, ardoise et coquillage pour les pierres, jade pour le point à jouer,
// or pour ce qu'on gagne ou protège (un œil, du territoire). Grille 4 × 4 sur un carré de 100, lisible dès 44 px.
import type { ReactElement } from 'react';

import { MOTIFS, type Motif, type Point } from './vignettes';

const PAS = 24, MARGE = 14;
const xy = ([c, r]: Point): [number, number] => [MARGE + c * PAS, MARGE + r * PAS];

const KAYA = '#EDC27A', KAYA_2 = '#D5A458', LIGNE = '#3A2912', JADE = '#3CC48E', OR = '#EFB84A';

function dessin(m: Motif, id: string): ReactElement {
  const lignes: string[] = [];
  for (let i = 0; i < 4; i++) {
    const p = MARGE + i * PAS;
    // Dans un coin, les deux bords (bas et gauche) sont plus marqués ; les lignes ne dépassent pas.
    lignes.push(`M${p} ${m.coin ? 6 : 6}V${m.coin ? MARGE + 3 * PAS : 94}`, `M${m.coin ? MARGE : 6} ${p}H94`);
  }
  return (<>
    <path d={lignes.join('')} stroke={LIGNE} strokeWidth="1.6" strokeOpacity=".55" fill="none" strokeLinecap="round" />
    {m.coin && <path d={`M${MARGE} 6V${MARGE + 3 * PAS}H94`} stroke={LIGNE} strokeWidth="3.2" strokeOpacity=".7" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
    {m.hoshi?.map(p => { const [x, y] = xy(p); return <circle key={`h${x}${y}`} cx={x} cy={y} r="3" fill={LIGNE} fillOpacity=".7" />; })}
    {m.cases?.points.map(p => { const [x, y] = xy(p); return <rect key={`c${x}${y}`} x={x - 6} y={y - 6} width="12" height="12" rx="2.5" fill={m.cases!.couleur === 'jade' ? JADE : OR} opacity=".9" />; })}
    {m.blanc?.map(p => { const [x, y] = xy(p); return <circle key={`b${x}${y}`} cx={x} cy={y} r="10.5" fill={`url(#${id}-blanche)`} stroke="rgba(58,41,18,.35)" strokeWidth=".8" />; })}
    {m.noir?.map(p => { const [x, y] = xy(p); return <circle key={`n${x}${y}`} cx={x} cy={y} r="10.8" fill={`url(#${id}-noire)`} />; })}
    {m.jade?.map(p => { const [x, y] = xy(p); return <g key={`j${x}${y}`}><circle cx={x} cy={y} r="9.5" fill="none" stroke={JADE} strokeWidth="3" /><circle cx={x} cy={y} r="3.6" fill={JADE} /></g>; })}
    {m.or?.map(p => { const [x, y] = xy(p); return <circle key={`o${x}${y}`} cx={x} cy={y} r="8" fill="none" stroke={OR} strokeWidth="3.2" />; })}
  </>);
}

interface Props {
  /** Identifiant de la leçon (l1, l2…). */
  id: string;
  /** Côté en pixels. */
  taille?: number;
  /** Leçon verrouillée : tuile pâlie, en gris. */
  pale?: boolean;
  className?: string;
}

/** Tuile de kaya avec la mini-position de la leçon. Décorative : le titre est toujours écrit à côté. */
export function VignetteLecon({ id, taille = 44, pale = false, className }: Props) {
  const m = MOTIFS[id] ?? { noir: [[1, 1]] };
  const uid = `vg-${id}`;
  const classes = ['vignette', pale && 'vignette-pale', className].filter(Boolean).join(' ');
  return (
    <span className={classes} style={{ width: taille, height: taille }} aria-hidden="true" data-vignette={id}>
      <svg viewBox="0 0 100 100" width="100%" height="100%" focusable="false">
        <defs>
          <linearGradient id={`${uid}-bois`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={KAYA} /><stop offset="1" stopColor={KAYA_2} /></linearGradient>
          <radialGradient id={`${uid}-noire`} cx=".38" cy=".32" r=".7"><stop offset="0" stopColor="#676B69" /><stop offset=".55" stopColor="#151716" /><stop offset="1" stopColor="#050606" /></radialGradient>
          <radialGradient id={`${uid}-blanche`} cx=".38" cy=".32" r=".7"><stop offset="0" stopColor="#FFFFFF" /><stop offset=".6" stopColor="#E9E3D6" /><stop offset="1" stopColor="#BDB3A0" /></radialGradient>
        </defs>
        <rect x="0" y="0" width="100" height="100" rx="20" fill={`url(#${uid}-bois)`} />
        <rect x="1" y="1" width="98" height="98" rx="19" fill="none" stroke="rgba(58,41,18,.3)" strokeWidth="2" />
        {dessin(m, uid)}
      </svg>
    </span>
  );
}
