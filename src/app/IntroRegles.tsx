// Introduction interactive des règles (#523), chargée à la demande (src/app/ecrans.ts) : rien dans le JS initial.
//
// 10 écrans très courts (puis « Ta première partie » : une mini-partie 5 × 5 contre Pomme, #715) (v2 #710 : expliquer, puis faire ; la bulle décrit toujours l'écran ; un mot du go par écran), joués par le lecteur des leçons (src/app/Lecon.tsx, même moteur d'étapes, mêmes styles), puis
// un écran de fin qui n'a qu'une action principale :
// - version complète (« Jamais joué », « Revoir les règles ») : « Partie de découverte avec Mochi » (#677, A9) ;
// - version express (« Un peu ») : chaque écran se passe d'un toucher « Je sais » ; à la fin, « Partie de découverte avec
//   Mochi » (action principale) ou « Jouer contre Pomme » (lien).
// Contenu et preuves : src/content/introRegles.ts, src/go/introRegles.test.ts.
//
// Mesure (plan de marquage) : `intro_regles_etape` à chaque écran affiché, `intro_regles_finie` à l'écran de fin,
// `intro_regles_quittee` si l'on sort avant.
import { useEffect, useMemo, useRef, useState } from 'react';
import { LessonPlayer } from './Lecon';
import { MiniPartie, type ResultatMini } from './MiniPartie';
import { Retour } from '../ui/Lecteur';
import { leconIntro, motsIntro } from '../content/introRegles';
import type { DepuisIntro, VersionIntro } from './connaitGo';
import { PortraitMochi } from '../ui/Portrait';
import { Confettis } from '../ui/Confettis';
import { XpEnLigne } from '../ui/PastilleXp';
import { SerieDuJour } from '../ui/SerieDuJour';
import { useExercice } from '../ui/celebrations';
import { settingsCourants } from './settings';
import { prefersReducedMotion } from './hooks';
import { playVictory } from '../ui/sound';
import { hapticVictory } from '../ui/haptics';
import { fr } from '../ui/typo';
import { t } from '../content/i18n/secondaires';
import { EVENTS, track } from '../data/analytics';
import '../ui/intro-regles.css';

interface Props {
  version: VersionIntro;
  depuis: DepuisIntro;
  confirmTouch: boolean;
  /** Partie de découverte avec Mochi : passe par `ouvrirDecouverte()` d'App.tsx (seule porte vers #524). */
  onDecouverte: () => void;
  /** Rappel express : partie contre le premier adversaire de l'échelle. */
  contre: { nom: string; lancer: () => void };
  /** Sortie : « Quitter » pendant l'introduction, « ‹ » à sa fin (#646) ; là où elle a été ouverte. */
  onQuitter: () => void;
}

export function IntroRegles({ version, depuis, confirmTouch, onDecouverte, contre, onQuitter }: Props) {
  // Écran de la pose : « touche, puis touche encore » seulement si « Confirmer au doigt » est actif (#710).
  const lecon = useMemo(() => leconIntro(version, confirmTouch), [version, confirmTouch]);
  const mots = useMemo(motsIntro, []);
  // Comme une leçon (#236) : toute l'introduction, mini-partie et fin comprises, est un exercice. L'XP de la victoire se lit sur
  // l'écran de fin (et non en pastille entre deux écrans) ; la fête d'un niveau franchi attend qu'on la quitte.
  useExercice(true);
  // Les règles (10 écrans), puis la mini-partie (#715), puis la fin : « regles » → « mini » → « fin ».
  const [vue, setVue] = useState<'regles' | 'mini' | 'fin'>('regles');
  const [rang, setRang] = useState(0);
  const [resultat, setResultat] = useState<ResultatMini | null>(null);
  const etape = useRef(0);
  const express = version === 'express';
  // `parcours` et non `version` : `version` est ajoutée à chaque événement (commit de l'app).
  const mesure = { parcours: version, depuis };

  if (vue === 'mini') {
    return <MiniPartie key={rang} nom={contre.nom} rang={rang} confirmTouch={confirmTouch} parcours={version} depuis={depuis}
      onFin={r => { setResultat(r); setVue('fin'); window.scrollTo({ top: 0 }); }} onReessayer={() => setRang(n => n + 1)}
      onQuitter={onQuitter} />;
  }
  if (vue === 'fin') {
    return <FinIntro version={version} onDecouverte={onDecouverte} contre={contre} onRetour={onQuitter} resultat={resultat}
      onEncore={() => { setResultat(null); setRang(n => n + 1); setVue('mini'); window.scrollTo({ top: 0 }); }} />;
  }
  return (
    <LessonPlayer key={lecon.id} lesson={lecon} lecon={lecon} start={0} confirmTouch={confirmTouch} celebrer={false}
      onProgress={() => {}}
      onExit={() => { track(EVENTS.introReglesQuittee, { ...mesure, index: etape.current + 1 }); onQuitter(); }}
      parcours={{
        retour: t('intro.quitter'),
        terminer: t('intro.terminer'),
        passer: express ? { libelle: t('intro.jeSais'), aria: t('intro.jeSaisAria') } : undefined,
        mots,
        onEtape: i => { etape.current = i; track(EVENTS.introReglesEtape, { ...mesure, index: i + 1 }); },
        onFin: passees => { track(EVENTS.introReglesFinie, { ...mesure, passees }); setVue('mini'); window.scrollTo({ top: 0 }); },
      }} />
  );
}

