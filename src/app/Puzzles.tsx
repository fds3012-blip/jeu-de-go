// Onglet Problèmes (issue #40, phase 6) : cote et série, problème du jour mis en scène, grille des problèmes de base.
import { BoutonAide } from '../ui/BoutonAide';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Db } from '../data/supabase';
import { ALL_PUZZLES } from '../content/puzzles';
import {
  checkAnswer, fetchPuzzleStats, fetchPuzzles, parsePuzzles, recordPuzzleAttempt, solutionFrames, startOf,
  type Puzzle, type PuzzleStats
} from '../data/puzzles';
import { Board } from '../ui/Board';
import { MiniGoban } from '../ui/MiniGoban';
import { estSerre, Visee } from '../ui/Visee';
import { centreVertical } from '../ui/cadrage';
import { C, M, viewBoxOf } from '../ui/boardArt';
import { ParoleMochi, Retour, Verdict } from '../ui/Lecteur';
import { Reflexion } from '../ui/Reflexion';
import { fr } from '../ui/typo';
import { playBadge, playFail, playIllegal, playStone, playSuccess } from '../ui/sound';
import { hapticBadge, hapticFail, hapticIllegal, hapticStone, hapticSuccess } from '../ui/haptics';
import { EVENTS, track } from '../data/analytics';
import { gagnerXp, sourceXpProbleme } from './xp';
import { aideSuivante, recompense, refutation, reponseVue, toucherApresErreur, type NiveauAide, type Refutation } from './aide';
import { prefersReducedMotion, readLocal, useOnline, writeLocal } from './hooks';
import { niveau, prochainAMesure } from './problemes';
import { aContinuer, aSuivre, ordrePaliers, palierEnCours, paliers, paliersVisibles, type Palier } from './paliers';
import { SceauLecon } from '../ui/SceauLecon';
import { aFeter, FETES_KEY } from './fetesPaliers';
import { MesErreurs } from '../ui/MesErreurs';
import { SerieDuJour } from '../ui/SerieDuJour';
import { jalonFranchi, type Jalon } from './jalonsSerie';
import { SERIE_KEY, numeroDuJour, problemeDuNumero, serieVivante, textePartage, type Serie } from './goDuJour';
import '../ui/apprendre.css';
import { Glacon, PierreGivree } from '../ui/Glacon';
import { lireReserveAppareil } from './gelAppareil';
import { inviterCompte, serieAffichee } from './serieLocale';
import { goDuJourFaitAppareil, validerDefi } from './defiAppareil';
import { RevisionDuJour } from '../ui/RevisionDuJour';
import { noterRediteAppareil, repriseDeLeconFaite, suivreEnRevisionAppareil } from './rediteAppareil';
// `t` désigne déjà un palier dans ce fichier : la traduction s'appelle `tr` (#167).
import { t as tr } from '../content/i18n';
import { useExercice } from '../ui/celebrations';
import { XpEnLigne } from '../ui/PastilleXp';
import { COTE_KEY, nettoyerCote, noter, ouvrir, requalifierEnAide, type EtatCote } from './coteJoueur';
import { ChronoCourse, Course } from './CourseProblemes';
import { lireMeilleurCourse } from './course';
import { Paysage } from '../ui/Paysage';

const LOCAL_PUZZLES = parsePuzzles(ALL_PUZZLES);
export const SOLVED_KEY = 'go.problemes.v1';
/** Problèmes « vus » (#197) : résolus après avoir vu la réponse. Ni XP, ni palier. */
export const VUS_KEY = 'go.problemes.vus.v1';

type Load = { status: 'loading' } | { status: 'ready'; source: 'base' | 'copie'; error?: string };

interface Props {
  db: Db | null; userId: string | undefined; sessionLoading: boolean; confirmTouch: boolean;
  /** Mène à l'onglet Profil pour se connecter. */
  onCompte?: () => void;
  /** Numéro demandé par un lien partagé `?go-du-jour=N` : ouvre directement le Go du jour (issue #75). */
  lien?: number | null;
  /** Prévient quand le Go du jour est ouvert : la fenêtre de consentement attend, comme pendant une partie. */
  onDuJour?: (ouvert: boolean) => void;
  /** Réglage « Célébrations » : la pierre givrée se pose avec un rebond quand un gel est gagné. */
  celebrer?: boolean;
  /** Change quand on touche l'onglet Problèmes déjà actif : retour à la liste (R4). */
  racine?: number;
  /** #285 : arrivé par un lien sans avoir jamais joué ; après le Go du jour, l'action unique mène à la leçon 1. */
  onApprendre?: () => void;
  /** #36 : ouvert depuis le rappel quotidien (notification touchée) : le Go du jour d'aujourd'hui s'ouvre directement. */
  depuisRappel?: boolean;
  /**
   * Essai sans compte (#343) : présent, seul le Go du jour (et ses liens partagés) est libre. Tout autre problème,
   * la course, la grille, la révision et « Tes erreurs à rejouer » appellent `essai`, qui ouvre « Crée ton compte ».
   */
  essai?: () => void;
}

/** Flamme de la série de jours, en or. */
function Flamme({ taille = 22 }: { taille?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={taille} height={taille} aria-hidden="true" focusable="false">
      <path d="M8.6 1.2c.4 2.3 3.9 3.9 3.9 7.9A4.5 4.5 0 0 1 8 13.8a4.5 4.5 0 0 1-4.5-4.6c0-2 1-3.2 2-4 0 1.4.6 2.4 1.5 2.7C6.6 5.6 7.4 3 8.6 1.2Z" fill="currentColor" />
    </svg>
  );
}

/** Difficulté : trois petites pierres, pleines selon le niveau, et le mot. */
function Difficulte({ d }: { d: number }) {
  const n = niveau(d);
  return (
    <span className="difficulte">
      <span className="crans" aria-hidden="true">{[1, 2, 3].map(i => <i key={i} className={i <= n.crans ? 'plein' : undefined} />)}</span>
      {tr(`pb.difficulte.${n.crans}`)}
    </span>
  );
}

