import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactElement } from 'react';
import { LETTERS, toLabel } from '../go/coords';
import { C, M, R, R_NOIR, VARIANTES_COQUILLAGE, coordCenter, diffBoards, hoshi, jitter, shellStriae, shellVariant, viewBoxOf, woodDataUrl, type ThemeGoban } from './boardArt';
import { useThemeGoban } from '../app/settings';
import { t } from '../content/i18n';
import { CURSEUR, TOUCHE_LIRE, annonceApresCoup, annonceConfirmation, deplacerCurseur, lirePlateau, nomIntersection, type NomsCamps } from './boardA11y';
import './board.css';

export interface BoardMarks {
  last?: number | null;
  libs?: number[];
  targets?: number[];
  ok?: number;
  mistake?: number;
  owner?: Int8Array;
  dead?: Set<number>;
  /** Indice : une zone entourée autour de ce point (le bon coup est dedans, sans être désigné). */
  zone?: number;
  /** Conseil de Mochi (#80) : les points concernés, entourés d'un cadre arrondi (sans animation). */
  conseil?: number[];
  /** Revue (issue #34) : meilleur coup du moteur, montré par une pierre fantôme jade. */
  meilleur?: number;
  /** Revue (issue #71) : sceau de note posé en haut à droite de la pierre `p`. `cle` relance le tampon. */
  note?: { p: number; fond: string; texte: string; symbole: string; libelle: string; cle: string | number };
  /** Récit du score (#78) : délai d'apparition (ms) de chaque carré de territoire. Sans délai, le carré est là d'emblée. */
  ownerDelai?: Map<number, number>;
  /** « Qui mène ? » (#94) : les carrés de territoire apparaissent en fondu (150 ms, rien si les mouvements sont réduits). */
  ownerFondu?: boolean;
  /** Frontières ouvertes (#159) : petits points rouges sur les points vides qui ne sont encore à personne. */
  ouverts?: number[];
}

interface Props {
  size: number;
  board: Int8Array;
  toPlay?: 1 | 2;
  marks?: BoardMarks;
  interactive?: boolean;
  stonesTappable?: boolean;
  confirmTouch?: boolean;
  /** Question « touche le point » : on désigne un point sans poser de pierre (annonce « choisir ce point »). */
  toucher?: boolean;
  onPlay?: (p: number) => void;
  /** Coup interdit : la pierre fantôme tremble en `p`. Change `n` pour relancer l'effet. */
  shake?: { p: number; n: number } | null;
  /** Les pierres prises partent vers leur couvercle : les noires vers le haut, les blanches vers le bas (écran de partie). */
  versCouvercles?: boolean;
  /** Noms lus dans les annonces (issue #116) : { 2: 'Pomme' } fait dire « Pomme a joué C3 » au lieu de « Blanc joue C3 ». */
  noms?: NomsCamps;
  /** Dessin posé sous la pierre fantôme (#400 : visée du plateau serré, src/ui/Visee.tsx, chargée avec son écran). */
  surFantome?: (p: number) => ReactElement;
}

// Les fonctions pures du clavier et des annonces (issue #116) vivent dans boardA11y.ts.

// Couleurs posées sur le bois : indépendantes du mode Encre ou Papier (le goban est le même dans les deux).
// L'encre des lignes et la nacre des pierres blanches viennent du thème du goban (#109, boardArt.ts).
const JADE = '#3CC48E', JADE_FONCE = '#155E40', HANKO = '#D2432C', PAPIER = '#F3EDE3';

