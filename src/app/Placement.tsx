// « Je sais déjà jouer » (issue #283) : trois problèmes de placement, puis le niveau de départ en kyu.
// Un seul essai par problème, sans indice ni XP : c'est une mesure, pas un exercice noté. On peut passer à tout moment.
// Logique (choix adaptatif, cote, kyu, adversaire) : placement.ts.
import { useMemo, useRef, useState } from 'react';
import type { Puzzle } from '../data/puzzles';
import { checkAnswer, startOf } from '../data/puzzles';
import { Board } from '../ui/Board';
import { ParoleMochi, Verdict } from '../ui/Lecteur';
import { Sceau } from '../ui/Sceau';
import { Portrait, PortraitMochi } from '../ui/Portrait';
import { SceauLecon } from '../ui/SceauLecon';
import { LESSONS } from '../content/lessons';
import { fr } from '../ui/typo';
import { playFail, playIllegal, playStone, playSuccess } from '../ui/sound';
import { hapticFail, hapticIllegal, hapticStone, hapticSuccess } from '../ui/haptics';
import { t } from '../content/i18n';
import type { Opponent } from '../engine';
import { KYU_ANCRE, NB_PROBLEMES, adversaireConseille, bilanPlacement, choisirPlacement, kyuDuRang, type Bilan, type Essai } from './placement';
import '../ui/placement.css';

type Fin = { bilan: Bilan; adversaire: Opponent; essais: Essai[] };

interface Props {
  problemes: readonly Puzzle[];
  adversaires: readonly Opponent[];
  confirmTouch: boolean;
  /** Titre du chapitre de leçons conseillé, selon le kyu (null : tout raté). */
  chapitre: (kyu: number | null) => string;
  /** Les 3 problèmes sont joués : le résultat est à garder (appelé une fois). */
  onTermine: (fin: Fin) => void;
  /** Passé avant la fin ; `etape` : problèmes déjà joués. */
  onPasser: (etape: number) => void;
  onJouer: (id: Opponent['id']) => void;
  onLecons: (kyu: number | null) => void;
}

export function Placement(p: Props) {
  const [essais, setEssais] = useState<Essai[]>([]);
  const [fin, setFin] = useState<Fin | null>(null);
  const pz = useMemo(() => (essais.length < NB_PROBLEMES ? choisirPlacement(p.problemes, essais) : undefined), [p.problemes, essais]);

  if (fin) return <Resultat fin={fin} chapitre={p.chapitre(fin.bilan.kyu)} onJouer={() => p.onJouer(fin.adversaire.id)} onLecons={() => p.onLecons(fin.bilan.kyu)} />;
  if (!pz) return null;

  const suivant = (e: Essai) => {
    const tous = [...essais, e];
    setEssais(tous);
    window.scrollTo({ top: 0 });
    if (tous.length < NB_PROBLEMES) return;
    const bilan = bilanPlacement(tous);
    const f = { bilan, adversaire: bilan.kyu === null ? p.adversaires[0] : adversaireConseille(p.adversaires, bilan.kyu), essais: tous };
    setFin(f);
    p.onTermine(f);
  };

  return (
    <ProblemePlacement key={pz.id} puzzle={pz} rang={essais.length + 1} confirmTouch={p.confirmTouch}
      dernier={essais.length + 1 === NB_PROBLEMES} onPasser={() => p.onPasser(essais.length)} onSuivant={suivant} />
  );
}

function ProblemePlacement({ puzzle, rang, confirmTouch, dernier, onPasser, onSuivant }: {
  puzzle: Puzzle; rang: number; confirmTouch: boolean; dernier: boolean; onPasser: () => void; onSuivant: (e: Essai) => void;
}) {
  const start = useMemo(() => startOf(puzzle), [puzzle]);
  const [board, setBoard] = useState(start.pos.board);
  const [coup, setCoup] = useState<{ p: number; ok: boolean } | null>(null);
  const [shake, setShake] = useState<{ p: number; n: number } | null>(null);
  const n = useRef(0);

  function onPlay(pt: number) {
    if (coup) return;
    const r = checkAnswer(puzzle, pt);
    if (r.kind === 'illegal') {
      // Un coup interdit n'est pas un essai : on le dit, et le plateau reste jouable.
      playIllegal(); hapticIllegal(); setShake({ p: pt, n: ++n.current });
      return;
    }
    const ok = r.kind === 'ok';
    playStone(pt, puzzle.size); hapticStone();
    if (ok) { playSuccess(); hapticSuccess(); } else { playFail(); hapticFail(); }
    setBoard(r.after.board);
    setCoup({ p: pt, ok });
  }

  return (
    <div className="lecteur placement" data-probleme={puzzle.id} data-rang={rang}>
      <div className="lecteur-tete placement-tete">
        <div className="lecteur-nom">
          <small className="placement-etape">
            {t('placement.etape', { n: rang, total: NB_PROBLEMES })}
            {/* Trois repères : où l'on en est, d'un coup d'œil (le texte dit déjà le compte). */}
            <span className="placement-reperes" aria-hidden="true">
              {Array.from({ length: NB_PROBLEMES }, (_, i) => <i key={i} className={i < rang ? 'fait' : undefined} />)}
            </span>
          </small>
          <h2>{puzzle.title}</h2>
        </div>
        <button type="button" className="lien placement-passer" aria-label={t('placement.passerAria')} onClick={onPasser}>{t('placement.passer')}</button>
      </div>
      <Board size={puzzle.size} board={board} toPlay={puzzle.toPlay} interactive={!coup} confirmTouch={confirmTouch} onPlay={onPlay} shake={shake}
        marks={{ targets: start.marked, ok: coup?.ok ? coup.p : undefined, last: coup && !coup.ok ? coup.p : undefined }} />
      {/* Audit du 02/10 (n° 1) : la consigne sous le plateau, comme dans les problèmes et les leçons. */}
      <ParoleMochi humeur={coup?.ok ? 'content' : 'neutre'}>
        {rang === 1 && <>{fr(t('placement.intro'))}<br /></>}
        {fr(`${puzzle.prompt} ${t(puzzle.toPlay === 1 ? 'pb.tuJoues.1' : 'pb.tuJoues.2')}`)}
      </ParoleMochi>
      {coup && (
        <Verdict ton={coup.ok ? 'juste' : 'neutre'} cle={puzzle.id}
          actions={<button type="button" className="cta" onClick={() => onSuivant({ id: puzzle.id, difficulte: puzzle.difficulty, ok: coup.ok })}>
            {t(dernier ? 'placement.voirNiveau' : 'placement.suivant')}
          </button>}>
          <p>{fr(t(coup.ok ? 'placement.juste' : 'placement.rate'))}</p>
        </Verdict>
      )}
    </div>
  );
}