/** Onglet Problèmes : problème du jour, problèmes de base, cote problèmes et série de jours. */
export function Puzzles({ db, userId, sessionLoading, confirmTouch, onCompte, lien = null, onDuJour, celebrer = true, racine = 0, onApprendre, essai, depuisRappel = false }: Props) {
  /** Ouvre un problème ; hors Go du jour pendant l'essai sans compte, c'est « Crée ton compte » qui s'ouvre (#343). */
  const ouvrirProbleme = (id: string) => { if (essai && id !== daily?.id) essai(); else setOpenId(id); };
  // Go du jour (issue #75) : le même pour tous, choisi dans la liste publique des problèmes de base, en heure de Paris.
  const [numero] = useState(() => numeroDuJour(new Date()));
  const daily = problemeDuNumero(LOCAL_PUZZLES, numero);
  const [serieDuJour, setSerieDuJour] = useState<Serie | null>(() => readLocal<Serie | null>(SERIE_KEY, null));
  // Série protégée (issue #76) : gels en réserve, et gel gagné à l'instant (micro-célébration).
  const [gels, setGels] = useState(() => lireReserveAppareil().gels);
  const [gelGagne, setGelGagne] = useState(false);
  // Jalon de série (3, 7, 30 jours) franchi à l'instant par le Go du jour (#214) : fêté dans la feuille de réussite.
  const [jalon, setJalon] = useState<Jalon | null>(null);
  const online = useOnline();
  const [list, setList] = useState<Puzzle[]>(LOCAL_PUZZLES);
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [stats, setStats] = useState<PuzzleStats | null>(null);
  const [statsError, setStatsError] = useState('');
  const [localSolved, setLocalSolved] = useState<Record<string, true>>(() => readLocal(SOLVED_KEY, {}));
  // Lien partagé : un numéro passé ouvre ce Go du jour-là (archive), comme sur Wordle ; un numéro à venir (ou 0)
  // n'est pas encore sorti : on ouvre celui d'aujourd'hui, et on le dit.
  const [archive, setArchive] = useState<number | null>(() => (lien !== null && lien >= 1 && lien < numero ? lien : null));
  const pzArchive = archive !== null ? problemeDuNumero(LOCAL_PUZZLES, archive) : undefined;
  const [openId, setOpenId] = useState<string | null>(() => (pzArchive ? pzArchive.id : (lien !== null || depuisRappel) && daily ? daily.id : null));
  const [defiChange] = useState(() => lien !== null && archive === null && lien !== numero);
  const [retry, setRetry] = useState(0);
  // Liste « Tous les problèmes » ouverte (#196) ; on y revient après un problème ouvert depuis la grille.
  const [tous, setTous] = useState(false);
  // Course aux problèmes (#287) : consigne, course et fin, à la place de la liste.
  const [course, setCourse] = useState(false);
  const [statsTick, setStatsTick] = useState(0);
  // Onglet actif touché (R4) : retour à la liste, sans remonter l'écran (le lien partagé rouvrirait le Go du jour).
  const racineVue = useRef(racine);
  useEffect(() => {
    if (racineVue.current === racine) return;
    racineVue.current = racine;
    setOpenId(null); setTous(false); setCourse(false);
  }, [racine]);

  // Problèmes : la base pour un joueur connecté (RLS), la copie locale sinon.
  useEffect(() => {
    if (sessionLoading) return;
    if (!db || !userId) { setList(LOCAL_PUZZLES); setLoad({ status: 'ready', source: 'copie' }); return; }
    if (!online) { setList(LOCAL_PUZZLES); setLoad({ status: 'ready', source: 'copie', error: 'offline' }); return; }
    let alive = true;
    setLoad({ status: 'loading' });
    fetchPuzzles(db).then(r => {
      if (!alive) return;
      if (r.ok && r.value.length) { setList(r.value); setLoad({ status: 'ready', source: 'base' }); }
      else { setList(LOCAL_PUZZLES); setLoad({ status: 'ready', source: 'copie', error: r.ok ? undefined : r.error }); }
    });
    return () => { alive = false; };
  }, [db, userId, sessionLoading, online, retry]);

  useEffect(() => {
    if (!db || !userId || !online) { setStats(null); return; }
    let alive = true;
    fetchPuzzleStats(db, userId).then(r => {
      if (!alive) return;
      if (r.ok) { setStats(r.value); setStatsError(''); } else setStatsError(r.error);
    });
    return () => { alive = false; };
  }, [db, userId, online, retry, statsTick]);

  const solved = useMemo(() => new Set([...Object.keys(localSolved), ...(stats?.solved ?? [])]), [localSolved, stats]);
  const markSolved = useCallback((id: string) => {
    setLocalSolved(prev => { const next = { ...prev, [id]: true as const }; writeLocal(SOLVED_KEY, next); return next; });
  }, []);
  // « Continuer » à ta mesure (#284) : cote du joueur sur l'appareil, jamais affichée (décision #137).
  const [cote, setCote] = useState<EtatCote>(() => nettoyerCote(readLocal<unknown>(COTE_KEY, null)));
  const majCote = useCallback((f: (c: EtatCote) => EtatCote) => {
    setCote(prev => { const next = f(prev); if (next !== prev) writeLocal(COTE_KEY, next); return next; });
  }, []);
  const [vus, setVus] = useState<Record<string, true>>(() => readLocal(VUS_KEY, {}));
  const markVu = useCallback((id: string) => {
    setVus(prev => { const next = { ...prev, [id]: true as const }; writeLocal(VUS_KEY, next); return next; });
  }, []);
  // Révision du jour (#251, M2) : les problèmes réussis et ceux vus avec la réponse ; ces derniers à part, pour le libellé.
  const vusSeuls = useMemo(() => new Set(Object.keys(vus).filter(id => !solved.has(id))), [vus, solved]);
  const aReviser = useMemo(() => new Set([...solved, ...vusSeuls]), [solved, vusSeuls]);

  const tiers = useMemo(() => paliers(list, solved), [list, solved]);
  // Palier complet : une micro-fête en or, une seule fois par palier (réglage Célébrations et mouvements réduits respectés).
  const [fetes, setFetes] = useState<string[]>([]);
  useEffect(() => {
    if (openId) return;
    const deja = readLocal<unknown>(FETES_KEY, []);
    const nouveaux = aFeter(tiers, deja);
    if (!nouveaux.length) return;
    writeLocal(FETES_KEY, [...(Array.isArray(deja) ? deja : []), ...nouveaux]);
    // Sceau de palier obtenu (#165) : « toc » du sceau et cloche, même avec les mouvements réduits (ce n'est pas un mouvement).
    if (celebrer) { playBadge(); hapticBadge(); }
    if (celebrer && !prefersReducedMotion()) setFetes(nouveaux);
  }, [tiers, openId, celebrer]);
  const ordre = useMemo(() => ordrePaliers(tiers), [tiers]);
  // #147 : « Problème suivant » propose toujours un problème ; le tirage change à chaque retour à la liste
  // et évite le dernier problème joué.
  const dernierRef = useRef<string | undefined>(undefined);
  if (openId) dernierRef.current = openId;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- nouveau tirage voulu à chaque changement de problème
  const tirage = useMemo(() => Math.random(), [openId]);
  // « Continuer » à ta mesure (#284) : ni le Go du jour ni la Révision du jour (réussis, vus) n'y entrent.
  const aMesure = (eviter: string | undefined) =>
    prochainAMesure(list, cote, { aReviser, goDuJour: daily?.id, jour: numero, eviter, alea: () => tirage });
  const open = list.find(p => p.id === openId) ?? (daily && openId === daily.id ? daily : pzArchive && openId === pzArchive.id ? pzArchive : undefined);
  const duJourOuvert = !!open && (open.id === daily?.id || archive !== null);
  // Un problème ouvert hors Go du jour devient la référence du prochain choix (jamais deux fois de suite, pas de saut).
  useEffect(() => {
    if (open && !duJourOuvert) majCote(c => ouvrir(c, open));
  }, [open, duJourOuvert, majCote]);
  useEffect(() => {
    onDuJour?.(duJourOuvert);
  }, [duJourOuvert, onDuJour]);
  useEffect(() => () => onDuJour?.(false), [onDuJour]);

  if (open) {
    // Go du jour d'un autre jour (lien partagé ancien) : ni série ni XP du jour ; ensuite, celui d'aujourd'hui.
    const enArchive = archive !== null && open.id === pzArchive?.id;
    // #284 : le suivant est choisi à ta mesure ; tout réussi, la série infinie de #147 prend le relais.
    const nextPz = enArchive && daily && !goDuJourFaitAppareil(numero) ? daily
      : aMesure(open.id) ?? aSuivre(tiers, open, solved);
    const estDuJour = !enArchive && open.id === daily?.id;
    // Seul le premier essai d'un problème jamais réussi ni vu compte pour la cote ; ni le Go du jour ni un lien partagé.
    const note = !estDuJour && !enArchive && !solved.has(open.id) && !vus[open.id];
    return (
      <PuzzlePlayer key={`${open.id}${enArchive ? '-archive' : ''}`} puzzle={open} rang={ordre.indexOf(open) + 1} confirmTouch={confirmTouch}
        duJour={enArchive ? { numero: archive, serie: 0, defiChange: false, archive: numero, gelGagne: false, celebrer, jalon: null, apprendre: onApprendre }
          : estDuJour ? { numero, serie: serieVivante(serieDuJour, numero), defiChange, gelGagne, celebrer, jalon, apprendre: onApprendre } : undefined}
        rated={!!db && !!userId && online && !!stats && !stats.attempted.includes(open.id) && !solved.has(open.id)}
        onPremierEssai={note ? ok => {
          // Mesure de « Continuer » (#284) : réussite au premier essai par tranche de cote. Cote avant l'essai, jamais affichée.
          track(EVENTS.problemeTermine, { probleme: open.id, cote_joueur: Math.round(cote.cote), cote_probleme: open.difficulty, premier_essai_reussi: ok });
          majCote(c => noter(c, open, ok ? 'premier' : 'rate', numero));
        } : undefined}
        onAttempt={async ok => {
          if (!db || !userId) return null;
          const r = await recordPuzzleAttempt(db, open.id, ok);
          if (r.ok) setStats(s => s && { ...s, rating: r.value, attempted: [...s.attempted, open.id], solved: ok ? [...s.solved, open.id] : s.solved, streak: ok ? Math.max(1, s.streak) : s.streak });
          if (r.ok && ok) setStatsTick(n => n + 1); // relit la série calculée par le serveur
          return r;
        }}
        onSolved={(essais, aide) => {
          // #197 : résolu après avoir vu la réponse, c'est « Vu » : ni XP ni palier. La série du Go du jour tient quand même.
          const gain = recompense(aide, estDuJour);
          // #233 (P1) : le Go du jour rapporte une fois par jour, même s'il était déjà réussi dans la grille.
          const source = gain.xp ? sourceXpProbleme({ dejaReussi: solved.has(open.id), estDuJour, goDuJourDejaFait: goDuJourFaitAppareil(numero) }) : null;
          if (gain.xp && !solved.has(open.id)) track(EVENTS.problemeResolu, { probleme: open.id, du_jour: estDuJour });
          if (source) gagnerXp(source);
          // #199 : un défi par jour ; le Go du jour est coché à part, une leçon ou la révision ont pu faire vivre la série avant lui.
          if (gain.serie && !goDuJourFaitAppareil(numero)) {
            const avant = readLocal<Serie | null>(SERIE_KEY, null);
            const { serie: s, gagne } = validerDefi('go_du_jour');
            setSerieDuJour(s);
            setJalon(jalonFranchi(avant, s, numero));
            if (gagne) { setGelGagne(true); setGels(lireReserveAppareil().gels); }
            track(EVENTS.goDuJourResolu, { numero, essais, serie: s?.jours ?? 1, arrivee_par_lien: lien !== null, vu: gain.statut === 'vu' });
          }
          if (gain.palier) markSolved(open.id); else markVu(open.id);
          // Raté au premier essai, puis trouvé seul, sans indice ni réponse : réussite avec aide, elle compte un peu (#284).
          // Un indice ou la réponse vue ne changent pas la cote : l'échec du premier essai reste tel quel.
          if (note && gain.palier && essais > 1 && aide === 0) majCote(c => requalifierEnAide(c, open.id));
          suivreEnRevisionAppareil(open.id);
          // #237 : un Go du jour qui reprend une étape de leçon ne revient pas dès demain en révision.
          // #251 (M3) : seulement si le joueur a fait cette étape ; sinon, il le voyait pour la première fois.
          // #251 (M2) : et seulement s'il l'a réussi sans voir la réponse. Vu avec l'aide, il n'est pas acquis :
          // la révision le repropose dès demain (J+1, comme une révision ratée, revision.ts).
          if (estDuJour && gain.palier && repriseDeLeconFaite(open)) noterRediteAppareil(open.id);
        }}
        onSolutionVue={essais => track(EVENTS.solutionVue, { probleme: open.id, du_jour: estDuJour, essais })}
        onNext={nextPz ? () => { if (essai && nextPz.id !== daily?.id) { essai(); return; } setArchive(null); setOpenId(nextPz.id); window.scrollTo({ top: 0 }); } : undefined}
        onExit={() => { setArchive(null); setOpenId(null); }} />
    );
  }

  if (course) {
    // Ni la cote, ni les problèmes réussis, ni la série ne bougent pendant une course. Le Go du jour n'y est pas.
    return <Course liste={list} cote={cote.cote} exclure={daily ? [daily.id] : []} confirmTouch={confirmTouch}
      onExit={() => { setCourse(false); window.scrollTo({ top: 0 }); }} />;
  }

  if (load.status === 'loading') {
    return (
      <div className="problemes-chargement" aria-busy="true" role="status">
        <Reflexion taille={32} />
        <span>{tr('pb.chargement')}</span>
      </div>
    );
  }

  const connecte = !!db && !!userId;
  // #284 : le prochain problème pas encore réussi le plus proche de 85 % de réussite prévue ; tout réussi, la série infinie (#147).
  const prochainPz = aMesure(dernierRef.current)
    ?? aContinuer(tiers, solved, dernierRef.current, () => tirage);
  // Une seule action en relief : le Go du jour tant qu'il n'est pas fait, « Problème suivant » ensuite.
  const duJourReussi = !!daily && goDuJourFaitAppareil(numero);
  const duJourFait = !daily || duJourReussi;
  // Série (issue #161) : celle de l'appareil sans compte, la plus longue des deux avec un compte.
  const serie = serieAffichee(connecte && stats ? stats.streak : null, serieDuJour, numero);
  const notices = <>
    {load.error === 'offline' && <p className="notice" role="status">{tr('pb.horsLigne')}</p>}
    {load.error && load.error !== 'offline' && (
      <p className="notice" role="alert">{load.error} {tr('pb.copieLocale')} <button className="lien" onClick={() => setRetry(n => n + 1)}>{tr('pb.reessayer')}</button></p>
    )}
  </>;

  // « Tous les problèmes » (issue #196) : la grille, derrière un lien. Paliers ouverts, puis le prochain palier en une ligne.
  if (tous) {
    const { ouverts, prochain: suivant } = paliersVisibles(tiers);
    return (
      <div className="problemes problemes-tous">
        <div className="tous-tete">
          <Retour label={tr('pb.retour')} onClick={() => { setTous(false); window.scrollTo({ top: 0 }); }} />
          <h2 id="paliers-titre">{tr('pb.tous')}</h2>
        </div>
        {notices}
        <p className="muted small bases-aide">{fr(tr('pb.aide.avant'))}<b>{tr('pb.aide.mot')}</b>{fr(tr('pb.aide.apres'))}</p>
        {ouverts.map(t => (
          <PalierVue key={t.id} t={t} ordre={ordre} solved={solved} vus={vus} onOpen={ouvrirProbleme}
            fete={fetes.includes(t.id)} />
        ))}
        {suivant && (
          <div className="palier verrouille palier-prochain" data-palier={suivant.id} role="group" aria-labelledby={`palier-${suivant.id}`}>
            <h3 id={`palier-${suivant.id}`}><Cadenas />{tr(`palier.${suivant.id}.nom`)}<span className="sr-only"> ({tr('pb.verrouille')})</span></h3>
            <p className="palier-verrou">{fr(tr('pb.palierVerrou'))}</p>
          </div>
        )}
      </div>
    );
  }

  const enCours = palierEnCours(tiers);
  return (
    <div className="problemes">
      {notices}

      {daily && (
        <section aria-labelledby="jour-titre">
          <h2 id="jour-titre" className="titre-pierres">{tr('accueil.goDuJour')} <span className="numero-du-jour">{tr('pb.numero', { numero })}</span><Glacon gels={stats ? stats.freezes : gels} /></h2>
          <p className="muted small bases-aide">{tr('pb.duJourAide')}</p>
          <DuJour pz={daily} reussi={duJourReussi} vu={!!vus[daily.id] && !solved.has(daily.id)} onOpen={() => setOpenId(daily.id)} />
        </section>
      )}

      {/* #293 : les erreurs dues aujourd'hui viennent juste sous le Go du jour (la revue promet « Cette position
          reviendra dans Problèmes »). La section n'existe que s'il y en a ; ses vignettes restent des actions
          secondaires : l'action en relief reste le Go du jour, ou « Problème suivant » une fois le Go du jour fait. */}
      {!essai && <MesErreurs confirmTouch={confirmTouch} Lecteur={PuzzlePlayer} />}

      {/* Révision du jour (#199) : problèmes déjà réussis, repris à J+1, J+3, J+7. Depuis #251 (M2), aussi ceux
          vus avec la réponse : « Retente-le plus tard » (pb.vuTexte), c'est la révision qui le repropose. */}
      {!essai && <RevisionDuJour liste={list} reussis={aReviser} vus={vusSeuls} confirmTouch={confirmTouch} Lecteur={PuzzlePlayer} onSerie={setSerieDuJour} />}

      {/* Un seul « Problème suivant », le palier en cours sans total, la grille derrière un lien discret (#196). */}
      <section aria-labelledby="paliers-titre">
        <h2 id="paliers-titre" className="titre-pierres">{tr('nav.problemes')}</h2>
        {/* #103 : le palier en cours est un paysage (le pied de la montagne, la pente, la crête…), jamais un total.
            Dessous, la carte « Continuer » : le prochain problème, voilé, et une seule action. */}
        {enCours && (
          <div className={`palier-en-cours${enCours.complet ? ' complet' : ''}`} data-palier-en-cours={enCours.id} data-reussis={enCours.reussis}>
            <Paysage id={enCours.id} />
            <div className="palier-en-cours-texte">
              <div className="palier-nom">
                <small className="palier-surtitre">{tr('pb.tonPalier')}</small>
                <h3>{tr(`palier.${enCours.id}.nom`)}</h3>
                <small>{tr(`palier.${enCours.id}.kyu`)}</small>
              </div>
              <div className="palier-etat">
                {enCours.complet && <span className="palier-sceau" role="img" aria-label={tr('pb.palierComplet')}><SceauLecon id={`p${enCours.rang}`} taille={40} /></span>}
                {enCours.reussis > 0 && <p className="palier-compte">{tr('pb.reussis', { n: enCours.reussis })}</p>}
              </div>
            </div>
            {prochainPz && <Continuer pz={prochainPz} principal={duJourFait} onOpen={() => ouvrirProbleme(prochainPz.id)} />}
          </div>
        )}
        {!enCours && prochainPz && <Continuer pz={prochainPz} principal={duJourFait} onOpen={() => ouvrirProbleme(prochainPz.id)} />}
        <CarteCourse onOpen={() => { if (essai) { essai(); return; } setCourse(true); window.scrollTo({ top: 0 }); }} />
        <button className="lien lien-tous" onClick={() => { if (essai) { essai(); return; } setTous(true); window.scrollTo({ top: 0 }); }}>
          {tr('pb.tous')}
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </section>

      {/* Aucune cote affichée (décision de Florian, #137) : la cote problèmes existe sur le serveur, invisible. */}
      {connecte && stats ? (
        <div className="palmares">
          <div className="palmares-serie">
            <span className="chiffre"><Flamme taille={30} />{serie}</span>
            <span className="legende">{tr('pb.serieLegende', { n: serie })}</span>
          </div>
        </div>
      ) : connecte && statsError ? (
        <p className="notice" role="alert">{statsError} <button className="lien" onClick={() => setRetry(n => n + 1)}>{tr('pb.reessayer')}</button></p>
      ) : connecte && online ? (
        <div className="palmares" aria-busy="true"><div className="palmares-serie"><span className="sr-only">{tr('pb.chargementSerie')}</span><span className="chiffre attente" /><span className="legende">{tr('pb.serieLegende', { n: 2 })}</span></div></div>
      ) : !connecte && serie > 0 ? (
        // Sans compte, la série de l'appareil s'affiche comme pour un joueur connecté (issue #161).
        <div className="palmares palmares-invite">
          <div className="invitation">
            {inviterCompte(false, serie)
              ? <p>{fr(tr('serie.invitation'))}</p>
              : <p>{fr(tr('pb.invitation.avant'))}<b>{tr('pb.invitation.mot')}</b>{fr(tr('pb.invitationCourte.apres'))}</p>}
            {onCompte && <button className="lien" onClick={onCompte}>{inviterCompte(false, serie) ? tr('serie.creerCompte') : tr('pb.meConnecter')}</button>}
          </div>
          <div className="palmares-serie">
            <span className="chiffre"><Flamme taille={30} />{serie}</span>
            <span className="legende">{tr('pb.serieLegende', { n: serie })}</span>
          </div>
        </div>
      ) : !connecte ? (
        <div className="invitation">
          <p>{fr(tr('pb.invitation.avant'))}<b>{tr('pb.invitation.mot')}</b>{fr(tr('pb.invitation.apres'))}</p>
          {onCompte && <button className="lien" onClick={onCompte}>{tr('pb.meConnecter')}</button>}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Carte « Continuer » (#103) : le prochain problème, voilé (on devine la position sans la lire), sa difficulté,
 * qui joue, et une seule action. En relief quand le Go du jour est fait ; à plat sinon, le Go du jour reste l'action.
 * #268 (WCAG 2.5.3) : pas d'aria-label ; le nom accessible du bouton est son texte visible, verbe d'abord.
 */
function Continuer({ pz, principal, onOpen }: { pz: Puzzle; principal: boolean; onOpen: () => void }) {
  return (
    <div className="continuer-carte">
      <span className="continuer-goban" aria-hidden="true" onClick={onOpen}><MiniGoban rows={pz.rows} /></span>
      <div className="continuer-corps">
        <p className="continuer-aide">{fr(tr('pb.continuerAide'))}</p>
        <p className="continuer-infos"><Difficulte d={pz.difficulty} /><span className="muted">{tr(pz.toPlay === 1 ? 'pb.joue.1' : 'pb.joue.2')}</span></p>
      </div>
      <button type="button" className={principal ? 'cta continuer' : 'btn continuer'} onClick={onOpen}>
        {tr('pb.continuer')} <span className="continuer-titre">{pz.title}</span>
      </button>
    </div>
  );
}

/** Sceau de réussite d'une miniature (#103) : un vrai tampon jade, carré arrondi, coche en papier. */
function SceauReussi() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect x="1.5" y="1.5" width="29" height="29" rx="8" className="sceau-fond" />
      <rect x="4.5" y="4.5" width="23" height="23" rx="6" className="sceau-anneau" />
      <path d="M10 16.6 14 20.4 22 11.8" className="sceau-coche" />
    </svg>
  );
}

/**
 * Un palier : nom, rang en kyu, sceau quand il est complet, et sa grille de miniatures.
 * Aucun total affiché (ni « 3 / 33 », ni barre, ni montagne) : le joueur doit sentir que les problèmes ne s'arrêtent jamais.
 */
function PalierVue({ t, ordre, solved, vus, onOpen, fete }: {
  t: Palier<Puzzle>; ordre: Puzzle[]; solved: Set<string>; vus: Record<string, true>; onOpen: (id: string) => void; fete: boolean;
}) {
  const titre = `palier-${t.id}`;
  return (
    <div className={`palier${t.complet ? ' complet' : ''}${fete ? ' fete' : ''}`} data-palier={t.id} data-reussis={t.reussis} aria-labelledby={titre} role="group">
      {/* #103 : en-tête illustré, le paysage du palier ; complet, le sceau se pose dessus et le soleil se lève (fête). */}
      <div className="palier-tete">
        <Paysage id={t.id} />
        <div className="palier-tete-texte">
          <div className="palier-nom">
            <h3 id={titre}>{tr(`palier.${t.id}.nom`)}</h3>
            <small>{tr(`palier.${t.id}.kyu`)}</small>
          </div>
          <div className="palier-etat">
            {t.complet && <span className="palier-sceau" role="img" aria-label={tr('pb.palierComplet')}><SceauLecon id={`p${t.rang}`} taille={40} /></span>}
            {t.reussis > 0 && <p className="palier-compte">{t.complet ? tr('pb.palierComplet') : tr('pb.reussis', { n: t.reussis })}</p>}
          </div>
        </div>
      </div>
      <ul className="grille-pb">
        {t.problemes.map(p => {
          const ok = solved.has(p.id);
          const vu = !ok && !!vus[p.id];
          const i = ordre.indexOf(p);
          return (
            <li key={p.id}>
              <button className={ok ? 'reussi' : undefined} onClick={() => onOpen(p.id)} data-probleme={p.id}
                aria-label={`${tr('pb.problemeAria', { n: i + 1, titre: p.title })}${ok ? `, ${tr('pb.reussi')}` : vu ? `, ${tr('pb.vu')}` : ''}`}>
                <span className="grille-goban">
                  <MiniGoban rows={p.rows} />
                  {vu && <span className="pastille-vu" aria-hidden="true">{tr('pb.tamponVu')}</span>}
                  {ok && <span className="pastille-ok" aria-hidden="true"><SceauReussi /></span>}
                </span>
                <b aria-hidden="true">{p.title}</b>
                <span aria-hidden="true"><Difficulte d={p.difficulty} /></span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Entrée de la course (#287) : une carte secondaire, sans or ni relief. Le Go du jour et « Problème suivant » restent
 * les actions principales. Le meilleur score est un record de ce mode, jamais un total de problèmes (#137).
 */
function CarteCourse({ onOpen }: { onOpen: () => void }) {
  const [meilleur] = useState(lireMeilleurCourse);
  return (
    <button type="button" className="course-carte" onClick={onOpen} data-course="">
      <ChronoCourse taille={56} />
      <span className="course-carte-texte">
        <b>{fr(tr('course.carte.titre'))}</b>
        <small>{fr(tr('course.carte.texte'))}{meilleur > 0 && <> <span className="course-carte-meilleur">{fr(tr('course.carte.meilleur', { meilleur }))}</span></>}</small>
      </span>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
  );
}

function Cadenas() {
  return (
    <svg className="cadenas" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <rect x="3" y="7" width="10" height="7.5" rx="2" fill="currentColor" />
      <path d="M5.2 7V5.2a2.8 2.8 0 0 1 5.6 0V7" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

/** Problème du jour : la vraie position sur le goban, recadrée sur les pierres, et le bouton « Résoudre » en relief. */
function DuJour({ pz, reussi, vu, onOpen }: { pz: Puzzle; reussi: boolean; vu: boolean; onOpen: () => void }) {
  const start = useMemo(() => startOf(pz), [pz]);
  const vb = viewBoxOf(pz.size);
  // Hauteur du centre des pierres, en fraction de la largeur de l'image du goban (qui est carrée).
  const f = (M + centreVertical(pz.rows) * C - vb.min) / vb.span;
  return (
    <div className={`du-jour${reussi ? ' reussi' : ''}`}>
      <div className="du-jour-plateau" aria-hidden="true" onClick={onOpen} style={{ '--f': f } as CSSProperties}>
        <div className="du-jour-cadre"><Board size={pz.size} board={start.pos.board} marks={{ targets: start.marked }} /></div>
        {reussi && <span className={`tampon-reussi${vu ? ' tampon-vu' : ''}`}>{tr(vu ? 'pb.tamponVu' : 'pb.tampon')}</span>}
      </div>
      <div className="du-jour-corps">
        <h3>{pz.title}</h3>
        <p><Difficulte d={pz.difficulty} /> <span className="muted">{tr(pz.toPlay === 1 ? 'pb.joue.1' : 'pb.joue.2')}</span></p>
        <button className={reussi ? 'btn du-jour-refaire' : 'cta'} aria-label={tr(reussi ? 'pb.refaireAria' : 'pb.resoudreAria')} onClick={onOpen}>{tr(reussi ? 'pb.refaire' : 'pb.resoudre')}</button>
      </div>
    </div>
  );
}

type Answer = { kind: 'ok' | 'wrong' | 'illegal'; p: number; text: string; n: number };

/** Bouton « Partager » du Go du jour : Web Share API, sinon copie dans le presse-papiers. Texte sans la réponse. */
function Partager({ numero, essais, serie }: { numero: number; essais: number; serie: number }) {
  const [etat, setEtat] = useState<'' | 'copie' | 'erreur'>('');
  const p = textePartage(numero, essais, serie);
  async function partager() {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ text: p.texte, url: p.url });
        track(EVENTS.goDuJourPartage, { numero, essais, methode: 'partage' });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return; // le joueur a fermé la feuille de partage
      }
    }
    try {
      await navigator.clipboard.writeText(p.complet);
      setEtat('copie');
      track(EVENTS.goDuJourPartage, { numero, essais, methode: 'copie' });
    } catch {
      setEtat('erreur');
    }
  }
  // #292 : « Copié ! » s'affiche dans le bouton pendant 2 s, au lieu d'une ligne de plus qui agrandissait la feuille
  // et la faisait mordre sur le plateau. L'annonce passe par une zone lue seulement par le lecteur d'écran.
  useEffect(() => {
    if (etat !== 'copie') return;
    const id = window.setTimeout(() => setEtat(''), 2000);
    return () => window.clearTimeout(id);
  }, [etat]);
  const copie = etat === 'copie';
  return (
    <>
      <button className={`btn partager${copie ? ' partage-copie' : ''}`} onClick={partager}>
        {copie
          ? <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="M5 12.5 10 17l9-10" /></svg>
          : <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></svg>}
        {copie ? tr('pb.copie') : tr('pb.partager')}
      </button>
      <p className="sr-only" role="status" aria-live="polite">{copie ? tr('pb.copieAnnonce') : ''}</p>
      {etat === 'erreur' && (
        <p className="partage-etat" role="alert">{tr('pb.copieImpossible')} <span className="partage-lien">{p.url}</span></p>
      )}
    </>
  );
}

/** `archive` : numéro d'aujourd'hui quand le joueur ouvre un Go du jour passé par un lien partagé. */
interface DuJourInfo {
  numero: number; serie: number; defiChange: boolean; archive?: number; gelGagne: boolean; celebrer: boolean;
  /** Jalon de série franchi à l'instant (#214). */
  jalon: Jalon | null;
  /** #285 : joueur arrivé par un lien sans avoir jamais joué. Après le problème, une seule action : la leçon 1. */
  apprendre?: () => void;
}

/** Temps pendant lequel la réponse de l'adversaire reste sur le plateau après une erreur (#237, N6). */
const DUREE_ERREUR = 2200;

export function PuzzlePlayer({ puzzle, rang, duJour, confirmTouch, rated, onPremierEssai, onAttempt, onSolved, onNext, onExit, onSolutionVue, retour, surtitre, exercice = true }: {
  puzzle: Puzzle; rang: number; duJour?: DuJourInfo; confirmTouch: boolean; rated: boolean;
  /** Premier essai joué (#284) : réussi ou non. Sert à la cote de « Continuer », jamais affichée. */
  onPremierEssai?: (ok: boolean) => void;
  onAttempt: (ok: boolean) => Promise<{ ok: true; value: number } | { ok: false; error: string } | null>;
  onSolved: (essais: number, aide: NiveauAide) => void; onNext?: () => void; onExit: () => void;
  /** La réponse vient d'être montrée (#197). */
  onSolutionVue?: (essais: number) => void;
  /** Série de fin de leçon (#200) : libellé du retour (« Retour au chemin ») et surtitre (« Entraînement » et ses points). */
  retour?: string; surtitre?: ReactNode;
  /** Faux quand l'exercice est fini alors que le lecteur reste affiché (dernier problème d'une série, #250 M9). */
  exercice?: boolean;
}) {
  // #236 (N2) : un problème est un exercice ; aucune fête ne se pose sur sa consigne (l'XP se lit dans la feuille).
  useExercice(exercice);
  const start = useMemo(() => startOf(puzzle), [puzzle]);
  // Aide graduée (#197) : indice, puis réfutation, puis réponse.
  const [aide, setAide] = useState<NiveauAide>(0);
  const [refut, setRefut] = useState<{ r: Refutation; vue: boolean } | null>(null);
  // #237 (N6) : après une erreur, l'adversaire répond au coup faux, puis la position revient d'elle-même (ou au toucher).
  const [apercu, setApercu] = useState<{ faux: number; reponse: number | null; vue: boolean } | null>(null);
  const dernierFaux = useRef<number | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [board, setBoard] = useState(start.pos.board);
  const [tries, setTries] = useState(0);
  const [replay, setReplay] = useState<{ frame: number; total: number } | null>(null);
  const [shake, setShake] = useState<{ p: number; n: number } | null>(null);
  const firstTry = useRef(true);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const solvedNow = answer?.kind === 'ok';

  async function onPlay(p: number) {
    if (solvedNow) return;
    // Réfutation montrée après l'erreur : toucher le plateau remet la position de départ et joue le coup tout de suite.
    if (apercu) { window.clearTimeout(timer.current); setApercu(null); setBoard(start.pos.board); }
    // #237 (N6) : comme en leçon, on rejoue directement sur le plateau, sans « Réessayer ».
    // Pendant la réfutation ou la réponse montrée, le plateau revient d'abord à la position de départ.
    if (refut || replay) {
      if ((replay && !replayDone) || (refut && !refut.vue)) return;
      reessayer();
      if (toucherApresErreur(!start.pos.board[p], !board[p]) === 'remettre') return;
    }
    const r = checkAnswer(puzzle, p);
    const n = (answer?.n ?? 0) + 1;
    if (r.kind === 'illegal') {
      playIllegal(); hapticIllegal(); setShake({ p, n });
      setAnswer({ kind: 'illegal', p, text: tr(`pb.illegal.${r.reason}`), n });
      return;
    }
    const ok = r.kind === 'ok';
    playStone(p, puzzle.size); hapticStone();
    if (ok) { playSuccess(); hapticSuccess(); } else { playFail(); hapticFail(); }
    setTries(tries + 1);
    if (!ok) dernierFaux.current = p;
    setAnswer({ kind: r.kind, p, text: ok ? (puzzle.explanation ?? tr('pb.bonCoup')) : (puzzle.refutation ?? tr('pb.pasTout')), n });
    window.clearTimeout(timer.current);
    if (ok) { setApercu(null); setBoard(r.after.board); onSolved(tries + 1, aide); }
    else montrerErreur(p, r.after.board);
    // Seul le premier essai compte pour la cote, qui n'est jamais affichée (décision #137) : ni valeur ni message.
    if (firstTry.current) onPremierEssai?.(ok);
    if (firstTry.current && rated) {
      firstTry.current = false;
      await onAttempt(ok);
    }
    firstTry.current = false;
  }

  function showLine() {
    const frames = solutionFrames(puzzle);
    window.clearTimeout(timer.current);
    if (prefersReducedMotion()) {
      setBoard(frames[frames.length - 1].board);
      setReplay({ frame: frames.length - 1, total: frames.length - 1 });
      return;
    }
    let i = 0;
    setBoard(frames[0].board);
    setReplay({ frame: 0, total: frames.length - 1 });
    const stepOnce = () => {
      i++;
      setBoard(frames[i].board);
      setReplay({ frame: i, total: frames.length - 1 });
      if (i < frames.length - 1) timer.current = window.setTimeout(stepOnce, 800);
    };
    timer.current = window.setTimeout(stepOnce, 500);
  }
  /**
   * Erreur (#237, N6) : le coup faux reste posé, l'adversaire y répond au point clé, puis la position de départ revient
   * d'elle-même. Mouvements réduits : la réponse est posée d'un coup et le retour est instantané, sans animation.
   */
  function montrerErreur(faux: number, apresFaux: Int8Array) {
    const r = refutation(puzzle, faux);
    const reduit = prefersReducedMotion();
    const revenir = () => { setApercu(null); setBoard(start.pos.board); };
    if (!r || r.reponse === null) {
      setBoard(apresFaux); setApercu({ faux, reponse: null, vue: true });
      timer.current = window.setTimeout(revenir, DUREE_ERREUR);
      return;
    }
    const reponse = r.reponse;
    const montrer = () => {
      setBoard(r.pos.board); setApercu({ faux, reponse, vue: true });
      if (!reduit) { playStone(reponse, puzzle.size); hapticStone(); }
      timer.current = window.setTimeout(revenir, DUREE_ERREUR);
    };
    if (reduit) { montrer(); return; }
    setBoard(apresFaux); setApercu({ faux, reponse, vue: false });
    timer.current = window.setTimeout(montrer, 600);
  }
  function reessayer() {
    window.clearTimeout(timer.current);
    setApercu(null); setReplay(null); setRefut(null); setBoard(start.pos.board); setAnswer(null);
  }

  /** Marche suivante de l'aide : l'indice entoure la zone, la réfutation joue la réponse de l'adversaire, puis la réponse. */
  function demanderAide() {
    const suite = aideSuivante(aide);
    if (suite === null) return;
    window.clearTimeout(timer.current);
    setApercu(null);
    const r = suite === 2 && dernierFaux.current !== null ? refutation(puzzle, dernierFaux.current) : null;
    if (suite === 1) {
      setAide(1); setAnswer(null); setBoard(start.pos.board);
    } else if (suite === 2 && r) {
      setAide(2); setAnswer(null);
      // Le coup faux d'abord, puis l'adversaire répond au point clé (600 ms) ; tout de suite si les mouvements sont réduits.
      const avecFaux = checkAnswer(puzzle, r.faux);
      if (r.reponse === null || prefersReducedMotion() || avecFaux.kind === 'illegal') {
        setBoard(r.pos.board); setRefut({ r, vue: true });
      } else {
        setBoard(avecFaux.after.board); setRefut({ r, vue: false });
        timer.current = window.setTimeout(() => {
          setBoard(r.pos.board); setRefut({ r, vue: true });
          if (r.reponse !== null) { playStone(r.reponse, puzzle.size); hapticStone(); }
        }, 600);
      }
    } else {
      setAide(3); setRefut(null); setAnswer(null);
      onSolutionVue?.(tries);
      showLine();
    }
  }
  const prochaineAide = aideSuivante(aide);
  const libelleAide = prochaineAide === 1 ? tr('pb.aide.indice') : prochaineAide === 2 && dernierFaux.current !== null ? tr('pb.aide.pourquoi') : tr('pb.aide.reponse');
  // L'aide reste un lien discret (#237, N6) : l'action principale après une erreur, c'est de rejouer.
  const boutonAide = prochaineAide !== null && tries >= 1
    ? <button className="lien lien-aide" onClick={demanderAide}>{libelleAide}</button>
    : null;
  const vu = reponseVue(aide);

  const frames = replay ? solutionFrames(puzzle) : null;
  const lastMove = replay && frames ? frames[replay.frame].lastMove : solvedNow ? answer.p : null;
  const replayDone = !!replay && replay.frame === replay.total;

  const suivantBtn = <button className="cta" onClick={onNext ?? onExit}>{onNext ? tr('pb.suivant') : retour ?? tr('pb.retour')}</button>;
  // #285 : arrivé par un lien sans avoir jamais joué, une seule action après le problème, vers la leçon 1.
  const apprendreBtn = duJour?.apprendre ? <button className="cta vers-lecon-1" onClick={duJour.apprendre}>{tr('arrivee.apprendre')}</button> : null;
  // « Partager » reste l'action secondaire, à plat : l'ami peut renvoyer le défi à son tour.
  const versLecon1 = apprendreBtn && duJour && <>
    {apprendreBtn}
    <Partager numero={duJour.numero} essais={tries} serie={duJour.serie} />
    <div className="row liens-du-jour"><button className="lien" onClick={showLine}>{tr('pb.voirSuite')}</button></div>
  </>;

  let verdict = null;
  if (replay) {
    verdict = (
      <Verdict ton="neutre" actions={solvedNow
        ? <>{apprendreBtn ?? suivantBtn}<button className="lien" onClick={showLine} disabled={!replayDone}>{tr('pb.revoirSuite')}</button></>
        : <button className="lien" onClick={showLine} disabled={!replayDone}>{tr('pb.revoirSuite')}</button>}>
        <p>{replayDone ? tr(solvedNow ? 'pb.suiteFinie' : 'pb.suiteFinieVu') : tr('pb.suiteCoup', { n: replay.frame, total: replay.total })}</p>
      </Verdict>
    );
  } else if (refut) {
    // Réfutation (#197) : l'adversaire répond au coup faux, au point clé.
    const texte = puzzle.refutation ?? tr(refut.r.reponse === null ? 'pb.aide.refutationSeule' : puzzle.toPlay === 1 ? 'pb.aide.refutation.1' : 'pb.aide.refutation.2');
    verdict = (
      <Verdict ton="neutre" actions={boutonAide}>
        <p data-refutation="">{refut.vue ? fr(texte) : tr('pb.aide.regarde')}</p>
        {refut.vue && <p className="muted small rejoue-plateau">{fr(tr('pb.rejouePlateau'))}</p>}
      </Verdict>
    );
  } else if (!answer && aide >= 1 && tries >= 1 && !vu) {
    // Indice (#197) : la zone du bon coup est entourée ; le plateau reste jouable.
    verdict = (
      <Verdict ton="neutre">
        <p>{fr(tr('pb.aide.indiceTexte'))}</p>
      </Verdict>
    );
  } else if (answer) {
    verdict = solvedNow && vu ? (
      // Résolu après avoir vu la réponse (#197) : « Vu », sans XP ; la série du Go du jour tient quand même.
      <Verdict ton="neutre" actions={<>{apprendreBtn ?? suivantBtn}<button className="lien" onClick={showLine}>{tr('pb.voirSuite')}</button></>}>
        <p data-vu="">{fr(tr('pb.vuTexte'))}</p>
        {duJour && <p className="verdict-cote">{fr(tr('pb.vuSerie'))}</p>}
      </Verdict>
    ) : solvedNow ? (
      <Verdict ton="juste" cle={answer.n} actions={versLecon1 ?? (duJour
        // Go du jour réussi (#75) : continuer est l'action principale ; « Partager » est l'action secondaire, juste dessous.
        ? <>
            {duJour.archive !== undefined && onNext
              ? <button className="cta" onClick={onNext}>{tr('pb.duJourAujourdhui', { numero: duJour.archive })}</button>
              : suivantBtn}
            <Partager numero={duJour.numero} essais={tries} serie={duJour.serie} />
            {duJour.gelGagne && (
              <p className={`gel-gagne${duJour.celebrer ? ' fete' : ''}`} role="status"><PierreGivree taille={18} />{fr(tr('pb.gelGagne'))}</p>
            )}
            <div className="row liens-du-jour">
              <button className="lien" onClick={showLine}>{tr('pb.voirSuite')}</button>
            </div>
          </>
        : <>{suivantBtn}<button className="lien" onClick={showLine}>{tr('pb.voirSuite')}</button></>)}>
        <p>{fr(answer.text)}</p><XpEnLigne anime={duJour?.celebrer ?? true} />
        {/* #214 : la série se lit sur la réussite (« 3 jours de série · À demain ») ; aux jalons 3, 7, 30, une petite fête. */}
        {duJour && duJour.archive === undefined && <SerieDuJour jours={duJour.serie} jalon={duJour.jalon} celebrer={duJour.celebrer} />}
      </Verdict>
    ) : (
      // Erreur (#237, N6) : pas de « Réessayer », le plateau reste jouable ; l'indice est un lien discret.
      <Verdict ton="revoir" cle={answer.n} actions={boutonAide}>
        <p>{fr(answer.text)}</p>
        {answer.kind === 'wrong' && <p className="muted small rejoue-plateau">{fr(tr('pb.rejouePlateau'))}</p>}
      </Verdict>
    );
  }

  return (
    <div className="lecteur" data-probleme={puzzle.id} data-serre={estSerre(puzzle.size) || undefined}>
      <div className="lecteur-tete">
        <Retour label={retour ?? tr('pb.retour')} onClick={onExit} />
        <div className="lecteur-nom">
          {duJour
            ? <small className="entete-du-jour">{tr('accueil.goDuJour')} <b className="numero-du-jour">{tr('pb.numero', { numero: duJour.numero })}</b></small>
            : <small>{surtitre ?? tr('pb.probleme', { n: rang })}</small>}
          <h2>{puzzle.title}</h2>
        </div>
        <Difficulte d={puzzle.difficulty} />
        {/* #362 : « ? » ouvre les mots du go (atari, échelle, œil…) sans quitter le problème. */}
        <BoutonAide depuis="probleme" fiche="mots" />
      </div>
      {duJour?.defiChange && <p className="notice" role="status">{fr(tr('pb.defiChange'))}</p>}
      {duJour?.archive !== undefined && <p className="notice" role="status">{fr(tr('pb.archive', { numero: duJour.archive }))}</p>}
      <Board size={puzzle.size} board={board} toPlay={puzzle.toPlay} interactive={!solvedNow && (!replay || replayDone) && (!refut || refut.vue)}
        stonesTappable={!!refut || !!replay || !!apercu} onPlay={onPlay} shake={shake}
        // #400 : en 13 × 13 et plus, une touche ratée coûterait l'essai : confirmation au doigt toujours, et visée.
        confirmTouch={confirmTouch || estSerre(puzzle.size)} surFantome={estSerre(puzzle.size) ? q => <Visee p={q} size={puzzle.size} /> : undefined}
        marks={{
          targets: start.marked,
          last: refut ? (refut.vue ? refut.r.reponse : refut.r.faux) : apercu ? (apercu.vue && apercu.reponse !== null ? apercu.reponse : apercu.faux) : lastMove,
          ok: solvedNow && !replay ? answer.p : undefined,
          mistake: refut ? refut.r.faux : answer && answer.kind === 'wrong' && !replay ? answer.p : undefined,
          // Indice : zone entourée autour du bon coup, tant que le problème n'est pas résolu.
          zone: aide >= 1 && !solvedNow && !replay && !refut ? puzzle.answers[0] : undefined
        }} />
      {/* Audit du 02/10 (n° 1) : la consigne sous le plateau, à la place du vide ; le verdict arrive au même endroit. */}
      <ParoleMochi humeur={solvedNow ? 'content' : answer?.kind === 'wrong' ? 'pensif' : 'neutre'}>
        {fr(`${duJour?.apprendre ? `${tr('arrivee.premierCoup')} ` : ''}${puzzle.prompt} ${tr(puzzle.toPlay === 1 ? 'pb.tuJoues.1' : 'pb.tuJoues.2')}`)}
      </ParoleMochi>
      {verdict}
    </div>
  );
}
