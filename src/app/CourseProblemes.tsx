// Course aux problèmes (issue #287) : consigne, course de 3 minutes (3 erreurs au plus), écran de fin.
// Logique pure dans ./course.ts ; ici l'affichage, le minuteur et le stockage du meilleur score.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { t } from '../content/i18n/secondaires';
import { checkAnswer, startOf, type Puzzle } from '../data/puzzles';
import { EVENTS, track } from '../data/analytics';
import { Board } from '../ui/Board';
import { Visee } from '../ui/Visee';
import { estSerre } from '../ui/plateauSerre';
import { Retour } from '../ui/Lecteur';
import { useTitreFocus } from '../ui/titreFocus';
import { Bubble } from '../ui/Mochi';
import { fr } from '../ui/typo';
import { playFail, playIllegal, playStone, playSuccess } from '../ui/sound';
import { hapticFail, hapticIllegal, hapticStone, hapticSuccess } from '../ui/haptics';
import { writeLocal } from './hooks';
import { crediterCourse, type Gain } from './xp';
import { PastilleXp } from '../ui/PastilleXp';
import { mouvementsReduits } from '../ui/defilement';
import {
  DUREE_COURSE, ERREURS_MAX, MEILLEUR_COURSE_KEY, apresCourse, commencer, dureeSecondes, formatTemps, lireMeilleurCourse,
  palierAnnonce, problemeEnCours, repondre, restant, texteCourse, tirerCourse, verifierTemps, type EtatCourse
} from './course';
import '../ui/course.css';
// #563 : consigne, course et résultats (hors du CSS initial).
import '../ui/course-ecran.css';

/** Temps pendant lequel la marque juste ou fausse reste sur le plateau avant le problème suivant. */
const DUREE_RETOUR_JUSTE = 450;
const DUREE_RETOUR_FAUX = 900;
/** Rafraîchissement du minuteur : 4 fois par seconde, pour que la seconde affichée change à l'heure. */
const TIC = 250;

type Phase = 'consigne' | 'course' | 'fin';

/** Annonce du temps restant pour le lecteur d'écran (multiple de 30 s). */
function annonceTemps(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return t('course.annonce.secondes');
  const min = Math.floor(s / 60);
  return s % 60 ? t('course.annonce.demi', { n: min }) : t('course.annonce.minutes', { n: min });
}