// Définitions partagées, créées une seule fois pour toute l'app : dégradés et symboles des pierres.
// Les pierres sont ensuite de simples <use>, sans aucun filtre.
const defsCache = new Map<string, ReactElement>();
function defsDe(t: ThemeGoban): ReactElement {
  const deja = defsCache.get(t.id);
  if (deja) return deja;
  const d = (
  <defs>
    <radialGradient id="go-n" cx="36%" cy="30%" r="72%">
      <stop offset="0" stopColor="#5b5f5d" /><stop offset=".18" stopColor="#2e3130" /><stop offset=".55" stopColor="#151716" /><stop offset="1" stopColor="#050606" />
    </radialGradient>
    <radialGradient id="go-nr" cx="34%" cy="26%" r="24%">
      <stop offset="0" stopColor="#fff" stopOpacity=".42" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
    </radialGradient>
    <radialGradient id="go-bl" cx="38%" cy="32%" r="78%">
      <stop offset="0" stopColor={t.blanche[0]} /><stop offset=".55" stopColor={t.blanche[1]} /><stop offset=".85" stopColor={t.blanche[2]} /><stop offset="1" stopColor={t.blanche[3]} />
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
            <circle key={i} cx={s.cx} cy={s.cy} r={s.r} stroke={s.clair ? '#fff' : t.strie} strokeOpacity={s.clair ? s.o * 1.8 : s.o * 0.6} strokeWidth={s.w} />
          ))}
        </g>
        <circle r={R - 0.4} fill="none" stroke="rgba(120,100,70,.38)" strokeWidth={0.8} />
      </g>
    ))}
  </defs>
  );
  defsCache.set(t.id, d);
  return d;
}

/** Corps d'une pierre (sans ombre), centré sur (0, 0). */
function corps(c: number, p: number, size: number): ReactElement {
  return <use href={c === 1 ? '#go-noire' : `#go-blanche-${shellVariant(p, size)}`} />;
}

