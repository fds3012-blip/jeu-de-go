import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactElement } from 'react';
import { LETTERS, toLabel } from '../go/coords';
import { C, M, R, R_NOIR, VARIANTES_COQUILLAGE, coordCenter, diffBoards, hoshi, jitter, shellStriae, shellVariant, viewBoxOf, woodDataUrl } from './boardArt';
import './board.css';

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
  /** Coup interdit : la pierre fantôme tremble en `p`. Change `n` pour relancer l'effet. */
  shake?: { p: number; n: number } | null;
}

// Couleurs posées sur le bois : fixes, indépendantes du thème (le goban est le même en mode Encre et Papier).
const LIGNE = '#2b1a08';
const JADE = '#3CC48E', JADE_FONCE = '#155E40', HANKO = '#D2432C', PAPIER = '#F3EDE3';

// Définitions partagées, créées une seule fois pour toute l'app : dégradés et symboles des pierres.
// Les pierres sont ensuite de simples <use>, sans aucun filtre.
const DEFS = (
  <defs>
    <radialGradient id="go-n" cx="36%" cy="30%" r="72%">
      <stop offset="0" stopColor="#5b5f5d" /><stop offset=".18" stopColor="#2e3130" /><stop offset=".55" stopColor="#151716" /><stop offset="1" stopColor="#050606" />
    </radialGradient>
    <radialGradient id="go-nr" cx="34%" cy="26%" r="24%">
      <stop offset="0" stopColor="#fff" stopOpacity=".42" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
    </radialGradient>
    <radialGradient id="go-bl" cx="38%" cy="32%" r="78%">
      <stop offset="0" stopColor="#fff" /><stop offset=".55" stopColor="#F3EEE3" /><stop offset=".85" stopColor="#DDD5C4" /><stop offset="1" stopColor="#BDB3A0" />
    </radialGradient>
    {/* Ombre portée floue, obtenue par un dégradé plutôt que par un filtre (rien à recalculer). */}
    <radialGradient id="go-om">
      <stop offset="0" stopColor="#231204" stopOpacity=".5" /><stop offset=".74" stopColor="#231204" stopOpacity=".4" /><stop offset="1" stopColor="#231204" stopOpacity="0" />
    </radialGradient>
    <clipPath id="go-clip"><circle r={R - 0.3} /></clipPath>
    <circle id="go-ombre" cx={1.8} cy={3} r={R * 1.1} fill="url(#go-om)" />
    <g id="go-noire">
      <circle r={R_NOIR} fill="url(#go-n)" />
      <circle r={R_NOIR} fill="url(#go-nr)" />
    </g>
    {Array.from({ length: VARIANTES_COQUILLAGE }, (_, v) => (
      <g key={v} id={`go-blanche-${v}`}>
        <circle r={R} fill="url(#go-bl)" />
        <g clipPath="url(#go-clip)" fill="none">
          {shellStriae(v).map((s, i) => (
            <circle key={i} cx={s.cx} cy={s.cy} r={s.r} stroke={s.clair ? '#fff' : '#8C7B5E'} strokeOpacity={s.clair ? s.o * 1.8 : s.o * 0.6} strokeWidth={s.w} />
          ))}
        </g>
        <circle r={R - 0.4} fill="none" stroke="rgba(120,100,70,.38)" strokeWidth={0.8} />
      </g>
    ))}
  </defs>
);

/** Corps d'une pierre (sans ombre), centré sur (0, 0). */
function corps(c: number, p: number, size: number): ReactElement {
  return <use href={c === 1 ? '#go-noire' : `#go-blanche-${shellVariant(p, size)}`} />;
}