export function Course({ liste, cote, exclure, confirmTouch, onExit }: {
  liste: readonly Puzzle[];
  /** Cote du joueur (#284) : la course part un peu en dessous. Jamais affichée, jamais modifiée par la course. */
  cote: number;
  /** Problèmes hors course (le Go du jour). */
  exclure: readonly string[];
  confirmTouch: boolean;
  onExit: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('consigne');
  const [etat, setEtat] = useState<EtatCourse | null>(null);
  const [meilleur, setMeilleur] = useState(lireMeilleurCourse);
  const [nouveau, setNouveau] = useState(false);
  // #529 : XP de la course (la première course du jour avec au moins un problème juste), affichée sur l'écran de fin.
  const [xp, setXp] = useState<Gain | null>(null);
  // Numéro de course : remonte le plateau et remet les marques à zéro à chaque « Rejouer ».
  const [manche, setManche] = useState(0);

  const lancer = useCallback(() => {
    const ordre = tirerCourse(liste, cote, { exclure });
    setEtat(commencer(ordre, Date.now()));
    setNouveau(false);
    setXp(null);
    setManche(n => n + 1);
    setPhase('course');
    window.scrollTo({ top: 0 });
  }, [liste, cote, exclure]);

  // Fin de course : meilleur score gardé sur l'appareil et mesure, une seule fois par course.
  const finie = useRef(0);
  const terminer = useCallback((e: EtatCourse) => {
    if (finie.current === manche) return;
    finie.current = manche;
    const avant = lireMeilleurCourse();
    const r = apresCourse(avant, e.score);
    if (r.nouveau) writeLocal(MEILLEUR_COURSE_KEY, r.meilleur);
    setMeilleur(r.meilleur);
    setNouveau(r.nouveau);
    track(EVENTS.courseTerminee, { score: e.score, erreurs: e.erreurs, duree: dureeSecondes(e, Date.now()), raison: e.fin?.raison ?? 'temps' });
    setXp(crediterCourse(e.score));
    setPhase('fin');
    window.scrollTo({ top: 0 });
  }, [manche]);

  if (phase === 'consigne' || !etat) {
    return <Consigne meilleur={meilleur} onCommencer={lancer} onExit={onExit} />;
  }
  if (phase === 'fin') {
    return <Fin etat={etat} meilleur={meilleur} nouveau={nouveau} xp={xp} onRejouer={lancer} onExit={onExit} />;
  }
  return <EnCourse key={manche} etat={etat} setEtat={setEtat} liste={liste} confirmTouch={confirmTouch} onFin={terminer} onExit={onExit} />;
}

/**
 * #627 (V12) : les trois règles de la course, chacune une icône et quelques mots. La durée est dans le titre et sur le
 * chronomètre ; « de plus en plus durs » décrivait la course sans en être une règle : retiré. Icônes au trait, décoratives.
 */
const REGLES = [
  // Le plus de problèmes possible : une pile de problèmes.
  ['course.regles.1', <><rect x="3.5" y="8.5" width="12" height="12" rx="2" /><path d="M8.5 4.5h10a2 2 0 0 1 2 2v10" /><path d="M9.5 11.5v6M6.5 14.5h6" /></>],
  // Un essai, sans indice : une cible.
  ['course.regles.2', <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r=".8" fill="currentColor" /></>],
  // La 3e erreur arrête la course : les trois pastilles d'erreur du bandeau, barrées.
  ['course.regles.3', <><circle cx="4.5" cy="12" r="3.4" /><circle cx="12" cy="12" r="3.4" /><circle cx="19.5" cy="12" r="3.4" />
    <path d="M3.2 10.7l2.6 2.6M5.8 10.7l-2.6 2.6M10.7 10.7l2.6 2.6M13.3 10.7l-2.6 2.6M18.2 10.7l2.6 2.6M20.8 10.7l-2.6 2.6" /></>],
] as const;

/** Consigne : 3 règles courtes en icônes, le meilleur score s'il existe, et une seule action, « C'est parti ». */
function Consigne({ meilleur, onCommencer, onExit }: { meilleur: number; onCommencer: () => void; onExit: () => void }) {
  const titre = useTitreFocus();
  return (
    <div className="course course-consigne">
      <div className="lecteur-tete">
        <Retour label={t('pb.retour')} onClick={onExit} />
        <div className="lecteur-nom"><h2 ref={titre} tabIndex={-1}>{fr(t('course.carte.titre'))}</h2></div>
      </div>
      <ChronoCourse taille={96} />
      <ul className="course-regles">
        {REGLES.map(([k, icone]) => (
          <li key={k} data-regle={k}>
            <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false">{icone}</svg>
            {fr(t(k))}
          </li>
        ))}
      </ul>
      {meilleur > 0 && <p className="course-meilleur">{fr(t('course.fin.meilleur', { meilleur }))}</p>}
      <button type="button" className="cta" onClick={onCommencer}>{t('course.commencer')}</button>
    </div>
  );
}

/** La course : minuteur, pastilles d'erreurs, score, et le plateau du problème en cours. */
function EnCourse({ etat, setEtat, liste, confirmTouch, onFin, onExit }: {
  etat: EtatCourse; setEtat: (e: EtatCourse) => void; liste: readonly Puzzle[]; confirmTouch: boolean;
  onFin: (e: EtatCourse) => void; onExit: () => void;
}) {
  const [maintenant, setMaintenant] = useState(() => Date.now());
  // Problème affiché : il reste le temps de la marque juste ou fausse, puis laisse place au suivant.
  const [affiche, setAffiche] = useState(() => problemeEnCours(etat));
  const [retour, setRetour] = useState<{ ok: boolean; p: number; n: number } | null>(null);
  const [shake, setShake] = useState<{ p: number; n: number } | null>(null);
  const [annonce, setAnnonce] = useState('');
  const [reponse, setReponse] = useState('');
  const etatRef = useRef(etat);
  etatRef.current = etat;
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Minuteur : horloge du navigateur, lue 4 fois par seconde. L'annonce ne part qu'aux multiples de 30 s.
  const dernier = useRef(restant(etat, Date.now()));
  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now();
      setMaintenant(now);
      const e = etatRef.current;
      const r = restant(e, now);
      const palier = palierAnnonce(dernier.current, r);
      if (palier !== null) setAnnonce(annonceTemps(palier));
      dernier.current = r;
      const v = verifierTemps(e, now);
      if (v !== e) { setEtat(v); onFin(v); }
    }, TIC);
    return () => window.clearInterval(id);
  }, [setEtat, onFin]);

  const pz = useMemo(() => liste.find(p => p.id === affiche), [liste, affiche]);
  const depart = useMemo(() => (pz ? startOf(pz) : null), [pz]);
  // Position après le coup joué, le temps de la marque ; sinon la position de départ du problème affiché.
  const [pose, setPose] = useState<{ id: string; board: Int8Array } | null>(null);
  const board = pz && pose?.id === pz.id ? pose.board : depart?.pos.board ?? null;

  function onPlay(p: number) {
    if (!pz || retour || etat.fin) return;
    const r = checkAnswer(pz, p);
    // Un coup interdit (point occupé, ko, suicide) n'est pas une erreur : le plateau tremble, on rejoue.
    if (r.kind === 'illegal') { playIllegal(); hapticIllegal(); setShake({ p, n: (shake?.n ?? 0) + 1 }); return; }
    const ok = r.kind === 'ok';
    playStone(p, pz.size); hapticStone();
    if (ok) { playSuccess(); hapticSuccess(); } else { playFail(); hapticFail(); }
    const now = Date.now();
    const suite = repondre(etat, ok, now);
    setEtat(suite);
    setPose({ id: pz.id, board: r.after.board });
    setRetour({ ok, p, n: suite.rang });
    setReponse(ok ? t('course.annonce.juste', { n: suite.score }) : t('course.annonce.faux', { n: suite.erreurs }));
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setRetour(null);
      if (suite.fin) { onFin(suite); return; }
      setAffiche(problemeEnCours(suite));
    }, ok ? DUREE_RETOUR_JUSTE : DUREE_RETOUR_FAUX);
  }

  const reste = restant(etat, maintenant);
  const urgent = reste <= 10_000;
  const titre = useTitreFocus();
  return (
    <div className="course course-en-cours" data-probleme={affiche}>
      <div className="lecteur-tete">
        <Retour label={t('course.quitter')} onClick={onExit} />
        <div className="lecteur-nom"><h2 ref={titre} tabIndex={-1}>{t('course.titre')}</h2></div>
      </div>
      <div className="course-bandeau">
        <div className={`course-chrono${urgent ? ' urgent' : ''}`} role="timer" aria-live="off" aria-label={t('course.temps')}>
          <Chrono taille={22} />
          <span className="course-temps" data-temps={formatTemps(reste)}>{formatTemps(reste)}</span>
        </div>
        <Pastilles erreurs={etat.erreurs} />
        <div className="course-score">
          <span className="course-score-legende">{t('course.score')} </span>
          <span className="course-score-chiffre" key={etat.score} data-score={etat.score}>{etat.score}</span>
        </div>
      </div>
      <div className="course-barre" aria-hidden="true"><span style={{ transform: `scaleX(${reste / DUREE_COURSE})` }} /></div>
      {/* Lecteur d'écran : le temps restant toutes les 30 s, et le résultat de chaque réponse. Jamais chaque seconde. */}
      <p className="sr-only" role="status" aria-live="polite" data-annonce-temps="">{annonce}</p>
      <p className="sr-only" aria-live="polite">{reponse}</p>
      {pz && board && depart && (
        <>
          <Bubble voix="coach">{fr(`${pz.prompt} ${t(pz.toPlay === 1 ? 'pb.tuJoues.1' : 'pb.tuJoues.2')}`)}</Bubble>
          <div className={`course-plateau${retour ? (retour.ok ? ' juste' : ' faux') : ''}`}>
            <Board lieu="probleme" key={pz.id} size={pz.size} board={board} toPlay={pz.toPlay} interactive={!retour && !etat.fin}
              confirmTouch={confirmTouch || estSerre(pz.size)} surFantome={estSerre(pz.size) ? q => <Visee p={q} size={pz.size} /> : undefined} onPlay={onPlay} shake={shake}
              marks={{ targets: depart.marked, last: retour?.p ?? null, ok: retour?.ok ? retour.p : undefined, mistake: retour && !retour.ok ? retour.p : undefined }} />
          </div>
        </>
      )}
    </div>
  );
}