/**
 * Échelle de kyu, de 25 (débutant) à 1 : ta position et celle de l'adversaire conseillé. Elle montre ce que le
 * texte explique (« plus le nombre est petit, plus on est fort ») : la force monte vers la droite.
 */
function EchelleKyu({ kyu, adversaire }: { kyu: number; adversaire: Opponent }) {
  const pos = (k: number) => Math.round(((KYU_ANCRE - Math.min(KYU_ANCRE, Math.max(1, k))) / (KYU_ANCRE - 1)) * 100);
  const toi = pos(kyu), adv = pos(kyuDuRang(adversaire.rang) || 1);
  return (
    <div className="placement-echelle" aria-hidden="true" data-testid="echelle-kyu">
      <div className="placement-piste">
        <span className="placement-point adv" style={{ left: `${adv}%` }}><Sceau id={adversaire.id} taille={22} /></span>
        <span className="placement-point toi" style={{ left: `${toi}%` }}><b>{t('placement.toi')}</b></span>
      </div>
      <div className="placement-bornes"><span>{t('placement.kyuDebutant')}</span><span>{t('placement.kyuFort')}</span></div>
    </div>
  );
}

function Resultat({ fin, chapitre, onJouer, onLecons }: { fin: Fin; chapitre: string; onJouer: () => void; onLecons: () => void }) {
  const { bilan, adversaire } = fin;
  if (bilan.kyu === null) {
    // Tout raté : pas de niveau annoncé, pas de reproche. La leçon 1, puis la partie.
    return (
      <section className="placement-fin" aria-labelledby="placement-titre" data-testid="placement-fin">
        <PortraitMochi humeur="content" taille={88} decoratif className="placement-mochi" />
        <h2 id="placement-titre">{t('placement.basesTitre')}</h2>
        <p className="placement-phrase">{fr(t('placement.basesTexte'))}</p>
        {/* Audit du 02/10 (n° 2) : ce qui attend, plutôt qu'un écran aux deux tiers vide. Trois sceaux, trois titres. */}
        <div className="placement-programme">
          <p id="placement-programme-titre">{t('placement.programme')}</p>
          <ol aria-labelledby="placement-programme-titre">
            {LESSONS.slice(0, 3).map(l => <li key={l.id}><SceauLecon id={l.id} taille={32} /><span>{fr(l.title)}</span></li>)}
          </ol>
        </div>
        <button type="button" className="cta" onClick={onLecons}>{t('placement.lecon1')}</button>
      </section>
    );
  }
  return (
    <section className="placement-fin" aria-labelledby="placement-titre" data-testid="placement-fin" data-kyu={bilan.kyu}>
      <p className="placement-surtitre">{t('placement.titre')}</p>
      <h2 id="placement-titre" className="placement-kyu">{fr(t('placement.kyu', { kyu: bilan.kyu }))}</h2>
      <p className="placement-explique">{fr(t('placement.kyuExplique'))}</p>
      <EchelleKyu kyu={bilan.kyu} adversaire={adversaire} />
      <div className="placement-adversaire">
        <Portrait id={adversaire.id} taille={56} decoratif signature={false} />
        <p>{fr(t('placement.adversaire', { nom: adversaire.nom, rang: adversaire.rang }))}</p>
      </div>
      <button type="button" className="cta cta-sceau" onClick={onJouer}>
        <Sceau id={adversaire.id} taille={30} />{t('placement.jouerContre', { nom: adversaire.nom })}
      </button>
      <button type="button" className="lien placement-lecons" onClick={onLecons}>{fr(t('placement.chapitre', { titre: chapitre }))}</button>
    </section>
  );
}