export function Board({ size, board, toPlay = 1, marks = {}, interactive = false, stonesTappable = false, confirmTouch = true, onPlay, shake }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const [ghost, setGhost] = useState(-1);
  const vb = viewBoxOf(size);
  const X = (p: number) => M + (p % size) * C, Y = (p: number) => M + Math.floor(p / size) * C;
  // Position affichée d'une pierre : intersection + micro-décalage déterministe.
  const at = (p: number): [number, number] => { const [dx, dy] = jitter(p, size); return [X(p) + dx, Y(p) + dy]; };

  // Mouvement : on compare au plateau précédent pour savoir quelle pierre vient d'être posée et lesquelles sont prises.
  // (Motif React « état dérivé du rendu précédent » : pas d'effet, pas de rendu intermédiaire.)
  const [prev, setPrev] = useState(board);
  const [fx, setFx] = useState<{ n: number; placed: number; leaving: { p: number; c: number }[] }>({ n: 0, placed: -1, leaving: [] });
  if (prev !== board) {
    setPrev(board);
    const d = diffBoards(prev, board);
    setFx({ n: fx.n + 1, placed: d ? d.placed : -1, leaving: d ? d.captured.map(p => ({ p, c: prev[p] })) : [] });
  }
  useEffect(() => {
    if (!fx.leaving.length) return;
    const t = window.setTimeout(() => setFx(f => (f.n === fx.n ? { ...f, leaving: [] } : f)), 260 + fx.leaving.length * 30);
    return () => window.clearTimeout(t);
  }, [fx]);

  const [shakeSeen, setShakeSeen] = useState(shake?.n);
  const [shaking, setShaking] = useState(-1);
  if (shake && shake.n !== shakeSeen) { setShakeSeen(shake.n); setShaking(shake.p); }
  useEffect(() => {
    if (shaking < 0) return;
    const t = window.setTimeout(() => setShaking(-1), 420);
    return () => window.clearTimeout(t);
  }, [shaking, shakeSeen]);

  function pointFrom(e: PointerEvent): number {
    const r = ref.current!.getBoundingClientRect();
    const sx = vb.min + ((e.clientX - r.left) * vb.span) / r.width, sy = vb.min + ((e.clientY - r.top) * vb.span) / r.height;
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
  // Au doigt, le navigateur envoie pointerleave juste après pointerup : on garde alors la pierre
  // fantôme, sinon la seconde touche de confirmation ne jouerait jamais.
  function onLeave(e: PointerEvent) {
    if (e.pointerType === 'mouse') setGhost(-1);
  }

  // Grille, hoshi et coordonnées : ne dépendent que de la taille.
  const grid = useMemo(() => {
    const k = viewBoxOf(size).span / 358, lc = coordCenter(size); // unités du viewBox par pixel CSS pour un plateau de 358 px (iPhone 390)
    const fin = 0.85 * k, bord = 1.5 * k, fs = 11 * k, e = M + (size - 1) * C;
    let d = '';
    const dBord = `M${M} ${M}H${e}V${e}H${M}Z`;
    for (let i = 1; i < size - 1; i++) { const q = M + i * C; d += `M${M} ${q}H${e}M${q} ${M}V${e}`; }
    return (
      <g aria-hidden="true">
        <path d={d} stroke={LIGNE} strokeOpacity={0.78} strokeWidth={fin} fill="none" />
        <path d={dBord} stroke={LIGNE} strokeOpacity={0.78} strokeWidth={bord} fill="none" strokeLinejoin="miter" />
        {hoshi(size).map(p => <circle key={p} cx={M + (p % size) * C} cy={M + Math.floor(p / size) * C} r={(size === 19 ? 2.3 : 3) * k} fill={LIGNE} fillOpacity={0.85} />)}
        <g className="coord" fontSize={fs} fill="#4a2f10" fillOpacity={0.7} textAnchor="middle" dominantBaseline="central">
          {Array.from({ length: size }, (_, i) => (
            <g key={i}>
              <text x={M + i * C} y={lc}>{LETTERS[i]}</text>
              <text x={lc} y={M + i * C}>{size - i}</text>
            </g>
          ))}
        </g>
      </g>
    );
  }, [size]);

  const stones: ReactElement[] = [];
  for (let p = 0; p < board.length; p++) {
    const c = board[p];
    if (!c) continue;
    const [x, y] = at(p), mort = marks.dead?.has(p);
    stones.push(
      <g key={`s${p}`} transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`} opacity={mort ? 0.35 : 1}
        className={fx.placed === p ? 'drop' : undefined} data-pierre={c === 1 ? 'noir' : 'blanc'} data-point={toLabel(p, size)} data-morte={mort ? '' : undefined}>
        <use href="#go-ombre" className="ombre" />
        <g className="corps">{corps(c, p, size)}</g>
      </g>,
    );
  }
  const leaving = fx.leaving.filter(l => !board[l.p]).map((l, i) => {
    const [x, y] = at(l.p);
    return (
      <g key={`x${fx.n}-${l.p}`} transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`} aria-hidden="true">
        <g className="partante" style={{ animationDelay: `${i * 30}ms` }}>
          <use href="#go-ombre" />
          {corps(l.c, l.p, size)}
        </g>
      </g>
    );
  });

  const owner: ReactElement[] = [];
  if (marks.owner) for (let p = 0; p < board.length; p++) {
    const o = marks.owner[p];
    if (!o || (board[p] && !marks.dead?.has(p))) continue;
    const s = C * 0.28;
    owner.push(<rect key={`o${p}`} x={X(p) - s / 2} y={Y(p) - s / 2} width={s} height={s} rx={1.6} fill={o === 1 ? '#161616' : '#FBF8F1'}
      stroke={o === 1 ? 'rgba(255,240,210,.25)' : 'rgba(40,25,8,.45)'} strokeWidth={0.8} data-territoire={o === 1 ? 'noir' : 'blanc'} />);
  }

  const last = marks.last != null && marks.last >= 0 && board[marks.last] ? marks.last : -1;
  const ghostP = ghost >= 0 && !board[ghost] && ghost !== shaking ? ghost : -1;
  const fantome = (p: number) => { const [x, y] = at(p); return { transform: `translate(${x.toFixed(2)} ${y.toFixed(2)})` }; };

  return (
    <div className="board-wrap">
      <svg ref={ref} className="board" viewBox={`${vb.min} ${vb.min} ${vb.span} ${vb.span}`} role="img" aria-label={`Plateau de go ${size} × ${size}`}
        onPointerUp={onUp} onPointerMove={onMove} onPointerLeave={onLeave}>
        {DEFS}
        <image href={woodDataUrl()} x={vb.min} y={vb.min} width={vb.span} height={vb.span} preserveAspectRatio="none" />
        {grid}
        {stones}
        {leaving}
        {owner}
        {marks.libs?.filter(p => !board[p]).map(p => <circle key={`lb${p}`} cx={X(p)} cy={Y(p)} r={C * 0.15} fill={JADE} stroke={JADE_FONCE} strokeWidth={1.6} />)}
        {marks.targets?.filter(p => board[p]).map(p => { const [x, y] = at(p); return <circle key={`tg${p}`} cx={x} cy={y} r={C * 0.3} fill="none" stroke={HANKO} strokeWidth={2.6} strokeDasharray="5 3" />; })}
        {last >= 0 ? (() => { const [x, y] = at(last); return <circle cx={x} cy={y} r={R * 0.3} fill="none" stroke={board[last] === 1 ? PAPIER : '#1a1a1a'} strokeWidth={2.4} data-dernier="" />; })() : null}
        {marks.ok != null && marks.ok >= 0 ? (() => { const [x, y] = at(marks.ok); return (
          <g fill="none"><circle cx={x} cy={y} r={C * 0.52} stroke={JADE_FONCE} strokeWidth={5.4} /><circle cx={x} cy={y} r={C * 0.52} stroke={JADE} strokeWidth={3} /></g>
        ); })() : null}
        {marks.mistake != null && marks.mistake >= 0 ? (() => { const x = X(marks.mistake), y = Y(marks.mistake), d = `M${x - 8} ${y - 8}L${x + 8} ${y + 8}M${x + 8} ${y - 8}L${x - 8} ${y + 8}`; return (
          <g fill="none" strokeLinecap="round"><path d={d} stroke={PAPIER} strokeOpacity={0.85} strokeWidth={7} /><path d={d} stroke={HANKO} strokeWidth={4} /></g>
        ); })() : null}
        {ghostP >= 0 ? <g {...fantome(ghostP)} opacity={0.5} data-fantome="" aria-hidden="true">{corps(toPlay, ghostP, size)}</g> : null}
        {shaking >= 0 && !board[shaking] ? (
          <g key={`tr${shakeSeen}`} {...fantome(shaking)} opacity={0.5} aria-hidden="true"><g className="tremble">{corps(toPlay, shaking, size)}</g></g>
        ) : null}
      </svg>
    </div>
  );
}
