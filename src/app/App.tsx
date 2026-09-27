import { useState } from 'react';
import { Game } from './Game';
import { LearnHome, LessonPlayer } from './Learn';
import { LESSONS } from '../content/lessons';
import { Puzzles } from './Puzzles';
import { readLocal, useLessonProgress, useProfil, useSerie, useSession } from './hooks';
import { supabase } from '../data/supabase';
import { useSettings, useStored } from './settings';
import { aideActive } from './partie';
import { Bubble } from '../ui/Mochi';
import { Sceau } from '../ui/Sceau';
import { OPPONENTS, type OpponentId } from '../engine';
import { ConsentModal } from './Confidentialite';
import { Profil, type VueProfil } from './Profil';
import { fenetreVisible, useConsentement } from './consentement';
import { accueil, adversaireOuvert, echelle, introBut, INTRO_KEY, PARTIES_KEY, type Parties } from './home';
import { Accueil } from './Accueil';
import { ALL_PUZZLES } from '../content/puzzles';
import { parsePuzzles, puzzleOfDay } from '../data/puzzles';
import { battu, BILAN_KEY, enregistrer, fin, komiDepuisUrl, lireBilan, type Bilan, type Issue, type StatsPartie } from './bilan';
import { fr } from '../ui/typo';
import { BarreNav, type Onglet } from '../ui/IconesNav';

const PROBLEMES_LOCAUX = parsePuzzles(ALL_PUZZLES);
/** Problèmes réussis sur ce téléphone (même clé que l'onglet Problèmes). */
const PROBLEMES_RESOLUS_KEY = 'go.problemes.v1';

/** Flamme de la série de jours, en or. */
function Flamme() {
  return (
    <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M8.6 1.2c.4 2.3 3.9 3.9 3.9 7.9A4.5 4.5 0 0 1 8 13.8a4.5 4.5 0 0 1-4.5-4.6c0-2 1-3.2 2-4 0 1.4.6 2.4 1.5 2.7C6.6 5.6 7.4 3 8.6 1.2Z" fill="currentColor" />
    </svg>
  );
}

const KOMI_ORDI = 6.5;
// Komi du comptage : 6,5, sauf paramètre de test `?komi=` (l'ordi, lui, joue toujours avec 6,5).
// `?komi=` ne sert qu'aux tests de bout en bout : il n'est lu que dans un build de test (VITE_E2E, voir playwright.config.ts).
const KOMI = import.meta.env.VITE_E2E && typeof location !== 'undefined' ? komiDepuisUrl(location.search, KOMI_ORDI) : KOMI_ORDI;

type Tab = Onglet;