export function Board({ size, board, toPlay = 1, marks = {}, interactive = false, stonesTappable = false, confirmTouch = true, toucher = false, onPlay, shake, versCouvercles = false, noms, surFantome }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const theme = useThemeGoban();
  const [ghost, setGhost] = useState(-1);
  // Un plateau jouable (onPlay fourni) est une grille : un seul arrêt de tabulation, curseur aux flèches.
  // Le rôle reste stable pendant le tour de l'adversaire (interactive passe à false) pour ne pas perdre le focus.
  const jouable = !!onPlay;
  const uid = useId();
  const [curseur, setCurseur] = useState(() => (size >> 1) * size + (size >> 1));
  const [focus, setFocus] = useState(false);
  const [clavier, setClavier] = useState(true);
  // Annonce polie. `n` change à chaque annonce : le texte est posé dans un nouvel élément de la zone aria-live,
  // pour qu'une même phrase redemandée (« Lire le plateau » deux fois) soit relue.
  const [annonce, setAnnonceEtat] = useState({ texte: '', n: 0 });
  const setAnnonce = (texte: string) => setAnnonceEtat(a => ({ texte, n: a.n + 1 }));
  const cur = curseur < size * size ? curseur : (size >> 1) * size + (size >> 1);
  const last = marks.last != null && marks.last >= 0 && board[marks.last] ? marks.last : -1;
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
    if (jouable && d && d.placed >= 0 && board[d.placed]) {
      setAnnonce(annonceApresCoup(board, d.placed, d.captured.length, size, noms));
    }
  }
  useEffect(() => {
    if (!fx.leaving.length) return;
    const t = window.setTimeout(() => setFx(f => (f.n === fx.n ? { ...f, leaving: [] } : f)), 380 + fx.leaving.length * 30);
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
  function onKey(e: KeyboardEvent) {
    if (!jouable) return;
    setClavier(true);
    const n = deplacerCurseur(cur, e.key, size);
    if (n != null) {
      e.preventDefault();
      // La case est annoncée dans la zone polie : VoiceOver iOS ne suit pas toujours aria-activedescendant dans un SVG.
      if (n !== cur) { setCurseur(n); setGhost(-1); setAnnonce(nomIntersection(n, board, size, last)); }
      return;
    }
    if (e.key.toLowerCase() === TOUCHE_LIRE && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); lire(); return; }
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    if (!interactive || !onPlay) return;
    if (board[cur] && !stonesTappable) { setAnnonce(t('plateau.occupe', { point: toLabel(cur, size) })); return; }
    // « Confirmer au doigt » : le premier appui montre la pierre fantôme, le second la pose.
    if (!board[cur] && confirmTouch && ghost !== cur) { setGhost(cur); setAnnonce(annonceConfirmation(toLabel(cur, size), toucher)); return; }
    setGhost(-1);
    onPlay(cur);
  }
  function lire() { setAnnonce(lirePlateau(board, size)); }
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

  // Grille, hoshi et coordonnées : ne dépendent que de la taille et du thème du goban.
  const grid = useMemo(() => {
    const k = viewBoxOf(size).span / 358, lc = coordCenter(size); // unités du viewBox par pixel CSS pour un plateau de 358 px (iPhone 390)
    const fin = 0.85 * k, bord = 1.5 * k, fs = 11 * k, e = M + (size - 1) * C;
    let d = '';
    const dBord = `M${M} ${M}H${e}V${e}H${M}Z`;
    for (let i = 1; i < size - 1; i++) { const q = M + i * C; d += `M${M} ${q}H${e}M${q} ${M}V${e}`; }
    return (
      <g aria-hidden="true">
        <path d={d} stroke={theme.ligne} strokeOpacity={0.78} strokeWidth={fin} fill="none" />
        <path d={dBord} stroke={theme.ligne} strokeOpacity={0.78} strokeWidth={bord} fill="none" strokeLinejoin="miter" />
        {hoshi(size).map(p => <circle key={p} cx={M + (p % size) * C} cy={M + Math.floor(p / size) * C} r={(size === 19 ? 2.3 : 3) * k} fill={theme.ligne} fillOpacity={0.85} />)}
        <g className="coord" fontSize={fs} fill={theme.coord} fillOpacity={0.7} textAnchor="middle" dominantBaseline="central">
          {Array.from({ length: size }, (_, i) => (
            <g key={i}>
              <text x={M + i * C} y={lc}>{LETTERS[i]}</text>
              <text x={lc} y={M + i * C}>{size - i}</text>
            </g>
          ))}
        </g>
      </g>
    );
  }, [size, theme]);

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
    // Vers le couvercle : jusqu'au bord du plateau (au-delà, le bois coupe la pierre), en s'effaçant.
    const dy = l.c === 1 ? vb.min - y : vb.min + vb.span - y;
    const style = versCouvercles ? { animationDelay: `${i * 30}ms`, '--dy': `${dy.toFixed(1)}px` } as CSSProperties : { animationDelay: `${i * 30}ms` };
    return (
      <g key={`x${fx.n}-${l.p}`} transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`} aria-hidden="true">
        <g className={versCouvercles ? 'partante vers-couvercle' : 'partante'} style={style}>
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
    const delai = marks.ownerDelai?.get(p);
    owner.push(<rect key={`o${p}`} x={X(p) - s / 2} y={Y(p) - s / 2} width={s} height={s} rx={1.6} fill={o === 1 ? '#161616' : '#FBF8F1'}
      className={delai != null ? 'territoire-recit' : undefined} style={delai != null ? { animationDelay: `${delai}ms` } : undefined}
      stroke={o === 1 ? 'rgba(255,240,210,.25)' : 'rgba(40,25,8,.45)'} strokeWidth={0.8} data-territoire={o === 1 ? 'noir' : 'blanc'} />);
  }

  const idCase = (p: number) => `${uid}-c${p}`;
  const cases = jouable ? Array.from({ length: size }, (_, y) => (
    <g key={`r${y}`} role="row">
      {Array.from({ length: size }, (_, x) => {
        const p = y * size + x;
        return <rect key={p} id={idCase(p)} role="gridcell" aria-label={nomIntersection(p, board, size, last)} aria-selected={p === cur}
          x={X(p) - C / 2} y={Y(p) - C / 2} width={C} height={C} fill="none" pointerEvents="none" />;
      })}
    </g>
  )) : null;
  const ghostP = ghost >= 0 && !board[ghost] && ghost !== shaking ? ghost : -1;
  const fantome = (p: number) => { const [x, y] = at(p); return { transform: `translate(${x.toFixed(2)} ${y.toFixed(2)})` }; };

  return (
    <div className="board-wrap">
      <svg ref={ref} className="board" viewBox={`${vb.min} ${vb.min} ${vb.span} ${vb.span}`} role={jouable ? 'grid' : 'img'} aria-label={t('plateau.aria', { size })}
        tabIndex={jouable ? 0 : undefined} aria-describedby={jouable ? `${uid}-aide` : undefined} aria-activedescendant={jouable ? idCase(cur) : undefined} aria-rowcount={jouable ? size : undefined} aria-colcount={jouable ? size : undefined}
        onKeyDown={jouable ? onKey : undefined} onFocus={jouable ? () => setFocus(true) : undefined} onBlur={jouable ? () => setFocus(false) : undefined}
        onPointerDown={jouable ? () => setClavier(false) : undefined}
        onPointerUp={onUp} onPointerMove={onMove} onPointerLeave={onLeave}>
        {defsDe(theme)}
        {cases}
        <image href={woodDataUrl(theme.id)} x={vb.min} y={vb.min} width={vb.span} height={vb.span} preserveAspectRatio="none" />
        {grid}
        {stones}
        {leaving}
        {marks.ownerFondu ? <g className="territoire-fondu" data-qui-mene="">{owner}</g> : owner}
        {marks.ouverts?.length ? <g className="frontieres" data-frontieres="">{marks.ouverts.filter(p => !board[p]).map(p => (
          <g key={`fo${p}`} data-frontiere={toLabel(p, size)}><circle cx={X(p)} cy={Y(p)} r={C * 0.11} fill={HANKO} stroke={PAPIER} strokeOpacity={0.85} strokeWidth={2} /></g>
        ))}</g> : null}
        {marks.libs?.filter(p => !board[p]).map(p => <circle key={`lb${p}`} className="liberte" cx={X(p)} cy={Y(p)} r={C * 0.15} fill={JADE} stroke={JADE_FONCE} strokeWidth={1.6} />)}
        {marks.targets?.filter(p => board[p]).map(p => { const [x, y] = at(p); return <circle key={`tg${p}`} data-cible="" cx={x} cy={y} r={C * 0.3} fill="none" stroke={HANKO} strokeWidth={2.6} strokeDasharray="5 3" />; })}
        {last >= 0 ? (() => { const [x, y] = at(last); return <circle cx={x} cy={y} r={R * 0.3} fill="none" stroke={board[last] === 1 ? PAPIER : '#1a1a1a'} strokeWidth={2.4} data-dernier="" />; })() : null}
        {marks.zone != null && marks.zone >= 0 ? (() => {
          // Le cercle est décalé d'une demi-case selon le point : il entoure le coup sans le centrer.
          // Il reste à l'intérieur de la grille pour ne pas être coupé par le bord du plateau.
          const lim = (v: number) => Math.min(M + (size - 1) * C - C * 0.9, Math.max(M + C * 0.9, v));
          const x = lim(X(marks.zone) + (marks.zone % 2 ? 0.5 : -0.5) * C), y = lim(Y(marks.zone) + (Math.floor(marks.zone / size) % 2 ? -0.5 : 0.5) * C);
          return <g fill="none" data-indice=""><circle cx={x} cy={y} r={C * 1.35} stroke={JADE_FONCE} strokeWidth={5} strokeOpacity={0.5} /><circle cx={x} cy={y} r={C * 1.35} stroke={JADE} strokeWidth={3} strokeDasharray="7 5" /></g>;
        })() : null}
        {marks.conseil?.length ? (() => {
          const xs = marks.conseil.map(X), ys = marks.conseil.map(Y), d = C * 0.5;
          const x0 = Math.min(...xs) - d, y0 = Math.min(...ys) - d, w = Math.max(...xs) + d - x0, h = Math.max(...ys) + d - y0;
          return <g fill="none" data-conseil={marks.conseil.map(p => toLabel(p, size)).join(' ')}><rect x={x0} y={y0} width={w} height={h} rx={C * 0.45} stroke={JADE_FONCE} strokeWidth={5} strokeOpacity={0.5} /><rect x={x0} y={y0} width={w} height={h} rx={C * 0.45} stroke={JADE} strokeWidth={3} strokeDasharray="7 5" /></g>;
        })() : null}
        {marks.ok != null && marks.ok >= 0 ? (() => { const [x, y] = at(marks.ok); return (
          <g fill="none"><circle cx={x} cy={y} r={C * 0.52} stroke={JADE_FONCE} strokeWidth={5.4} /><circle cx={x} cy={y} r={C * 0.52} stroke={JADE} strokeWidth={3} /></g>
        ); })() : null}
        {marks.mistake != null && marks.mistake >= 0 ? (() => { const x = X(marks.mistake), y = Y(marks.mistake), d = `M${x - 8} ${y - 8}L${x + 8} ${y + 8}M${x + 8} ${y - 8}L${x - 8} ${y + 8}`; return (
          <g fill="none" strokeLinecap="round"><path d={d} stroke={PAPIER} strokeOpacity={0.85} strokeWidth={7} /><path d={d} stroke={HANKO} strokeWidth={4} /></g>
        ); })() : null}
        {marks.meilleur != null && marks.meilleur >= 0 && !board[marks.meilleur] ? (() => { const [x, y] = at(marks.meilleur); return (
          <circle cx={x} cy={y} r={R * 0.92} fill={JADE} fillOpacity={0.55} stroke={JADE_FONCE} strokeWidth={2.4} data-meilleur="" />
        ); })() : null}
        {marks.note && marks.note.p >= 0 && board[marks.note.p] ? (() => {
          const n = marks.note, [x, y] = at(n.p), s = C * 0.5, cx = x + R * 0.78, cy = y - R * 0.78;
          return (
            <g key={`note${n.cle}`} transform={`translate(${cx.toFixed(2)} ${cy.toFixed(2)})`} data-note-sceau={n.libelle}>
              <g className="note-tampon" transform="rotate(-6)">
                <rect x={-s / 2 - 1.5} y={-s / 2 - 1.5} width={s + 3} height={s + 3} rx={s * 0.3} fill={PAPIER} fillOpacity={0.9} />
                <rect x={-s / 2} y={-s / 2} width={s} height={s} rx={s * 0.26} fill={n.fond} />
                <rect x={-s / 2 + 2} y={-s / 2 + 2} width={s - 4} height={s - 4} rx={s * 0.2} fill="none" stroke={n.texte} strokeOpacity={0.35} strokeWidth={1} />
                <text y={s * 0.02} textAnchor="middle" dominantBaseline="central" fill={n.texte}
                  fontSize={s * (n.symbole.length > 1 ? 0.5 : 0.62)} fontWeight={800} fontFamily="var(--font-titre)">{n.symbole}</text>
              </g>
            </g>
          );
        })() : null}
        {jouable && focus && clavier ? (
          // Curseur clavier : carré arrondi (distinct des cercles « bon coup » et « dernier coup »), anneau jade sur un liseré
          // presque noir. Au moins 3:1 sur tous les bois et sur les deux couleurs de pierres (boardA11y.test.ts). Aucune animation.
          <g fill="none" data-curseur={toLabel(cur, size)} aria-hidden="true">
            <rect x={X(cur) - C * 0.48} y={Y(cur) - C * 0.48} width={C * 0.96} height={C * 0.96} rx={C * 0.2} stroke={CURSEUR.lisere} strokeWidth={6.5} />
            <rect x={X(cur) - C * 0.48} y={Y(cur) - C * 0.48} width={C * 0.96} height={C * 0.96} rx={C * 0.2} stroke={CURSEUR.anneau} strokeWidth={3} />
          </g>
        ) : null}
        {ghostP >= 0 && surFantome?.(ghostP)}
        {ghostP >= 0 ? <g {...fantome(ghostP)} opacity={0.5} data-fantome="" aria-hidden="true">{corps(toPlay, ghostP, size)}</g> : null}
        {shaking >= 0 && !board[shaking] ? (
          <g key={`tr${shakeSeen}`} {...fantome(shaking)} opacity={0.5} aria-hidden="true"><g className="tremble">{corps(toPlay, shaking, size)}</g></g>
        ) : null}
      </svg>
      {jouable ? (
        <>
          <p id={`${uid}-aide`} className="sr-only">{t('plateau.aide')}</p>
          {/* « Lire le plateau » : caché jusqu'au focus (lecteur d'écran, Tab), pour garder une seule action visible à l'écran. */}
          <button type="button" className="lire-plateau" onClick={lire}>{t('plateau.lire.bouton')}</button>
          <p className="sr-only" aria-live="polite" data-annonce-plateau=""><span key={annonce.n}>{annonce.texte}</span></p>
        </>
      ) : null}
    </div>
  );
}
