// Écran d'accueil v2 (issue #40, phase 4 ; maquette docs/design/v2/maquettes-v2.png, écran de gauche).
// Le goban est l'image d'accueil : le toucher lance la partie, comme le bouton principal.
import { useEffect, useMemo, useRef } from 'react';
import { Board } from '../ui/Board';
import { R, boardWidth, viewBoxOf } from '../ui/boardArt';
import { Sceau } from '../ui/Sceau';
import { CarrouselAdversaires, type CarteAdversaire } from '../ui/Carrousel';
import type { Opponent } from '../engine';
import type { Accueil as TextesAccueil } from './home';
import { fr } from '../ui/typo';

type Taille = 9 | 13 | 19;

export interface TuileProbleme { titre: string; reussi: boolean; rows: string[] }
export interface TuileLecon { rang: number; total: number; titre: string }

interface Props {
  adv: Opponent;
  battu: boolean;
  textes: TextesAccueil;
  taille: Taille;
  cartes: CarteAdversaire<Opponent['id']>[];
  reglages: boolean;
  setReglages: (ouvert: boolean) => void;
  onTaille: (t: Taille) => void;
  onChoisir: (id: Opponent['id']) => void;
  onJouer: () => void;
  onDeux: () => void;
  probleme?: TuileProbleme;
  onProbleme: () => void;
  /** Leçon suivante ; absente quand tout le chemin est fait. */
  lecon?: TuileLecon;
  onLecon: () => void;
}

const PLATEAUX: Record<Taille, Int8Array> = { 9: new Int8Array(81), 13: new Int8Array(169), 19: new Int8Array(361) };
const AIDE_TAILLE: Record<Taille, string> = {
  9: 'Parties courtes, idéal pour apprendre.',
  13: 'Une partie de taille moyenne.',
  19: 'Le plateau classique des joueurs confirmés.',
};

export function Accueil(p: Props) {
  const { adv, textes, taille } = p;
  // Géométrie du goban (src/ui/boardArt.ts) : le viewBox a une bande de coordonnées en haut et à gauche,
  // le centre du plateau n'est donc pas au milieu de l'image.
  const vb = viewBoxOf(taille), centre = `${((boardWidth(taille) / 2 - vb.min) / vb.span) * 100}%`;
  const kyu = /kyu/.test(adv.rang) ? ' Le kyu est un niveau : plus il est petit, plus on est fort.' : '';
  return (
    <div className="accueil">
      <div className="scene">
        {/* Doublon tactile du bouton principal : masqué aux lecteurs d'écran, qui ont déjà le bouton. */}
        <div className="scene-plateau" aria-hidden="true" data-testid="plateau-accueil" onClick={p.onJouer}>
          <div className="scene-cadre">
            <Board size={taille} board={PLATEAUX[taille]} />
            <span className="fantome-repere"><span className="fantome" style={{ width: `${((2 * R) / vb.span) * 100}%`, left: centre, top: centre }} /></span>
          </div>
        </div>
        <div className="scene-bulle">
          <Sceau id={adv.id} taille={56} battu={p.battu} />
          <p>{textes.bulle}</p>
        </div>
      </div>

      <div className="adversaire-identite">
        <h2>{adv.nom}</h2>
        <span>{adv.rang}</span>
      </div>
      <p className="phrase">{fr(adv.phrase + (textes.nouveau ? kyu : ''))}</p>

      <div className="reglage">
        <span>{`Plateau ${taille}\u00A0×\u00A0${taille}, tu as Noir`}</span>
        <button className="lien" aria-haspopup="dialog" aria-expanded={p.reglages} onClick={() => p.setReglages(true)}>Changer</button>
      </div>

      {/* Libellé court (« Jouer contre Pomme ») : taille pleine ; long (première partie) : un cran plus petit, sur une ligne. */}
      <button className={`cta${textes.cta.length <= 26 ? ' court' : ''}`} onClick={p.onJouer}>{textes.cta}</button>

      <div className="tuiles">
        <button className="tuile tuile-probleme" onClick={p.onProbleme}>
          {p.probleme && <MiniPlateau rows={p.probleme.rows} />}
          <span>
            <small>{p.probleme?.reussi ? 'Problème du jour réussi' : 'Problème du jour'}</small>
            <b>{p.probleme?.titre ?? 'Problèmes'}</b>
          </span>
        </button>
        <button className="tuile tuile-lecon" onClick={p.onLecon}>
          <span>
            <small>{p.lecon ? `Leçon ${p.lecon.rang} sur ${p.lecon.total}` : 'Leçons terminées'}</small>
            <b>{p.lecon?.titre ?? 'Revoir le chemin'}</b>
          </span>
        </button>
      </div>

      <Reglages {...p} />
    </div>
  );
}

