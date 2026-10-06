// « Étudier une position » (#372), sous-écran du Profil chargé à la demande : le goban libre du joueur de club.
// En 3 secondes : un goban, quatre outils (Noir, Blanc, Effacer, Jouer) et une seule action principale, « Analyser ».
// - Poser : la position vue au club, pierre par pierre (toucher une pierre de la même couleur l'enlève).
// - Jouer : une variante avec les règles, numérotée sur les pierres ; « Revenir » remet la position de départ intacte.
// - Analyser : KataGo, à la demande, une recherche par geste (batterie) : ses 3 meilleurs coups en pierres vertes avec
//   leurs chances de gain, et qui mène. Chaque conseil passe le filtre de la revue (`conseilFiable` : jamais un coup
//   illégal ni un coup de première ligne sans raison). Sans KataGo en cache : « Télécharge l'IA », aucun conseil.
// - L'étude est gardée sur l'appareil (go.etude.v1) et s'exporte en SGF (relu par « Analyser une partie »).
// Logique pure : src/go/etude.ts.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Board } from '../ui/Board';
import { C, M, viewBoxOf } from '../ui/boardArt';
import { fr } from '../ui/typo';
import { tk, nombreClub } from '../content/i18n/club';
import { toLabel } from '../go/coords';
import { boardKey, type Color } from '../go/rules';
import { numerosDesCoups } from '../go/numeros';
import {
  ETUDE_KEY, etudeVersSgf, etudeVide, jouerVariante, KOMI_ETUDE, lireEtude, pierresPosees, poser, positionsEtude, TAILLES_ETUDE,
  type Etude as EtatEtude, type Outil, type TailleEtude,
} from '../go/etude';
import { analyseEtude, preparerKataGo, type RaisonSansKataGo } from '../engine';
import { EVENTS, track } from '../data/analytics';
import { conseilFiable } from './revue';
import { readLocal, writeLocal } from './hooks';
import { usePreferences } from './settings';
import '../ui/club.css';

/** Coups conseillés montrés au plus. */
const CANDIDATS = 3;
/** Retours en arrière gardés. */
const MAX_HISTOIRE = 200;

type Analyse =
  | { etat: 'attente' }
  | { etat: 'sans-katago'; raison: RaisonSansKataGo | null; telechargement: boolean }
  | { etat: 'pret'; cle: string; lead: number; coups: { move: number; winrate: number | null; lead: number }[]; passe: boolean }
  | { etat: 'erreur' };

const OUTILS: readonly Outil[] = ['noir', 'blanc', 'effacer', 'jouer'];

interface Props {
  confirmTouch: boolean;
}

