// Onglet Problèmes (issue #40, phase 6) : cote et série, problème du jour mis en scène, grille des problèmes de base.
// #653 (règle A13 de DESIGN.md, modèle : l'onglet Problèmes de chess.com) : la racine est un sommaire. En tête, la carte
// de l'action principale (le Go du jour s'il est à faire, sinon le problème suivant, logique de V1 #620) ; dessous, quatre
// entrées de même poids : Go du jour, Rejouer tes erreurs, Course aux problèmes, Par thème. Chacune ouvre son détail.
import { LienSignalerProbleme } from '../ui/Securite';
import { BoutonAide } from '../ui/BoutonAide';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Db } from '../data/supabase';
import { ALL_PUZZLES } from '../content/puzzles';
import {
  checkAnswer, fetchPuzzleStats, fetchPuzzles, parsePuzzles, recordPuzzleAttempt, solutionFrames, startOf,
  type Puzzle, type PuzzleStats
} from '../data/puzzles';
import { Board } from '../ui/Board';
import type { Position } from '../go/rules';
import { MiniGoban } from '../ui/MiniGoban';
import { Visee } from '../ui/Visee';
import { estSerre } from '../ui/plateauSerre';
import { centreVertical } from '../ui/cadrage';
import { C, M, viewBoxOf } from '../ui/boardArt';
import { ParoleMochi, Retour, Verdict } from '../ui/Lecteur';
import { useTitreFocus } from '../ui/titreFocus';
import { Reflexion } from '../ui/Reflexion';
import { fr } from '../ui/typo';
import { playBadge, playFail, playIllegal, playStone, playSuccess } from '../ui/sound';
import { hapticBadge, hapticFail, hapticIllegal, hapticStone, hapticSuccess } from '../ui/haptics';
import { EVENTS, track } from '../data/analytics';
import { gagnerXp, sourceXpProbleme } from './xp';
import { texteReponseVue } from './reponseProbleme';
import { aideSuivante, recompense, refutation, reponseVue, toucherApresErreur, type NiveauAide, type Refutation } from './aide';
import { butDe, comprendreErreur, solutionComplete, type ErreurComprise } from './comprendreErreur';
// #563 : carte d'entrée de la course, hors du CSS initial ; avant comprendre.css et apprendre.css, comme dans la
// feuille principale.
import '../ui/course-ecran.css';
import '../ui/comprendre.css';
import { prefersReducedMotion, readLocal, useOnline, writeLocal } from './hooks';
import { usePreferences } from './settings';
import { niveau, prochainAMesure } from './problemes';
import { aContinuer, aSuivre, ordrePaliers, palierEnCours, paliers, paliersVisibles, type Palier } from './paliers';
import { SceauLecon } from '../ui/SceauLecon';
import { aFeter, FETES_KEY } from './fetesPaliers';
import { SerieDuJour } from '../ui/SerieDuJour';
import { jalonFranchi, type Jalon } from './jalonsSerie';
import { SERIE_KEY, numeroDuJour, problemeDuNumero, serieVivante, textePartage, type Serie } from './goDuJour';
import '../ui/apprendre.css';
import { Glacon, PierreGivree } from '../ui/Glacon';
import { lireReserveAppareil } from './gelAppareil';
import { inviterCompte, serieAffichee } from './serieLocale';
import { goDuJourFaitAppareil, validerDefi } from './defiAppareil';
import { noterProblemeRate } from './revisionsAppareil';
import { noterRediteAppareil, repriseDeLeconFaite, suivreEnRevisionAppareil } from './rediteAppareil';
// `t` désigne déjà un palier dans ce fichier : la traduction s'appelle `tr` (#167).
import { t as tr } from '../content/i18n/secondaires';
import { useExercice } from '../ui/celebrations';
import { XpEnLigne } from '../ui/PastilleXp';
import { COTE_KEY, nettoyerCote, noter, ouvrir, requalifierEnAide, type EtatCote } from './coteJoueur';
import { ChronoCourse, Course } from './CourseProblemes';
import { lireMeilleurCourse } from './course';
import { Paysage } from '../ui/Paysage';
import { AmisDuJour } from '../ui/AmisDuJour';
import { noterGoDuJour, type ResultatEssai } from '../data/emulation';
import { SERIES_THEMES_KEY, nettoyerSeries, noterSerie, prochainDeSerie, serieDe, seriesDisponibles, type EtatSeriesThemes, type SerieTheme } from './seriesThemes';
import { maitrises, themeSuivant, vientDeMaitriser } from './maitriseThemes';
import { SurtitreTheme, VignettesThemes } from '../ui/SeriesThemes';
import { InviterApp } from '../ui/PartagerApp';
import { Sommaire, type EntreeSommaire } from '../ui/Sommaire';
import { EnteteEcran } from '../ui/BoutonRetour';

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
  /** #369 : un ami a rappelé le Go du jour (notification en attente) ; mesuré avec la réussite (`apres_rappel`). */
  rappelAmi?: boolean;
  /**
   * #653 : « Rejouer tes erreurs », la seule maison des révisions (erreurs de tes parties et problèmes ratés, révision
   * espacée #469). `n` : éléments dus aujourd'hui ; `ouvrir` lance la séance (App.tsx, SeanceRevisions).
   */
  erreurs?: { n: number; ouvrir: () => void };
  /** #646 (A5) : un problème ou la course sont ouverts : App.tsx passe en plein écran, sans barre du bas. */
  onActivite?: (actif: boolean) => void;
  /** #646 : libellé de la sortie d'un problème posé hors de Problèmes (« Retour ») ; sinon « Retour aux problèmes ». */
  retour?: string;
}

/** Flamme de la série de jours, en or ; creuse ou pleine selon la classe de la pastille (#213). */
function Flamme({ taille = 22 }: { taille?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={taille} height={taille} aria-hidden="true" focusable="false">
      <path className="flamme-corps" d="M8.6 1.2c.4 2.3 3.9 3.9 3.9 7.9A4.5 4.5 0 0 1 8 13.8a4.5 4.5 0 0 1-4.5-4.6c0-2 1-3.2 2-4 0 1.4.6 2.4 1.5 2.7C6.6 5.6 7.4 3 8.6 1.2Z" fill="currentColor" />
    </svg>
  );
}

/** Difficulté : trois petites pierres, pleines selon le niveau, et le mot. */
function Difficulte({ d }: { d: number }) {
  const n = niveau(d);
  return (
    <span className="difficulte">
      <span className="crans" aria-hidden="true">{[1, 2, 3].map(i => <i key={i} className={i <= n.crans ? 'plein' : undefined} />)}</span>
      <span className="difficulte-mot">{tr(`pb.difficulte.${n.crans}`)}</span>
    </span>
  );
}

