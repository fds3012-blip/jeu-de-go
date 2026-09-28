import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Game } from './Game';
import { LearnHome, LessonPlayer } from './Learn';
import { LESSONS } from '../content/lessons';
import { Puzzles, SOLVED_KEY } from './Puzzles';
import { readLocal, writeLocal, useGelsServeur, useLessonProgress, useProfil, useSerie, useSession } from './hooks';
import { supabase } from '../data/supabase';
import { useSettings, useStored } from './settings';
import { aideActive } from './partie';
import { Bubble } from '../ui/Mochi';
import { Sceau } from '../ui/Sceau';
import { OPPONENTS, type OpponentId } from '../engine';
import { ConsentModal } from './Confidentialite';
import { Profil, type VueProfil } from './Profil';
import { t } from '../content/i18n';
import { fenetreVisible, useConsentement } from './consentement';
import { accueil, adversaireOuvert, echelle, introBut, INTRO_KEY, PARTIES_KEY, type Parties } from './home';
import { Accueil } from './Accueil';
import { ALL_PUZZLES } from '../content/puzzles';
import { parsePuzzles } from '../data/puzzles';
import { EVENTS, track } from '../data/analytics';
import { PARAM, SERIE_KEY, numeroDuJour, numeroDuLien, problemeDuNumero, type Serie } from './goDuJour';
import { battu, BILAN_KEY, enregistrer, fin, komiDepuisUrl, lireBilan, type Bilan, type Issue, type StatsPartie } from './bilan';
import { fr } from '../ui/typo';
import { Glacon } from '../ui/Glacon';
import { Mochi } from '../ui/Mochi';
import { constaterPerteAppareil, lireRecordAppareil, lireReserveAppareil, noterRecordAppareil, reconcilierAppareil } from './gelAppareil';
import { annoncerPerte, messagePerte } from './serieRecord';
import { VISITE_KEY, etatFlamme, lireVisite, visiter } from './flamme';
import { serieAffichee } from './serieLocale';
import { messageGel } from './gel';
import { goDuJourFaitAppareil } from './defiAppareil';
import { BarreNav, type Onglet } from '../ui/IconesNav';
import { BarreNiveau, FeteNiveau } from '../ui/Niveau';
import { annonceKomi, equilibrage, KOMI_NORMAL, partiesOrdi, type Equilibrage } from './equilibrage';
import { AnnonceXp } from '../ui/PastilleXp';
import { useExercice } from '../ui/celebrations';
import { ProposerInstallation, usePlateformeInstallation } from '../ui/ProposerInstallation';
import { doitProposer, estMomentRetour, etatInstallation, noterOuverture } from './installation';
import { ANNONCE_DU_JOUR_KEY, appelSecondaire, etatTuile, lireJourAnnonce } from './appelsAccueil';
import { SeriePratique } from './SeriePratique';
import { TAILLE_SERIE, THEMES_DE_LECON, serieDeLecon } from '../content/themes';
import { estRedite } from '../content/redites';
import type { Puzzle } from '../data/puzzles';

const PROBLEMES_LOCAUX = parsePuzzles(ALL_PUZZLES);

/** Flamme de la série de jours, en or. Creuse ou pleine selon la classe du parent (#213). */
function Flamme() {
  return (
    <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true" focusable="false">
      <path className="flamme-corps" d="M8.6 1.2c.4 2.3 3.9 3.9 3.9 7.9A4.5 4.5 0 0 1 8 13.8a4.5 4.5 0 0 1-4.5-4.6c0-2 1-3.2 2-4 0 1.4.6 2.4 1.5 2.7C6.6 5.6 7.4 3 8.6 1.2Z" fill="currentColor" />
    </svg>
  );
}

// Komi : 6,5 (à deux), ou celui de l'équilibrage contre l'ordi (#160 : 0,5 pour les 3 premières parties).
// Paramètre de test `?komi=` : il remplace le komi du comptage (l'ordi, lui, garde celui de l'équilibrage). Il ne sert
// qu'aux tests de bout en bout et n'est lu que dans un build de test (VITE_E2E, voir playwright.config.ts).
const KOMI_TEST = import.meta.env.VITE_E2E && typeof location !== 'undefined' ? komiDepuisUrl(location.search, NaN) : NaN;
const komiCompte = (k: number) => (Number.isNaN(KOMI_TEST) ? k : KOMI_TEST);

