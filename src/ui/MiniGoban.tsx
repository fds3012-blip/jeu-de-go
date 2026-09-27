// Miniature d'un problème : la zone où sont les pierres, sur un bout de kaya (issue #40, phase 6).
// Les lignes qui ne sont pas un bord du plateau débordent de la fenêtre : on voit que le plateau continue.
import { useId, useMemo } from 'react';
import { cadrage } from './cadrage';

const PAS = 10;

export function MiniGoban({ rows, className }: { rows: string[]; className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const n = rows.length;
  const { x, y, k } = useMemo(() => cadrage(rows), [rows]);
  const cote = k * PAS;
  const o = PAS / 2; // première intersection
  const fin = o + (k - 1) * PAS;
  const lignes = [];
  for (let i = 0; i < k; i++) {
    const q = o + i * PAS;
    // Horizontale de la ligne y + i : elle touche le bord gauche ou droit seulement si la fenêtre est au bord.
    const hx0 = x === 0 ? o : 0, hx1 = x + k === n ? fin : cote;
    const vy0 = y === 0 ? o : 0, vy1 = y + k === n ? fin : cote;
    const bordH = y + i === 0 || y + i === n - 1, bordV = x + i === 0 || x + i === n - 1;
    lignes.push(<line key={`h${i}`} x1={hx0} x2={hx1} y1={q} y2={q} strokeWidth={bordH ? 0.9 : 0.5} />);
    lignes.push(<line key={`v${i}`} y1={vy0} y2={vy1} x1={q} x2={q} strokeWidth={bordV ? 0.9 : 0.5} />);
  }
  const pierres = [];
  for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) {
    const ch = rows[y + j]?.[x + i];
    if (!ch || ch === '.') continue;
    const noir = ch === 'X' || ch === 'S', cx = o + i * PAS, cy = o + j * PAS;
    pierres.push(
      <g key={`${i}-${j}`}>
        <circle cx={cx + 0.5} cy={cy + 0.9} r={4.7} fill="rgba(35,18,4,.35)" />
        <circle cx={cx} cy={cy} r={4.7} fill={`url(#${id}-${noir ? 'n' : 'b'})`} stroke={noir ? 'none' : 'rgba(120,100,70,.5)'} strokeWidth={0.35} />
        {(ch === 'T' || ch === 'S') && <circle cx={cx} cy={cy} r={2.9} fill="none" stroke="#D2432C" strokeWidth={0.9} strokeDasharray="1.6 1" />}
      </g>,
    );
  }
  return (
    <svg className={['mini-goban', className].filter(Boolean).join(' ')} viewBox={`0 0 ${cote} ${cote}`} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-k`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#EDC27A" /><stop offset="1" stopColor="#D5A159" /></linearGradient>
        <radialGradient id={`${id}-n`} cx="36%" cy="30%" r="72%"><stop offset="0" stopColor="#5b5f5d" /><stop offset=".55" stopColor="#151716" /><stop offset="1" stopColor="#050606" /></radialGradient>
        <radialGradient id={`${id}-b`} cx="38%" cy="32%" r="78%"><stop offset="0" stopColor="#fff" /><stop offset=".6" stopColor="#F3EEE3" /><stop offset="1" stopColor="#C9BFAC" /></radialGradient>
      </defs>
      <rect width={cote} height={cote} fill={`url(#${id}-k)`} />
      <g stroke="#3A2912" strokeOpacity={0.7}>{lignes}</g>
      {pierres}
    </svg>
  );
}
