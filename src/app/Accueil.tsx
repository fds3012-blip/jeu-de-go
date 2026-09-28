// Écran d'accueil v2 (issue #40, phase 4 ; maquette docs/design/v2/maquettes-v2.png, écran de gauche).
// Issue #119 : une seule action principale, le bouton. Le goban est l'illustration ; le toucher lance aussi la partie.
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Board } from '../ui/Board';
import { Sceau } from '../ui/Sceau';
import { Portrait } from '../ui/Portrait';
import { CarrouselAdversaires, type CarteAdversaire } from '../ui/Carrousel';
import type { Opponent } from '../engine';
import type { Accueil as TextesAccueil } from './home';
import { fr } from '../ui/typo';
import { t } from '../content/i18n';

type Taille = 9 | 13 | 19;

/** Tuile du Go du jour (issue #75) : le défi commun, numéroté. */
export interface TuileProbleme { titre: string; reussi: boolean; rows: string[]; numero: number;
  /** Pastille d'état (#236, N4) : « Fait », « À faire », ou rien (premier lancement, autre appel à l'écran). */
  etat?: 'fait' | 'aFaire' | null }
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
  /** Partie guidée contre Mochi (#79), hors de l'échelle des adversaires. */
  onGuidee?: () => void;
  probleme?: TuileProbleme;
  onProbleme: () => void;
  /** Leçon suivante ; absente quand tout le chemin est fait. */
  lecon?: TuileLecon;
  onLecon: () => void;
  /** Carte « Installe l'app » (#214), sous les tuiles, au 2e retour ; elle décide seule si elle se montre. */
  installation?: ReactNode;
}

const PLATEAUX: Record<Taille, Int8Array> = { 9: new Int8Array(81), 13: new Int8Array(169), 19: new Int8Array(361) };
const AIDE_TAILLE = { 9: 'accueil.aideTaille.9', 13: 'accueil.aideTaille.13', 19: 'accueil.aideTaille.19' } as const satisfies Record<Taille, string>;

export function Accueil(p: Props) {
  const { adv, textes, taille } = p;
  // Sans état fourni : l'ancien comportement (« Fait » ou « À faire »).
  const etat = p.probleme ? (p.probleme.etat !== undefined ? p.probleme.etat : p.probleme.reussi ? 'fait' : 'aFaire') : null;
  const kyu = /kyu/.test(adv.rang) ? ` ${t('accueil.kyu')}` : '';
  return (
    <div className="accueil">
      {/* Le goban est une illustration : plateau entier, aucune bulle ni pierre qui pulse par-dessus.
          Il reste touchable (même effet que le bouton), sans y inviter. */}
      <div className="scene">
        {/* Doublon tactile du bouton principal : masqué aux lecteurs d'écran, qui ont déjà le bouton. */}
        <div className="scene-plateau" aria-hidden="true" data-testid="plateau-accueil" onClick={p.onJouer}>
          <div className="scene-cadre">
            <Board size={taille} board={PLATEAUX[taille]} />
          </div>
        </div>
      </div>

      {/* L'adversaire parle sous le plateau : sa bulle ne cache plus aucune ligne. */}
      <div className="adversaire">
        <Portrait id={adv.id} taille={48} decoratif signature={false} />
        <div className="adversaire-texte">
          <div className="adversaire-identite">
            <h2>{adv.nom}</h2>
            <span>{adv.rang}</span>
          </div>
          <p className="scene-bulle">{textes.bulle}</p>
        </div>
      </div>
      <p className="phrase">{fr(t(`adv.${adv.id}.phrase`) + (textes.nouveau ? kyu : ''))}</p>

      <div className="reglage">
        <span>{t('accueil.plateau', { taille })}</span>
        <button className="lien" aria-haspopup="dialog" aria-expanded={p.reglages} onClick={() => p.setReglages(true)}>{t('accueil.changer')}</button>
      </div>

      {/* Libellé court (« Jouer contre Pomme ») : taille pleine ; long (première partie) : un cran plus petit, sur une ligne. */}
      <button className={`cta cta-sceau${textes.cta.length <= 26 ? ' court' : ''}`} aria-label={textes.ctaNom} onClick={p.onJouer}>
        <Sceau id={adv.id} taille={30} />{textes.cta}
      </button>

      <div className="tuiles">
        {/* #213 : la tuile dit l'état du jour, « À faire » tant que le Go du jour d'aujourd'hui n'est pas réussi, puis « Fait ». */}
        <button className={`tuile tuile-probleme${etat === 'fait' ? ' fait' : etat === 'aFaire' ? ' a-faire' : ''}`} onClick={p.onProbleme}
          aria-label={p.probleme ? (etat
            ? t('accueil.tuileAria', { numero: p.probleme.numero, titre: p.probleme.titre, etat: t(etat === 'fait' ? 'accueil.fait' : 'accueil.aFaire') })
            : t('accueil.tuileAriaSimple', { numero: p.probleme.numero, titre: p.probleme.titre })) : undefined}>
          {p.probleme && <MiniPlateau rows={p.probleme.rows} />}
          <span>
            <small>{p.probleme ? t('accueil.goDuJourNumero', { numero: p.probleme.numero }) : t('accueil.goDuJour')}</small>
            <b>{p.probleme?.titre ?? t('nav.problemes')}</b>
          </span>
          {p.probleme && etat && (
            <em className="tuile-etat" data-testid="etat-du-jour" aria-hidden="true">
              {etat === 'fait' && <svg viewBox="0 0 12 12" width="11" height="11" focusable="false"><path d="M2.5 6.4 5 8.8l4.6-5.3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              {t(etat === 'fait' ? 'accueil.fait' : 'accueil.aFaire')}
            </em>
          )}
        </button>
        <button className="tuile tuile-lecon" onClick={p.onLecon}>
          <span>
            <small>{p.lecon ? t('accueil.lecon', { rang: p.lecon.rang, total: p.lecon.total }) : t('accueil.leconsTerminees')}</small>
            <b>{p.lecon?.titre ?? t('accueil.revoirChemin')}</b>
          </span>
        </button>
      </div>

      {p.installation}

      <Reglages {...p} />
    </div>
  );
}

/** Feuille « Changer » : carrousel des adversaires et taille du plateau, dans une boîte de dialogue modale native. */
function Reglages({ adv, cartes, taille, reglages, setReglages, onTaille, onChoisir, onJouer, onDeux, onGuidee, textes }: Props) {
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
            <h2 id="feuille-titre">{t('accueil.tonAdversaire')}</h2>
            <button className="lien" onClick={() => setReglages(false)}>{t('accueil.fermer')}</button>
          </div>
          <CarrouselAdversaires cartes={cartes} choisi={adv.id} onChoisir={onChoisir} legende={t(`adv.${adv.id}.description`)} />
          <h2>{t('accueil.taillePlateau')}</h2>
          <div className="seg">
            {([9, 13, 19] as const).map(n => <button key={n} aria-pressed={taille === n} onClick={() => onTaille(n)}>{n} × {n}</button>)}
          </div>
          <p className="muted small">{t(AIDE_TAILLE[taille])}</p>
          <button className="btn primary" aria-label={textes.ctaNom} onClick={onJouer}>{textes.cta}</button>
          <button className="lien deux" onClick={onDeux}>{t('accueil.deux')}</button>
          {onGuidee && <button className="lien deux" onClick={onGuidee}>{t('accueil.guidee')}</button>}
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