type Tab = Onglet;

// Go du jour (issue #75) : un lien partagé `?go-du-jour=N` ouvre directement le défi, sans compte.
// Lu une fois au chargement ; le paramètre est ensuite retiré de l'adresse, pour qu'un rechargement ne compte pas
// une deuxième arrivée : `arrivee_par_partage` part donc une seule fois par session.
const LIEN_DU_JOUR = typeof location !== 'undefined' ? numeroDuLien(location.search) : null;
let arriveeEnvoyee = false;
function noterArrivee() {
  if (LIEN_DU_JOUR === null || arriveeEnvoyee) return;
  arriveeEnvoyee = true;
  track(EVENTS.arriveeParPartage, { numero_demande: LIEN_DU_JOUR, numero_du_jour: numeroDuJour(new Date()) });
  try {
    const url = new URL(location.href);
    url.searchParams.delete(PARAM);
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  } catch { /* adresse inchangée : sans conséquence */ }
}

export function App() {
  const [tab, setTab] = useState<Tab>(LIEN_DU_JOUR !== null ? 'problemes' : 'jouer');
  const [duJourOuvert, setDuJourOuvert] = useState(false);
  useEffect(noterArrivee, []);
  const [settings, set] = useSettings();
  const [playing, setPlaying] = useState<false | 'ordi' | 'deux'>(false);
  const [adversaire, setAdversaire] = useStored<OpponentId>('go.adversaire.v1', 'pomme');
  const [lessonId, setLessonId] = useState<string | null>(null);
  // Série de 3 problèmes ouverte depuis la fin d'une leçon (#200), figée à l'ouverture.
  const [serie3, setSerie3] = useState<Puzzle[] | null>(null);
  const session = useSession(supabase);
  const { progress, state: syncState, record } = useLessonProgress(supabase, session?.user.id);
  const done = LESSONS.filter(l => (progress[l.id] ?? 0) >= l.steps.length).length;
  const lesson = LESSONS.find(l => l.id === lessonId);
  const [parties, setParties] = useStored<Parties>(PARTIES_KEY, { n: 0 });
  const [introVue, setIntroVue] = useStored<boolean>(INTRO_KEY, false);
  const [intro, setIntro] = useState(false); // bulle « but du jeu » au-dessus du plateau
  // Équilibrage de la partie contre l'ordi en cours (#160) et son annonce du komi par Mochi.
  const [reglage, setReglage] = useState<Equilibrage & { annonce: string | null }>({ komi: KOMI_NORMAL, avantage: true, annonce: null });
  const [reglages, setReglages] = useState(false);
  const [bilanBrut, setBilan] = useStored<Bilan>(BILAN_KEY, {});
  const bilan = lireBilan(bilanBrut);
  // Un adversaire verrouillé (choisi avant l'arrivée des verrous) laisse place à celui qu'il faut battre d'abord.
  const adv = adversaireOuvert(OPPONENTS, bilan, adversaire);
  const cartes = echelle(OPPONENTS, bilan).map(e => ({ id: e.adv.id, nom: e.adv.nom, rang: e.adv.rang, battu: e.battu, ouvert: e.ouvert, requis: e.requis?.nom }));
  const serieServeur = useSerie(supabase, session?.user.id);
  // Série protégée (issue #76) : les jours manqués consomment un gel dès l'ouverture, avant que Problèmes lise la série.
  const [annonceGel, setAnnonceGel] = useState(() => reconcilierAppareil(new Date()));
  // Rien de gagné ne se perd (issue #212) : série perdue constatée juste après les gels, annoncée une fois par Mochi.
  // Retour après une absence (#213) : mesuré au premier passage du jour, gardé toute la journée.
  const [absence] = useState(() => {
    const v = visiter(lireVisite(readLocal<unknown>(VISITE_KEY, null)), numeroDuJour(new Date()));
    writeLocal(VISITE_KEY, v);
    return v.absence;
  });
  const [retourSerie, setRetourSerie] = useState(() => { const p = constaterPerteAppareil(new Date()); return annoncerPerte(p) ? messagePerte(p) : null; });
  // Joueur connecté : les gels du serveur ; sinon ceux de l'appareil (issue #76).
  const gelsServeur = useGelsServeur(supabase, session?.user.id);
  const gels = gelsServeur ?? lireReserveAppareil().gels;
  // Série dès le jour 1, avec ou sans compte (issue #161) : l'appareil sans compte, la plus longue des deux sinon.
  const serie = serieAffichee(session?.user.id ? serieServeur : null, readLocal<Serie | null>(SERIE_KEY, null), numeroDuJour(new Date()));
  // Record : celui de l'appareil, ou la série affichée (celle du serveur si connecté) si elle le dépasse (#212).
  const recordSerie = Math.max(lireRecordAppareil().record, serie);
  useEffect(() => { noterRecordAppareil(serie); }, [serie]);
  const [resultat, setResultat] = useState<null | { issue: Issue; stats: StatsPartie }>(null); // fin de la partie en cours contre l'ordi
  const [partie, setPartie] = useState(0); // change à chaque partie pour repartir d'un plateau vide
  // #236 (N2) : une partie en cours est un exercice ; l'XP et la fête de niveau attendent l'écran de fin.
  const [partieFinie, setPartieFinie] = useState(false);
  useExercice(tab === 'jouer' && !!playing && !partieFinie);
  const numeroJour = numeroDuJour(new Date());
  const duJour = problemeDuNumero(PROBLEMES_LOCAUX, numeroJour);
  const duJourFait = goDuJourFaitAppareil(numeroJour);
  const home = accueil(parties, done, adv, settings.size, { numero: numeroJour, absence, duJourFait, titreDuJour: duJour?.title });
  const flamme = etatFlamme(serie, duJourFait);
  const leconConseillee = LESSONS.find(l => (progress[l.id] ?? 0) < l.steps.length);
  // Profil (issue #50) : sous-vue ouverte, et fenêtre de consentement fermée avec Échap pendant cette session.
  const [vueProfil, setVueProfil] = useState<VueProfil>('menu');
  // Installation (#214) : proposée sur l'accueil à partir du 2e retour (jour d'ouverture distinct), une seule fois.
  const [ouverture] = useState(() => noterOuverture(numeroDuJour(new Date())));
  // #236 (N4) : un seul appel secondaire sur l'accueil (annonce de Mochi, carte d'installation ou « À faire »).
  const plateforme = usePlateformeInstallation();
  const [etatInstall] = useState(etatInstallation);
  const annonceAccueil = annonceGel !== null || retourSerie !== null;
  useEffect(() => { if (annonceAccueil) writeLocal(ANNONCE_DU_JOUR_KEY, numeroJour); }, [annonceAccueil, numeroJour]);
  const [jourAnnonce] = useState(() => lireJourAnnonce(readLocal<unknown>(ANNONCE_DU_JOUR_KEY, null)));
  const appel = appelSecondaire({
    jour: numeroJour, parties: parties.n, duJourFait, annonce: annonceAccueil, jourAnnonce,
    installation: estMomentRetour(ouverture) && doitProposer({ plateforme, etat: etatInstall, moment: 'retour', enPartie: false }),
  });
  const [accordIgnore, setAccordIgnore] = useState(false);
  const consent = useConsentement();
  const profil = useProfil(supabase);

  function lancer(mode: 'ordi' | 'deux', contre: OpponentId = adv.id) {
    // Première partie contre l'ordi : Mochi explique le but, une seule fois.
    const montrer = mode === 'ordi' && !introVue;
    setIntro(montrer);
    if (montrer) setIntroVue(true);
    if (mode === 'ordi') setAdversaire(contre);
    const rang = partiesOrdi(parties);
    const e = mode === 'ordi' ? equilibrage(rang) : { komi: KOMI_NORMAL, avantage: true };
    setReglage({ ...e, annonce: mode === 'ordi' ? annonceKomi(rang, komiCompte(e.komi)) : null });
    setParties({ n: parties.n + 1, dernier: mode === 'ordi' ? contre : parties.dernier, ordi: rang + (mode === 'ordi' ? 1 : 0) });
    setReglages(false);
    setResultat(null);
    setPartieFinie(false);
    setPartie(partie + 1);
    setPlaying(mode);
    window.scrollTo({ top: 0 });
  }

  function onResult(winner: 0 | 1 | 2, stats: StatsPartie) {
    setPartieFinie(true);
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
          {lecon && <button type="button" className="lien" onClick={() => { setPlaying(false); setResultat(null); setTab('apprendre'); setLessonId(lecon.id); window.scrollTo({ top: 0 }); }}>{t('fin.ouvrirLecon')}</button>}
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

  // Toucher l'onglet Problèmes déjà actif ramène à sa liste, comme Apprendre ramène au chemin (recette du 28/09, R4).
  const [racineProblemes, setRacineProblemes] = useState(0);
  const go = (t: Tab) => {
    if (t === 'problemes' && tab === 'problemes') setRacineProblemes(n => n + 1);
    setAnnonceGel(null); setRetourSerie(null); setTab(t); setPlaying(false); setLessonId(null); setSerie3(null); setVueProfil('menu'); window.scrollTo({ top: 0 });
  };

  const enPartie = tab === 'jouer' && !!playing;
  let screen;
  if (enPartie) {
    screen = (
      <>
        <Game key={`${playing === 'ordi' ? adv.id : 'deux'}-${partie}`} size={settings.size} komi={komiCompte(reglage.komi)} aiKomi={reglage.komi} avantage={reglage.avantage} accommodant={reglage.accommodant} confirmTouch={settings.confirmTouch} opponent={playing === 'ordi' ? adv : undefined}
          intro={playing === 'ordi' && (intro || reglage.annonce) ? <Bubble>{intro ? introBut(adv.nom) : t('partie.bulle', { nom: adv.nom })}{reglage.annonce && <><br /><span className="annonce-komi">{reglage.annonce}</span></>}</Bubble> : undefined}
          onExit={() => { setIntro(false); setPlaying(false); setResultat(null); }}
          onResult={onResult} fin={finEcran} celebrer={settings.celebrations} aide={aideActive(settings.aide, adv.id)} portrait={playing === 'ordi' ? <Sceau id={adv.id} taille={44} /> : undefined} />
      </>
    );
  } else if (tab === 'apprendre' && serie3) {
    screen = <SeriePratique problemes={serie3} confirmTouch={settings.confirmTouch} onFin={() => { setSerie3(null); window.scrollTo({ top: 0 }); }} />;
  } else if (tab === 'apprendre' && lesson) {
    const leconSuivante = LESSONS[LESSONS.indexOf(lesson) + 1];
    // Fin de leçon (#200) : 3 problèmes du thème, et en fin de chapitre une partie contre le premier adversaire.
    const themes = THEMES_DE_LECON[lesson.id] ?? [];
    const premier = OPPONENTS[0];
    screen = <LessonPlayer key={lesson.id} lesson={lesson} start={(progress[lesson.id] ?? 0) % lesson.steps.length} confirmTouch={settings.confirmTouch}
      progress={progress} celebrer={(settings as Partial<{ celebrations: boolean }>).celebrations !== false}
      onProgress={n => record(lesson.id, n)} onExit={() => { setLessonId(null); window.scrollTo({ top: 0 }); }}
      onNext={leconSuivante && (() => { setLessonId(leconSuivante.id); window.scrollTo({ top: 0 }); })}
      pratique={themes.length ? {
        themes: themes.map(th => t(`theme.${th}`)),
        ouvrir: () => {
          const s = serieDeLecon(lesson.id, PROBLEMES_LOCAUX, new Set(Object.keys(readLocal<Record<string, true>>(SOLVED_KEY, {}))),
            // #237 : pas le même exercice que l'étape de leçon qui vient d'être jouée.
            TAILLE_SERIE, p => estRedite(p, lesson));
          if (s.length) { setSerie3(s); setLessonId(null); window.scrollTo({ top: 0 }); }
        },
      } : undefined}
      jouer={{ nom: premier.nom, lancer: () => { setLessonId(null); setTab('jouer'); lancer('ordi', premier.id); } }} />;
  } else if (tab === 'apprendre') {
    screen = <LearnHome progress={progress} onOpen={setLessonId} sync={syncState} />;
  } else if (tab === 'problemes') {
    screen = <Puzzles db={supabase} userId={session?.user.id} sessionLoading={session === undefined} confirmTouch={settings.confirmTouch} onCompte={() => go('profil')}
      lien={LIEN_DU_JOUR} onDuJour={setDuJourOuvert} celebrer={settings.celebrations} racine={racineProblemes} />;
  } else if (tab === 'profil') {
    screen = <Profil vue={vueProfil} onVue={setVueProfil} settings={settings} set={set} profil={profil} serie={serie} record={recordSerie}
      parcours={{ lecons: { faites: done, total: LESSONS.length }, adversaires: OPPONENTS.length }} />;
  } else {
    const numero = numeroJour;
    const daily = duJour;
    const rangLecon = leconConseillee ? LESSONS.indexOf(leconConseillee) + 1 : 0;
    screen = (
      <Accueil adv={adv} battu={battu(bilan, adv.id)} textes={home} taille={settings.size} cartes={cartes}
        reglages={reglages} setReglages={setReglages} onTaille={n => set({ size: n })} onChoisir={setAdversaire}
        onJouer={() => lancer('ordi')} onDeux={() => lancer('deux')}
        probleme={daily && { numero, titre: daily.title, rows: daily.rows, reussi: duJourFait, etat: etatTuile(appel, duJourFait) }}
        onProbleme={() => go('problemes')}
        lecon={leconConseillee && { rang: rangLecon, total: LESSONS.length, titre: leconConseillee.title }}
        onLecon={() => { go('apprendre'); if (leconConseillee) setLessonId(leconConseillee.id); }}
        // Un seul appel à la fois (#236, N4) : pas de carte d'installation le jour où Mochi fait une annonce ;
        // quand elle se montre, la pastille « À faire » s'efface.
        installation={appel === 'installation' ? <ProposerInstallation moment="retour" /> : null} />
    );
  }

  const accueilVisible = tab === 'jouer' && !playing;
  // #213 : la flamme vue creuse s'allume au retour sur l'accueil, une fois, quand le Go du jour vient d'être fait.
  const flammeVue = useRef<typeof flamme>(null);
  const [allumage, setAllumage] = useState(false);
  // Avant la peinture : la flamme ne se montre pas pleine une image avant de s'allumer.
  useLayoutEffect(() => {
    if (!accueilVisible) return;
    if (flammeVue.current === 'creuse' && flamme === 'pleine') setAllumage(true);
    flammeVue.current = flamme;
  }, [accueilVisible, flamme]);
  useEffect(() => {
    if (!allumage) return;
    const id = setTimeout(() => setAllumage(false), 900);
    return () => clearTimeout(id);
  }, [allumage]);
  return (
    <>
      <main className={`app${accueilVisible ? ' app-home' : ''}${enPartie ? ' app-partie' : ''}`}>
        {!enPartie && <header className="top">
          <h1>Go</h1>
          {accueilVisible
            ? (flamme !== null || gels > 0) && (
              <span className="serie-groupe">
                {flamme !== null && <p className={`serie ${flamme}${allumage ? ' allumage' : ''}`} role="img" data-testid="flamme" data-etat={flamme}
                  aria-label={t(flamme === 'pleine' ? 'entete.flammeFaite' : 'entete.flammeAFaire', { jours: t('profil.jours', { n: serie }) })}><Flamme />{serie}</p>}
                <Glacon gels={gels} />
              </span>
            )
            : <p>{tab === 'jouer' ? t('nav.jouer') : tab === 'apprendre' ? t('entete.apprendre') : tab === 'problemes' ? t('nav.problemes') : t('nav.profil')}</p>}
        </header>}
        {annonceGel !== null && !enPartie && (tab === 'jouer' || tab === 'problemes') && (
          <p className="gel-annonce" role="status"><Mochi size={30} />{fr(messageGel(annonceGel))}</p>
        )}
        {retourSerie !== null && annonceGel === null && !enPartie && (tab === 'jouer' || tab === 'problemes') && (
          <p className="gel-annonce retour-serie" role="status" data-testid="retour-serie"><Mochi size={30} />{fr(retourSerie)}</p>
        )}
        {accueilVisible && <BarreNiveau />}
        {screen}
      </main>
      <FeteNiveau celebrer={settings.celebrations} ecran={`${tab}|${playing}|${lessonId ?? ''}|${serie3 ? 'serie' : ''}|${vueProfil}`} />
      <AnnonceXp celebrer={settings.celebrations} />
      {/* Pendant une partie, comme chez chess.com : pas de barre de navigation, « ‹ » ramène à l'accueil. */}
      {!enPartie && <BarreNav actif={tab} onChoisir={go} />}
      <ConsentModal visible={fenetreVisible({ consent, ignoree: accordIgnore, enPartie: enPartie || (tab === 'problemes' && duJourOuvert), surConditions: tab === 'profil' && vueProfil === 'conditions' })}
        onConditions={() => { go('profil'); setVueProfil('conditions'); }} onIgnorer={() => setAccordIgnore(true)} />

    </>
  );
}