/** Trois pastilles : vides au départ, pleines (hanko, avec une croix) à chaque erreur. */
function Pastilles({ erreurs }: { erreurs: number }) {
  return (
    <div className="course-pastilles" role="img" aria-label={t('course.erreursAria', { n: erreurs })} data-erreurs={erreurs}>
      {Array.from({ length: ERREURS_MAX }, (_, i) => (
        <span key={i} className={i < erreurs ? 'pleine' : undefined}>
          {i < erreurs && <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M5 5l6 6M11 5 5 11" /></svg>}
        </span>
      ))}
    </div>
  );
}

/** Pictogramme de chronomètre, en trait (bandeau de la course). */
function Chrono({ taille }: { taille: number }) {
  return (
    <svg className="course-picto" viewBox="0 0 24 24" width={taille} height={taille} aria-hidden="true" focusable="false">
      <circle cx="12" cy="13.5" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 9.5v4.2l2.6 1.6M9.5 2.5h5M12 2.5v3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Chronomètre dessiné (#103) : cadran en papier, graduations, les trois minutes de la course en arc hanko,
 * aiguille sur la troisième, poussoir en haut. Sert à la carte d'entrée et à la consigne. Décoratif.
 */
export function ChronoCourse({ taille }: { taille: number }) {
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI) / 6, grand = i % 3 === 0, r1 = grand ? 15.5 : 17.5, r2 = 20;
    return <line key={i} x1={24 + r1 * Math.sin(a)} y1={26 - r1 * Math.cos(a)} x2={24 + r2 * Math.sin(a)} y2={26 - r2 * Math.cos(a)} strokeWidth={grand ? 2 : 1.3} />;
  });
  return (
    <svg className="chrono-course" viewBox="0 0 48 48" width={taille} height={taille} aria-hidden="true" focusable="false">
      <path className="ch-poussoir" d="M20 2.5h8M24 2.5v4.5M36.5 7.5l3 3" />
      <circle className="ch-cadran" cx="24" cy="26" r="21" />
      <circle className="ch-anneau" cx="24" cy="26" r="17.5" />
      <g className="ch-ticks">{ticks}</g>
      {/* Trois minutes : l'arc hanko de midi à trois heures, puis l'aiguille. */}
      <path className="ch-arc" d="M24 8.5A17.5 17.5 0 0 1 41.5 26" />
      <path className="ch-aiguille" d="M24 26V13.5" />
      <path className="ch-aiguille" d="M24 26L36 26" />
      <circle className="ch-axe" cx="24" cy="26" r="2.2" />
    </svg>
  );
}

/** Écran de fin : la raison, le score, le meilleur score ; « Rejouer » en action principale, « Partager » à côté. */
function Fin({ etat, meilleur, nouveau, xp, onRejouer, onExit }: {
  etat: EtatCourse; meilleur: number; nouveau: boolean; xp: Gain | null; onRejouer: () => void; onExit: () => void;
}) {
  const raison = etat.fin?.raison ?? 'temps';
  const titre = useTitreFocus();
  return (
    <div className="course course-fin" data-raison={raison}>
      <div className="lecteur-tete">
        <Retour label={t('pb.retour')} onClick={onExit} />
        <div className="lecteur-nom"><h2 ref={titre} tabIndex={-1}>{fr(t(`course.fin.${raison}`))}</h2></div>
      </div>
      <div className="course-resultat">
        <span className="course-resultat-chiffre" data-score={etat.score}>{etat.score}</span>
        <span className="course-resultat-legende">{t('course.fin.legende', { n: etat.score })}</span>
        {nouveau
          ? <p className="course-nouveau" role="status">{fr(t('course.fin.nouveau'))}</p>
          : meilleur > 0 && <p className="course-meilleur" data-meilleur={meilleur}>{fr(t('course.fin.meilleur', { meilleur }))}</p>}
        {/* #529 : l'XP se lit à sa place (classe fin-xp : la pastille flottante ne la répète pas). */}
        <div className="fin-xp course-xp" role="status" aria-live="polite">{xp && <PastilleXp points={xp.points} bonus={xp.bonus} anime={!mouvementsReduits()} />}</div>
      </div>
      <button type="button" className="cta" onClick={onRejouer}>{t('course.rejouer')}</button>
      <PartagerCourse score={etat.score} meilleur={meilleur} />
    </div>
  );
}

/** « Partager » : Web Share API, sinon copie dans le presse-papiers. Texte sans spoiler (score, durée, meilleur). */
function PartagerCourse({ score, meilleur }: { score: number; meilleur: number }) {
  const [etat, setEtat] = useState<'' | 'copie' | 'erreur'>('');
  const p = texteCourse(score, meilleur);
  async function partager() {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ text: p.texte, url: p.url });
        track(EVENTS.coursePartagee, { score, meilleur, methode: 'partage' });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(p.complet);
      setEtat('copie');
      track(EVENTS.coursePartagee, { score, meilleur, methode: 'copie' });
    } catch {
      setEtat('erreur');
    }
  }
  useEffect(() => {
    if (etat !== 'copie') return;
    const id = window.setTimeout(() => setEtat(''), 2000);
    return () => window.clearTimeout(id);
  }, [etat]);
  const copie = etat === 'copie';
  return (
    <>
      <button type="button" className={`btn partager${copie ? ' partage-copie' : ''}`} onClick={partager}>
        {copie
          ? <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="M5 12.5 10 17l9-10" /></svg>
          : <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></svg>}
        {copie ? t('pb.copie') : t('pb.partager')}
      </button>
      <p className="sr-only" role="status" aria-live="polite">{copie ? t('pb.copieAnnonce') : ''}</p>
      {etat === 'erreur' && <p className="partage-etat" role="alert">{t('pb.copieImpossible')} <span className="partage-lien">{p.url}</span></p>}
    </>
  );
}
