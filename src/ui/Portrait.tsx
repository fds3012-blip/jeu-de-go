// Portraits illustrés des 9 adversaires (issue #102). Bustes dessinés à la main sur une grille 100 × 100,
// aplats + trait d'encre arrondi, un reflet clair, fond teinté selon le palier des sceaux
// (vermillon : Pomme, Caillou, Bambou ; indigo : Renard, Rivière, Tigre ; noir et or : Montagne, Dragon, Sensei).
// L'humeur change surtout les yeux et la bouche. Le sceau de l'adversaire signe le portrait, en bas à droite.
import type { ReactElement } from 'react';
import { Sceau } from './Sceau';
import type { SceauId } from './sceaux';

export type PortraitId = Exclude<SceauId, 'mochi'>;
export type Humeur = 'neutre' | 'content' | 'surpris';

const ENCRE = '#1C1916', PAPIER = '#F7E9DA', OR = '#E9B949', VERMILLON = '#D2432C', INDIGO = '#2F4B8A';
const JADE = '#3CC48E', JADE_F = '#1E8A5F', REFLET = '#fff';
const ROSE_FOND = '#F6D3C2', BLEU_FOND = '#C9D4EE', GALET = '#9C958A', POUSSE = '#8CCB6E', ARDOISE = '#6F7B8C', PEAU = '#EAC9A1';
const T = { stroke: ENCRE, strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export const NOMS: Record<PortraitId, string> = {
  pomme: 'Pomme', caillou: 'Caillou', bambou: 'Bambou', renard: 'Renard', riviere: 'Rivière',
  tigre: 'Tigre', montagne: 'Montagne', dragon: 'Dragon', sensei: 'Sensei',
};

const PALIER: Record<PortraitId, 0 | 1 | 2> = {
  pomme: 0, caillou: 0, bambou: 0, renard: 1, riviere: 1, tigre: 1, montagne: 2, dragon: 2, sensei: 2,
};
/**
 * Fond du cadre par palier. Charte `personnages-go` : 4 couleurs au plus, fond compris.
 * Le fond du dernier palier est l'encre elle-même, et son liseré or est l'une des 4 couleurs.
 */
const FOND = [
  { fond: ROSE_FOND, liseré: null },
  { fond: BLEU_FOND, liseré: null },
  { fond: ENCRE, liseré: OR },
] as const;

export const palierDe = (id: PortraitId) => PALIER[id];

/* ---------- Yeux, bouches, sourcils : partagés, paramétrés ---------- */

interface OeilOpts { r?: number; miClos?: boolean; plisse?: boolean; couleur?: string }
function oeil(x: number, y: number, h: Humeur, { r = 3.4, miClos, plisse, couleur = ENCRE }: OeilOpts = {}): ReactElement {
  if (h === 'content') return <path d={`M${x - r} ${y + r * 0.4}Q${x} ${y - r * 1.3} ${x + r} ${y + r * 0.4}`} fill="none" {...T} strokeWidth={2.4} />;
  if (h === 'surpris') return (<g>
    <circle cx={x} cy={y} r={r * 1.25} fill={couleur} />
    <circle cx={x} cy={y} r={r * 0.62} fill="none" stroke={REFLET} strokeWidth={1.3} opacity=".9" />
    <circle cx={x - r * 0.45} cy={y - r * 0.45} r={r * 0.3} fill={REFLET} />
  </g>);
  if (plisse) return <path d={`M${x - r} ${y - r * 0.3}L${x + r} ${y + r * 0.3}`} fill="none" {...T} strokeWidth={2.4} />;
  if (miClos) return (<g>
    <path d={`M${x - r} ${y}Q${x} ${y + r * 1.4} ${x + r} ${y}Z`} fill={couleur} />
    <path d={`M${x - r * 1.2} ${y}H${x + r * 1.2}`} fill="none" {...T} strokeWidth={2.4} />
  </g>);
  return (<g>
    <ellipse cx={x} cy={y} rx={r * 0.85} ry={r} fill={couleur} />
    <circle cx={x - r * 0.3} cy={y - r * 0.4} r={r * 0.34} fill={REFLET} />
  </g>);
}

function bouche(x: number, y: number, h: Humeur, w = 4, neutre?: string): ReactElement {
  if (h === 'content') return (<g>
    <path d={`M${x - w * 1.3} ${y - 0.5}Q${x} ${y + w * 2.1} ${x + w * 1.3} ${y - 0.5}Z`} fill={ENCRE} {...T} strokeWidth={1.6} />
    <path d={`M${x - w * 0.6} ${y + w * 0.95}Q${x} ${y + w * 0.35} ${x + w * 0.6} ${y + w * 0.95}Q${x} ${y + w * 1.35} ${x - w * 0.6} ${y + w * 0.95}Z`} fill={REFLET} opacity=".35" />
  </g>);
  if (h === 'surpris') return <ellipse cx={x} cy={y + 1} rx={w * 0.45} ry={w * 0.62} fill={ENCRE} />;
  return <path d={neutre ?? `M${x - w} ${y}Q${x} ${y + w * 0.8} ${x + w} ${y}`} fill="none" {...T} />;
}

/** Sourcils levés quand il est surpris. */
const leve = (h: Humeur) => (h === 'surpris' ? -3 : 0);

const reflet = (cx: number, cy: number, rx: number, ry: number, rot = -30) =>
  <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={REFLET} opacity=".45" transform={`rotate(${rot} ${cx} ${cy})`} />;

/* ---------- Les 9 personnages ---------- */

function dessin(id: PortraitId, h: Humeur): ReactElement {
  switch (id) {
    case 'pomme': return (<>
      {/* Tige et feuille-pépin, puis le corps rond. */}
      <path d="M50 30c0-6 1-10 4-13" fill="none" {...T} strokeWidth={2.6} />
      <path d="M54 22c6-8 16-7 19-4-4 7-13 9-19 4Z" fill={JADE} {...T} />
      <path d="M50 30c-9-7-33-5-34 17-1 20 12 45 25 45 4 0 6-2 9-2s5 2 9 2c13 0 26-25 25-45-1-22-25-24-34-17Z" fill={VERMILLON} {...T} />
      {reflet(30, 44, 5, 9)}
      <ellipse cx="31" cy="66" rx="6" ry="3.6" fill={ROSE_FOND} />
      <ellipse cx="69" cy="66" rx="6" ry="3.6" fill={ROSE_FOND} />
      {oeil(39, 57, h, { r: 4.6 })}{oeil(61, 57, h, { r: 4.6 })}
      {bouche(50, 68, h, 3.6)}
    </>);
    case 'caillou': return (<>
      <path d="M14 92c-2-22 8-52 36-54 28-2 40 22 38 54Z" fill={GALET} {...T} />
      {/* Mousse sur le dessus. */}
      <path d="M26 50c2-9 10-13 16-12 3-5 12-6 17-2 6-2 14 2 16 10-4 3-9 1-12 3-4-3-8-1-11 1-4-3-9-2-12 1-5-3-10-2-14-1Z" fill={JADE_F} {...T} strokeWidth={1.8} />
      {reflet(27, 64, 4, 8, -15)}
      <path d={`M31 ${59 + leve(h)}h10M59 ${59 + leve(h)}h10`} fill="none" {...T} strokeWidth={2.6} />
      {oeil(37, 66, h, { r: 4, miClos: true })}{oeil(63, 66, h, { r: 4, miClos: true })}
      {bouche(50, 78, h, 4, 'M45 78h10')}
    </>);
    case 'bambou': return (<>
      {/* Feuilles en mèche. */}
      <path d="M50 26c-8-10-20-12-28-9 6 8 17 11 28 9Z" fill={JADE_F} {...T} strokeWidth={1.8} />
      <path d="M52 24c4-11 14-16 23-15-3 9-13 15-23 15Z" fill={JADE_F} {...T} strokeWidth={1.8} />
      <path d="M49 28c6-6 17-5 23 1-8 3-17 3-23-1Z" fill={JADE_F} {...T} strokeWidth={1.8} />
      <rect x="28" y="27" width="44" height="72" rx="17" fill={POUSSE} {...T} />
      <path d="M28 49c10 3 34 3 44 0M28 86c10 3 34 3 44 0" fill="none" {...T} strokeWidth={1.8} />
      {reflet(35, 40, 3, 7, 0)}
      <ellipse cx="34" cy="68" rx="4.4" ry="2.8" fill={ROSE_FOND} />
      <ellipse cx="66" cy="68" rx="4.4" ry="2.8" fill={ROSE_FOND} />
      {oeil(41, 61, h === 'neutre' ? 'content' : h, { r: 4 })}{oeil(59, 61, h === 'neutre' ? 'content' : h, { r: 4 })}
      {bouche(50, 70, h === 'neutre' ? 'content' : h, 3.2)}
    </>);
    case 'renard': return (<>
      <path d="M22 100c2-12 12-18 28-18s26 6 28 18Z" fill={PAPIER} {...T} />
      {/* Oreilles, tête, masque clair. */}
      <path d="M22 44 20 14l22 16ZM78 44l2-30-22 16Z" fill={VERMILLON} {...T} />
      <path d="M25 22l2 14 8-4ZM75 22l-2 14-8-4Z" fill={ENCRE} />
      <path d="M50 88C34 88 16 66 18 48c2-14 14-22 32-22s30 8 32 22c2 18-16 40-32 40Z" fill={VERMILLON} {...T} />
      <path d="M50 88c-10 0-22-10-28-24 8 0 16 3 22 8h12c6-5 14-8 22-8-6 14-18 24-28 24Z" fill={PAPIER} {...T} strokeWidth={1.8} />
      {reflet(30, 40, 4, 8)}
      <path d={`M31 ${46 + leve(h)}l10 2M69 ${46 + leve(h)}l-10 2`} fill="none" {...T} />
      {oeil(37, 54, h, { r: 3.6 })}{oeil(63, 54, h, { r: 3.6, plisse: h === 'neutre' })}
      <path d="M46 71h8l-4 4Z" fill={ENCRE} {...T} strokeWidth={1.6} />
      {bouche(50, 79, h, 3.6, 'M44 79q6 3 11-2')}
    </>);
    case 'riviere': return (<>
      <path d="M20 100c2-12 13-18 30-18s28 6 30 18Z" fill={INDIGO} {...T} />
      {/* Cheveux en vagues derrière le visage. */}
      <path d="M14 76c-6-24 4-54 36-56 32 2 42 32 36 56-4-6-10-6-12 0-2-8-8-10-12-4 2-10-2-20-12-24-10 4-14 14-12 24-4-6-10-4-12 4-2-6-8-6-12 0Z" fill={INDIGO} {...T} />
      <ellipse cx="50" cy="56" rx="22" ry="25" fill={PAPIER} {...T} />
      <path d="M28 44c6-6 12-6 18 0s12 6 18 0 8-4 8-4" fill="none" stroke={INDIGO} strokeWidth="5" strokeLinecap="round" />
      <path d="M17 60c3-3 6-3 9 0M74 60c3-3 6-3 9 0M16 70c3-3 6-3 9 0M75 70c3-3 6-3 9 0" fill="none" stroke={INDIGO} strokeWidth="2.2" strokeLinecap="round" />
      {reflet(38, 48, 3, 6)}
      <ellipse cx="36" cy="66" rx="4" ry="2.4" fill={BLEU_FOND} />
      <ellipse cx="64" cy="66" rx="4" ry="2.4" fill={BLEU_FOND} />
      {h === 'neutre'
        ? <path d="M36 58q5 4 10 0M54 58q5 4 10 0" fill="none" {...T} strokeWidth={2.4} />
        : <>{oeil(41, 58, h, { r: 3.4, couleur: INDIGO })}{oeil(59, 58, h, { r: 3.4, couleur: INDIGO })}</>}
      {bouche(50, 70, h, 3, 'M46 70q4 3 8 0')}
    </>);
    case 'tigre': return (<>
      <path d="M18 100c2-12 14-18 32-18s30 6 32 18Z" fill={ENCRE} {...T} />
      <circle cx="24" cy="32" r="9" fill={OR} {...T} /><circle cx="76" cy="32" r="9" fill={OR} {...T} />
      <circle cx="24" cy="32" r="4" fill={PAPIER} /><circle cx="76" cy="32" r="4" fill={PAPIER} />
      <path d="M50 88c-20 0-34-12-34-32 0-18 14-30 34-30s34 12 34 30c0 20-14 32-34 32Z" fill={OR} {...T} />
      {/* Rayures d'encre. */}
      <path d="M50 27v10M42 28l3 8M58 28l-3 8M17 50h9M16 60l9-2M83 50h-9M84 60l-9-2" fill="none" {...T} strokeWidth={3} />
      <path d="M34 76c6 8 26 8 32 0-4-8-10-10-16-10s-12 2-16 10Z" fill={PAPIER} {...T} strokeWidth={1.8} />
      {reflet(30, 42, 4, 7)}
      {/* Regard intense : sourcils en V. */}
      <path d={`M32 ${h === 'surpris' ? 43 : 45}l12 ${h === 'surpris' ? 0 : 4}M68 ${h === 'surpris' ? 43 : 45}l-12 ${h === 'surpris' ? 0 : 4}`} fill="none" {...T} strokeWidth={3} />
      {oeil(39, 55, h, { r: 3.8, couleur: ENCRE })}{oeil(61, 55, h, { r: 3.8, couleur: ENCRE })}
      <path d="M45 67h10l-5 5Z" fill={ENCRE} {...T} strokeWidth={1.6} />
      {bouche(50, 76, h, 4, 'M44 76q3 2 6 0q3 2 6 0')}
    </>);
    case 'montagne': return (<>
      <path d="M6 100 34 32c6-12 26-12 32 0l28 68Z" fill={ARDOISE} {...T} />
      {/* Neige au sommet. */}
      <path d="M36 30c5-10 23-10 28 0l6 14c-5 3-8-2-12 1-4-4-8 0-12-2-3 3-8 1-10 3-4-2-7 1-10-1Z" fill={PAPIER} {...T} strokeWidth={1.8} />
      {reflet(33, 60, 3, 9, 20)}
      {/* Sourcils épais. */}
      <path d={`M30 ${56 + leve(h)}q8-5 15 0M55 ${56 + leve(h)}q7-5 15 0`} fill="none" stroke={PAPIER} strokeWidth="5" strokeLinecap="round" />
      {oeil(38, 64, h, { r: 3.6, miClos: h === 'neutre' })}{oeil(62, 64, h, { r: 3.6, miClos: h === 'neutre' })}
      {bouche(50, 78, h, 4.6, 'M44 78q6 2 12 0')}
    </>);
    case 'dragon': return (<>
      <path d="M18 100c2-12 14-18 32-18s30 6 32 18Z" fill={JADE} {...T} />
      {/* Cornes or. */}
      <path d="M32 34 22 12l18 16ZM68 34l10-22-18 16Z" fill={OR} {...T} />
      <path d="M50 90c-20 0-32-14-32-34 0-18 12-30 32-30s32 12 32 30c0 20-12 34-32 34Z" fill={JADE} {...T} />
      {/* Écailles or sur le front. */}
      <path d="M40 34q5 5 10 0q5 5 10 0M44 41q3 4 6 0q3 4 6 0" fill="none" stroke={OR} strokeWidth="2.6" strokeLinecap="round" />
      <ellipse cx="50" cy="74" rx="16" ry="11" fill={JADE} {...T} strokeWidth={1.8} />
      <circle cx="44" cy="71" r="1.6" fill={ENCRE} /><circle cx="56" cy="71" r="1.6" fill={ENCRE} />
      {/* Moustaches. */}
      <path d="M36 74c-10 0-16 6-22 2M64 74c10 0 16 6 22 2" fill="none" stroke={OR} strokeWidth="2.6" strokeLinecap="round" />
      {reflet(30, 46, 3.6, 8)}
      <path d={`M31 ${49 + leve(h)}q7-4 13 1M69 ${49 + leve(h)}q-7-4-13 1`} fill="none" {...T} strokeWidth={2.6} />
      {oeil(38, 57, h, { r: 3.8, couleur: ENCRE })}{oeil(62, 57, h, { r: 3.8, couleur: ENCRE })}
      {bouche(50, 80, h, 4, 'M43 80q7 3 14 0')}
    </>);
    case 'sensei': return (<>
      {/* Col du vêtement, liseré or. */}
      <path d="M16 100c2-12 14-18 34-18s32 6 34 18Z" fill={ENCRE} stroke={OR} strokeWidth="1.8" />
      <path d="M40 82 50 96 60 82" fill="none" stroke={OR} strokeWidth="1.8" />
      <ellipse cx="50" cy="52" rx="23" ry="26" fill={PEAU} {...T} />
      <path d="M27 52c-5 0-6 8 0 9M73 52c5 0 6 8 0 9" fill={PEAU} {...T} strokeWidth={1.8} />
      {reflet(40, 36, 5, 4, -10)}
      {/* Barbe et sourcils blancs. */}
      <path d="M32 64c0 16 8 28 18 30 10-2 18-14 18-30-6 4-12 4-18 2-6 2-12 2-18-2Z" fill={PAPIER} {...T} strokeWidth={1.8} />
      <path d={`M31 ${48 + leve(h)}q7-5 14-1M69 ${48 + leve(h)}q-7-5-14-1`} fill="none" stroke={PAPIER} strokeWidth="4.2" strokeLinecap="round" />
      {oeil(39, 56, h === 'neutre' ? 'content' : h, { r: 3.4 })}{oeil(61, 56, h === 'neutre' ? 'content' : h, { r: 3.4 })}
      {bouche(50, 70, h === 'content' ? 'content' : h, 3.4, 'M45 69q5 3 10 0')}
      {/* Éventail or, tenu devant l'épaule. */}
      <g transform="translate(100 0) scale(-1 1) rotate(18 76 86)">
        <path d="M76 92 60 70a24 24 0 0 1 32 0Z" fill={OR} {...T} strokeWidth={1.8} />
        <path d="M76 92 66 67M76 92V64M76 92l10-25" fill="none" stroke={ENCRE} strokeWidth="1.2" />
      </g>
    </>);
  }
}

interface Props {
  id: PortraitId;
  humeur?: Humeur;
  /** Côté en pixels. */
  taille?: number;
  /** Cadre rond (vignettes du carrousel) au lieu du carré arrondi. */
  rond?: boolean;
  /** Le nom est déjà dit par le texte voisin : le portrait est masqué aux lecteurs d'écran. */
  decoratif?: boolean;
  /** Le sceau signe le portrait en bas à droite (par défaut dès 72 px). */
  signature?: boolean;
  className?: string;
}

export function Portrait({ id, humeur = 'neutre', taille = 44, rond = false, decoratif = false, signature, className }: Props) {
  const f = FOND[PALIER[id]];
  const signe = signature ?? taille >= 72;
  const titre = `${NOMS[id]}${humeur === 'content' ? ', content' : humeur === 'surpris' ? ', surpris' : ''}`;
  const clip = `portrait-clip-${id}-${rond ? 'r' : 'c'}`;
  const forme = rond
    ? <circle cx="50" cy="50" r="48" />
    : <rect x="2" y="2" width="96" height="96" rx="21" />;
  return (
    <span className={['portrait', className].filter(Boolean).join(' ')} data-portrait={id} data-humeur={humeur}
      style={{ width: taille, height: taille }}>
      <svg viewBox="0 0 100 100" width="100%" height="100%" focusable="false"
        {...(decoratif ? { 'aria-hidden': true } : { role: 'img', 'aria-label': titre })}>
        {!decoratif && <title>{titre}</title>}
        <defs><clipPath id={clip}>{forme}</clipPath></defs>
        <g clipPath={`url(#${clip})`}>
          <rect width="100" height="100" fill={f.fond} />
          <circle cx="50" cy="54" r="40" fill={REFLET} opacity={f.liseré ? '.06' : '.3'} />
          {dessin(id, humeur)}
        </g>
        {rond
          ? f.liseré && <circle cx="50" cy="50" r="47" fill="none" stroke={f.liseré} strokeWidth="3" />
          : f.liseré && <rect x="3" y="3" width="94" height="94" rx="20" fill="none" stroke={f.liseré} strokeWidth="3" />}
      </svg>
      {signe && <span className="portrait-signature"><Sceau id={id} taille={Math.round(taille * 0.24)} /></span>}
    </span>
  );
}

/** Petite couronne or d'une victoire contre cet adversaire. */
export function Couronne({ taille = 18 }: { taille?: number }) {
  return (
    <svg className="couronne" viewBox="0 0 24 24" width={taille} height={taille} aria-hidden="true" focusable="false">
      <path d="M4 18 3 7l5 4 4-7 4 7 5-4-1 11Z" fill={OR} stroke={ENCRE} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M5 21h14" stroke={ENCRE} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export const PORTRAITS: readonly PortraitId[] = ['pomme', 'caillou', 'bambou', 'renard', 'riviere', 'tigre', 'montagne', 'dragon', 'sensei'];

/* ---------- Mochi, le chat coach ---------- */

export type HumeurMochi = 'neutre' | 'content' | 'fier' | 'pensif';

/** Mochi en buste, même grammaire que les adversaires : papier, encre, jade, jade foncé. */
function dessinMochi(h: HumeurMochi): ReactElement {
  const yeux = h === 'content'
    ? <>{oeil(39, 57, 'content', { r: 4 })}{oeil(61, 57, 'content', { r: 4 })}</>
    : h === 'fier'
      // Yeux mi-clos vers le bas, satisfaits.
      ? <path d="M35 56q4 4 8 0M57 56q4 4 8 0" fill="none" {...T} />
      : h === 'pensif'
        // Regard levé vers le coin : il réfléchit.
        ? <><ellipse cx="40" cy="57" rx="3.4" ry="4" fill={ENCRE} /><ellipse cx="62" cy="57" rx="3.4" ry="4" fill={ENCRE} />
          <circle cx="41.4" cy="55" r="1.4" fill={REFLET} /><circle cx="63.4" cy="55" r="1.4" fill={REFLET} /></>
        : <>{oeil(39, 57, 'neutre', { r: 4 })}{oeil(61, 57, 'neutre', { r: 4 })}</>;
  const bouche_ = h === 'content'
    ? bouche(50, 69, 'content', 3.4)
    : h === 'pensif'
      ? <path d="M46 71q3-1.5 7 0" fill="none" {...T} />
      : <path d={h === 'fier' ? 'M43 68q3.5 4 7 0q3.5 4 7 0' : 'M44 69q3 3 6 0q3 3 6 0'} fill="none" {...T} />;
  return (<>
    <path d="M18 100c2-12 14-18 32-18s30 6 32 18Z" fill={JADE} {...T} />
    {/* Oreilles et tête ronde. */}
    <path d="M22 50 24 18l22 14ZM78 50l-2-32-22 14Z" fill={JADE} {...T} />
    <path d="M28 28l1 12 8-5ZM72 28l-1 12-8-5Z" fill={JADE_F} />
    <ellipse cx="50" cy="58" rx="31" ry="27" fill={JADE} {...T} />
    <ellipse cx="50" cy="69" rx="13" ry="8.5" fill={PAPIER} />
    {reflet(32, 44, 4, 7)}
    <path d="M44 37q6 3 12 0" fill="none" stroke={JADE_F} strokeWidth="3" strokeLinecap="round" />
    <ellipse cx="30" cy="66" rx="4.4" ry="2.6" fill={JADE_F} opacity=".55" /><ellipse cx="70" cy="66" rx="4.4" ry="2.6" fill={JADE_F} opacity=".55" />
    {/* Moustaches. */}
    <path d="M22 64l-8-2M22 69l-8 1M78 64l8-2M78 69l8 1" fill="none" {...T} strokeWidth={1.8} />
    {yeux}
    <path d="M47.5 63.5h5L50 66Z" fill={ENCRE} {...T} strokeWidth={1.4} />
    {bouche_}
    {h === 'pensif' && <>
      <circle cx="66" cy="86" r="7" fill={JADE} {...T} />
      <g fill={JADE_F}><circle cx="72" cy="27" r="2.2" /><circle cx="79" cy="21" r="2.6" /><circle cx="86" cy="14" r="3" /></g>
    </>}
    {h === 'fier' && <path d="M80 26l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill={JADE_F} />}
  </>);
}

/** Portrait de Mochi, le coach. */
export function PortraitMochi({ humeur = 'neutre', taille = 44, decoratif = false, className }: { humeur?: HumeurMochi; taille?: number; decoratif?: boolean; className?: string }) {
  const titre = `Mochi${humeur === 'neutre' ? '' : `, ${humeur}`}`;
  return (
    <span className={['portrait', 'portrait-mochi', className].filter(Boolean).join(' ')} data-portrait="mochi" data-humeur={humeur}
      style={{ width: taille, height: taille }}>
      <svg viewBox="0 0 100 100" width="100%" height="100%" focusable="false"
        {...(decoratif ? { 'aria-hidden': true } : { role: 'img', 'aria-label': titre })}>
        {!decoratif && <title>{titre}</title>}
        <defs><clipPath id="portrait-clip-mochi"><rect x="2" y="2" width="96" height="96" rx="21" /></clipPath></defs>
        <g clipPath="url(#portrait-clip-mochi)">
          <rect width="100" height="100" fill={PAPIER} />
          {dessinMochi(humeur)}
        </g>
      </svg>
    </span>
  );
}