export function Etude({ confirmTouch }: Props) {
  const [reprise] = useState(() => lireEtude(readLocal<unknown>(ETUDE_KEY, null)));
  const [etude, setEtude] = useState<EtatEtude>(() => reprise ?? etudeVide(9));
  const [histoire, setHistoire] = useState<EtatEtude[]>([]);
  const [outil, setOutil] = useState<Outil>(() => (reprise?.variante.length ? 'jouer' : 'noir'));
  const [refus, setRefus] = useState<{ texte: string; p: number; n: number } | null>(null);
  const [analyse, setAnalyse] = useState<Analyse | null>(null);
  const [export_, setExport] = useState(false);
  const prefs = usePreferences();
  const enCours = useRef(false);
  const racine = useRef<HTMLDivElement>(null);
  const cadre = useRef<HTMLDivElement>(null);
  const largeurMax = useGobanEntier(racine, cadre);

  useEffect(() => { track(EVENTS.etudeOuverte, { taille: etude.size, reprise: !!reprise }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { writeLocal(ETUDE_KEY, { sgf: etudeVersSgf(etude) }); }, [etude]);

  const positions = useMemo(() => positionsEtude(etude), [etude]);
  const pos = positions[positions.length - 1];
  const cle = `${etude.size}|${pos.toPlay}|${boardKey(pos.board)}`;
  const resultat = analyse?.etat === 'pret' && analyse.cle === cle ? analyse : null;
  const numeros = useMemo(() => (etude.variante.length ? numerosDesCoups(positions, positions.length - 1) : null), [positions, etude.variante.length]);

  function changer(suivante: EtatEtude) {
    setHistoire(h => [...h, etude].slice(-MAX_HISTOIRE));
    setEtude(suivante);
    setRefus(null);
    setExport(false);
  }
  function refuser(texte: string, p: number) { setRefus(r => ({ texte, p, n: (r?.n ?? 0) + 1 })); }

  function toucher(p: number) {
    if (outil === 'jouer') {
      const r = jouerVariante(etude, p);
      if (typeof r === 'string') { refuser(tk(r === 'ko' ? 'etude.refus.ko' : r === 'suicide' ? 'etude.refus.suicide' : 'etude.refus.occupe'), p); return; }
      changer(r);
      return;
    }
    const r = poser(etude, p, outil);
    if (r === 'sansLiberte') { refuser(tk('etude.refus.sansLiberte'), p); return; }
    if (r !== etude) changer(r);
  }

  function annuler() {
    const h = histoire.at(-1);
    if (!h) return;
    setHistoire(histoire.slice(0, -1));
    setEtude(h);
    setRefus(null);
  }

  async function analyser() {
    if (enCours.current) return; // un appel par geste : jamais deux recherches en même temps
    enCours.current = true;
    const pour = { cle, pos, pierres: pierresPosees(etude), variante: etude.variante.length };
    setAnalyse({ etat: 'attente' });
    try {
      const a = await analyseEtude(pour.pos, KOMI_ETUDE);
      if (!a.katago) {
        setAnalyse({ etat: 'sans-katago', raison: null, telechargement: false });
        track(EVENTS.analyseDemandee, { taille: etude.size, pierres: pour.pierres, variante: pour.variante, katago: false, issue: 'sans_katago' });
        return;
      }
      // Le filtre de la revue : jamais un coup illégal ni un coup de première ligne sans raison.
      const coups = a.coups.filter(c => conseilFiable(pour.pos, c.move, Infinity)).slice(0, CANDIDATS);
      setAnalyse({ etat: 'pret', cle: pour.cle, lead: a.lead, coups, passe: a.coups[0]?.move === -1 });
      track(EVENTS.analyseDemandee, { taille: etude.size, pierres: pour.pierres, variante: pour.variante, katago: true, issue: 'ok' });
    } catch {
      setAnalyse({ etat: 'erreur' });
      track(EVENTS.analyseDemandee, { taille: etude.size, pierres: pour.pierres, variante: pour.variante, katago: true, issue: 'erreur' });
    } finally {
      enCours.current = false;
    }
  }

  async function telecharger() {
    setAnalyse({ etat: 'sans-katago', raison: null, telechargement: true });
    const r = await preparerKataGo();
    if (r.pret) { void analyser(); return; }
    setAnalyse({ etat: 'sans-katago', raison: r.raison, telechargement: false });
  }

  function exporter() {
    const sgf = etudeVersSgf(etude);
    try {
      const url = URL.createObjectURL(new Blob([sgf], { type: 'application/x-go-sgf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `etude-${new Date().toISOString().slice(0, 10)}.sgf`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { /* navigateur sans téléchargement : le SGF reste gardé sur l'appareil */ }
    setExport(true);
  }

  const taille = (s: TailleEtude) => {
    if (s === etude.size) return;
    changer(etudeVide(s));
  };
  const trait = (c: Color) => { if (c !== etude.trait) changer({ ...etude, trait: c, variante: [] }); };

  const consigne = etude.variante.length ? tk('etude.consigne.variante', { n: etude.variante.length })
    : outil === 'jouer' ? tk('etude.consigne.jouer') : tk('etude.consigne.poser');
  const camp = (c: Color) => tk(c === 1 ? 'etude.trait.noir' : 'etude.trait.blanc');
  const vb = viewBoxOf(etude.size);

  return (
    <div className="etude" data-testid="etude" ref={racine}>
      <div className="etude-ligne">
        <div className="etude-seg" role="group" aria-label={tk('etude.taille')}>
          {TAILLES_ETUDE.map(s => <button type="button" key={s} aria-pressed={etude.size === s} onClick={() => taille(s)} aria-label={`${s} × ${s}`}>{s}</button>)}
        </div>
        {/* Annuler et Revenir en haut, à côté de la taille : visibles sans défiler en 390 × 844, au-dessus du goban. */}
        <div className="etude-actions">
          <button type="button" className="btn" onClick={annuler} disabled={!histoire.length}>{tk('etude.annuler')}</button>
          {etude.variante.length > 0 && <button type="button" className="btn" onClick={() => changer({ ...etude, variante: [] })}>{tk('etude.revenir')}</button>}
        </div>
      </div>
      <div className="etude-outils etude-seg" role="group" aria-label={tk('etude.outils')}>
        {OUTILS.map(o => (
          <button type="button" key={o} aria-pressed={outil === o} onClick={() => setOutil(o)} data-outil={o}>
            {o === 'noir' && <span className="stone b" aria-hidden="true" />}
            {o === 'blanc' && <span className="stone w" aria-hidden="true" />}
            {tk(`etude.outil.${o}`)}
          </button>
        ))}
      </div>
      <div className="etude-ligne">
        <div className="etude-trait" role="group" aria-label={tk('etude.trait')} aria-describedby="etude-trait-aide">
          <span className="etude-trait-libelle" aria-hidden="true">{tk('etude.trait')}</span>
          <div className="etude-seg">
            {([1, 2] as const).map(c => (
              <button type="button" key={c} aria-pressed={etude.trait === c} onClick={() => trait(c)}>
                <span className={`stone ${c === 1 ? 'b' : 'w'}`} aria-hidden="true" />{camp(c)}
              </button>
            ))}
          </div>
          <span id="etude-trait-aide" className="sr-only">{tk('etude.traitAide')}</span>
        </div>
      </div>
      {/* Un refus (ko, sans liberté) remplace la consigne, au même endroit : lu tout de suite, sans décaler le goban. */}
      <p className={refus ? 'etude-refus small' : 'muted small'} role="status" data-testid="etude-consigne">{fr(refus ? refus.texte : consigne)}</p>

      <div className="etude-plateau" ref={cadre} style={largeurMax ? { width: `min(100%, ${largeurMax}px)` } : undefined}>
        <Board size={etude.size} board={pos.board} toPlay={outil === 'jouer' ? pos.toPlay : outil === 'blanc' ? 2 : 1}
          interactive stonesTappable={outil !== 'jouer'} confirmTouch={outil === 'jouer' && confirmTouch} onPlay={toucher}
          shake={refus ? { p: refus.p, n: refus.n } : null} coordonnees={prefs.coordonnees} numeros={numeros}
          marks={{ last: prefs.dernierCoup ? pos.lastMove : null }} />
        {resultat && resultat.coups.length > 0 && (
          <svg className="etude-calque" viewBox={`${vb.min} ${vb.min} ${vb.span} ${vb.span}`} aria-hidden="true" data-testid="etude-candidats">
            {resultat.coups.map((c, i) => {
              const x = M + (c.move % etude.size) * C, y = M + Math.floor(c.move / etude.size) * C;
              return (
                <g key={c.move} className="etude-candidat" data-candidat={toLabel(c.move, etude.size)} style={{ animationDelay: `${i * 40}ms` }}>
                  <circle cx={x} cy={y} r={C * 0.46} />
                  <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={C * 0.34}>{texteCandidat(c)}</text>
                </g>
              );
            })}
          </svg>
        )}
      </div>

      <Resultat analyse={analyse} resultat={resultat} camp={camp(pos.toPlay)} taille={etude.size} onTelecharger={telecharger} />

      <div className="etude-secondaires">
        <button type="button" className="lien" onClick={exporter}>{tk('etude.exporter')}</button>
        <button type="button" className="lien" onClick={() => changer(etudeVide(etude.size))} disabled={!pierresPosees(etude) && !etude.variante.length}>{tk('etude.vider')}</button>
      </div>
      <p className="muted small" role="status">{export_ ? tk('etude.exporte') : ''}</p>
      <p className="muted small">{fr(tk('etude.komi'))}</p>

      <div className="dock etude-dock">
        <button type="button" className="cta" onClick={() => { void analyser(); }} disabled={analyse?.etat === 'attente' || (analyse?.etat === 'sans-katago' && analyse.telechargement)}>
          {analyse?.etat === 'attente' ? tk('etude.analyse') : tk('etude.analyser')}
        </button>
      </div>
    </div>
  );
}

/**
 * Goban toujours entier au-dessus de l'action principale (« Analyser », fixe en bas), sans défiler : sa largeur est
 * bornée par la place entre son bord haut et le haut du bouton. Les lignes d'outils peuvent passer sur deux rangées
 * (police de repli, zoom, anglais, « Revenir » qui apparaît) : le goban rétrécit d'autant, rien ne passe dessous.
 * Recalculé quand la page change de taille ou qu'une ligne au-dessus change de hauteur.
 */
function useGobanEntier(racine: RefObject<HTMLDivElement | null>, cadre: RefObject<HTMLDivElement | null>): number | null {
  const [max, setMax] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = racine.current, plateau = cadre.current;
    if (!el || !plateau) return;
    const mesurer = () => {
      const cta = el.querySelector<HTMLElement>('.etude-dock .cta');
      if (!cta) return;
      // Positions de la page tout en haut : le bouton est fixe, le goban suit le défilement.
      const haut = plateau.getBoundingClientRect().top + window.scrollY;
      const place = Math.floor(cta.getBoundingClientRect().top - haut - 4);
      setMax(m => (place > 160 && place !== m ? place : m));
    };
    mesurer();
    const obs = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(mesurer) : null;
    for (const enfant of Array.from(el.children)) if (enfant !== plateau && !enfant.classList.contains('etude-dock')) obs?.observe(enfant);
    window.addEventListener('resize', mesurer);
    void document.fonts?.ready.then(mesurer);
    return () => { obs?.disconnect(); window.removeEventListener('resize', mesurer); };
  }, [racine, cadre]);
  return max;
}

/** « 62 » (chances de gain en %), ou l'avance « +3 » si KataGo ne les donne pas. */
function texteCandidat(c: { winrate: number | null; lead: number }): string {
  if (c.winrate != null) return String(Math.round(c.winrate * 100));
  const v = Math.round(c.lead);
  return v > 0 ? `+${v}` : String(v);
}

function Resultat({ analyse, resultat, camp, taille, onTelecharger }: {
  analyse: Analyse | null; resultat: Extract<Analyse, { etat: 'pret' }> | null; camp: string; taille: number; onTelecharger: () => void;
}) {
  if (!analyse || analyse.etat === 'attente') return null;
  if (analyse.etat === 'sans-katago') {
    return (
      <div className="etude-sans-katago" role="status" data-testid="etude-sans-katago">
        <p>{fr(tk(analyse.raison ? `etude.sansKataGo.${analyse.raison}` : 'etude.sansKataGo'))}</p>
        {analyse.raison !== 'appareil' && (
          <button type="button" className="btn" onClick={onTelecharger} disabled={analyse.telechargement}>
            {analyse.telechargement ? tk('etude.telechargement') : tk('etude.telecharger')}
          </button>
        )}
      </div>
    );
  }
  if (analyse.etat === 'erreur') return <p className="etude-refus small" role="alert">{fr(tk('etude.sansKataGo.delai'))}</p>;
  // Résultat d'une autre position (la position a changé depuis) : rien, l'action principale relance.
  if (!resultat) return null;
  const v = Math.abs(resultat.lead);
  const mene = v < 0.5 ? tk('etude.resultat.egal') : tk('etude.resultat.mene', { camp: tk(resultat.lead > 0 ? 'etude.trait.noir' : 'etude.trait.blanc'), v: nombreClub(v) });
  return (
    <div className="etude-resultat" role="status" data-testid="etude-resultat">
      <p><b>{fr(mene)}</b></p>
      {resultat.coups.length ? (
        <>
          <p className="small">{fr(tk('etude.resultat.coups', { camp }))}</p>
          <ol>
            {resultat.coups.map(c => (
              <li key={c.move}>{c.winrate != null
                ? fr(tk('etude.candidat', { point: toLabel(c.move, taille), p: Math.round(c.winrate * 100) }))
                : `${toLabel(c.move, taille)} : ${texteCandidat(c)}`}</li>
            ))}
          </ol>
        </>
      ) : <p className="small">{fr(tk(resultat.passe ? 'etude.resultat.passe' : 'etude.resultat.aucun'))}</p>}
    </div>
  );
}

export default Etude;
