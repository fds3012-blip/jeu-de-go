// « Tes erreurs à rejouer » (issue #77) : les erreurs de tes parties, gardées sur l'appareil, rejouées comme des problèmes.
// Section de l'onglet Problèmes, affichée seulement s'il y en a à rejouer aujourd'hui. Chaque problème s'ouvre dans le
// lecteur de problème existant (passé par Puzzles.tsx), en plein écran. Raté : il revient le lendemain ;
// réussi : il revient à J+3, puis J+7 ; à la deuxième réussite, il est maîtrisé et sort de la liste. Logique pure : src/app/erreurs.ts.
import { useEffect, useMemo, useState, type ComponentType } from 'react';
import type { Puzzle } from '../data/puzzles';
import { EVENTS, track } from '../data/analytics';
import { noterActivite } from '../app/xp';
import { readLocal, writeLocal } from '../app/hooks';
import { apresEssai, aRejouer, devientMaitrisee, ERREURS_KEY, lireErreurs, versProbleme, type ErreurGardee } from '../app/erreurs';
import { MiniGoban } from './MiniGoban';
import { fr } from './typo';
import { t } from '../content/i18n/secondaires';

/** Ce que MesErreurs passe au lecteur de problème (PuzzlePlayer de Puzzles.tsx). */
export interface LecteurProps {
  puzzle: Puzzle; rang: number; confirmTouch: boolean; rated: boolean;
  onAttempt: (ok: boolean) => Promise<null>;
  onSolved: (essais: number) => void; onNext?: () => void; onExit: () => void;
}

export function MesErreurs({ confirmTouch, Lecteur }: { confirmTouch: boolean; Lecteur: ComponentType<LecteurProps> }) {
  const [liste, setListe] = useState<ErreurGardee[]>(() => lireErreurs(readLocal<unknown>(ERREURS_KEY, [])));
  // Problème ouvert : il reste affiché même après être sorti de la liste (réussi).
  const [ouvert, setOuvert] = useState<ErreurGardee | null>(null);
  const aJouer = useMemo(() => aRejouer(liste, new Date()), [liste]);

  useEffect(() => {
    if (!ouvert) return;
    window.scrollTo?.({ top: 0 });
    const echap = (e: KeyboardEvent) => { if (e.key === 'Escape') setOuvert(null); };
    window.addEventListener('keydown', echap);
    return () => window.removeEventListener('keydown', echap);
  }, [ouvert]);

  function noter(e: ErreurGardee, reussi: boolean) {
    const avant = lireErreurs(readLocal<unknown>(ERREURS_KEY, [])), gardee = avant.find(x => x.id === e.id) ?? e;
    const suite = apresEssai(avant, e.id, reussi, new Date());
    writeLocal(ERREURS_KEY, suite);
    setListe(suite);
    noterActivite('erreurs'); // #369 : objectif « erreurs rejouées » de la semaine
    track(EVENTS.erreurRejouee, { reussi, source: 'problemes', taille: e.size, coup: e.coup, rates: gardee.rates, reponses: e.reponses.length });
    if (devientMaitrisee(gardee, reussi)) track(EVENTS.erreurMaitrisee, { taille: e.size, coup: e.coup, rates: gardee.rates });
  }

  if (ouvert) {
    const pz = versProbleme(ouvert);
    const prochain = aJouer.find(e => e.id !== ouvert.id);
    return (
      <div className="mes-erreurs-ecran" role="dialog" aria-modal="true" aria-label={pz.title}>
        <div className="mes-erreurs-contenu">
          <Lecteur key={ouvert.id} puzzle={pz} rang={Math.max(1, aJouer.findIndex(e => e.id === ouvert.id) + 1)} confirmTouch={confirmTouch}
            // Seul le premier essai compte : `rated` fait remonter son résultat par onAttempt (aucune cote ici).
            rated onAttempt={async ok => { noter(ouvert, ok); return null; }}
            onSolved={() => {}}
            onNext={prochain ? () => setOuvert(prochain) : undefined}
            onExit={() => setOuvert(null)} />
        </div>
      </div>
    );
  }

  if (!aJouer.length) return null;
  return (
    <section aria-labelledby="erreurs-titre" className="mes-erreurs">
      <h2 id="erreurs-titre" className="titre-pierres">
        {t('erreurs.titre')} <span className="mes-erreurs-compteur" aria-label={t('erreurs.compteurAria', { n: aJouer.length })}>{aJouer.length}</span>
      </h2>
      <p className="muted small bases-aide">{fr(t('erreurs.aide'))}</p>
      <ul className="grille-pb">
        {aJouer.map(e => {
          const pz = versProbleme(e);
          return (
            <li key={e.id}>
              <button onClick={() => setOuvert(e)} aria-label={t('erreurs.rejouerAria', { titre: pz.title })}>
                <span className="grille-goban"><MiniGoban rows={e.rows} /></span>
                <b aria-hidden="true">{pz.title}</b>
                <span aria-hidden="true" className="muted small">{t(e.toPlay === 1 ? 'pb.joue.1' : 'pb.joue.2')}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
