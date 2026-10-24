// « Ta première partie » (#715) : la mini-partie 5 × 5 contre Pomme qui suit les règles. Le premier qui capture 3 pierres
// gagne. Le go qu'on vient d'apprendre se joue tout de suite, et on gagne : Pomme a laissé des pierres en atari (Mochi le
// dit), elle joue au hasard, et le « coup de pouce » de Mochi montre un coup (src/content/miniPartie.ts, prouvé par
// miniPartie.test.ts : suivre l'aide gagne contre toutes les réponses de Pomme).
//
// Même grammaire que le lecteur de leçon (Lecon.tsx) : la barre (quitter, les trois pierres à prendre), le plateau, la
// pastille des pierres prises par Pomme (seulement quand il y en a), Mochi qui parle, puis une seule action quand il en
// faut une. Jamais d'attente sans retour : la pierre de Pomme arrive après une courte pause, Mochi dit qu'elle réfléchit.
// Récompenses sobres : première capture (la pierre tombe, Mochi content, un point s'allume), victoire (fête de la fin
// d'introduction, XP et série une seule fois par appareil). Aucune perte : la défaite se rejoue ou se passe.
//
// Chargé avec l'introduction (src/app/ecrans.ts) : rien dans le JS initial.
import { useEffect, useRef, useState } from 'react';
import { MINI_AIDE_APRES, MINI_CAPTURES, MINI_POMME_MS, MINI_TAILLE, aideMini, departMini, pommeJoue } from '../content/miniPartie';
import { Board, type BoardMarks } from '../ui/Board';
import { PortraitMochi, type HumeurMochi } from '../ui/Portrait';
import { Marque, Retour } from '../ui/Lecteur';
import { useTitreFocus } from '../ui/titreFocus';
import { fr } from '../ui/typo';
import { t } from '../content/i18n/secondaires';
import { play, type Position } from '../go/rules';
import { prefersReducedMotion, readLocal, writeLocal } from './hooks';
import { etatsPoints } from './lecon';
import { gagnerXp } from './xp';
import { validerDefi } from './defiAppareil';
import { SERIE_KEY, numeroDuJour, type Serie } from './goDuJour';
import { avancementDuJour } from './jalonsSerie';
import { EVENTS, track } from '../data/analytics';
import { playCapture, playFail, playStone, playSuccess } from '../ui/sound';
import { hapticIllegal, hapticStone, hapticSuccess } from '../ui/haptics';
import '../ui/lecon.css';
import '../ui/intro-regles.css';

/** Sur l'appareil : la première victoire a déjà payé son XP et allumé la série (une seule fois). */
export const MINI_KEY = 'go.mini-partie.v1';

export interface ResultatMini {
  gagnee: boolean;
  aides: number;
  coups: number;
  /** Série du jour allumée par cette victoire (première victoire de l'appareil seulement), sinon `null`. */
  serie: ReturnType<typeof avancementDuJour>;
}

interface Props {
  /** Nom de l'adversaire (Pomme). */
  nom: string;
  /** 0 : la première mini-partie ; 1 et plus : « Encore une mini-partie » ou « Réessayer ». */
  rang: number;
  confirmTouch: boolean;
  parcours: string;
  depuis: string;
  /** La mini-partie est finie (victoire) ou passée (après une défaite) : l'appelant montre la fin de l'introduction. */
  onFin: (r: ResultatMini) => void;
  /** « Réessayer » après une défaite de Pomme : l'appelant relance une mini-partie. */
  onReessayer: () => void;
  onQuitter: () => void;
}

type Phase = 'noir' | 'pomme' | 'perdue';
type Parole = { texte: string; ton: 'neutre' | 'juste' | 'revoir'; n: number };

