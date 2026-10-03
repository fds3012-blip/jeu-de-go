// Visée du plateau serré (#400) : en 13 × 13 (et 19 × 19) sur un téléphone de 320 px, les lignes ne sont qu'à 19 px
// l'une de l'autre et le doigt cache la pierre fantôme. Après la première touche, la visée trace la ligne et la colonne
// du point choisi jusqu'aux bords, et y allume sa lettre et son numéro : on lit « D10 » sans soulever la main.
// Rendue par Board (prop `surFantome`) sur la grille, sous les pierres et la pierre fantôme. Aucune animation : la visée suit le doigt tout de suite.
// Chargée seulement avec les écrans qui l'utilisent (problèmes, Go du jour), pas dans le JS initial.
import type { ReactElement } from 'react';
import { LETTERS } from '../go/coords';
import { C, M, coordCenter, viewBoxOf } from './boardArt';
import './visee.css';

// Jade de la direction artistique, foncé dessous pour le contraste sur tous les bois (comme le cadre du conseil).
const JADE = '#3CC48E', JADE_FONCE = '#155E40', ENCRE = '#0E1A14';

/** Étiquette d'un bord : pastille jade et texte encre, centrée sur (x, y) et gardée dans le bois (min : bord du viewBox). */
function Pastille({ x: x0, y: y0, texte, fs, min }: { x: number; y: number; texte: string; fs: number; min: number }) {
  const h = fs * 1.3, w = Math.max(h, fs * (0.66 * texte.length + 0.62));
  const x = Math.max(x0, min + w / 2 + 1), y = Math.max(y0, min + h / 2 + 1);
  return (
    <g>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={h / 2} fill={JADE} stroke={JADE_FONCE} strokeWidth={fs * 0.1} />
      <text x={x} y={y} fontSize={fs} fontWeight={800} fill={ENCRE} textAnchor="middle" dominantBaseline="central">{texte}</text>
    </g>
  );
}

export function Visee({ p, size }: { p: number; size: number }): ReactElement {
  const i = p % size, j = Math.floor(p / size);
  const x = M + i * C, y = M + j * C, e = M + (size - 1) * C;
  // Même échelle que les coordonnées du plateau (Board.tsx), un peu plus grande pour se lire sous le doigt.
  const vb = viewBoxOf(size), k = vb.span / 358, lc = coordCenter(size), fs = 13.5 * k;
  const d = `M${M} ${y}H${e}M${x} ${M}V${e}`;
  return (
    <g data-visee={`${LETTERS[i]}${size - j}`} aria-hidden="true" pointerEvents="none">
      <path d={d} stroke={JADE_FONCE} strokeOpacity={0.55} strokeWidth={4.2 * k} fill="none" />
      <path d={d} stroke={JADE} strokeWidth={2 * k} fill="none" />
      <Pastille x={x} y={lc} texte={LETTERS[i]} fs={fs} min={vb.min} />
      <Pastille x={lc} y={y} texte={String(size - j)} fs={fs} min={vb.min} />
    </g>
  );
}