/**
 * Fin de l'introduction : Mochi, fier ; les 10 notions posées sur une rangée de goban (la dernière cerclée d'or) ; une
 * seule action en relief. Reprend la mise en page et le mouvement de la fin de leçon (lecon.css), mouvements réduits compris.
 * Après une mini-partie gagnée (#715) : « Victoire ! », l'XP lue sur place, la série du jour (une seule fois par appareil),
 * la fête sobre (confettis seulement si « Célébrations » est actif, jamais en mouvements réduits) et « Encore une mini-partie ».
 */
function FinIntro({ version, onDecouverte, contre, onRetour, resultat, onEncore }: {
  version: VersionIntro; onDecouverte: () => void; contre: Props['contre']; onRetour: () => void; resultat: ResultatMini | null; onEncore: () => void;
}) {
  const titre = useRef<HTMLHeadingElement>(null);
  const sceau = useRef<HTMLDivElement>(null);
  const [reglages] = useState(settingsCourants);
  const [reduit] = useState(prefersReducedMotion);
  const [gerbe, setGerbe] = useState<null | { x: number; y: number }>(null);
  const gagnee = resultat?.gagnee === true;
  useEffect(() => {
    titre.current?.focus({ preventScroll: true });
    if (!gagnee || !reglages.celebrations) return;
    playVictory(); hapticVictory();
    if (reduit) return;
    const r = sceau.current?.getBoundingClientRect();
    setGerbe(r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: window.innerWidth / 2, y: window.innerHeight * 0.3 });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const express = version === 'express';
  return (<>
    {/* #646 : la seule sortie, en haut à gauche, comme pendant l'introduction : là où elle a été ouverte. */}
    <div className="lecteur-tete"><Retour label={t('intro.fin.retour')} onClick={onRetour} /></div>
    <div className="lecteur fin-lecon fin-intro" data-testid="fin-intro" data-victoire={gagnee || undefined}>
      <div className="fin-sceau" ref={sceau}><PortraitMochi humeur="fier" taille={96} decoratif /></div>
      <ol className="fin-gue" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => <li key={i} className={`faite${i === 9 ? ' juste-posee' : ''}`}><i /></li>)}
      </ol>
      <h2 className="fin-titre" ref={titre} tabIndex={-1}>{fr(t(gagnee ? 'intro.fin.victoireTitre' : express ? 'intro.fin.expressTitre' : 'intro.fin.titre'))}</h2>
      <p className="fin-acquis">{fr(gagnee ? t('intro.fin.victoireTexte', { nom: contre.nom }) : express ? t('intro.fin.expressTexte', { nom: contre.nom }) : t('intro.fin.texte'))}</p>
      {gagnee && <div className="fin-gain"><XpEnLigne anime={reglages.celebrations} /></div>}
      {gagnee && resultat?.serie && <SerieDuJour jours={resultat.serie.jours} jalon={resultat.serie.jalon} celebrer={reglages.celebrations && !gerbe} />}
      <div className="fin-actions">
        <button type="button" className="cta" data-action="decouverte" onClick={onDecouverte}>{t(express ? 'intro.fin.decouverte' : 'intro.fin.jouer')}</button>
        <button type="button" className="lien" data-action="encore" onClick={onEncore}>{t('intro.fin.encore')}</button>
        {express && <button type="button" className="lien" data-action="contre" onClick={contre.lancer}>{t('intro.fin.contre', { nom: contre.nom })}</button>}
      </div>
      {gerbe && <Confettis origine={gerbe} onFin={() => setGerbe(null)} />}
    </div>
  </>);
}