export function MiniPartie({ nom, rang, confirmTouch, parcours, depuis, onFin, onReessayer, onQuitter }: Props) {
  const [pos, setPos] = useState<Position>(() => departMini(rang));
  const [dernier, setDernier] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('noir');
  const [parole, setParole] = useState<Parole>(() => ({ texte: t('mini.debut', { nom }), ton: 'neutre', n: 0 }));
  const [aide, setAide] = useState<{ p: number } | null>(null);
  const [shake, setShake] = useState<{ p: number; n: number } | null>(null);
  /** Dernier coup refusé (suicide, ko) : le point est barré jusqu'au coup suivant. */
  const [refus, setRefus] = useState<number | null>(null);
  const [reduit] = useState(prefersReducedMotion);
  const stats = useRef({ aides: 0, coups: 0, sansCapture: 0, finie: false });
  const titre = useTitreFocus();

  useEffect(() => {
    track(EVENTS.miniPartieCommencee, { rang, parcours, depuis });
    const st = stats.current;
    return () => { if (!st.finie) track(EVENTS.miniPartieFinie, { gagnee: false, abandon: true, aides: st.aides, coups: st.coups, rang }); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const dire = (texte: string, ton: Parole['ton'] = 'neutre') => setParole(p => ({ texte, ton, n: p.n + 1 }));

  function montrerAide(auto: boolean, position: Position) {
    const a = aideMini(position);
    if (!a) return;
    stats.current.aides++;
    setAide({ p: a.p });
    dire(t(`mini.aide.${a.type}` as 'mini.aide.capture'));
    if (!auto) hapticStone();
  }

  function onPlay(p: number) {
    if (phase !== 'noir') return;
    const r = play(pos, p);
    if (typeof r === 'string') {
      if (r === 'suicide' || r === 'ko') { playFail(); hapticIllegal(); setShake(s => ({ p, n: (s?.n ?? 0) + 1 })); setRefus(p); dire(t(`mini.refus.${r}`), 'revoir'); }
      return;
    }
    playStone(p, MINI_TAILLE); hapticStone();
    stats.current.coups++;
    setAide(null); setRefus(null);
    setPos(r); setDernier(p);
    const gain = r.captures[1] - pos.captures[1], total = r.captures[1];
    if (gain > 0) {
      stats.current.sansCapture = 0;
      playCapture(gain);
      if (total < MINI_CAPTURES) {
        playSuccess(); hapticSuccess();
        track(EVENTS.miniPartieCapture, { n: total, coups: stats.current.coups, rang });
        dire(t(total === 1 ? 'mini.capture1' : gain > 1 ? 'mini.captureDouble' : 'mini.capture2'), 'juste');
      }
    } else { stats.current.sansCapture++; dire(t('mini.reflechit', { nom })); }
    if (total >= MINI_CAPTURES) { gagner(); return; }
    setPhase('pomme');
  }

  // La réponse de Pomme : après une courte pause (presque aucune en mouvements réduits), jamais sans retour.
  useEffect(() => {
    if (phase !== 'pomme') return;
    const m = window.setTimeout(() => {
      const q = pommeJoue(pos);
      const r = play(pos, q) as Position;
      const prises = r.captures[2] - pos.captures[2];
      setPos(r); setDernier(q);
      if (q >= 0) playStone(q, MINI_TAILLE, true);
      if (prises > 0) playCapture(prises);
      if (r.captures[2] >= MINI_CAPTURES) {
        stats.current.finie = true;
        track(EVENTS.miniPartieFinie, { gagnee: false, defaite: true, aides: stats.current.aides, coups: stats.current.coups, rang });
        setPhase('perdue'); dire(t('mini.perdue', { nom })); return;
      }
      setPhase('noir');
      if (prises > 0) dire(t('mini.prise', { nom }), 'revoir');
      else if (stats.current.sansCapture >= MINI_AIDE_APRES) montrerAide(true, r);
      else if (stats.current.sansCapture > 0) dire(t('mini.encore'));
    }, reduit ? 120 : MINI_POMME_MS);
    return () => window.clearTimeout(m);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  function gagner() {
    stats.current.finie = true;
    const deja = readLocal<{ gagnee?: boolean } | null>(MINI_KEY, null)?.gagnee === true;
    let serie: ResultatMini['serie'] = null;
    if (!deja) {
      writeLocal(MINI_KEY, { gagnee: true });
      // Comme une leçon terminée (#710) : XP une seule fois par appareil, et le défi du jour allume la série.
      gagnerXp('lecon');
      const avant = readLocal<Serie | null>(SERIE_KEY, null);
      serie = avancementDuJour(avant, validerDefi('lecon').serie, numeroDuJour(new Date()));
    }
    track(EVENTS.miniPartieFinie, { gagnee: true, aides: stats.current.aides, coups: stats.current.coups, premiere: !deja, rang });
    onFin({ gagnee: true, aides: stats.current.aides, coups: stats.current.coups, serie });
  }

  function passer() {
    onFin({ gagnee: false, aides: stats.current.aides, coups: stats.current.coups, serie: null });
  }

  const prises = pos.captures[1];
  const marks: BoardMarks = { last: dernier, conseil: aide ? [aide.p] : undefined, mistake: refus ?? undefined };
  const humeur: HumeurMochi = parole.ton === 'revoir' ? 'pensif' : parole.ton === 'juste' ? 'content' : 'neutre';
  const classeBulle = ['bubble', 'mochi-bulle', parole.ton !== 'neutre' && `verdict verdict-${parole.ton}`].filter(Boolean).join(' ');

  return (
    <div className="lecteur lecteur-lecon mini-partie" data-moment={parole.ton === 'revoir' ? 'revoir' : parole.ton === 'juste' ? 'juste' : 'consigne'} data-phase={phase} data-captures={prises}>
      <div className="lecteur-tete">
        <Retour label={t('mini.quitter')} onClick={onQuitter} />
        <div className="lecteur-nom lecteur-nom-lecon">
          <div className="etapes" role="progressbar" aria-label={t('mini.progres')} aria-valuemin={0} aria-valuemax={MINI_CAPTURES} aria-valuenow={prises}
            aria-valuetext={t('mini.progresTexte', { n: prises, total: MINI_CAPTURES })}>
            {etatsPoints(MINI_CAPTURES, prises).map((e, i) => <span key={i} className={e === 'avenir' ? undefined : e} />)}
          </div>
          <h2 className="lecteur-titre" ref={titre} tabIndex={-1}><span>{fr(t('mini.titre'))}</span></h2>
        </div>
      </div>

      <div className="lecteur-plateau">
        <div className="plateau-cadre">
          <Board lieu="lecon" size={MINI_TAILLE} board={pos.board} interactive={phase === 'noir'} confirmTouch={confirmTouch} onPlay={onPlay}
            marks={marks} shake={shake} versCouvercles noms={{ 2: nom }} />
        </div>
      </div>

      {/* Les pierres prises par Pomme, seulement quand il y en a (un zéro ne dit rien). */}
      {pos.captures[2] > 0 && <p className="notion" data-testid="mini-prises-pomme" aria-label={`${t('mini.prisesPomme', { nom })} : ${pos.captures[2]} / ${MINI_CAPTURES}`}><span>{nom}</span><b>{pos.captures[2]} / {MINI_CAPTURES}</b></p>}

      <div className="mochi-zone">
        <PortraitMochi humeur={humeur} decoratif className="mochi-portrait" />
        <div key={parole.n} className={classeBulle} role="status" aria-live="polite">
          {parole.ton !== 'neutre' && <Marque juste={parole.ton === 'juste'} taille={26} />}
          <p>{fr(parole.texte)}</p>
        </div>
      </div>

      <div className="lecon-actions">
        {phase === 'perdue' ? (<>
          <button type="button" className="cta" data-action="reessayer" onClick={onReessayer}>{t('mini.reessayer')}</button>
          <button type="button" className="lien" data-action="passer" onClick={passer}>{t('mini.passer')}</button>
        </>) : phase === 'noir' && !aide ? (
          <button type="button" className="lien" data-action="pouce" onClick={() => montrerAide(false, pos)}>{t('mini.pouce')}</button>
        ) : null}
      </div>
    </div>
  );
}
