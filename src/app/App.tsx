import { useState } from 'react';
import { Game } from './Game';
import { Account } from './Account';
import { LearnHome, LessonPlayer } from './Learn';
import { LESSONS } from '../content/lessons';
import { Puzzles } from './Puzzles';
import { readLocal, useLessonProgress, useSerie, useSession } from './hooks';
import { supabase } from '../data/supabase';
import { useSettings, useStored } from './settings';
import { Bubble } from '../ui/Mochi';
import { Sceau } from '../ui/Sceau';
import { OPPONENTS, type OpponentId } from '../engine';
import { ConsentBanner, Confidentialite } from './Confidentialite';
import { accueil, adversaireOuvert, echelle, introBut, INTRO_KEY, PARTIES_KEY, type Parties } from './home';
import { Accueil } from './Accueil';
import { BASE_PUZZLES } from '../content/puzzles';
import { parsePuzzles, puzzleOfDay } from '../data/puzzles';
import { battu, BILAN_KEY, enregistrer, fin, komiDepuisUrl, lireBilan, type Bilan } from './bilan';

const PROBLEMES_LOCAUX = parsePuzzles(BASE_PUZZLES);
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

type Tab = 'jouer' | 'apprendre' | 'problemes' | 'profil';

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
  const [resultat, setResultat] = useState<null | { gagne: boolean }>(null); // fin de la partie en cours contre l'ordi
  const [partie, setPartie] = useState(0); // change à chaque partie pour repartir d'un plateau vide
  const home = accueil(parties, done, adv, settings.size);
  const leconConseillee = LESSONS.find(l => (progress[l.id] ?? 0) < l.steps.length);

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

  function onResult(winner: 1 | 2) {
    if (playing !== 'ordi') return;
    const gagne = winner === 1;
    setBilan(enregistrer(bilan, adv.id, gagne));
    setResultat({ gagne });
  }

  let finEcran;
  if (playing === 'ordi' && resultat) {
    const f = fin(adv, resultat.gagne, bilan, OPPONENTS);
    finEcran = {
      mochi: <Bubble>{f.mochi}</Bubble>,
      actions: (
        <div className="dock">
          <button className="cta" onClick={() => lancer('ordi', f.cible as OpponentId)}>{f.cta}</button>
          <div className="row">
            {leconConseillee && <button className="btn" onClick={() => { setPlaying(false); setResultat(null); setTab('apprendre'); setLessonId(leconConseillee.id); window.scrollTo({ top: 0 }); }}>Leçon : {leconConseillee.title}</button>}
            <button className="btn" onClick={() => { setPlaying(false); setResultat(null); setIntro(false); }}>Accueil</button>
          </div>
        </div>
      ),
    };
  }

  const go = (t: Tab) => { setTab(t); setPlaying(false); setLessonId(null); window.scrollTo({ top: 0 }); };

  const enPartie = tab === 'jouer' && !!playing;
  let screen;
  if (enPartie) {
    screen = (
      <>
        <Game key={`${playing === 'ordi' ? adv.id : 'deux'}-${partie}`} size={settings.size} komi={KOMI} aiKomi={KOMI_ORDI} confirmTouch={settings.confirmTouch} opponent={playing === 'ordi' ? adv : undefined}
          intro={intro && playing === 'ordi' ? <Bubble>{introBut(adv.nom)}</Bubble> : undefined} onExit={() => { setIntro(false); setPlaying(false); setResultat(null); }}
          onResult={onResult} fin={finEcran} portrait={playing === 'ordi' ? <Sceau id={adv.id} taille={44} /> : undefined} />
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
    screen = (
      <div>
        <h2 style={{ marginTop: 0 }}>Réglages</h2>
        <p className="muted small">Thème</p>
        <div className="seg">
          {(['auto', 'dark', 'light'] as const).map(t => <button key={t} aria-pressed={settings.theme === t} onClick={() => set({ theme: t })}>{t === 'auto' ? 'Automatique' : t === 'dark' ? 'Encre' : 'Papier'}</button>)}
        </div>
        <p className="muted small">Au doigt, confirmer chaque coup par une seconde touche</p>
        <div className="seg">
          <button aria-pressed={settings.confirmTouch} onClick={() => set({ confirmTouch: true })}>Oui</button>
          <button aria-pressed={!settings.confirmTouch} onClick={() => set({ confirmTouch: false })}>Non</button>
        </div>
        <p className="muted small">Sons</p>
        <div className="seg" role="group" aria-label="Sons">
          <button aria-pressed={settings.sound} onClick={() => set({ sound: true })}>Activés</button>
          <button aria-pressed={!settings.sound} onClick={() => set({ sound: false })}>Coupés</button>
        </div>
        <h2>Ton compte</h2>
        <Account />
        <h2>Confidentialité</h2>
        <Confidentialite />
        <h2>Bientôt</h2>
        <div className="card">Parties en ligne contre des joueurs de ton niveau.</div>
      </div>
    );
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
        {!playing && !lesson && <ConsentBanner onMore={() => go('profil')} />}
        {screen}
      </main>
      {/* Pendant une partie, comme chez chess.com : pas de barre de navigation, « ‹ » ramène à l'accueil. */}
      {!enPartie && <nav className="nav" aria-label="Navigation principale">
        <button aria-current={tab === 'jouer' ? 'page' : undefined} onClick={() => go('jouer')}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="9" r="4.5" fill="currentColor" /><circle cx="16" cy="15" r="4.5" /></svg>Jouer
        </button>
        <button aria-current={tab === 'apprendre' ? 'page' : undefined} onClick={() => go('apprendre')}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18c3-1 5-4 9-4s6 3 9 4M6 10a2 2 0 1 0 0-.1M12 7a2 2 0 1 0 0-.1M18 10a2 2 0 1 0 0-.1" /></svg>Apprendre
        </button>
        <button aria-current={tab === 'problemes' ? 'page' : undefined} onClick={() => go('problemes')}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v16H4zM4 12h16M12 4v16" /><circle cx="12" cy="12" r="3" fill="currentColor" /></svg>Problèmes
        </button>
        <button aria-current={tab === 'profil' ? 'page' : undefined} onClick={() => go('profil')}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></svg>Profil
        </button>
      </nav>}
    </>
  );
}