/** Feuille « Changer » : carrousel des adversaires et taille du plateau, dans une boîte de dialogue modale native. */
function Reglages({ adv, cartes, taille, reglages, setReglages, onTaille, onChoisir, onJouer, onDeux, textes }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (reglages && !d.open) d.showModal?.();
    if (!reglages && d.open) d.close();
  }, [reglages]);

  return (
    <dialog ref={ref} className="feuille" aria-labelledby="feuille-titre" onClose={() => setReglages(false)}
      // Un toucher sur le voile (hors de la feuille) la ferme.
      onClick={e => { if (e.target === ref.current) setReglages(false); }}>
      {reglages && (
        <div className="feuille-corps">
          <div className="feuille-tete">
            <h2 id="feuille-titre">Ton adversaire</h2>
            <button className="lien" onClick={() => setReglages(false)}>Fermer</button>
          </div>
          <CarrouselAdversaires cartes={cartes} choisi={adv.id} onChoisir={onChoisir} legende={adv.description} />
          <h2>Taille du plateau</h2>
          <div className="seg">
            {([9, 13, 19] as const).map(n => <button key={n} aria-pressed={taille === n} onClick={() => onTaille(n)}>{n} × {n}</button>)}
          </div>
          <p className="muted small">{AIDE_TAILLE[taille]}</p>
          <button className="btn primary" onClick={onJouer}>{textes.cta}</button>
          <button className="lien deux" onClick={onDeux}>Jouer à deux sur ce téléphone</button>
        </div>
      )}
    </dialog>
  );
}

/** Miniature du problème du jour : la zone où sont les pierres, sur un bout de kaya. */
function MiniPlateau({ rows }: { rows: string[] }) {
  const n = rows.length;
  const cadre = useMemo(() => {
    let x0 = n, y0 = n, x1 = -1, y1 = -1;
    rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }));
    if (x1 < 0) return { x: 0, y: 0, k: n };
    const k = Math.min(n, Math.max(x1 - x0, y1 - y0) + 3); // une ligne de marge autour des pierres
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const clamp = (v: number) => Math.max(0, Math.min(n - k, Math.round(v - (k - 1) / 2)));
    return { x: clamp(cx), y: clamp(cy), k };
  }, [rows, n]);
  const { x, y, k } = cadre;
  const pas = 10, bord = 5, cote = bord * 2 + (k - 1) * pas;
  const pierres = [];
  for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) {
    const ch = rows[y + j]?.[x + i];
    if (ch && ch !== '.') {
      const noir = ch === 'X' || ch === 'S';
      pierres.push(<circle key={`${i}-${j}`} cx={bord + i * pas} cy={bord + j * pas} r={4.6} fill={noir ? '#1B1A18' : '#F3EDE3'} stroke={noir ? 'none' : 'rgba(60,40,15,.45)'} strokeWidth={0.6} />);
    }
  }
  return (
    <svg className="mini-plateau" viewBox={`0 0 ${cote} ${cote}`} aria-hidden="true" focusable="false">
      <rect width={cote} height={cote} rx={3} fill="#E3B46A" />
      {Array.from({ length: k }, (_, i) => (
        <g key={i} stroke="#3A2912" strokeWidth={0.6} opacity={0.75}>
          <line x1={bord} x2={cote - bord} y1={bord + i * pas} y2={bord + i * pas} />
          <line y1={bord} y2={cote - bord} x1={bord + i * pas} x2={bord + i * pas} />
        </g>
      ))}
      {pierres}
    </svg>
  );
}
