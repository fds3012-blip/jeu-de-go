// Introduction interactive des règles (#523), chargée à la demande (src/app/ecrans.ts) : rien dans le JS initial.
//
// 8 écrans très courts, joués par le lecteur des leçons (src/app/Lecon.tsx, même moteur d'étapes, mêmes styles), puis
// un écran de fin qui n'a qu'une action principale :
// - version complète (« Jamais joué », « Revoir les règles ») : « Jouer avec Mochi », la partie de découverte ;
// - version express (« Un peu ») : chaque écran se passe d'un toucher « Je sais » ; à la fin, « Partie de découverte avec
//   Mochi » (action principale) ou « Jouer contre Pomme » (lien).
// Contenu et preuves : src/content/introRegles.ts, src/go/introRegles.test.ts.
//
// Mesure (plan de marquage) : `intro_regles_etape` à chaque écran affiché, `intro_regles_finie` à l'écran de fin,
// `intro_regles_quittee` si l'on sort avant.
import { useEffect, useMemo, useRef, useState } from 'react';
import { LessonPlayer } from './Lecon';
import { leconIntro } from '../content/introRegles';
import type { DepuisIntro, VersionIntro } from './connaitGo';
import { PortraitMochi } from '../ui/Portrait';
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
  /** Sortie avant la fin, ou « Retour » à la fin d'une introduction ouverte depuis Apprendre ou l'aide. */
  onQuitter: () => void;
}

export function IntroRegles({ version, depuis, confirmTouch, onDecouverte, contre, onQuitter }: Props) {
  const lecon = useMemo(() => leconIntro(version), [version]);
  const [fini, setFini] = useState(false);
  const etape = useRef(0);
  const express = version === 'express';
  // `parcours` et non `version` : `version` est ajoutée à chaque événement (commit de l'app).
  const mesure = { parcours: version, depuis };

  if (fini) return <FinIntro version={version} depuis={depuis} onDecouverte={onDecouverte} contre={contre} onRetour={onQuitter} />;
  return (
    <LessonPlayer key={lecon.id} lesson={lecon} lecon={lecon} start={0} confirmTouch={confirmTouch} celebrer={false}
      onProgress={() => {}}
      onExit={() => { track(EVENTS.introReglesQuittee, { ...mesure, index: etape.current + 1 }); onQuitter(); }}
      parcours={{
        retour: t('intro.quitter'),
        terminer: t('intro.terminer'),
        passer: express ? { libelle: t('intro.jeSais'), aria: t('intro.jeSaisAria') } : undefined,
        onEtape: i => { etape.current = i; track(EVENTS.introReglesEtape, { ...mesure, index: i + 1 }); },
        onFin: passees => { track(EVENTS.introReglesFinie, { ...mesure, passees }); setFini(true); window.scrollTo({ top: 0 }); },
      }} />
  );
}

/**
 * Fin de l'introduction : Mochi, fier ; les 8 notions posées sur une rangée de goban (la dernière cerclée d'or) ; une
 * seule action en relief. Reprend la mise en page et le mouvement de la fin de leçon (lecon.css), mouvements réduits compris.
 */
function FinIntro({ version, depuis, onDecouverte, contre, onRetour }: { version: VersionIntro; depuis: DepuisIntro; onDecouverte: () => void; contre: Props['contre']; onRetour: () => void }) {
  const titre = useRef<HTMLHeadingElement>(null);
  useEffect(() => { titre.current?.focus({ preventScroll: true }); }, []);
  const express = version === 'express';
  return (
    <div className="lecteur fin-lecon fin-intro" data-testid="fin-intro">
      <div className="fin-sceau"><PortraitMochi humeur="fier" taille={96} decoratif /></div>
      <ol className="fin-gue" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => <li key={i} className={`faite${i === 7 ? ' juste-posee' : ''}`}><i /></li>)}
      </ol>
      <h2 className="fin-titre" ref={titre} tabIndex={-1}>{fr(t(express ? 'intro.fin.expressTitre' : 'intro.fin.titre'))}</h2>
      <p className="fin-acquis">{fr(express ? t('intro.fin.expressTexte', { nom: contre.nom }) : t('intro.fin.texte'))}</p>
      <div className="fin-actions">
        <button type="button" className="cta" data-action="decouverte" onClick={onDecouverte}>{t(express ? 'intro.fin.decouverte' : 'intro.fin.jouer')}</button>
        {express && <button type="button" className="lien" data-action="contre" onClick={contre.lancer}>{t('intro.fin.contre', { nom: contre.nom })}</button>}
        {/* Ouverte depuis Apprendre ou l'aide (« Revoir les règles ») : on peut aussi revenir là où l'on était. */}
        {depuis !== 'accueil' && <button type="button" className="lien" data-action="retour" onClick={onRetour}>{t('intro.fin.retour')}</button>}
      </div>
    </div>
  );
}
