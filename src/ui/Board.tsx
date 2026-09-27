import { useRef, useState, type PointerEvent, type ReactElement } from 'react';
import { LETTERS } from '../go/coords';

export interface BoardMarks {
  last?: number | null;
  libs?: number[];
  targets?: number[];
  ok?: number;
  mistake?: number;
  owner?: Int8Array;
  dead?: Set<number>;
}

interface Props {
  size: number;
  board: Int8Array;
  toPlay?: 1 | 2;
  marks?: BoardMarks;
  interactive?: boolean;
  stonesTappable?: boolean;
  confirmTouch?: boolean;
  onPlay?: (p: number) => void;
}

const C = 40, M = 34;

function hoshi(size: number): number[] {
  const s = size === 9 ? [2, 6] : size === 13 ? [3, 9] : [3, 9, 15];
  const out: number[] = [];
  for (const a of s) for (const b of s) out.push(b * size + a);
  if (size !== 19) out.push((size >> 1) * size + (size >> 1));
  else out.push(9 * 19 + 9, 3 * 19 + 9, 15 * 19 + 9, 9 * 19 + 3, 9 * 19 + 15);
  return out;
}

export function Board({ size, board, toPlay = 1, marks = {}, interactive = false, stonesTappable = false, confirmTouch = true, onPlay }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const [ghost, setGhost] = useState(-1);
  const w = 2 * M + (size - 1) * C, end = M + (size - 1) * C;
  const X = (p: number) => M + (p % size) * C, Y = (p: number) => M + Math.floor(p / size) * C;

  function pointFrom(e: PointerEvent): number {
    const r = ref.current!.getBoundingClientRect();
    const sx = ((e.clientX - r.left) * w) / r.width, sy = ((e.clientY - r.top) * w) / r.height;
    const i = Math.round((sx - M) / C), j = Math.round((sy - M) / C);
    if (i < 0 || j < 0 || i >= size || j >= size) return -1;
    if (Math.hypot(sx - (M + i * C), sy - (M + j * C)) > C * 0.6) return -1;
    return j * size + i;
  }
  function onUp(e: PointerEvent) {
    if (!interactive || !onPlay) return;
    const p = pointFrom(e);
    if (p < 0) return;
    if (board[p] && !stonesTappable) return;
    if (!board[p] && confirmTouch && e.pointerType !== 'mouse' && ghost !== p) { setGhost(p); return; }
    setGhost(-1);
    onPlay(p);
  }
  function onMove(e: PointerEvent) {
    if (!interactive || e.pointerType !== 'mouse') return;
    const p = pointFrom(e);
    setGhost(p >= 0 && !board[p] ? p : -1);
  }

  const stone = (p: number, c: number, op = 1) => (
    <g key={`s${p}`} opacity={op}>
      <circle cx={X(p) + 1.6} cy={Y(p) + 2.2} r={C * 0.475} fill="rgba(0,0,0,.3)" />
      <circle cx={X(p)} cy={Y(p)} r={C * 0.475} fill={`url(#${c === 1 ? 'gb' : 'gw'})`} stroke={c === 2 ? 'rgba(60,50,30,.35)' : 'none'} strokeWidth={0.8} />
    </g>
  );

  const cells: ReactElement[] = [];
  for (let p = 0; p < board.length; p++) if (board[p]) cells.push(stone(p, board[p], marks.dead?.has(p) ? 0.35 : 1));
  const owner: ReactElement[] = [];
  if (marks.owner) for (let p = 0; p < board.length; p++) {
    const o = marks.owner[p];
    if (!o || (board[p] && !marks.dead?.has(p))) continue;
    const s = C * 0.3;
    owner.push(<rect key={`o${p}`} x={X(p) - s / 2} y={Y(p) - s / 2} width={s} height={s} fill={o === 1 ? '#111' : '#fff'} stroke={o === 2 ? 'rgba(0,0,0,.4)' : 'none'} strokeWidth={0.8} />);
  }
  const labelFill = '#3A2912';

  return (
    <div className="board-wrap">
      <svg ref={ref} className="board" viewBox={`0 0 ${w} ${w}`} role="img" aria-label={`Plateau de go ${size} × ${size}`}
        onPointerUp={onUp} onPointerMove={onMove} onPointerLeave={() => setGhost(-1)}>
        <defs>
          <radialGradient id="gb" cx="35%" cy="30%" r="70%"><stop offset="0" stopColor="#6a6f6c" /><stop offset=".45" stopColor="#1c1e1d" /><stop offset="1" stopColor="#050505" /></radialGradient>
          <radialGradient id="gw" cx="35%" cy="30%" r="75%"><stop offset="0" stopColor="#ffffff" /><stop offset=".6" stopColor="#ebe6db" /><stop offset="1" stopColor="#c4bdae" /></radialGradient>
        </defs>
        {Array.from({ length: size }, (_, i) => {
          const k = M + i * C, sw = i === 0 || i === size - 1 ? 2.2 : 1.2;
          return (
            <g key={`l${i}`} stroke="#3A2912" strokeWidth={sw}>
              <line x1={M} y1={k} x2={end} y2={k} />
              <line x1={k} y1={M} x2={k} y2={end} />
            </g>
          );
        })}
        {hoshi(size).map(p => <circle key={`h${p}`} cx={X(p)} cy={Y(p)} r={size === 19 ? 3.6 : 4.2} fill="#3A2912" />)}
        {Array.from({ length: size }, (_, i) => {
          const k = M + i * C;
          return (
            <g key={`t${i}`} fill={labelFill} opacity={0.7} fontSize={13} fontWeight={500} textAnchor="middle" dominantBaseline="central">
              <text x={k} y={M * 0.42}>{LETTERS[i]}</text>
              <text x={k} y={w - M * 0.42}>{LETTERS[i]}</text>
              <text x={M * 0.42} y={k}>{size - i}</text>
              <text x={w - M * 0.42} y={k}>{size - i}</text>
            </g>
          );
        })}
        {cells}
        {owner}
        {marks.libs?.filter(p => !board[p]).map(p => <circle key={`lb${p}`} cx={X(p)} cy={Y(p)} r={C * 0.16} fill="#1F7A52" />)}
        {marks.targets?.filter(p => board[p]).map(p => <circle key={`tg${p}`} cx={X(p)} cy={Y(p)} r={C * 0.3} fill="none" stroke="#E4572E" strokeWidth={2.6} strokeDasharray="5 3" />)}
        {marks.last != null && marks.last >= 0 && board[marks.last] ? <circle cx={X(marks.last)} cy={Y(marks.last)} r={C * 0.19} fill="none" stroke="#E4572E" strokeWidth={3} /> : null}
        {marks.ok != null && marks.ok >= 0 ? <circle cx={X(marks.ok)} cy={Y(marks.ok)} r={C * 0.5} fill="none" stroke="#1F7A52" strokeWidth={3.4} /> : null}
        {marks.mistake != null && marks.mistake >= 0 ? (
          <path d={`M${X(marks.mistake) - 9} ${Y(marks.mistake) - 9}L${X(marks.mistake) + 9} ${Y(marks.mistake) + 9}M${X(marks.mistake) + 9} ${Y(marks.mistake) - 9}L${X(marks.mistake) - 9} ${Y(marks.mistake) + 9}`} stroke="#E4572E" strokeWidth={4} strokeLinecap="round" />
        ) : null}
        {ghost >= 0 && !board[ghost] ? stone(ghost, toPlay, 0.5) : null}
      </svg>
    </div>
  );
}
