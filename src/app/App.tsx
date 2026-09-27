import { useState } from 'react';
import { Game } from './Game';
import { Account } from './Account';
import { LearnHome, LessonPlayer } from './Learn';
import { LESSONS } from '../content/lessons';
import { useSettings, useStored } from './settings';
import { Bubble } from '../ui/Mochi';
import { OPPONENTS, opponent, type OpponentId } from '../engine';

type Tab = 'jouer' | 'apprendre' | 'profil';

export function App() {
  const [tab, setTab] = useState<Tab>('jouer');
  const [settings, set] = useSettings();
  const [playing, setPlaying] = useState<false | 'ordi' | 'deux'>(false);
  const [adversaire, setAdversaire] = useStored<OpponentId>('go.adversaire.v1', 'pomme');
  const adv = opponent(adversaire);
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [progress, setProgress] = useStored<Record<string, number>>('go.lecons.v1', {});
  const done = LESSONS.filter(l => (progress[l.id] ?? 0) >= l.steps.length).length;
  const lesson = LESSONS.find(l => l.id === lessonId);

  const go = (t: Tab) => { setTab(t); setPlaying(false); setLessonId(null); window.scrollTo({ top: 0 }); };

  let screen;
  if (tab === 'jouer' && playing) {
    screen = <Game key={playing === 'ordi' ? adv.id : 'deux'} size={settings.size} komi={6.5} confirmTouch={settings.confirmTouch} opponent={playing === 'ordi' ? adv : undefined} onExit={() => setPlaying(false)} />;
  } else if (tab === 'apprendre' && lesson) {
    screen = <LessonPlayer lesson={lesson} start={(progress[lesson.id] ?? 0) % lesson.steps.length} confirmTouch={settings.confirmTouch}
      onProgress={n => setProgress({ ...progress, [lesson.id]: Math.max(progress[lesson.id] ?? 0, n) })} onExit={() => setLessonId(null)} />;
  } else if (tab === 'apprendre') {
    screen = <LearnHome progress={progress} onOpen={setLessonId} />;
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
        <h2>Ton compte</h2>
        <Account />
        <h2>Bientôt</h2>
        <div className="card">Jouer contre KataGo, une IA de niveau professionnel, directement sur ton téléphone.</div>
        <div className="card">Parties en ligne contre des joueurs de ton niveau.</div>
      </div>
    );
  } else {
    screen = (
      <div>
        <Bubble>{done === 0 ? 'Nouveau au go ? Commence par le chemin des leçons : en dix minutes, tu sauras jouer.' : `Tu as terminé ${done} leçon${done > 1 ? 's' : ''} sur ${LESSONS.length}. Prêt pour une partie ?`}</Bubble>
        <h2>Nouvelle partie</h2>
        <p className="muted small" style={{ marginTop: 0 }}>Ton adversaire</p>
        <div className="seg">
          {OPPONENTS.map(o => <button key={o.id} aria-pressed={adv.id === o.id} onClick={() => setAdversaire(o.id)}>{o.nom}</button>)}
        </div>
        <p className="muted small"><b>{adv.nom}, {adv.rang}.</b> {adv.description} Tu as Noir.</p>
        <p className="muted small" style={{ marginTop: -6 }}>Le kyu est un niveau : plus le nombre est petit, plus on est fort.</p>
        <p className="muted small">Taille du plateau</p>
        <div className="seg">
          {([9, 13, 19] as const).map(n => <button key={n} aria-pressed={settings.size === n} onClick={() => set({ size: n })}>{n} × {n}</button>)}
        </div>
        <p className="muted small">{settings.size === 9 ? 'Parties courtes, idéal pour apprendre.' : settings.size === 13 ? 'Une partie de taille moyenne.' : 'Le plateau classique des joueurs confirmés.'}</p>
        <div className="card" style={{ marginTop: 16 }}>
          <b>Apprendre</b>
          <p className="muted small" style={{ margin: '4px 0 10px' }}>{done} leçon{done > 1 ? 's' : ''} terminée{done > 1 ? 's' : ''} sur {LESSONS.length}</p>
          <button className="btn" style={{ width: '100%' }} onClick={() => go('apprendre')}>Continuer le chemin</button>
        </div>
        <button className="btn" style={{ width: '100%', marginTop: 10 }} onClick={() => setPlaying('deux')}>Jouer à deux sur ce téléphone</button>
        <button className="cta" onClick={() => setPlaying('ordi')}>Jouer contre l'ordi</button>
      </div>
    );
  }

  return (
    <>
      <main className="app">
        <header className="top">
          <h1>Go</h1>
          <p>{tab === 'jouer' ? 'Jouer' : tab === 'apprendre' ? 'Le chemin des leçons' : 'Profil'}</p>
        </header>
        {screen}
      </main>
      <nav className="nav" aria-label="Navigation principale">
        <button aria-current={tab === 'jouer' ? 'page' : undefined} onClick={() => go('jouer')}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="9" r="4.5" fill="currentColor" /><circle cx="16" cy="15" r="4.5" /></svg>Jouer
        </button>
        <button aria-current={tab === 'apprendre' ? 'page' : undefined} onClick={() => go('apprendre')}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18c3-1 5-4 9-4s6 3 9 4M6 10a2 2 0 1 0 0-.1M12 7a2 2 0 1 0 0-.1M18 10a2 2 0 1 0 0-.1" /></svg>Apprendre
        </button>
        <button aria-current={tab === 'profil' ? 'page' : undefined} onClick={() => go('profil')}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></svg>Profil
        </button>
      </nav>
    </>
  );
}