export function App() {
  const [tab, setTab] = useState<Tab>('jouer');
  const [settings, set] = useSettings();
  const [playing, setPlaying] = useState<false | 'ordi' | 'deux'>(false);
  const [adversaire, setAdversaire] = useStored<OpponentId>('go.adversaire.v1', 'pomme');
  const [lessonId, setLessonId] = useState<string | null>(null);
  const session = useSession(supabase);
  const { progress, state: syncState, record } = useLessonProgress(supabase, session?.user.id);
  const done = LESSONS.filter(l => (progress[l.id] ?? 0) >= l.steps.length).length;
  const lesson = LESSONS.find(l => l.id === lessonId);
  const [parties, setParties] = useStored<Parties>(PARTIES_KEY, { n: 0 });
  const [introVue, setIntroVue] = useStored<boolean>(INTRO_KEY, false);
  const [intro, setIntro] = useState(false); // bulle « but du jeu » au-dessus du plateau
  const [reglages, setReglages] = useState(false);
  const [bilanBrut, setBilan] = useStored<Bilan>(BILAN_KEY, {});
  const bilan = lireBilan(bilanBrut);
  // Un adversaire verrouillé (choisi avant l'arrivée des verrous) laisse place à celui qu'il faut battre d'abord.
  const adv = adversaireOuvert(OPPONENTS, bilan, adversaire);
  const cartes = echelle(OPPONENTS, bilan).map(e => ({ id: e.adv.id, nom: e.adv.nom, rang: e.adv.rang, battu: e.battu, ouvert: e.ouvert, requis: e.requis?.nom }));
  const serie = useSerie(supabase, session?.user.id);
  const [resultat, setResultat] = useState<null | { issue: Issue; stats: StatsPartie }>(null); // fin de la partie en cours contre l'ordi
  const [partie, setPartie] = useState(0); // change à chaque partie pour repartir d'un plateau vide
  const home = accueil(parties, done, adv, settings.size);
  const leconConseillee = LESSONS.find(l => (progress[l.id] ?? 0) < l.steps.length);
  // Profil (issue #50) : sous-vue ouverte, et fenêtre de consentement fermée avec Échap pendant cette session.
  const [vueProfil, setVueProfil] = useState<VueProfil>('menu');
  const [accordIgnore, setAccordIgnore] = useState(false);
  const consent = useConsentement();
  const profil = useProfil(supabase);

  function lancer(mode: 'ordi' | 'deux', contre: OpponentId = adv.id) {
    // Première partie contre l'ordi : Mochi explique le but, une seule fois.
    const montrer = mode === 'ordi' && !introVue;
    setIntro(montrer);
    if (montrer) setIntroVue(true);
    if (mode === 'ordi') setAdversaire(contre);
    setParties({ n: parties.n + 1, dernier: mode === 'ordi' ? contre : parties.dernier });
    setReglages(false);
    setResultat(null);
    setPartie(partie + 1);
    setPlaying(mode);
    window.scrollTo({ top: 0 });
  }

  function onResult(winner: 0 | 1 | 2, stats: StatsPartie) {
    if (playing !== 'ordi') return;
    const issue: Issue = winner === 0 ? 'egalite' : winner === 1 ? 'victoire' : 'defaite';
    if (issue !== 'egalite') setBilan(enregistrer(bilan, adv.id, issue === 'victoire'));
    setResultat({ issue, stats });
  }

  let finEcran;
  if (playing === 'ordi' && resultat) {
    const f = fin(adv, resultat.issue, resultat.stats, bilan, OPPONENTS);
    const coupure = f.bilan.texte.indexOf('. ');
    const lecon = f.lecon ? LESSONS.find(l => l.id === f.lecon) : undefined;
    finEcran = {
      // Deux phrases, deux lignes : les statistiques, puis le bilan contre cet adversaire (issue #57).
      bilan: <>{fr(f.bilan.texte.slice(0, coupure + 1))}{coupure > 0 && <br />}{fr(f.bilan.texte.slice(coupure + 1))}<b className={resultat.issue === 'victoire' ? 'or' : undefined}>{f.bilan.gras}</b>.</>,
      mochi: (
        <>
          <p>{fr(f.mochi)}</p>
          {lecon && <button type="button" className="lien" onClick={() => { setPlaying(false); setResultat(null); setTab('apprendre'); setLessonId(lecon.id); window.scrollTo({ top: 0 }); }}>Ouvrir la leçon</button>}
        </>
      ),
      action: (
        <button type="button" className="cta" onClick={() => lancer('ordi', f.cible as OpponentId)}>
          <Sceau id={f.cible as OpponentId} taille={30} />{f.cta}
        </button>
      ),
      onAccueil: () => { setPlaying(false); setResultat(null); setIntro(false); window.scrollTo({ top: 0 }); },
    };
  }

  const go = (t: Tab) => { setTab(t); setPlaying(false); setLessonId(null); setVueProfil('menu'); window.scrollTo({ top: 0 }); };

  const enPartie = tab === 'jouer' && !!playing;
  let screen;
  if (enPartie) {
    screen = (
      <>
        <Game key={`${playing === 'ordi' ? adv.id : 'deux'}-${partie}`} size={settings.size} komi={KOMI} aiKomi={KOMI_ORDI} confirmTouch={settings.confirmTouch} opponent={playing === 'ordi' ? adv : undefined}
          intro={intro && playing === 'ordi' ? <Bubble>{introBut(adv.nom)}</Bubble> : undefined} onExit={() => { setIntro(false); setPlaying(false); setResultat(null); }}
          onResult={onResult} fin={finEcran} celebrer={settings.celebrations} aide={aideActive(settings.aide, adv.id)} portrait={playing === 'ordi' ? <Sceau id={adv.id} taille={44} /> : undefined} />
      </>
    );
  } else if (tab === 'apprendre' && lesson) {
    const leconSuivante = LESSONS[LESSONS.indexOf(lesson) + 1];
    screen = <LessonPlayer key={lesson.id} lesson={lesson} start={(progress[lesson.id] ?? 0) % lesson.steps.length} confirmTouch={settings.confirmTouch}
      progress={progress} celebrer={(settings as Partial<{ celebrations: boolean }>).celebrations !== false}
      onProgress={n => record(lesson.id, n)} onExit={() => { setLessonId(null); window.scrollTo({ top: 0 }); }}
      onNext={leconSuivante && (() => { setLessonId(leconSuivante.id); window.scrollTo({ top: 0 }); })} />;
  } else if (tab === 'apprendre') {
    screen = <LearnHome progress={progress} onOpen={setLessonId} sync={syncState} />;
  } else if (tab === 'problemes') {
    screen = <Puzzles db={supabase} userId={session?.user.id} sessionLoading={session === undefined} confirmTouch={settings.confirmTouch} onCompte={() => go('profil')} />;
  } else if (tab === 'profil') {
    screen = <Profil vue={vueProfil} onVue={setVueProfil} settings={settings} set={set} profil={profil} serie={serie} />;
  } else {
    const daily = puzzleOfDay(PROBLEMES_LOCAUX, new Date());
    const rangLecon = leconConseillee ? LESSONS.indexOf(leconConseillee) + 1 : 0;
    screen = (
      <Accueil adv={adv} battu={battu(bilan, adv.id)} textes={home} taille={settings.size} cartes={cartes}
        reglages={reglages} setReglages={setReglages} onTaille={n => set({ size: n })} onChoisir={setAdversaire}
        onJouer={() => lancer('ordi')} onDeux={() => lancer('deux')}
        probleme={daily && { titre: daily.title, rows: daily.rows, reussi: !!readLocal<Record<string, true>>(PROBLEMES_RESOLUS_KEY, {})[daily.id] }}
        onProbleme={() => go('problemes')}
        lecon={leconConseillee && { rang: rangLecon, total: LESSONS.length, titre: leconConseillee.title }}
        onLecon={() => { go('apprendre'); if (leconConseillee) setLessonId(leconConseillee.id); }} />
    );
  }

  const accueilVisible = tab === 'jouer' && !playing;
  return (
    <>
      <main className={`app${accueilVisible ? ' app-home' : ''}${enPartie ? ' app-partie' : ''}`}>
        {!enPartie && <header className="top">
          <h1>Go</h1>
          {accueilVisible
            ? serie > 0 && <p className="serie" role="img" aria-label={`Série de ${serie} jour${serie > 1 ? 's' : ''}`}><Flamme />{serie}</p>
            : <p>{tab === 'jouer' ? 'Jouer' : tab === 'apprendre' ? 'Le chemin des leçons' : tab === 'problemes' ? 'Problèmes' : 'Profil'}</p>}
        </header>}
        {screen}
      </main>
      {/* Pendant une partie, comme chez chess.com : pas de barre de navigation, « ‹ » ramène à l'accueil. */}
      {!enPartie && <BarreNav actif={tab} onChoisir={go} />}
      <ConsentModal visible={fenetreVisible({ consent, ignoree: accordIgnore, enPartie, surConditions: tab === 'profil' && vueProfil === 'conditions' })}
        onConditions={() => { go('profil'); setVueProfil('conditions'); }} onIgnorer={() => setAccordIgnore(true)} />

    </>
  );
}