/**
 * #685 (N3, A8) : liste ouverte (« Par thème », « Tous les problèmes ») quand l'écran s'est démonté (changement d'onglet),
 * retrouvée au retour. L'onglet actif touché (`racine`) la referme.
 */
let listeGardee = { tous: false, parTheme: false };

/** Onglet Problèmes : problème du jour, problèmes de base, cote problèmes et série de jours. */
export function Puzzles({ db, userId, sessionLoading, confirmTouch, onCompte, lien = null, onDuJour, celebrer = true, racine = 0, onApprendre, essai, depuisRappel = false, rappelAmi = false, onActivite, retour, erreurs }: Props) {
  /** Ouvre un problème ; hors Go du jour pendant l'essai sans compte, c'est « Crée ton compte » qui s'ouvre (#343). */
  const ouvrirProbleme = (id: string) => { if (essai && id !== daily?.id) essai(); else setOpenId(id); };
  // Go du jour (issue #75) : le même pour tous, choisi dans la liste publique des problèmes de base, en heure de Paris.
  const [numero] = useState(() => numeroDuJour(new Date()));
  // #620 : « Montrer la série » éteint, la pastille de série disparaît aussi de Problèmes (#365).
  const { serieVisible } = usePreferences();
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
  const [tous, setTous] = useState(() => !lien && !depuisRappel && listeGardee.tous);
  // Course aux problèmes (#287) : consigne, course et fin, à la place de la liste.
  const [course, setCourse] = useState(false);
  // #653 : détail « Par thème » (grille des séries et « Tous les problèmes »), ouvert depuis le sommaire.
  const [parTheme, setParTheme] = useState(() => !lien && !depuisRappel && listeGardee.parTheme);
  useEffect(() => { listeGardee = { tous, parTheme }; }, [tous, parTheme]);
  // Problèmes par thème (#471) : série ouverte, réussites d'affilée et record de chaque série (sur l'appareil).
  const [serieTheme, setSerieTheme] = useState<SerieTheme | null>(null);
  const [etatThemes, setEtatThemes] = useState<EtatSeriesThemes>(() => nettoyerSeries(readLocal<unknown>(SERIES_THEMES_KEY, null)));
  const [recordTheme, setRecordTheme] = useState(false);
  const [statsTick, setStatsTick] = useState(0);
  // #369 : essais du Go du jour d'aujourd'hui notés par le serveur, dans l'ordre (un envoi après l'autre), pour le
  // classement entre amis. `envoiDuJour` : la réussite envoyée ; « Tes amis aujourd'hui » se lit après elle.
  const fileEnvois = useRef<Promise<unknown>>(Promise.resolve());
  const [envoiDuJour, setEnvoiDuJour] = useState<Promise<unknown> | null>(null);
  const noterDuJour = (resultat: ResultatEssai) => {
    const base = db;
    if (!base || !userId || !online) return null;
    const p = fileEnvois.current.then(() => noterGoDuJour(base, numero, resultat), () => noterGoDuJour(base, numero, resultat));
    fileEnvois.current = p;
    return p;
  };
  // Onglet actif touché (R4) : retour à la liste, sans remonter l'écran (le lien partagé rouvrirait le Go du jour).
  const racineVue = useRef(racine);
  useEffect(() => {
    if (racineVue.current === racine) return;
    racineVue.current = racine;
    setOpenId(null); setTous(false); setCourse(false); setParTheme(false); setSerieTheme(null); setMaitriseVenue(null);
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
  // Problèmes déjà réussis ou vus avec la réponse (#251) : « Problème suivant » et les séries ne les reproposent pas.
  const aReviser = useMemo(() => new Set([...solved, ...Object.keys(vus)]), [solved, vus]);

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
  // #471 : le prochain problème d'une série, à ta mesure, comme « Continuer » (le Go du jour n'y entre pas).
  const deSerie = (serie: SerieTheme, eviter: string | undefined) =>
    prochainDeSerie(list, serie, cote, { reussis: aReviser, goDuJour: daily?.id, jour: numero, eviter, alea: () => tirage });
  const series = useMemo(() => seriesDisponibles(list, daily?.id), [list, daily?.id]);
  // #549 : maîtrise de chaque série (problèmes réussis sans voir la réponse), et la série maîtrisée à l'instant.
  const maitrise = useMemo(() => maitrises(list, series, solved, daily?.id), [list, series, solved, daily?.id]);
  const [maitriseVenue, setMaitriseVenue] = useState<SerieTheme | null>(null);
  const ouvrirSerie = (serie: SerieTheme) => {
    if (essai) { essai(); return; }
    const premier = deSerie(serie, dernierRef.current);
    if (!premier) return;
    track(EVENTS.themeOuvert, { theme: serie });
    setSerieTheme(serie); setRecordTheme(false); setMaitriseVenue(null); setOpenId(premier.id); window.scrollTo({ top: 0 });
  };
  const noterTheme = (serie: SerieTheme, ok: boolean) => {
    const r = noterSerie(etatThemes, serie, ok);
    setEtatThemes(r.etat); writeLocal(SERIES_THEMES_KEY, r.etat);
    setRecordTheme(r.nouveauRecord || (ok && recordTheme));
  };
  const open = list.find(p => p.id === openId) ?? (daily && openId === daily.id ? daily : pzArchive && openId === pzArchive.id ? pzArchive : undefined);
  const duJourOuvert = !!open && (open.id === daily?.id || archive !== null);
  // #592 : pendant un problème, la difficulté se tait (elle a servi à le choisir), sauf quand elle change d'un problème
  // au suivant (« Moyen » après des « Facile », #284) : un repère de progrès au moment où il arrive (DESIGN.md, E7).
  const chaineRef = useRef<{ id: string; avant: number | null } | null>(null);
  if (!open) chaineRef.current = null;
  else if (chaineRef.current?.id !== open.id) {
    const prec = chaineRef.current ? list.find(p => p.id === chaineRef.current!.id) : undefined;
    chaineRef.current = { id: open.id, avant: prec ? niveau(prec.difficulty).crans : null };
  }
  const avant = chaineRef.current?.avant ?? null;
  const difficulteChange = !!open && avant !== null && avant !== niveau(open.difficulty).crans;
  // Un problème ouvert hors Go du jour devient la référence du prochain choix (jamais deux fois de suite, pas de saut).
  useEffect(() => {
    if (open && !duJourOuvert) majCote(c => ouvrir(c, open));
  }, [open, duJourOuvert, majCote]);
  useEffect(() => {
    onDuJour?.(duJourOuvert);
  }, [duJourOuvert, onDuJour]);
  useEffect(() => () => onDuJour?.(false), [onDuJour]);
  // #646 (A5, A6) : un problème ou la course prennent tout l'écran. À leur sortie, la liste revient là où on l'avait
  // laissée : même défilement, focus sur ce qui les a ouverts (retrouvé par son texte, la liste ayant été remontée).
  const actif = !!open || course;
  const vue = useRef({ y: 0, f: '', actif: false });
  if (actif && !vue.current.actif) vue.current = { ...vue.current, f: document.activeElement?.textContent ?? '', actif: true };
  useLayoutEffect(() => {
    if (actif) return;
    const f = () => { vue.current.y = window.scrollY; };
    window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, [actif]);
  useLayoutEffect(() => {
    onActivite?.(actif);
    const v = vue.current;
    if (actif || !v.actif) return;
    v.actif = false;
    window.scrollTo(0, v.y);
    const b = [...document.querySelectorAll<HTMLElement>('.problemes button')].find(x => v.f && x.textContent === v.f) ?? document.querySelector<HTMLElement>('.problemes h2');
    if (b?.tagName === 'H2') b.tabIndex = -1;
    b?.focus({ preventScroll: true });
  }, [actif, onActivite]);
  useEffect(() => () => onActivite?.(false), [onActivite]);

  if (open) {
    // Go du jour d'un autre jour (lien partagé ancien) : ni série ni XP du jour ; ensuite, celui d'aujourd'hui.
    const enArchive = archive !== null && open.id === pzArchive?.id;
    // #284 : le suivant est choisi à ta mesure ; tout réussi, la série infinie de #147 prend le relais.
    // #471 : dans une série par thème, le suivant reste dans la série.
    const enSerie = !enArchive && serieTheme !== null && open.id !== daily?.id ? serieTheme : null;
    const nextPz = enArchive && daily && !goDuJourFaitAppareil(numero) ? daily
      : enSerie ? deSerie(enSerie, open.id)
      : aMesure(open.id) ?? aSuivre(tiers, open, solved);
    const estDuJour = !enArchive && open.id === daily?.id;
    // Seul le premier essai d'un problème jamais réussi ni vu compte pour la cote ; ni le Go du jour ni un lien partagé.
    const note = !estDuJour && !enArchive && !solved.has(open.id) && !vus[open.id];
    // #549 : la série vient d'être maîtrisée : « Thème suivant » devient l'action principale, la série continue en lien.
    const versTheme = enSerie && maitriseVenue === enSerie ? themeSuivant(enSerie, series, maitrise) : null;
    return (
      <PuzzlePlayer key={`${open.id}${enArchive ? '-archive' : ''}`} retour={retour} puzzle={open} rang={ordre.indexOf(open) + 1} confirmTouch={confirmTouch} difficulte={difficulteChange}
        surtitre={enSerie ? <SurtitreTheme serie={enSerie} affilee={etatThemes[enSerie]?.affilee ?? 0} record={recordTheme} /> : undefined}
        // #521 : un record de série par thème est un moment fort : invitation discrète à partager l'app (règle et plafond :
        // src/app/partageApp.ts).
        annonce={versTheme && enSerie
          ? <p className="theme-maitrise-fete" role="status"><SceauLecon id="p1" taille={22} />{fr(tr('themes.maitriseFete', { theme: tr(`themes.nom.${enSerie}`) }))}</p>
          : undefined}
        invitation={versTheme && enSerie ? <>
          {nextPz && <button type="button" className="lien theme-continuer" onClick={() => { setMaitriseVenue(null); setOpenId(nextPz.id); window.scrollTo({ top: 0 }); }}>
            {tr('themes.continuer', { theme: tr(`themes.nom.${enSerie}`) })}</button>}
        </> : enSerie && recordTheme ? <InviterApp depuis="record" /> : undefined}
        suivant={versTheme ? tr('themes.suivant', { theme: tr(`themes.nom.${versTheme}`) }) : undefined}
        signaler={db && userId ? <LienSignalerProbleme db={db} probleme={open.id} onCompte={onCompte} /> : undefined}
        duJour={enArchive ? { numero: archive, serie: 0, defiChange: false, archive: numero, gelGagne: false, celebrer, jalon: null, apprendre: onApprendre }
          : estDuJour ? { numero, serie: serieVivante(serieDuJour, numero), defiChange, gelGagne, celebrer, jalon, apprendre: onApprendre,
            amis: db && userId && envoiDuJour ? <AmisDuJour db={db} numero={numero} apres={envoiDuJour} /> : null } : undefined}
        onEssai={estDuJour ? ok => { if (!ok) noterDuJour('rate'); } : undefined}
        rated={!!db && !!userId && online && !!stats && !stats.attempted.includes(open.id) && !solved.has(open.id)}
        onPremierEssai={ok => {
          // #469 : raté au premier essai, il entre dans la révision espacée (« Révisions du jour », J+1).
          if (!ok && !enArchive) noterProblemeRate(open.id);
          // #471 : premier essai dans une série par thème, réussi ou non : réussites d'affilée et record.
          if (enSerie) noterTheme(enSerie, ok);
          if (!note) return;
          // Mesure de « Continuer » (#284) : réussite au premier essai par tranche de cote. Cote avant l'essai, jamais affichée.
          track(EVENTS.problemeTermine, { probleme: open.id, cote_joueur: Math.round(cote.cote), cote_probleme: open.difficulty, premier_essai_reussi: ok, ...(enSerie ? { theme: enSerie } : {}) });
          majCote(c => noter(c, open, ok ? 'premier' : 'rate', numero));
        }}
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
          // #369 : la réussite du jour part au serveur (classement entre amis), puis la liste des amis se lit.
          if (estDuJour) { const p = noterDuJour(gain.statut === 'vu' ? 'vu' : 'reussi'); if (p) setEnvoiDuJour(p); }
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
            track(EVENTS.goDuJourResolu, { numero, essais, serie: s?.jours ?? 1, arrivee_par_lien: lien !== null, vu: gain.statut === 'vu', apres_rappel: rappelAmi });
          }
          // #549 : la réussite fait-elle passer sa série à « maîtrisé » ? Une fois par série (les réussites ne se perdent pas).
          const sa = gain.palier && !enArchive ? serieDe(open) : undefined;
          if (sa && series.includes(sa) && vientDeMaitriser(list, sa, solved, open.id, daily?.id)) {
            track(EVENTS.themeMaitrise, { theme: sa });
            if (sa === enSerie) setMaitriseVenue(sa);
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
        onErreurComprise={but => track(EVENTS.erreurComprise, { probleme: open.id, but, du_jour: estDuJour })}
        onSolutionComplete={(coups, apresEchec) => track(EVENTS.solutionComplete, { probleme: open.id, coups, apres_echec: apresEchec })}
        onNext={versTheme && enSerie ? () => {
          track(EVENTS.themeSuivant, { de: enSerie, vers: versTheme });
          ouvrirSerie(versTheme);
        } : nextPz ? () => { if (essai && nextPz.id !== daily?.id) { essai(); return; } setArchive(null); setOpenId(nextPz.id); window.scrollTo({ top: 0 }); } : undefined}
        onExit={() => { setArchive(null); setOpenId(null); setSerieTheme(null); setMaitriseVenue(null); }} />
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
  // #620 (V1) : une seule carte d'action en tête, le Go du jour tant qu'il n'est pas fait, le problème suivant ensuite.
  // La série est une pastille discrète dans l'en-tête de cette carte (F-e).
  const pastille = serieVisible && serie > 0 ? <PastilleSerie jours={serie} fait={duJourReussi} /> : null;
  const glacon = <Glacon gels={stats ? stats.freezes : gels} />;
  const ouvrirSuivant = () => { if (prochainPz) ouvrirProbleme(prochainPz.id); };
  // #653 (A13, A6) : un détail se ferme sur le sommaire, le focus revient à l'entrée qui l'a ouvert.
  const revenir = (cle: string) => requestAnimationFrame(() => document.querySelector<HTMLElement>(`.problemes [data-entree="${cle}"]`)?.focus({ preventScroll: true }));
  const ouvrirCourse = () => { if (essai) { essai(); return; } setCourse(true); window.scrollTo({ top: 0 }); };
  const numeroDuJourVu = <span className="numero-du-jour">{tr('pb.numero', { numero })}</span>;

  // #653 : détail « Par thème » : les séries par thème (#471), puis « Tous les problèmes » (#196).
  if (parTheme) {
    return (
      <div className="problemes problemes-par-theme">
        <EnteteEcran titre={tr('themes.titre')} retour={tr('pb.retour')} onRetour={() => { setParTheme(false); window.scrollTo({ top: 0 }); revenir('theme'); }} />
        {notices}
        <VignettesThemes series={series} etat={etatThemes} onOuvrir={ouvrirSerie} maitrise={maitrise} />
        <button className="lien lien-tous" onClick={() => { if (essai) { essai(); return; } setTous(true); window.scrollTo({ top: 0 }); }}>
          {tr('pb.tous')}
        </button>
      </div>
    );
  }

  const nErreurs = erreurs?.n ?? 0;
  // Record de la course (#287), relu à chaque retour au sommaire : une course vient peut-être de le battre.
  const meilleurCourse = lireMeilleurCourse();
  const entrees: EntreeSommaire[] = [
    ...(daily ? [{
      cle: 'du-jour', nom: tr('accueil.goDuJour'), visuel: <MiniGoban rows={daily.rows} />, testId: 'entree-du-jour',
      etat: duJourReussi ? { texte: tr(vus[daily.id] && !solved.has(daily.id) ? 'pb.tamponVu' : 'pb.tampon') } : { texte: tr('accueil.aFaire'), ton: 'or' as const },
      onOuvrir: () => setOpenId(daily.id),
    }] : []),
    ...(erreurs ? [{
      cle: 'erreurs', nom: tr('erreurs.titre'), visuel: <MiniGoban rows={MOTIF_ERREUR} />, testId: 'entree-erreurs',
      // P1 : aucun zéro affiché ; le nombre d'erreurs dues aujourd'hui, en or (elles attendent le joueur).
      etat: nErreurs > 0 ? { texte: String(nErreurs), ton: 'or' as const, aria: tr('erreurs.compteurAria', { n: nErreurs }) } : undefined,
      onOuvrir: () => { if (essai) { essai(); return; } erreurs.ouvrir(); },
    }] : []),
    {
      cle: 'course', nom: tr('pb.sommaire.course'), visuel: <ChronoCourse taille={32} />, testId: 'entree-course',
      etat: meilleurCourse > 0 ? { texte: tr('pb.sommaire.record', { n: meilleurCourse }), aria: tr('course.carte.meilleur', { meilleur: meilleurCourse }) } : undefined,
      onOuvrir: ouvrirCourse,
    },
    {
      cle: 'theme', nom: tr('themes.titre'), visuel: <MiniGoban rows={MOTIF_THEMES} />, testId: 'entree-par-theme',
      onOuvrir: () => { setParTheme(true); window.scrollTo({ top: 0 }); },
    },
  ];

  return (
    <div className="problemes">
      {notices}

      {daily && !duJourFait ? (
        <section aria-labelledby="jour-titre">
          <div className="jour-tete">
            <h2 id="jour-titre" className="titre-pierres">{tr('accueil.goDuJour')} {numeroDuJourVu}{glacon}</h2>
            {pastille}
          </div>
          <DuJour pz={daily} onOpen={() => setOpenId(daily.id)} />
        </section>
      ) : prochainPz && (
        <section aria-labelledby="paliers-titre">
          <div className="jour-tete">
            <h2 id="paliers-titre" className="titre-pierres">{tr('pb.entrainement')}</h2>
            {daily && glacon}{daily && pastille}
          </div>
          <CarteSuivant pz={prochainPz} palier={enCours} onOpen={ouvrirSuivant} />
        </section>
      )}

      {/* #653 : quatre entrées de même poids, à plat ; le seul relief reste la carte du dessus. */}
      <Sommaire entrees={entrees} nom={tr('pb.sommaire.nom')} className="problemes-sommaire" testId="problemes-sommaire" />

      {/* Aucune cote affichée (décision de Florian, #137) : la cote problèmes existe sur le serveur, invisible. */}
      {connecte && statsError ? (
        <p className="notice" role="alert">{statsError} <button className="lien" onClick={() => setRetry(n => n + 1)}>{tr('pb.reessayer')}</button></p>
      ) : !connecte ? (
        <div className="invitation">
          {/* Sans compte, la série de l'appareil a sa pastille près du Go du jour (#161, #620) ; ici, l'invitation seule. */}
          {serie > 0 && inviterCompte(false, serie)
            ? <p>{fr(tr('serie.invitation'))}</p>
            : <p>{fr(tr('pb.invitation.avant'))}<b>{tr('pb.invitation.mot')}</b>{fr(tr(serie > 0 ? 'pb.invitationCourte.apres' : 'pb.invitation.apres'))}</p>}
          {/* Recette du 02/10 au soir (L8) : depuis #343, partout « Crée ton compte ». */}
          {onCompte && <button className="lien" onClick={onCompte}>{tr('pb.creerCompte')}</button>}
        </div>
      ) : null}
    </div>
  );
}

/** #653 : visuels des entrées « Rejouer tes erreurs » (ta pierre, marquée, prise dans un filet) et « Par thème ». */
const MOTIF_ERREUR = ['.....', '..O..', '.OSO.', '.....', '.....'];
const MOTIF_THEMES = ['.....', '.X...', '..TX.', '.X...', '.....'];

/** Série de jours (#620) : pastille or près du Go du jour ; flamme creuse tant qu'il reste à faire, pleine après (#213). */
function PastilleSerie({ jours, fait }: { jours: number; fait: boolean }) {
  return (
    <span className={`serie ${fait ? 'pleine' : 'creuse'}`} role="img" data-testid="serie-problemes"
      aria-label={tr(fait ? 'entete.flammeFaite' : 'entete.flammeAFaire', { jours: tr('profil.jours', { n: jours }) })}>
      <Flamme taille={16} />{jours}
    </span>
  );
}

/**
 * Carte « Problème suivant », action principale une fois le Go du jour fait (#103, #620) : le prochain problème, voilé
 * (on devine la position sans la lire) ; à côté, le palier, ses réussites et la difficulté ; dessous, le bouton en relief.
 * #268 (WCAG 2.5.3) : pas d'aria-label ; le nom accessible du bouton est son texte visible, verbe d'abord.
 */
function CarteSuivant({ pz, palier, onOpen }: { pz: Puzzle; palier: ReturnType<typeof palierEnCours>; onOpen: () => void }) {
  return (
    <div className={`palier-en-cours${palier?.complet ? ' complet' : ''}`} data-palier-en-cours={palier?.id} data-reussis={palier?.reussis}>
      <div className="continuer-carte">
        <span className="continuer-goban" aria-hidden="true" onClick={onOpen}><MiniGoban rows={pz.rows} /></span>
        <div className="continuer-corps">
          {/* #592 : le nom du palier seul ; son rang en kyu se lit dans « Tous les problèmes ». */}
          {palier && <h3 className="palier-nom">{tr(`palier.${palier.id}.nom`)}
            {palier.complet && <span className="palier-sceau" role="img" aria-label={tr('pb.palierComplet')}><SceauLecon id={`p${palier.rang}`} taille={28} /></span>}</h3>}
          {palier && palier.reussis > 0 && <p className="palier-compte">{tr('pb.reussis', { n: palier.reussis })}</p>}
          <p className="continuer-infos"><Difficulte d={pz.difficulty} /></p>
        </div>
        <button type="button" className="cta continuer" onClick={onOpen}>
          {tr('pb.continuer')} <span className="continuer-titre">{pz.title}</span>
        </button>
      </div>
    </div>
  );
}

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


function Cadenas() {
  return (
    <svg className="cadenas" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <rect x="3" y="7" width="10" height="7.5" rx="2" fill="currentColor" />
      <path d="M5.2 7V5.2a2.8 2.8 0 0 1 5.6 0V7" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

/** Problème du jour, à faire : la vraie position sur le goban, recadrée sur les pierres, et « Résoudre » en relief.
 * Une fois fait, il devient une tuile (TuileDuJour, #620). */
function DuJour({ pz, onOpen }: { pz: Puzzle; onOpen: () => void }) {
  const start = useMemo(() => startOf(pz), [pz]);
  const vb = viewBoxOf(pz.size);
  // Hauteur du centre des pierres, en fraction de la largeur de l'image du goban (qui est carrée).
  const f = (M + centreVertical(pz.rows) * C - vb.min) / vb.span;
  return (
    <div className="du-jour">
      <div className="du-jour-plateau" aria-hidden="true" onClick={onOpen} style={{ '--f': f } as CSSProperties}>
        <div className="du-jour-cadre"><Board size={pz.size} board={start.pos.board} marks={{ targets: start.marked }} /></div>
      </div>
      <div className="du-jour-corps">
        <h3>{pz.title}</h3>
        <p><Difficulte d={pz.difficulty} /></p>
        <button className="cta" aria-label={tr('pb.resoudreAria')} onClick={onOpen}>{tr('pb.resoudre')}</button>
      </div>
    </div>
  );
}

/** `comprise` (#549) : la réponse prouvée de l'adversaire à ce coup faux, et sa phrase de faits. */
type Answer = { kind: 'ok' | 'wrong' | 'illegal'; p: number; text: string; n: number; comprise?: ErreurComprise | null };

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
  /** #369 : « Tes amis aujourd'hui », sous les actions de la réussite (absent sans compte). */
  amis?: ReactNode;
}

/** Une position de « Voir la suite » ou de la solution complète, avec sa légende. */
type Cadre = { pos: Position; legende: string; croix?: number; zone?: number[] };

/** Temps pendant lequel la réponse de l'adversaire reste sur le plateau après une erreur (#237, N6). */
const DUREE_ERREUR = 2200;

export function PuzzlePlayer({ puzzle, rang, duJour, confirmTouch, rated, onPremierEssai, onEssai, onAttempt, onSolved, onNext, onExit, onSolutionVue, onErreurComprise, onSolutionComplete, retour, surtitre, suivant, exercice = true, signaler, invitation, annonce, difficulte = true, passerApresReponse = false }: {
  puzzle: Puzzle; rang: number; duJour?: DuJourInfo; confirmTouch: boolean; rated: boolean;
  /** Chaque essai joué (coup légal), réussi ou non (#369 : essais du Go du jour comptés par le serveur). */
  onEssai?: (ok: boolean) => void;
  /** Premier essai joué (#284) : réussi ou non. Sert à la cote de « Continuer », jamais affichée. */
  onPremierEssai?: (ok: boolean) => void;
  onAttempt: (ok: boolean) => Promise<{ ok: true; value: number } | { ok: false; error: string } | null>;
  onSolved: (essais: number, aide: NiveauAide) => void; onNext?: () => void; onExit: () => void;
  /** La réponse vient d'être montrée (#197). */
  onSolutionVue?: (essais: number) => void;
  /** #549 : un coup faux a reçu sa réponse prouvée par le lecteur exact. */
  onErreurComprise?: (but: ErreurComprise['but']) => void;
  /** #549 : la solution complète s'ouvre (`coups` : bon coup et défenses compris). */
  onSolutionComplete?: (coups: number, apresEchec: boolean) => void;
  /** Série de fin de leçon (#200) : libellé du retour (« Retour à Apprendre ») et surtitre (« Entraînement » et ses points). */
  retour?: string; surtitre?: ReactNode;
  /** #469 : libellé du bouton qui mène à la suite (« Révision suivante », « Voir mon bilan ») ; « Problème suivant » sinon. */
  suivant?: string;
  /** Faux quand l'exercice est fini alors que le lecteur reste affiché (dernier problème d'une série, #250 M9). */
  exercice?: boolean;
  /** #363 : « Cette réponse me semble fausse », montré après un premier essai (ou la suite revue). */
  signaler?: ReactNode;
  /** #521 : invitation discrète à partager l'app, sous la réussite (nouveau record d'une série par thème). */
  invitation?: ReactNode;
  /** #549 : annonce d'un moment fort (thème maîtrisé), juste au-dessus de l'action principale de la réussite. */
  annonce?: ReactNode;
  /** #592 : difficulté dans l'en-tête (vrai par défaut ; l'onglet Problèmes ne la montre que quand elle change). */
  difficulte?: boolean;
  /**
   * #683 : série d'entraînement. La réponse montrée, la feuille garde l'action vers la suite (« Problème suivant », ou le
   * retour au dernier problème) : la série ne s'arrête pas sur « Revoir la suite ». Le plateau reste rejouable.
   */
  passerApresReponse?: boolean;
}) {
  // #236 (N2) : un problème est un exercice ; aucune fête ne se pose sur sa consigne (l'XP se lit dans la feuille).
  useExercice(exercice);
  const titre = useTitreFocus();
  // #365 : « Montrer la série » éteint, pas de série sur la réussite du Go du jour ni dans le partage.
  const { serieVisible } = usePreferences();
  const start = useMemo(() => startOf(puzzle), [puzzle]);
  // « Voir la suite » : la suite du problème ; pour une erreur de partie (#492), la suite qui illustre le pourquoi.
  const cadres = useMemo<Cadre[]>(() => puzzle.pourquoi?.cadres() ?? solutionFrames(puzzle).map(pos => ({ pos, legende: '' })), [puzzle]);
  // Aide graduée (#197) : indice, puis réfutation, puis réponse.
  const [aide, setAide] = useState<NiveauAide>(0);
  const [refut, setRefut] = useState<{ r: Refutation; vue: boolean } | null>(null);
  // #237 (N6) : après une erreur, l'adversaire répond au coup faux, puis la position revient d'elle-même (ou au toucher).
  const [apercu, setApercu] = useState<{ faux: number; reponse: number | null; vue: boolean } | null>(null);
  const dernierFaux = useRef<number | null>(null);
  // #549 : réponse prouvée au dernier coup faux (lecteur exact), réutilisée par « Voir pourquoi ».
  const derniereErreur = useRef<ErreurComprise | null>(null);
  // #549 : solution complète (le bon coup, la défense principale… jusqu'à la prise), calculée au premier besoin.
  const solution = useRef<Cadre[] | null | undefined>(undefined);
  const [suite, setSuite] = useState<Cadre[] | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [board, setBoard] = useState(start.pos.board);
  const [tries, setTries] = useState(0);
  // `pas` : solution complète, coup par coup, au rythme du joueur (#549) ; sinon, la suite se joue seule.
  const [replay, setReplay] = useState<{ frame: number; total: number; pas?: boolean } | null>(null);
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
    onEssai?.(ok);
    if (!ok) dernierFaux.current = p;
    // #549 : la réponse de l'adversaire est prouvée par le lecteur exact, et sa phrase ne dit que des faits.
    const comprise = ok ? null : comprendreErreur(puzzle, p);
    if (!ok) derniereErreur.current = comprise;
    if (comprise) onErreurComprise?.(comprise.but);
    setAnswer({ kind: r.kind, p, text: ok ? (puzzle.pourquoi?.bravos[p] ?? puzzle.explanation ?? tr('pb.bonCoup')) : (puzzle.refutation ?? tr('pb.pasTout')), n, comprise });
    window.clearTimeout(timer.current);
    if (ok) { setApercu(null); setBoard(r.after.board); onSolved(tries + 1, aide); }
    else montrerErreur(p, r.after.board, comprise);
    // Seul le premier essai compte pour la cote, qui n'est jamais affichée (décision #137) : ni valeur ni message.
    if (firstTry.current) onPremierEssai?.(ok);
    if (firstTry.current && rated) {
      firstTry.current = false;
      await onAttempt(ok);
    }
    firstTry.current = false;
  }

  function showLine() {
    window.clearTimeout(timer.current);
    // #549 : la solution complète, coup par coup, quand le lecteur exact la prouve (problèmes de prise).
    if (!puzzle.pourquoi && solution.current === undefined) solution.current = solutionComplete(puzzle);
    const complete = puzzle.pourquoi ? null : solution.current ?? null;
    if (complete) {
      setSuite(complete); setApercu(null);
      setBoard(complete[1].pos.board);
      setReplay({ frame: 1, total: complete.length - 1, pas: true });
      onSolutionComplete?.(complete.length - 1, !solvedNow);
      return;
    }
    setSuite(null);
    const frames = cadres.map(c => c.pos);
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
      // Suite expliquée (#492) : une légende par position, le temps de la lire.
      if (i < frames.length - 1) timer.current = window.setTimeout(stepOnce, puzzle.pourquoi ? 1600 : 800);
    };
    timer.current = window.setTimeout(stepOnce, 500);
  }
  /**
   * Erreur (#237, N6) : le coup faux reste posé, l'adversaire y répond au point clé, puis la position de départ revient
   * d'elle-même. Mouvements réduits : la réponse est posée d'un coup et le retour est instantané, sans animation.
   */
  function montrerErreur(faux: number, apresFaux: Int8Array, comprise: ErreurComprise | null) {
    // #549 : problème de prise ou de sauvetage, la réponse vient du lecteur exact ; sans réponse prouvée, le coup faux
    // reste seul. Les autres problèmes gardent la réponse au point clé (#237).
    const r = comprise ?? (butDe(puzzle) ? null : refutation(puzzle, faux));
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
    setApercu(null); setReplay(null); setSuite(null); setRefut(null); setBoard(start.pos.board); setAnswer(null);
  }
  /** Solution complète (#549) : un coup en avant ou en arrière. */
  function allerA(frame: number) {
    if (!replay || !suite) return;
    const f = Math.max(1, Math.min(replay.total, frame));
    setBoard(suite[f].pos.board);
    setReplay({ ...replay, frame: f });
    if (f > replay.frame && !prefersReducedMotion()) { const m = suite[f].pos.lastMove; if (m != null && m >= 0) playStone(m, puzzle.size); }
  }

  /** Marche suivante de l'aide : l'indice entoure la zone, la réfutation joue la réponse de l'adversaire, puis la réponse. */
  function demanderAide() {
    const suite = aideSuivante(aide);
    if (suite === null) return;
    window.clearTimeout(timer.current);
    setApercu(null);
    const r = suite === 2 && dernierFaux.current !== null
      ? derniereErreur.current ?? (butDe(puzzle) ? null : refutation(puzzle, dernierFaux.current)) : null;
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

  const cadre = replay ? (suite ?? cadres)[replay.frame] : null;
  const lastMove = cadre ? cadre.pos.lastMove : solvedNow ? answer.p : null;
  const replayDone = !!replay && (!!replay.pas || replay.frame === replay.total);

  const suivantBtn = <button className="cta" onClick={onNext ?? onExit}>{onNext ? suivant ?? tr('pb.suivant') : retour ?? tr('pb.retour')}</button>;
  // #285 : arrivé par un lien sans avoir jamais joué, une seule action après le problème, vers la leçon 1.
  const apprendreBtn = duJour?.apprendre ? <button className="cta vers-lecon-1" onClick={duJour.apprendre}>{tr('arrivee.apprendre')}</button> : null;
  // « Partager » reste l'action secondaire, à plat : l'ami peut renvoyer le défi à son tour.
  const versLecon1 = apprendreBtn && duJour && <>
    {apprendreBtn}
    <Partager numero={duJour.numero} essais={tries} serie={serieVisible ? duJour.serie : 0} />
    <div className="row liens-du-jour"><button className="lien" onClick={showLine}>{tr('pb.voirSuite')}</button></div>
  </>;

  let verdict = null;
  if (replay?.pas && cadre) {
    // #549 : solution complète, coup par coup. Chaque légende est un fait lu sur le plateau (comprendreErreur.ts).
    const fin = replay.frame === replay.total;
    verdict = (
      <Verdict ton="neutre" cle={`pas-${replay.frame}`} actions={<>
        <div className="solution-pas" role="group" aria-label={tr('solution.titre')}>
          <button type="button" className="btn solution-precedent" onClick={() => allerA(replay.frame - 1)} disabled={replay.frame <= 1}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="m15 5-7 7 7 7" /></svg>
            {tr('solution.precedent')}
          </button>
          <button type="button" className={fin ? 'btn solution-suivant' : 'cta solution-suivant'} onClick={() => allerA(replay.frame + 1)} disabled={fin}>
            {tr('solution.suivant')}
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="m9 5 7 7-7 7" /></svg>
          </button>
        </div>
        {fin && (solvedNow || passerApresReponse) && (apprendreBtn ?? suivantBtn)}
      </>}>
        <p className="solution-etape">{tr('solution.etape', { n: replay.frame, total: replay.total })}</p>
        <p data-solution-legende="">{fr(cadre.legende)}</p>
        {fin && !solvedNow && <p className="muted small" data-pourquoi-probleme="">{fr(texteReponseVue(puzzle))}</p>}
        {fin && !solvedNow && <p className="muted small rejoue-plateau">{fr(tr('pb.rejouePlateau'))}</p>}
      </Verdict>
    );
  } else if (replay) {
    verdict = (
      // #492 : la feuille se remesure à la fin de la suite (l'explication est plus longue que « Coup 1 sur 4 »).
      <Verdict ton="neutre" cle={replayDone ? 'fin' : 'suite'} actions={solvedNow || (passerApresReponse && replayDone)
        ? <>{apprendreBtn ?? suivantBtn}<button className="lien" onClick={showLine} disabled={!replayDone}>{tr('pb.revoirSuite')}</button></>
        : <button className="lien" onClick={showLine} disabled={!replayDone}>{tr('pb.revoirSuite')}</button>}>
        {replayDone && puzzle.pourquoi ? <>
          {/* #492 : pourquoi la réponse est la bonne, vérifié par le calcul ; la croix marque le coup joué dans la partie. */}
          <p data-pourquoi="">{fr(puzzle.pourquoi.texte)}</p>
          {puzzle.pourquoi.ecart && <p className="muted small" data-ecart="">{fr(puzzle.pourquoi.ecart)}</p>}
          {cadre?.croix != null && <p className="muted small pourquoi-croix"><span aria-hidden="true" className="pourquoi-croix-signe">×</span>{fr(tr('pq.croix'))}</p>}
          {cadre?.zone?.length ? <p className="muted small" data-zone="">{fr(tr('pq.zoneCarres'))}</p> : null}
        </> : replayDone && !solvedNow
          // #497 : réponse montrée d'un problème classique : pourquoi c'est la réponse (texte de solution, ou fait calculé).
          ? <>
              <p data-pourquoi-probleme="">{fr(texteReponseVue(puzzle))}</p>
              {passerApresReponse && <p className="muted small rejoue-plateau">{fr(tr('pb.rejouePlateau'))}</p>}
            </>
          : <p>{replayDone ? tr('pb.suiteFinie') : cadre?.legende ? fr(cadre.legende) : tr('pb.suiteCoup', { n: replay.frame, total: replay.total })}</p>}
      </Verdict>
    );
  } else if (refut) {
    // Réfutation (#197) : l'adversaire répond au coup faux, au point clé.
    // #549 : réponse prouvée, sa phrase d'abord (des faits), puis le texte relu du problème. Le « point clé » n'est dit
    // que si la réponse prouvée est bien une des bonnes réponses.
    const prouvee = derniereErreur.current && derniereErreur.current.reponse === refut.r.reponse ? derniereErreur.current : null;
    const cle = refut.r.reponse !== null && (!butDe(puzzle) || (prouvee && puzzle.answers.includes(prouvee.reponse)));
    const texte = puzzle.refutation ?? (refut.r.reponse === null ? tr('pb.aide.refutationSeule') : cle ? tr(puzzle.toPlay === 1 ? 'pb.aide.refutation.1' : 'pb.aide.refutation.2') : null);
    verdict = (
      <Verdict ton="neutre" actions={boutonAide}>
        {(!refut.vue || texte) && <p data-refutation="">{refut.vue ? fr(texte!) : tr('pb.aide.regarde')}</p>}
        {refut.vue && prouvee && <p className="erreur-comprise" data-erreur-comprise="">{fr(prouvee.phrase)}</p>}
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
      <Verdict ton="neutre" actions={<>{apprendreBtn ?? suivantBtn}<button className="lien" onClick={showLine}>{tr('pb.voirSuite')}</button>{duJour?.amis}</>}>
        <p data-vu="">{fr(tr('pb.vuTexte'))}</p>
        {duJour && serieVisible && <p className="verdict-cote">{fr(tr('pb.vuSerie'))}</p>}
      </Verdict>
    ) : solvedNow ? (
      <Verdict ton="juste" cle={answer.n} actions={versLecon1 ?? (duJour
        // Go du jour réussi (#75) : continuer est l'action principale ; « Partager » est l'action secondaire, juste dessous.
        ? <>
            {duJour.archive !== undefined && onNext
              ? <button className="cta" onClick={onNext}>{tr('pb.duJourAujourdhui', { numero: duJour.archive })}</button>
              : suivantBtn}
            <Partager numero={duJour.numero} essais={tries} serie={serieVisible ? duJour.serie : 0} />
            {duJour.gelGagne && (
              <p className={`gel-gagne${duJour.celebrer ? ' fete' : ''}`} role="status"><PierreGivree taille={18} />{fr(tr('pb.gelGagne'))}</p>
            )}
            <div className="row liens-du-jour">
              <button className="lien" onClick={showLine}>{tr('pb.voirSuite')}</button>
            </div>
            {duJour.amis}
          </>
        : <>{annonce}{suivantBtn}<button className="lien" onClick={showLine}>{tr('pb.voirSuite')}</button>{invitation}</>)}>
        <p>{fr(answer.text)}</p><XpEnLigne anime={duJour?.celebrer ?? true} />
        {/* #214 : la série se lit sur la réussite (« 3 jours de série · À demain ») ; aux jalons 3, 7, 30, une petite fête. */}
        {duJour && duJour.archive === undefined && serieVisible && <SerieDuJour jours={duJour.serie} jalon={duJour.jalon} celebrer={duJour.celebrer} />}
      </Verdict>
    ) : (
      // Erreur (#237, N6) : pas de « Réessayer », le plateau reste jouable ; l'indice est un lien discret.
      <Verdict ton="revoir" cle={answer.n} actions={boutonAide}>
        <p>{fr(answer.text)}</p>
        {/* #549 : ce que l'adversaire vient de jouer, en faits, dès que sa pierre est sur le plateau (puis gardé). */}
        {answer.comprise && (!apercu || apercu.vue) && <p className="erreur-comprise" data-erreur-comprise="">{fr(answer.comprise.phrase)}</p>}
        {answer.kind === 'wrong' && <p className="muted small rejoue-plateau">{fr(tr('pb.rejouePlateau'))}</p>}
      </Verdict>
    );
  }

  return (
    <div className="lecteur" data-probleme={puzzle.id} data-difficulte={niveau(puzzle.difficulty).crans} data-serre={estSerre(puzzle.size) || undefined}>
      <div className="lecteur-tete">
        <Retour label={retour ?? tr('pb.retour')} onClick={onExit} />
        {/* Passe design #509 : la difficulté rejoint la ligne fine du surtitre ; le titre garde toute la largeur entre le
            retour et le « ? » (une ligne à 390 px au lieu de deux, deux au lieu de trois à 320 px). */}
        <div className="lecteur-nom">
          <div className="lecteur-surtitre">
            {duJour
              ? <small className="entete-du-jour">{tr('accueil.goDuJour')} <b className="numero-du-jour">{tr('pb.numero', { numero: duJour.numero })}</b></small>
              : <small>{surtitre ?? tr('pb.probleme', { n: rang })}</small>}
            {/* #592 : dans l'onglet Problèmes, la difficulté ne s'affiche que quand elle change d'un problème au suivant
                (data-difficulte la garde toujours pour les tests). Ailleurs (entraînement d'une leçon), inchangé. */}
            {difficulte && <Difficulte d={puzzle.difficulty} />}
          </div>
          <h2 ref={titre} tabIndex={-1}>{puzzle.title}</h2>
        </div>
        {/* #362 : « ? » ouvre les mots du go (atari, échelle, œil…) sans quitter le problème. */}
        <BoutonAide depuis="probleme" fiche="mots" />
      </div>
      {duJour?.defiChange && <p className="notice" role="status">{fr(tr('pb.defiChange'))}</p>}
      {duJour?.archive !== undefined && <p className="notice" role="status">{fr(tr('pb.archive', { numero: duJour.archive }))}</p>}
      <Board lieu="probleme" size={puzzle.size} board={board} toPlay={puzzle.toPlay} interactive={!solvedNow && (!replay || replayDone) && (!refut || refut.vue)}
        stonesTappable={!!refut || !!replay || !!apercu} onPlay={onPlay} shake={shake}
        // #400 : en 13 × 13 et plus, une touche ratée coûterait l'essai : confirmation au doigt toujours, et visée.
        confirmTouch={confirmTouch || estSerre(puzzle.size)} surFantome={estSerre(puzzle.size) ? q => <Visee p={q} size={puzzle.size} /> : undefined}
        marks={{
          targets: start.marked,
          last: refut ? (refut.vue ? refut.r.reponse : refut.r.faux) : apercu ? (apercu.vue && apercu.reponse !== null ? apercu.reponse : apercu.faux) : lastMove,
          ok: solvedNow && !replay ? answer.p : undefined,
          mistake: refut ? refut.r.faux : answer && answer.kind === 'wrong' && !replay ? answer.p : cadre?.croix,
          // Indice : zone entourée autour du bon coup, tant que le problème n'est pas résolu.
          zone: aide >= 1 && !solvedNow && !replay && !refut ? puzzle.answers[0] : undefined,
          // #497 : zone où se fait l'écart selon KataGo, en carrés de ta couleur, à la fin de « Revoir la suite ».
          owner: replayDone && cadre?.zone?.length ? carresZone(cadre.zone, puzzle.size, puzzle.toPlay) : undefined,
        }} />
      {/* Audit du 02/10 (n° 1) : la consigne sous le plateau, à la place du vide ; le verdict arrive au même endroit. */}
      <ParoleMochi humeur={solvedNow ? 'content' : answer?.kind === 'wrong' ? 'pensif' : 'neutre'}>
        {fr(`${duJour?.apprendre ? `${tr('arrivee.premierCoup')} ` : ''}${puzzle.prompt} ${tr(puzzle.toPlay === 1 ? 'pb.tuJoues.1' : 'pb.tuJoues.2')}`)}
      </ParoleMochi>
      {verdict}
      {signaler && (tries >= 1 || !!replay) && signaler}
    </div>
  );
}

/** Carrés de territoire (#497) : les intersections de la zone, dans la couleur du joueur. */
function carresZone(points: number[], size: number, couleur: 1 | 2): Int8Array {
  const o = new Int8Array(size * size);
  for (const p of points) o[p] = couleur;
  return o;
}
